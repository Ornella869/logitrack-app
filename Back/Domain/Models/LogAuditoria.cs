namespace Back.Domain.Models
{
    public enum TipoAccion
    {
        CreacionEnvio,
        EdicionEnvio,
        CambioEstadoEnvio,
        CancelacionEnvio,
        Calendarizacion,
        Recalendarizacion,
        CreacionUsuario,
        DesactivacionUsuario,
        CambioRol,
        LoginFallido,
        Otro,
    }

    public class LogAuditoria
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public DateTime Timestamp { get; private set; } = DateTime.UtcNow;
        public Guid? UsuarioId { get; private set; }
        public string UsuarioNombre { get; private set; } = string.Empty;
        public string UsuarioRol { get; private set; } = string.Empty;
        public TipoAccion Accion { get; private set; }
        public string? RecursoId { get; private set; } // ej: tracking ID o GUID
        public string Descripcion { get; private set; } = string.Empty;
        public string? Contexto { get; private set; } // JSON o texto libre adicional

        private LogAuditoria() { }

        public LogAuditoria(
            Guid? usuarioId,
            string usuarioNombre,
            string usuarioRol,
            TipoAccion accion,
            string descripcion,
            string? recursoId = null,
            string? contexto = null)
        {
            UsuarioId = usuarioId;
            UsuarioNombre = usuarioNombre;
            UsuarioRol = usuarioRol;
            Accion = accion;
            Descripcion = descripcion;
            RecursoId = recursoId;
            Contexto = contexto;
        }
    }
}
