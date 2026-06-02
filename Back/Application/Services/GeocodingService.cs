using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using Back.Domain.Models;

namespace Back.Application.Services
{
    // Geocodificación en dos capas:
    //   0) Georef (datos.gob.ar) — API oficial argentina, mejor precisión para
    //      calles del padrón nacional. Acepta dirección + localidad + (provincia).
    //   1) Nominatim (OpenStreetMap) — fallback cuando Georef no resuelve.
    //      Se intenta primero de forma estructurada (street/city/postalcode)
    //      y luego con free-text. Pedimos varios candidatos y elegimos el que
    //      mejor coincide con la altura (house_number) y el CP.
    //
    // Cache process-wide: reduce llamadas repetidas y respeta los rate-limits
    // de ambas APIs. Persiste mientras el proceso vive.
    public class GeocodingService
    {
        private const string NominatimBaseUrl = "https://nominatim.openstreetmap.org/search";
        private const string GeorefBaseUrl = "https://apis.datos.gob.ar/georef/api/direcciones";
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
            => await GeocodeInternalAsync(direccion, localidad, codigoPostal, provincia, permitirFallbackLocalidad: true);

        public async Task<Ubicacion?> GeocodeExactAsync(string direccion, string localidad, string? codigoPostal, string? provincia)
            => await GeocodeInternalAsync(direccion, localidad, codigoPostal, provincia, permitirFallbackLocalidad: false);

        private async Task<Ubicacion?> GeocodeInternalAsync(
            string direccion,
            string localidad,
            string? codigoPostal,
            string? provincia,
            bool permitirFallbackLocalidad)
        {
            var direccionTrim = (direccion ?? string.Empty).Trim();
            var localidadTrim = (localidad ?? string.Empty).Trim();
            var cpTrim = (codigoPostal ?? string.Empty).Trim();
            var provinciaTrim = (provincia ?? string.Empty).Trim();

            var cacheKey = $"{direccionTrim}|{localidadTrim}|{cpTrim}|{provinciaTrim}|strict:{!permitirFallbackLocalidad}".ToLowerInvariant();
            if (Cache.TryGetValue(cacheKey, out var cached) && cached is not null) return cached;

            var alturaPedida = ExtraerAltura(direccionTrim);

            // 0) Georef — fuente primaria para Argentina.
            var ubicGeoref = await TryGeoref(direccionTrim, localidadTrim, provinciaTrim);
            if (ubicGeoref is not null) { Cache[cacheKey] = ubicGeoref; return ubicGeoref; }

            // 1) Nominatim estructurada con CP + provincia — la más precisa.
            if (!string.IsNullOrEmpty(cpTrim))
            {
                var ubicCp = await SearchNominatim(BuildStructured(direccionTrim, localidadTrim, cpTrim, provinciaTrim), alturaPedida, cpTrim);
                if (ubicCp is not null) { Cache[cacheKey] = ubicCp; return ubicCp; }
            }

            // 2) Nominatim estructurada sin CP.
            var ubicEstructurada = await SearchNominatim(BuildStructured(direccionTrim, localidadTrim, postalcode: null, state: provinciaTrim), alturaPedida, cpTrim);
            if (ubicEstructurada is not null) { Cache[cacheKey] = ubicEstructurada; return ubicEstructurada; }

            // 3) Nominatim free-text.
            var query = string.IsNullOrEmpty(cpTrim)
                ? $"{direccionTrim}, {localidadTrim}{(string.IsNullOrEmpty(provinciaTrim) ? "" : ", " + provinciaTrim)}, Argentina"
                : $"{direccionTrim}, {localidadTrim}, {cpTrim}{(string.IsNullOrEmpty(provinciaTrim) ? "" : ", " + provinciaTrim)}, Argentina";
            var ubicFree = await SearchNominatim(BuildFreeText(query), alturaPedida, cpTrim);
            if (ubicFree is not null) { Cache[cacheKey] = ubicFree; return ubicFree; }

            // 4) Último recurso: localidad + CP (centro de la ciudad). Sirve para
            // la sucursal en el mapa: aunque la calle no resuelva, al menos se pinta
            // en el barrio/ciudad correctos.
            if (!permitirFallbackLocalidad) return null;

            if (!string.IsNullOrEmpty(localidadTrim) || !string.IsNullOrEmpty(cpTrim))
            {
                var fallbackQuery = string.IsNullOrEmpty(cpTrim)
                    ? $"{localidadTrim}, Argentina"
                    : $"{localidadTrim}, {cpTrim}, Argentina";
                var ubicFallback = await SearchNominatim(BuildFreeText(fallbackQuery), alturaPedida: null, expectedPostalCode: null);
                if (ubicFallback is not null) { Cache[cacheKey] = ubicFallback; return ubicFallback; }
            }

            return null;
        }

