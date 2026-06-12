using System.Text.Json.Serialization;
using System.ComponentModel.DataAnnotations.Schema;
using Back.Application.Services;
using Back.Application.Util;
using Microsoft.EntityFrameworkCore;

namespace Back.Domain.Models
{
    public enum PaqueteStatus
    {
        PendienteDeCalendarizacion = 0,
        EnTransito = 1,
        Entregado = 2,
        Cancelado = 3,
        ListoParaSalir = 4,
        AsignadoAVehiculo = 5,
        CargadoEnVehiculo = 6,
        Demorado = 7,
        ListoParaRetirar = 8,
        // G1L-119: el repartidor cierra su jornada nocturna en medio de una ruta multi-día.
        EnTransitoDescanso = 9,
        // G1L-132: el repartidor depositó el paquete en el local; el socio aún no lo recibió.
        EntregadoEnPunto = 10,
        // El envío fue cancelado/fallido y debe volver físicamente a una sucursal.
        RetornandoASucursal = 11,
        // La sucursal confirmó por escaneo la recepción física del paquete retornado.
        RetornadoASucursal = 12,
    }

    public enum TipoEnvio
    {
        Comun = 0,
        Prioritario = 1,
    }

    public enum TipoPaquete
    {
        Comun = 0,
        Fragil = 1,
        Pesado = 2,
    }

    public class Paquete
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public string CodigoSeguimiento { get; set; } = TrackIdGenerator.GenerateTrackId();
        public string CodigoEntrega { get; private set; } = GenerarCodigoEntrega();
        public double Peso { get; set; }
        public double Altura { get; set; }
        public double Ancho { get; set; }
        [JsonIgnore]
        public float Prioridad { get; set; }
        public DateTime CreadoEn { get; init; } = DateTime.UtcNow;
        public PaqueteStatus Status { get; private set; } = PaqueteStatus.PendienteDeCalendarizacion;
        public TipoEnvio TipoEnvio { get; set; } = TipoEnvio.Comun;
        public TipoPaquete TipoPaquete { get; set; } = TipoPaquete.Comun;
        public Cliente Remitente { get; private set; }
        public Cliente Destinatario { get; private set; }
        public string DestinatarioCompleto => $"{Destinatario.Nombre} {Destinatario.Apellido}";
        public string? Descripcion { get; set; } = string.Empty;
        public string? RazonCancelacion { get; private set; }
        // G1L-82: motivo del estado "Demorado" (Problema mecánico, Corte de ruta, etc.)
        public string? RazonDemora { get; private set; }
        public float Distancia { get; set; } = 0;
        public float HorasEstimadasRuta { get; private set; } = 8f;
        // G1L-88: cotización congelada al momento del alta (no cambia si luego cambian las tarifas).
        public double CostoEnvio { get; private set; }
        public double CostoRecargoSeguridad { get; private set; }
        public bool EsZonaPeligrosa { get; private set; }
        public DateTime? FechaCalendarizada { get; private set; }
        public DateTime? FechaEstimadaEntrega { get; private set; }
        public int DiasEstimadosEntrega { get; private set; } = 1;
        public Guid? RepartidorAsignadoId { get; private set; }
        public Ubicacion? UbicacionActual { get; set; }
        public DateTime? UbicacionActualActualizadaEn { get; set; }
        // Épica D: sucursal responsable del envío (la que cubre la provincia de destino).
        public Guid? SucursalId { get; set; }
        public string? ProvinciaDestino { get; set; }
        public bool EsEnvioADomicilio { get; set; }
        public Guid? PuntoPickUpId { get; private set; }
        public bool RequiereRepartidorFullTime { get; private set; }
        [NotMapped]
        public string? NombreDestinoOperativo { get; set; }
        [NotMapped]
        public string? DireccionDestinoOperativo { get; set; }
        [NotMapped]
        public string? CiudadDestinoOperativo { get; set; }
        [NotMapped]
        public string? CpDestinoOperativo { get; set; }
        [NotMapped]
        public Ubicacion? UbicacionDestinoOperativa { get; set; }
        [NotMapped]
        public Guid? TramoOperativoId { get; set; }
        [NotMapped]
        public int? OrdenTramoOperativo { get; set; }
        [NotMapped]
        public string? EstadoTramoOperativo { get; set; }
        [NotMapped]
        public string? OrigenTramoOperativo { get; set; }
        [NotMapped]
        public string? DestinoTramoOperativo { get; set; }
        [NotMapped]
        public bool EsTramoOperativoActual { get; set; }


