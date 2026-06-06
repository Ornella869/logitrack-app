namespace Back.Domain.Models
{
    public enum TramoEnvioStatus
    {
        Bloqueado = 0,
        PendienteDeCalendarizacion = 1,
        Asignado = 2,
        EnTransito = 3,
        RecibidoEnSucursal = 4,
        Entregado = 5,
        Cancelado = 6,
    }

    public class TramoEnvio
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public Guid PaqueteId { get; private set; }
        public int Orden { get; private set; }
        public Guid SucursalOrigenId { get; private set; }
        public Guid? SucursalDestinoId { get; private set; }
        public Guid? RepartidorId { get; private set; }
        public bool EsUltimaMilla { get; private set; }
        public double DistanciaKm { get; private set; }
        public double HorasEstimadas { get; private set; }
        public TramoEnvioStatus Estado { get; private set; }
        public DateTime? IniciadoEn { get; private set; }
        public DateTime? FinalizadoEn { get; private set; }

        private TramoEnvio()
        {
        }

        public TramoEnvio(
            Guid paqueteId,
            int orden,
            Guid sucursalOrigenId,
            Guid? sucursalDestinoId,
            bool esUltimaMilla,
            double distanciaKm,
            bool habilitado)
        {
            PaqueteId = paqueteId;
            Orden = orden;
            SucursalOrigenId = sucursalOrigenId;
            SucursalDestinoId = sucursalDestinoId;
            EsUltimaMilla = esUltimaMilla;
            DistanciaKm = Math.Max(0, distanciaKm);
            HorasEstimadas = DistanciaKm / 70d;
            Estado = habilitado
                ? TramoEnvioStatus.PendienteDeCalendarizacion
                : TramoEnvioStatus.Bloqueado;
        }

        public void Asignar(Guid repartidorId)
        {
            if (Estado != TramoEnvioStatus.PendienteDeCalendarizacion)
                throw new InvalidOperationException("El tramo no está pendiente de calendarización.");

            RepartidorId = repartidorId;
            Estado = TramoEnvioStatus.Asignado;
        }

        public void Iniciar()
        {
            if (Estado is not (TramoEnvioStatus.Asignado or TramoEnvioStatus.PendienteDeCalendarizacion))
                return;

            Estado = TramoEnvioStatus.EnTransito;
            IniciadoEn = DateTime.UtcNow;
        }

        public void RecibirEnSucursal()
        {
            if (EsUltimaMilla || !SucursalDestinoId.HasValue)
                throw new InvalidOperationException("El tramo no finaliza en una sucursal.");
            if (Estado != TramoEnvioStatus.EnTransito)
                throw new InvalidOperationException("El tramo todavía no está en tránsito.");

            Estado = TramoEnvioStatus.RecibidoEnSucursal;
            FinalizadoEn = DateTime.UtcNow;
        }

        public void Habilitar()
        {
            if (Estado != TramoEnvioStatus.Bloqueado)
                throw new InvalidOperationException("El tramo ya fue habilitado.");

            Estado = TramoEnvioStatus.PendienteDeCalendarizacion;
        }

        public void Entregar()
        {
            Estado = TramoEnvioStatus.Entregado;
            FinalizadoEn = DateTime.UtcNow;
        }

        public void Cancelar()
        {
            Estado = TramoEnvioStatus.Cancelado;
            FinalizadoEn = DateTime.UtcNow;
        }

        public void VolverAPendiente()
        {
            RepartidorId = null;
            IniciadoEn = null;
            FinalizadoEn = null;
            Estado = TramoEnvioStatus.PendienteDeCalendarizacion;
        }
    }
}
