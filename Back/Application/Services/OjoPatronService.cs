using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class EstadoConsentimiento
    {
        public required bool Aceptado { get; init; }
        public required string VersionVigente { get; init; }
        public DateTime? AceptadoEn { get; init; }
    }

    public class EstadoPruebaDia
    {
        public required bool RealizadaHoy { get; init; }
        public required double UmbralAlertness { get; init; }
    }

    public class OjoPatronService
    {
        // G1L-59: versión vigente del texto legal. Si cambia el texto, se incrementa
        // y el modal vuelve a aparecer aunque el repartidor haya aceptado una versión previa.
        public const string VersionTextoVigente = "1.0";

        private readonly LogiTrackDbContext _context;
        private readonly AuditoriaService _auditoria;

        public OjoPatronService(LogiTrackDbContext context, AuditoriaService auditoria)
        {
            _context = context;
            _auditoria = auditoria;
        }

        // Consentimiento vigente = aceptado, no revocado y de la versión actual.
        public async Task<bool> TieneConsentimientoVigenteAsync(Guid usuarioId)
        {
            return await _context.ConsentimientosOjoPatron.AnyAsync(c =>
                c.UsuarioId == usuarioId
                && c.RevocadoEn == null
                && c.VersionTexto == VersionTextoVigente);
        }

        public async Task<EstadoConsentimiento> GetEstadoAsync(Guid usuarioId)
        {
            var vigente = await _context.ConsentimientosOjoPatron
                .Where(c => c.UsuarioId == usuarioId && c.RevocadoEn == null && c.VersionTexto == VersionTextoVigente)
                .OrderByDescending(c => c.AceptadoEn)
                .FirstOrDefaultAsync();

            return new EstadoConsentimiento
            {
                Aceptado = vigente is not null,
                VersionVigente = VersionTextoVigente,
                AceptadoEn = vigente?.AceptadoEn,
            };
        }

        public async Task AceptarAsync(Guid usuarioId)
        {
            // Si ya hay uno vigente de esta versión, no duplicamos.
            if (await TieneConsentimientoVigenteAsync(usuarioId)) return;

            var consentimiento = new ConsentimientoOjoPatron(usuarioId, VersionTextoVigente);
            _context.ConsentimientosOjoPatron.Add(consentimiento);
            await _context.SaveChangesAsync();

            await _auditoria.RegistrarAsync(
                TipoAccion.ConsentimientoOjoPatron,
                $"Aceptó el consentimiento del Ojo del Patrón (v{VersionTextoVigente})",
                recursoId: usuarioId.ToString());
        }

        public async Task RevocarAsync(Guid usuarioId)
        {
            var vigentes = await _context.ConsentimientosOjoPatron
                .Where(c => c.UsuarioId == usuarioId && c.RevocadoEn == null)
                .ToListAsync();

            foreach (var c in vigentes) c.Revocar();
            await _context.SaveChangesAsync();

            await _auditoria.RegistrarAsync(
                TipoAccion.ConsentimientoOjoPatron,
                "Revocó el consentimiento del Ojo del Patrón",
                recursoId: usuarioId.ToString());
        }

        // ===== G1L-61: configuración del umbral =====

        public async Task<ConfiguracionOjoPatron> GetConfiguracionAsync()
        {
            var config = await _context.ConfiguracionesOjoPatron.FirstOrDefaultAsync();
            if (config is null)
            {
                // Umbral permisivo por defecto (se calibra con el uso real).
                config = new ConfiguracionOjoPatron(0.4);
                _context.ConfiguracionesOjoPatron.Add(config);
                await _context.SaveChangesAsync();
            }
            return config;
        }

        public async Task<ConfiguracionOjoPatron> ActualizarConfiguracionAsync(double umbral)
        {
            var config = await GetConfiguracionAsync();
            config.Actualizar(umbral);
            await _context.SaveChangesAsync();
            await _auditoria.RegistrarAsync(
                TipoAccion.Otro,
                $"Actualizó el umbral del Ojo del Patrón a {umbral:0.##}");
            return config;
        }

        // ===== G1L-60 / G1L-61: prueba acústica =====

        // Gate estricto: solo una prueba APROBADA hoy habilita el inicio de ruta.
        public async Task<bool> TienePruebaAprobadaHoyAsync(Guid usuarioId)
        {
            var hoy = DateTime.UtcNow.Date;
            var manana = hoy.AddDays(1);
            return await _context.PruebasOjoPatron.AnyAsync(p =>
                p.UsuarioId == usuarioId && p.FechaHora >= hoy && p.FechaHora < manana
                && p.Resultado == ResultadoPruebaOjoPatron.Aprobada);
        }

        public async Task<EstadoPruebaDia> GetEstadoPruebaDiaAsync(Guid usuarioId)
        {
            var config = await GetConfiguracionAsync();
            return new EstadoPruebaDia
            {
                RealizadaHoy = await TienePruebaAprobadaHoyAsync(usuarioId),
                UmbralAlertness = config.UmbralAlertness,
            };
        }

        public async Task RegistrarPruebaAsync(
            Guid usuarioId, string rolUsuario,
            double scoreNeu, double scoreHap, double scoreSad, double scoreAng,
            double alertnessScore, int intentos, ResultadoPruebaOjoPatron resultado)
        {
            var config = await GetConfiguracionAsync();
            var prueba = new PruebaOjoPatron(
                usuarioId, scoreNeu, scoreHap, scoreSad, scoreAng,
                alertnessScore, config.UmbralAlertness, intentos, resultado);
            _context.PruebasOjoPatron.Add(prueba);
            await _context.SaveChangesAsync();

            // G1L-61: cada prueba (aprobada o rechazada) queda en el log de auditoría.
            await _auditoria.RegistrarAsync(
                TipoAccion.PruebaOjoDelPatron,
                $"Prueba Ojo del Patrón: {(resultado == ResultadoPruebaOjoPatron.Aprobada ? "Aprobada" : "Rechazada")}",
                recursoId: usuarioId.ToString(),
                contexto: $"Rol: {rolUsuario} | Alertness: {alertnessScore:0.###} | Umbral: {config.UmbralAlertness:0.###} | Intento: {intentos}");
        }
    }
}
