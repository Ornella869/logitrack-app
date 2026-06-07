namespace Back.Domain.Models
{
    public class PlantillaEmail
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public string Provincia { get; set; } = string.Empty;
        public EventoEmailNotificacion Evento { get; set; }
        public string Asunto { get; set; } = string.Empty;
        public string Cuerpo { get; set; } = string.Empty;
        public DateTime ModificadoEn { get; set; } = DateTime.UtcNow;
        public Guid? ModificadoPorId { get; set; }

        private PlantillaEmail() { }

        public PlantillaEmail(string provincia, EventoEmailNotificacion evento, string asunto, string cuerpo, Guid modificadoPorId)
        {
            Provincia = provincia;
            Evento = evento;
            Asunto = asunto;
            Cuerpo = cuerpo;
            ModificadoPorId = modificadoPorId;
        }

        public void Actualizar(string asunto, string cuerpo, Guid modificadoPorId)
        {
            Asunto = asunto;
            Cuerpo = cuerpo;
            ModificadoEn = DateTime.UtcNow;
            ModificadoPorId = modificadoPorId;
        }
    }
}
