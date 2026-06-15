using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/rutas-activas")]
    [RequirePermission("rutas_activas")]
    public class RutasActivasController : ControllerBase
    {
        private readonly RutasActivasService _service;
        private readonly IUserRepository _userRepository;

        public RutasActivasController(RutasActivasService service, IUserRepository userRepository)
        {
            _service = service;
            _userRepository = userRepository;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            if (User.IsInRole(Roles.Administrador)) return null;
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return Guid.Empty;
            return (await _userRepository.GetUsuarioById(userId))?.SucursalId ?? Guid.Empty;
        }

        /// <summary>G1L-70: Listado de rutas del día con progreso, capacidad y demoras.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet]
        public async Task<ActionResult<ListadoRutasActivasResponse>> Listado(
            [FromQuery] string? search,
            [FromQuery] int? page,
            [FromQuery] int? pageSize)
        {
            var normalizedPage = PaginationDefaults.NormalizePage(page);
            var normalizedPageSize = PaginationDefaults.NormalizePageSize(pageSize);
            var items = await _service.GetRutasDeHoyPaginadasAsync(search, normalizedPage, normalizedPageSize, await CurrentSucursalScopeAsync());
            return Ok(items);
        }

        /// <summary>G1L-42 + G1L-70: Detalle de la ruta de un repartidor para un día.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet("{repartidorId:guid}")]
        public async Task<ActionResult<DetalleRutaResponse>> Detalle(Guid repartidorId, [FromQuery] DateTime? fecha)
        {
            var dia = (fecha ?? OperationalClock.TodayUtcDate).Date;
            var detalle = await _service.GetDetalleRutaAsync(repartidorId, dia, await CurrentSucursalScopeAsync());
            if (detalle is null) return NotFound();
            return Ok(detalle);
        }
    }
}
