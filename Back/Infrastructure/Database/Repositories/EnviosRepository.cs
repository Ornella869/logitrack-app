using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Application.Common;
using Microsoft.EntityFrameworkCore;

namespace Back.Infrastructure.Database.Repositories
{
    public class EnviosRepository : IEnviosRepository
    {

        private readonly LogiTrackDbContext _context;

        public EnviosRepository(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task Add(Paquete envio)
        {
            await _context.Paquetes.AddAsync(envio);
        }

        public async Task AddRange(IEnumerable<Paquete> paquetes)
        {
            await _context.Paquetes.AddRangeAsync(paquetes);
        }

        public async Task Add(Sucursal sucursal)
        {
            await _context.Sucursales.AddAsync(sucursal);
        }

        public async Task<List<Paquete>> GetAll()
        {
            return await _context.Paquetes.ToListAsync();
        }

        public async Task<Paquete?> GetPaquete(Guid id)
        {
            return await _context.Paquetes.FindAsync(id);
        }

        public async Task<Paquete?> GetPaqueteByCodigoSeguimiento(string codigoSeguimiento)
        {
            return await _context.Paquetes.FirstOrDefaultAsync(p => p.CodigoSeguimiento == codigoSeguimiento);
        }

        public async Task<PagedResponse<Paquete>> Buscar(string? search, List<PaqueteStatus>? estados, DateTime? from, DateTime? to, int page, int pageSize, Guid? sucursalId = null)
        {
            var query = _context.Paquetes.AsQueryable();

            if (sucursalId.HasValue)
            {
                query = query.Where(p => p.SucursalId == sucursalId.Value);
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(p =>
                    EF.Functions.ILike(p.CodigoSeguimiento, $"%{s}%")
                    || EF.Functions.ILike(p.Remitente.Nombre, $"%{s}%")
                    || EF.Functions.ILike(p.Remitente.Apellido, $"%{s}%")
                    || EF.Functions.ILike(p.Destinatario.Nombre, $"%{s}%")
                    || EF.Functions.ILike(p.Destinatario.Apellido, $"%{s}%"));
            }

            if (estados is { Count: > 0 })
            {
                query = query.Where(p => estados.Contains(p.Status));
            }

            if (from.HasValue)
            {
                var fromUtc = DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
                query = query.Where(p => p.CreadoEn >= fromUtc);
            }

            if (to.HasValue)
            {
                var toUtc = DateTime.SpecifyKind(to.Value, DateTimeKind.Utc);
                query = query.Where(p => p.CreadoEn <= toUtc);
            }

            var totalItems = await query.CountAsync();
            var items = await query
                .OrderByDescending(p => p.CreadoEn)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return PagedResponse<Paquete>.Create(items, page, pageSize, totalItems);
        }

        public async Task<List<Paquete>> GetPaquetesByIds(List<Guid> paqueteIds)
        {
            return await _context.Paquetes.Where(p => paqueteIds.Contains(p.Id)).ToListAsync();
        }

        public async Task<List<Paquete>> GetPaquetesPendientesDeCalendarizacion(Guid? sucursalId = null)
        {
            return await _context.Paquetes
                .Where(p => p.Status == PaqueteStatus.PendienteDeCalendarizacion
                            && (!sucursalId.HasValue || p.SucursalId == sucursalId.Value)
                            && _context.TramosEnvio.Any(t => t.PaqueteId == p.Id
                                && t.Estado == TramoEnvioStatus.PendienteDeCalendarizacion
                                && p.SucursalId.HasValue
                                && t.SucursalOrigenId == p.SucursalId.Value))
                .ToListAsync();
        }

        public async Task<List<Paquete>> GetPaquetesConAsignacionActiva()
        {
            var estadosActivos = new[]
            {
                PaqueteStatus.AsignadoAVehiculo,
                PaqueteStatus.CargadoEnVehiculo,
                PaqueteStatus.ListoParaSalir,
                PaqueteStatus.EnTransito,
                PaqueteStatus.EnTransitoDescanso,
                // G1L-82: un envío demorado sigue ocupando carga del repartidor ese día.
                PaqueteStatus.Demorado,
            };
            return await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId != null
                            && p.FechaCalendarizada != null
                            && estadosActivos.Contains(p.Status))
                .ToListAsync();
        }

