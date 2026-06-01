namespace Back.Domain.Models
{
    public class PuntoPickUp
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public string Nombre { get; private set; } = string.Empty;
        public string Direccion { get; private set; } = string.Empty;
        public string Localidad { get; private set; } = string.Empty;
        public string CodigoPostal { get; private set; } = string.Empty;
        public string Provincia { get; private set; } = string.Empty;
        public string Horarios { get; private set; } = string.Empty;
        public string? Telefono { get; private set; }
        public bool Activo { get; private set; } = true;
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

        private PuntoPickUp() { }

        public PuntoPickUp(string nombre, string direccion, string localidad, string codigoPostal, string provincia, string horarios, string? telefono)
        {
            Actualizar(nombre, direccion, localidad, codigoPostal, provincia, horarios, telefono);
        }

        public void Actualizar(string nombre, string direccion, string localidad, string codigoPostal, string provincia, string horarios, string? telefono)
        {
            if (string.IsNullOrWhiteSpace(nombre)) throw new InvalidOperationException("El nombre es obligatorio.");
            if (string.IsNullOrWhiteSpace(direccion)) throw new InvalidOperationException("La direccion es obligatoria.");
            if (string.IsNullOrWhiteSpace(localidad)) throw new InvalidOperationException("La localidad es obligatoria.");
            if (string.IsNullOrWhiteSpace(codigoPostal)) throw new InvalidOperationException("El codigo postal es obligatorio.");
            if (string.IsNullOrWhiteSpace(provincia)) throw new InvalidOperationException("La provincia es obligatoria.");
            if (string.IsNullOrWhiteSpace(horarios)) throw new InvalidOperationException("Los horarios son obligatorios.");

            Nombre = nombre.Trim();
            Direccion = direccion.Trim();
            Localidad = localidad.Trim();
            CodigoPostal = codigoPostal.Trim();
            Provincia = provincia.Trim();
            Horarios = horarios.Trim();
            Telefono = string.IsNullOrWhiteSpace(telefono) ? null : telefono.Trim();
        }

        public void Desactivar() => Activo = false;
        public void Activar() => Activo = true;
    }
}
