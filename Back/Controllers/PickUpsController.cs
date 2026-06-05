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
    [Route("api/pickups")]
    public class PickUpsController : ControllerBase
    {
        private readonly LogiTrackDbContext _context;
        private readonly GeocodingService _geocoding;

        public PickUpsController(LogiTrackDbContext context, GeocodingService geocoding)
        {
            _context = context;
            _geocoding = geocoding;
        }

        private Guid? CurrentUserId()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var id) ? id : null;
        }

        private async Task<Usuario?> CurrentUserAsync()
        {
            var userId = CurrentUserId();
            return userId is null ? null : await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == userId.Value);
        }

        [Authorize(Roles = Roles.OperadorOSupervisorOGerenteOAdministrador)]
        [HttpGet]
        public async Task<ActionResult<List<PuntoPickUp>>> Listar([FromQuery] bool soloActivos = true)
        {
            var user = await CurrentUserAsync();
            var query = _context.PuntosPickUp.AsQueryable();
            if (soloActivos) query = query.Where(p => p.Activo);
            if (user is Gerente gerente)
            {
                var provincias = gerente.ProvinciasAsignadas;
                query = query.Where(p => provincias.Contains(p.Provincia));
            }
            else if (user is not Administrador && user?.SucursalId is Guid sucursalId)
            {
                var sucursal = await _context.Sucursales.FirstOrDefaultAsync(s => s.Id == sucursalId);
                if (sucursal is null) return Ok(new List<PuntoPickUp>());
                query = query.Where(p => p.Provincia == sucursal.Provincia || sucursal.ProvinciasCubiertas.Contains(p.Provincia));
            }

            return Ok(await query.OrderBy(p => p.Provincia).ThenBy(p => p.Nombre).ToListAsync());
        }

        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpPost]
        public async Task<ActionResult<PuntoPickUp>> Crear([FromBody] PuntoPickUpRequest request)
        {
            var error = await ValidarProvinciaGerente(request.Provincia);
            if (error is not null) return BadRequest(error);
            error = ValidarDatosBasicos(request);
            if (error is not null) return BadRequest(error);
            try
            {
                var punto = new PuntoPickUp(request.Nombre, request.Direccion, request.Localidad, request.CodigoPostal, request.Provincia, request.Horarios, request.Telefono, request.CapacidadDiaria);
                _context.PuntosPickUp.Add(punto);
                await _context.SaveChangesAsync();
                return Ok(punto);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpPost("geocodificar")]
        public async Task<ActionResult<object>> Geocodificar([FromBody] PuntoPickUpRequest request)
        {
            var error = await ValidarProvinciaGerente(request.Provincia);
            if (error is not null) return BadRequest(error);
            error = ValidarDatosBasicos(request);
            if (error is not null) return BadRequest(error);

            var validacion = await _geocoding.ValidarDireccionExactaAsync(
                request.Direccion,
                request.Localidad,
                request.CodigoPostal,
                request.Provincia);

            if (!validacion.EsValida && validacion.Error?.Contains("pertenece a", StringComparison.OrdinalIgnoreCase) == true)
                return BadRequest(validacion.Error);

            var ubicacion = await _geocoding.GeocodeAsync(
                request.Direccion,
                request.Localidad,
                request.CodigoPostal,
                request.Provincia);

            if (ubicacion is null)
                return BadRequest(validacion.Error ?? "No se pudo ubicar el punto Pick Up.");

            return Ok(new
            {
                latitud = ubicacion.Latitud,
                longitud = ubicacion.Longitud,
                advertencia = validacion.EsValida ? null : "Ubicacion aproximada. Verifica visualmente el punto antes de guardar."
            });
        }

        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<PuntoPickUp>> Actualizar(Guid id, [FromBody] PuntoPickUpRequest request)
        {
            var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == id);
            if (punto is null) return NotFound();
            var error = await ValidarProvinciaGerente(punto.Provincia) ?? await ValidarProvinciaGerente(request.Provincia);
            if (error is not null) return BadRequest(error);
            error = ValidarDatosBasicos(request);
            if (error is not null) return BadRequest(error);
            try
            {
                punto.Actualizar(request.Nombre, request.Direccion, request.Localidad, request.CodigoPostal, request.Provincia, request.Horarios, request.Telefono, request.CapacidadDiaria);
                await _context.SaveChangesAsync();
                return Ok(punto);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpPost("{id:guid}/estado")]
        public async Task<ActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoPickUpRequest request)
        {
            var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == id);
            if (punto is null) return NotFound();
            var error = await ValidarProvinciaGerente(punto.Provincia);
            if (error is not null) return BadRequest(error);
            if (request.Activo) punto.Activar(); else punto.Desactivar();
            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize(Roles = Roles.Supervisor)]
        [HttpPost("{id:guid}/asignar-envio/{paqueteId:guid}")]
        public async Task<ActionResult> AsignarEnvio(Guid id, Guid paqueteId)
        {
            var supervisor = await CurrentUserAsync();
            if (supervisor?.SucursalId is null) return Forbid();
            var paquete = await _context.Paquetes.FirstOrDefaultAsync(p => p.Id == paqueteId && p.SucursalId == supervisor.SucursalId);
            if (paquete is null) return NotFound("Envio no encontrado.");
            var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == id && p.Activo);
            if (punto is null) return NotFound("Punto Pick Up no encontrado.");

            var sucursal = await _context.Sucursales.FirstOrDefaultAsync(s => s.Id == supervisor.SucursalId);
            if (sucursal is null || (punto.Provincia != sucursal.Provincia && !sucursal.ProvinciasCubiertas.Contains(punto.Provincia)))
                return BadRequest("El punto Pick Up no pertenece a la cobertura de la sucursal.");
            var ocupados = await ContarEnviosActivosPickUp(id);
            if (ocupados >= punto.CapacidadDiaria)
                return BadRequest($"El punto Pick Up alcanzo su capacidad diaria ({punto.CapacidadDiaria} envios activos).");

            paquete.AsignarPuntoPickUp(punto.Id);
            await _context.SaveChangesAsync();
            return Ok();
        }

        private async Task<string?> ValidarProvinciaGerente(string provincia)
        {
            if (!User.IsInRole(Roles.Gerente)) return null;
            var user = await CurrentUserAsync();
            if (user is not Gerente gerente) return "Usuario no es Gerente.";
            return gerente.ProvinciasAsignadas.Contains(provincia)
                ? null
                : "No podes gestionar puntos Pick Up fuera de tus provincias asignadas.";
        }

        private static string? ValidarDatosBasicos(PuntoPickUpRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.CodigoPostal) || !System.Text.RegularExpressions.Regex.IsMatch(request.CodigoPostal.Trim(), @"^\d{4}$"))
                return "El codigo postal debe tener 4 digitos.";
            if (string.IsNullOrWhiteSpace(request.Direccion) || !System.Text.RegularExpressions.Regex.IsMatch(request.Direccion.Trim(), @"\d+"))
                return "La direccion debe incluir calle y altura.";
            if (string.IsNullOrWhiteSpace(request.Localidad))
                return "La localidad es obligatoria.";
            if (string.IsNullOrWhiteSpace(request.Provincia))
                return "La provincia es obligatoria.";
            if (request.CapacidadDiaria <= 0)
                return "La capacidad diaria debe ser mayor a 0.";
            return null;
        }

        private async Task<int> ContarEnviosActivosPickUp(Guid puntoPickUpId)
        {
            return await _context.Paquetes.CountAsync(p =>
                p.PuntoPickUpId == puntoPickUpId &&
                p.Status != PaqueteStatus.Entregado &&
                p.Status != PaqueteStatus.Cancelado);
        }
    }

    public class PuntoPickUpRequest
    {
        public string Nombre { get; set; } = string.Empty;
        public string Direccion { get; set; } = string.Empty;
        public string Localidad { get; set; } = string.Empty;
        public string CodigoPostal { get; set; } = string.Empty;
        public string Provincia { get; set; } = string.Empty;
        public string Horarios { get; set; } = string.Empty;
        public int CapacidadDiaria { get; set; } = 100;
        public string? Telefono { get; set; }
    }

    public class CambiarEstadoPickUpRequest
    {
        public bool Activo { get; set; }
    }
}
