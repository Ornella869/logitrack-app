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
            try
            {
                var version = await _estimacionService.EntrenarAsync();
                return Ok(new
                {
                    mensaje = $"Modelo reentrenado ({version.Algoritmo}) con {version.RegistrosUsados} registros. " +
                              $"MAE modelo {version.MaeModelo} h vs heurística {version.MaeHeuristico} h.",
                    version.Version,
                    version.RegistrosUsados,
                    version.MaeModelo,
                    version.MaeHeuristico,
                    version.EntrenadoEn,
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { mensaje = ex.Message });
            }
        }
    }

    public record GestionarAlertaRequest(bool? LlegoATiempo);
}
