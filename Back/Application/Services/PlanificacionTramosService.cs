using Back.Application.Common;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class PlanificacionTramosService
    {
        private const double MaxKmPorTramo = 560d;
        private readonly LogiTrackDbContext _context;
        private readonly GeocodingService _geocoding;

        public PlanificacionTramosService(LogiTrackDbContext context, GeocodingService geocoding)
        {
            _context = context;
            _geocoding = geocoding;
        }

        public async Task PlanificarAsync(Paquete paquete, Guid sucursalOrigenId)
        {
            var anteriores = await _context.TramosEnvio
                .Where(t => t.PaqueteId == paquete.Id)
                .ToListAsync();
            if (anteriores.Count > 0)
                _context.TramosEnvio.RemoveRange(anteriores);

            var sucursales = await _context.Sucursales
                .Where(s => s.Estado == SucursalStatus.Activa)
                .ToListAsync();
            var origen = sucursales.FirstOrDefault(s => s.Id == sucursalOrigenId)
                ?? throw new InvalidOperationException("La sucursal de origen no existe o no está activa.");
            var ubicacionDestino = paquete.Destinatario.Direccion.Ubicacion
                ?? throw new InvalidOperationException("El destino no tiene coordenadas válidas.");

            var ubicaciones = new Dictionary<Guid, Ubicacion>();
            foreach (var sucursal in sucursales)
            {
                var ubicacion = await _geocoding.GeocodeAsync(
                    sucursal.Direccion,
                    sucursal.Ciudad,
                    sucursal.CodigoPostal,
                    sucursal.Provincia);
                if (ubicacion is not null)
                    ubicaciones[sucursal.Id] = ubicacion;
            }

            if (!ubicaciones.ContainsKey(origen.Id))
                throw new InvalidOperationException("No se pudo ubicar la sucursal de origen.");

            var candidatasFisicas = sucursales
                .Where(s => string.Equals(s.Provincia?.Trim(), paquete.ProvinciaDestino?.Trim(), StringComparison.OrdinalIgnoreCase))
                .Where(s => ubicaciones.ContainsKey(s.Id))
                .ToList();
            var candidatasCobertura = sucursales
                .Where(s => s.Cubre(paquete.ProvinciaDestino))
                .Where(s => ubicaciones.ContainsKey(s.Id))
                .ToList();
            var candidatasFinales = candidatasFisicas.Count > 0 ? candidatasFisicas : candidatasCobertura;
            if (candidatasFinales.Count == 0)
                throw new InvalidOperationException($"No hay una sucursal que atienda {paquete.ProvinciaDestino}.");

            var sucursalFinal = candidatasFinales
                .OrderBy(s => DistanciaKm(ubicaciones[s.Id], ubicacionDestino))
                .First();
            var camino = BuscarCamino(origen, sucursalFinal, sucursales, ubicaciones);

            var tramos = new List<TramoEnvio>();
            for (var i = 0; i < camino.Count - 1; i++)
            {
                var desde = camino[i];
                var hasta = camino[i + 1];
                tramos.Add(new TramoEnvio(
                    paquete.Id,
                    tramos.Count + 1,
                    desde.Id,
                    hasta.Id,
                    esUltimaMilla: false,
                    DistanciaKm(ubicaciones[desde.Id], ubicaciones[hasta.Id]),
                    habilitado: tramos.Count == 0));
            }

            var distanciaUltimaMilla = DistanciaKm(ubicaciones[sucursalFinal.Id], ubicacionDestino);
            tramos.Add(new TramoEnvio(
                paquete.Id,
                tramos.Count + 1,
                sucursalFinal.Id,
                null,
                esUltimaMilla: true,
                distanciaUltimaMilla,
                habilitado: tramos.Count == 0));

            _context.TramosEnvio.AddRange(tramos);
            var primero = tramos[0];
            paquete.PrepararTramo(
                primero.SucursalOrigenId,
                primero.DistanciaKm,
                requiereFullTime: !primero.EsUltimaMilla || primero.HorasEstimadas > 6d);
        }

        public async Task<List<object>> ObtenerItinerarioAsync(Guid paqueteId, Guid? sucursalId = null)
        {
            var tramos = await _context.TramosEnvio
                .Where(t => t.PaqueteId == paqueteId)
                .OrderBy(t => t.Orden)
                .ToListAsync();
            var ids = tramos
                .SelectMany(t => new Guid?[] { t.SucursalOrigenId, t.SucursalDestinoId })
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();
            var nombres = await _context.Sucursales
                .Where(s => ids.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => s.Nombre);
            var repartidorIds = tramos
                .Where(t => t.RepartidorId.HasValue)
                .Select(t => t.RepartidorId!.Value)
                .Distinct()
                .ToList();
            var repartidores = await _context.Usuarios
                .Where(u => repartidorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => $"{u.Nombre} {u.Apellido}");
            var sucursalActualId = await _context.Paquetes
                .Where(p => p.Id == paqueteId)
                .Select(p => p.SucursalId)
                .SingleOrDefaultAsync();

            return tramos.Select(t => (object)new
            {
                t.Id,
                t.Orden,
                t.EsUltimaMilla,
                t.DistanciaKm,
                t.HorasEstimadas,
                t.Estado,
                t.RepartidorId,
                Repartidor = t.RepartidorId.HasValue
                    ? repartidores.GetValueOrDefault(t.RepartidorId.Value)
                    : null,
                t.IniciadoEn,
                t.FinalizadoEn,
                SucursalOrigenId = t.SucursalOrigenId,
                SucursalOrigen = nombres.GetValueOrDefault(t.SucursalOrigenId),
                SucursalDestinoId = t.SucursalDestinoId,
                SucursalDestino = t.SucursalDestinoId.HasValue
                    ? nombres.GetValueOrDefault(t.SucursalDestinoId.Value)
                    : "Domicilio / punto PickUp",
                EsDeMiSucursal = sucursalId.HasValue && t.SucursalOrigenId == sucursalId.Value,
                EsTramoActual = sucursalActualId == t.SucursalOrigenId
                    && t.Estado is TramoEnvioStatus.PendienteDeCalendarizacion
                        or TramoEnvioStatus.Asignado
                        or TramoEnvioStatus.EnTransito,
            }).ToList();
        }

        public async Task<PagedResponse<Paquete>> ObtenerTramosOperativosAsync(
            Guid sucursalId,
            string? search,
            List<PaqueteStatus>? estados,
            DateTime? from,
            DateTime? to,
            int page,
            int pageSize)
        {
            var query = _context.TramosEnvio
                .Where(t => t.SucursalOrigenId == sucursalId)
                .Join(_context.Paquetes, t => t.PaqueteId, p => p.Id, (t, p) => new { Tramo = t, Paquete = p });

            if (!string.IsNullOrWhiteSpace(search))
            {
                var value = search.Trim();
                query = query.Where(x =>
                    EF.Functions.ILike(x.Paquete.CodigoSeguimiento, $"%{value}%")
                    || EF.Functions.ILike(x.Paquete.Remitente.Nombre, $"%{value}%")
                    || EF.Functions.ILike(x.Paquete.Remitente.Apellido, $"%{value}%")
                    || EF.Functions.ILike(x.Paquete.Destinatario.Nombre, $"%{value}%")
                    || EF.Functions.ILike(x.Paquete.Destinatario.Apellido, $"%{value}%"));
            }

            if (estados is { Count: > 0 })
            {
                var estadosTramo = MapearEstadosTramo(estados);
                query = query.Where(x => estadosTramo.Contains(x.Tramo.Estado));
            }

            if (from.HasValue)
            {
                var fromUtc = DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
                query = query.Where(x => x.Paquete.CreadoEn >= fromUtc);
            }
            if (to.HasValue)
            {
                var toUtc = DateTime.SpecifyKind(to.Value, DateTimeKind.Utc);
                query = query.Where(x => x.Paquete.CreadoEn <= toUtc);
            }

            var tramoRows = await query.ToListAsync();
            var legacyQuery = _context.Paquetes
                .Where(p => p.SucursalId == sucursalId
                    && !_context.TramosEnvio.Any(t => t.PaqueteId == p.Id));

            if (!string.IsNullOrWhiteSpace(search))
            {
                var value = search.Trim();
                legacyQuery = legacyQuery.Where(p =>
                    EF.Functions.ILike(p.CodigoSeguimiento, $"%{value}%")
                    || EF.Functions.ILike(p.Remitente.Nombre, $"%{value}%")
                    || EF.Functions.ILike(p.Remitente.Apellido, $"%{value}%")
                    || EF.Functions.ILike(p.Destinatario.Nombre, $"%{value}%")
                    || EF.Functions.ILike(p.Destinatario.Apellido, $"%{value}%"));
            }
            if (estados is { Count: > 0 })
                legacyQuery = legacyQuery.Where(p => estados.Contains(p.Status));
            if (from.HasValue)
            {
                var fromUtc = DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
                legacyQuery = legacyQuery.Where(p => p.CreadoEn >= fromUtc);
            }
            if (to.HasValue)
            {
                var toUtc = DateTime.SpecifyKind(to.Value, DateTimeKind.Utc);
                legacyQuery = legacyQuery.Where(p => p.CreadoEn <= toUtc);
            }

            var legacy = await legacyQuery.ToListAsync();
            var combined = tramoRows
                .Select(x => (x.Paquete, Tramo: (TramoEnvio?)x.Tramo))
                .Concat(legacy.Select(p => (Paquete: p, Tramo: (TramoEnvio?)null)))
                .OrderByDescending(x => x.Paquete.CreadoEn)
                .ToList();
            var totalItems = combined.Count;
            var rows = combined
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();

            var sucursalIds = rows
                .Where(x => x.Tramo is not null)
                .SelectMany(x => new Guid?[] { x.Tramo!.SucursalOrigenId, x.Tramo.SucursalDestinoId })
                .Where(id => id.HasValue)
                .Select(id => id!.Value)
                .Distinct()
                .ToList();
            var sucursales = await _context.Sucursales
                .Where(s => sucursalIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id);

            foreach (var row in rows)
            {
                if (row.Tramo is null) continue;
                var tramo = row.Tramo;
                var paquete = row.Paquete;
                paquete.TramoOperativoId = tramo.Id;
                paquete.OrdenTramoOperativo = tramo.Orden;
                paquete.EstadoTramoOperativo = tramo.Estado.ToString();
                paquete.OrigenTramoOperativo = sucursales[tramo.SucursalOrigenId].Nombre;
                paquete.DestinoTramoOperativo = tramo.SucursalDestinoId.HasValue
                    ? sucursales.GetValueOrDefault(tramo.SucursalDestinoId.Value)?.Nombre
                    : $"{paquete.Destinatario.Direccion.Calle}, {paquete.Destinatario.Direccion.Ciudad}";
                paquete.EsTramoOperativoActual = paquete.SucursalId == sucursalId
                    && tramo.Estado is TramoEnvioStatus.PendienteDeCalendarizacion
                        or TramoEnvioStatus.Asignado
                        or TramoEnvioStatus.EnTransito;
            }

            return PagedResponse<Paquete>.Create(rows.Select(x => x.Paquete).ToList(), page, pageSize, totalItems);
        }

        private static List<TramoEnvioStatus> MapearEstadosTramo(IEnumerable<PaqueteStatus> estados)
        {
            var result = new HashSet<TramoEnvioStatus>();
            foreach (var estado in estados)
            {
                switch (estado)
                {
                    case PaqueteStatus.PendienteDeCalendarizacion:
                        result.Add(TramoEnvioStatus.PendienteDeCalendarizacion);
                        break;
                    case PaqueteStatus.AsignadoAVehiculo:
                    case PaqueteStatus.CargadoEnVehiculo:
                    case PaqueteStatus.ListoParaSalir:
                        result.Add(TramoEnvioStatus.Asignado);
                        break;
                    case PaqueteStatus.EnTransito:
                    case PaqueteStatus.Demorado:
                        result.Add(TramoEnvioStatus.EnTransito);
                        break;
                    case PaqueteStatus.Entregado:
                        result.Add(TramoEnvioStatus.RecibidoEnSucursal);
                        result.Add(TramoEnvioStatus.Entregado);
                        break;
                    case PaqueteStatus.Cancelado:
                        result.Add(TramoEnvioStatus.Cancelado);
                        break;
                }
            }
            return result.ToList();
        }

        public async Task EnriquecerDestinosOperativosAsync(IEnumerable<Paquete> paquetes)
        {
            var lista = paquetes.ToList();
            if (lista.Count == 0) return;
            var ids = lista.Select(p => p.Id).ToList();
            var tramos = await _context.TramosEnvio
                .Where(t => ids.Contains(t.PaqueteId)
                    && t.Estado != TramoEnvioStatus.RecibidoEnSucursal
                    && t.Estado != TramoEnvioStatus.Entregado
                    && t.Estado != TramoEnvioStatus.Cancelado)
                .OrderBy(t => t.Orden)
                .ToListAsync();
            var actuales = tramos.GroupBy(t => t.PaqueteId).ToDictionary(g => g.Key, g => g.First());
            var sucursalIds = actuales.Values
                .Where(t => !t.EsUltimaMilla && t.SucursalDestinoId.HasValue)
                .Select(t => t.SucursalDestinoId!.Value)
                .Distinct()
                .ToList();
            var sucursales = await _context.Sucursales
                .Where(s => sucursalIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id);

            foreach (var paquete in lista)
            {
                if (!actuales.TryGetValue(paquete.Id, out var tramo)
                    || tramo.EsUltimaMilla
                    || !tramo.SucursalDestinoId.HasValue
                    || !sucursales.TryGetValue(tramo.SucursalDestinoId.Value, out var sucursal))
                    continue;

                var ubicacion = await _geocoding.GeocodeAsync(
                    sucursal.Direccion,
                    sucursal.Ciudad,
                    sucursal.CodigoPostal,
                    sucursal.Provincia);
                paquete.NombreDestinoOperativo = sucursal.Nombre;
                paquete.DireccionDestinoOperativo = sucursal.Direccion;
                paquete.CiudadDestinoOperativo = sucursal.Ciudad;
                paquete.CpDestinoOperativo = sucursal.CodigoPostal;
                paquete.UbicacionDestinoOperativa = ubicacion;
            }
        }

        public async Task<bool> IntentarRecibirEnSucursalAsync(Paquete paquete, Guid operadorId)
        {
            var operador = await _context.Usuarios.FindAsync(operadorId);
            if (operador is not Operador || !operador.SucursalId.HasValue)
                return false;

            var tramo = await _context.TramosEnvio
                .Where(t => t.PaqueteId == paquete.Id && t.Estado == TramoEnvioStatus.EnTransito)
                .OrderBy(t => t.Orden)
                .FirstOrDefaultAsync();
            if (tramo is null || tramo.EsUltimaMilla || tramo.SucursalDestinoId != operador.SucursalId)
                return false;

            var repartidorAnterior = paquete.RepartidorAsignadoId;
            tramo.RecibirEnSucursal();
            var siguiente = await _context.TramosEnvio
                .Where(t => t.PaqueteId == paquete.Id && t.Orden == tramo.Orden + 1)
                .SingleAsync();
            siguiente.Habilitar();
            paquete.PrepararTramo(
                siguiente.SucursalOrigenId,
                siguiente.DistanciaKm,
                requiereFullTime: !siguiente.EsUltimaMilla || siguiente.HorasEstimadas > 6d);

            if (repartidorAnterior.HasValue
                && await _context.Usuarios.FindAsync(repartidorAnterior.Value) is Repartidor repartidor
                && repartidor.EstadoJornada == Repartidor.EstadoJornadaRepartidor.EnRuta
                && !await _context.Paquetes.AnyAsync(p =>
                    p.Id != paquete.Id
                    && p.RepartidorAsignadoId == repartidorAnterior
                    && (p.Status == PaqueteStatus.EnTransito || p.Status == PaqueteStatus.Demorado)))
            {
                repartidor.MarcarRetornando();
            }

            return true;
        }

        public async Task SincronizarAsignacionAsync(Paquete paquete)
        {
            if (!paquete.RepartidorAsignadoId.HasValue) return;
            var tramo = await TramoActualAsync(paquete.Id);
            if (tramo?.Estado == TramoEnvioStatus.PendienteDeCalendarizacion)
                tramo.Asignar(paquete.RepartidorAsignadoId.Value);
        }

        public async Task SincronizarInicioAsync(Paquete paquete)
        {
            var tramo = await TramoActualAsync(paquete.Id);
            tramo?.Iniciar();
        }

        public async Task SincronizarEntregaAsync(Paquete paquete)
        {
            var tramo = await TramoActualAsync(paquete.Id);
            if (tramo?.EsUltimaMilla == true)
                tramo.Entregar();
        }

        public async Task<bool> EsUltimaMillaActualAsync(Guid paqueteId)
        {
            var tramo = await TramoActualAsync(paqueteId);
            return tramo is null || tramo.EsUltimaMilla;
        }

        public async Task SincronizarCancelacionAsync(Paquete paquete)
        {
            var tramo = await TramoActualAsync(paquete.Id);
            tramo?.Cancelar();
        }

        public async Task SincronizarRecalendarizacionAsync(Paquete paquete)
        {
            var tramo = await TramoActualAsync(paquete.Id);
            tramo?.VolverAPendiente();
        }

        private async Task<TramoEnvio?> TramoActualAsync(Guid paqueteId)
            => await _context.TramosEnvio
                .Where(t => t.PaqueteId == paqueteId
                    && t.Estado != TramoEnvioStatus.RecibidoEnSucursal
                    && t.Estado != TramoEnvioStatus.Entregado
                    && t.Estado != TramoEnvioStatus.Cancelado)
                .OrderBy(t => t.Orden)
                .FirstOrDefaultAsync();

        private static List<Sucursal> BuscarCamino(
            Sucursal origen,
            Sucursal destino,
            List<Sucursal> sucursales,
            IReadOnlyDictionary<Guid, Ubicacion> ubicaciones)
        {
            if (origen.Id == destino.Id) return new List<Sucursal> { origen };
            var disponibles = sucursales.Where(s => ubicaciones.ContainsKey(s.Id)).ToList();
            var distancias = disponibles.ToDictionary(s => s.Id, _ => double.PositiveInfinity);
            var anterior = new Dictionary<Guid, Guid>();
            var pendientes = disponibles.Select(s => s.Id).ToHashSet();
            distancias[origen.Id] = 0;

            while (pendientes.Count > 0)
            {
                var actualId = pendientes.OrderBy(id => distancias[id]).First();
                pendientes.Remove(actualId);
                if (double.IsPositiveInfinity(distancias[actualId]) || actualId == destino.Id) break;

                foreach (var vecinoId in pendientes)
                {
                    var tramo = DistanciaKm(ubicaciones[actualId], ubicaciones[vecinoId]);
                    if (tramo > MaxKmPorTramo) continue;
                    var alternativa = distancias[actualId] + tramo;
                    if (alternativa >= distancias[vecinoId]) continue;
                    distancias[vecinoId] = alternativa;
                    anterior[vecinoId] = actualId;
                }
            }

            if (!anterior.ContainsKey(destino.Id))
                return new List<Sucursal> { origen, destino };

            var ids = new List<Guid> { destino.Id };
            while (ids[^1] != origen.Id)
                ids.Add(anterior[ids[^1]]);
            ids.Reverse();
            return ids.Select(id => disponibles.First(s => s.Id == id)).ToList();
        }

        private static double DistanciaKm(Ubicacion a, Ubicacion b)
        {
            const double radioTierra = 6371d;
            var dLat = GradosARadianes(b.Latitud - a.Latitud);
            var dLon = GradosARadianes(b.Longitud - a.Longitud);
            var lat1 = GradosARadianes(a.Latitud);
            var lat2 = GradosARadianes(b.Latitud);
            var h = Math.Pow(Math.Sin(dLat / 2), 2)
                + Math.Cos(lat1) * Math.Cos(lat2) * Math.Pow(Math.Sin(dLon / 2), 2);
            return radioTierra * 2 * Math.Atan2(Math.Sqrt(h), Math.Sqrt(1 - h)) * 1.2d;
        }

        private static double GradosARadianes(double grados) => grados * Math.PI / 180d;
    }
}
