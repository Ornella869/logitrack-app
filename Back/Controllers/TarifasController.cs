using System.ComponentModel.DataAnnotations;
using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/tarifas")]
    public class TarifasController : ControllerBase
    {
        private readonly TarifaService _service;
        private readonly AuditoriaService _auditoria;

        public TarifasController(TarifaService service, AuditoriaService auditoria)
        {
            _service = service;
            _auditoria = auditoria;
        }

        private Guid? CurrentUserId()
        {
            var s = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(s, out var id) ? id : null;
        }

        // ===== G1L-87 / Épica D: Configuración de tarifas por provincia =====

        /// <summary>Configuración de tarifas de la provincia del usuario logueado.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOGerenteOAdministrador)]
        [HttpGet("configuracion")]
        public async Task<ActionResult<ConfiguracionTarifa>> GetConfiguracion()
        {
            var provincia = CurrentUserId() is Guid uid ? await _service.ResolverProvinciaUsuarioAsync(uid) : string.Empty;
            return Ok(await _service.GetConfiguracionAsync(provincia));
        }

        /// <summary>Actualiza los valores base de tarificación de la provincia del Gerente.</summary>
        [Authorize(Roles = Roles.Gerente)]
        [HttpPut("configuracion")]
        public async Task<ActionResult<ConfiguracionTarifa>> ActualizarConfiguracion([FromBody] ConfiguracionTarifaRequest request)
        {
            try
            {
                var provincia = CurrentUserId() is Guid uid ? await _service.ResolverProvinciaUsuarioAsync(uid) : string.Empty;
                var config = await _service.ActualizarConfiguracionAsync(
                    provincia, request.PrecioPorKg!.Value, request.PrecioPorKm!.Value, request.PorcentajeRecargoZonaPeligrosa!.Value);
                await _auditoria.RegistrarAsync(
                    TipoAccion.Otro,
                    $"Actualizó la configuración de tarifas (provincia {provincia})",
                    contexto: $"$/kg={request.PrecioPorKg} | $/km={request.PrecioPorKm} | recargo={request.PorcentajeRecargoZonaPeligrosa}%");
                return Ok(config);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ===== G1L-86 / Épica D: Zonas peligrosas por provincia =====

        /// <summary>Zonas peligrosas de la provincia del usuario logueado.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOGerenteOAdministrador)]
        [HttpGet("zonas")]
        public async Task<ActionResult<List<ZonaPeligrosa>>> GetZonas()
        {
            var provincias = CurrentUserId() is Guid uid
                ? await _service.ResolverProvinciasVisiblesUsuarioAsync(uid)
                : new List<string>();
            return Ok(await _service.GetZonasAsync(provincias));
        }

        /// <summary>Crea una zona peligrosa en la provincia del Gerente.</summary>
        [Authorize(Roles = Roles.Gerente)]
        [HttpPost("zonas")]
        public async Task<ActionResult<ZonaPeligrosa>> CrearZona([FromBody] ZonaPeligrosaRequest request)
        {
            try
            {
                var provincia = CurrentUserId() is Guid uid ? await _service.ResolverProvinciaUsuarioAsync(uid) : string.Empty;
                var zona = await _service.CrearZonaAsync(request.Nombre, provincia, request.LatMin, request.LatMax, request.LngMin, request.LngMax);
                await _auditoria.RegistrarAsync(
                    TipoAccion.Otro,
                    $"Creó zona peligrosa '{zona.Nombre}' (provincia {provincia})",
                    recursoId: zona.Id.ToString());
                return Ok(zona);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Elimina una zona peligrosa (Gerente).</summary>
        [Authorize(Roles = Roles.Gerente)]
        [HttpDelete("zonas/{id:guid}")]
        public async Task<ActionResult> EliminarZona(Guid id)
        {
            try
            {
                var provincia = CurrentUserId() is Guid uid ? await _service.ResolverProvinciaUsuarioAsync(uid) : string.Empty;
                await _service.EliminarZonaAsync(id, provincia);
                await _auditoria.RegistrarAsync(TipoAccion.Otro, "Eliminó zona peligrosa", recursoId: id.ToString());
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ===== G1L-88: Cotización =====

        /// <summary>Calcula el desglose de la cotización para una dirección destino.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador)]
        [HttpPost("cotizar")]
        public async Task<ActionResult<CotizacionResultado>> Cotizar([FromBody] CotizarRequest request)
        {
            try
            {
                var cotizacion = await _service.CotizarAsync(
                    request.Peso, request.Direccion, request.Localidad, request.CP, request.Provincia);
                return Ok(cotizacion);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }

    public class ConfiguracionTarifaRequest
    {
        [Required] public double? PrecioPorKg { get; set; }
        [Required] public double? PrecioPorKm { get; set; }
        [Required] public double? PorcentajeRecargoZonaPeligrosa { get; set; }
    }

    public class ZonaPeligrosaRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public double LatMin { get; set; }
        [Required] public double LatMax { get; set; }
        [Required] public double LngMin { get; set; }
        [Required] public double LngMax { get; set; }
    }

    public class CotizarRequest
    {
        [Required] public double Peso { get; set; }
        [Required] public string Direccion { get; set; } = string.Empty;
        [Required] public string Localidad { get; set; } = string.Empty;
        [Required] public string CP { get; set; } = string.Empty;
        public string? Provincia { get; set; }
    }
}
