namespace Back.Domain.Models
{
    public enum ResultadoPruebaOjoPatron
    {
        Aprobada = 0,
        // (Obsoleto) variante anterior que permitía continuar tras 3 intentos.
        AprobadaPorMaxIntentos = 1,
        // Gate estricto: la prueba no superó el umbral. No habilita el inicio de ruta.
        Rechazada = 2,
    }

    // G1L-60 / G1L-61: resultado de la prueba acústica del Ojo del Patrón.
    // NO se almacena el audio: solo los scores numéricos del análisis y el veredicto.
    public class PruebaOjoPatron
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public Guid UsuarioId { get; private set; }
        public DateTime FechaHora { get; private set; } = DateTime.UtcNow;
        // Análisis de emociones (HuBERT superb-er): 4 clases en [0,1].
        public double ScoreNeu { get; private set; }
        public double ScoreHap { get; private set; }
        public double ScoreSad { get; private set; }
        public double ScoreAng { get; private set; }
        // Indicador de activación vocal usado para el veredicto (neu + hap).
        public double AlertnessScore { get; private set; }
        public double UmbralUsado { get; private set; }
        public int Intentos { get; private set; }
        public ResultadoPruebaOjoPatron Resultado { get; private set; }

        private PruebaOjoPatron() { }

        public PruebaOjoPatron(
            Guid usuarioId,
            double scoreNeu, double scoreHap, double scoreSad, double scoreAng,
            double alertnessScore, double umbralUsado, int intentos,
            ResultadoPruebaOjoPatron resultado)
        {
            UsuarioId = usuarioId;
            ScoreNeu = scoreNeu;
            ScoreHap = scoreHap;
            ScoreSad = scoreSad;
            ScoreAng = scoreAng;
            AlertnessScore = alertnessScore;
            UmbralUsado = umbralUsado;
            Intentos = intentos;
            Resultado = resultado;
        }
    }
}
