using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Application.Common;

namespace Back.Application.Services
{
    public class RutaActivaItem
    {
        public required Guid RepartidorId { get; init; }
        public required string RepartidorNombre { get; init; }
        public required string RepartidorEmail { get; init; }
        public required DateTime Fecha { get; init; }
        public required string CpZona { get; init; } // CP más frecuente entre las paradas
        public required int TotalParadas { get; init; }
        public required int Entregadas { get; init; }
        public required int Canceladas { get; init; }
        public required double PesoTotal { get; init; }
        public required string Estado { get; init; } // EnTransito | ListoParaSalir | Completada | Demorada
        public required bool EsDemorada { get; init; }
    }

    public class DetalleRutaResponse
    {
        public required Guid RepartidorId { get; init; }
        public required string RepartidorNombre { get; init; }
        public required string RepartidorEmail { get; init; }
        public required DateTime Fecha { get; init; }
        public required List<DetalleRutaParada> Paradas { get; init; }
    }

    public class DetalleRutaParada
    {
        public required Guid PaqueteId { get; init; }
        public required string CodigoSeguimiento { get; init; }
        public required int Orden { get; init; }
        public required string Direccion { get; init; }
        public required string Localidad { get; init; }
        public required string CodigoPostal { get; init; }
        public required string Destinatario { get; init; }
        public required string? Telefono { get; init; }
        public required double Peso { get; init; }
        public required string TipoEnvio { get; init; }
        public required string Status { get; init; }
        public required bool EsPrioritario { get; init; }
        public required string? Observaciones { get; init; }
        public double? Latitud { get; init; }
        public double? Longitud { get; init; }
    }

    public class RutasActivasService
    {
        private readonly IEnviosRepository _enviosRepository;
        private readonly IUserRepository _userRepository;

        public RutasActivasService(IEnviosRepository enviosRepository, IUserRepository userRepository)
        {
            _enviosRepository = enviosRepository;
            _userRepository = userRepository;
        }

        public async Task<List<RutaActivaItem>> GetRutasDeHoyAsync()
        {
            // Mostramos rutas activas de hoy y futuras: la calendarización empieza
            // en mañana hábil (G1L-54) así que filtrar sólo "hoy" dejaba la pantalla
            // siempre vacía. Cada repartidor puede aparecer una vez por fecha.
            var hoy = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
            var asignados = await _enviosRepository.GetPaquetesConAsignacionActiva();
            var paquetesActivos = asignados
                .Where(p => p.FechaCalendarizada.HasValue && p.FechaCalendarizada.Value.Date >= hoy)
                .ToList();

            var repartidoresAll = await _userRepository.GetRepartidores();
            var repIndex = repartidoresAll.ToDictionary(r => r.Id);

            var ahora = DateTime.UtcNow;
            var pasoMediodia = ahora.Hour >= 12;

            var items = paquetesActivos
                .GroupBy(p => (p.RepartidorAsignadoId!.Value, p.FechaCalendarizada!.Value.Date))
                .Select(g =>
                {
                    var repId = g.Key.Item1;
                    var fecha = DateTime.SpecifyKind(g.Key.Item2, DateTimeKind.Utc);
                    repIndex.TryGetValue(repId, out var rep);
                    var totalParadas = g.Count();
                    var entregadas = g.Count(p => p.Status == PaqueteStatus.Entregado);
                    var canceladas = g.Count(p => p.Status == PaqueteStatus.Cancelado);
                    var enTransito = g.Any(p => p.Status == PaqueteStatus.EnTransito);
                    var pesoTotal = g.Sum(p => p.Peso);
                    var cpMasComun = g
                        .GroupBy(p => p.Destinatario.Direccion.CP)
                        .OrderByDescending(c => c.Count())
                        .First()
                        .Key;

                    var avancePct = totalParadas > 0 ? ((double)(entregadas + canceladas) / totalParadas) * 100 : 0;
                    var esHoy = fecha == hoy;
                    // El criterio de demora aplica sólo a rutas de hoy en tránsito
                    // pasado el mediodía con < 50% completado.
                    var demorada = esHoy && pasoMediodia && enTransito && avancePct < 50;
                    var completada = totalParadas > 0 && (entregadas + canceladas) == totalParadas;
                    var estado = completada
                        ? "Completada"
                        : demorada
                            ? "Demorada"
                            : enTransito
                                ? "EnTransito"
                                : esHoy
                                    ? "ListoParaSalir"
                                    : "Programada";

                    return new RutaActivaItem
                    {
                        RepartidorId = repId,
                        RepartidorNombre = rep is null ? "(desconocido)" : $"{rep.Nombre} {rep.Apellido}",
                        RepartidorEmail = rep?.Email ?? "",
                        Fecha = fecha,
                        CpZona = cpMasComun,
                        TotalParadas = totalParadas,
                        Entregadas = entregadas,
                        Canceladas = canceladas,
                        PesoTotal = pesoTotal,
                        Estado = estado,
                        EsDemorada = demorada,
                    };
                })
                .OrderBy(r => r.Fecha)
                .ThenBy(r => r.RepartidorNombre)
                .ToList();

            return items;
        }

