using Microsoft.EntityFrameworkCore;

namespace Back.Domain.Models
{
    [Owned]
    public class Direccion
    {
        public string Calle { get; set; } = string.Empty;
        public string Ciudad { get; set; } = string.Empty;
        public string CP { get; set; } = string.Empty;
        public string? Referencia { get; set; }
        public Ubicacion? Ubicacion { get; set; }

        private Direccion()
        {
            
        }

        public Direccion(string calle, string ciudad, string cp, string? referencia = null, Ubicacion? ubicacion = null)
        {
            Calle = calle;
            Ciudad = ciudad;
            CP = cp;
            Referencia = referencia;
            Ubicacion = ubicacion;
        }
    }
    [Owned]
    public class Ubicacion
    {
        public double Latitud { get; set; }
        public double Longitud { get; set; }

        private Ubicacion()
        {
        }

        public Ubicacion(double latitud, double longitud)
        {
            Latitud = latitud;
            Longitud = longitud;
        }
    }

    [Owned]
    public class Cliente
    {
        public string Nombre { get; private set; }
        public string Apellido { get; private set; }
        public string? Telefono { get; private set; }
        public Direccion Direccion { get; private set; }


        private Cliente()
        {
        }

        public Cliente(string nombre, string apellido, Direccion direccion, string? telefono = null)
        {
            Nombre = nombre;
            Apellido = apellido;
            Direccion = direccion;
            Telefono = telefono;
        }


        public override string ToString()
        {
            return Nombre + " " + Apellido;
        }
    }
}

 