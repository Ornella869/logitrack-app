namespace Back.Domain.Models
{
    public class PermisoRol
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public string Rol { get; private set; } = string.Empty;
        public string Permiso { get; private set; } = string.Empty;
        public bool Habilitado { get; private set; }
        public Guid? ActualizadoPorId { get; private set; }
        public DateTime ActualizadoEn { get; private set; } = DateTime.UtcNow;

        private PermisoRol() { }

        public PermisoRol(string rol, string permiso, bool habilitado, Guid? actualizadoPorId)
        {
            Rol = rol;
            Permiso = permiso;
            Habilitado = habilitado;
            ActualizadoPorId = actualizadoPorId;
        }

        public void Actualizar(bool habilitado, Guid? actualizadoPorId)
        {
            Habilitado = habilitado;
            ActualizadoPorId = actualizadoPorId;
            ActualizadoEn = DateTime.UtcNow;
        }
    }
}
