using Back.Application.Common;
using Back.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/repartidores")]
    public class RepartidoresMetricsController : ControllerBase
    {
        private readonly RepartidoresMetricsService _service;

        public RepartidoresMetricsController(RepartidoresMetricsService service)
        {
            _service = service;
        }

        /// <summary>G1L-20: Perfil de rendimiento de un repartidor en un período.</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpGet("{repartidorId:guid}/rendimiento")]
        public async Task<ActionResult<RendimientoRepartidor>> GetRendimiento(
            Guid repartidorId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            try
            {
                var r = await _service.GetRendimientoAsync(repartidorId, from, to);
                return Ok(r);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
        }
    }
}
