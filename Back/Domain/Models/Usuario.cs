

using System.Text.RegularExpressions;
using Back.Application.Services;

namespace Back.Domain.Models
{
    public abstract class Usuario
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public string Nombre { get; private set; }
        public string Apellido { get; private set; }
        public string Email { get; private set; }
        public string Password { get; private set; }
        public string DNI { get; private set; }
        public bool Activo { get; private set; } = true;
        public int AccessFailedCount { get; private set; }
        public DateTime? BloqueadoHasta { get; private set; }
        public int FailedLoginAttempts { get; private set; }
        public DateTime? LockoutUntilUtc { get; private set; }
        // Épica D: sucursal a la que pertenece el usuario (Supervisor/Operador/Repartidor).
        // El Gerente no usa SucursalId (su ámbito es la provincia); el Administrador es global.
        public Guid? SucursalId { get; private set; }

        public Usuario()
        {
        }

        public void AsignarSucursal(Guid? sucursalId) => SucursalId = sucursalId;

        public Usuario(string nombre, string apellido, string email, string password, string dni)
        {
            Nombre = nombre;
            Apellido = apellido;
            Email = email;
            Password = password;
            DNI = dni;
        }

        public void Activar() => Activo = true;
        public void Desactivar() => Activo = false;
        public void RegistrarLoginFallido(int maxIntentos, TimeSpan duracionBloqueo)
        {
            AccessFailedCount++;
            if (AccessFailedCount >= maxIntentos)
                BloqueadoHasta = DateTime.UtcNow.Add(duracionBloqueo);
        }

        public void ResetearLoginFallido()
        {
            AccessFailedCount = 0;
            BloqueadoHasta = null;
        }

        public bool EstaBloqueado(DateTime utcNow)
        {
            return LockoutUntilUtc.HasValue && LockoutUntilUtc.Value > utcNow;
        }

        public void RegistrarLoginFallido(int maxAttempts, TimeSpan lockoutDuration, DateTime utcNow)
        {
            FailedLoginAttempts++;
            if (FailedLoginAttempts >= maxAttempts)
            {
                LockoutUntilUtc = utcNow.Add(lockoutDuration);
            }
        }

        public void ResetearIntentosLogin()
        {
            FailedLoginAttempts = 0;
            LockoutUntilUtc = null;
        }

        public void CambiarPassword(string nuevoPasswordHash)
        {
            if (string.IsNullOrWhiteSpace(nuevoPasswordHash))
                throw new InvalidOperationException("La contraseña no puede estar vacía.");
            Password = nuevoPasswordHash;
        }

        public void ActualizarNombreApellido(string nombre, string apellido)
        {
            Nombre = nombre;
            Apellido = apellido;
        }

        public void ActualizarDatos(string nombre, string apellido, string email, string dni)
        {
            if (string.IsNullOrWhiteSpace(nombre) || string.IsNullOrWhiteSpace(apellido))
                throw new InvalidOperationException("Nombre y apellido son obligatorios.");
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(dni))
                throw new InvalidOperationException("Email y DNI son obligatorios.");

