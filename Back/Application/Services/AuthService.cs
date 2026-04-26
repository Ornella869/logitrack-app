using Back.Application.Common;
using Back.Application.Util;
using Back.Controllers;
using Back.Domain.Models;
using Back.Domain.Repositories;
using static Back.Domain.Models.Repartidor;

namespace Back.Application.Services
{
    public class RegistrarRepartidorResult
    {
        public required Repartidor Repartidor { get; init; }
        public required string TemporaryPassword { get; init; }
    }

    public class CrearUsuarioResult
    {
        public required Usuario Usuario { get; init; }
        public required string TemporaryPassword { get; init; }
    }

    public class AuthService
    {

        private readonly IUserRepository _userRepository;

        public AuthService(IUserRepository userRepository)
        {
            _userRepository = userRepository;
        }

        public async Task<dynamic> Login(LoginRequest request)
        {
            var user = await _userRepository.GetUsuarioByEmail(request.Email);

            // G1L-31 (Seguridad en Fallos): mismo mensaje sin importar cuál de los dos campos falló.
            if (user == null || !PasswordHasher.VerifyPassword(request.Password, user.Password))
            {
                throw new InvalidOperationException("Usuario o contraseña incorrectos");
            }

            if (!user.Activo)
            {
                throw new InvalidOperationException("Usuario inactivo. Contactá a un administrador.");
            }

            var token = JWTservice.GenerateToken(user);

            return new
            {
                token = token,
                user = new
                {
                    id = user.Id.ToString(),
                    nombre = user.Nombre,
                    apellido = user.Apellido,
                    email = user.Email,
                    role = user.GetType().Name
                }
            };
        }

        public async Task Registrarse(RegisterRequest request)
        {
            if (!EmailService.IsEmailValid(request.Email))
            {
                throw new InvalidOperationException("Correo electrónico no válido");
            }

            var existingUser = await _userRepository.GetUsuarioByEmail(request.Email);
            if (existingUser != null)
            {
                throw new InvalidOperationException("El correo electrónico ya está registrado");
            }

            var existingByDni = await _userRepository.GetUsuarioByDni(request.DNI);
            if (existingByDni != null)
            {
                throw new InvalidOperationException("El DNI ya se encuentra registrado");
            }

            var hashedPassword = PasswordHasher.HashPassword(request.Password);

            if (request.Role == Roles.Repartidor)
                throw new InvalidOperationException("El rol Repartidor solo puede ser registrado por un Administrador.");

            Usuario newUser = request.Role switch
            {
                Roles.Supervisor => new Supervisor(request.Nombre, request.Apellido, request.Email, hashedPassword, request.DNI),
                Roles.Operador => new Operador(request.Nombre, request.Apellido, request.Email, hashedPassword, request.DNI),
                Roles.Administrador => new Administrador(request.Nombre, request.Apellido, request.Email, hashedPassword, request.DNI),
                _ => throw new InvalidOperationException("Rol no válido"),
            };
            await _userRepository.Add(newUser);
        }

        public async Task<RegistrarRepartidorResult> RegistrarRepartidor(RegistrarRepartidorRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Nombre) || string.IsNullOrWhiteSpace(request.Apellido))
                throw new InvalidOperationException("Nombre y apellido son obligatorios.");

            if (string.IsNullOrWhiteSpace(request.Email) || !EmailService.IsEmailValid(request.Email.Trim()))
                throw new InvalidOperationException("El email del repartidor no es válido.");

            if (string.IsNullOrWhiteSpace(request.DNI) || request.DNI.Trim().Length != 8)
                throw new InvalidOperationException("El DNI debe tener exactamente 8 caracteres.");

            if (string.IsNullOrWhiteSpace(request.Licencia))
                throw new InvalidOperationException("La licencia es obligatoria.");

            var existingByDni = await _userRepository.GetUsuarioByDni(request.DNI.Trim());
            if (existingByDni is not null)
                throw new InvalidOperationException("El DNI ya está registrado.");

            var existingByEmail = await _userRepository.GetUsuarioByEmail(request.Email.Trim());
            if (existingByEmail is not null)
                throw new InvalidOperationException("El email ya está registrado.");

            var temporaryPassword = GenerateTemporaryPassword();
            var generatedPassword = PasswordHasher.HashPassword(temporaryPassword);

            var repartidor = new Repartidor(
                request.Nombre.Trim(),
                request.Apellido.Trim(),
                request.Email.Trim(),
                generatedPassword,
                request.DNI.Trim(),
                request.Licencia.Trim()
            );

