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
        private readonly Back.Domain.Repositories.IGerenteProvinciaRepository _gerenteProvinciaRepo;

        public ReportesController(ReportesService service, IUserRepository userRepository, Back.Domain.Repositories.IGerenteProvinciaRepository gerenteProvinciaRepo)
        {
            _service = service;
            _userRepository = userRepository;
            _gerenteProvinciaRepo = gerenteProvinciaRepo;
        }

        private async Task<(Guid? SucursalId, List<string>? Provincias)> CurrentScopeAsync()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return (null, null);
            var usuario = await _userRepository.GetUsuarioById(userId);
            if (usuario is Administrador) return (null, null);
            if (usuario is Gerente g)
            {
                var provincias = await _gerenteProvinciaRepo.GetProvinciasByGerente(g.Id);
                return (null, provincias);
            }
            return (usuario?.SucursalId, null);
        }

        /// <summary>G1L-26: Reporte de volumen por período (Supervisor).</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Gerente + "," + Roles.Administrador)]
        [HttpGet("volumen")]
        public async Task<ActionResult<ReporteVolumen>> Volumen(
            [FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            var scope = await CurrentScopeAsync();
            // Obtener provincias visibles del usuario (el servicio puede resolverlas si es necesario)
            var reporte = await _service.GetReporteVolumenAsync(desde, hasta, scope.SucursalId, scope.Provincias);
            return Ok(reporte);
        }
    }
}
