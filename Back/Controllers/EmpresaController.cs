using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/empresa")]
    public class EmpresaController : ControllerBase
    {
        private readonly EmpresaService _service;

        public EmpresaController(EmpresaService service)
        {
            _service = service;
        }

        /// <summary>G1L-52: datos del plan actual + consumo.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("mi-plan")]
        public async Task<ActionResult<MiPlanResponse>> MiPlan()
        {
            var r = await _service.GetMiPlanAsync();
            return Ok(r);
        }

        /// <summary>Catálogo de planes disponibles (público).</summary>
        [HttpGet("planes")]
        public ActionResult<List<PlanCatalogo>> Catalogo()
        {
            return Ok(_service.GetCatalogo());
        }

        /// <summary>G1L-63: Solicita cambio de plan, devuelve código mock.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("cambiar-plan")]
        public async Task<ActionResult<object>> CambiarPlan([FromBody] CambioPlanRequest request)
        {
            try
            {
                var codigo = await _service.SolicitarCambioPlanAsync(request.Plan);
                return Ok(new { codigo });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>G1L-63: Confirma cambio de plan con código de verificación.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("cambiar-plan/confirmar")]
        public async Task<ActionResult> ConfirmarCambio([FromBody] ConfirmarCambioRequest request)
        {
            try
            {
                await _service.ConfirmarCambioPlanAsync(request.Codigo);
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>G1L-64: Simulación — suspender empresa.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("suspender")]
        public async Task<ActionResult> Suspender()
        {
            await _service.SuspenderAsync();
            return Ok();
        }

        /// <summary>G1L-64: Reactivar empresa.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("reactivar")]
        public async Task<ActionResult> Reactivar()
        {
            await _service.ReactivarAsync();
            return Ok();
        }
    }

    public class CambioPlanRequest
    {
        public PlanEmpresa Plan { get; set; }
    }

    public class ConfirmarCambioRequest
    {
        public string Codigo { get; set; } = string.Empty;
    }
}
