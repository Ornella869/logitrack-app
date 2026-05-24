using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;

namespace Back.Application.Services
{
    // G1L-88: desglose de la cotización de un envío.
    public class CotizacionResultado
    {
        public required double Peso { get; init; }
        public required double PrecioPorKg { get; init; }
        public required double CostoPeso { get; init; }
        public required double DistanciaKm { get; init; }
        public required double PrecioPorKm { get; init; }
        public required double CostoDistancia { get; init; }
        public required bool EsZonaPeligrosa { get; init; }
        public required double PorcentajeRecargo { get; init; }
        public required double CostoRecargo { get; init; }
        public required double Total { get; init; }
        // Coordenadas geocodificadas del destino (null si no se pudo ubicar). Útil para
        // verificar por qué (no) se aplicó el recargo de zona peligrosa.
        public double? Latitud { get; init; }
        public double? Longitud { get; init; }
        public bool Geocodificado { get; init; }
    }

    public class TarifaService
    {
        private readonly LogiTrackDbContext _context;
        private readonly GeocodingService _geocoding;

        private sealed record ProvinciaBounds(double LatMin, double LatMax, double LngMin, double LngMax);

        private static readonly Dictionary<string, ProvinciaBounds> BoundsPorProvincia = new()
        {
            ["buenos aires"] = new(-41.2, -33.2, -63.5, -56.5),
            ["ciudad autonoma de buenos aires"] = new(-34.75, -34.5, -58.55, -58.3),
            ["catamarca"] = new(-30.2, -25.0, -69.7, -64.4),
            ["chaco"] = new(-28.2, -24.0, -63.6, -58.3),
            ["chubut"] = new(-46.1, -42.0, -72.3, -63.6),
            ["cordoba"] = new(-35.2, -29.5, -65.8, -61.7),
            ["corrientes"] = new(-30.8, -27.2, -59.7, -55.6),
            ["entre rios"] = new(-34.1, -30.1, -60.8, -57.8),
            ["formosa"] = new(-26.9, -22.0, -62.4, -57.5),
            ["jujuy"] = new(-24.8, -21.8, -67.3, -64.0),
            ["la pampa"] = new(-39.3, -34.5, -68.3, -63.3),
            ["la rioja"] = new(-32.0, -27.6, -69.7, -65.0),
            ["mendoza"] = new(-37.7, -32.0, -70.6, -66.5),
            ["misiones"] = new(-28.2, -25.4, -56.1, -53.6),
            ["neuquen"] = new(-41.2, -36.0, -71.9, -68.0),
            ["rio negro"] = new(-42.1, -37.0, -72.0, -62.8),
            ["salta"] = new(-26.4, -21.9, -68.6, -62.3),
            ["san juan"] = new(-32.7, -28.0, -70.7, -66.5),
            ["san luis"] = new(-36.2, -31.8, -67.0, -64.0),
            ["santa cruz"] = new(-52.4, -46.0, -73.6, -65.7),
            ["santa fe"] = new(-34.4, -28.0, -62.9, -58.8),
            ["santiago del estero"] = new(-30.5, -25.6, -65.2, -61.5),
            ["tierra del fuego"] = new(-55.2, -52.5, -68.7, -63.0),
            ["tucuman"] = new(-28.1, -26.0, -66.3, -64.4),
        };

        public TarifaService(LogiTrackDbContext context, GeocodingService geocoding)
        {
            _context = context;
            _geocoding = geocoding;
        }

        // Épica D: provincia del usuario (Gerente → su provincia; otros → la de su sucursal).
        public async Task<string> ResolverProvinciaUsuarioAsync(Guid usuarioId)
        {
            var usuario = await _context.Usuarios.FindAsync(usuarioId);
            if (usuario is Gerente g) return g.Provincia ?? string.Empty;
            if (usuario?.SucursalId is Guid sucId)
            {
                var suc = await _context.Sucursales.FindAsync(sucId);
                return suc?.Provincia ?? string.Empty;
            }
            return string.Empty;
        }

        public async Task<List<string>> ResolverProvinciasVisiblesUsuarioAsync(Guid usuarioId)
        {
            var usuario = await _context.Usuarios.FindAsync(usuarioId);
            if (usuario is Administrador)
                return await _context.ZonasPeligrosas
                    .Where(z => z.Provincia != null && z.Provincia != string.Empty)
                    .Select(z => z.Provincia)
                    .Distinct()
                    .ToListAsync();
            if (usuario is Gerente g)
                return string.IsNullOrWhiteSpace(g.Provincia) ? new List<string>() : new List<string> { g.Provincia };
            if (usuario?.SucursalId is Guid sucId)
            {
                var suc = await _context.Sucursales.FindAsync(sucId);
                if (suc is null) return new List<string>();
                return new[] { suc.Provincia ?? string.Empty }
                    .Concat(suc.ProvinciasCubiertas ?? new List<string>())
                    .Where(p => !string.IsNullOrWhiteSpace(p))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();
            }
            return new List<string>();
        }

        // Épica D: configuración por provincia (se crea con valores por defecto en el primer acceso).
        public async Task<ConfiguracionTarifa> GetConfiguracionAsync(string provincia)
        {
            provincia = (provincia ?? string.Empty).Trim();
            var config = await _context.ConfiguracionesTarifa.FirstOrDefaultAsync(c => c.Provincia == provincia);
            if (config is null)
            {
                config = new ConfiguracionTarifa(provincia, precioPorKg: 500, precioPorKm: 100, porcentajeRecargo: 20);
                _context.ConfiguracionesTarifa.Add(config);
                await _context.SaveChangesAsync();
            }
            return config;
        }