        public async Task<ListadoRutasActivasResponse> GetRutasDeHoyPaginadasAsync(string? search, int page, int pageSize)
        {
            var allItems = await GetRutasDeHoyAsync();

            var totalParadas = allItems.Sum(r => r.TotalParadas);
            var totalEntregadas = allItems.Sum(r => r.Entregadas);
            var avancePct = totalParadas > 0 ? (int)Math.Round((double)totalEntregadas / totalParadas * 100) : 0;
            var kpis = new RutasActivasKpis
            {
                EnCurso = allItems.Count(r => r.Estado == "EnTransito"),
                Completadas = allItems.Count(r => r.Estado == "Completada"),
                Demoradas = allItems.Count(r => r.EsDemorada),
                TotalEntregadas = totalEntregadas,
                TotalParadas = totalParadas,
                AvancePct = avancePct,
                TotalRutas = allItems.Count,
            };

            var items = allItems;

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim().ToLowerInvariant();
                items = items.Where(r =>
                    r.RepartidorNombre.ToLowerInvariant().Contains(q)
                    || r.RepartidorEmail.ToLowerInvariant().Contains(q)
                    || r.CpZona.ToLowerInvariant().Contains(q))
                    .ToList();
            }

            var paged = PagedResponse<RutaActivaItem>.Create(
                items.Skip((page - 1) * pageSize).Take(pageSize).ToList(),
                page,
                pageSize,
                items.Count);

            return new ListadoRutasActivasResponse
            {
                Items = paged.Items,
                Page = paged.Page,
                PageSize = paged.PageSize,
                TotalItems = paged.TotalItems,
                TotalPages = paged.TotalPages,
                Kpis = kpis,
            };
        }

        public async Task<DetalleRutaResponse?> GetDetalleRutaAsync(Guid repartidorId, DateTime fecha)
        {
            var rep = await _userRepository.GetUsuarioById(repartidorId) as Repartidor;
            if (rep is null) return null;

            var paquetes = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(repartidorId, fecha);

            return new DetalleRutaResponse
            {
                RepartidorId = rep.Id,
                RepartidorNombre = $"{rep.Nombre} {rep.Apellido}",
                RepartidorEmail = rep.Email,
                Fecha = DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc),
                Paradas = paquetes.Select((p, idx) => new DetalleRutaParada
                {
                    PaqueteId = p.Id,
                    CodigoSeguimiento = p.CodigoSeguimiento,
                    Orden = idx + 1,
                    Direccion = p.Destinatario.Direccion.Calle,
                    Localidad = p.Destinatario.Direccion.Ciudad,
                    CodigoPostal = p.Destinatario.Direccion.CP,
                    Destinatario = $"{p.Destinatario.Nombre} {p.Destinatario.Apellido}",
                    Telefono = p.Destinatario.Telefono,
                    Peso = p.Peso,
                    TipoEnvio = p.TipoEnvio.ToString(),
                    Status = p.Status.ToString(),
                    EsPrioritario = p.TipoEnvio == TipoEnvio.Prioritario,
                    Observaciones = p.Descripcion,
                    Latitud = p.Destinatario.Direccion.Ubicacion?.Latitud,
                    Longitud = p.Destinatario.Direccion.Ubicacion?.Longitud,
                }).ToList(),
            };
        }
    }

    public class RutasActivasKpis
    {
        public int EnCurso { get; init; }
        public int Completadas { get; init; }
        public int Demoradas { get; init; }
        public int TotalEntregadas { get; init; }
        public int TotalParadas { get; init; }
        public int AvancePct { get; init; }
        public int TotalRutas { get; init; }
    }

    public class ListadoRutasActivasResponse : PagedResponse<RutaActivaItem>
    {
        public RutasActivasKpis Kpis { get; init; } = new();
    }
}
