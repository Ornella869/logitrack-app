using System.Text.Json.Serialization;
using Back.Application.Services;
using Back.Application.Util;
using Microsoft.EntityFrameworkCore;

namespace Back.Domain.Models
{
    public enum PaqueteStatus
    {
        EnSucursal,
        EnTransito,
        Entregado,
        Cancelado
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
        public PaqueteStatus Status { get; private set; } = PaqueteStatus.EnSucursal;
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

        public bool EstaEnSucursal => Status == PaqueteStatus.EnSucursal;


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

        public void EnTransito()
        {
            if (Status != PaqueteStatus.EnSucursal)
                throw new InvalidOperationException("Solo se pueden enviar paquetes que están en sucursal.");

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

            Status = PaqueteStatus.EnSucursal;
            RazonCancelacion = null;
        }

        public void Cancelar(string razon)
        {
            if (Status == PaqueteStatus.Entregado)
                throw new InvalidOperationException("No se puede cancelar un paquete entregado.");

            Status = PaqueteStatus.Cancelado;

            RazonCancelacion = razon;
        }

        public void VolverASucursal()
        {
            if(Status == PaqueteStatus.EnSucursal) return;

            if (Status != PaqueteStatus.EnTransito)
                throw new InvalidOperationException("Solo se pueden volver a sucursal los paquetes que están en tránsito.");

            Status = PaqueteStatus.EnSucursal;
        }

        public void CambiarEstado(PaqueteStatus status)
        {
            Status = status;
        }

        public override string ToString()
        {
            return $"Paquete: {Id}, Código: {CodigoSeguimiento}, Peso: {Peso}, Altura: {Altura}, Ancho: {Ancho}, CreadoEn: {CreadoEn}, Status: {Status}, Remitente: {{ Nombre: {Remitente.Nombre}, Apellido: {Remitente.Apellido}, Direccion: {Remitente.Direccion.Calle}, {Remitente.Direccion.Ciudad} }}, Destinatario: {{ Nombre: {Destinatario.Nombre}, Apellido: {Destinatario.Apellido}, Direccion: {Destinatario.Direccion.Calle}, {Destinatario.Direccion.Ciudad} }}, Descripcion: {Descripcion}, RazonCancelacion: {RazonCancelacion}";
        }

    }
}