        public async Task<ValidacionDireccionResult> ValidarDireccionExactaAsync(
            string direccion,
            string localidad,
            string codigoPostal,
            string provincia)
        {
            var direccionTrim = (direccion ?? string.Empty).Trim();
            var localidadTrim = (localidad ?? string.Empty).Trim();
            var cpTrim = (codigoPostal ?? string.Empty).Trim();
            var provinciaTrim = (provincia ?? string.Empty).Trim();

            if (string.IsNullOrWhiteSpace(direccionTrim) ||
                string.IsNullOrWhiteSpace(localidadTrim) ||
                string.IsNullOrWhiteSpace(cpTrim) ||
                string.IsNullOrWhiteSpace(provinciaTrim))
                return ValidacionDireccionResult.Invalida("Direccion, localidad, codigo postal y provincia son obligatorios.");

            var alturaPedida = ExtraerAltura(direccionTrim);
            if (!alturaPedida.HasValue)
                return ValidacionDireccionResult.Invalida("La direccion debe incluir altura.");

            if (!Regex.IsMatch(cpTrim, @"^\d{4}$"))
                return ValidacionDireccionResult.Invalida("El codigo postal debe tener 4 digitos.");

            var cpValido = await ValidarCodigoPostalAsync(cpTrim, localidadTrim, provinciaTrim);
            if (!cpValido.Valido)
                return ValidacionDireccionResult.Invalida(cpValido.Error ?? "El codigo postal no coincide con la localidad/provincia.");

            var ubicGeoref = await TryGeoref(direccionTrim, localidadTrim, provinciaTrim);
            if (ubicGeoref is not null) return ValidacionDireccionResult.Valida();

            var ubicNominatim = await SearchNominatimStrict(
                BuildStructured(direccionTrim, localidadTrim, cpTrim, provinciaTrim),
                alturaPedida.Value,
                cpTrim,
                localidadTrim,
                provinciaTrim);

            if (ubicNominatim is not null) return ValidacionDireccionResult.Valida();

            var calleEnProvincia = await SearchNominatimStreetLevel(
                direccionTrim,
                localidadTrim,
                cpTrim,
                provinciaTrim,
                alturaPedida.Value);

            if (calleEnProvincia) return ValidacionDireccionResult.Valida();

            var provinciaDetectada = await DetectarProvinciaDireccionAsync(direccionTrim, alturaPedida.Value);
            if (!string.IsNullOrWhiteSpace(provinciaDetectada) &&
                NormalizeProvince(provinciaDetectada) != NormalizeProvince(provinciaTrim))
            {
                return ValidacionDireccionResult.Invalida($"La direccion parece pertenecer a {provinciaDetectada}, no a {provinciaTrim}.");
            }

            return ValidacionDireccionResult.Invalida("No se pudo verificar que la calle exista dentro de la localidad y provincia indicadas.");
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

        private async Task<ValidacionPostalResult> ValidarCodigoPostalAsync(string codigoPostal, string localidad, string provincia)
        {
            var parameters = new Dictionary<string, string?>
            {
                ["postalcode"] = codigoPostal,
                ["country"] = "Argentina",
                ["countrycodes"] = CountryCode,
                ["format"] = "json",
                ["limit"] = CandidateLimit.ToString(),
                ["addressdetails"] = "1",
                ["accept-language"] = "es",
            };

            var results = await FetchNominatim(parameters);
            if (results is null || results.Length == 0)
                return ValidacionPostalResult.Invalido("No se pudo verificar el codigo postal.");

            var candidatos = results
                .Where(r => string.Equals(r.Address?.CountryCode, CountryCode, StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (candidatos.Count == 0)
                return ValidacionPostalResult.Invalido("El codigo postal no pertenece a Argentina.");

            var provinciaEsperada = NormalizeProvince(provincia);
            var mismaProvincia = candidatos.Where(r => NormalizeProvince(r.Address?.State ?? r.Address?.Province) == provinciaEsperada).ToList();
            if (mismaProvincia.Count == 0)
            {
                var provinciaEncontrada = candidatos
                    .Select(r => r.Address?.State ?? r.Address?.Province)
                    .FirstOrDefault(p => !string.IsNullOrWhiteSpace(p));
                return ValidacionPostalResult.Invalido(string.IsNullOrWhiteSpace(provinciaEncontrada)
                    ? "No se pudo confirmar la provincia del codigo postal."
                    : $"El codigo postal pertenece a {provinciaEncontrada}, no a {provincia}.");
            }

            var conLocalidad = mismaProvincia
                .Select(r => GetLocalidad(r.Address))
                .Where(l => !string.IsNullOrWhiteSpace(l))
                .ToList();
            if (conLocalidad.Count > 0 && !conLocalidad.Any(l => TextMatches(l, localidad)))
            {
                return ValidacionPostalResult.Invalido($"El codigo postal no coincide con la localidad {localidad}.");
            }

            return ValidacionPostalResult.Ok();
        }

        private async Task<NominatimResult[]?> FetchNominatim(Dictionary<string, string?> parameters)
        {
            var qs = string.Join("&", parameters
                .Where(kv => !string.IsNullOrEmpty(kv.Value))
                .Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value!)}"));
            var url = $"{NominatimBaseUrl}?{qs}";

            try
            {
                using var response = await _httpClient.GetAsync(url);
                if (!response.IsSuccessStatusCode) return null;
                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<NominatimResult[]>(json);
            }
            catch
            {
                return null;
            }
        }

        // ── Georef ──────────────────────────────────────────────────────────────
        // API: https://apis.datos.gob.ar/georef/api/direcciones
        // Docs: https://datosgobar.github.io/georef-ar-api/
        //
        // Comportamiento conocido: si la altura solicitada no existe en el padrón,
        // Georef devuelve la calle con OTRA altura (la más próxima del nomenclátor)
        // sin marcar el resultado como aproximado. Eso introduce coordenadas que
        // caen en una cuadra distinta y rompe la apertura en Google Maps.
        // Por eso pedimos varios candidatos y exigimos match EXACTO de altura.
        private async Task<Ubicacion?> TryGeoref(string direccion, string localidad, string? provincia)
        {
            if (string.IsNullOrEmpty(direccion) || string.IsNullOrEmpty(localidad)) return null;
            try
            {
                var p = new Dictionary<string, string?>
                {
                    ["direccion"] = direccion,
                    ["localidad"] = localidad,
                    ["max"] = "10",
                };
                if (!string.IsNullOrEmpty(provincia)) p["provincia"] = provincia;

                var qs = string.Join("&", p
                    .Where(kv => !string.IsNullOrEmpty(kv.Value))
                    .Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value!)}"));

                using var response = await _httpClient.GetAsync($"{GeorefBaseUrl}?{qs}");
                if (!response.IsSuccessStatusCode) return null;

                var json = await response.Content.ReadAsStringAsync();
                var result = JsonSerializer.Deserialize<GeorefDireccionesResponse>(json);
                var direcciones = result?.Direcciones;
                if (direcciones is null || direcciones.Count == 0) return null;

                var alturaPedida = ExtraerAltura(direccion);

                // Si el operador puso altura, sólo aceptamos un resultado cuya altura
                // coincida EXACTAMENTE. Si ningún candidato cumple, devolvemos null
                // para que la siguiente capa (Nominatim) intente. Si tampoco, el
                // envío se bloqueará y el operador deberá verificar la dirección.
                if (alturaPedida.HasValue)
                {
                    var match = direcciones.FirstOrDefault(d =>
                        d.Altura?.Valor.HasValue == true && d.Altura.Valor.Value == alturaPedida.Value);
                    return match?.Ubicacion is null ? null : new Ubicacion(match.Ubicacion.Lat, match.Ubicacion.Lon);
                }

                // Sin altura pedida (caso raro: dirección sólo con calle): tomamos
                // el primer candidato como mejor aproximación de la calle.
                var ubicacion = direcciones.First().Ubicacion;
                return ubicacion is null ? null : new Ubicacion(ubicacion.Lat, ubicacion.Lon);
            }
            catch
            {
                return null;
            }
        }

        // ── Nominatim ───────────────────────────────────────────────────────────
        private async Task<Ubicacion?> SearchNominatimStrict(
            Dictionary<string, string?> parameters,
            int alturaPedida,
            string expectedPostalCode,
            string expectedLocalidad,
            string expectedProvincia)
        {
            var results = await FetchNominatim(parameters);
            if (results is null || results.Length == 0) return null;

            var provinciaEsperada = NormalizeProvince(expectedProvincia);
            var cpEsperado = expectedPostalCode.Trim();

            var elegido = results
                .Where(r => string.Equals(r.Address?.CountryCode, CountryCode, StringComparison.OrdinalIgnoreCase))
                .Where(r => int.TryParse(r.Address?.HouseNumber, out var hn) && hn == alturaPedida)
                .Where(r => string.IsNullOrWhiteSpace(r.Address?.Postcode) || string.Equals(r.Address.Postcode.Trim(), cpEsperado, StringComparison.OrdinalIgnoreCase))
                .Where(r => NormalizeProvince(r.Address?.State ?? r.Address?.Province) == provinciaEsperada)
                .Where(r =>
                {
                    var localidad = GetLocalidad(r.Address);
                    return string.IsNullOrWhiteSpace(localidad) || TextMatches(localidad, expectedLocalidad);
                })
                .OrderByDescending(r => r.Importance ?? 0)
                .FirstOrDefault();

            if (elegido is null) return null;
            if (!double.TryParse(elegido.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var lat) ||
                !double.TryParse(elegido.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var lon))
                return null;

            return new Ubicacion(lat, lon);
        }

        private async Task<string?> DetectarProvinciaDireccionAsync(string direccion, int alturaPedida)
        {
            var results = await FetchNominatim(BuildStructured(direccion, city: string.Empty, postalcode: null, state: null));
            if (results is null || results.Length == 0) return null;

            var exactos = results
                .Where(r => string.Equals(r.Address?.CountryCode, CountryCode, StringComparison.OrdinalIgnoreCase))
                .Where(r => int.TryParse(r.Address?.HouseNumber, out var hn) && hn == alturaPedida)
                .Select(r => r.Address?.State ?? r.Address?.Province)
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return exactos.Count == 1 ? exactos[0] : null;
        }

        private async Task<bool> SearchNominatimStreetLevel(
            string direccion,
            string localidad,
            string codigoPostal,
            string provincia,
            int alturaPedida)
        {
            var expectedStreet = ExtractStreetName(direccion);
            var queries = new[]
            {
                BuildStructured(direccion, localidad, codigoPostal, provincia),
                BuildStructured(expectedStreet, localidad, codigoPostal, provincia),
                BuildFreeText($"{direccion}, {localidad}, {provincia}, Argentina"),
                BuildFreeText($"{expectedStreet}, {localidad}, {provincia}, Argentina"),
            };

            foreach (var query in queries)
            {
                var results = await FetchNominatim(query);
                if (results is null || results.Length == 0) continue;

                var match = results.Any(r =>
                    string.Equals(r.Address?.CountryCode, CountryCode, StringComparison.OrdinalIgnoreCase) &&
                    NormalizeProvince(r.Address?.State ?? r.Address?.Province) == NormalizeProvince(provincia) &&
                    StreetMatches(r, expectedStreet) &&
                    PostalCodeCompatible(r.Address?.Postcode, codigoPostal) &&
                    HouseNumberCompatible(r.Address?.HouseNumber, alturaPedida) &&
                    LocalidadCompatible(GetLocalidad(r.Address), localidad));

                if (match) return true;
            }

            return false;
        }

        private async Task<Ubicacion?> SearchNominatim(Dictionary<string, string?> parameters, int? alturaPedida, string? expectedPostalCode)
        {
            var qs = string.Join("&", parameters
                .Where(kv => !string.IsNullOrEmpty(kv.Value))
                .Select(kv => $"{kv.Key}={Uri.EscapeDataString(kv.Value!)}"));
            var url = $"{NominatimBaseUrl}?{qs}";

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

                var expectedCp = expectedPostalCode?.Trim() ?? string.Empty;

                // Si el operador puso altura, exigimos match EXACTO. Si ningún candidato
                // de Nominatim tiene house_number == alturaPedida, devolvemos null para
                // que el envío no quede con coordenadas de otra cuadra (problema que
                // rompe la apertura en Google Maps y el render del marker en Leaflet).
                if (alturaPedida.HasValue)
                {
                    var conAlturaExacta = enArgentina
                        .Where(r =>
                        {
                            var hn = int.TryParse(r.Address?.HouseNumber, out var n) ? n : (int?)null;
                            return hn.HasValue && hn.Value == alturaPedida.Value;
                        })
                        .ToList();
                    if (conAlturaExacta.Count == 0) return null;

                    // Entre los candidatos con altura exacta, preferimos el que matchea
                    // el CP y el de mayor importance.
                    var elegido = conAlturaExacta
                        .Select(r => new
                        {
                            R = r,
                            CpMatch = !string.IsNullOrEmpty(expectedCp)
                                      && !string.IsNullOrEmpty(r.Address?.Postcode)
                                      && string.Equals(r.Address.Postcode.Trim(), expectedCp, StringComparison.OrdinalIgnoreCase),
                            Imp = r.Importance ?? 0,
                        })
                        .OrderByDescending(x => x.CpMatch)
                        .ThenByDescending(x => x.Imp)
                        .First()
                        .R;

                    if (!double.TryParse(elegido.Lat, NumberStyles.Float, CultureInfo.InvariantCulture, out var latE) ||
                        !double.TryParse(elegido.Lon, NumberStyles.Float, CultureInfo.InvariantCulture, out var lonE))
                        return null;
                    return new Ubicacion(latE, lonE);
                }

                // Sin altura pedida (calle sin número, fallback de localidad/CP):
                // tomamos el de mayor importance que matchee CP si lo hay.
                NominatimResult chosen = enArgentina
                    .Select(r =>
                    {
                        var cpMatch = !string.IsNullOrEmpty(expectedCp)
                                      && !string.IsNullOrEmpty(r.Address?.Postcode)
                                      && string.Equals(r.Address.Postcode.Trim(), expectedCp, StringComparison.OrdinalIgnoreCase);
                        return new { R = r, CpMatch = cpMatch ? 1 : 0, Imp = r.Importance ?? 0 };
                    })
                    .OrderByDescending(x => x.CpMatch)
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

        // ── DTOs Georef ─────────────────────────────────────────────────────────
        private static string? GetLocalidad(NominatimAddress? address)
            => address?.City
               ?? address?.Town
               ?? address?.Village
               ?? address?.Locality
               ?? address?.Municipality
               ?? address?.StateDistrict
               ?? address?.County;

        private static bool TextMatches(string? actual, string expected)
        {
            var a = NormalizeText(actual);
            var e = NormalizeText(expected);
            return !string.IsNullOrEmpty(a) && !string.IsNullOrEmpty(e) && (a == e || a.Contains(e) || e.Contains(a));
        }

        private static string ExtractStreetName(string direccion)
            => HouseNumberRx.Replace(direccion, string.Empty).Trim();

        private static bool StreetMatches(NominatimResult result, string expectedStreet)
        {
            var expected = NormalizeStreet(expectedStreet);
            var road = NormalizeStreet(result.Address?.Road);
            var display = NormalizeStreet(result.DisplayName);
            return !string.IsNullOrEmpty(expected) &&
                   ((!string.IsNullOrEmpty(road) && (road.Contains(expected) || expected.Contains(road))) ||
                    (!string.IsNullOrEmpty(display) && display.Contains(expected)));
        }

        private static bool PostalCodeCompatible(string? actual, string expected)
            => string.IsNullOrWhiteSpace(actual) || string.IsNullOrWhiteSpace(expected) ||
               string.Equals(actual.Trim(), expected.Trim(), StringComparison.OrdinalIgnoreCase);

        private static bool HouseNumberCompatible(string? actual, int expected)
            => string.IsNullOrWhiteSpace(actual) ||
               (int.TryParse(actual, out var n) && n == expected);

        private static bool LocalidadCompatible(string? actual, string expected)
            => string.IsNullOrWhiteSpace(actual) || TextMatches(actual, expected);

        private static string NormalizeStreet(string? value)
        {
            var normalized = NormalizeText(value);
            if (string.IsNullOrWhiteSpace(normalized)) return string.Empty;
            var parts = normalized
                .Split(' ', StringSplitOptions.RemoveEmptyEntries)
                .Where(p => p is not ("av" or "avenida" or "calle" or "gral" or "general" or "dr" or "doctor" or "pte" or "presidente"))
                .ToArray();
            return string.Join(' ', parts);
        }

        private static string NormalizeProvince(string? value)
        {
            var normalized = NormalizeText(value);
            if (normalized is "caba" or "capital federal" || normalized.Contains("ciudad autonoma de buenos aires"))
                return "ciudad autonoma de buenos aires";
            if (normalized == "provincia de buenos aires")
                return "buenos aires";
            return normalized;
        }

        private static string NormalizeText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var formD = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(formD.Length);
            foreach (var c in formD)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                    sb.Append(c);
            }
            return Regex.Replace(sb.ToString().Normalize(NormalizationForm.FormC), @"[^a-z0-9]+", " ").Trim();
        }

