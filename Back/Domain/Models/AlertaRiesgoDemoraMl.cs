namespace Back.Domain.Models
{
    public class AlertaRiesgoDemoraMl
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public Guid PaqueteId { get; set; }
        public string CodigoSeguimiento { get; set; } = string.Empty;
        public float ProbabilidadDemora { get; set; }
        public string CausaPrincipal { get; set; } = string.Empty;
        public Guid SucursalId { get; set; }
        public DateTime GeneradaEn { get; init; } = DateTime.UtcNow;
        public bool Gestionada { get; set; }
        public DateTime? GestionadaEn { get; set; }
        public Guid? SupervisorId { get; set; }
        public bool? LlegoATiempo { get; set; }
    }
}
