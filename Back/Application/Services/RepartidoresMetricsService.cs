using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class RepartidorAsignadoInfo
    {
        public required Guid Id { get; init; }
        public required string Nombre { get; init; }
        public required string Apellido { get; init; }
        public required string Email { get; init; }
        public required string Estado { get; init; }
    }

    public class RendimientoRepartidor
    {
        public required Guid RepartidorId { get; init; }
        public required string Nombre { get; init; }
        public required string Email { get; init; }
        public required DateTime From { get; init; }
        public required DateTime To { get; init; }
        public required int TotalEntregas { get; init; }
        public required int TotalCancelaciones { get; init; }
        public required int TotalAsignados { get; init; }
        public required double EfectividadOnTimePct { get; init; } // %
        public required double TasaIncidenciasPct { get; init; }   // %
        public required bool TieneActividad { get; init; }
    }

    public class RepartidoresMetricsService
    {
        private readonly LogiTrackDbContext _context;
        private readonly IUserRepository _userRepository;

        public RepartidoresMetricsService(LogiTrackDbContext context, IUserRepository userRepository)
        {
            _context = context;
            _userRepository = userRepository;
        }

        public async Task<RepartidorAsignadoInfo?> GetRepartidorDePaqueteAsync(Guid paqueteId)
        {
            var paquete = await _context.Paquetes.FindAsync(paqueteId);
            if (paquete is null || !paquete.RepartidorAsignadoId.HasValue) return null;
            var rep = await _userRepository.GetUsuarioById(paquete.RepartidorAsignadoId.Value) as Repartidor;
            if (rep is null) return null;
            return new RepartidorAsignadoInfo
            {
                Id = rep.Id,
                Nombre = rep.Nombre,
                Apellido = rep.Apellido,
                Email = rep.Email,
                Estado = rep.EstadoLabel,
            };
        }

        public async Task<RendimientoRepartidor> GetRendimientoAsync(Guid repartidorId, DateTime? from, DateTime? to)
        {
            var rep = await _userRepository.GetUsuarioById(repartidorId) as Repartidor
                ?? throw new InvalidOperationException("Repartidor no encontrado.");

            var fromUtc = DateTime.SpecifyKind((from ?? DateTime.UtcNow.AddDays(-30)).Date, DateTimeKind.Utc);
            var toUtc = DateTime.SpecifyKind((to ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            // Usamos el historial: cualquier paquete cuya FechaCalendarizada caiga en el rango,
            // y cuyo Repartidor sea este, cuenta como "asignado". Entregas y cancelaciones se cuentan por estado actual.
            var paquetes = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada >= fromUtc
                            && p.FechaCalendarizada <= toUtc)
                .ToListAsync();

            var totalAsignados = paquetes.Count;
            var totalEntregas = paquetes.Count(p => p.Status == PaqueteStatus.Entregado);
            var totalCancelaciones = paquetes.Count(p => p.Status == PaqueteStatus.Cancelado);

            // Efectividad on-time: cantidad de entregas cuyo historial muestra paso a Entregado
            // dentro del día programado. Aproximación simple: contamos las que están Entregadas
            // y comparamos su última fecha de cambio con la fecha programada.
            int onTime = 0;
            if (totalEntregas > 0)
            {
                var entregados = paquetes.Where(p => p.Status == PaqueteStatus.Entregado).Select(p => p.Id).ToList();
                var entregaEvents = await _context.HistorialEstadosEnvio
                    .Where(h => entregados.Contains(h.PaqueteId) && h.EstadoNuevo == PaqueteStatus.Entregado)
                    .ToListAsync();
                foreach (var p in paquetes.Where(p => p.Status == PaqueteStatus.Entregado))
                {
                    var ev = entregaEvents.Where(h => h.PaqueteId == p.Id).OrderBy(h => h.FechaHora).FirstOrDefault();
                    if (ev is null || !p.FechaCalendarizada.HasValue) continue;
                    if (ev.FechaHora.Date <= p.FechaCalendarizada.Value.Date) onTime++;
                }
            }

            var efectividad = totalEntregas == 0 ? 0 : (double)onTime / totalEntregas * 100;
            var incidencias = totalAsignados == 0 ? 0 : (double)totalCancelaciones / totalAsignados * 100;

            return new RendimientoRepartidor
            {
                RepartidorId = rep.Id,
                Nombre = $"{rep.Nombre} {rep.Apellido}",
                Email = rep.Email,
                From = fromUtc,
                To = toUtc,
                TotalEntregas = totalEntregas,
                TotalCancelaciones = totalCancelaciones,
                TotalAsignados = totalAsignados,
                EfectividadOnTimePct = Math.Round(efectividad, 1),
                TasaIncidenciasPct = Math.Round(incidencias, 1),
                TieneActividad = totalAsignados > 0,
            };
        }
    }
}