        public async Task<DateTime?> GetProximaFechaConAsignacionDeRepartidor(Guid repartidorId, DateTime desde)
        {
            var desdeUtc = DateTime.SpecifyKind(desde.Date, DateTimeKind.Utc);
            var estadosActivos = new[]
            {
                PaqueteStatus.AsignadoAVehiculo,
                PaqueteStatus.CargadoEnVehiculo,
                PaqueteStatus.ListoParaSalir,
                PaqueteStatus.EnTransito,
                // G1L-82: un envío demorado sigue ocupando carga del repartidor ese día.
                PaqueteStatus.Demorado,
            };
            var fecha = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada != null
                            && p.FechaCalendarizada >= desdeUtc
                            && estadosActivos.Contains(p.Status))
                .OrderBy(p => p.FechaCalendarizada)
                .Select(p => p.FechaCalendarizada)
                .FirstOrDefaultAsync();
            return fecha;
        }

        public async Task<List<Paquete>> GetPaquetesAsignadosARepartidor(Guid repartidorId)
        {
            var estadosVisibles = new[]
            {
                PaqueteStatus.AsignadoAVehiculo,
                PaqueteStatus.CargadoEnVehiculo,
                PaqueteStatus.ListoParaSalir,
                PaqueteStatus.EnTransito,
                PaqueteStatus.Demorado,
                PaqueteStatus.Entregado,
                PaqueteStatus.Cancelado,
            };
            return await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada != null
                            && estadosVisibles.Contains(p.Status))
                .OrderBy(p => p.FechaCalendarizada)
                .ThenBy(p => p.Destinatario.Direccion.CP)
                .ToListAsync();
        }

        public async Task<List<Paquete>> GetPaquetesAsignadosARepartidorEnFecha(Guid repartidorId, DateTime fecha)
        {
            var estadosVisibles = new[]
            {
                PaqueteStatus.AsignadoAVehiculo,
                PaqueteStatus.CargadoEnVehiculo,
                PaqueteStatus.ListoParaSalir,
                PaqueteStatus.EnTransito,
                PaqueteStatus.EnTransitoDescanso,
                PaqueteStatus.Demorado,
                PaqueteStatus.Entregado,
                PaqueteStatus.Cancelado,
            };
            var dia = DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc);
            var diaSiguiente = dia.AddDays(1);
            var paquetes = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada != null
                            && ((p.FechaCalendarizada >= dia && p.FechaCalendarizada < diaSiguiente)
                                || (p.FechaCalendarizada < dia && (p.Status == PaqueteStatus.EnTransito || p.Status == PaqueteStatus.EnTransitoDescanso || p.Status == PaqueteStatus.Demorado)))
                            && estadosVisibles.Contains(p.Status))
                .OrderBy(p => p.Destinatario.Direccion.CP)
                .ThenBy(p => p.CreadoEn)
                .ToListAsync();

            if (fecha.Date == OperationalClock.TodayUtcDate)
            {
                var activosHoy = paquetes
                    .Where(p => p.FechaCalendarizada!.Value.Date == dia.Date
                                && p.Status != PaqueteStatus.Entregado
                                && p.Status != PaqueteStatus.Cancelado)
                    .Select(p => p.Id)
                    .ToList();

                if (activosHoy.Count > 0)
                {
                    var inicioTandaActual = await _context.HistorialEstadosEnvio
                        .Where(h => activosHoy.Contains(h.PaqueteId)
                                    && h.EstadoNuevo == PaqueteStatus.AsignadoAVehiculo)
                        .MinAsync(h => (DateTime?)h.FechaHora);

                    if (inicioTandaActual.HasValue)
                    {
                        var finalizadosHoy = paquetes
                            .Where(p => p.FechaCalendarizada!.Value.Date == dia.Date
                                        && (p.Status == PaqueteStatus.Entregado || p.Status == PaqueteStatus.Cancelado))
                            .Select(p => p.Id)
                            .ToList();

                        var finalizadosDeTandaActual = await _context.HistorialEstadosEnvio
                            .Where(h => finalizadosHoy.Contains(h.PaqueteId)
                                        && (h.EstadoNuevo == PaqueteStatus.Entregado || h.EstadoNuevo == PaqueteStatus.Cancelado)
                                        && h.FechaHora >= inicioTandaActual.Value)
                            .Select(h => h.PaqueteId)
                            .Distinct()
                            .ToListAsync();

                        paquetes = paquetes
                            .Where(p => p.FechaCalendarizada!.Value.Date != dia.Date
                                        || p.Status != PaqueteStatus.Entregado && p.Status != PaqueteStatus.Cancelado
                                        || finalizadosDeTandaActual.Contains(p.Id))
                            .ToList();
                    }
                }

                var paquetesHoyIds = paquetes
                    .Where(p => p.FechaCalendarizada!.Value.Date == dia.Date)
                    .Select(p => p.Id)
                    .ToList();

                var inicioUltimaRuta = await _context.HistorialEstadosEnvio
                    .Where(h => paquetesHoyIds.Contains(h.PaqueteId)
                                && h.EstadoNuevo == PaqueteStatus.EnTransito
                                && h.Motivo == "Inicializar Ruta")
                    .MaxAsync(h => (DateTime?)h.FechaHora);

                if (inicioUltimaRuta.HasValue)
                {
                    var finalizadosHoy = paquetes
                        .Where(p => p.FechaCalendarizada!.Value.Date == dia.Date
                                    && (p.Status == PaqueteStatus.Entregado || p.Status == PaqueteStatus.Cancelado))
                        .Select(p => p.Id)
                        .ToList();

                    var finalizadosDeUltimaRuta = await _context.HistorialEstadosEnvio
                        .Where(h => finalizadosHoy.Contains(h.PaqueteId)
                                    && (h.EstadoNuevo == PaqueteStatus.Entregado || h.EstadoNuevo == PaqueteStatus.Cancelado)
                                    && h.FechaHora >= inicioUltimaRuta.Value)
                        .Select(h => h.PaqueteId)
                        .Distinct()
                        .ToListAsync();

                    paquetes = paquetes
                        .Where(p => p.FechaCalendarizada!.Value.Date != dia.Date
                                    || p.Status != PaqueteStatus.Entregado && p.Status != PaqueteStatus.Cancelado
                                    || finalizadosDeUltimaRuta.Contains(p.Id))
                        .ToList();
                }
            }

            return paquetes;
        }

        public async Task<List<Sucursal>> GetSucursales(string? provincia = null, Guid? sucursalId = null)
        {
            var query = _context.Sucursales.AsQueryable();
            if (sucursalId.HasValue)
            {
                query = query.Where(s => s.Id == sucursalId.Value);
            }
            if (!string.IsNullOrWhiteSpace(provincia))
            {
                query = query.Where(s => s.Provincia == provincia);
            }
            return await query.ToListAsync();
        }

        public async Task<Sucursal?> GetSucursalById(Guid id)
        {
            return await _context.Sucursales.FindAsync(id);
        }

        public async Task<PuntoPickUp?> GetPuntoPickUpById(Guid id)
        {
            return await _context.PuntosPickUp.FindAsync(id);
        }

        public void DeleteSucursal(Sucursal sucursal)
        {
            _context.Sucursales.Remove(sucursal);
        }


    }
}
