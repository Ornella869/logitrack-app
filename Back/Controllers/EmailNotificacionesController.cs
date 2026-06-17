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
    [Route("api/emails")]
    public class EmailNotificacionesController : ControllerBase
    {
        private readonly LogiTrackDbContext _context;
        private readonly EmailNotificacionService _service;

        public EmailNotificacionesController(LogiTrackDbContext context, EmailNotificacionService service)
        {
            _context = context;
            _service = service;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            if (User.IsInRole(Roles.Administrador)) return null;
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return Guid.Empty;
            var user = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == userId);
            if (user is Gerente gerente)
            {
                if (!gerente.SucursalActivaId.HasValue) return Guid.Empty;
                var habilitada = await _context.GerentesSucursales
                    .AnyAsync(x => x.GerenteId == gerente.Id && x.SucursalId == gerente.SucursalActivaId.Value);
                return habilitada ? gerente.SucursalActivaId.Value : Guid.Empty;
            }
            return user?.SucursalId ?? Guid.Empty;
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador + "," + Roles.Gerente)]
        [HttpGet("paquete/{paqueteId:guid}")]
        public async Task<ActionResult<List<EmailNotificacionDto>>> GetPorPaquete(Guid paqueteId)
        {
            var scope = await CurrentSucursalScopeAsync();
            var query = _context.EmailNotificaciones.Where(e => e.PaqueteId == paqueteId);
            if (scope.HasValue) query = query.Where(e => e.SucursalId == scope);
            var items = await query.OrderByDescending(e => e.CreadoEn).ToListAsync();
            return Ok(items.Select(ToDto).ToList());
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador + "," + Roles.Gerente)]
        [HttpPost("{emailId:guid}/reintentar")]
        public async Task<ActionResult<EmailNotificacionDto>> Reintentar(Guid emailId)
        {
            var scope = await CurrentSucursalScopeAsync();
            var ok = await _service.ReintentarAsync(emailId, scope);
            if (!ok) return NotFound();
            await _context.SaveChangesAsync();
            var email = await _context.EmailNotificaciones.FirstAsync(e => e.Id == emailId);
            return Ok(ToDto(email));
        }

        private static EmailNotificacionDto ToDto(EmailNotificacion e) => new(
            e.Id,
            e.PaqueteId,
            e.CodigoSeguimiento,
            e.DestinatarioEmail,
            e.Asunto,
            e.Evento.ToString(),
            e.Estado.ToString(),
            e.CreadoEn,
            e.EnviadoEn,
            e.Error,
            e.Intentos);
    }

    public record EmailNotificacionDto(
        Guid Id,
        Guid? PaqueteId,
        string? CodigoSeguimiento,
        string DestinatarioEmail,
        string Asunto,
        string Evento,
        string Estado,
        DateTime CreadoEn,
        DateTime? EnviadoEn,
        string? Error,
        int Intentos);
}
