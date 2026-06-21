using System.Security.Claims;
using Back.Application.Common;
using Back.Application.Services;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/permisos")]
    [Authorize]
    public class PermisosController : ControllerBase
    {
        private readonly PermisosService _service;
        private readonly LogiTrackDbContext _context;

        public PermisosController(PermisosService service, LogiTrackDbContext context)
        {
            _service = service;
            _context = context;
        }

        [HttpGet("me")]
        public async Task<ActionResult<IReadOnlyList<string>>> Me()
        {
            return Ok(await _service.ObtenerEfectivosAsync(CurrentUserId()));
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("roles")]
        public ActionResult<IReadOnlyList<string>> RolesDisponibles() =>
            Ok(PermisosService.RolesConfigurables);

        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("roles/{rol}")]
        public async Task<ActionResult<IReadOnlyList<PermisoRolResponse>>> PorRol(string rol)
        {
            try { return Ok(await _service.ObtenerPorRolAsync(rol)); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpPut("roles/{rol}/{permiso}")]
        public async Task<ActionResult> ActualizarRol(string rol, string permiso, [FromBody] ActualizarPermisoRolRequest request)
        {
            try
            {
                await _service.ActualizarRolAsync(rol, permiso, request.Habilitado, CurrentUserId());
                return NoContent();
            }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpDelete("roles/{rol}")]
        public async Task<ActionResult> RestablecerRol(string rol)
        {
            try
            {
                await _service.RestablecerRolAsync(rol, CurrentUserId());
                return NoContent();
            }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("usuarios")]
        public async Task<ActionResult> Usuarios([FromQuery] string? search)
        {
            var query = _context.Usuarios.AsNoTracking().Where(x => x.Activo);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var valor = $"%{search.Trim()}%";
                query = query.Where(x => EF.Functions.ILike(x.Nombre, valor)
                    || EF.Functions.ILike(x.Apellido, valor)
                    || EF.Functions.ILike(x.Email, valor));
            }

            var usuarios = await query.OrderBy(x => x.Nombre).ThenBy(x => x.Apellido).Take(100).ToListAsync();
            // Provincia efectiva por usuario (para acotar el selector de sucursales por-usuario en el front).
            var gerentesProv = await _context.GerentesProvincias.ToListAsync();
            var puntos = await _context.PuntosPickUp.ToDictionaryAsync(p => p.Id, p => p.Provincia);
            var sucs = await _context.Sucursales.ToDictionaryAsync(s => s.Id, s => s.Provincia);
            string? ProvinciaDe(Back.Domain.Models.Usuario x)
            {
                if (x is Back.Domain.Models.Gerente)
                    return string.Join(",", gerentesProv.Where(gp => gp.GerenteId == x.Id).Select(gp => gp.Provincia));
                if (x is Back.Domain.Models.SocioPickUp sp && sp.PuntoPickUpId is Guid pid && puntos.TryGetValue(pid, out var pv))
                    return pv;
                if (x.SucursalId is Guid sid && sucs.TryGetValue(sid, out var sv))
                    return sv;
                return null;
            }
            return Ok(usuarios
                .Where(x => PermisosService.RolesConfigurables.Contains(PermisosService.ObtenerRol(x)))
                .Select(x => new
            {
                x.Id,
                nombre = $"{x.Nombre} {x.Apellido}",
                x.Email,
                rol = PermisosService.ObtenerRol(x),
                provincia = ProvinciaDe(x),
            }));
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("usuarios/{usuarioId:guid}")]
        public async Task<ActionResult<IReadOnlyList<PermisoUsuarioResponse>>> PorUsuario(Guid usuarioId)
        {
            try { return Ok(await _service.ObtenerPorUsuarioAsync(usuarioId)); }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpPut("usuarios/{usuarioId:guid}/{permiso}")]
        public async Task<ActionResult> ActualizarUsuario(Guid usuarioId, string permiso, [FromBody] ActualizarPermisoUsuarioRequest request)
        {
            try
            {
                await _service.ActualizarUsuarioAsync(usuarioId, permiso, request.Estado, CurrentUserId(), request.SucursalesIds);
                return NoContent();
            }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpDelete("usuarios/{usuarioId:guid}")]
        public async Task<ActionResult> RestablecerUsuario(Guid usuarioId)
        {
            try
            {
                await _service.RestablecerUsuarioAsync(usuarioId, CurrentUserId());
                return NoContent();
            }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
        }

        private Guid CurrentUserId()
        {
            var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(value, out var id) ? id : throw new UnauthorizedAccessException();
        }
    }

    public record ActualizarPermisoRolRequest(bool Habilitado);
    public record ActualizarPermisoUsuarioRequest(string Estado, List<Guid>? SucursalesIds = null);
}
