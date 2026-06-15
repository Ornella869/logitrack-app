using Back.Application.Common;
using Back.Application.Services;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/calendarizacion")]
    [RequirePermission("calendarizacion")]
    public class CalendarizacionController : ControllerBase
    {
        private readonly CalendarizacionService _service;
        private readonly LogiTrackDbContext _context;

        public CalendarizacionController(CalendarizacionService service, LogiTrackDbContext context)
        {
            _service = service;
            _context = context;
        }

        private Guid? CurrentUserId()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var id) ? id : null;
        }

        // Épica D: sucursal del usuario logueado (para acotar la calendarización).
        private async Task<Guid?> CurrentSucursalIdAsync()
        {
            if (User.IsInRole(Roles.Administrador)) return null;
            if (CurrentUserId() is not Guid uid) return null;
            var u = await _context.Usuarios.FindAsync(uid);
            return u?.SucursalId ?? Guid.Empty;
        }

        /// <summary>Cantidad de paquetes pendientes de calendarización de la sucursal del usuario.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet("pendientes")]
        public async Task<ActionResult<object>> Pendientes()
        {
            var total = await _service.ContarPendientesAsync(await CurrentSucursalIdAsync());
            return Ok(new { total });
        }

        /// <summary>Estado actual de asignaciones activas de la sucursal, agrupado por día y repartidor.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet("estado-actual")]
        public async Task<ActionResult<List<DiaResumen>>> EstadoActual()
        {
            var resumen = await _service.GetEstadoActualAsync(await CurrentSucursalIdAsync());
            return Ok(resumen);
        }

        /// <summary>G1L-55: Calendario operativo grilla repartidor x día (próximos N días, default 14).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet("calendario")]
        public async Task<ActionResult<CalendarioOperativo>> Calendario([FromQuery] int dias = 14)
        {
            if (dias < 1 || dias > 60) dias = 14;
            var calendario = await _service.GetCalendarioOperativoAsync(dias, await CurrentSucursalIdAsync());
            return Ok(calendario);
        }

        /// <summary>G1L-83: Precalendarización manual de un envío a un repartidor y día (Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpPost("precalendarizar")]
        public async Task<ActionResult<PrecalendarizacionResultado>> Precalendarizar([FromBody] PrecalendarizarRequest request)
        {
            try
            {
                var resultado = await _service.PrecalendarizarManualAsync(
                    request.PaqueteId, request.RepartidorId, request.Fecha, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Ejecuta el algoritmo de calendarización automática (G1L-54).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpPost("ejecutar")]
        public async Task<ActionResult<CalendarizacionResultado>> Ejecutar()
        {
            try
            {
                var resultado = await _service.EjecutarAsync(CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }

    // G1L-83
    public class PrecalendarizarRequest
    {
        public Guid PaqueteId { get; set; }
        public Guid RepartidorId { get; set; }
        public DateTime Fecha { get; set; }
    }
}
