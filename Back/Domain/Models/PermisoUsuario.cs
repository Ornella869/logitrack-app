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
        // null = sin scope override (default: propia sucursal)
        // [] vacío = todas las sucursales de la provincia del usuario
        // [ids] = sucursales específicas habilitadas
        public List<Guid>? SucursalesPermitidasIds { get; private set; }

        private PermisoUsuario() { }

        public PermisoUsuario(Guid usuarioId, string permiso, bool habilitado, Guid? actualizadoPorId, List<Guid>? sucursalesIds = null)
        {
            UsuarioId = usuarioId;
            Permiso = permiso;
            Habilitado = habilitado;
            ActualizadoPorId = actualizadoPorId;
            SucursalesPermitidasIds = sucursalesIds;
        }

        public void Actualizar(bool habilitado, Guid? actualizadoPorId, List<Guid>? sucursalesIds = null)
        {
            Habilitado = habilitado;
            ActualizadoPorId = actualizadoPorId;
            ActualizadoEn = DateTime.UtcNow;
            SucursalesPermitidasIds = sucursalesIds;
        }
    }
}
