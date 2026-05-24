using Back.Application.Common;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    // G1L-26: Reporte de volumen por período (sobre fecha de creación del envío).
    public class ReporteVolumen
    {
        public required DateTime Desde { get; init; }
        public required DateTime Hasta { get; init; }
        public required int TotalEnvios { get; init; }
        public required int Entregados { get; init; }
        public required int Cancelados { get; init; }
        public required int EnProceso { get; init; }
        public required double EfectividadPct { get; init; }
    }

    public class ReportesService
    {
        private readonly LogiTrackDbContext _context;

        public ReportesService(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task<ReporteVolumen> GetReporteVolumenAsync(DateTime? from, DateTime? to, Guid? sucursalId = null)
        {
            var now = OperationalClock.Now;
            var fromUtc = DateTime.SpecifyKind((from ?? now.AddDays(-30)).Date, DateTimeKind.Utc);
            var toUtc = DateTime.SpecifyKind((to ?? now).Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            // CA: se filtran todos los paquetes cuya fecha de creación cae en el rango.
            var paquetes = await _context.Paquetes
                .Where(p => p.CreadoEn >= fromUtc
                            && p.CreadoEn <= toUtc
                            && (sucursalId == null || p.SucursalId == sucursalId))
                .Select(p => p.Status)
                .ToListAsync();

            var total = paquetes.Count;
            var entregados = paquetes.Count(s => s == PaqueteStatus.Entregado);
            var cancelados = paquetes.Count(s => s == PaqueteStatus.Cancelado);
            var enProceso = total - entregados - cancelados;
            var efectividad = total == 0 ? 0 : (double)entregados / total * 100;

            return new ReporteVolumen
            {
                Desde = fromUtc,
                Hasta = toUtc,
                TotalEnvios = total,
                Entregados = entregados,
                Cancelados = cancelados,
                EnProceso = enProceso,
                EfectividadPct = Math.Round(efectividad, 1),
            };
        }
    }
}