            await _userRepository.Add(repartidor);
            return new RegistrarRepartidorResult
            {
                Repartidor = repartidor,
                TemporaryPassword = temporaryPassword,
            };
        }

        // G1L-30: alta de usuario por Administrador.
        public async Task<CrearUsuarioResult> CrearUsuario(CrearUsuarioRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Nombre) || string.IsNullOrWhiteSpace(request.Apellido))
                throw new InvalidOperationException("Nombre y apellido son obligatorios.");

            if (string.IsNullOrWhiteSpace(request.Email) || !EmailService.IsEmailValid(request.Email.Trim()))
                throw new InvalidOperationException("El email no es válido.");

            if (string.IsNullOrWhiteSpace(request.DNI) || request.DNI.Trim().Length != 8)
                throw new InvalidOperationException("El DNI debe tener exactamente 8 caracteres.");

            if (string.IsNullOrWhiteSpace(request.PasswordTemporal) || request.PasswordTemporal.Length < 8)
                throw new InvalidOperationException("La contraseña temporal debe tener al menos 8 caracteres.");

            var existingByEmail = await _userRepository.GetUsuarioByEmail(request.Email.Trim());
            if (existingByEmail is not null)
                throw new InvalidOperationException("El email ya está registrado.");

            var existingByDni = await _userRepository.GetUsuarioByDni(request.DNI.Trim());
            if (existingByDni is not null)
                throw new InvalidOperationException("El DNI ya está registrado.");

            var hash = PasswordHasher.HashPassword(request.PasswordTemporal);

            Usuario nuevo = request.Role switch
            {
                Roles.Administrador => new Administrador(request.Nombre.Trim(), request.Apellido.Trim(), request.Email.Trim(), hash, request.DNI.Trim()),
                Roles.Supervisor => new Supervisor(request.Nombre.Trim(), request.Apellido.Trim(), request.Email.Trim(), hash, request.DNI.Trim()),
                Roles.Operador => new Operador(request.Nombre.Trim(), request.Apellido.Trim(), request.Email.Trim(), hash, request.DNI.Trim()),
                Roles.Repartidor => new Repartidor(
                    request.Nombre.Trim(),
                    request.Apellido.Trim(),
                    request.Email.Trim(),
                    hash,
                    request.DNI.Trim(),
                    string.IsNullOrWhiteSpace(request.Licencia) ? "No informada" : request.Licencia.Trim()),
                _ => throw new InvalidOperationException("Rol no válido."),
            };

            await _userRepository.Add(nuevo);
            return new CrearUsuarioResult { Usuario = nuevo, TemporaryPassword = request.PasswordTemporal };
        }

        public async Task DesactivarUsuario(Guid userId)
        {
            var user = await _userRepository.GetUsuarioById(userId)
                ?? throw new InvalidOperationException("Usuario no encontrado.");
            user.Desactivar();
        }

        public async Task ActivarUsuario(Guid userId)
        {
            var user = await _userRepository.GetUsuarioById(userId)
                ?? throw new InvalidOperationException("Usuario no encontrado.");
            user.Activar();
        }

        // G1L-47: usuario cambia su propia clave.
        public async Task CambiarPasswordPropia(Guid userId, string passwordActual, string passwordNueva, string passwordConfirmacion)
        {
            if (passwordNueva != passwordConfirmacion)
                throw new InvalidOperationException("La nueva contraseña y su confirmación no coinciden.");

            if (string.IsNullOrWhiteSpace(passwordNueva) || passwordNueva.Length < 8)
                throw new InvalidOperationException("La nueva contraseña debe tener al menos 8 caracteres.");

            var user = await _userRepository.GetUsuarioById(userId)
                ?? throw new InvalidOperationException("Usuario no encontrado.");

            if (!PasswordHasher.VerifyPassword(passwordActual, user.Password))
                throw new InvalidOperationException("La contraseña actual es incorrecta.");

            user.CambiarPassword(PasswordHasher.HashPassword(passwordNueva));
        }

        // G1L-47: Administrador resetea la clave de un usuario.
        public async Task<string> ResetearPassword(Guid userId, string? passwordTemporal)
        {
            var user = await _userRepository.GetUsuarioById(userId)
                ?? throw new InvalidOperationException("Usuario no encontrado.");

            string nueva = string.IsNullOrWhiteSpace(passwordTemporal) ? GenerateTemporaryPassword() : passwordTemporal;
            if (nueva.Length < 8)
                throw new InvalidOperationException("La contraseña temporal debe tener al menos 8 caracteres.");

            user.CambiarPassword(PasswordHasher.HashPassword(nueva));
            return nueva;
        }

        private static string GenerateTemporaryPassword()
        {
            return $"Tmp{Guid.NewGuid().ToString("N")[..8]}";
        }

        public async Task<Repartidor> ActualizarLicenciaRepartidor(Guid repartidorId, string licencia)
        {
            var user = await _userRepository.GetUsuarioById(repartidorId);
            if (user is not Repartidor repartidor)
                throw new InvalidOperationException("Repartidor no encontrado.");

            repartidor.ActualizarLicencia(licencia);
            return repartidor;
        }

        public async Task<Repartidor> CambiarEstadoRepartidor(Guid repartidorId, EstadoRepartidor estado)
        {
            var user = await _userRepository.GetUsuarioById(repartidorId);
            if (user is not Repartidor repartidor)
                throw new InvalidOperationException("Repartidor no encontrado.");

            repartidor.CambiarEstado(estado);
            return repartidor;
        }
    }
}
