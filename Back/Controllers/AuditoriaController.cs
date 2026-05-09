using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/auditoria")]
    public class AuditoriaController : ControllerBase
    {
        private readonly AuditoriaService _service;

        public AuditoriaController(AuditoriaService service)
        {
            _service = service;
        }

        /// <summary>G1L-11 + G1L-16: Listado de auditoría con filtros (Admin only).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpGet]
        public async Task<ActionResult<PagedResponse<LogAuditoria>>> Listar(
            [FromQuery] Guid? usuarioId,
            [FromQuery] TipoAccion? accion,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string? search,
            [FromQuery] int? page,
            [FromQuery] int? pageSize)
        {
            var normalizedPage = PaginationDefaults.NormalizePage(page);
            var normalizedPageSize = PaginationDefaults.NormalizePageSize(pageSize);
            var logs = await _service.ListarAsync(usuarioId, accion, from, to, search, normalizedPage, normalizedPageSize);
            return Ok(logs);
        }
    }
}
