namespace Back.Domain.Models
{
    // G1L-61: configuración singleton del Ojo del Patrón. El Administrador ajusta
    // el umbral mínimo de activación vocal (alertness) para aprobar la prueba.
    public class ConfiguracionOjoPatron
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public double UmbralAlertness { get; private set; }
        public DateTime ActualizadoEn { get; private set; } = DateTime.UtcNow;

        private ConfiguracionOjoPatron() { }

        public ConfiguracionOjoPatron(double umbralAlertness)
        {
            Actualizar(umbralAlertness);
        }

        public void Actualizar(double umbralAlertness)
        {
            if (umbralAlertness < 0 || umbralAlertness > 1)
                throw new InvalidOperationException("El umbral debe estar entre 0 y 1.");
            UmbralAlertness = umbralAlertness;
            ActualizadoEn = DateTime.UtcNow;
        }
    }
}