        [JsonPropertyName("prioridad")]
        public string PrioridadNivel => Prioridad switch
        {
            >= 6 => "Alta",
            >= 3 => "Media",
            _ => "Baja"
        };

        public bool EstaPendienteDeCalendarizacion => Status == PaqueteStatus.PendienteDeCalendarizacion;
        public bool IsEditable => Status == PaqueteStatus.PendienteDeCalendarizacion;


        private Paquete()
        {
        }

        private static string GenerarCodigoEntrega()
            => Random.Shared.Next(0, 1_000_000).ToString("D6");

        public Paquete(double peso, double altura, double ancho, Cliente origen, Cliente destino, float prioridad,float distancia, string? descripcion)
        {
            Peso = peso;
            Altura = altura;
            Ancho = ancho;
            Prioridad = prioridad;
            Remitente = origen;
            Destinatario = destino;
            Descripcion = descripcion;
            Distancia = distancia;
        }

        public Paquete(string codigoSeguimiento, double peso, double altura, double ancho, Cliente origen, Cliente destino, float prioridad,float distancia, string? descripcion)
            : this(peso, altura, ancho, origen, destino, prioridad, distancia, descripcion)
        {
            CodigoSeguimiento = codigoSeguimiento;
        }

        public void MarcarListoParaSalir()
        {
            if (Status != PaqueteStatus.PendienteDeCalendarizacion)
                throw new InvalidOperationException("Solo se pueden marcar como listos los paquetes pendientes de calendarización.");

            Status = PaqueteStatus.ListoParaSalir;
        }

        public void IniciarTransito()
        {
            if (Status != PaqueteStatus.ListoParaSalir)
                throw new InvalidOperationException("Solo se pueden enviar paquetes que están listos para salir.");

            Status = PaqueteStatus.EnTransito;
        }
        public void Entregar()
        {
            if (Status == PaqueteStatus.Cancelado)
                throw new InvalidOperationException("No se puede entregar un paquete cancelado.");

            // G1L-82: la entrega es válida también desde "Demorado" (no es estado final).
            if (Status != PaqueteStatus.EnTransito && Status != PaqueteStatus.Demorado && Status != PaqueteStatus.ListoParaRetirar)
                throw new InvalidOperationException("Solo se pueden entregar paquetes que están en tránsito o demorados.");

            Status = PaqueteStatus.Entregado;
            RazonDemora = null;
        }

        // Repartidor deposita el paquete en el local; el socio aún no lo confirmó.
        public void EntregarEnPunto()
        {
            if (!PuntoPickUpId.HasValue)
                throw new InvalidOperationException("El envio no tiene punto Pick Up asignado.");
            if (Status is not (PaqueteStatus.EnTransito or PaqueteStatus.Demorado or PaqueteStatus.EnTransitoDescanso))
                throw new InvalidOperationException("Solo se puede depositar en el punto un envío que esté en tránsito o demorado.");

            Status = PaqueteStatus.EntregadoEnPunto;
            RazonDemora = null;
        }

        // Socio del local confirma la recepción física → cliente puede venir a buscar.
        public void MarcarListoParaRetirar()
        {
            if (!PuntoPickUpId.HasValue)
                throw new InvalidOperationException("El envio no tiene punto Pick Up asignado.");
            if (Status != PaqueteStatus.EntregadoEnPunto)
                throw new InvalidOperationException("Solo se puede confirmar la recepción de un envío que el repartidor ya depositó en el punto.");

            Status = PaqueteStatus.ListoParaRetirar;
        }

        public void MarcarDemorado(string motivo)
        {
            if (string.IsNullOrWhiteSpace(motivo))
                throw new InvalidOperationException("El motivo de la demora es obligatorio.");

            if (Status != PaqueteStatus.EnTransito)
                throw new InvalidOperationException("Solo se pueden marcar como demorados los paquetes que están en tránsito.");

            Status = PaqueteStatus.Demorado;
            RazonDemora = motivo;
        }

        // G1L-82: el repartidor retoma el recorrido después de resolver el imprevisto.
        public void ContinuarTransito()
        {
            if (Status != PaqueteStatus.Demorado)
                throw new InvalidOperationException("Solo se puede continuar la ruta de paquetes demorados.");

            Status = PaqueteStatus.EnTransito;
            RazonDemora = null;
        }

