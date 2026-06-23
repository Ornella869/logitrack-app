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

        private static List<string> NormalizarProvincias(IEnumerable<string> provincias)
        {
            return provincias
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p.Trim().ToLower())
                .Distinct()
                .ToList();
        }

        // ── Admin: gestión de sucursales habilitadas por gerente ──────────────

        /// <summary>Lista las sucursales habilitadas para un Gerente específico (con datos).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("{gerenteId:guid}/sucursales")]
        public async Task<ActionResult<List<SucursalGerenteResponse>>> GetSucursalesDeGerente(Guid gerenteId)
        {
            var usuario = await _userRepository.GetUsuarioById(gerenteId);
            if (usuario is not (Gerente or SocioPickUp)) return NotFound("Usuario no encontrado o sin alcance por sucursal.");

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
            var usuario = await _userRepository.GetUsuarioById(gerenteId);
            if (usuario is not (Gerente or SocioPickUp)) return NotFound("Usuario no encontrado o sin alcance por sucursal.");

            // Provincias válidas para este usuario (gerente → asignadas; socio → la de su punto Pick Up).
            var provinciasValidas = usuario is Gerente g ? g.ProvinciasAsignadas.ToList() : new List<string>();
            if (usuario is SocioPickUp)
            {
                var prov = await ProvinciaSocioAsync(usuario);
                if (!string.IsNullOrWhiteSpace(prov)) provinciasValidas.Add(prov!);
            }

            if (request.SucursalIds.Any())
            {
                var sucursales = await _context.Sucursales
                    .Where(s => request.SucursalIds.Contains(s.Id))
                    .ToListAsync();

                var faltantes = request.SucursalIds.Except(sucursales.Select(s => s.Id)).ToList();
                if (faltantes.Any())
                    return BadRequest("Una o más sucursales seleccionadas no existen.");

                var fuera = sucursales
                    .Where(s => !provinciasValidas.Contains(s.Provincia ?? string.Empty, StringComparer.OrdinalIgnoreCase))
                    .Select(s => s.Nombre)
                    .ToList();

                if (fuera.Any())
                    return BadRequest($"Las siguientes sucursales no pertenecen a la provincia del usuario: {string.Join(", ", fuera)}.");
            }

            await _gerenteSucursalRepo.AssignSucursales(gerenteId, request.SucursalIds);

            // Si la sucursal activa ya no está habilitada, limpiarla.
            if (usuario is Gerente ger && ger.SucursalActivaId.HasValue && !request.SucursalIds.Contains(ger.SucursalActivaId.Value))
                ger.SetSucursalActiva(null);
            if (usuario is SocioPickUp soc && soc.SucursalId.HasValue && request.SucursalIds.Any() && !request.SucursalIds.Contains(soc.SucursalId.Value))
                soc.AsignarSucursal(null);

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ── Gerente: gestión de su propia sucursal activa ────────────────────

        /// <summary>Devuelve la sucursal activa del Gerente autenticado (para operar como Operador/Supervisor).</summary>
        // Provincia operable del Socio PickUp (la de su punto). El Socio opera como un "gerente" de esa provincia.
        private async Task<string?> ProvinciaSocioAsync(Usuario u)
        {
            if (u is SocioPickUp s && s.PuntoPickUpId is Guid pid)
                return (await _context.PuntosPickUp.FindAsync(pid))?.Provincia;
            return null;
        }

        [Authorize]
        [HttpGet("me/sucursal-activa")]
        public async Task<ActionResult<SucursalActivaResponse>> GetSucursalActiva()
        {
            var uid = CurrentUserId();
            if (uid is null) return Forbid();
            var usuario = await _userRepository.GetUsuarioById(uid.Value);

            if (usuario is Gerente gerente)
            {
                if (gerente.SucursalActivaId is null)
                    return Ok(new SucursalActivaResponse(null, null, null));

                var sucursal = await _context.Sucursales.FindAsync(gerente.SucursalActivaId.Value);
                var provinciasAsignadas = NormalizarProvincias(gerente.ProvinciasAsignadas);
                if (sucursal == null || string.IsNullOrWhiteSpace(sucursal.Provincia)
                    || !provinciasAsignadas.Contains(sucursal.Provincia.Trim().ToLower()))
                {
                    gerente.SetSucursalActiva(null);
                    await _context.SaveChangesAsync();
                    return Ok(new SucursalActivaResponse(null, null, null));
                }
                return Ok(new SucursalActivaResponse(sucursal.Id, sucursal.Nombre, sucursal.Provincia));
            }

            // Socio PickUp: la "sucursal activa" se guarda en su SucursalId (lo que resuelve el scope en los controllers).
            if (usuario is SocioPickUp)
            {
                if (usuario.SucursalId is null) return Ok(new SucursalActivaResponse(null, null, null));
                var suc = await _context.Sucursales.FindAsync(usuario.SucursalId.Value);
                return suc is null
                    ? Ok(new SucursalActivaResponse(null, null, null))
                    : Ok(new SucursalActivaResponse(suc.Id, suc.Nombre, suc.Provincia));
            }

            return Ok(new SucursalActivaResponse(null, null, null));
        }

        /// <summary>Lista las sucursales habilitadas para el Gerente autenticado.</summary>
        [Authorize]
        [HttpGet("me/sucursales-habilitadas")]
        public async Task<ActionResult<List<SucursalGerenteResponse>>> GetSucursalesHabilitadas()
        {
            var uid = CurrentUserId();
            if (uid is null) return Forbid();
            var usuario = await _userRepository.GetUsuarioById(uid.Value);

            if (usuario is Gerente gerente)
            {
                var provinciasAsignadas = NormalizarProvincias(gerente.ProvinciasAsignadas);
                var sucursales = await _context.Sucursales
                    .Where(s => s.Provincia != null
                        && provinciasAsignadas.Contains(s.Provincia.Trim().ToLower()))
                    .Select(s => new SucursalGerenteResponse(s.Id, s.Nombre, s.Provincia))
                    .ToListAsync();
                return Ok(sucursales);
            }

            // Socio PickUp: por defecto (por rol) todas las sucursales de la provincia de su punto;
            // si el Admin le definió un subconjunto explícito (por usuario), se respeta ese subconjunto.
            if (usuario is SocioPickUp)
            {
                var provincia = await ProvinciaSocioAsync(usuario);
                if (string.IsNullOrWhiteSpace(provincia)) return Ok(new List<SucursalGerenteResponse>());
                var explicitos = await _gerenteSucursalRepo.GetSucursalesByGerente(usuario.Id);
                var query = _context.Sucursales.Where(s => s.Provincia == provincia);
                if (explicitos.Count > 0) query = query.Where(s => explicitos.Contains(s.Id));
                return Ok(await query
                    .Select(s => new SucursalGerenteResponse(s.Id, s.Nombre, s.Provincia))
                    .ToListAsync());
            }

            return Ok(new List<SucursalGerenteResponse>());
        }

        /// <summary>Establece la sucursal activa del Gerente autenticado.</summary>
        [Authorize]
        [HttpPut("me/sucursal-activa")]
        public async Task<ActionResult> SetSucursalActiva([FromBody] SetSucursalActivaRequest request)
        {
            var uid = CurrentUserId();
            if (uid is null) return Forbid();
            var usuario = await _userRepository.GetUsuarioById(uid.Value);

            if (usuario is Gerente gerente)
            {
                if (request.SucursalId.HasValue)
                {
                    var sucursal = await _context.Sucursales.FindAsync(request.SucursalId.Value);
                    var provinciasAsignadas = NormalizarProvincias(gerente.ProvinciasAsignadas);
                    if (sucursal is null || string.IsNullOrWhiteSpace(sucursal.Provincia)
                        || !provinciasAsignadas.Contains(sucursal.Provincia.Trim().ToLower()))
                        return BadRequest("Esa sucursal no pertenece a la provincia del gerente.");
                }
                gerente.SetSucursalActiva(request.SucursalId);
                await _context.SaveChangesAsync();
                return NoContent();
            }

            // Socio PickUp: la sucursal activa se guarda en su SucursalId (validada contra su provincia/subconjunto).
            if (usuario is SocioPickUp socio)
            {
                if (request.SucursalId.HasValue)
                {
                    var provincia = await ProvinciaSocioAsync(socio);
                    var sucursal = await _context.Sucursales.FindAsync(request.SucursalId.Value);
                    if (sucursal is null || !string.Equals(sucursal.Provincia, provincia, StringComparison.OrdinalIgnoreCase))
                        return BadRequest("Esa sucursal no pertenece a la provincia de tu punto Pick Up.");
                    var explicitos = await _gerenteSucursalRepo.GetSucursalesByGerente(socio.Id);
                    if (explicitos.Count > 0 && !explicitos.Contains(request.SucursalId.Value))
                        return BadRequest("Esa sucursal no está habilitada para tu usuario.");
                }
                socio.AsignarSucursal(request.SucursalId);
                await _context.SaveChangesAsync();
                return NoContent();
            }

            return Forbid();
        }
    }

    public record SucursalGerenteResponse(Guid Id, string Nombre, string? Provincia);
    public record SucursalActivaResponse(Guid? Id, string? Nombre, string? Provincia);
    public record SetSucursalesRequest(List<Guid> SucursalIds);
    public record SetSucursalActivaRequest(Guid? SucursalId);
}
