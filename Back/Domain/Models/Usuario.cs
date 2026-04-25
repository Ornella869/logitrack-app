

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

    public class Transportista : Usuario
    {
        public enum EstadoTransportista
        {
            Activo,
            Suspendido,
            Inhabilitado,
        }

        public string Licencia { get; private set; }
        public EstadoTransportista Estado { get; private set; } = EstadoTransportista.Activo;

        public Transportista()
        {
            Licencia = string.Empty;
        }

        public Transportista(string nombre, string apellido, string email, string password, string dni, string licencia = "No informada") : base(nombre, apellido, email, password, dni)
        {
            Licencia = licencia;
        }

        public void ActualizarLicencia(string licencia)
        {
            if (string.IsNullOrWhiteSpace(licencia))
                throw new InvalidOperationException("La licencia es obligatoria.");

            Licencia = licencia.Trim();
        }

        public void CambiarEstado(EstadoTransportista estado)
        {
            Estado = estado;
        }

        public bool PuedeSerAsignado => Estado == EstadoTransportista.Activo;

        public string EstadoLabel => Estado.ToString();

        public bool EstaSuspendido => Estado != EstadoTransportista.Activo;
    }

}