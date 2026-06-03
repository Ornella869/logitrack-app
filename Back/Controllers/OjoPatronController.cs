using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/ojo-patron")]
    public class OjoPatronController : ControllerBase
    {
        private readonly OjoPatronService _service;

        public OjoPatronController(OjoPatronService service)
        {
            _service = service;
        }

        private Guid? CurrentUserId()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var id) ? id : null;
        }

        // G1L-59: texto legal vigente (Ley 25.326) para mostrar en el modal.
        private const string TextoLegal =
            "En cumplimiento de la Ley 25.326 de Protección de los Datos Personales, LogiTrack te informa que, " +
            "como parte de la política de seguridad \"Ojo del Patrón\", se realizará una breve prueba acústica de voz " +
            "antes de iniciar tu ruta.\n\n" +
            "• Qué dato se recolecta: una muestra de voz de 5 segundos, procesada para estimar tu nivel de activación vocal.\n" +
            "• Finalidad: validar tu estado previo a operar y cumplir la política de seguridad de la empresa.\n" +
            "• Procesamiento: el análisis se realiza localmente en tu dispositivo. El audio NO se almacena ni se transmite a servidores. " +
            "Solo se conserva el resultado (aprobado/rechazado), la fecha/hora y el valor numérico del análisis.\n" +
            "• Conservación: los resultados se conservan mientras dure la relación laboral con fines de auditoría.\n" +
            "• Quién accede: el Administrador del sistema, con fines de control de seguridad.\n\n" +
            "Podés revocar este consentimiento en cualquier momento desde \"Mi Perfil\". " +
            "Mientras no lo aceptes (o si lo revocás), no podrás iniciar la ruta del día.";

        /// <summary>Texto legal y versión vigente del consentimiento (Repartidor).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("texto-legal")]
        public ActionResult<object> GetTextoLegal()
            => Ok(new { version = OjoPatronService.VersionTextoVigente, texto = TextoLegal });

        /// <summary>Estado del consentimiento del repartidor logueado.</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("consentimiento")]
        public async Task<ActionResult<EstadoConsentimiento>> GetConsentimiento()
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            return Ok(await _service.GetEstadoAsync(userId.Value));
        }

        /// <summary>Acepta el consentimiento informado (Repartidor).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("consentimiento/aceptar")]
        public async Task<ActionResult> Aceptar()
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            await _service.AceptarAsync(userId.Value);
            return Ok();
        }

        /// <summary>Revoca el consentimiento informado (Repartidor).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("consentimiento/revocar")]
        public async Task<ActionResult> Revocar()
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            await _service.RevocarAsync(userId.Value);
            return Ok();
        }

        // ===== G1L-60 / G1L-61: prueba acústica =====

        /// <summary>Estado de la prueba del día + umbral vigente (Repartidor).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("prueba/estado")]
        public async Task<ActionResult<EstadoPruebaDia>> EstadoPrueba()
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            return Ok(await _service.GetEstadoPruebaDiaAsync(userId.Value));
        }

        /// <summary>Registra el resultado de la prueba acústica (Repartidor). El audio no se envía ni se guarda.</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("prueba")]
        public async Task<ActionResult> RegistrarPrueba([FromBody] RegistrarPruebaRequest request)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            await _service.RegistrarPruebaAsync(
                userId.Value, "Repartidor",
                request.ScoreNeu, request.ScoreHap, request.ScoreSad, request.ScoreAng,
                request.AlertnessScore, request.Intentos, request.Resultado, request.Momento);
            return Ok();
        }

        /// <summary>Fase B: indica si para entregar este paquete se requiere la prueba de mitad de recorrido.</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("prueba-mitad-requerida/{paqueteId:guid}")]
        public async Task<ActionResult<object>> PruebaMitadRequerida(Guid paqueteId)
            => Ok(new { requerida = await _service.RequierePruebaMitadAsync(paqueteId) });

        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("override/solicitar")]
        public async Task<ActionResult<OverrideOjoPatronDto>> SolicitarOverride([FromBody] SolicitarOverrideOjoPatronRequest request)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            try
            {
                var solicitud = await _service.SolicitarOverrideAsync(userId.Value, request.Momento, request.Motivo);
                return Ok(ToOverrideDto(solicitud));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpGet("override/solicitudes")]
        public async Task<ActionResult<List<OverrideOjoPatronDto>>> ListarOverrides()
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            var solicitudes = await _service.ListarOverridesSupervisorAsync(userId.Value);
            return Ok(solicitudes.Select(ToOverrideDto).ToList());
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpPost("override/{overrideId:guid}/resolver")]
        public async Task<ActionResult<OverrideOjoPatronDto>> ResolverOverride(Guid overrideId, [FromBody] ResolverOverrideOjoPatronRequest request)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            try
            {
                var solicitud = await _service.ResolverOverrideAsync(userId.Value, overrideId, request.Aprobado, request.Comentario);
                return Ok(ToOverrideDto(solicitud));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpGet("metricas-historicas")]
        public async Task<ActionResult<List<object>>> MetricasHistoricas([FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            return Ok(await _service.GetMetricasHistoricasAsync(userId.Value, desde, hasta));
        }

        /// <summary>Configuración del umbral de la provincia del usuario logueado.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOGerenteOAdministrador)]
        [HttpGet("configuracion")]
        public async Task<ActionResult<ConfiguracionOjoPatron>> GetConfiguracion()
        {
            var provincia = CurrentUserId() is Guid uid ? await _service.ResolverProvinciaUsuarioAsync(uid) : string.Empty;
            return Ok(await _service.GetConfiguracionAsync(provincia));
        }

        /// <summary>Ajusta el umbral de activación vocal de la provincia del Gerente.</summary>
        [Authorize(Roles = Roles.Gerente)]
        [HttpPut("configuracion")]
        public async Task<ActionResult<ConfiguracionOjoPatron>> ActualizarConfiguracion([FromBody] ConfiguracionOjoPatronRequest request)
        {
            try
            {
                var provincia = CurrentUserId() is Guid uid ? await _service.ResolverProvinciaUsuarioAsync(uid) : string.Empty;
                return Ok(await _service.ActualizarConfiguracionAsync(provincia, request.UmbralAlertness));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private static OverrideOjoPatronDto ToOverrideDto(OverrideOjoPatron o) => new(
            o.Id,
            o.RepartidorId,
            o.SupervisorId,
            o.Momento.ToString(),
            o.Motivo,
            o.Estado.ToString(),
            o.SolicitadoEn,
            o.ResueltoEn,
            o.ComentarioSupervisor);
    }

    public class RegistrarPruebaRequest
    {
        public double ScoreNeu { get; set; }
        public double ScoreHap { get; set; }
        public double ScoreSad { get; set; }
        public double ScoreAng { get; set; }
        public double AlertnessScore { get; set; }
        public int Intentos { get; set; }
        public Domain.Models.ResultadoPruebaOjoPatron Resultado { get; set; }
        public Domain.Models.MomentoPruebaOjoPatron Momento { get; set; } = Domain.Models.MomentoPruebaOjoPatron.Inicio;
    }

    public class ConfiguracionOjoPatronRequest
    {
        public double UmbralAlertness { get; set; }
    }

    public class SolicitarOverrideOjoPatronRequest
    {
        public Domain.Models.MomentoPruebaOjoPatron Momento { get; set; } = Domain.Models.MomentoPruebaOjoPatron.Inicio;
        public string Motivo { get; set; } = string.Empty;
    }

    public class ResolverOverrideOjoPatronRequest
    {
        public bool Aprobado { get; set; }
        public string? Comentario { get; set; }
    }

    public record OverrideOjoPatronDto(
        Guid Id,
        Guid RepartidorId,
        Guid? SupervisorId,
        string Momento,
        string Motivo,
        string Estado,
        DateTime SolicitadoEn,
        DateTime? ResueltoEn,
        string? ComentarioSupervisor);

}
