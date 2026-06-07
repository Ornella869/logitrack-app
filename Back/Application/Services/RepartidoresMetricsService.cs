using Back.Application.Common;
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
        public string? FotoPerfil { get; init; }
        public required DateTime From { get; init; }
        public required DateTime To { get; init; }
        public required int TotalEntregas { get; init; }
        public required int TotalCancelaciones { get; init; }
        public required int TotalAsignados { get; init; }
        public required double EfectividadOnTimePct { get; init; } // %
        public required double TasaIncidenciasPct { get; init; }   // %
        public required bool TieneActividad { get; init; }
        public required int HorasTrabajo { get; init; }
        public required string TipoJornada { get; init; }
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

        public async Task<RepartidorAsignadoInfo?> GetRepartidorDePaqueteAsync(Guid paqueteId, Guid? sucursalId = null)
        {
            var paquete = await _context.Paquetes.FindAsync(paqueteId);
            if (paquete is null || !paquete.RepartidorAsignadoId.HasValue) return null;
            if (sucursalId.HasValue && paquete.SucursalId != sucursalId) return null;
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

        public async Task<RendimientoRepartidor> GetRendimientoAsync(Guid repartidorId, DateTime? from, DateTime? to, Guid? sucursalId = null)
        {
            var rep = await _userRepository.GetUsuarioById(repartidorId) as Repartidor
                ?? throw new InvalidOperationException("Repartidor no encontrado.");
            if (sucursalId.HasValue && rep.SucursalId != sucursalId)
                throw new InvalidOperationException("Repartidor no encontrado.");

            var now = OperationalClock.Now;
            var fromDate = (from ?? now.AddDays(-30)).Date;
            var toDate = (to ?? now).Date;
            var fromUtc = OperationalClock.StartUtcForOperationalDate(fromDate);
            var toExclusiveUtc = OperationalClock.StartUtcForOperationalDate(toDate.AddDays(1));

            // Paquetes cuya FechaCalendarizada cae en el rango, más cualquier paquete
            // que haya sido entregado dentro del rango aunque haya sido calendarizado antes.
            var entregadosEnRangoIds = await _context.HistorialEstadosEnvio
                .Where(h => h.EstadoNuevo == PaqueteStatus.Entregado
                            && h.FechaHora >= fromUtc
                            && h.FechaHora < toExclusiveUtc)
                .Select(h => h.PaqueteId)
                .Distinct()
                .ToListAsync();

            var paquetes = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && (sucursalId == null || p.SucursalId == sucursalId)
                            && !_context.TramosEnvio.Any(t => t.PaqueteId == p.Id)
                            && ((p.FechaCalendarizada.HasValue
                                    && p.FechaCalendarizada >= fromUtc
                                    && p.FechaCalendarizada < toExclusiveUtc)
                                || entregadosEnRangoIds.Contains(p.Id)))
                .ToListAsync();

            var tramos = await _context.TramosEnvio
                .Where(t => t.RepartidorId == repartidorId
                    && (!sucursalId.HasValue || t.SucursalOrigenId == sucursalId.Value)
                    && ((t.IniciadoEn.HasValue
                            && t.IniciadoEn >= fromUtc
                            && t.IniciadoEn < toExclusiveUtc)
                        || (t.FinalizadoEn.HasValue
                            && t.FinalizadoEn >= fromUtc
                            && t.FinalizadoEn < toExclusiveUtc)))
                .ToListAsync();

            var tramosCompletados = tramos.Count(t =>
                t.Estado is TramoEnvioStatus.RecibidoEnSucursal or TramoEnvioStatus.Entregado);
            var totalAsignados = paquetes.Count + tramos.Count;
            var totalEntregas = paquetes.Count(p => p.Status == PaqueteStatus.Entregado) + tramosCompletados;
            var totalCancelaciones = paquetes.Count(p => p.Status == PaqueteStatus.Cancelado)
                + tramos.Count(t => t.Estado == TramoEnvioStatus.Cancelado);

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
                onTime += tramos.Count(t =>
                    (t.Estado is TramoEnvioStatus.RecibidoEnSucursal or TramoEnvioStatus.Entregado)
                    && t.IniciadoEn.HasValue
                    && t.FinalizadoEn.HasValue
                    && t.FinalizadoEn.Value <= t.IniciadoEn.Value.AddHours(t.HorasEstimadas));
            }

            var efectividad = totalEntregas == 0 ? 0 : (double)onTime / totalEntregas * 100;
            var incidencias = totalAsignados == 0 ? 0 : (double)totalCancelaciones / totalAsignados * 100;

            return new RendimientoRepartidor
            {
                RepartidorId = rep.Id,
                Nombre = $"{rep.Nombre} {rep.Apellido}",
                Email = rep.Email,
                From = DateTime.SpecifyKind(fromDate, DateTimeKind.Utc),
                To = DateTime.SpecifyKind(toDate, DateTimeKind.Utc),
                TotalEntregas = totalEntregas,
                TotalCancelaciones = totalCancelaciones,
                TotalAsignados = totalAsignados,
                EfectividadOnTimePct = Math.Round(efectividad, 1),
                TasaIncidenciasPct = Math.Round(incidencias, 1),
                TieneActividad = totalAsignados > 0,
                HorasTrabajo = rep.HorasTrabajo,
                TipoJornada = rep.TipoJornada,
                FotoPerfil = rep.FotoPerfil,
            };
        }
    }
}
