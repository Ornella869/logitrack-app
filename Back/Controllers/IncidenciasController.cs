using System.Security.Claims;
using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/incidencias")]
    public class IncidenciasController : ControllerBase
    {
        private readonly LogiTrackDbContext _context;
        private readonly IUserRepository _userRepository;
        private readonly AuditoriaService _auditoria;

        public IncidenciasController(LogiTrackDbContext context, IUserRepository userRepository, AuditoriaService auditoria)
        {
            _context = context;
            _userRepository = userRepository;
            _auditoria = auditoria;
        }

        [AllowAnonymous]
        [HttpPost("publica")]
        public async Task<ActionResult<IncidenciaDto>> CrearPublica([FromBody] CrearIncidenciaPublicaRequest request)
        {
            var tracking = request.TrackingId?.Trim();
            if (string.IsNullOrWhiteSpace(tracking)) return BadRequest("El tracking es obligatorio.");
            if (string.IsNullOrWhiteSpace(request.Tipo) || string.IsNullOrWhiteSpace(request.Descripcion))
                return BadRequest("El motivo y la descripcion son obligatorios.");

            var paquete = await _context.Paquetes.FirstOrDefaultAsync(p => p.CodigoSeguimiento == tracking);
            if (paquete is null) return NotFound("No existe un envio con ese tracking.");
            if (!PuedeReportarCliente(paquete)) return BadRequest("Solo se pueden reportar incidencias sobre envios en transito, entregados o cancelados.");

            if (await ExisteDuplicadaAsync(paquete.Id, request.Tipo, null))
                return BadRequest("Ya existe una incidencia abierta de este tipo para este envio en las ultimas 24 horas.");

            var incidencia = new Incidencia(
                paquete.Id,
                paquete.CodigoSeguimiento,
                paquete.SucursalId,
                paquete.RepartidorAsignadoId,
                $"Cliente ({paquete.CodigoSeguimiento})",
                "cliente",
                request.Tipo.Trim(),
                string.IsNullOrWhiteSpace(request.TipoLabel) ? request.Tipo.Trim() : request.TipoLabel.Trim(),
                request.Descripcion.Trim(),
                string.IsNullOrWhiteSpace(request.EmailContacto) ? null : request.EmailContacto.Trim(),
                new[] { paquete.Id });

            await _context.Incidencias.AddAsync(incidencia);
            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("repartidor")]
        public async Task<ActionResult<IncidenciaDto>> CrearRepartidor([FromBody] CrearIncidenciaRepartidorRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Tipo) || string.IsNullOrWhiteSpace(request.Descripcion))
                return BadRequest("El motivo y la descripcion son obligatorios.");

            var user = await CurrentUserAsync();
            if (user is not Repartidor repartidor) return Forbid();

            if (await ExisteDuplicadaAsync(null, request.Tipo, repartidor.Id))
                return BadRequest("Ya existe una incidencia abierta de este tipo reportada recientemente.");

            var paradasIds = request.ParadasAfectadas?.Distinct().ToList() ?? new List<Guid>();
            var paradas = paradasIds.Count == 0
                ? new List<Paquete>()
                : await _context.Paquetes
                    .Where(p => paradasIds.Contains(p.Id) && p.RepartidorAsignadoId == repartidor.Id)
                    .ToListAsync();

            var paquetePrincipal = paradas.FirstOrDefault();
            var incidencia = new Incidencia(
                paquetePrincipal?.Id,
                paquetePrincipal?.CodigoSeguimiento,
                paquetePrincipal?.SucursalId ?? repartidor.SucursalId,
                repartidor.Id,
                $"{repartidor.Nombre} {repartidor.Apellido}",
                "repartidor",
                request.Tipo.Trim(),
                string.IsNullOrWhiteSpace(request.TipoLabel) ? request.Tipo.Trim() : request.TipoLabel.Trim(),
                request.Descripcion.Trim(),
                null,
                paradas.Select(p => p.Id));

            await _context.Incidencias.AddAsync(incidencia);
            await _auditoria.RegistrarAsync(
                TipoAccion.Otro,
                $"Incidencia reportada por repartidor: {incidencia.TipoLabel}",
                incidencia.CodigoSeguimiento,
                $"Incidencia: {incidencia.Id}");
            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpGet]
        public async Task<ActionResult<List<IncidenciaDto>>> Listar()
        {
            var user = await CurrentUserAsync();
            if (user?.SucursalId is null) return Ok(new List<IncidenciaDto>());

            var incidencias = await _context.Incidencias
                .Where(i => i.SucursalId == user.SucursalId)
                .OrderByDescending(i => i.FechaReporte)
                .ToListAsync();

            return Ok(incidencias.Select(ToDto).ToList());
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpPut("{id:guid}/estado")]
        public async Task<ActionResult<IncidenciaDto>> CambiarEstado(Guid id, [FromBody] CambiarEstadoIncidenciaRequest request)
        {
            var incidencia = await GetIncidenciaSupervisorAsync(id);
            if (incidencia is null) return NotFound();
            var supervisor = await CurrentUserAsync();
            if (supervisor is null) return Forbid();

            incidencia.CambiarEstado(request.Estado, supervisor.Id, $"{supervisor.Nombre} {supervisor.Apellido}");
            await _auditoria.RegistrarAsync(
                TipoAccion.Otro,
                $"Cambio de estado de incidencia a {request.Estado}",
                incidencia.CodigoSeguimiento,
                $"Incidencia: {incidencia.Id}");
            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpPost("{id:guid}/observaciones")]
        public async Task<ActionResult<IncidenciaDto>> AgregarObservacion(Guid id, [FromBody] AgregarObservacionIncidenciaRequest request)
        {
            var incidencia = await GetIncidenciaSupervisorAsync(id);
            if (incidencia is null) return NotFound();
            var supervisor = await CurrentUserAsync();
            if (supervisor is null) return Forbid();

            incidencia.AgregarObservacion(request.Texto, supervisor.Id, $"{supervisor.Nombre} {supervisor.Apellido}");
            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpPut("{id:guid}/finalizar-chat")]
        public async Task<ActionResult<IncidenciaDto>> FinalizarChat(Guid id)
        {
            var incidencia = await GetIncidenciaSupervisorAsync(id);
            if (incidencia is null) return NotFound();
            incidencia.FinalizarChat();
            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        private async Task<Incidencia?> GetIncidenciaSupervisorAsync(Guid id)
        {
            var user = await CurrentUserAsync();
            if (user?.SucursalId is null) return null;
            return await _context.Incidencias.FirstOrDefaultAsync(i => i.Id == id && i.SucursalId == user.SucursalId);
        }

        private async Task<Usuario?> CurrentUserAsync()
        {
            var idStr = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(idStr, out var id) ? await _userRepository.GetUsuarioById(id) : null;
        }

        private async Task<bool> ExisteDuplicadaAsync(Guid? paqueteId, string tipo, Guid? repartidorId)
        {
            var cutoff = DateTime.UtcNow.AddHours(-24);
            var query = _context.Incidencias.Where(i =>
                i.Tipo == tipo.Trim()
                && i.Estado != "Resuelta"
                && i.FechaReporte >= cutoff);

            if (paqueteId.HasValue) query = query.Where(i => i.PaqueteId == paqueteId);
            if (repartidorId.HasValue) query = query.Where(i => i.RepartidorId == repartidorId);
            return await query.AnyAsync();
        }

        private static bool PuedeReportarCliente(Paquete paquete)
        {
            return paquete.Status is PaqueteStatus.EnTransito
                or PaqueteStatus.Demorado
                or PaqueteStatus.Entregado
                or PaqueteStatus.Cancelado;
        }

        private static IncidenciaDto ToDto(Incidencia i) => new(
            i.Id,
            i.RepartidorId?.ToString() ?? $"cliente_{i.CodigoSeguimiento}",
            i.RepartidorNombre,
            i.Tipo,
            i.TipoLabel,
            i.Descripcion,
            i.Estado,
            i.FechaReporte,
            i.GetObservaciones(),
            i.GetHistorial(),
            i.GetParadasAfectadas().Select(x => x.ToString()).ToList(),
            i.Origen,
            i.PaqueteId?.ToString(),
            i.CodigoSeguimiento,
            i.EmailContacto,
            i.ChatFinalizado);
    }

    public record CrearIncidenciaPublicaRequest(string TrackingId, string Tipo, string? TipoLabel, string Descripcion, string? EmailContacto);
    public record CrearIncidenciaRepartidorRequest(string Tipo, string? TipoLabel, string Descripcion, List<Guid>? ParadasAfectadas);
    public record CambiarEstadoIncidenciaRequest(string Estado);
    public record AgregarObservacionIncidenciaRequest(string Texto);

    public record IncidenciaDto(
        Guid Id,
        string RepartidorId,
        string RepartidorNombre,
        string Tipo,
        string TipoLabel,
        string Descripcion,
        string Estado,
        DateTime FechaReporte,
        List<ObservacionIncidencia> Observaciones,
        List<HistorialEstadoIncidencia> HistorialEstados,
        List<string> ParadasAfectadas,
        string Origen,
        string? EnvioId,
        string? CodigoSeguimiento,
        string? EmailContacto,
        bool ChatFinalizado);
}
