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
    [Route("api/rutas-activas")]
    [RequirePermission("rutas_activas")]
    public class RutasActivasController : ControllerBase
    {
        private readonly RutasActivasService _service;
        private readonly IUserRepository _userRepository;
        private readonly LogiTrackDbContext _context;

        public RutasActivasController(RutasActivasService service, IUserRepository userRepository, LogiTrackDbContext context)
        {
            _service = service;
            _userRepository = userRepository;
            _context = context;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            if (User.IsInRole(Roles.Administrador)) return null;
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return Guid.Empty;
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

        /// <summary>G1L-70: Listado de rutas del día con progreso, capacidad y demoras.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor + "," + Roles.Gerente)]
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
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor + "," + Roles.Gerente)]
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
