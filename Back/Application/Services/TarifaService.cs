using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

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

        public TarifaService(LogiTrackDbContext context, GeocodingService geocoding)
        {
            _context = context;
            _geocoding = geocoding;
        }

        // G1L-87: configuración singleton (se crea con valores por defecto en el primer acceso).
        public async Task<ConfiguracionTarifa> GetConfiguracionAsync()
        {
            var config = await _context.ConfiguracionesTarifa.FirstOrDefaultAsync();
            if (config is null)
            {
                config = new ConfiguracionTarifa(precioPorKg: 500, precioPorKm: 100, porcentajeRecargo: 20);
                _context.ConfiguracionesTarifa.Add(config);
                await _context.SaveChangesAsync();
            }
            return config;
        }

        public async Task<ConfiguracionTarifa> ActualizarConfiguracionAsync(double precioPorKg, double precioPorKm, double porcentajeRecargo)
        {
            var config = await GetConfiguracionAsync();
            config.Actualizar(precioPorKg, precioPorKm, porcentajeRecargo);
            await _context.SaveChangesAsync();
            return config;
        }

        public async Task<List<ZonaPeligrosa>> GetZonasAsync()
            => await _context.ZonasPeligrosas.OrderByDescending(z => z.CreadoEn).ToListAsync();

        public async Task<ZonaPeligrosa> CrearZonaAsync(string nombre, double latMin, double latMax, double lngMin, double lngMax)
        {
            var zona = new ZonaPeligrosa(nombre, latMin, latMax, lngMin, lngMax);
            _context.ZonasPeligrosas.Add(zona);
            await _context.SaveChangesAsync();
            return zona;
        }

        public async Task EliminarZonaAsync(Guid id)
        {
            var zona = await _context.ZonasPeligrosas.FindAsync(id);
            if (zona is null) return;
            _context.ZonasPeligrosas.Remove(zona);
            await _context.SaveChangesAsync();
        }

        // G1L-86: una ubicación es peligrosa si cae dentro de alguna zona activa.
        public async Task<bool> EsZonaPeligrosaAsync(double lat, double lng)
        {
            var zonas = await _context.ZonasPeligrosas.Where(z => z.Activa).ToListAsync();
            return zonas.Any(z => z.Contiene(lat, lng));
        }

        // G1L-88: calcula el desglose de la cotización a partir de la dirección destino.
        public async Task<CotizacionResultado> CotizarAsync(
            double peso, string direccion, string localidad, string cp, string? provincia)
        {
            var config = await GetConfiguracionAsync();
            var distancia = DistanciasService.CalcularDistancia(localidad);

            bool esPeligrosa = false;
            var ubicacion = await _geocoding.GeocodeAsync(direccion, localidad, cp, provincia);
            if (ubicacion is not null)
                esPeligrosa = await EsZonaPeligrosaAsync(ubicacion.Latitud, ubicacion.Longitud);

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