        private sealed class GeorefDireccionesResponse
        {
            [JsonPropertyName("direcciones")] public List<GeorefDireccion>? Direcciones { get; set; }
        }

        private sealed class GeorefDireccion
        {
            [JsonPropertyName("ubicacion")] public GeorefUbicacion? Ubicacion { get; set; }
            [JsonPropertyName("altura")] public GeorefAltura? Altura { get; set; }
        }

        private sealed class GeorefAltura
        {
            // Georef puede devolver null cuando no encuentra altura exacta en el padrón.
            [JsonPropertyName("valor")] public int? Valor { get; set; }
        }

        private sealed class GeorefUbicacion
        {
            [JsonPropertyName("lat")] public double Lat { get; set; }
            [JsonPropertyName("lon")] public double Lon { get; set; }
        }

        // ── DTOs Nominatim ──────────────────────────────────────────────────────
        private sealed class NominatimResult
        {
            [JsonPropertyName("lat")] public string Lat { get; set; } = string.Empty;
            [JsonPropertyName("lon")] public string Lon { get; set; } = string.Empty;
            [JsonPropertyName("display_name")] public string? DisplayName { get; set; }
            [JsonPropertyName("importance")] public double? Importance { get; set; }
            [JsonPropertyName("address")] public NominatimAddress? Address { get; set; }
        }

