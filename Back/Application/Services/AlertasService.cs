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
        // "FechaVencida" = fecha de entrega prevista ya pasó
        // "MasDe24hEnTransito" = lleva más de 24 h en tránsito sin resolverse
        public required string MotivoAlerta { get; init; }
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
            var hace24h = DateTime.UtcNow.AddHours(-24);

            // Todos los paquetes activos no terminales del ámbito de la sucursal.
            var paquetes = await _context.Paquetes
                .Where(p => (p.Status == PaqueteStatus.EnTransito || p.Status == PaqueteStatus.Demorado)
                            && (sucursalId == null || p.SucursalId == sucursalId))
                .ToListAsync();

            if (paquetes.Count == 0) return new List<AlertaPaqueteSinEstadoFinal>();

            var ids = paquetes.Select(p => p.Id).ToList();

            // Última vez que cada paquete entró a EnTransito (para detectar > 24 h).
            var ultimaEntradaTransito = await _context.HistorialEstadosEnvio
                .Where(h => ids.Contains(h.PaqueteId) && h.EstadoNuevo == PaqueteStatus.EnTransito)
                .GroupBy(h => h.PaqueteId)
                .Select(g => new { PaqueteId = g.Key, Desde = g.Max(h => h.FechaHora) })
                .ToDictionaryAsync(x => x.PaqueteId, x => x.Desde);

            // Nombres de los repartidores asignados (una sola consulta).
            var repIds = paquetes.Where(p => p.RepartidorAsignadoId.HasValue)
                .Select(p => p.RepartidorAsignadoId!.Value).Distinct().ToList();
            var repsNombre = await _context.Usuarios
                .Where(u => repIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Nombre + " " + u.Apellido);

            var alertas = new List<AlertaPaqueteSinEstadoFinal>();
            foreach (var p in paquetes)
            {
                bool fechaVencida = p.FechaCalendarizada != null && p.FechaCalendarizada.Value.Date < hoy;
                bool masDe24h = ultimaEntradaTransito.TryGetValue(p.Id, out var desdeTransito)
                                && desdeTransito < hace24h;

                if (!fechaVencida && !masDe24h) continue;

                var nombre = p.RepartidorAsignadoId.HasValue && repsNombre.TryGetValue(p.RepartidorAsignadoId.Value, out var n)
                    ? n : "(sin repartidor)";

                DateTime fechaRef;
                int dias;
                string motivo;

                if (fechaVencida)
                {
                    fechaRef = p.FechaCalendarizada!.Value;
                    dias = (hoy - fechaRef.Date).Days;
                    motivo = "FechaVencida";
                }
                else
                {
                    fechaRef = desdeTransito;
                    dias = Math.Max(1, (int)(DateTime.UtcNow - desdeTransito).TotalDays);
                    motivo = "MasDe24hEnTransito";
                }

                alertas.Add(new AlertaPaqueteSinEstadoFinal
                {
                    PaqueteId = p.Id,
                    TrackingId = p.CodigoSeguimiento,
                    RepartidorId = p.RepartidorAsignadoId,
                    RepartidorNombre = nombre,
                    FechaPrevista = fechaRef,
                    DiasDemora = dias,
                    EstadoActual = p.Status == PaqueteStatus.Demorado ? "Demorado" : "En Tránsito",
                    MotivoAlerta = motivo,
                });
            }

            return alertas.OrderByDescending(a => a.DiasDemora).ToList();
        }

        public async Task<int> ContarAsync(Guid? sucursalId = null)
            => (await GetPaquetesSinEstadoFinalAsync(sucursalId)).Count;
    }
}
