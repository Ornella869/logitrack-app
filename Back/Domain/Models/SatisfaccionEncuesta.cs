namespace Back.Domain.Models
{
    public class SatisfaccionEncuesta
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid PaqueteId { get; private set; }
        public Guid Token { get; private set; } = Guid.NewGuid();
        public int? Calificacion { get; private set; }
        public string? Comentario { get; private set; }
        public DateTime? RespuestaEn { get; private set; }
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

        public Paquete Paquete { get; private set; } = null!;

        private SatisfaccionEncuesta() { }

        public SatisfaccionEncuesta(Guid paqueteId)
        {
            PaqueteId = paqueteId;
        }

        public void Responder(int calificacion, string? comentario)
        {
            if (calificacion < 1 || calificacion > 5)
                throw new InvalidOperationException("La calificación debe ser entre 1 y 5.");
            if (RespuestaEn.HasValue)
                throw new InvalidOperationException("Esta encuesta ya fue respondida.");
            Calificacion = calificacion;
            Comentario = string.IsNullOrWhiteSpace(comentario) ? null : comentario.Trim();
            RespuestaEn = DateTime.UtcNow;
        }
    }
}
