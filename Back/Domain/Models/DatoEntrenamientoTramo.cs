namespace Back.Domain.Models
{
    public class DatoEntrenamientoTramo
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public Guid PaqueteId { get; set; }
        public Guid? TramoId { get; set; }
        public Guid SucursalOrigenId { get; set; }
        public Guid SucursalDestinoId { get; set; }

        public DateTime FechaSalida { get; set; }
        public DateTime FechaLlegada { get; set; }
        public double TiempoRealHoras { get; set; }

        public double PesoKg { get; set; }
        public string TipoEnvio { get; set; } = string.Empty;
        public bool EsPrioritario { get; set; }

        public int DiaSemana { get; set; }
        public int HoraSalida { get; set; }

        public int CargaSucursalOrigen { get; set; }
        public int RepartidoresActivosDestino { get; set; }

        public bool TuvoDemora { get; set; }
        public double? EstimacionPreviaHoras { get; set; }
        public double? ErrorAbsolutoHoras { get; set; }

        public DateTime RegistradoEn { get; init; } = DateTime.UtcNow;
    }
}
