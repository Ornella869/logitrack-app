namespace Back.Domain.Models
{
    // G1L-61: configuración singleton del Ojo del Patrón. El Administrador ajusta
    // el umbral mínimo de activación vocal (alertness) para aprobar la prueba.
    public class ConfiguracionOjoPatron
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        // Épica D: umbral por provincia (lo configura el Gerente de esa provincia).
        public string Provincia { get; private set; } = string.Empty;
        public double UmbralAlertness { get; private set; }
        public DateTime ActualizadoEn { get; private set; } = DateTime.UtcNow;

        private ConfiguracionOjoPatron() { }

        public ConfiguracionOjoPatron(string provincia, double umbralAlertness)
        {
            Provincia = provincia;
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
