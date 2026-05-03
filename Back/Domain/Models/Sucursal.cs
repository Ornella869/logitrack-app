namespace Back.Domain.Models
{
    public class Sucursal
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Nombre { get; private set; }
        public string Direccion { get; private set; }
        public string Ciudad { get; private set; }
        public string CodigoPostal { get; private set; }
        public string Telefono { get; private set; }
        public SucursalStatus Estado { get; private set; } = SucursalStatus.Activa;

        private Sucursal()
        {
        }

        public Sucursal(string nombre, string direccion, string ciudad, string codigoPostal, string telefono, SucursalStatus estado = SucursalStatus.Activa)
        {
            Nombre = nombre;
            Direccion = direccion;
            Ciudad = ciudad;
            CodigoPostal = codigoPostal;
            Telefono = telefono;
            Estado = estado;
        }

        public void Actualizar(string nombre, string direccion, string ciudad, string codigoPostal, string telefono)
        {
            Nombre = nombre;
            Direccion = direccion;
            Ciudad = ciudad;
            CodigoPostal = codigoPostal;
            Telefono = telefono;
        }
    }

    public enum SucursalStatus
    {
        Activa,
        Inhabilitada,
        Cerrada,
    }


}