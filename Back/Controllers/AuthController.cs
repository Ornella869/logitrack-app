
using System.ComponentModel.DataAnnotations;
using Back.Application.Abstractions;
using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Microsoft.EntityFrameworkCore;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using static Back.Domain.Models.Repartidor;


namespace Back.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {

        private readonly AuthService _authService;
        private readonly IUserRepository _userRepository;
        private readonly IEnviosRepository _enviosRepository;
        private readonly LogiTrackDbContext _context;
        private readonly IRecaptchaValidationService _recaptchaValidationService;
        private readonly AuditoriaService _auditoria;

        public AuthController(
            AuthService authService,
            IUserRepository userRepository,
            IEnviosRepository enviosRepository,
            LogiTrackDbContext context,
            IRecaptchaValidationService recaptchaValidationService,
            AuditoriaService auditoria)
        {
            _authService = authService;
            _userRepository = userRepository;
            _enviosRepository = enviosRepository;
            _context = context;
            _recaptchaValidationService = recaptchaValidationService;
            _auditoria = auditoria;
        }

        private Guid? CurrentUserId()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var id) ? id : null;
        }

        private async Task<Usuario?> CurrentUserAsync()
        {
            var userId = CurrentUserId();
            return userId is null ? null : await _userRepository.GetUsuarioById(userId.Value);
        }

        private async Task<ActionResult?> ValidarRepartidorEnSucursalDelSupervisor(Guid repartidorId)
        {
            if (!User.IsInRole(Roles.Supervisor)) return null;
            var supervisor = await CurrentUserAsync();
            if (supervisor?.SucursalId is null) return null;
            var repartidor = await _userRepository.GetUsuarioById(repartidorId) as Repartidor;
            if (repartidor is null) return NotFound("Repartidor no encontrado.");
            return repartidor.SucursalId == supervisor.SucursalId ? null : Forbid();
        }

        /// <summary>Login con email + contraseña + reCAPTCHA. Devuelve JWT.</summary>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            // Captcha temporalmente deshabilitado para testing
            // var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            // var captchaIsValid = await _recaptchaValidationService.ValidateAsync(
            //     request.RecaptchaToken,
            //     remoteIp,
            //     HttpContext.RequestAborted);
            //
            // if (!captchaIsValid)
            // {
            //     return BadRequest("Captcha inválido o vencido. Reintentá nuevamente.");
            // }

            try
            {
                var result = await _authService.Login(request);
                await _context.SaveChangesAsync();
                return Ok(result);
            }
            catch (LoginLockoutException ex)
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                if (ex.JustLocked)
                {
                    await _auditoria.RegistrarAsync(
                        null,
                        request.Email,
                        "Anónimo",
                        TipoAccion.BloqueoLogin,
                        "Cuenta bloqueada por intentos fallidos",
                        request.Email,
                        $"IP origen: {ip ?? "desconocida"}; Bloqueo hasta: {ex.LockoutUntilUtc:O}");
                }
                await _context.SaveChangesAsync();
                return Unauthorized(ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                await _auditoria.RegistrarAsync(
                    null,
                    request.Email,
                    "Anónimo",
                    TipoAccion.LoginFallido,
                    "Intento de inicio de sesión fallido",
                    request.Email,
                    $"IP origen: {ip ?? "desconocida"}");
                await _context.SaveChangesAsync();
                return Unauthorized(ex.Message);
            }
        }

        /// <summary>Registro publico deshabilitado. El alta se gestiona por el equipo comercial y administradores.</summary>
        [ProducesResponseType(StatusCodes.Status403Forbidden)]
        [HttpPost("registrarse")]
        public ActionResult Registrarse([FromBody] RegisterRequest request)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                "El registro publico esta deshabilitado. Solicita el alta al equipo comercial.");
        }

        /// <summary>Usuario logueado cambia su propia contraseña (G1L-47).</summary>
        [Authorize]
        [HttpPost("cambiar-password")]
        public async Task<ActionResult> CambiarPassword([FromBody] CambiarPasswordRequest request)
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userIdStr is null) return Unauthorized();

            try
            {
                await _authService.CambiarPasswordPropia(Guid.Parse(userIdStr), request.PasswordActual, request.PasswordNueva, request.PasswordConfirmacion);
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Listado de repartidores (Admin / Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador)]
        [HttpGet("repartidores")]
        public async Task<ActionResult<PagedResponse<RepartidorListadoResponse>>> GetRepartidores(
            [FromQuery] string? search,
            [FromQuery] string? accountStatus,
            [FromQuery] string? routeStatus,
            [FromQuery] int? page,
            [FromQuery] int? pageSize)
        {
            var normalizedPage = PaginationDefaults.NormalizePage(page);
            var normalizedPageSize = PaginationDefaults.NormalizePageSize(pageSize);

            var currentUser = await CurrentUserAsync();
            var sucursalScope = User.IsInRole(Roles.Administrador) ? null : currentUser?.SucursalId;
            var repartidores = (await _userRepository.GetRepartidores())
                .Where(r => sucursalScope == null || r.SucursalId == sucursalScope)
                .ToList();
            var asignados = (await _enviosRepository.GetPaquetesConAsignacionActiva())
                .Where(p => sucursalScope == null || p.SucursalId == sucursalScope)
                .ToList();
            var paquetesActivosPorRepartidor = asignados
                .GroupBy(p => p.RepartidorAsignadoId!.Value)
                .ToDictionary(g => g.Key, g => g.ToList());
            var hoy = OperationalClock.TodayUtcDate;

            var query = repartidores.Select(t =>
            {
                paquetesActivosPorRepartidor.TryGetValue(t.Id, out var paquetesActivos);
                paquetesActivos ??= new List<Paquete>();

                // El card de repartidores debe reflejar la ruta operativa vigente:
                // hoy o una ruta multi-dia que sigue activa desde un dia anterior.
                // Las asignaciones futuras se gestionan desde calendarizacion/calendario,
                // pero no deben hacer que el repartidor aparezca como "Con ruta asignada"
                // despues de haber cerrado la jornada actual.
                var paquetesOperativos = paquetesActivos
                    .Where(p => p.FechaCalendarizada.HasValue
                        && (p.FechaCalendarizada.Value.Date == hoy
                            || (p.FechaCalendarizada.Value.Date < hoy
                                && (p.Status == PaqueteStatus.EnTransito
                                    || p.Status == PaqueteStatus.EnTransitoDescanso
                                    || p.Status == PaqueteStatus.Demorado))))
                    .ToList();

                var assignedRoutesCount = paquetesOperativos
                    .Where(p => p.FechaCalendarizada.HasValue)
                    .Select(p => p.FechaCalendarizada!.Value.Date)
                    .Distinct()
                    .Count();

                var routeStatusKey = paquetesOperativos.Any(p => p.Status == PaqueteStatus.EnTransito
                        || p.Status == PaqueteStatus.EnTransitoDescanso
                        || p.Status == PaqueteStatus.Demorado)
                    ? "en-viaje"
                    : paquetesOperativos.Any(p => p.Status == PaqueteStatus.AsignadoAVehiculo
                        || p.Status == PaqueteStatus.CargadoEnVehiculo
                        || p.Status == PaqueteStatus.ListoParaSalir)
                        ? "con-ruta-asignada"
                        : "sin-asignacion";

                var routeStatusLabel = routeStatusKey switch
                {
                    "en-viaje" => "En viaje",
                    "con-ruta-asignada" => "Con ruta asignada",
                    "sin-asignacion" => "Sin asignacion",
                    _ => "Sin asignacion"
                };

                return new RepartidorListadoResponse
                {
                    Id = t.Id.ToString(),
                    Nombre = t.Nombre,
                    Apellido = t.Apellido,
                    Email = t.Email,
                    DNI = t.DNI,
                    Activo = t.Activo,
                    Role = Roles.Repartidor,
                    Licencia = t.Licencia,
                    Estado = t.EstadoLabel,
                    AssignedRoutesCount = assignedRoutesCount,
                    RouteStatusKey = routeStatusKey,
                    RouteStatusLabel = routeStatusLabel,
                    HorasTrabajo = t.HorasTrabajo,
                    TipoJornada = t.TipoJornada,
                    FotoPerfil = t.FotoPerfil,
                };
            });

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLowerInvariant();
                query = query.Where(r =>
                    $"{r.Nombre} {r.Apellido}".ToLowerInvariant().Contains(s)
                    || r.Email.ToLowerInvariant().Contains(s)
                    || r.DNI.Contains(s)
                    || (r.Licencia ?? string.Empty).ToLowerInvariant().Contains(s));
            }

            if (!string.IsNullOrWhiteSpace(accountStatus))
            {
                var normalized = accountStatus.Trim().ToLowerInvariant();
                query = normalized switch
                {
                    "activo" => query.Where(r => r.Activo),
                    "inactivo" => query.Where(r => !r.Activo),
                    _ => query,
                };
            }

            if (!string.IsNullOrWhiteSpace(routeStatus))
            {
                var normalized = routeStatus.Trim().ToLowerInvariant();
                query = query.Where(r => r.RouteStatusKey == normalized);
            }

            var filtered = query
                .OrderBy(r => r.Nombre)
                .ThenBy(r => r.Apellido)
                .ToList();

            var totalItems = filtered.Count;
            var items = filtered
                .Skip((normalizedPage - 1) * normalizedPageSize)
                .Take(normalizedPageSize)
                .ToList();

            return Ok(PagedResponse<RepartidorListadoResponse>.Create(items, normalizedPage, normalizedPageSize, totalItems));
        }

        /// <summary>Alta de Repartidor (genera contraseña temporal).</summary>
        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPost("repartidores")]
        public async Task<ActionResult<UserInfoResponse>> RegistrarRepartidor([FromBody] RegistrarRepartidorRequest request)
        {
            try
            {
                if (User.IsInRole(Roles.Supervisor))
                {
                    var supervisor = await CurrentUserAsync();
                    if (supervisor?.SucursalId is null) return BadRequest("El supervisor no tiene sucursal asignada.");
                    request.SucursalId = supervisor.SucursalId;
                }
                var result = await _authService.RegistrarRepartidor(request);
                var repartidor = result.Repartidor;

                await _context.SaveChangesAsync();

                return Ok(new UserInfoResponse
                {
                    Id = repartidor.Id.ToString(),
                    Nombre = repartidor.Nombre,
                    Apellido = repartidor.Apellido,
                    Email = repartidor.Email,
                    DNI = repartidor.DNI,
                    Activo = repartidor.Activo,
                    Role = Roles.Repartidor,
                    Licencia = repartidor.Licencia,
                    Estado = repartidor.EstadoLabel,
                    TemporaryPassword = result.TemporaryPassword
                });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPut("repartidores/{repartidorId:guid}/licencia")]
        public async Task<ActionResult<UserInfoResponse>> ActualizarLicenciaRepartidor(Guid repartidorId, [FromBody] ActualizarLicenciaRepartidorRequest request)
        {
            try
            {
                var scopeError = await ValidarRepartidorEnSucursalDelSupervisor(repartidorId);
                if (scopeError is not null) return scopeError;
                var repartidor = await _authService.ActualizarLicenciaRepartidor(repartidorId, request.Licencia);
                await _context.SaveChangesAsync();
                return Ok(MapRepartidor(repartidor));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPut("repartidores/{repartidorId:guid}/horas-trabajo")]
        public async Task<ActionResult<UserInfoResponse>> ActualizarHorasTrabajoRepartidor(Guid repartidorId, [FromBody] ActualizarHorasTrabajoRequest request)
        {
            try
            {
                var scopeError = await ValidarRepartidorEnSucursalDelSupervisor(repartidorId);
                if (scopeError is not null) return scopeError;
                var rep = await _userRepository.GetUsuarioById(repartidorId) as Repartidor
                    ?? throw new InvalidOperationException("Repartidor no encontrado.");
                rep.ActualizarHorasTrabajo(request.HorasTrabajo);
                await _context.SaveChangesAsync();
                return Ok(MapRepartidor(rep));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPut("repartidores/{repartidorId:guid}/estado")]
        public async Task<ActionResult<UserInfoResponse>> CambiarEstadoRepartidor(Guid repartidorId, [FromBody] CambiarEstadoRepartidorRequest request)
        {
            try
            {
                var scopeError = await ValidarRepartidorEnSucursalDelSupervisor(repartidorId);
                if (scopeError is not null) return scopeError;
                var repartidor = await _authService.CambiarEstadoRepartidor(repartidorId, request.Estado);
                await _context.SaveChangesAsync();
                return Ok(MapRepartidor(repartidor));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== G1L-30 / G1L-47: CRUD Usuarios + credenciales (Administrador) ==============

        /// <summary>Listado de usuarios con búsqueda parcial por nombre, apellido, email o DNI.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpGet("usuarios")]
        public async Task<ActionResult<PagedResponse<UserInfoResponse>>> GetUsuarios(
            [FromQuery] string? search,
            [FromQuery] string? role,
            [FromQuery] bool? active,
            [FromQuery] Guid? sucursalId,
            [FromQuery] int? page,
            [FromQuery] int? pageSize)
        {
            var normalizedPage = PaginationDefaults.NormalizePage(page);
            var normalizedPageSize = PaginationDefaults.NormalizePageSize(pageSize);
            var usuarios = await _userRepository.GetPaged(search, role, active, sucursalId, normalizedPage, normalizedPageSize);
            return Ok(PagedResponse<UserInfoResponse>.Create(
                usuarios.Items.Select(MapUsuario).ToList(),
                usuarios.Page,
                usuarios.PageSize,
                usuarios.TotalItems));
        }

        /// <summary>Alta de usuario por Administrador con contraseña temporal manual.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("usuarios")]
        public async Task<ActionResult<UserInfoResponse>> CrearUsuario([FromBody] CrearUsuarioRequest request)
        {
            try
            {
                await using var tx = await _context.Database.BeginTransactionAsync();
                if (request.Role == Roles.SocioPickUp)
                {
                    if (!request.PuntoPickUpId.HasValue) return BadRequest("El punto Pick Up es obligatorio para socios Pick Up.");
                    var exists = await _context.PuntosPickUp.AnyAsync(p => p.Id == request.PuntoPickUpId.Value && p.Activo);
                    if (!exists) return BadRequest("El punto Pick Up seleccionado no existe o esta inactivo.");
                }
                var result = await _authService.CrearUsuario(request);
                await _context.SaveChangesAsync();

                // Si es Gerente, asignar provincias luego de persistir el usuario
                if (result.Usuario is Gerente && !string.IsNullOrWhiteSpace(request.Provincia))
                {
                    await _authService.AsignarProvinciasGerente(result.Usuario.Id, new[] { request.Provincia.Trim() });
                    await _context.SaveChangesAsync();
                }

                await tx.CommitAsync();
                var resp = MapUsuario(result.Usuario);
                resp.TemporaryPassword = result.TemporaryPassword;
                return Ok(resp);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Obtiene el perfil completo del usuario autenticado.</summary>
        [Authorize]
        [HttpGet("mi-perfil")]
        public async Task<ActionResult<UserInfoResponse>> ObtenerMiPerfil()
        {
            var user = await CurrentUserAsync();
            if (user == null) return Unauthorized();
            return Ok(MapUsuario(user));
        }

        /// <summary>Actualiza el nombre y apellido del usuario autenticado.</summary>
        [Authorize]
        [HttpPut("mi-perfil")]
        public async Task<ActionResult<UserInfoResponse>> ActualizarMiPerfil([FromBody] ActualizarMiPerfilRequest request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(request.Nombre) || string.IsNullOrWhiteSpace(request.Apellido))
                return BadRequest("Nombre y apellido son obligatorios.");

            var user = await _userRepository.GetUsuarioById(Guid.Parse(userId));
            if (user == null) return NotFound();

            user.ActualizarNombreApellido(request.Nombre.Trim(), request.Apellido.Trim());
            await _context.SaveChangesAsync();
            return Ok(MapUsuario(user));
        }

        /// <summary>Actualiza la foto de perfil del usuario autenticado (base64).</summary>
        [Authorize]
        [HttpPut("me/foto-perfil")]
        public async Task<ActionResult<UserInfoResponse>> ActualizarFotoPerfil([FromBody] ActualizarFotoPerfilRequest request)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            if (string.IsNullOrWhiteSpace(request.FotoPerfil))
                return BadRequest("La foto no puede estar vacía.");

            // Limite: ~500 KB en base64 (aprox. 375 KB en binario).
            if (request.FotoPerfil.Length > 700_000)
                return BadRequest("La imagen es demasiado grande. Máximo permitido: 500 KB.");

            var user = await _userRepository.GetUsuarioById(Guid.Parse(userId));
            if (user == null) return NotFound();

            user.ActualizarFotoPerfil(request.FotoPerfil);
            await _context.SaveChangesAsync();
            return Ok(MapUsuario(user));
        }

        /// <summary>Actualizar datos de usuario (nombre, apellido, email, DNI y, opcionalmente, provincia para Gerentes).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPut("usuarios/{userId:guid}")]
        public async Task<ActionResult<UserInfoResponse>> ActualizarUsuario(Guid userId, [FromBody] ActualizarUsuarioRequest request)
        {
            try
            {
                var updated = await _authService.ActualizarUsuario(userId, request.Nombre, request.Apellido, request.Email, request.DNI);

                // Si se envió Provincia y el usuario es Gerente, actualizar provincias.
                if (!string.IsNullOrWhiteSpace(request.Provincia) && updated is Gerente gerente)
                {
                    var provincias = request.Provincia
                        .Split(',', System.StringSplitOptions.RemoveEmptyEntries | System.StringSplitOptions.TrimEntries)
                        .ToList();

                    if (provincias.Count != 1)
                        return BadRequest("Un Gerente solo puede tener una única provincia asignada.");

                    var newProv = provincias.First();
                    if (gerente.ProvinciasAsignadas.Any() && !gerente.ProvinciasAsignadas.Contains(newProv, StringComparer.OrdinalIgnoreCase))
                    {
                        foreach (var oldProv in gerente.ProvinciasAsignadas)
                        {
                            bool hasSucursales = await _context.Sucursales.AnyAsync(s => s.Provincia == oldProv);
                            if (hasSucursales) return BadRequest($"El gerente ya tiene sucursales registradas en {oldProv}, no se puede cambiar su provincia.");
                        }
                    }

                    // Asignamos usando AuthService para que modifique la base y haga chequeos de ocupación.
                    await _authService.AsignarProvinciasGerente(userId, provincias);
                }

                await _context.SaveChangesAsync();
                return Ok(MapUsuario(updated));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Asignar una o más provincias a un Gerente (solo Administrador).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPut("usuarios/{userId:guid}/provincias")]
        public async Task<ActionResult<UserInfoResponse>> AsignarProvincias(Guid userId, [FromBody] AsignarProvinciasRequest request)
        {
            try
            {
                if (request.Provincias.Count != 1) return BadRequest("Un Gerente solo puede tener una única provincia asignada.");

                var gerente = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == userId) as Gerente;
                if (gerente != null)
                {
                    var newProv = request.Provincias.First();
                    if (gerente.ProvinciasAsignadas.Any() && !gerente.ProvinciasAsignadas.Contains(newProv, StringComparer.OrdinalIgnoreCase))
                    {
                        foreach (var oldProv in gerente.ProvinciasAsignadas)
                        {
                            bool hasSucursales = await _context.Sucursales.AnyAsync(s => s.Provincia == oldProv);
                            if (hasSucursales) return BadRequest($"El gerente ya tiene sucursales registradas en {oldProv}, no se puede cambiar su provincia.");
                        }
                    }
                }

                var updatedGerente = await _authService.AsignarProvinciasGerente(userId, request.Provincias);
                await _context.SaveChangesAsync();
                return Ok(MapUsuario(updatedGerente));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Listado de provincias que ya tienen gerente asignado (Gerente/Admin).</summary>
        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpGet("gerentes/provincias-ocupadas")]
        public async Task<ActionResult<List<string>>> GetProvinciasOcupadasGerentes()
        {
            var provincias = await _context.GerentesProvincias
                .Select(gp => gp.Provincia)
                .Distinct()
                .OrderBy(p => p)
                .ToListAsync();
            return Ok(provincias);
        }

        /// <summary>Soft-delete: desactivar usuario sin perder historial.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("usuarios/{userId:guid}/desactivar")]
        public async Task<ActionResult> Desactivar(Guid userId)
        {
            try
            {
                await _authService.DesactivarUsuario(userId);
                await _auditoria.RegistrarAsync(
                    TipoAccion.DesactivacionUsuario,
                    "Cuenta de usuario desactivada",
                    userId.ToString());
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("usuarios/{userId:guid}/activar")]
        public async Task<ActionResult> Activar(Guid userId)
        {
            try
            {
                await _authService.ActivarUsuario(userId);
                await _auditoria.RegistrarAsync(
                    TipoAccion.ActivacionUsuario,
                    "Cuenta de usuario activada",
                    userId.ToString());
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Reseteo de contraseña por Administrador (genera o usa la pasada).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("usuarios/{userId:guid}/reset-password")]
        public async Task<ActionResult<ResetPasswordResponse>> ResetPassword(Guid userId, [FromBody] ResetPasswordRequest? request)
        {
            try
            {
                var temp = await _authService.ResetearPassword(userId, request?.PasswordTemporal);
                await _context.SaveChangesAsync();
                return Ok(new ResetPasswordResponse { TemporaryPassword = temp });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== Helpers de mapeo ==============

        private static UserInfoResponse MapUsuario(Usuario u) => new()
        {
            Id = u.Id.ToString(),
            Nombre = u.Nombre,
            Apellido = u.Apellido,
            Email = u.Email,
            DNI = u.DNI,
            Activo = u.Activo,
            Licencia = u is Repartidor t ? t.Licencia : null,
            Estado = u is Repartidor t2 ? t2.EstadoLabel : null,
            // Épica D: ámbito del usuario para que el front gatee por sucursal/provincia.
            SucursalId = u.SucursalId?.ToString(),
            Provincia = u is Gerente ger ? ger.Provincia : null,
            Provincias = u is Gerente ger2 ? ger2.ProvinciasAsignadas.ToList() : null,
            PuntoPickUpId = u is SocioPickUp socio ? socio.PuntoPickUpId.ToString() : null,
            FotoPerfil = u.FotoPerfil,
            Role = u switch
            {
                Administrador => Roles.Administrador,
                Gerente => Roles.Gerente,
                Supervisor => Roles.Supervisor,
                Operador => Roles.Operador,
                Repartidor => Roles.Repartidor,
                SocioPickUp => Roles.SocioPickUp,
                UsuarioPortal => Roles.UsuarioPortal,
                _ => "Usuario"
            }
        };

        private static UserInfoResponse MapRepartidor(Repartidor r) => new()
        {
            Id = r.Id.ToString(),
            Nombre = r.Nombre,
            Apellido = r.Apellido,
            Email = r.Email,
            DNI = r.DNI,
            Activo = r.Activo,
            Role = Roles.Repartidor,
            Licencia = r.Licencia,
            Estado = r.EstadoLabel,
            SucursalId = r.SucursalId?.ToString(),
            HorasTrabajo = r.HorasTrabajo,
            TipoJornada = r.TipoJornada,
            FotoPerfil = r.FotoPerfil,
        };
    }

    public class UserInfoResponse
    {
        public string Id { get; set; }
        public string Nombre { get; set; }
        public string Apellido { get; set; }
        public string Email { get; set; }
        public string DNI { get; set; }
        public string Role { get; set; }
        public bool Activo { get; set; } = true;
        public string? Licencia { get; set; }
        public string? Estado { get; set; }
        public string? TemporaryPassword { get; set; }
        // Épica D: ámbito del usuario.
        public string? SucursalId { get; set; }
        public string? Provincia { get; set; }
        public List<string>? Provincias { get; set; }
        public string? PuntoPickUpId { get; set; }
        public int? HorasTrabajo { get; set; }
        public string? TipoJornada { get; set; }
        public string? FotoPerfil { get; set; }
    }

    public class RepartidorListadoResponse : UserInfoResponse
    {
        public int AssignedRoutesCount { get; set; }
        public string RouteStatusKey { get; set; } = string.Empty;
        public string RouteStatusLabel { get; set; } = string.Empty;
    }

    public class RegistrarRepartidorRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
        [Required]
        [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required]
        [Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; } = string.Empty;
        [Required] public string Licencia { get; set; } = string.Empty;
        // Épica D: sucursal a la que pertenece el repartidor.
        public Guid? SucursalId { get; set; }
    }

    public class ActualizarFotoPerfilRequest
    {
        [Required] public string FotoPerfil { get; set; } = string.Empty;
    }

    public class ActualizarLicenciaRepartidorRequest
    {
        [Required] public string Licencia { get; set; } = string.Empty;
    }

    public class ActualizarHorasTrabajoRequest
    {
        [Required]
        [Range(1, 24, ErrorMessage = "Las horas de trabajo deben estar entre 1 y 24.")]
        public int HorasTrabajo { get; set; }
    }

    public class CambiarEstadoRepartidorRequest
    {
        [Required] public EstadoRepartidor Estado { get; set; }
    }

    public class CambiarPasswordRequest
    {
        [Required] public string PasswordActual { get; set; } = string.Empty;
        [Required]
        [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
        public string PasswordNueva { get; set; } = string.Empty;
        [Required] public string PasswordConfirmacion { get; set; } = string.Empty;
    }

    public class CrearUsuarioRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
        [Required]
        [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required]
        [Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; } = string.Empty;
        [Required] public string Role { get; set; } = string.Empty;
        [Required]
        [MinLength(8, ErrorMessage = "La contraseña temporal debe tener al menos 8 caracteres.")]
        public string PasswordTemporal { get; set; } = string.Empty;
        public string? Licencia { get; set; }
        // Épica D: sucursal (Supervisor/Operador/Repartidor) o provincia (Gerente).
        public Guid? SucursalId { get; set; }
        public string? Provincia { get; set; }
        public Guid? PuntoPickUpId { get; set; }
    }

    public class ActualizarUsuarioRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
        [Required]
        [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required]
        [Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; } = string.Empty;
        /// <summary>Para Gerentes: una o más provincias separadas por comas.</summary>
        public string? Provincia { get; set; }
    }

    public class ActualizarMiPerfilRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
    }

    public class AsignarProvinciasRequest
    {
        [Required] public List<string> Provincias { get; set; } = new();
    }

    public class ResetPasswordRequest
    {
        public string? PasswordTemporal { get; set; }
    }

    public class ResetPasswordResponse
    {
        public string TemporaryPassword { get; set; } = string.Empty;
    }

    public class LoginRequest
    {
        [Required]
        [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required]
        [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
        public string Password { get; set; } = string.Empty;
        // Captcha temporalmente deshabilitado para testing
        // [Required(ErrorMessage = "El captcha es obligatorio.")]
        public string RecaptchaToken { get; set; } = string.Empty;
    }

    public class LoginResponse
    {
        public string Token { get; set; }
        public UserInfo User { get; set; }
    }

    public class UserInfo
    {
        public string Id { get; set; }
        public string Nombre { get; set; }
        public string Apellido { get; set; }
        public string Email { get; set; }
        public string DNI { get; set; }
        public string Role { get; set; }
        public string? SucursalId { get; set; }
        public string? Provincia { get; set; }
        public List<string>? Provincias { get; set; }
        public string? PuntoPickUpId { get; set; }
        public string? FotoPerfil { get; set; }
    }

    public class RegisterRequest
    {
        [Required] public string Nombre { get; set; }
        [Required] public string Apellido { get; set; }
        [Required]
        [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; }
        [Required]
        [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
        public string Password { get; set; }
        [Required]
        [Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; }
        public string Role { get; set; }
    }
}

