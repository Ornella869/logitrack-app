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
            if (u is Gerente gerente)
            {
                if (!gerente.SucursalActivaId.HasValue) return Guid.Empty;
                var habilitada = await _context.GerentesSucursales
                    .AnyAsync(x => x.GerenteId == gerente.Id && x.SucursalId == gerente.SucursalActivaId.Value);
                return habilitada ? gerente.SucursalActivaId.Value : Guid.Empty;
            }
            return u?.SucursalId ?? Guid.Empty;
        }

        /// <summary>Cantidad de paquetes pendientes de calendarización de la sucursal del usuario.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpGet("pendientes")]
        public async Task<ActionResult<object>> Pendientes()
        {
            var total = await _service.ContarPendientesAsync(await CurrentSucursalIdAsync());
            return Ok(new { total });
        }

        /// <summary>Estado actual de asignaciones activas de la sucursal, agrupado por día y repartidor.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpGet("estado-actual")]
        public async Task<ActionResult<List<DiaResumen>>> EstadoActual()
        {
            var resumen = await _service.GetEstadoActualAsync(await CurrentSucursalIdAsync());
            return Ok(resumen);
        }

        /// <summary>G1L-55: Calendario operativo grilla repartidor x día (próximos N días, default 14).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpGet("calendario")]
        public async Task<ActionResult<CalendarioOperativo>> Calendario([FromQuery] int dias = 14)
        {
            if (dias < 1 || dias > 60) dias = 14;
            var calendario = await _service.GetCalendarioOperativoAsync(dias, await CurrentSucursalIdAsync());
            return Ok(calendario);
        }

        /// <summary>G1L-83: Precalendarización manual de un envío a un repartidor y día (Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpPost("precalendarizar")]
        public async Task<ActionResult<PrecalendarizacionResultado>> Precalendarizar([FromBody] PrecalendarizarRequest request)
        {
            // Bloqueo US2: si el paquete va a un PuntoPickUp, validar que ese día no esté cerrado.
            var paqueteCheck = await _context.Paquetes.FindAsync(request.PaqueteId);
            if (paqueteCheck?.PuntoPickUpId is Guid puntoId)
            {
                var diaSemana = (int)request.Fecha.ToUniversalTime().DayOfWeek;
                var horario = await _context.HorariosPickUp
                    .FirstOrDefaultAsync(h => h.PuntoPickUpId == puntoId && h.DiaSemana == diaSemana);
                if (horario?.Cerrado == true)
                {
                    var proximaDisponible = await ProximaFechaDisponibleAsync(puntoId, request.Fecha.Date);
                    var sugerencia = proximaDisponible.HasValue
                        ? $" Próxima fecha disponible: {proximaDisponible.Value:dd/MM/yyyy}."
                        : "";
                    return BadRequest(new { message = $"El punto Pick Up está cerrado ese día.{sugerencia}" });
                }
            }

            try
            {
                var resultado = await _service.PrecalendarizarManualAsync(
                    request.PaqueteId, request.RepartidorId, request.Fecha, CurrentUserId(), await CurrentSucursalIdAsync());
                await _context.SaveChangesAsync();
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private async Task<DateTime?> ProximaFechaDisponibleAsync(Guid puntoPickUpId, DateTime desde)
        {
            var horarios = await _context.HorariosPickUp
                .Where(h => h.PuntoPickUpId == puntoPickUpId)
                .ToListAsync();
            if (horarios.Count == 0) return null;
            var candidata = desde.AddDays(1);
            for (int i = 0; i < 14; i++, candidata = candidata.AddDays(1))
            {
                var dia = (int)candidata.DayOfWeek;
                var h = horarios.FirstOrDefault(h => h.DiaSemana == dia);
                if (h == null || !h.Cerrado) return candidata;
            }
            return null;
        }

        /// <summary>G1L-150: Simula la calendarización sin persistir ningún cambio (vista previa).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpPost("preview")]
        public async Task<ActionResult<CalendarizacionResultado>> Preview()
        {
            try
            {
                var resultado = await _service.PreviewAsync(CurrentUserId(), await CurrentSucursalIdAsync());
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Ejecuta el algoritmo de calendarización automática (G1L-54).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor + "," + Roles.Gerente)]
        [HttpPost("ejecutar")]
        public async Task<ActionResult<CalendarizacionResultado>> Ejecutar()
        {
            try
            {
                var resultado = await _service.EjecutarAsync(CurrentUserId(), await CurrentSucursalIdAsync());
                await _context.SaveChangesAsync();
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Envíos no entregados (Demorado / RetornadoASucursal) pendientes de reagendamiento.</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Gerente)]
        [HttpGet("pendientes-reagendamiento")]
        public async Task<IActionResult> GetPendientesReagendamiento()
        {
            var sucursalId = await CurrentSucursalIdAsync();

            IQueryable<Paquete> query = _context.Paquetes.Where(p =>
                p.Status == PaqueteStatus.Demorado || p.Status == PaqueteStatus.RetornadoASucursal);

            if (sucursalId.HasValue && sucursalId.Value != Guid.Empty)
            {
                query = query.Where(p => p.SucursalId == sucursalId.Value);
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
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Gerente)]
        [HttpPost("{paqueteId:guid}/reagendar")]
        public async Task<IActionResult> Reagendar(Guid paqueteId)
        {
            try
            {
                var resultado = await _service.ReagendarAutomaticamenteAsync(paqueteId, CurrentUserId(), await CurrentSucursalIdAsync());
                await _context.SaveChangesAsync();
                if (resultado.Asignado)
                {
                    var paquete = await _context.Paquetes.FindAsync(paqueteId);
                    if (paquete is not null)
                        _ = _email.NotificarReagendamientoAsync(paquete).ContinueWith(_ => { });
                }
                return Ok(resultado);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Reagenda masivamente una lista de envíos.</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Gerente)]
        [HttpPost("reagendar-masivo")]
        public async Task<IActionResult> ReagendarMasivo([FromBody] ReagendarMasivoRequest body)
        {
            if (body.PaqueteIds == null || body.PaqueteIds.Count == 0)
                return BadRequest("Debe indicar al menos un paquete.");

            int reagendados = 0;
            int sinFechaDisponible = 0;
            var items = new List<ReagendamientoResultado>();

            foreach (var paqueteId in body.PaqueteIds.Distinct())
            {
                try
                {
                    var resultado = await _service.ReagendarAutomaticamenteAsync(paqueteId, CurrentUserId(), await CurrentSucursalIdAsync());
                    items.Add(resultado);
                    if (resultado.Asignado) reagendados++;
                    else sinFechaDisponible++;
                }
                catch
                {
                    sinFechaDisponible++;
                }
            }

            await _context.SaveChangesAsync();
            foreach (var resultado in items.Where(i => i.Asignado))
            {
                var paquete = await _context.Paquetes.FindAsync(resultado.PaqueteId);
                if (paquete is not null)
                    _ = _email.NotificarReagendamientoAsync(paquete).ContinueWith(_ => { });
            }
            return Ok(new { reagendados, sinFechaDisponible, items });
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
