using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/reportes")]
    public class ReportesController : ControllerBase
    {
        private readonly ReportesService _service;
        private readonly IUserRepository _userRepository;

        public ReportesController(ReportesService service, IUserRepository userRepository)
        {
            _service = service;
            _userRepository = userRepository;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return null;
            return (await _userRepository.GetUsuarioById(userId))?.SucursalId;
        }

        /// <summary>G1L-26: Reporte de volumen por período (Supervisor).</summary>
        [Authorize(Roles = Roles.Supervisor)]
        [HttpGet("volumen")]
        public async Task<ActionResult<ReporteVolumen>> Volumen(
            [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            var reporte = await _service.GetReporteVolumenAsync(desde, hasta, await CurrentSucursalScopeAsync());
            return Ok(reporte);
        }
    }
}
