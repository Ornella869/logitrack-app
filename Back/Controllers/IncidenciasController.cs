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
                new[] { paquete.Id },
                request.Severidad);

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
            var paradasEnTransito = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidor.Id &&
                    (p.Status == PaqueteStatus.EnTransito || p.Status == PaqueteStatus.Demorado))
                .ToListAsync();
            if (paradasEnTransito.Count == 0)
                return BadRequest("Solo podés reportar incidencias cuando tenés envíos en tránsito.");

            var paradas = paradasIds.Count == 0
                ? paradasEnTransito.Take(1).ToList()
                : paradasEnTransito.Where(p => paradasIds.Contains(p.Id)).Take(1).ToList();
            if (paradas.Count == 0)
                return BadRequest("La parada afectada ya no se encuentra en tránsito.");

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
                paradas.Select(p => p.Id),
                request.Severidad);

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
                .OrderBy(i => i.Estado == "Resuelta")
                .ThenByDescending(i => i.Severidad == "Alta")
                .ThenByDescending(i => i.Severidad == "Media")
                .ThenBy(i => i.SlaVenceEn)
                .ThenByDescending(i => i.FechaReporte)
                .ToListAsync();

            return Ok(incidencias.Select(ToDto).ToList());
        }

        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("mis-incidencias")]
        public async Task<ActionResult<List<IncidenciaDto>>> MisIncidencias()
        {
            var user = await CurrentUserAsync();
            if (user is null) return Forbid();

            var incidencias = await _context.Incidencias
                .Where(i => i.RepartidorId == user.Id)
                .OrderByDescending(i => i.FechaReporte)
                .ToListAsync();

            return Ok(incidencias.Select(ToDto).ToList());
        }

        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("mensajes/mis-no-leidos")]
        public async Task<ActionResult<int>> MisNoLeidos()
        {
            var user = await CurrentUserAsync();
            if (user is null) return Forbid();

            var count = await _context.MensajesIncidencia
                .Where(m => m.DeRol == "supervisor" && !m.LeidoPorRepartidor &&
                    _context.Incidencias.Any(i => i.Id == m.IncidenciaId && i.RepartidorId == user.Id))
                .CountAsync();

            return Ok(count);
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Repartidor)]
        [HttpGet("{id:guid}/mensajes")]
        public async Task<ActionResult<List<MensajeIncidenciaDto>>> GetMensajes(Guid id)
        {
            var user = await CurrentUserAsync();
            if (user is null) return Forbid();

            var inc = await GetIncidenciaAutorizadaAsync(id, user);
            if (inc is null) return NotFound();

            var mensajes = await _context.MensajesIncidencia
                .Where(m => m.IncidenciaId == id)
                .OrderBy(m => m.Fecha)
                .ToListAsync();

            return Ok(mensajes.Select(ToMensajeDto).ToList());
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Repartidor)]
        [HttpPost("{id:guid}/mensajes")]
        public async Task<ActionResult<MensajeIncidenciaDto>> SendMensaje(Guid id, [FromBody] SendMensajeRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Texto)) return BadRequest("El texto es obligatorio.");

            var user = await CurrentUserAsync();
            if (user is null) return Forbid();

            var inc = await GetIncidenciaAutorizadaAsync(id, user);
            if (inc is null) return NotFound();
            if (inc.ChatFinalizado) return BadRequest("El chat está finalizado.");

            var esSupervisor = User.IsInRole(Roles.Supervisor);
            var rol = esSupervisor ? "supervisor" : "repartidor";
            var nombre = $"{user.Nombre} {user.Apellido}".Trim();

            var mensaje = new MensajeIncidencia(id, user.Id.ToString(), nombre, rol, request.Texto.Trim());
            await _context.MensajesIncidencia.AddAsync(mensaje);
            await _context.SaveChangesAsync();

            return Ok(ToMensajeDto(mensaje));
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Repartidor)]
        [HttpPut("{id:guid}/mensajes/marcar-leido")]
        public async Task<IActionResult> MarcarLeido(Guid id)
        {
            var user = await CurrentUserAsync();
            if (user is null) return Forbid();

            var inc = await GetIncidenciaAutorizadaAsync(id, user);
            if (inc is null) return NotFound();

            var esSupervisor = User.IsInRole(Roles.Supervisor);
            var mensajes = await _context.MensajesIncidencia
                .Where(m => m.IncidenciaId == id)
                .ToListAsync();

            var changed = false;
            foreach (var m in mensajes)
            {
                if (esSupervisor && m.DeRol == "repartidor" && !m.LeidoPorSupervisor)
                { m.LeidoPorSupervisor = true; changed = true; }
                else if (!esSupervisor && m.DeRol == "supervisor" && !m.LeidoPorRepartidor)
                { m.LeidoPorRepartidor = true; changed = true; }
            }

            if (changed) await _context.SaveChangesAsync();
            return Ok();
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
        [HttpPut("{id:guid}/severidad")]
        public async Task<ActionResult<IncidenciaDto>> CambiarSeveridad(Guid id, [FromBody] CambiarSeveridadIncidenciaRequest request)
        {
            var incidencia = await GetIncidenciaSupervisorAsync(id);
            if (incidencia is null) return NotFound();

            incidencia.CambiarSeveridad(request.Severidad);
            await _auditoria.RegistrarAsync(
                TipoAccion.Otro,
                $"Cambio de severidad de incidencia a {incidencia.Severidad}",
                incidencia.CodigoSeguimiento,
                $"Incidencia: {incidencia.Id}");
            await _context.SaveChangesAsync();
            return Ok(ToDto(incidencia));
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.GerenteOAdministrador)]
        [HttpGet("ranking-zonas")]
        public async Task<ActionResult<List<RankingZonaIncidenciaDto>>> RankingZonas([FromQuery] DateTime? desde = null, [FromQuery] DateTime? hasta = null)
        {
            var user = await CurrentUserAsync();
            if (user is null) return Ok(new List<RankingZonaIncidenciaDto>());

            var query = _context.Incidencias.AsQueryable();
            if (desde.HasValue)
            {
                var desdeUtc = DateTime.SpecifyKind(desde.Value.Date, DateTimeKind.Utc);
                query = query.Where(i => i.FechaReporte >= desdeUtc);
            }
            if (hasta.HasValue)
            {
                var hastaUtc = DateTime.SpecifyKind(hasta.Value.Date.AddDays(1), DateTimeKind.Utc);
                query = query.Where(i => i.FechaReporte < hastaUtc);
            }
            if (User.IsInRole(Roles.Supervisor))
            {
                if (user.SucursalId is null) return Ok(new List<RankingZonaIncidenciaDto>());
                query = query.Where(i => i.SucursalId == user.SucursalId);
            }

            var incidencias = await query.ToListAsync();

            var paqueteIds = incidencias
                .SelectMany(i => i.PaqueteId.HasValue
                    ? new List<Guid> { i.PaqueteId.Value }
                    : i.GetParadasAfectadas())
                .Distinct()
                .ToList();

            var paquetes = await _context.Paquetes
                .Where(p => paqueteIds.Contains(p.Id))
                .ToDictionaryAsync(p => p.Id);

            var data = incidencias
                .Select(i =>
                {
                    Paquete? paquete = null;
                    if (i.PaqueteId.HasValue)
                        paquetes.TryGetValue(i.PaqueteId.Value, out paquete);
                    paquete ??= i.GetParadasAfectadas()
                        .Select(id => paquetes.TryGetValue(id, out var p) ? p : null)
                        .FirstOrDefault(p => p is not null);
                    return new { Incidencia = i, Paquete = paquete };
                })
                .Where(x => x.Paquete is not null)
                .ToList();

            if (User.IsInRole(Roles.Gerente))
            {
                var provincias = (user as Gerente)?.ProvinciasAsignadas ?? Array.Empty<string>();
                data = data
                    .Where(x =>
                    {
                        var provincia = x.Paquete!.ProvinciaDestino ?? x.Paquete.Destinatario.Direccion.Provincia;
                        return provincias.Any(p => string.Equals(p, provincia, StringComparison.OrdinalIgnoreCase));
                    })
                    .ToList();
            }

            var ranking = data
                .GroupBy(x => new
                {
                    Provincia = x.Paquete!.ProvinciaDestino ?? x.Paquete.Destinatario.Direccion.Provincia ?? "Sin provincia",
                    Localidad = x.Paquete.Destinatario.Direccion.Ciudad,
                })
                .Select(g => new RankingZonaIncidenciaDto(
                    g.Key.Provincia,
                    g.Key.Localidad,
                    g.Count(),
                    g.Count(x => x.Incidencia.Severidad == "Alta"),
                    g.Count(x => x.Incidencia.Estado != "Resuelta" && x.Incidencia.SlaVenceEn < DateTime.UtcNow),
                    g.GroupBy(x => x.Incidencia.Severidad).OrderByDescending(sg => sg.Count()).ThenBy(sg => sg.Key).First().Key,
                    g.GroupBy(x => x.Incidencia.TipoLabel).OrderByDescending(tg => tg.Count()).ThenBy(tg => tg.Key).First().Key))
                .OrderByDescending(x => x.Total)
                .ThenByDescending(x => x.Altas)
                .Take(10)
                .ToList();

            return Ok(ranking);
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

        private async Task<Incidencia?> GetIncidenciaAutorizadaAsync(Guid id, Usuario user)
        {
            if (User.IsInRole(Roles.Supervisor))
                return await _context.Incidencias.FirstOrDefaultAsync(i => i.Id == id && i.SucursalId == user.SucursalId);
            return await _context.Incidencias.FirstOrDefaultAsync(i => i.Id == id && i.RepartidorId == user.Id);
        }

        private static MensajeIncidenciaDto ToMensajeDto(MensajeIncidencia m) => new(
            m.Id.ToString(),
            m.IncidenciaId.ToString(),
            m.De,
            m.DeNombre,
            m.DeRol,
            m.Texto,
            m.Fecha,
            m.LeidoPorRepartidor,
            m.LeidoPorSupervisor);

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
            i.ChatFinalizado,
            i.SucursalId?.ToString(),
            i.Severidad,
            i.SlaVenceEn,
            i.Estado != "Resuelta" && i.SlaVenceEn.HasValue && i.SlaVenceEn.Value < DateTime.UtcNow,
            i.ResueltaEn,
            i.SlaVenceEn.HasValue && i.ResueltaEn.HasValue && i.ResueltaEn.Value > i.SlaVenceEn.Value,
            i.ResueltaEn.HasValue ? (int)Math.Round((i.ResueltaEn.Value - i.FechaReporte).TotalMinutes) : null);
    }

    public record CrearIncidenciaPublicaRequest(string TrackingId, string Tipo, string? TipoLabel, string Descripcion, string? EmailContacto, string? Severidad);
    public record CrearIncidenciaRepartidorRequest(string Tipo, string? TipoLabel, string Descripcion, List<Guid>? ParadasAfectadas, string? Severidad);
    public record CambiarEstadoIncidenciaRequest(string Estado);
    public record CambiarSeveridadIncidenciaRequest(string Severidad);
    public record AgregarObservacionIncidenciaRequest(string Texto);
    public record SendMensajeRequest(string Texto);

    public record MensajeIncidenciaDto(
        string Id,
        string IncidenciaId,
        string De,
        string DeNombre,
        string DeRol,
        string Texto,
        DateTime Fecha,
        bool LeidoPorRepartidor,
        bool LeidoPorSupervisor);

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
        bool ChatFinalizado,
        string? SucursalId,
        string Severidad,
        DateTime? SlaVenceEn,
        bool SlaVencido,
        DateTime? ResueltaEn,
        bool SlaResueltoFueraDePlazo,
        int? MinutosResolucion);

    public record RankingZonaIncidenciaDto(string Provincia, string Localidad, int Total, int Altas, int Vencidas, string SeveridadPredominante, string TipoPredominante);
}
