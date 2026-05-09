using Back.Application.Common;
using Back.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/rutas-activas")]
    public class RutasActivasController : ControllerBase
    {
        private readonly RutasActivasService _service;

        public RutasActivasController(RutasActivasService service)
        {
            _service = service;
        }

        /// <summary>G1L-70: Listado de rutas del día con progreso, capacidad y demoras.</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpGet]
        public async Task<ActionResult<ListadoRutasActivasResponse>> Listado(
            [FromQuery] string? search,
            [FromQuery] int? page,
            [FromQuery] int? pageSize)
        {
            var normalizedPage = PaginationDefaults.NormalizePage(page);
            var normalizedPageSize = PaginationDefaults.NormalizePageSize(pageSize);
            var items = await _service.GetRutasDeHoyPaginadasAsync(search, normalizedPage, normalizedPageSize);
            return Ok(items);
        }

        /// <summary>G1L-42 + G1L-70: Detalle de la ruta de un repartidor para un día.</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpGet("{repartidorId:guid}")]
        public async Task<ActionResult<DetalleRutaResponse>> Detalle(Guid repartidorId, [FromQuery] DateTime? fecha)
        {
            var dia = (fecha ?? DateTime.UtcNow).Date;
            var detalle = await _service.GetDetalleRutaAsync(repartidorId, dia);
            if (detalle is null) return NotFound();
            return Ok(detalle);
        }
    }
}