        // G1L-119: el repartidor pausa su jornada al final del día en una ruta multi-día.
        public void PausarJornada()
        {
            if (Status != PaqueteStatus.EnTransito && Status != PaqueteStatus.Demorado)
                throw new InvalidOperationException("Solo se pueden pausar envíos en tránsito o demorados.");
            Status = PaqueteStatus.EnTransitoDescanso;
        }

        // G1L-119: el repartidor reanuda la ruta al día siguiente.
        public void ReanudarRuta()
        {
            if (Status != PaqueteStatus.EnTransitoDescanso)
                throw new InvalidOperationException("Solo se pueden reanudar envíos en descanso nocturno.");
            Status = PaqueteStatus.EnTransito;
        }

        public void ReEnviar()
        {
            if (Status is not (PaqueteStatus.Cancelado or PaqueteStatus.RetornadoASucursal))
                throw new InvalidOperationException("Solo se pueden reenviar paquetes cancelados o retornados a sucursal.");

            Status = PaqueteStatus.PendienteDeCalendarizacion;
            RazonCancelacion = null;
        }

        public void Cancelar(string razon)
        {
            if (Status == PaqueteStatus.Entregado)
                throw new InvalidOperationException("No se puede cancelar un paquete entregado.");

            Status = PaqueteStatus.Cancelado;

            RazonCancelacion = razon;
        }

        public void CancelarConRetorno(string razon)
        {
            if (Status == PaqueteStatus.Entregado)
                throw new InvalidOperationException("No se puede cancelar un paquete entregado.");

            RazonCancelacion = razon;
            RazonDemora = null;
            Status = PaqueteStatus.RetornandoASucursal;
        }

        public void ConfirmarRetornoSucursal()
        {
            if (Status != PaqueteStatus.RetornandoASucursal)
                throw new InvalidOperationException("Solo se puede recibir en sucursal un paquete que está retornando.");

            Status = PaqueteStatus.RetornadoASucursal;
            RepartidorAsignadoId = null;
            FechaCalendarizada = null;
            FechaEstimadaEntrega = null;
            RazonDemora = null;
        }

        public void VolverAListoParaSalir()
        {
            if (Status == PaqueteStatus.ListoParaSalir) return;

            if (Status != PaqueteStatus.EnTransito)
                throw new InvalidOperationException("Solo se pueden devolver a 'Listo para Salir' los paquetes que están en tránsito.");

            Status = PaqueteStatus.ListoParaSalir;
        }

        public void CambiarEstado(PaqueteStatus status)
        {
            Status = status;
        }

        // G1L-88: guarda la cotización calculada al dar de alta o editar el envío.
        public void AsignarCotizacion(double costoTotal, double costoRecargoSeguridad, bool esZonaPeligrosa)
        {
            CostoEnvio = costoTotal;
            CostoRecargoSeguridad = costoRecargoSeguridad;
            EsZonaPeligrosa = esZonaPeligrosa;
        }

