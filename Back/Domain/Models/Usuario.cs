

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

        public Usuario()
        {
        }

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

        public void CambiarPassword(string nuevoPasswordHash)
        {
            if (string.IsNullOrWhiteSpace(nuevoPasswordHash))
                throw new InvalidOperationException("La contraseña no puede estar vacía.");
            Password = nuevoPasswordHash;
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

    public class Repartidor : Usuario
    {
        public enum EstadoRepartidor
        {
            Activo,
            Suspendido,
            Inhabilitado,
        }

        public string Licencia { get; private set; }
        public EstadoRepartidor Estado { get; private set; } = EstadoRepartidor.Activo;

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
            if (string.IsNullOrWhiteSpace(licencia))
                throw new InvalidOperationException("La licencia es obligatoria.");

            Licencia = licencia.Trim();
        }

        public void CambiarEstado(EstadoRepartidor estado)
        {
            Estado = estado;
        }

        public bool PuedeSerAsignado => Estado == EstadoRepartidor.Activo;

        public string EstadoLabel => Estado.ToString();

        public bool EstaSuspendido => Estado != EstadoRepartidor.Activo;
    }

}
