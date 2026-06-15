using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/calendarizacion")]
    [RequirePermission("calendarizacion")]
    public class CalendarizacionController : ControllerBase
    {
        private readonly CalendarizacionService _service;
        private readonly LogiTrackDbContext _context;
        private readonly EmailNotificacionService _email;

        public CalendarizacionController(CalendarizacionService service, LogiTrackDbContext context, EmailNotificacionService email)
        {
            _service = service;
            _context = context;
            _email = email;
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

        /// <summary>G1L-150: Simula la calendarización sin persistir ningún cambio (vista previa).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpPost("preview")]
        public async Task<ActionResult<CalendarizacionResultado>> Preview()
        {
            try
            {
                var resultado = await _service.PreviewAsync(CurrentUserId());
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

        /// <summary>Envíos no entregados (Demorado / RetornadoASucursal) pendientes de reagendamiento.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpGet("pendientes-reagendamiento")]
        public async Task<IActionResult> GetPendientesReagendamiento()
        {
            var sucursalId = await CurrentSucursalIdAsync();

            IQueryable<Paquete> query = _context.Paquetes.Where(p =>
                p.Status == PaqueteStatus.Demorado || p.Status == PaqueteStatus.RetornadoASucursal);

            if (sucursalId.HasValue && sucursalId.Value != Guid.Empty)
            {
                var repIds = await _context.Usuarios.OfType<Repartidor>()
                    .Where(r => r.SucursalId == sucursalId.Value)
                    .Select(r => r.Id)
                    .ToListAsync();
                query = query.Where(p => p.RepartidorAsignadoId.HasValue && repIds.Contains(p.RepartidorAsignadoId.Value));
            }

            var items = await query
                .OrderBy(p => p.FechaCalendarizada)
                .Select(p => new
                {
                    id = p.Id,
                    codigoSeguimiento = p.CodigoSeguimiento,
                    status = p.Status.ToString(),
                    peso = p.Peso,
                    fechaCalendarizada = p.FechaCalendarizada,
                })
                .ToListAsync();

            return Ok(items);
        }

        /// <summary>Reagenda un envío devolviendo a la cola de calendarización y notifica al destinatario.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpPost("{paqueteId:guid}/reagendar")]
        public async Task<IActionResult> Reagendar(Guid paqueteId)
        {
            var paquete = await _context.Paquetes.FindAsync(paqueteId);
            if (paquete is null) return NotFound();

            try
            {
                paquete.LiberarAsignacion();
                await _context.SaveChangesAsync();
                _ = _email.NotificarReagendamientoAsync(paquete).ContinueWith(_ => { });
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Reagenda masivamente una lista de envíos.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpPost("reagendar-masivo")]
        public async Task<IActionResult> ReagendarMasivo([FromBody] ReagendarMasivoRequest body)
        {
            if (body.PaqueteIds == null || body.PaqueteIds.Count == 0)
                return BadRequest("Debe indicar al menos un paquete.");

            var paquetes = await _context.Paquetes
                .Where(p => body.PaqueteIds.Contains(p.Id))
                .ToListAsync();

            int reagendados = 0;
            int sinCambio = 0;

            foreach (var paquete in paquetes)
            {
                try
                {
                    paquete.LiberarAsignacion();
                    reagendados++;
                    _ = _email.NotificarReagendamientoAsync(paquete).ContinueWith(_ => { });
                }
                catch
                {
                    sinCambio++;
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { reagendados, sinFechaDisponible = sinCambio });
        }
    }

    public class ReagendarMasivoRequest
    {
        public List<Guid> PaqueteIds { get; set; } = [];
    }

    // G1L-83
    public class PrecalendarizarRequest
    {
        public Guid PaqueteId { get; set; }
        public Guid RepartidorId { get; set; }
        public DateTime Fecha { get; set; }
    }
}
