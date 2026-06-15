using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/alertas")]
    [RequirePermission("alertas")]
    public class AlertasController : ControllerBase
    {
        private readonly AlertasService _service;
        private readonly IUserRepository _userRepository;

        public AlertasController(AlertasService service, IUserRepository userRepository)
        {
            _service = service;
            _userRepository = userRepository;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return null;
            // Supervisor sin sucursal asignada → Guid.Empty no coincide con ninguna sucursal real.
            return (await _userRepository.GetUsuarioById(userId))?.SucursalId ?? Guid.Empty;
        }

        /// <summary>G1L-84: paquetes sin estado final con fecha prevista vencida (Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpGet("paquetes-sin-estado-final")]
        public async Task<ActionResult<List<AlertaPaqueteSinEstadoFinal>>> SinEstadoFinal()
            => Ok(await _service.GetPaquetesSinEstadoFinalAsync(await CurrentSucursalScopeAsync()));

        /// <summary>Contador de alertas activas (para el badge del panel).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpGet("contador")]
        public async Task<ActionResult<object>> Contador()
            => Ok(new { total = await _service.ContarAsync(await CurrentSucursalScopeAsync()) });
    }
}
