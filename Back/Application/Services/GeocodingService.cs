using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using Back.Domain.Models;

namespace Back.Application.Services
{
    public class GeocodingService
    {
        private readonly HttpClient _httpClient;

        public GeocodingService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<Ubicacion?> GeocodeAsync(string direccion, string localidad)
        {
            var query = Uri.EscapeDataString($"{direccion}, {localidad}, Argentina");
            var url = $"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1";

            try
            {
                var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync();
                var results = JsonSerializer.Deserialize<NominatimResult[]>(json);
                if (results is null || results.Length == 0) return null;

                var first = results[0];
                if (!double.TryParse(first.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) ||
                    !double.TryParse(first.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
                    return null;

                return new Ubicacion(lat, lon);
            }
            catch
            {
                return null;
            }
        }

        private sealed class NominatimResult
        {
            [JsonPropertyName("lat")]
            public string Lat { get; set; } = string.Empty;

            [JsonPropertyName("lon")]
            public string Lon { get; set; } = string.Empty;
        }
    }
}
