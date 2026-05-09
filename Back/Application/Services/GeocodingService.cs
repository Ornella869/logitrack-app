using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Back.Domain.Models;

namespace Back.Application.Services
{
    // Geocodificación contra Nominatim (OpenStreetMap).
    // Usamos búsqueda estructurada (street/city/postalcode) + countrycodes=ar
    // para reducir falsos positivos como "Roque Sáenz Peña 888" cayendo en
    // otra provincia. Si la estructurada no resuelve, intentamos un free-text
    // con la cadena completa.
    //
    // Para mejorar la precisión "a nivel calle" pedimos varios candidatos y
    // elegimos el que coincide en altura (house_number). Sin esto, Nominatim
    // suele devolver el primer match que puede caer 2-3 cuadras del número real.
    //
    // Cache process-wide: Nominatim limita a ~1 req/seg y direcciones que ya
    // resolvimos no necesitan re-pegar. Persiste mientras el proceso vive.
    public class GeocodingService
    {
        private const string BaseUrl = "https://nominatim.openstreetmap.org/search";
        private const string CountryCode = "ar";
        private const int CandidateLimit = 5;

        private static readonly ConcurrentDictionary<string, Ubicacion?> Cache = new();
        private static readonly Regex HouseNumberRx = new(@"\b(\d{1,5})(?:[A-Za-z]\b|\b)", RegexOptions.Compiled);

        private readonly HttpClient _httpClient;

        public GeocodingService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public Task<Ubicacion?> GeocodeAsync(string direccion, string localidad)
            => GeocodeAsync(direccion, localidad, codigoPostal: null, provincia: null);

        public Task<Ubicacion?> GeocodeAsync(string direccion, string localidad, string? codigoPostal)
            => GeocodeAsync(direccion, localidad, codigoPostal, provincia: null);

        public async Task<Ubicacion?> GeocodeAsync(string direccion, string localidad, string? codigoPostal, string? provincia)
        {
            var direccionTrim = (direccion ?? string.Empty).Trim();
            var localidadTrim = (localidad ?? string.Empty).Trim();
            var cpTrim = (codigoPostal ?? string.Empty).Trim();
            var provinciaTrim = (provincia ?? string.Empty).Trim();

            var cacheKey = $"{direccionTrim}|{localidadTrim}|{cpTrim}|{provinciaTrim}".ToLowerInvariant();
            if (Cache.TryGetValue(cacheKey, out var cached) && cached is not null) return cached;

            var alturaPedida = ExtraerAltura(direccionTrim);

            // 1) Estructurada con CP + provincia — la más precisa.
            if (!string.IsNullOrEmpty(cpTrim))
            {
                var ubicCp = await SearchAsync(BuildStructured(direccionTrim, localidadTrim, cpTrim, provinciaTrim), alturaPedida, cpTrim);
                if (ubicCp is not null) { Cache[cacheKey] = ubicCp; return ubicCp; }
            }

            // 2) Estructurada sin CP.
            var ubicEstructurada = await SearchAsync(BuildStructured(direccionTrim, localidadTrim, postalcode: null, state: provinciaTrim), alturaPedida, cpTrim);
            if (ubicEstructurada is not null) { Cache[cacheKey] = ubicEstructurada; return ubicEstructurada; }

            // 3) Free-text como último recurso (texto + AR).
            var query = string.IsNullOrEmpty(cpTrim)
                ? $"{direccionTrim}, {localidadTrim}{(string.IsNullOrEmpty(provinciaTrim) ? "" : ", " + provinciaTrim)}, Argentina"
                : $"{direccionTrim}, {localidadTrim}, {cpTrim}{(string.IsNullOrEmpty(provinciaTrim) ? "" : ", " + provinciaTrim)}, Argentina";
            var ubicFree = await SearchAsync(BuildFreeText(query), alturaPedida, cpTrim);
            if (ubicFree is not null) { Cache[cacheKey] = ubicFree; return ubicFree; }

            // 4) Último recurso: localidad + CP (centro de la ciudad). Sirve para
            // la sucursal en el mapa: aunque la calle no resuelva, al menos se pinta
            // en el barrio/ciudad correctos.
            if (!string.IsNullOrEmpty(localidadTrim) || !string.IsNullOrEmpty(cpTrim))
            {
                var fallbackQuery = string.IsNullOrEmpty(cpTrim)
                    ? $"{localidadTrim}, Argentina"
                    : $"{localidadTrim}, {cpTrim}, Argentina";
                var ubicFallback = await SearchAsync(BuildFreeText(fallbackQuery), alturaPedida: null, expectedPostalCode: null);
                if (ubicFallback is not null) { Cache[cacheKey] = ubicFallback; return ubicFallback; }
            }

            return null;
        }

