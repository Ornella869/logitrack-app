namespace Back.Domain.Models
{
    public enum EstadoOverrideOjoPatron
    {
        Pendiente = 0,
        Aprobado = 1,
        Rechazado = 2,
    }

    public class OverrideOjoPatron
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid RepartidorId { get; private set; }
        public Guid? SupervisorId { get; private set; }
        public MomentoPruebaOjoPatron Momento { get; private set; }
        public string Motivo { get; private set; } = string.Empty;
        public EstadoOverrideOjoPatron Estado { get; private set; } = EstadoOverrideOjoPatron.Pendiente;
        public DateTime SolicitadoEn { get; private set; } = DateTime.UtcNow;
        public DateTime? ResueltoEn { get; private set; }
        public string? ComentarioSupervisor { get; private set; }

        private OverrideOjoPatron() { }

        public OverrideOjoPatron(Guid repartidorId, MomentoPruebaOjoPatron momento, string motivo)
        {
            RepartidorId = repartidorId;
            Momento = momento;
            Motivo = motivo.Trim();
        }

        public void Resolver(Guid supervisorId, bool aprobado, string? comentario)
        {
            SupervisorId = supervisorId;
            Estado = aprobado ? EstadoOverrideOjoPatron.Aprobado : EstadoOverrideOjoPatron.Rechazado;
            ComentarioSupervisor = string.IsNullOrWhiteSpace(comentario) ? null : comentario.Trim();
            ResueltoEn = DateTime.UtcNow;
        }
    }
}
