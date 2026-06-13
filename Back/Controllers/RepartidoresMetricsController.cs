using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/repartidores")]
    public class RepartidoresMetricsController : ControllerBase
    {
        private readonly RepartidoresMetricsService _service;
        private readonly IUserRepository _userRepository;
        private readonly LogiTrackDbContext _context;

        public RepartidoresMetricsController(RepartidoresMetricsService service, IUserRepository userRepository, LogiTrackDbContext context)
        {
            _service = service;
            _userRepository = userRepository;
            _context = context;
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            if (User.IsInRole(Roles.Administrador)) return null;
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(userIdStr, out var userId)) return null;
            return (await _userRepository.GetUsuarioById(userId))?.SucursalId;
        }

        /// <summary>G1L-20: Perfil de rendimiento de un repartidor en un período.</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpGet("{repartidorId:guid}/rendimiento")]
        public async Task<ActionResult<RendimientoRepartidor>> GetRendimiento(
            Guid repartidorId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
        {
            try
            {
                var r = await _service.GetRendimientoAsync(repartidorId, from, to, await CurrentSucursalScopeAsync());
                return Ok(r);
            }
            catch (InvalidOperationException ex)
            {
                return NotFound(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpGet("{repartidorId:guid}/jornada-historial")]
        public async Task<ActionResult<List<JornadaLaboralHistorialResponse>>> GetHistorialJornada(Guid repartidorId)
        {
            var repartidor = await _userRepository.GetUsuarioById(repartidorId) as Repartidor;
            if (repartidor is null) return NotFound("Repartidor no encontrado.");

            var sucursalScope = await CurrentSucursalScopeAsync();
            if (sucursalScope.HasValue && repartidor.SucursalId != sucursalScope.Value) return Forbid();

            var logs = await _context.LogsAuditoria
                .Where(l => l.Accion == TipoAccion.JornadaLaboral && l.RecursoId == repartidorId.ToString())
                .OrderByDescending(l => l.Timestamp)
                .ToListAsync();

            return Ok(logs.Select(MapHistorialJornada).ToList());
        }

        private static JornadaLaboralHistorialResponse MapHistorialJornada(LogAuditoria log)
        {
            int? valorAnterior = null;
            int? valorNuevo = null;
            var motivo = log.Descripcion;

            if (!string.IsNullOrWhiteSpace(log.Contexto))
            {
                try
                {
                    using var doc = JsonDocument.Parse(log.Contexto);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("ValorAnterior", out var anterior) && anterior.ValueKind == JsonValueKind.Number)
                        valorAnterior = anterior.GetInt32();
                    if (root.TryGetProperty("ValorNuevo", out var nuevo) && nuevo.ValueKind == JsonValueKind.Number)
                        valorNuevo = nuevo.GetInt32();
                    if (root.TryGetProperty("Motivo", out var motivoJson) && motivoJson.ValueKind == JsonValueKind.String)
                        motivo = motivoJson.GetString() ?? motivo;
                }
                catch (JsonException)
                {
                    // Si el contexto histórico no es JSON, se conserva la descripción original.
                }
            }

            return new JornadaLaboralHistorialResponse
            {
                Id = log.Id,
                Timestamp = log.Timestamp,
                UsuarioNombre = log.UsuarioNombre,
                UsuarioRol = log.UsuarioRol,
                ValorAnterior = valorAnterior,
                ValorNuevo = valorNuevo,
                Motivo = motivo,
            };
        }
    }

    public class JornadaLaboralHistorialResponse
    {
        public Guid Id { get; set; }
        public DateTime Timestamp { get; set; }
        public string UsuarioNombre { get; set; } = string.Empty;
        public string UsuarioRol { get; set; } = string.Empty;
        public int? ValorAnterior { get; set; }
        public int? ValorNuevo { get; set; }
        public string Motivo { get; set; } = string.Empty;
    }
}
