namespace Back.Domain.Models
{
    public class Sucursal
    {
        public Guid Id { get; set; } = Guid.NewGuid();
        public string Nombre { get; private set; }
        public string Direccion { get; private set; }
        public string Ciudad { get; private set; }
        public string CodigoPostal { get; private set; }
        // Provincia explícita para que el geocoding pueda restringir la búsqueda
        // (Georef + Nominatim). Se agregó para resolver CPs ambiguos entre
        // provincias (ej. 9420 → Chubut o Tierra del Fuego).
        public string? Provincia { get; private set; }
        public string Telefono { get; private set; }
        public SucursalStatus Estado { get; private set; } = SucursalStatus.Activa;

        private Sucursal()
        {
        }

        public Sucursal(string nombre, string direccion, string ciudad, string codigoPostal, string telefono, string? provincia = null, SucursalStatus estado = SucursalStatus.Activa)
        {
            Nombre = nombre;
            Direccion = direccion;
            Ciudad = ciudad;
            CodigoPostal = codigoPostal;
            Provincia = provincia;
            Telefono = telefono;
            Estado = estado;
        }

        public void Actualizar(string nombre, string direccion, string ciudad, string codigoPostal, string telefono, string? provincia = null)
        {
            Nombre = nombre;
            Direccion = direccion;
            Ciudad = ciudad;
            CodigoPostal = codigoPostal;
            Provincia = provincia;
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