using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/auditoria")]
    [RequirePermission("auditoria")]
    public class AuditoriaController : ControllerBase
    {
        private readonly AuditoriaService _service;

        public AuditoriaController(AuditoriaService service)
        {
            _service = service;
        }

        /// <summary>G1L-11 + G1L-16: Listado de auditoría con filtros (Admin/Supervisor).</summary>
        [Authorize(Roles = $"{Roles.Administrador},{Roles.Supervisor}")]
        [HttpGet]
        public async Task<ActionResult<PagedResponse<LogAuditoria>>> Listar(
            [FromQuery] Guid? usuarioId,
            [FromQuery] TipoAccion? accion,
            [FromQuery] string? rol,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string? search,
            [FromQuery] Guid? sucursalId,
            [FromQuery] int? page,
            [FromQuery] int? pageSize)
        {
            var normalizedPage = PaginationDefaults.NormalizePage(page);
            var normalizedPageSize = PaginationDefaults.NormalizePageSize(pageSize);
            var logs = await _service.ListarAsync(
                usuarioId,
                accion,
                rol,
                from,
                to,
                search,
                !User.IsInRole(Roles.Administrador),
                User.IsInRole(Roles.Administrador) ? sucursalId : null,
                normalizedPage,
                normalizedPageSize);
            return Ok(logs);
        }
    }
}
