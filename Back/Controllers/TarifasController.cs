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

        // ===== G1L-87: Configuración de tarifas =====

        /// <summary>Configuración de tarifas vigente (Operador, Supervisor o Admin la leen para cotizar).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador)]
        [HttpGet("configuracion")]
        public async Task<ActionResult<ConfiguracionTarifa>> GetConfiguracion()
            => Ok(await _service.GetConfiguracionAsync());

        /// <summary>Actualiza los valores base de tarificación (solo Administrador).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPut("configuracion")]
        public async Task<ActionResult<ConfiguracionTarifa>> ActualizarConfiguracion([FromBody] ConfiguracionTarifaRequest request)
        {
            try
            {
                var config = await _service.ActualizarConfiguracionAsync(
                    request.PrecioPorKg, request.PrecioPorKm, request.PorcentajeRecargoZonaPeligrosa);
                await _auditoria.RegistrarAsync(
                    TipoAccion.Otro,
                    "Actualizó la configuración de tarifas",
                    contexto: $"$/kg={request.PrecioPorKg} | $/km={request.PrecioPorKm} | recargo={request.PorcentajeRecargoZonaPeligrosa}%");
                return Ok(config);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ===== G1L-86: Zonas peligrosas =====

        /// <summary>Lista de zonas peligrosas (rectángulos en el mapa).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador)]
        [HttpGet("zonas")]
        public async Task<ActionResult<List<ZonaPeligrosa>>> GetZonas()
            => Ok(await _service.GetZonasAsync());

        /// <summary>Crea una zona peligrosa delimitada por un rectángulo (solo Administrador).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("zonas")]
        public async Task<ActionResult<ZonaPeligrosa>> CrearZona([FromBody] ZonaPeligrosaRequest request)
        {
            try
            {
                var zona = await _service.CrearZonaAsync(request.Nombre, request.LatMin, request.LatMax, request.LngMin, request.LngMax);
                await _auditoria.RegistrarAsync(
                    TipoAccion.Otro,
                    $"Creó zona peligrosa '{zona.Nombre}'",
                    recursoId: zona.Id.ToString());
                return Ok(zona);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Elimina una zona peligrosa (solo Administrador).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpDelete("zonas/{id:guid}")]
        public async Task<ActionResult> EliminarZona(Guid id)
        {
            await _service.EliminarZonaAsync(id);
            await _auditoria.RegistrarAsync(TipoAccion.Otro, "Eliminó zona peligrosa", recursoId: id.ToString());
            return NoContent();
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
        [Required] public double PrecioPorKg { get; set; }
        [Required] public double PrecioPorKm { get; set; }
        [Required] public double PorcentajeRecargoZonaPeligrosa { get; set; }
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