        private sealed class NominatimAddress
        {
            [JsonPropertyName("country_code")] public string? CountryCode { get; set; }
            [JsonPropertyName("house_number")] public string? HouseNumber { get; set; }
            [JsonPropertyName("road")] public string? Road { get; set; }
            [JsonPropertyName("state")] public string? State { get; set; }
            [JsonPropertyName("province")] public string? Province { get; set; }
            [JsonPropertyName("postcode")] public string? Postcode { get; set; }
            [JsonPropertyName("city")] public string? City { get; set; }
            [JsonPropertyName("town")] public string? Town { get; set; }
            [JsonPropertyName("village")] public string? Village { get; set; }
            [JsonPropertyName("locality")] public string? Locality { get; set; }
            [JsonPropertyName("municipality")] public string? Municipality { get; set; }
            [JsonPropertyName("state_district")] public string? StateDistrict { get; set; }
            [JsonPropertyName("county")] public string? County { get; set; }
        }

        private sealed record ValidacionPostalResult(bool Valido, string? Error)
        {
            public static ValidacionPostalResult Ok() => new(true, null);
            public static ValidacionPostalResult Invalido(string error) => new(false, error);
        }
    }

    public sealed record ValidacionDireccionResult(bool EsValida, string? Error)
    {
        public static ValidacionDireccionResult Valida() => new(true, null);
        public static ValidacionDireccionResult Invalida(string error) => new(false, error);
    }
}
