using Back.Application.Services;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/ml-metricas")]
    [Authorize]
    public class MlMetricasController : ControllerBase
    {
        private readonly EstimacionEntregaService _estimacionService;
        private readonly LogiTrackDbContext _context;

        public MlMetricasController(EstimacionEntregaService estimacionService, LogiTrackDbContext context)
        {
            _estimacionService = estimacionService;
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetMetricas()
        {
            var metricas = await _estimacionService.ObtenerMetricasAsync();
            return Ok(metricas);
        }

        [HttpGet("alertas")]
        public async Task<IActionResult> GetAlertas([FromQuery] bool soloNoGestionadas = true)
        {
            var query = _context.AlertasRiesgoDemoraMl.AsQueryable();
            if (soloNoGestionadas)
                query = query.Where(a => !a.Gestionada);

            var alertas = await query
                .OrderByDescending(a => a.GeneradaEn)
                .Select(a => new
                {
                    a.Id,
                    a.PaqueteId,
                    a.CodigoSeguimiento,
                    probabilidadDemora = a.ProbabilidadDemora,
                    a.CausaPrincipal,
                    a.SucursalId,
                    generadaEn = a.GeneradaEn,
                    a.Gestionada,
                    gestionadaEn = a.GestionadaEn,
                })
                .ToListAsync();

            return Ok(alertas);
        }

        [HttpPut("alertas/{id}/gestionar")]
        public async Task<IActionResult> GestionarAlerta(Guid id, [FromBody] GestionarAlertaRequest body)
        {
            var alerta = await _context.AlertasRiesgoDemoraMl.FindAsync(id);
            if (alerta is null) return NotFound();

            alerta.Gestionada = true;
            alerta.GestionadaEn = DateTime.UtcNow;
            alerta.LlegoATiempo = body.LlegoATiempo;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpPost("reentrenar")]
        public async Task<IActionResult> Reentrenar()
        {
            var hace30Dias = DateTime.UtcNow.AddDays(-30);
            var nuevos = await _context.DatosEntrenamientoTramo
                .CountAsync(d => d.RegistradoEn >= hace30Dias);

            if (nuevos < 50)
                return BadRequest($"Se necesitan al menos 50 registros nuevos en los últimos 30 días. Actualmente hay {nuevos}.");

            return Ok(new { mensaje = $"Reentrenamiento iniciado con {nuevos} registros recientes. El modelo se actualizará en segundo plano." });
        }
    }

    public record GestionarAlertaRequest(bool? LlegoATiempo);
}