        public void AsignarParaCalendarizacion(Guid repartidorId, DateTime fecha)
        {
            if (Status != PaqueteStatus.PendienteDeCalendarizacion)
                throw new InvalidOperationException("Solo se pueden calendarizar paquetes pendientes.");

            RepartidorAsignadoId = repartidorId;
            FechaCalendarizada = DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc);
            FechaEstimadaEntrega = DateTime.SpecifyKind(fecha.Date.AddDays(Math.Max(1, DiasEstimadosEntrega) - 1), DateTimeKind.Utc);
            Status = PaqueteStatus.AsignadoAVehiculo;
        }

        public void PrepararTramo(Guid sucursalId, double distanciaKm, bool requiereFullTime)
        {
            SucursalId = sucursalId;
            RepartidorAsignadoId = null;
            FechaCalendarizada = null;
            FechaEstimadaEntrega = null;
            Status = PaqueteStatus.PendienteDeCalendarizacion;
            RazonDemora = null;
            RazonCancelacion = null;
            HorasEstimadasRuta = (float)(Math.Max(0, distanciaKm) / 70d);
            RequiereRepartidorFullTime = requiereFullTime;
        }

        public void AsignarFechaEstimada(DateTime fechaEstimada)
        {
            FechaEstimadaEntrega = DateTime.SpecifyKind(fechaEstimada.Date, DateTimeKind.Utc);
            DiasEstimadosEntrega = Math.Max(1, (int)Math.Ceiling((fechaEstimada.Date - CreadoEn.Date).TotalDays));
        }

        public void LiberarAsignacion()
        {
            RepartidorAsignadoId = null;
            FechaCalendarizada = null;
            FechaEstimadaEntrega = null;
            // G1L-68: al "volver a calendarizar" también caemos desde ListoParaSalir,
            // no solo desde Asignado/Cargado. Si no incluimos ese estado, el paquete
            // queda con repartidor/fecha en null pero el Status sigue mostrándose
            // como ListoParaSalir en los listados y no se puede recalendarizar.
            if (Status == PaqueteStatus.AsignadoAVehiculo
                || Status == PaqueteStatus.CargadoEnVehiculo
                || Status == PaqueteStatus.ListoParaSalir
                || Status == PaqueteStatus.EnTransito
                || Status == PaqueteStatus.Demorado
                || Status == PaqueteStatus.ListoParaRetirar
                || Status == PaqueteStatus.RetornadoASucursal)
            {
                Status = PaqueteStatus.PendienteDeCalendarizacion;
                RazonDemora = null;
                RazonCancelacion = null;
            }
        }

        public void ActualizarDatos(
            Cliente remitente,
            Cliente destinatario,
            double peso,
            TipoEnvio tipoEnvio,
            TipoPaquete tipoPaquete,
            string? descripcion,
            float distancia,
            float prioridad)
        {
            if (Status != PaqueteStatus.PendienteDeCalendarizacion)
                throw new InvalidOperationException("Solo se pueden editar paquetes pendientes de calendarización.");

            if (peso <= 0)
                throw new InvalidOperationException("El peso debe ser mayor a 0.");

            Remitente = remitente;
            Destinatario = destinatario;
            Peso = peso;
            TipoEnvio = tipoEnvio;
            TipoPaquete = tipoPaquete;
            Descripcion = descripcion;
            Distancia = distancia;
            Prioridad = prioridad;
        }

        public void ActualizarEstimacionEntrega(float distanciaKm)
        {
            const int JORNADA_HORAS = 8;
            double distanciaRealKm = distanciaKm < 50 ? distanciaKm * 1.4 : distanciaKm * 1.25;
            double velocidadPromedioKmH = 70;
            double kmPorJornada = JORNADA_HORAS * velocidadPromedioKmH;

            DiasEstimadosEntrega = Math.Max(1, (int)Math.Ceiling(distanciaRealKm / kmPorJornada));
            HorasEstimadasRuta = (float)(distanciaRealKm / velocidadPromedioKmH);
            if (FechaCalendarizada.HasValue)
            {
                var current = FechaCalendarizada.Value.Date;
                int diasHabilesAAgregar = DiasEstimadosEntrega - 1;
                while (diasHabilesAAgregar > 0)
                {
                    current = current.AddDays(1);
                    if (current.DayOfWeek != DayOfWeek.Sunday)
                    {
                        diasHabilesAAgregar--;
                    }
                }
                FechaEstimadaEntrega = DateTime.SpecifyKind(current, DateTimeKind.Utc);
            }
        }

        public void AsignarPuntoPickUp(Guid puntoPickUpId)
        {
            var yaTeniaPickUp = PuntoPickUpId.HasValue;
            PuntoPickUpId = puntoPickUpId;
            EsEnvioADomicilio = false;

            if (!yaTeniaPickUp && CostoEnvio > 0)
                AplicarDescuentoPickUp();
        }

        public void AplicarDescuentoPickUp()
        {
            if (CostoEnvio > 0)
                CostoEnvio = Math.Round(CostoEnvio * 0.75, 2);
        }

        public override string ToString()
        {
            return $"Paquete: {Id}, Código: {CodigoSeguimiento}, Peso: {Peso}, Altura: {Altura}, Ancho: {Ancho}, CreadoEn: {CreadoEn}, Status: {Status}, Remitente: {{ Nombre: {Remitente.Nombre}, Apellido: {Remitente.Apellido}, Direccion: {Remitente.Direccion.Calle}, {Remitente.Direccion.Ciudad} }}, Destinatario: {{ Nombre: {Destinatario.Nombre}, Apellido: {Destinatario.Apellido}, Direccion: {Destinatario.Direccion.Calle}, {Destinatario.Direccion.Ciudad} }}, Descripcion: {Descripcion}, RazonCancelacion: {RazonCancelacion}";
        }

    }
}
