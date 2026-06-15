namespace Back.Domain.Models
{
    public class PermisoUsuario
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid UsuarioId { get; private set; }
        public string Permiso { get; private set; } = string.Empty;
        public bool Habilitado { get; private set; }
        public Guid? ActualizadoPorId { get; private set; }
        public DateTime ActualizadoEn { get; private set; } = DateTime.UtcNow;

        private PermisoUsuario() { }

        public PermisoUsuario(Guid usuarioId, string permiso, bool habilitado, Guid? actualizadoPorId)
        {
            UsuarioId = usuarioId;
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
