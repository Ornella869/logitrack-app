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

    public class ComparativoSucursalDto
    {
        public Guid SucursalId { get; init; }
        public string Nombre { get; init; } = "";
        public string Provincia { get; init; } = "";
        public int Total { get; init; }
        public int Entregados { get; init; }
        public int Cancelados { get; init; }
        public int Demorados { get; init; }
        public double PesoTotal { get; init; }
        public double EfectividadPct { get; init; }
        public double TasaIncidenciasPct { get; init; }
        public double PromedioDiasDemora { get; init; }
    }

    public class ReportesService
    {
        private readonly LogiTrackDbContext _context;

        public ReportesService(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task<List<ComparativoSucursalDto>> GetComparativoSucursalesAsync(
            DateTime? from, DateTime? to, List<string>? provinciasGerente, Guid? sucursalId = null)
        {
            // Supervisor/Operador con permiso 'reportes' concedido: acotar a la provincia de su sucursal.
            if ((provinciasGerente == null || provinciasGerente.Count == 0) && sucursalId.HasValue)
            {
                var sucUser = await _context.Sucursales.FindAsync(sucursalId.Value);
                if (!string.IsNullOrWhiteSpace(sucUser?.Provincia))
                    provinciasGerente = new List<string> { sucUser!.Provincia };
            }
            var now = OperationalClock.Now;
            var fromUtc = DateTime.SpecifyKind((from ?? now.AddDays(-30)).Date, DateTimeKind.Utc);
            var toExclusiveUtc = DateTime.SpecifyKind((to ?? now).Date.AddDays(1), DateTimeKind.Utc);

            var sucursales = await _context.Sucursales.ToListAsync();
            if (provinciasGerente != null && provinciasGerente.Count > 0)
            {
                var normalized = provinciasGerente.Select(p => p.Trim()).ToList();
                sucursales = sucursales
                    .Where(s => normalized.Any(n => string.Equals(n, s.Provincia, StringComparison.OrdinalIgnoreCase))
                                || (s.ProvinciasCubiertas ?? new List<string>()).Any(pc => normalized.Any(n => string.Equals(n, pc, StringComparison.OrdinalIgnoreCase))))
                    .ToList();
            }

            var sucursalIds = sucursales.Select(s => s.Id).ToList();

            var paquetes = await _context.Paquetes
                .Where(p => p.CreadoEn >= fromUtc
                            && p.CreadoEn < toExclusiveUtc
                            && p.SucursalId.HasValue
                            && sucursalIds.Contains(p.SucursalId.Value))
                .Select(p => new { p.Id, p.SucursalId, p.Status, p.Peso, p.FechaEstimadaEntrega })
                .ToListAsync();

            var incidenciasSucursal = await _context.Incidencias
                .Where(i => i.FechaReporte >= fromUtc && i.FechaReporte < toExclusiveUtc && i.SucursalId.HasValue && sucursalIds.Contains(i.SucursalId.Value))
                .GroupBy(i => i.SucursalId!.Value)
                .Select(g => new { SucursalId = g.Key, Count = g.Count() })
                .ToListAsync();
            var incidenciasBySucursal = incidenciasSucursal.ToDictionary(x => x.SucursalId, x => x.Count);

            // G1L-148: fecha real de entrega (último evento Entregado) para el promedio de días de demora.
            var paqueteIds = paquetes.Select(p => p.Id).ToList();
            var entregas = await _context.HistorialEstadosEnvio
                .Where(h => h.EstadoNuevo == PaqueteStatus.Entregado && paqueteIds.Contains(h.PaqueteId))
                .GroupBy(h => h.PaqueteId)
                .Select(g => new { PaqueteId = g.Key, FechaEntrega = g.Max(x => x.FechaHora) })
                .ToListAsync();
            var entregaByPaquete = entregas.ToDictionary(x => x.PaqueteId, x => x.FechaEntrega);

            return sucursales
                .OrderBy(s => s.Nombre)
                .Select(s =>
                {
                    var grupo = paquetes.Where(p => p.SucursalId == s.Id).ToList();
                    var total = grupo.Count;
                    var entregados = grupo.Count(p => p.Status == PaqueteStatus.Entregado);
                    var cancelados = grupo.Count(p => p.Status == PaqueteStatus.Cancelado);
                    var demorados = grupo.Count(p => p.Status == PaqueteStatus.Demorado);
                    var pesoTotal = grupo.Sum(p => p.Peso);
                    var efectividad = total == 0 ? 0.0 : Math.Round((double)entregados / total * 100, 1);
                    incidenciasBySucursal.TryGetValue(s.Id, out var incidencias);
                    var tasaIncidencias = total == 0 ? 0.0 : Math.Round((double)incidencias / total * 100, 1);
                    var demoras = grupo
                        .Where(p => p.FechaEstimadaEntrega.HasValue && entregaByPaquete.ContainsKey(p.Id))
                        .Select(p => Math.Max(0, (entregaByPaquete[p.Id].Date - p.FechaEstimadaEntrega!.Value.Date).Days))
                        .ToList();
                    var promedioDiasDemora = demoras.Count == 0 ? 0.0 : Math.Round(demoras.Average(), 1);
                    return new ComparativoSucursalDto
                    {
                        SucursalId = s.Id,
                        Nombre = s.Nombre,
                        Provincia = s.Provincia ?? "",
                        Total = total,
                        Entregados = entregados,
                        Cancelados = cancelados,
                        Demorados = demorados,
                        PesoTotal = Math.Round(pesoTotal, 1),
                        EfectividadPct = efectividad,
                        TasaIncidenciasPct = tasaIncidencias,
                        PromedioDiasDemora = promedioDiasDemora,
                    };
                })
                .ToList();
        }

        public async Task<ReporteVolumen> GetReporteVolumenAsync(DateTime? from, DateTime? to, Guid? sucursalId = null, List<string>? provinciasGerente = null)
        {
            var now = OperationalClock.Now;
            var fromUtc = DateTime.SpecifyKind((from ?? now.AddDays(-30)).Date, DateTimeKind.Utc);
            var toExclusiveUtc = DateTime.SpecifyKind((to ?? now).Date.AddDays(1), DateTimeKind.Utc);

            List<Guid>? sucursalesProvincia = null;
            if (provinciasGerente != null && provinciasGerente.Any())
            {
                var normalized = provinciasGerente.Select(p => p.Trim()).ToList();
                var sucursales = await _context.Sucursales.ToListAsync();
                sucursalesProvincia = sucursales
                    .Where(s => normalized.Any(n => string.Equals(n, s.Provincia, StringComparison.OrdinalIgnoreCase))
                                || s.ProvinciasCubiertas.Any(pc => normalized.Any(n => string.Equals(n, pc, StringComparison.OrdinalIgnoreCase))))
                    .Select(s => s.Id)
                    .ToList();
            }

            // CA: se filtran todos los paquetes cuya fecha de creación cae en el rango.
            var paquetes = await _context.Paquetes
                .Where(p => p.CreadoEn >= fromUtc
                            && p.CreadoEn < toExclusiveUtc
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
                Hasta = toExclusiveUtc.AddTicks(-1),
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
