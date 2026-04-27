namespace Back.Domain.Models
{
    public enum OrigenCambioEstado
    {
        Manual = 0,
        QR = 1,
        Sistema = 2,
    }

    public class HistorialEstadoEnvio
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid PaqueteId { get; private set; }
        public PaqueteStatus EstadoNuevo { get; private set; }
        public DateTime FechaHora { get; private set; } = DateTime.UtcNow;
        public Guid? UsuarioId { get; private set; }
        public OrigenCambioEstado Origen { get; private set; } = OrigenCambioEstado.Manual;
        public string? Motivo { get; private set; }

        private HistorialEstadoEnvio() { }

        public HistorialEstadoEnvio(
            Guid paqueteId,
            PaqueteStatus estadoNuevo,
            Guid? usuarioId,
            OrigenCambioEstado origen = OrigenCambioEstado.Manual,
            string? motivo = null)
        {
            PaqueteId = paqueteId;
            EstadoNuevo = estadoNuevo;
            UsuarioId = usuarioId;
            Origen = origen;
            Motivo = motivo;
        }
    }
}
