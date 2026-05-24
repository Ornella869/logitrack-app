using Back.Application.Common;
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

        // ===== G1L-61 / Épica D: configuración del umbral por provincia =====

        // Resuelve la provincia de un usuario: Gerente → su provincia; otros → la de su sucursal.
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

        public async Task<ConfiguracionOjoPatron> GetConfiguracionAsync(string provincia)
        {
            provincia = (provincia ?? string.Empty).Trim();
            var config = await _context.ConfiguracionesOjoPatron.FirstOrDefaultAsync(c => c.Provincia == provincia);
            if (config is null)
            {
                // Umbral permisivo por defecto (se calibra con el uso real).
                config = new ConfiguracionOjoPatron(provincia, 0.4);
                _context.ConfiguracionesOjoPatron.Add(config);
                await _context.SaveChangesAsync();
            }
            return config;
        }

        public async Task<ConfiguracionOjoPatron> ActualizarConfiguracionAsync(string provincia, double umbral)
        {
            var config = await GetConfiguracionAsync(provincia);
            config.Actualizar(umbral);
            await _context.SaveChangesAsync();
            await _auditoria.RegistrarAsync(
                TipoAccion.Otro,
                $"Actualizó el umbral del Ojo del Patrón a {umbral:0.##} (provincia {provincia})");
            return config;
        }

        // ===== G1L-60 / G1L-61: prueba acústica =====

        // Gate estricto: solo una prueba APROBADA hoy (del momento indicado) habilita continuar.
        public async Task<bool> TienePruebaAprobadaHoyAsync(Guid usuarioId, MomentoPruebaOjoPatron momento = MomentoPruebaOjoPatron.Inicio)
        {
            var hoy = OperationalClock.TodayStartUtc;
            var manana = OperationalClock.TomorrowStartUtc;
            return await _context.PruebasOjoPatron.AnyAsync(p =>
                p.UsuarioId == usuarioId && p.FechaHora >= hoy && p.FechaHora < manana
                && p.Resultado == ResultadoPruebaOjoPatron.Aprobada
                && p.Momento == momento);
        }

        // Fase B: ¿para entregar este paquete se requiere la prueba de mitad de recorrido?
        // Se exige cuando el repartidor ya finalizó >= la mitad de sus paradas del día
        // (ceil(total/2)), aún le quedan pendientes, y no aprobó hoy la prueba de mitad.
        public async Task<bool> RequierePruebaMitadAsync(Guid paqueteId)
        {
            var paquete = await _context.Paquetes.FindAsync(paqueteId);
            if (paquete is null || !paquete.RepartidorAsignadoId.HasValue || !paquete.FechaCalendarizada.HasValue)
                return false;

            var repartidorId = paquete.RepartidorAsignadoId.Value;
            var dia = paquete.FechaCalendarizada.Value.Date;
            var manana = dia.AddDays(1);

            var delDia = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada >= dia && p.FechaCalendarizada < manana)
                .ToListAsync();

            var total = delDia.Count;
            if (total < 2) return false; // con 1 sola parada no hay "mitad".

            var finalizadas = delDia.Count(p => p.Status == PaqueteStatus.Entregado || p.Status == PaqueteStatus.Cancelado);
            var umbralMitad = (int)Math.Ceiling(total / 2.0);

            // Si todavía no llegó a la mitad, o ya no quedan pendientes, no aplica.
            if (finalizadas < umbralMitad) return false;
            if (finalizadas >= total) return false;

            // Aplica si aún no aprobó la prueba de mitad hoy.
            return !await TienePruebaAprobadaHoyAsync(repartidorId, MomentoPruebaOjoPatron.Mitad);
        }

        public async Task<EstadoPruebaDia> GetEstadoPruebaDiaAsync(Guid usuarioId)
        {
            var provincia = await ResolverProvinciaUsuarioAsync(usuarioId);
            var config = await GetConfiguracionAsync(provincia);
            return new EstadoPruebaDia
            {
                RealizadaHoy = await TienePruebaAprobadaHoyAsync(usuarioId),
                UmbralAlertness = config.UmbralAlertness,
            };
        }

        public async Task RegistrarPruebaAsync(
            Guid usuarioId, string rolUsuario,
            double scoreNeu, double scoreHap, double scoreSad, double scoreAng,
            double alertnessScore, int intentos, ResultadoPruebaOjoPatron resultado,
            MomentoPruebaOjoPatron momento = MomentoPruebaOjoPatron.Inicio)
        {
            var provincia = await ResolverProvinciaUsuarioAsync(usuarioId);
            var config = await GetConfiguracionAsync(provincia);
            var prueba = new PruebaOjoPatron(
                usuarioId, scoreNeu, scoreHap, scoreSad, scoreAng,
                alertnessScore, config.UmbralAlertness, intentos, resultado, momento);
            _context.PruebasOjoPatron.Add(prueba);
            await _context.SaveChangesAsync();

            // G1L-61: cada prueba (aprobada o rechazada) queda en el log de auditoría.
            var momentoLabel = momento == MomentoPruebaOjoPatron.Mitad ? "Mitad de recorrido" : "Inicio de ruta";
            await _auditoria.RegistrarAsync(
                TipoAccion.PruebaOjoDelPatron,
                $"Prueba Ojo del Patrón ({momentoLabel}): {(resultado == ResultadoPruebaOjoPatron.Aprobada ? "Aprobada" : "Rechazada")}",
                recursoId: usuarioId.ToString(),
                contexto: $"Rol: {rolUsuario} | Momento: {momentoLabel} | Alertness: {alertnessScore:0.###} | Umbral: {config.UmbralAlertness:0.###} | Intento: {intentos}");
        }
    }
}
