namespace Back.Domain.Models
{
    public enum SolicitudComercialEstado
    {
        Pendiente,
        Contactado,
        Cerrado,
        Descartado,
    }

    public class SolicitudComercial
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public string NombreEmpresa { get; private set; }
        public string NombreContacto { get; private set; }
        public string Email { get; private set; }
        public string Telefono { get; private set; }
        public string PlanInteres { get; private set; }
        public string? Comentarios { get; private set; }
        public SolicitudComercialEstado Estado { get; private set; } = SolicitudComercialEstado.Pendiente;
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

        private SolicitudComercial()
        {
            NombreEmpresa = string.Empty;
            NombreContacto = string.Empty;
            Email = string.Empty;
            Telefono = string.Empty;
            PlanInteres = string.Empty;
        }

        public SolicitudComercial(
            string nombreEmpresa,
            string nombreContacto,
            string email,
            string telefono,
            string planInteres,
            string? comentarios)
        {
            NombreEmpresa = nombreEmpresa.Trim();
            NombreContacto = nombreContacto.Trim();
            Email = email.Trim();
            Telefono = telefono.Trim();
            PlanInteres = planInteres.Trim();
            Comentarios = string.IsNullOrWhiteSpace(comentarios) ? null : comentarios.Trim();
        }
    }
}
