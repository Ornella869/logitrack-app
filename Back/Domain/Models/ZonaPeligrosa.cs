namespace Back.Domain.Models
{
    // G1L-86: zona de riesgo definida como un rectángulo geográfico sobre el mapa.
    // No toda una localidad/CP es peligrosa, por eso se delimita un área (bounding box).
    public class ZonaPeligrosa
    {
        public Guid Id { get; init; } = Guid.NewGuid();
        public string Nombre { get; private set; } = string.Empty;
        public double LatMin { get; private set; }
        public double LatMax { get; private set; }
        public double LngMin { get; private set; }
        public double LngMax { get; private set; }
        public bool Activa { get; private set; } = true;
        public DateTime CreadoEn { get; init; } = DateTime.UtcNow;

        private ZonaPeligrosa() { }

        public ZonaPeligrosa(string nombre, double latMin, double latMax, double lngMin, double lngMax)
        {
            if (string.IsNullOrWhiteSpace(nombre))
                throw new InvalidOperationException("El nombre de la zona es obligatorio.");

            Nombre = nombre;
            // Normalizamos por si las esquinas vienen invertidas.
            LatMin = Math.Min(latMin, latMax);
            LatMax = Math.Max(latMin, latMax);
            LngMin = Math.Min(lngMin, lngMax);
            LngMax = Math.Max(lngMin, lngMax);
        }

        public void Desactivar() => Activa = false;
        public void Activar() => Activa = true;

        public bool Contiene(double lat, double lng)
            => Activa && lat >= LatMin && lat <= LatMax && lng >= LngMin && lng <= LngMax;
    }
}
