using Back.Application.Common;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/gerentes")]
    public class GerenteSucursalesController : ControllerBase
    {
        private readonly IGerenteSucursalRepository _gerenteSucursalRepo;
        private readonly IUserRepository _userRepository;
        private readonly LogiTrackDbContext _context;

        public GerenteSucursalesController(
            IGerenteSucursalRepository gerenteSucursalRepo,
            IUserRepository userRepository,
            LogiTrackDbContext context)
        {
            _gerenteSucursalRepo = gerenteSucursalRepo;
            _userRepository = userRepository;
            _context = context;
        }

        private Guid? CurrentUserId()
        {
            var s = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(s, out var id) ? id : null;
        }

        // ── Admin: gestión de sucursales habilitadas por gerente ──────────────

        /// <summary>Lista las sucursales habilitadas para un Gerente específico (con datos).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("{gerenteId:guid}/sucursales")]
        public async Task<ActionResult<List<SucursalGerenteResponse>>> GetSucursalesDeGerente(Guid gerenteId)
        {
            var gerente = await _userRepository.GetUsuarioById(gerenteId) as Gerente;
            if (gerente == null) return NotFound("Gerente no encontrado.");

            var ids = await _gerenteSucursalRepo.GetSucursalesByGerente(gerenteId);
            var sucursales = await _context.Sucursales
                .Where(s => ids.Contains(s.Id))
                .Select(s => new SucursalGerenteResponse(s.Id, s.Nombre, s.Provincia))
                .ToListAsync();

            return Ok(sucursales);
        }

        /// <summary>Reemplaza el listado de sucursales habilitadas para un Gerente.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPut("{gerenteId:guid}/sucursales")]
        public async Task<ActionResult> SetSucursalesDeGerente(Guid gerenteId, [FromBody] SetSucursalesRequest request)
        {
            var gerente = await _userRepository.GetUsuarioById(gerenteId) as Gerente;
            if (gerente == null) return NotFound("Gerente no encontrado.");

            // Validar que todas las sucursales pertenezcan a la provincia del gerente
            if (request.SucursalIds.Any())
            {
                var sucursales = await _context.Sucursales
                    .Where(s => request.SucursalIds.Contains(s.Id))
                    .ToListAsync();

                var faltantes = request.SucursalIds.Except(sucursales.Select(s => s.Id)).ToList();
                if (faltantes.Any())
                    return BadRequest("Una o más sucursales seleccionadas no existen.");

                var fuera = sucursales
                    .Where(s => !gerente.ProvinciasAsignadas.Contains(s.Provincia ?? string.Empty, StringComparer.OrdinalIgnoreCase))
                    .Select(s => s.Nombre)
                    .ToList();

                if (fuera.Any())
                    return BadRequest($"Las siguientes sucursales no pertenecen a la provincia del gerente: {string.Join(", ", fuera)}.");
            }

            await _gerenteSucursalRepo.AssignSucursales(gerenteId, request.SucursalIds);

            // Si la sucursal activa ya no está en la lista, limpiarla
            if (gerente.SucursalActivaId.HasValue && !request.SucursalIds.Contains(gerente.SucursalActivaId.Value))
            {
                gerente.SetSucursalActiva(null);
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── Gerente: gestión de su propia sucursal activa ────────────────────

        /// <summary>Devuelve la sucursal activa del Gerente autenticado (para operar como Operador/Supervisor).</summary>
        [Authorize(Roles = Roles.Gerente)]
        [HttpGet("me/sucursal-activa")]
        public async Task<ActionResult<SucursalActivaResponse>> GetSucursalActiva()
        {
            var uid = CurrentUserId();
            if (uid is null) return Forbid();

            var gerente = await _userRepository.GetUsuarioById(uid.Value) as Gerente;
            if (gerente == null) return Forbid();

            if (gerente.SucursalActivaId is null)
                return Ok(new SucursalActivaResponse(null, null, null));

            var sucursal = await _context.Sucursales.FindAsync(gerente.SucursalActivaId.Value);
            var habilitadas = await _gerenteSucursalRepo.GetSucursalesByGerente(gerente.Id);
            if (sucursal == null || !habilitadas.Contains(sucursal.Id) ||
                !gerente.ProvinciasAsignadas.Contains(sucursal.Provincia ?? string.Empty, StringComparer.OrdinalIgnoreCase))
            {
                gerente.SetSucursalActiva(null);
                await _context.SaveChangesAsync();
                return Ok(new SucursalActivaResponse(null, null, null));
            }

            return Ok(new SucursalActivaResponse(sucursal.Id, sucursal.Nombre, sucursal.Provincia));
        }

        /// <summary>Lista las sucursales habilitadas para el Gerente autenticado.</summary>
        [Authorize(Roles = Roles.Gerente)]
        [HttpGet("me/sucursales-habilitadas")]
        public async Task<ActionResult<List<SucursalGerenteResponse>>> GetSucursalesHabilitadas()
        {
            var uid = CurrentUserId();
            if (uid is null) return Forbid();

            var gerente = await _userRepository.GetUsuarioById(uid.Value) as Gerente;
            if (gerente == null) return Forbid();

            var ids = await _gerenteSucursalRepo.GetSucursalesByGerente(gerente.Id);
            var sucursales = await _context.Sucursales
                .Where(s => ids.Contains(s.Id)
                    && gerente.ProvinciasAsignadas.Contains(s.Provincia ?? string.Empty))
                .Select(s => new SucursalGerenteResponse(s.Id, s.Nombre, s.Provincia))
                .ToListAsync();

            return Ok(sucursales);
        }

        /// <summary>Establece la sucursal activa del Gerente autenticado.</summary>
        [Authorize(Roles = Roles.Gerente)]
        [HttpPut("me/sucursal-activa")]
        public async Task<ActionResult> SetSucursalActiva([FromBody] SetSucursalActivaRequest request)
        {
            var uid = CurrentUserId();
            if (uid is null) return Forbid();

            var gerente = await _userRepository.GetUsuarioById(uid.Value) as Gerente;
            if (gerente == null) return Forbid();

            if (request.SucursalId.HasValue)
            {
                var habilitadas = await _gerenteSucursalRepo.GetSucursalesByGerente(gerente.Id);
                if (!habilitadas.Contains(request.SucursalId.Value))
                    return BadRequest("Esa sucursal no está habilitada para tu usuario.");

                var sucursal = await _context.Sucursales.FindAsync(request.SucursalId.Value);
                if (sucursal is null || !gerente.ProvinciasAsignadas.Contains(sucursal.Provincia ?? string.Empty, StringComparer.OrdinalIgnoreCase))
                    return BadRequest("Esa sucursal no pertenece a la provincia del gerente.");
            }

            gerente.SetSucursalActiva(request.SucursalId);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }

    public record SucursalGerenteResponse(Guid Id, string Nombre, string? Provincia);
    public record SucursalActivaResponse(Guid? Id, string? Nombre, string? Provincia);
    public record SetSucursalesRequest(List<Guid> SucursalIds);
    public record SetSucursalActivaRequest(Guid? SucursalId);
}
