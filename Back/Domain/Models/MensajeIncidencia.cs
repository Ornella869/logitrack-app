namespace Back.Domain.Models
{
    public class MensajeIncidencia
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid IncidenciaId { get; private set; }
        public string De { get; private set; } = string.Empty;
        public string DeNombre { get; private set; } = string.Empty;
        public string DeRol { get; private set; } = string.Empty;
        public string Texto { get; private set; } = string.Empty;
        public DateTime Fecha { get; private set; } = DateTime.UtcNow;
        public bool LeidoPorRepartidor { get; set; }
        public bool LeidoPorSupervisor { get; set; }

        private MensajeIncidencia() { }

        public MensajeIncidencia(Guid incidenciaId, string de, string deNombre, string deRol, string texto)
        {
            IncidenciaId = incidenciaId;
            De = de;
            DeNombre = deNombre;
            DeRol = deRol;
            Texto = texto;
        }
    }
}
