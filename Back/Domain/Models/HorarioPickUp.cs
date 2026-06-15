namespace Back.Domain.Models
{
    public class HorarioPickUp
    {
        public Guid PuntoPickUpId { get; private set; }
        public int DiaSemana { get; private set; } // 0=Dom, 1=Lun, ..., 6=Sáb
        public TimeSpan? Apertura { get; private set; }
        public TimeSpan? Cierre { get; private set; }
        public bool Cerrado { get; private set; }

        private HorarioPickUp() { }

        public HorarioPickUp(Guid puntoPickUpId, int diaSemana, TimeSpan? apertura, TimeSpan? cierre, bool cerrado)
        {
            PuntoPickUpId = puntoPickUpId;
            DiaSemana = diaSemana;
            Actualizar(apertura, cierre, cerrado);
        }

        public void Actualizar(TimeSpan? apertura, TimeSpan? cierre, bool cerrado)
        {
            Apertura = apertura;
            Cierre = cierre;
            Cerrado = cerrado;
        }
    }
}
