namespace Back.Domain.Models
{
    // G1L-87: configuración singleton de tarifas base del sistema.
    public class ConfiguracionTarifa
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        // Épica D: una configuración por provincia (antes era singleton global).
        public string Provincia { get; private set; } = string.Empty;
        public double PrecioPorKg { get; private set; }
        public double PrecioPorKm { get; private set; }
        public double PorcentajeRecargoZonaPeligrosa { get; private set; }
        public DateTime ActualizadoEn { get; private set; } = DateTime.UtcNow;

        private ConfiguracionTarifa() { }

        public ConfiguracionTarifa(string provincia, double precioPorKg, double precioPorKm, double porcentajeRecargo)
        {
            Provincia = provincia;
            Actualizar(precioPorKg, precioPorKm, porcentajeRecargo);
        }

        public void Actualizar(double precioPorKg, double precioPorKm, double porcentajeRecargo)
        {
            if (precioPorKg < 0 || precioPorKm < 0 || porcentajeRecargo < 0)
                throw new InvalidOperationException("Los valores de tarifa no pueden ser negativos.");

            PrecioPorKg = precioPorKg;
            PrecioPorKm = precioPorKm;
            PorcentajeRecargoZonaPeligrosa = porcentajeRecargo;
            ActualizadoEn = DateTime.UtcNow;
        }
    }
}
