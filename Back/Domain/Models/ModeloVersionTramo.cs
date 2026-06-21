namespace Back.Domain.Models
{
    // G1L-162: cada reentrenamiento del modelo de estimación de tramos queda versionado y comparado
    // contra el método heurístico, para evaluar si el ML agrega valor real.
    public class ModeloVersionTramo
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public DateTime EntrenadoEn { get; init; } = DateTime.UtcNow;
        public int RegistrosUsados { get; init; }
        public double MaeModelo { get; init; }      // MAE del modelo ML entrenado (horas)
        public double MaeHeuristico { get; init; }  // MAE del método heurístico (estimación previa)
        public string Algoritmo { get; init; } = "FastTree";
        public string Version { get; init; } = string.Empty;
    }
}
