using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/repartidores")]
    [RequirePermission("perfil_rendimiento")]
    public class RepartidoresMetricsController : ControllerBase
    {
        private readonly RepartidoresMetricsService _service;
        private readonly IUserRepository _userRepository;
        private readonly LogiTrackDbContext _context;

        public RepartidoresMetricsController(RepartidoresMetricsService service, IUserRepository userRepository, LogiTrackDbContext context)
        {
            _service = service;
            _userRepository = userRepository;
            _context = context;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            if (User.IsInRole(Roles.Administrador)) return null;
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return Guid.Empty;
            return (await _userRepository.GetUsuarioById(userId))?.SucursalId ?? Guid.Empty;
        }

        /// <summary>G1L-20: Perfil de rendimiento de un repartidor en un período.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet("{repartidorId:guid}/rendimiento")]
        public async Task<ActionResult<RendimientoRepartidor>> GetRendimiento(
            Guid repartidorId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            try
            {
                var r = await _service.GetRendimientoAsync(repartidorId, from, to, await CurrentSucursalScopeAsync());
                return Ok(r);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
        }

        /// <summary>Proyección de personal para los próximos 30 días basada en histórico de 4 semanas.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador)]
        [HttpGet("proyeccion-personal")]
        public async Task<IActionResult> GetProyeccionPersonal([FromQuery] double? volumenManual = null)
        {
            var sucursalId = await CurrentSucursalScopeAsync();
            var now = DateTime.UtcNow;
            var hace4Semanas = now.AddDays(-28);

            // Paquetes calendarizados en las últimas 4 semanas
            IQueryable<Paquete> paquetesQuery = _context.Paquetes
                .Where(p => p.FechaCalendarizada >= hace4Semanas && p.FechaCalendarizada <= now);

            if (sucursalId.HasValue && sucursalId.Value != Guid.Empty)
            {
                var repIds = await _context.Usuarios.OfType<Repartidor>()
                    .Where(r => r.SucursalId == sucursalId.Value)
                    .Select(r => r.Id)
                    .ToListAsync();
                paquetesQuery = paquetesQuery.Where(p => p.RepartidorAsignadoId.HasValue && repIds.Contains(p.RepartidorAsignadoId.Value));
            }

            var paquetes = await paquetesQuery.Select(p => new { p.FechaCalendarizada }).ToListAsync();

            // Agrupar por semana (semana 1 = más antigua, semana 4 = más reciente)
            var semanasData = Enumerable.Range(1, 4).Select(s =>
            {
                var desde = now.AddDays(-s * 7);
                var hasta = now.AddDays(-(s - 1) * 7);
                var count = paquetes.Count(p => p.FechaCalendarizada >= desde && p.FechaCalendarizada < hasta);
                return new { semana = 5 - s, envios = count };
            }).OrderBy(s => s.semana).ToList();

            var totalUltimas4 = semanasData.Sum(s => s.envios);
            var promedioPorSemana = totalUltimas4 / 4.0;

            // Tendencia lineal (delta por semana entre semana 1 y 4)
            var crecimientoSemanal = semanasData.Count >= 2
                ? (semanasData[^1].envios - semanasData[0].envios) / 3.0
                : 0;

            // Proyección 30 días (~4.3 semanas) con tendencia
            var enviosProyectados = volumenManual ?? Math.Max(0, promedioPorSemana * 4.3 + crecimientoSemanal * 2.15);

            // Horas necesarias: ~30 min por entrega promedio
            var horasNecesarias = enviosProyectados * 0.5;

            // Repartidores activos y capacidad
            IQueryable<Repartidor> repsQuery = _context.Usuarios.OfType<Repartidor>()
                .Where(r => r.Estado == Repartidor.EstadoRepartidor.Activo);
            if (sucursalId.HasValue && sucursalId.Value != Guid.Empty)
                repsQuery = repsQuery.Where(r => r.SucursalId == sucursalId.Value);

            var repartidores = await repsQuery.ToListAsync();
            var countReps = repartidores.Count;
            // HorasDisponibles: cada repartidor trabaja HorasTrabajo horas/día × 22 días hábiles
            var horasDisponibles = repartidores.Sum(r => (double)r.HorasTrabajo) * 22;

            var brechaHoras = horasNecesarias - horasDisponibles;
            // Repartidores equivalentes = horas_faltantes / (8h × 22 días hábiles)
            var repartidoresEquivalentes = brechaHoras > 0 ? brechaHoras / (8.0 * 22) : 0;
            var fullTime = (int)Math.Ceiling(repartidoresEquivalentes * 0.6);
            var partTime = (int)Math.Ceiling(repartidoresEquivalentes * 0.4);

            var capacidadPct = horasNecesarias > 0
                ? Math.Min(100, horasDisponibles / horasNecesarias * 100)
                : 100;

            return Ok(new
            {
                enviosUltimas4Semanas = totalUltimas4,
                promedioPorSemana = (int)Math.Round(promedioPorSemana),
                crecimientoSemanal = (int)Math.Round(crecimientoSemanal),
                enviosProyectados30Dias = Math.Round(enviosProyectados),
                horasNecesarias = Math.Round(horasNecesarias, 1),
                horasDisponibles = Math.Round(horasDisponibles, 1),
                brechaHoras = Math.Round(brechaHoras, 1),
                repartidoresActivos = countReps,
                repartidoresEquivalentes = Math.Round(repartidoresEquivalentes, 1),
                repartidoresFullTimeNecesarios = fullTime,
                repartidoresPartTimeNecesarios = partTime,
                capacidadActualPct = Math.Round(capacidadPct, 1),
                porSemana = semanasData,
            });
        }

        /// <summary>Reporte semanal de demanda de horas de ruta vs capacidad disponible (Gerente/Admin).</summary>
        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpGet("reporte-demanda-capacidad")]
        public async Task<IActionResult> GetReporteDemandaCapacidad(
            [FromQuery] DateTime? desde = null,
            [FromQuery] DateTime? hasta = null)
        {
            var end = (hasta ?? DateTime.UtcNow).Date.AddDays(1).AddTicks(-1);
            var start = (desde ?? DateTime.UtcNow.AddDays(-7 * 8)).Date;

            var repartidores = await _context.Usuarios.OfType<Repartidor>()
                .Where(r => r.Estado == Repartidor.EstadoRepartidor.Activo)
                .ToListAsync();

            const int DIAS_HABILES = 5;
            var horasDisp = repartidores.Sum(r => (double)r.HorasTrabajo) * DIAS_HABILES;
            var horasFtDisp = repartidores.Where(r => !r.EsPartTime).Sum(r => (double)r.HorasTrabajo) * DIAS_HABILES;
            var horasPtDisp = repartidores.Where(r => r.EsPartTime).Sum(r => (double)r.HorasTrabajo) * DIAS_HABILES;

            var paquetes = await _context.Paquetes
                .Where(p => p.FechaCalendarizada >= start && p.FechaCalendarizada <= end)
                .Select(p => new { p.FechaCalendarizada, p.TipoEnvio })
                .ToListAsync();

            // Alinear al lunes
            var weekStart = start;
            while (weekStart.DayOfWeek != DayOfWeek.Monday) weekStart = weekStart.AddDays(-1);

            var semanas = new List<SemanaCapacidadDto>();
            int num = 1;
            while (weekStart <= end)
            {
                var weekEnd = weekStart.AddDays(7);
                var envios = paquetes.Where(p => p.FechaCalendarizada >= weekStart && p.FechaCalendarizada < weekEnd).ToList();
                var total = envios.Count;
                var prioritarios = envios.Count(e => e.TipoEnvio == TipoEnvio.Prioritario);
                var comunes = total - prioritarios;
                var horasReq = total * 0.5;
                var brecha = Math.Round(horasReq - horasDisp, 1);

                semanas.Add(new SemanaCapacidadDto
                {
                    Semana = num++,
                    FechaDesde = weekStart,
                    FechaHasta = weekEnd.AddDays(-1),
                    TotalEnvios = total,
                    HorasRutaRequeridas = Math.Round(horasReq, 1),
                    HorasDisponibles = Math.Round(horasDisp, 1),
                    BrechaHoras = brecha,
                    EsDeficit = brecha > 0,
                    HorasFaltantesFullTime = Math.Round(Math.Max(0, prioritarios * 0.5 - horasFtDisp), 1),
                    HorasFaltantesPartTime = Math.Round(Math.Max(0, comunes * 0.5 - horasPtDisp), 1),
                    RepartidoresEquivalentes = brecha > 0 ? Math.Round(brecha / (8.0 * DIAS_HABILES), 2) : 0,
                    EsDeficitConsecutivo = false,
                });
                weekStart = weekEnd;
            }

            // Marcar déficit consecutivo
            for (int i = 1; i < semanas.Count; i++)
            {
                if (semanas[i].EsDeficit && semanas[i - 1].EsDeficit)
                {
                    semanas[i].EsDeficitConsecutivo = true;
                    semanas[i - 1].EsDeficitConsecutivo = true;
                }
            }

            return Ok(semanas);
        }

        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet("{repartidorId:guid}/jornada-historial")]
        public async Task<ActionResult<List<JornadaLaboralHistorialResponse>>> GetHistorialJornada(Guid repartidorId)
        {
            var repartidor = await _userRepository.GetUsuarioById(repartidorId) as Repartidor;
            if (repartidor is null) return NotFound("Repartidor no encontrado.");

            var sucursalScope = await CurrentSucursalScopeAsync();
            if (sucursalScope.HasValue && repartidor.SucursalId != sucursalScope.Value) return Forbid();

            var logs = await _context.LogsAuditoria
                .Where(l => l.Accion == TipoAccion.JornadaLaboral && l.RecursoId == repartidorId.ToString())
                .OrderByDescending(l => l.Timestamp)
                .ToListAsync();

            return Ok(logs.Select(MapHistorialJornada).ToList());
        }

        private static JornadaLaboralHistorialResponse MapHistorialJornada(LogAuditoria log)
        {
            int? valorAnterior = null;
            int? valorNuevo = null;
            var motivo = log.Descripcion;

            if (!string.IsNullOrWhiteSpace(log.Contexto))
            {
                try
                {
                    using var doc = JsonDocument.Parse(log.Contexto);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("ValorAnterior", out var anterior) && anterior.ValueKind == JsonValueKind.Number)
                        valorAnterior = anterior.GetInt32();
                    if (root.TryGetProperty("ValorNuevo", out var nuevo) && nuevo.ValueKind == JsonValueKind.Number)
                        valorNuevo = nuevo.GetInt32();
                    if (root.TryGetProperty("Motivo", out var motivoJson) && motivoJson.ValueKind == JsonValueKind.String)
                        motivo = motivoJson.GetString() ?? motivo;
                }
                catch (JsonException)
                {
                    // Si el contexto histórico no es JSON, se conserva la descripción original.
                }
            }

            return new JornadaLaboralHistorialResponse
            {
                Id = log.Id,
                Timestamp = log.Timestamp,
                UsuarioNombre = log.UsuarioNombre,
                UsuarioRol = log.UsuarioRol,
                ValorAnterior = valorAnterior,
                ValorNuevo = valorNuevo,
                Motivo = motivo,
            };
        }
    }

    public class JornadaLaboralHistorialResponse
    {
        public Guid Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string UsuarioNombre { get; set; } = string.Empty;
        public string UsuarioRol { get; set; } = string.Empty;
        public int? ValorAnterior { get; set; }
        public int? ValorNuevo { get; set; }
        public string Motivo { get; set; } = string.Empty;
    }

    public class SemanaCapacidadDto
    {
        public int Semana { get; set; }
        public DateTime FechaDesde { get; set; }
        public DateTime FechaHasta { get; set; }
        public int TotalEnvios { get; set; }
        public double HorasRutaRequeridas { get; set; }
        public double HorasDisponibles { get; set; }
        public double BrechaHoras { get; set; }
        public bool EsDeficit { get; set; }
        public bool EsDeficitConsecutivo { get; set; }
        public double HorasFaltantesFullTime { get; set; }
        public double HorasFaltantesPartTime { get; set; }
        public double RepartidoresEquivalentes { get; set; }
    }
}
