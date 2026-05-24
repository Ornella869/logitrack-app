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
        public required int TotalEnviosADomicilio { get; init; }
        public required List<EnviosADomicilioPorProvincia> EnviosADomicilioPorProvincia { get; init; }
    }

    public class EnviosADomicilioPorProvincia
    {
        public required string ProvinciaDestino { get; init; }
        public required int Cantidad { get; init; }
    }

    public class ReportesService
    {
        private readonly LogiTrackDbContext _context;

        public ReportesService(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task<ReporteVolumen> GetReporteVolumenAsync(DateTime? from, DateTime? to, Guid? sucursalId = null, string? provinciaGerente = null)
        {
            var now = OperationalClock.Now;
            var fromUtc = DateTime.SpecifyKind((from ?? now.AddDays(-30)).Date, DateTimeKind.Utc);
            var toUtc = DateTime.SpecifyKind((to ?? now).Date.AddDays(1).AddTicks(-1), DateTimeKind.Utc);

            var sucursalesProvincia = string.IsNullOrWhiteSpace(provinciaGerente)
                ? null
                : await _context.Sucursales
                    .Where(s => s.Provincia == provinciaGerente)
                    .Select(s => s.Id)
                    .ToListAsync();

            // CA: se filtran todos los paquetes cuya fecha de creación cae en el rango.
            var paquetes = await _context.Paquetes
                .Where(p => p.CreadoEn >= fromUtc
                            && p.CreadoEn <= toUtc
                            && (sucursalId == null || p.SucursalId == sucursalId)
                            && (sucursalesProvincia == null || (p.SucursalId.HasValue && sucursalesProvincia.Contains(p.SucursalId.Value))))
                .Select(p => new
                {
                    p.Status,
                    p.EsEnvioADomicilio,
                    p.ProvinciaDestino,
                })
                .ToListAsync();

            var total = paquetes.Count;
            var entregados = paquetes.Count(p => p.Status == PaqueteStatus.Entregado);
            var cancelados = paquetes.Count(p => p.Status == PaqueteStatus.Cancelado);
            var enProceso = total - entregados - cancelados;
            var efectividad = total == 0 ? 0 : (double)entregados / total * 100;
            var enviosADomicilio = paquetes
                .Where(p => p.EsEnvioADomicilio && !string.IsNullOrWhiteSpace(p.ProvinciaDestino))
                .GroupBy(p => p.ProvinciaDestino!.Trim())
                .Select(g => new EnviosADomicilioPorProvincia
                {
                    ProvinciaDestino = g.Key,
                    Cantidad = g.Count(),
                })
                .OrderByDescending(x => x.Cantidad)
                .ThenBy(x => x.ProvinciaDestino)
                .ToList();

            return new ReporteVolumen
            {
                Desde = fromUtc,
                Hasta = toUtc,
                TotalEnvios = total,
                Entregados = entregados,
                Cancelados = cancelados,
                EnProceso = enProceso,
                EfectividadPct = Math.Round(efectividad, 1),
                TotalEnviosADomicilio = enviosADomicilio.Sum(x => x.Cantidad),
                EnviosADomicilioPorProvincia = enviosADomicilio,
            };
        }
    }
}
