
using System.ComponentModel.DataAnnotations;
using Back.Application.Abstractions;
using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
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
        private readonly LogiTrackDbContext _context;
        private readonly IRecaptchaValidationService _recaptchaValidationService;

        public AuthController(
            AuthService authService,
            IUserRepository userRepository,
            LogiTrackDbContext context,
            IRecaptchaValidationService recaptchaValidationService)
        {
            _authService = authService;
            _userRepository = userRepository;
            _context = context;
            _recaptchaValidationService = recaptchaValidationService;
        }

        /// <summary>Login con email + contraseña + reCAPTCHA. Devuelve JWT.</summary>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status401Unauthorized)]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
        {
            var remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString();
            var captchaIsValid = await _recaptchaValidationService.ValidateAsync(
                request.RecaptchaToken,
                remoteIp,
                HttpContext.RequestAborted);

            if (!captchaIsValid)
            {
                return BadRequest("Captcha inválido o vencido. Reintentá nuevamente.");
            }

            try
            {
                var result = await _authService.Login(request);
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return Unauthorized(ex.Message);
            }
        }

        /// <summary>Auto-registro abierto (Operador o Supervisor). Repartidor y Administrador requieren alta por Admin.</summary>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [HttpPost("registrarse")]
        public async Task<ActionResult> Registrarse([FromBody] RegisterRequest request)
        {
            try
            {
                await _authService.Registrarse(request);
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
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
        public async Task<ActionResult<List<UserInfoResponse>>> GetRepartidores()
        {
            var usuarios = await _userRepository.GetAll();
            var repartidoresList = usuarios.OfType<Repartidor>().Select(t => new UserInfoResponse
            {
                Id = t.Id.ToString(),
                Nombre = t.Nombre,
                Apellido = t.Apellido,
                Email = t.Email,
                DNI = t.DNI,
                Activo = t.Activo,
                Role = Roles.Repartidor,
                Licencia = t.Licencia,
                Estado = t.EstadoLabel
            }).ToList();

            return Ok(repartidoresList);
        }

        /// <summary>Alta de Repartidor (genera contraseña temporal).</summary>
        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPost("repartidores")]
        public async Task<ActionResult<UserInfoResponse>> RegistrarRepartidor([FromBody] RegistrarRepartidorRequest request)
        {
            try
            {
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
        [HttpPut("repartidores/{repartidorId:guid}/estado")]
        public async Task<ActionResult<UserInfoResponse>> CambiarEstadoRepartidor(Guid repartidorId, [FromBody] CambiarEstadoRepartidorRequest request)
        {
            try
            {
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
        public async Task<ActionResult<List<UserInfoResponse>>> GetUsuarios([FromQuery] string? search)
        {
            var usuarios = await _userRepository.GetAll();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLowerInvariant();
                usuarios = usuarios.Where(u =>
                    u.Nombre.ToLowerInvariant().Contains(s)
                    || u.Apellido.ToLowerInvariant().Contains(s)
                    || u.Email.ToLowerInvariant().Contains(s)
                    || u.DNI.Contains(s)).ToList();
            }

            var usuariosList = usuarios.Select(MapUsuario).ToList();
            return Ok(usuariosList);
        }

        /// <summary>Alta de usuario por Administrador con contraseña temporal manual.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("usuarios")]
        public async Task<ActionResult<UserInfoResponse>> CrearUsuario([FromBody] CrearUsuarioRequest request)
        {
            try
            {
                var result = await _authService.CrearUsuario(request);
                await _context.SaveChangesAsync();
                var resp = MapUsuario(result.Usuario);
                resp.TemporaryPassword = result.TemporaryPassword;
                return Ok(resp);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Actualizar datos de usuario (nombre, apellido, email, DNI).</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPut("usuarios/{userId:guid}")]
        public async Task<ActionResult<UserInfoResponse>> ActualizarUsuario(Guid userId, [FromBody] ActualizarUsuarioRequest request)
        {
            try
            {
                var updated = await _authService.ActualizarUsuario(userId, request.Nombre, request.Apellido, request.Email, request.DNI);
                await _context.SaveChangesAsync();
                return Ok(MapUsuario(updated));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Soft-delete: desactivar usuario sin perder historial.</summary>
        [Authorize(Roles = Roles.Administrador)]
        [HttpPost("usuarios/{userId:guid}/desactivar")]
        public async Task<ActionResult> Desactivar(Guid userId)
        {
            try
            {
                await _authService.DesactivarUsuario(userId);
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
            Role = u switch
            {
                Administrador => Roles.Administrador,
                Supervisor => Roles.Supervisor,
                Operador => Roles.Operador,
                Repartidor => Roles.Repartidor,
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
            Estado = r.EstadoLabel
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
    }

    public class RegistrarRepartidorRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
        [Required][EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required][Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; } = string.Empty;
        [Required] public string Licencia { get; set; } = string.Empty;
    }

    public class ActualizarLicenciaRepartidorRequest
    {
        [Required] public string Licencia { get; set; } = string.Empty;
    }

    public class CambiarEstadoRepartidorRequest
    {
        [Required] public EstadoRepartidor Estado { get; set; }
    }

    public class CambiarPasswordRequest
    {
        [Required] public string PasswordActual { get; set; } = string.Empty;
        [Required][MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
        public string PasswordNueva { get; set; } = string.Empty;
        [Required] public string PasswordConfirmacion { get; set; } = string.Empty;
    }

    public class CrearUsuarioRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
        [Required][EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required][Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; } = string.Empty;
        [Required] public string Role { get; set; } = string.Empty;
        [Required][MinLength(8, ErrorMessage = "La contraseña temporal debe tener al menos 8 caracteres.")]
        public string PasswordTemporal { get; set; } = string.Empty;
        public string? Licencia { get; set; }
    }

    public class ActualizarUsuarioRequest
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
        [Required][EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required][Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; } = string.Empty;
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
        [Required][EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required][MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
        public string Password { get; set; } = string.Empty;
        [Required(ErrorMessage = "El captcha es obligatorio.")]
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
        public string Role { get; set; }
    }

    public class RegisterRequest
    {
        [Required] public string Nombre { get; set; }
        [Required] public string Apellido { get; set; }
        [Required][EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; }
        [Required][MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
        public string Password { get; set; }
        [Required][Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; }
        public string Role { get; set; }
    }
}