        public async Task<ConfiguracionTarifa> ActualizarConfiguracionAsync(string provincia, double precioPorKg, double precioPorKm, double porcentajeRecargo)
        {
            var config = await GetConfiguracionAsync(provincia);
            config.Actualizar(precioPorKg, precioPorKm, porcentajeRecargo);
            await _context.SaveChangesAsync();
            return config;
        }

        public async Task<List<ZonaPeligrosa>> GetZonasAsync(string provincia)
        {
            provincia = (provincia ?? string.Empty).Trim();
            return await _context.ZonasPeligrosas
                .Where(z => z.Provincia == provincia)
                .OrderByDescending(z => z.CreadoEn).ToListAsync();
        }

        public async Task<List<ZonaPeligrosa>> GetZonasAsync(List<string> provincias)
        {
            var normalizadas = provincias
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p.Trim())
                .ToList();
            if (normalizadas.Count == 0) return new List<ZonaPeligrosa>();
            return await _context.ZonasPeligrosas
                .Where(z => normalizadas.Contains(z.Provincia))
                .OrderByDescending(z => z.CreadoEn).ToListAsync();
        }

        public async Task<ZonaPeligrosa> CrearZonaAsync(string nombre, string provincia, double latMin, double latMax, double lngMin, double lngMax)
        {
            ValidarZonaDentroDeProvincia(provincia, latMin, latMax, lngMin, lngMax);
            var zona = new ZonaPeligrosa(nombre, provincia, latMin, latMax, lngMin, lngMax);
            _context.ZonasPeligrosas.Add(zona);
            await _context.SaveChangesAsync();
            return zona;
        }

        private static void ValidarZonaDentroDeProvincia(string provincia, double latMin, double latMax, double lngMin, double lngMax)
        {
            var key = NormalizarProvinciaKey(provincia);
            if (!BoundsPorProvincia.TryGetValue(key, out var bounds))
                throw new InvalidOperationException("No se pudo validar la provincia de la zona peligrosa.");

            var minLat = Math.Min(latMin, latMax);
            var maxLat = Math.Max(latMin, latMax);
            var minLng = Math.Min(lngMin, lngMax);
            var maxLng = Math.Max(lngMin, lngMax);

            var dentro = minLat >= bounds.LatMin && maxLat <= bounds.LatMax
                && minLng >= bounds.LngMin && maxLng <= bounds.LngMax;
            if (!dentro)
                throw new InvalidOperationException($"La zona peligrosa debe estar dentro de {provincia}.");
        }

        private static string NormalizarProvinciaKey(string provincia)
        {
            var normalized = (provincia ?? string.Empty).Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var chars = normalized.Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark).ToArray();
            return new string(chars).Normalize(NormalizationForm.FormC);
        }

        public async Task EliminarZonaAsync(Guid id, string provincia)
        {
            var zona = await _context.ZonasPeligrosas.FindAsync(id);
            if (zona is null) return;
            if (!string.Equals(zona.Provincia, provincia, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("No podés eliminar zonas de otra provincia.");
            _context.ZonasPeligrosas.Remove(zona);
            await _context.SaveChangesAsync();
        }

        // G1L-86: una ubicación es peligrosa si cae dentro de alguna zona activa de su provincia.
        public async Task<bool> EsZonaPeligrosaAsync(string provincia, double lat, double lng)
        {
            provincia = (provincia ?? string.Empty).Trim();
            var zonas = await _context.ZonasPeligrosas.Where(z => z.Activa && z.Provincia == provincia).ToListAsync();
            return zonas.Any(z => z.Contiene(lat, lng));
        }

        // G1L-88: calcula el desglose de la cotización a partir de la dirección destino.
        // La provincia del destino define qué tarifas y zonas peligrosas aplican.
        public async Task<CotizacionResultado> CotizarAsync(
            double peso, string direccion, string localidad, string cp, string? provincia)
        {
            var prov = (provincia ?? string.Empty).Trim();
            var config = await GetConfiguracionAsync(prov);
            var distancia = DistanciasService.CalcularDistancia(localidad);

            bool esPeligrosa = false;
            var ubicacion = await _geocoding.GeocodeAsync(direccion, localidad, cp, provincia);
            if (ubicacion is not null)
                esPeligrosa = await EsZonaPeligrosaAsync(prov, ubicacion.Latitud, ubicacion.Longitud);

            return Calcular(peso, distancia, esPeligrosa, config, ubicacion);
        }

        // Cálculo puro reutilizable (también al registrar el envío con ubicación ya conocida).
        public CotizacionResultado Calcular(double peso, double distanciaKm, bool esZonaPeligrosa, ConfiguracionTarifa config, Ubicacion? ubicacion = null)
        {
            var costoPeso = peso * config.PrecioPorKg;
            var costoDistancia = distanciaKm * config.PrecioPorKm;
            var subtotal = costoPeso + costoDistancia;
            var recargo = esZonaPeligrosa ? subtotal * (config.PorcentajeRecargoZonaPeligrosa / 100.0) : 0;

            return new CotizacionResultado
            {
                Peso = peso,
                PrecioPorKg = config.PrecioPorKg,
                CostoPeso = Math.Round(costoPeso, 2),
                DistanciaKm = Math.Round(distanciaKm, 2),
                PrecioPorKm = config.PrecioPorKm,
                CostoDistancia = Math.Round(costoDistancia, 2),
                EsZonaPeligrosa = esZonaPeligrosa,
                PorcentajeRecargo = esZonaPeligrosa ? config.PorcentajeRecargoZonaPeligrosa : 0,
                CostoRecargo = Math.Round(recargo, 2),
                Total = Math.Round(subtotal + recargo, 2),
                Latitud = ubicacion?.Latitud,
                Longitud = ubicacion?.Longitud,
                Geocodificado = ubicacion is not null,
            };
        }
    }
}
