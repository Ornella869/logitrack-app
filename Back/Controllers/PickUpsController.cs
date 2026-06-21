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

        [Authorize(Roles = Roles.OperadorOSupervisorOGerenteOAdministrador + "," + Roles.Repartidor + "," + Roles.SocioPickUp)]
        [HttpGet]
        public async Task<ActionResult> Listar([FromQuery] bool soloActivos = true)
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
                if (sucursal is null) return Ok(new List<object>());
                query = query.Where(p => p.Provincia == sucursal.Provincia || sucursal.ProvinciasCubiertas.Contains(p.Provincia));
            }

            var puntos = await query.OrderBy(p => p.Provincia).ThenBy(p => p.Nombre).ToListAsync();
            var puntoIds = puntos.Select(p => p.Id).ToList();

            // G1L-130: contar paquetes físicamente almacenados para mostrar capacidad en la UI
            var ocupados = await _context.Paquetes
                .Where(p => p.PuntoPickUpId.HasValue
                            && puntoIds.Contains(p.PuntoPickUpId.Value)
                            && (p.Status == PaqueteStatus.ListoParaRetirar || p.Status == PaqueteStatus.EntregadoEnPunto))
                .GroupBy(p => p.PuntoPickUpId!.Value)
                .Select(g => new { PuntoId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.PuntoId, x => x.Count);

            // G1L-132 AC3: promedio de calificaciones por punto
            var calificaciones = await _context.CalificacionesPickUp
                .Where(c => puntoIds.Contains(c.PuntoPickUpId))
                .GroupBy(c => c.PuntoPickUpId)
                .Select(g => new { PuntoId = g.Key, Promedio = g.Average(c => (double)c.Estrellas), Total = g.Count() })
                .ToDictionaryAsync(x => x.PuntoId, x => new { x.Promedio, x.Total });

            var result = puntos.Select(p =>
            {
                var ocup = ocupados.TryGetValue(p.Id, out var c) ? c : 0;
                var calif = calificaciones.TryGetValue(p.Id, out var r) ? r : null;
                return new
                {
                    p.Id, p.Nombre, p.Direccion, p.Localidad, p.CodigoPostal, p.Provincia,
                    p.Horarios, p.CapacidadDiaria, p.Telefono, p.Activo, p.CreadoEn,
                    Ocupados = ocup,
                    EstaLleno = ocup >= p.CapacidadDiaria,
                    PromedioCalificaciones = calif != null ? Math.Round(calif.Promedio, 1) : (double?)null,
                    TotalCalificaciones = calif?.Total ?? 0,
                };
            });

            return Ok(result);
        }

        [Authorize]
        [RequirePermission("pickups")]
        [HttpPost]
        public async Task<ActionResult<PuntoPickUp>> Crear([FromBody] PuntoPickUpRequest request)
        {
            var error = await ValidarProvinciaUsuario(request.Provincia);
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

        [Authorize]
        [RequirePermission("pickups")]
        [HttpPost("geocodificar")]
        public async Task<ActionResult<object>> Geocodificar([FromBody] PuntoPickUpRequest request)
        {
            var error = await ValidarProvinciaUsuario(request.Provincia);
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

        [Authorize]
        [RequirePermission("pickups")]
        [HttpPut("{id:guid}")]
        public async Task<ActionResult<PuntoPickUp>> Actualizar(Guid id, [FromBody] PuntoPickUpRequest request)
        {
            var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == id);
            if (punto is null) return NotFound();
            var error = await ValidarProvinciaUsuario(punto.Provincia) ?? await ValidarProvinciaUsuario(request.Provincia);
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

        [Authorize]
        [RequirePermission("pickups")]
        [HttpPost("{id:guid}/estado")]
        public async Task<ActionResult> CambiarEstado(Guid id, [FromBody] CambiarEstadoPickUpRequest request)
        {
            var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == id);
            if (punto is null) return NotFound();
            var error = await ValidarProvinciaUsuario(punto.Provincia);
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

        // Valida que el usuario pueda gestionar puntos Pick Up de esa provincia.
        // Admin: sin restricción. Gerente: sus provincias asignadas.
        // Supervisor/Operador (con permiso 'pickups' concedido por el Admin): la provincia de su sucursal.
        private async Task<string?> ValidarProvinciaUsuario(string provincia)
        {
            var user = await CurrentUserAsync();
            if (user is Administrador) return null;
            if (user is Gerente gerente)
                return gerente.ProvinciasAsignadas.Contains(provincia)
                    ? null
                    : "No podes gestionar puntos Pick Up fuera de tus provincias asignadas.";
            if (user?.SucursalId is Guid sucId)
            {
                var sucursal = await _context.Sucursales.FirstOrDefaultAsync(s => s.Id == sucId);
                if (sucursal is null) return "No se pudo determinar tu sucursal.";
                var cubiertas = new[] { sucursal.Provincia ?? string.Empty }
                    .Concat(sucursal.ProvinciasCubiertas ?? new List<string>());
                return cubiertas.Contains(provincia, StringComparer.OrdinalIgnoreCase)
                    ? null
                    : "No podes gestionar puntos Pick Up fuera de la provincia de tu sucursal.";
            }
            return "No tenés una sucursal asignada para gestionar puntos Pick Up.";
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

        // AC1+AC2+AC4: Calificar experiencia post-retiro (sin autenticación requerida)
        [HttpPost("calificaciones")]
        [AllowAnonymous]
        public async Task<IActionResult> CalificarExperiencia([FromBody] CalificacionPublicaRequest req)
        {
            if (req.Estrellas < 1 || req.Estrellas > 5)
                return BadRequest("Las estrellas deben estar entre 1 y 5.");

            var codigo = req.TrackingCode?.Trim();
            if (string.IsNullOrWhiteSpace(codigo))
                return BadRequest("El código de seguimiento es obligatorio.");

            var paquete = await _context.Paquetes.FirstOrDefaultAsync(p => p.CodigoSeguimiento == codigo);
            if (paquete is null)
                return NotFound("No se encontró ningún envío con ese código.");

            if (paquete.Status != PaqueteStatus.Entregado)
                return BadRequest("Solo podés calificar envíos ya entregados.");

            if (!paquete.PuntoPickUpId.HasValue)
                return BadRequest("Este envío no fue retirado en un Punto Pick Up.");

            var yaCalificado = await _context.CalificacionesPickUp.AnyAsync(c => c.PaqueteId == paquete.Id);
            if (yaCalificado)
                return Conflict("Este envío ya fue calificado.");

            // AC5: ventana de 7 días desde la entrega
            var fechaEntrega = await _context.HistorialEstadosEnvio
                .Where(h => h.PaqueteId == paquete.Id && h.EstadoNuevo == PaqueteStatus.Entregado)
                .MaxAsync(h => (DateTime?)h.FechaHora);
            if (fechaEntrega.HasValue && (DateTime.UtcNow - fechaEntrega.Value).TotalDays > 7)
                return BadRequest("El plazo para calificar venció. Podés calificar hasta 7 días después del retiro.");

            var calificacion = new CalificacionPickUp(
                paquete.PuntoPickUpId.Value,
                paquete.Id,
                req.Estrellas,
                req.Comentario,
                req.AutorNombre);

            _context.CalificacionesPickUp.Add(calificacion);
            await _context.SaveChangesAsync();

            return Ok(new { calificacion.Id, calificacion.Estrellas });
        }

        // AC2: Verificar si un envío ya tiene calificación (para mostrar vista de solo lectura)
        [HttpGet("calificaciones/check")]
        [AllowAnonymous]
        public async Task<IActionResult> CheckCalificacion([FromQuery] string trackingCode)
        {
            var paquete = await _context.Paquetes.FirstOrDefaultAsync(p => p.CodigoSeguimiento == trackingCode.Trim());
            if (paquete is null) return NotFound();

            var existente = await _context.CalificacionesPickUp.FirstOrDefaultAsync(c => c.PaqueteId == paquete.Id);
            if (existente is null)
            {
                // AC5: informar si la ventana de 7 días ya venció
                var fechaEntrega = await _context.HistorialEstadosEnvio
                    .Where(h => h.PaqueteId == paquete.Id && h.EstadoNuevo == PaqueteStatus.Entregado)
                    .MaxAsync(h => (DateTime?)h.FechaHora);
                var ventanaVencida = fechaEntrega.HasValue && (DateTime.UtcNow - fechaEntrega.Value).TotalDays > 7;
                return Ok(new { calificado = false, ventanaVencida });
            }

            return Ok(new
            {
                calificado = true,
                estrellas = existente.Estrellas,
                comentario = existente.Comentario,
                autorNombre = existente.AutorNombre,
                creadoEn = existente.CreadoEn,
            });
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

    public class CalificacionPublicaRequest
    {
        public required string TrackingCode { get; set; }
        public int Estrellas { get; set; }
        public string? Comentario { get; set; }
        public string? AutorNombre { get; set; }
    }
}
