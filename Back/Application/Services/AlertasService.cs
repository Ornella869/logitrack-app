using Back.Application.Common;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    // G1L-84: alerta de paquetes que siguen activos (En Tránsito o Demorado) con su
    // fecha de entrega prevista ya vencida. Se calculan en vivo: cuando el envío pasa
    // a un estado final (Entregado/Cancelado), deja de aparecer = "alerta cerrada".
    public class AlertaPaqueteSinEstadoFinal
    {
        public required Guid PaqueteId { get; init; }
        public required string TrackingId { get; init; }
        public Guid? RepartidorId { get; init; }
        public required string RepartidorNombre { get; init; }
        public required DateTime FechaPrevista { get; init; }
        public required int DiasDemora { get; init; }
        public required string EstadoActual { get; init; }
    }

    public class AlertasService
    {
        private readonly LogiTrackDbContext _context;

        public AlertasService(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task<List<AlertaPaqueteSinEstadoFinal>> GetPaquetesSinEstadoFinalAsync(Guid? sucursalId = null)
        {
            var hoy = OperationalClock.TodayUtcDate;

            // Activos no terminales con fecha prevista vencida. Incluye Demorado:
            // no es estado final, así que igual debe alertar (G1L-84 sin falsos negativos).
            var paquetes = await _context.Paquetes
                .Where(p => (p.Status == PaqueteStatus.EnTransito || p.Status == PaqueteStatus.Demorado)
                            && p.FechaCalendarizada != null
                            && p.FechaCalendarizada < hoy
                            && (sucursalId == null || p.SucursalId == sucursalId))
                .ToListAsync();

            if (paquetes.Count == 0) return new List<AlertaPaqueteSinEstadoFinal>();

            // Nombres de los repartidores asignados (una sola consulta).
            var repIds = paquetes.Where(p => p.RepartidorAsignadoId.HasValue)
                .Select(p => p.RepartidorAsignadoId!.Value).Distinct().ToList();
            var repsNombre = await _context.Usuarios
                .Where(u => repIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Nombre + " " + u.Apellido);

            return paquetes
                .Select(p =>
                {
                    var fechaPrevista = p.FechaCalendarizada!.Value;
                    var dias = (hoy - fechaPrevista.Date).Days;
                    var nombre = p.RepartidorAsignadoId.HasValue && repsNombre.TryGetValue(p.RepartidorAsignadoId.Value, out var n)
                        ? n : "(sin repartidor)";
                    return new AlertaPaqueteSinEstadoFinal
                    {
                        PaqueteId = p.Id,
                        TrackingId = p.CodigoSeguimiento,
                        RepartidorId = p.RepartidorAsignadoId,
                        RepartidorNombre = nombre,
                        FechaPrevista = fechaPrevista,
                        DiasDemora = dias,
                        EstadoActual = p.Status == PaqueteStatus.Demorado ? "Demorado" : "En Tránsito",
                    };
                })
                .OrderByDescending(a => a.DiasDemora)
                .ToList();
        }

        public async Task<int> ContarAsync(Guid? sucursalId = null)
            => (await GetPaquetesSinEstadoFinalAsync(sucursalId)).Count;
    }
}
