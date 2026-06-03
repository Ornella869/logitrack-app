using Back.Application.Common;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/encuesta")]
    [AllowAnonymous]
    public class SatisfaccionController : ControllerBase
    {
        private readonly LogiTrackDbContext _context;

        public SatisfaccionController(LogiTrackDbContext context)
        {
            _context = context;
        }

        private Guid? CurrentUserId()
        {
            var str = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(str, out var id) ? id : null;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            var uid = CurrentUserId();
            if (uid is null) return null;
            if (User.IsInRole(Roles.Administrador)) return null;
            var user = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == uid.Value);
            return user?.SucursalId ?? Guid.Empty;
        }

        [HttpGet("{token:guid}")]
        public async Task<IActionResult> GetEncuesta(Guid token)
        {
            var encuesta = await _context.SatisfaccionEncuestas
                .Include(e => e.Paquete)
                .FirstOrDefaultAsync(e => e.Token == token);

            if (encuesta == null) return NotFound();

            return Ok(new
            {
                paqueteCodigo = encuesta.Paquete.CodigoSeguimiento,
                destinatarioNombre = encuesta.Paquete.Destinatario.Nombre,
                yaRespondida = encuesta.RespuestaEn.HasValue,
                calificacion = encuesta.Calificacion,
                comentario = encuesta.Comentario,
            });
        }

        [HttpPost("{token:guid}")]
        public async Task<IActionResult> ResponderEncuesta(Guid token, [FromBody] ResponderEncuestaRequest request)
        {
            var encuesta = await _context.SatisfaccionEncuestas.FirstOrDefaultAsync(e => e.Token == token);
            if (encuesta == null) return NotFound();

            try
            {
                encuesta.Responder(request.Calificacion, request.Comentario);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }

            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Gerente + "," + Roles.Administrador)]
        [HttpGet("respuestas")]
        public async Task<IActionResult> GetRespuestas([FromQuery] DateTime? desde, [FromQuery] DateTime? hasta, [FromQuery] Guid? repartidorId)
        {
            var scope = await CurrentSucursalScopeAsync();

            var query = _context.SatisfaccionEncuestas
                .Include(e => e.Paquete)
                .Where(e => e.RespuestaEn.HasValue);

            if (scope.HasValue)
                query = query.Where(e => e.Paquete.SucursalId == scope.Value);
            if (desde.HasValue)
                query = query.Where(e => e.RespuestaEn >= desde.Value.Date.ToUniversalTime());
            if (hasta.HasValue)
                query = query.Where(e => e.RespuestaEn < hasta.Value.Date.AddDays(1).ToUniversalTime());
            if (repartidorId.HasValue)
                query = query.Where(e => e.Paquete.RepartidorAsignadoId == repartidorId.Value);

            var items = await query
                .OrderByDescending(e => e.RespuestaEn)
                .Take(200)
                .ToListAsync();

            var repartidorIds = items
                .Where(e => e.Paquete.RepartidorAsignadoId.HasValue)
                .Select(e => e.Paquete.RepartidorAsignadoId!.Value)
                .Distinct()
                .ToList();

            var repartidores = await _context.Usuarios
                .Where(u => repartidorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => $"{u.Nombre} {u.Apellido}");

            return Ok(items.Select(e =>
            {
                var repId = e.Paquete.RepartidorAsignadoId;
                return new
                {
                    id = e.Id,
                    paqueteCodigo = e.Paquete.CodigoSeguimiento,
                    destinatarioNombre = $"{e.Paquete.Destinatario.Nombre} {e.Paquete.Destinatario.Apellido}",
                    calificacion = e.Calificacion,
                    comentario = e.Comentario,
                    respondidaEn = e.RespuestaEn,
                    repartidorId = repId,
                    repartidorNombre = repId.HasValue && repartidores.TryGetValue(repId.Value, out var n) ? n : null,
                };
            }));
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Gerente + "," + Roles.Administrador)]
        [HttpGet("metricas")]
        public async Task<IActionResult> GetMetricas([FromQuery] DateTime? desde, [FromQuery] DateTime? hasta)
        {
            var scope = await CurrentSucursalScopeAsync();

            var query = _context.SatisfaccionEncuestas
                .Include(e => e.Paquete)
                .Where(e => e.RespuestaEn.HasValue && e.Calificacion.HasValue);

            if (scope.HasValue)
                query = query.Where(e => e.Paquete.SucursalId == scope.Value);
            if (desde.HasValue)
                query = query.Where(e => e.RespuestaEn >= desde.Value.Date.ToUniversalTime());
            if (hasta.HasValue)
                query = query.Where(e => e.RespuestaEn < hasta.Value.Date.AddDays(1).ToUniversalTime());

            var items = await query.ToListAsync();

            static int CalcNps(IEnumerable<int> calificaciones)
            {
                var list = calificaciones.ToList();
                if (list.Count == 0) return 0;
                var promotores = list.Count(c => c == 5);
                var detractores = list.Count(c => c <= 3);
                return (int)Math.Round((promotores - detractores) * 100.0 / list.Count);
            }

            var globalCals = items.Select(e => e.Calificacion!.Value).ToList();

            var repartidorIds = items
                .Where(e => e.Paquete.RepartidorAsignadoId.HasValue)
                .Select(e => e.Paquete.RepartidorAsignadoId!.Value)
                .Distinct()
                .ToList();

            var repartidores = await _context.Usuarios
                .Where(u => repartidorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => $"{u.Nombre} {u.Apellido}");

            var porRepartidor = items
                .Where(e => e.Paquete.RepartidorAsignadoId.HasValue)
                .GroupBy(e => e.Paquete.RepartidorAsignadoId!.Value)
                .Select(g =>
                {
                    var cals = g.Select(e => e.Calificacion!.Value).ToList();
                    return new
                    {
                        repartidorId = g.Key,
                        repartidorNombre = repartidores.TryGetValue(g.Key, out var n) ? n : "Desconocido",
                        totalRespuestas = cals.Count,
                        promedioCalificacion = Math.Round(cals.Average(), 2),
                        nps = CalcNps(cals),
                        promotores = cals.Count(c => c == 5),
                        pasivos = cals.Count(c => c == 4),
                        detractores = cals.Count(c => c <= 3),
                    };
                })
                .OrderByDescending(x => x.promedioCalificacion)
                .ToList();

            return Ok(new
            {
                totalRespuestas = globalCals.Count,
                promedioCalificacion = globalCals.Count > 0 ? Math.Round(globalCals.Average(), 2) : 0,
                nps = CalcNps(globalCals),
                promotores = globalCals.Count(c => c == 5),
                pasivos = globalCals.Count(c => c == 4),
                detractores = globalCals.Count(c => c <= 3),
                porRepartidor,
            });
        }
    }

    public class ResponderEncuestaRequest
    {
        public int Calificacion { get; set; }
        public string? Comentario { get; set; }
    }
}
