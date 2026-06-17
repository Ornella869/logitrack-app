using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/alertas")]
    [RequirePermission("alertas")]
    public class AlertasController : ControllerBase
    {
        private readonly AlertasService _service;
        private readonly IUserRepository _userRepository;
        private readonly LogiTrackDbContext _context;

        public AlertasController(AlertasService service, IUserRepository userRepository, LogiTrackDbContext context)
        {
            _service = service;
            _userRepository = userRepository;
            _context = context;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return null;
            // Supervisor sin sucursal asignada → Guid.Empty no coincide con ninguna sucursal real.
            var usuario = await _userRepository.GetUsuarioById(userId);
            if (usuario is Gerente gerente)
            {
                if (!gerente.SucursalActivaId.HasValue) return Guid.Empty;
                var habilitada = await _context.GerentesSucursales
                    .AnyAsync(x => x.GerenteId == gerente.Id && x.SucursalId == gerente.SucursalActivaId.Value);
                return habilitada ? gerente.SucursalActivaId.Value : Guid.Empty;
            }
            return usuario?.SucursalId ?? Guid.Empty;
        }

        /// <summary>G1L-84: paquetes sin estado final con fecha prevista vencida (Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpGet("paquetes-sin-estado-final")]
        public async Task<ActionResult<List<AlertaPaqueteSinEstadoFinal>>> SinEstadoFinal()
            => Ok(await _service.GetPaquetesSinEstadoFinalAsync(await CurrentSucursalScopeAsync()));

        /// <summary>Contador de alertas activas (para el badge del panel).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpGet("contador")]
        public async Task<ActionResult<object>> Contador()
            => Ok(new { total = await _service.ContarAsync(await CurrentSucursalScopeAsync()) });
    }
}