            Nombre = nombre.Trim();
            Apellido = apellido.Trim();
            Email = email.Trim();
            DNI = dni.Trim();
        }
    }

    public class Supervisor : Usuario
    {

        public Supervisor()
        {
        }

        public Supervisor(string nombre, string apellido, string email, string password, string dni) : base(nombre, apellido, email, password, dni) { }
    }

    public class Operador : Usuario
    {

        public Operador() { }

        public Operador(string nombre, string apellido, string email, string password, string dni) : base(nombre, apellido, email, password, dni)
        {
        }
    }

    public class Administrador : Usuario
    {
        public Administrador() { }

        public Administrador(string nombre, string apellido, string email, string password, string dni) : base(nombre, apellido, email, password, dni)
        {
        }
    }

    // Épica D: gerente a cargo de todas las sucursales de una o más provincias.
    public class Gerente : Usuario
    {
        public string Provincia { get; private set; } = string.Empty;

        /// <summary>Lista de provincias asignadas, parseada desde el campo Provincia (separado por comas).</summary>
        public IReadOnlyList<string> ProvinciasAsignadas =>
            string.IsNullOrWhiteSpace(Provincia)
                ? Array.Empty<string>()
                : Provincia.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        public Gerente() { }

        public Gerente(string nombre, string apellido, string email, string password, string dni, string provincia)
            : base(nombre, apellido, email, password, dni)
        {
            Provincia = provincia;
        }

        /// <summary>Asigna múltiples provincias, guardadas como string separado por comas.</summary>
        public void AsignarProvincias(IEnumerable<string> provincias)
        {
            var lista = provincias
                .Select(p => p.Trim())
                .Where(p => !string.IsNullOrEmpty(p))
                .ToList();
            if (lista.Count == 0)
                throw new InvalidOperationException("Debe asignarse al menos una provincia.");
            Provincia = string.Join(",", lista);
        }

        /// <summary>Compatibilidad con asignación de una sola provincia.</summary>
        public void AsignarProvincia(string provincia) => Provincia = provincia;
    }

    // Portal externo: cliente que puede hacer seguimiento y reportar incidencias.
    public class UsuarioPortal : Usuario
    {
        public UsuarioPortal() { }

        public UsuarioPortal(string nombre, string apellido, string email, string password, string dni)
            : base(nombre, apellido, email, password, dni) { }
    }

    public class Repartidor : Usuario
    {
        public enum EstadoRepartidor
        {
            Activo,
            Suspendido,
            Inhabilitado,
        }

        // Estado operativo de la jornada (distinto del estado de cuenta):
        //   Disponible  → puede recibir envíos calendarizados.
        //   EnRuta      → ya inició la ruta del día (está en la calle).
        //   Retornando  → entregó todo y vuelve a la sucursal; NO recibe nuevos envíos.
        public enum EstadoJornadaRepartidor
        {
            Disponible,
            EnRuta,
            Retornando,
        }

        public string Licencia { get; private set; }
        public EstadoRepartidor Estado { get; private set; } = EstadoRepartidor.Activo;
        public EstadoJornadaRepartidor EstadoJornada { get; private set; } = EstadoJornadaRepartidor.Disponible;

        public Repartidor()
        {
            Licencia = string.Empty;
        }

        public Repartidor(string nombre, string apellido, string email, string password, string dni, string licencia = "No informada") : base(nombre, apellido, email, password, dni)
        {
            Licencia = licencia;
        }

        public void ActualizarLicencia(string licencia)
        {
            var trimmed = licencia?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(trimmed))
                throw new InvalidOperationException("La licencia es obligatoria.");
            if (!Regex.IsMatch(trimmed, @"^[A-Za-z0-9\- ]{6,15}$"))
                throw new InvalidOperationException("La licencia debe tener entre 6 y 15 caracteres alfanuméricos.");
            Licencia = trimmed;
        }

        public void CambiarEstado(EstadoRepartidor estado)
        {
            Estado = estado;
        }

        // Transiciones de jornada.
        public void IniciarJornada() => EstadoJornada = EstadoJornadaRepartidor.EnRuta;
        public void MarcarRetornando() => EstadoJornada = EstadoJornadaRepartidor.Retornando;
        public void CerrarJornada() => EstadoJornada = EstadoJornadaRepartidor.Disponible;

        public bool PuedeSerAsignado => Estado == EstadoRepartidor.Activo;

        // Para calendarización: no se le asignan envíos nuevos mientras está retornando.
        public bool DisponibleParaCalendarizar => Estado == EstadoRepartidor.Activo
            && EstadoJornada != EstadoJornadaRepartidor.Retornando;

        public string EstadoLabel => Estado.ToString();
        public string EstadoJornadaLabel => EstadoJornada.ToString();

        public bool EstaSuspendido => Estado != EstadoRepartidor.Activo;
    }

}
