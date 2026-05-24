using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
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

        private async Task<(Guid? SucursalId, string? Provincia)> CurrentScopeAsync()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return (null, null);
            var usuario = await _userRepository.GetUsuarioById(userId);
            return usuario switch
            {
                Gerente gerente => (null, gerente.Provincia),
                Administrador => (null, null),
                _ => (usuario?.SucursalId, null),
            };
        }

        /// <summary>G1L-26: Reporte de volumen por período (Supervisor).</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Gerente + "," + Roles.Administrador)]
        [HttpGet("volumen")]
        public async Task<ActionResult<ReporteVolumen>> Volumen(
            [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            var scope = await CurrentScopeAsync();
            var reporte = await _service.GetReporteVolumenAsync(desde, hasta, scope.SucursalId, scope.Provincia);
            return Ok(reporte);
        }
    }
}
