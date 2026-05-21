namespace Back.Domain.Models
{
    // G1L-59: consentimiento informado (Ley 25.326) del Repartidor para el tratamiento
    // de sus datos biométricos de voz en la prueba "Ojo del Patrón".
    public class ConsentimientoOjoPatron
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public Guid UsuarioId { get; private set; }
        public string VersionTexto { get; private set; } = string.Empty;
        public DateTime AceptadoEn { get; private set; } = DateTime.UtcNow;
        public DateTime? RevocadoEn { get; private set; }

        public bool Vigente => RevocadoEn == null;

        private ConsentimientoOjoPatron() { }

        public ConsentimientoOjoPatron(Guid usuarioId, string versionTexto)
        {
            UsuarioId = usuarioId;
            VersionTexto = versionTexto;
        }

        public void Revocar()
        {
            if (RevocadoEn == null)
                RevocadoEn = DateTime.UtcNow;
        }
    }
}
