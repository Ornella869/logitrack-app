using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/repartidores")]
    public class RepartidoresMetricsController : ControllerBase
    {
        private readonly RepartidoresMetricsService _service;
        private readonly IUserRepository _userRepository;

        public RepartidoresMetricsController(RepartidoresMetricsService service, IUserRepository userRepository)
        {
            _service = service;
            _userRepository = userRepository;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            if (User.IsInRole(Roles.Administrador)) return null;
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return null;
            return (await _userRepository.GetUsuarioById(userId))?.SucursalId;
        }

        /// <summary>G1L-20: Perfil de rendimiento de un repartidor en un período.</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
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
    }
}
