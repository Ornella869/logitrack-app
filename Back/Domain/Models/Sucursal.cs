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
        // Épica D: provincias adicionales (sin sucursal propia) que esta sucursal cubre.
        // La provincia propia siempre se considera cubierta. Se persiste como JSON.
        public List<string> ProvinciasCubiertas { get; private set; } = new();

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

        public void DefinirCobertura(IEnumerable<string> provinciasCubiertas)
        {
            ProvinciasCubiertas = provinciasCubiertas?
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p.Trim())
                .Distinct()
                .ToList() ?? new();
        }

        // ¿Esta sucursal cubre la provincia indicada? (la propia siempre cuenta)
        public bool Cubre(string? provincia)
        {
            if (string.IsNullOrWhiteSpace(provincia)) return false;
            var p = provincia.Trim();
            return string.Equals(Provincia, p, StringComparison.OrdinalIgnoreCase)
                || ProvinciasCubiertas.Any(x => string.Equals(x, p, StringComparison.OrdinalIgnoreCase));
        }
    }

    public enum SucursalStatus
    {
        Activa,
        Inhabilitada,
        Cerrada,
    }


}