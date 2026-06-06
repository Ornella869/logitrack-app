namespace Back.Domain.Models
{
    public enum EstadoEmailNotificacion
    {
        Pendiente = 0,
        Enviado = 1,
        Fallido = 2,
    }

    public enum EventoEmailNotificacion
    {
        SalidaRuta = 0,
        EntregaConfirmada = 1,
        LeadPlanes = 2,
        EncuestaPostEntrega = 3,
        CodigoEntrega = 4,
        CargadoEnVehiculo = 5,
        Demorado = 6,
        Cancelado = 7,
        LlegadaSucursalIntermedia = 8,
        FechaEstimadaEntrega = 9,
    }

    public class EmailNotificacion
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid? PaqueteId { get; private set; }
        public Guid? SucursalId { get; private set; }
        public string? CodigoSeguimiento { get; private set; }
        public string DestinatarioEmail { get; private set; } = string.Empty;
        public string Asunto { get; private set; } = string.Empty;
        public string Cuerpo { get; private set; } = string.Empty;
        public EventoEmailNotificacion Evento { get; private set; }
        public EstadoEmailNotificacion Estado { get; private set; } = EstadoEmailNotificacion.Pendiente;
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;
        public DateTime? EnviadoEn { get; private set; }
        public string? Error { get; private set; }
        public int Intentos { get; private set; }

        private EmailNotificacion() { }

        public EmailNotificacion(
            Guid? paqueteId,
            Guid? sucursalId,
            string? codigoSeguimiento,
            string destinatarioEmail,
            string asunto,
            string cuerpo,
            EventoEmailNotificacion evento)
        {
            PaqueteId = paqueteId;
            SucursalId = sucursalId;
            CodigoSeguimiento = codigoSeguimiento;
            DestinatarioEmail = destinatarioEmail.Trim();
            Asunto = asunto.Trim();
            Cuerpo = cuerpo.Trim();
            Evento = evento;
        }

        public void MarcarEnviado()
        {
            Estado = EstadoEmailNotificacion.Enviado;
            EnviadoEn = DateTime.UtcNow;
            Error = null;
            Intentos++;
        }

        public void MarcarFallido(string error)
        {
            Estado = EstadoEmailNotificacion.Fallido;
            Error = error;
            Intentos++;
        }
    }
}