        private static int? ExtraerAltura(string direccion)
        {
            // "Av. Corrientes 1234" → 1234. Tolera "1234A".
            var m = HouseNumberRx.Match(direccion);
            if (!m.Success) return null;
            return int.TryParse(m.Groups[1].Value, out var n) ? n : (int?)null;
        }

        private static Dictionary<string, string?> BuildStructured(string street, string city, string? postalcode, string? state = null)
        {
            var p = new Dictionary<string, string?>
            {
                ["street"] = street,
                ["city"] = city,
                ["country"] = "Argentina",
                ["countrycodes"] = CountryCode,
                ["format"] = "json",
                ["limit"] = CandidateLimit.ToString(),
                ["addressdetails"] = "1",
                ["accept-language"] = "es",
            };
            if (!string.IsNullOrEmpty(postalcode)) p["postalcode"] = postalcode;
            if (!string.IsNullOrEmpty(state)) p["state"] = state;
            return p;
        }

        private static Dictionary<string, string?> BuildFreeText(string query)
            => new()
            {
                ["q"] = query,
                ["countrycodes"] = CountryCode,
                ["format"] = "json",
                ["limit"] = CandidateLimit.ToString(),
                ["addressdetails"] = "1",
                ["accept-language"] = "es",
            };

        private async Task<Ubicacion?> SearchAsync(Dictionary<string, string?> parameters, int? alturaPedida, string? expectedPostalCode)
        {
            var qs = string.Join("&", parameters
                .Where(kv => !string.IsNullOrEmpty(kv.Value))
                .Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value!)}"));
            var url = $"{BaseUrl}?{qs}";

            try
            {
                using var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync();
                var results = JsonSerializer.Deserialize<NominatimResult[]>(json);
                if (results is null || results.Length == 0) return null;

                // Filtramos defensivamente por país AR.
                var enArgentina = results.Where(r =>
                    string.IsNullOrEmpty(r.Address?.CountryCode) ||
                    string.Equals(r.Address!.CountryCode, CountryCode, StringComparison.OrdinalIgnoreCase))
                    .ToList();
                if (enArgentina.Count == 0) return null;

                // Scoring para elegir el mejor candidato:
                //   1) match exacto de house_number con la altura pedida
                //   2) match (incluso parcial) del CP solicitado
                //   3) menor distancia |house_number - altura_pedida|
                //   4) mayor "importance" como desempate
                var expectedCp = expectedPostalCode?.Trim() ?? string.Empty;
                NominatimResult chosen = enArgentina
                    .Select(r =>
                    {
                        var hn = int.TryParse(r.Address?.HouseNumber, out var n) ? n : (int?)null;
                        var hnMatch = alturaPedida.HasValue && hn.HasValue && hn.Value == alturaPedida.Value;
                        var hnDist = alturaPedida.HasValue && hn.HasValue
                            ? Math.Abs(hn.Value - alturaPedida.Value)
                            : int.MaxValue;
                        var cpMatch = !string.IsNullOrEmpty(expectedCp)
                                      && !string.IsNullOrEmpty(r.Address?.Postcode)
                                      && string.Equals(r.Address.Postcode.Trim(), expectedCp, StringComparison.OrdinalIgnoreCase);
                        return new { R = r, HnMatch = hnMatch ? 1 : 0, CpMatch = cpMatch ? 1 : 0, HnDist = hnDist, Imp = r.Importance ?? 0 };
                    })
                    .OrderByDescending(x => x.HnMatch)
                    .ThenByDescending(x => x.CpMatch)
                    .ThenBy(x => x.HnDist)
                    .ThenByDescending(x => x.Imp)
                    .First()
                    .R;

                if (!double.TryParse(chosen.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) ||
                    !double.TryParse(chosen.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
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
            [JsonPropertyName("lat")] public string Lat { get; set; } = string.Empty;
            [JsonPropertyName("lon")] public string Lon { get; set; } = string.Empty;
            [JsonPropertyName("importance")] public double? Importance { get; set; }
            [JsonPropertyName("address")] public NominatimAddress? Address { get; set; }
        }

        private sealed class NominatimAddress
        {
            [JsonPropertyName("country_code")] public string? CountryCode { get; set; }
            [JsonPropertyName("house_number")] public string? HouseNumber { get; set; }
            [JsonPropertyName("road")] public string? Road { get; set; }
            [JsonPropertyName("state")] public string? State { get; set; }
            [JsonPropertyName("postcode")] public string? Postcode { get; set; }
        }
    }
}
