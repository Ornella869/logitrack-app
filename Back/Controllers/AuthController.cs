
using System.ComponentModel.DataAnnotations;
using Back.Application.Abstractions;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using static Back.Domain.Models.Transportista;


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

        /// <summary>
        /// Endpoint para iniciar sesión. Recibe email y contraseña, y devuelve un token JWT con la información del usuario.
        /// </summary>
        /// <remarks>
        /// Valida el usuario y contraseña. En caso de credenciales no válidas retorna BadRequest.
        /// </remarks>
        /// <param name="request">Credentials de inicio de sesión</param>
        /// <returns>Token y datos del usuario</returns>
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


        /// <summary>
        /// Endpoint para registrarse. Recibe los datos del usuario y lo registra en el sistema.
        /// </summary>
        /// <remarks>
        /// Crea un usuario nuevo con rol por defecto y devuelve OK si la creación fue exitosa.
        /// </remarks>
        /// <param name="request">Datos de registro del usuario</param>
        /// <returns>Resultado de la operación</returns>
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

        /// <summary>
        /// Obtiene el listado de transportistas registrados.
        /// </summary>
        /// <returns>Lista de transportistas</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("transportistas")]
        public async Task<ActionResult<List<UserInfoResponse>>> GetTransportistas()
        {
            var transportistas = await _userRepository.GetAll();
            var transportistasList = transportistas.OfType<Transportista>().Select(t => new UserInfoResponse
            {
                Id = t.Id.ToString(),
                Nombre = t.Nombre,
                Apellido = t.Apellido,
                Email = t.Email,
                DNI = t.DNI,
                Role = "Transportista",
                Licencia = t.Licencia,
                Estado = t.EstadoLabel
            }).ToList();

            return Ok(transportistasList);
        }

        /// <summary>
        /// Registra un nuevo transportista y genera contraseña temporal.
        /// </summary>
        /// <param name="request">Datos del transportista a registrar</param>
        /// <returns>Información del transportista registrado</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("transportistas")]
        public async Task<ActionResult<UserInfoResponse>> RegistrarTransportista([FromBody] RegistrarTransportistaRequest request)
        {
            var result = await _authService.RegistrarTransportista(request);
            var transportista = result.Transportista;

            await _context.SaveChangesAsync();

            return Ok(new UserInfoResponse
            {
                Id = transportista.Id.ToString(),
                Nombre = transportista.Nombre,
                Apellido = transportista.Apellido,
                Email = transportista.Email,
                DNI = transportista.DNI,
                Role = "Transportista",
                Licencia = transportista.Licencia,
                Estado = transportista.EstadoLabel,
                TemporaryPassword = result.TemporaryPassword
            });
        }

        /// <summary>
        /// Actualiza la licencia de un transportista existente.
        /// </summary>
        /// <param name="transportistaId">ID del transportista a actualizar</param>
        /// <param name="request">Nueva licencia</param>
        /// <returns>Información actualizada del transportista</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPut("transportistas/{transportistaId:guid}/licencia")]
        public async Task<ActionResult<UserInfoResponse>> ActualizarLicenciaTransportista(Guid transportistaId, [FromBody] ActualizarLicenciaTransportistaRequest request)
        {
            var transportista = await _authService.ActualizarLicenciaTransportista(transportistaId, request.Licencia);

            await _context.SaveChangesAsync();

            return Ok(new UserInfoResponse
            {
                Id = transportista.Id.ToString(),
                Nombre = transportista.Nombre,
                Apellido = transportista.Apellido,
                Email = transportista.Email,
                DNI = transportista.DNI,
                Role = "Transportista",
                Licencia = transportista.Licencia,
                Estado = transportista.EstadoLabel
            });
        }

        /// <summary>
        /// Cambia el estado de un transportista (activo/inactivo, etc.).
        /// </summary>
        /// <param name="transportistaId">ID del transportista a actualizar</param>
        /// <param name="request">Estado deseado</param>
        /// <returns>Información actualizada del transportista</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPut("transportistas/{transportistaId:guid}/estado")]
        public async Task<ActionResult<UserInfoResponse>> CambiarEstadoTransportista(Guid transportistaId, [FromBody] CambiarEstadoTransportistaRequest request)
        {
            var transportista = await _authService.CambiarEstadoTransportista(transportistaId, request.Estado);

            await _context.SaveChangesAsync();

            return Ok(new UserInfoResponse
            {
                Id = transportista.Id.ToString(),
                Nombre = transportista.Nombre,
                Apellido = transportista.Apellido,
                Email = transportista.Email,
                DNI = transportista.DNI,
                Role = "Transportista",
                Licencia = transportista.Licencia,
                Estado = transportista.EstadoLabel
            });
        }

        /// <summary>
        /// Obtiene el listado completo de usuarios (supervisores, operadores y transportistas).
        /// </summary>
        /// <returns>Lista de usuarios</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("usuarios")]
        public async Task<ActionResult<List<UserInfoResponse>>> GetUsuarios()
        {
            var usuarios = await _userRepository.GetAll();
            var usuariosList = usuarios.Select(u => new UserInfoResponse
            {
                Id = u.Id.ToString(),
                Nombre = u.Nombre,
                Apellido = u.Apellido,
                Email = u.Email,
                DNI = u.DNI,
                Licencia = u is Transportista t ? t.Licencia : null,
                Estado = u is Transportista t2 ? t2.EstadoLabel : null,
                Role = u switch
                {
                    Supervisor => "Supervisor",
                    Operador => "Operador",
                    Transportista => "Transportista",
                    _ => "Usuario"
                }
            }).ToList();

            return Ok(usuariosList);
        }
    }

    public class UserInfoResponse
    {
        public string Id { get; set; }
        public string Nombre { get; set; }
        public string Apellido { get; set; }
        public string Email { get; set; }
        public string DNI { get; set; }
        public string Role { get; set; }
        public string? Licencia { get; set; }
        public string? Estado { get; set; }
        public string? TemporaryPassword { get; set; }
    }

    public class RegistrarTransportistaRequest
    {
        [Required]
        public string Nombre { get; set; } = string.Empty;
        [Required]
        public string Apellido { get; set; } = string.Empty;
        [Required]
        [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;
        [Required]
        [Length(8, 8, ErrorMessage = "El DNI debe tener exactamente 8 caracteres.")]
        public string DNI { get; set; } = string.Empty;
        [Required]
        public string Licencia { get; set; } = string.Empty;
    }

    public class ActualizarLicenciaTransportistaRequest
    {
        [Required]
        public string Licencia { get; set; } = string.Empty;
    }

    public class CambiarEstadoTransportistaRequest
    {
        [Required]
        public EstadoTransportista Estado { get; set; }
    }

    public class LoginRequest
    {
        [Required]
        [EmailAddress(ErrorMessage = "El correo electrónico no es válido.")]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MinLength(8, ErrorMessage = "La contraseña debe tener al menos 8 caracteres.")]
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
        [Required]
        public string Nombre { get; set; }
        [Required]
        public string Apellido { get; set; }
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

