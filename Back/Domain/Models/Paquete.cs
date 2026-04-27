using System.Text.Json.Serialization;
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
        public float Distancia { get; set; } = 0;


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

            if (Status != PaqueteStatus.EnTransito)
                throw new InvalidOperationException("Solo se pueden entregar paquetes que están en tránsito.");

            Status = PaqueteStatus.Entregado;
        }

        public void ReEnviar()
        {
            if (Status != PaqueteStatus.Cancelado)
                throw new InvalidOperationException("Solo se pueden reenviar paquetes cancelados.");

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

        public override string ToString()
        {
            return $"Paquete: {Id}, Código: {CodigoSeguimiento}, Peso: {Peso}, Altura: {Altura}, Ancho: {Ancho}, CreadoEn: {CreadoEn}, Status: {Status}, Remitente: {{ Nombre: {Remitente.Nombre}, Apellido: {Remitente.Apellido}, Direccion: {Remitente.Direccion.Calle}, {Remitente.Direccion.Ciudad} }}, Destinatario: {{ Nombre: {Destinatario.Nombre}, Apellido: {Destinatario.Apellido}, Direccion: {Destinatario.Direccion.Calle}, {Destinatario.Direccion.Ciudad} }}, Descripcion: {Descripcion}, RazonCancelacion: {RazonCancelacion}";
        }

    }
}
