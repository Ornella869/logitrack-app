namespace Back.Domain.Models
{
    public class CalificacionPickUp
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid PuntoPickUpId { get; private set; }
        public Guid PaqueteId { get; private set; }
        public int Estrellas { get; private set; }
        public string? Comentario { get; private set; }
        public string? AutorNombre { get; private set; }
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

        private CalificacionPickUp() { }

        public CalificacionPickUp(Guid puntoPickUpId, Guid paqueteId, int estrellas, string? comentario, string? autorNombre)
        {
            if (estrellas < 1 || estrellas > 5)
                throw new ArgumentException("Las estrellas deben estar entre 1 y 5.");

            PuntoPickUpId = puntoPickUpId;
            PaqueteId = paqueteId;
            Estrellas = estrellas;
            Comentario = string.IsNullOrWhiteSpace(comentario) ? null : comentario.Trim();
            AutorNombre = string.IsNullOrWhiteSpace(autorNombre) ? null : autorNombre.Trim();
        }
    }
}
