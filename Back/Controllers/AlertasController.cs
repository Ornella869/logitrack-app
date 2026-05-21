using Back.Application.Common;
using Back.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/alertas")]
    public class AlertasController : ControllerBase
    {
        private readonly AlertasService _service;

        public AlertasController(AlertasService service)
        {
            _service = service;
        }

        /// <summary>G1L-84: paquetes sin estado final con fecha prevista vencida (Supervisor).</summary>
        [Authorize(Roles = Roles.Supervisor)]
        [HttpGet("paquetes-sin-estado-final")]
        public async Task<ActionResult<List<AlertaPaqueteSinEstadoFinal>>> SinEstadoFinal()
            => Ok(await _service.GetPaquetesSinEstadoFinalAsync());

        /// <summary>Contador de alertas activas (para el badge del panel).</summary>
        [Authorize(Roles = Roles.Supervisor)]
        [HttpGet("contador")]
        public async Task<ActionResult<object>> Contador()
            => Ok(new { total = await _service.ContarAsync() });
    }
}
