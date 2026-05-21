using Back.Application.Common;
using Back.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/reportes")]
    public class ReportesController : ControllerBase
    {
        private readonly ReportesService _service;

        public ReportesController(ReportesService service)
        {
            _service = service;
        }

        /// <summary>G1L-26: Reporte de volumen por período (Supervisor).</summary>
        [Authorize(Roles = Roles.Supervisor)]
        [HttpGet("volumen")]
        public async Task<ActionResult<ReporteVolumen>> Volumen(
            [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            var reporte = await _service.GetReporteVolumenAsync(desde, hasta);
            return Ok(reporte);
        }
    }
}
