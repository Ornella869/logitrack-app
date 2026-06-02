using System.Text.Json;
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
            await _auditoria.RegistrarAsync(
                TipoAccion.ConsentimientoOjoPatron,
                $"Aceptó el consentimiento del Ojo del Patrón (v{VersionTextoVigente})",
                recursoId: usuarioId.ToString());
            await _context.SaveChangesAsync();
        }

        public async Task RevocarAsync(Guid usuarioId)
        {
            var vigentes = await _context.ConsentimientosOjoPatron
                .Where(c => c.UsuarioId == usuarioId && c.RevocadoEn == null)
                .ToListAsync();

            foreach (var c in vigentes) c.Revocar();
            await _auditoria.RegistrarAsync(
                TipoAccion.ConsentimientoOjoPatron,
                "Revocó el consentimiento del Ojo del Patrón",
                recursoId: usuarioId.ToString());
            await _context.SaveChangesAsync();
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
            await _auditoria.RegistrarAsync(
                TipoAccion.Otro,
                $"Actualizó el umbral del Ojo del Patrón a {umbral:0.##} (provincia {provincia})");
            await _context.SaveChangesAsync();
            return config;
        }

        // ===== G1L-60 / G1L-61: prueba acústica =====

        // Gate estricto: solo una prueba APROBADA hoy (del momento indicado) habilita continuar.
        public async Task<bool> TienePruebaAprobadaHoyAsync(Guid usuarioId, MomentoPruebaOjoPatron momento = MomentoPruebaOjoPatron.Inicio)
        {
            var hoy = OperationalClock.TodayStartUtc;
            var manana = OperationalClock.TomorrowStartUtc;
            var pruebaAprobada = await _context.PruebasOjoPatron.AnyAsync(p =>
                p.UsuarioId == usuarioId && p.FechaHora >= hoy && p.FechaHora < manana
                && p.Resultado == ResultadoPruebaOjoPatron.Aprobada
                && p.Momento == momento);
            if (pruebaAprobada) return true;

            return await _context.OverridesOjoPatron.AnyAsync(o =>
                o.RepartidorId == usuarioId
                && o.SolicitadoEn >= hoy && o.SolicitadoEn < manana
                && o.Estado == EstadoOverrideOjoPatron.Aprobado
                && o.Momento == momento);
        }

        // Al cerrar una tanda o recibir una nueva, se debe volver a pasar el gate.
        public async Task InvalidarPruebasAprobadasDelDiaAsync(Guid usuarioId, DateTime fecha)
        {
            var inicio = OperationalClock.StartUtcForOperationalDate(fecha);
            var fin = OperationalClock.StartUtcForOperationalDate(fecha.Date.AddDays(1));

            var pruebasAprobadas = await _context.PruebasOjoPatron
                .Where(p => p.UsuarioId == usuarioId
                            && p.FechaHora >= inicio && p.FechaHora < fin
                            && p.Resultado == ResultadoPruebaOjoPatron.Aprobada)
                .ToListAsync();
            _context.PruebasOjoPatron.RemoveRange(pruebasAprobadas);

            var overridesAprobados = await _context.OverridesOjoPatron
                .Where(o => o.RepartidorId == usuarioId
                            && o.SolicitadoEn >= inicio && o.SolicitadoEn < fin
                            && o.Estado == EstadoOverrideOjoPatron.Aprobado)
                .ToListAsync();
            _context.OverridesOjoPatron.RemoveRange(overridesAprobados);
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
            if (total == 0) return false;

            var finalizadas = delDia.Count(p => p.Status == PaqueteStatus.Entregado || p.Status == PaqueteStatus.Cancelado);

            // Caso especial: un solo envío → la "mitad" es cuando el paquete está en tránsito.
            if (total == 1)
            {
                var enTransito = delDia.Any(p => p.Status == PaqueteStatus.EnTransito);
                if (!enTransito) return false;
                return !await TienePruebaAprobadaHoyAsync(repartidorId, MomentoPruebaOjoPatron.Mitad);
            }

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

            // G1L-61: cada prueba (aprobada o rechazada) queda en el log de auditoría.
            var momentoLabel = momento == MomentoPruebaOjoPatron.Mitad ? "Mitad de recorrido" : "Inicio de ruta";
            var contextoJson = JsonSerializer.Serialize(new
            {
                AlertnessScore = alertnessScore,
                ScoreNeu = scoreNeu,
                ScoreHap = scoreHap,
                ScoreSad = scoreSad,
                ScoreAng = scoreAng,
                Resultado = (int)resultado,
                Intentos = intentos,
                Momento = momentoLabel,
                Rol = rolUsuario,
                Umbral = config.UmbralAlertness,
            });
            await _auditoria.RegistrarAsync(
                TipoAccion.PruebaOjoDelPatron,
                $"Prueba Ojo del Patrón ({momentoLabel}): {(resultado == ResultadoPruebaOjoPatron.Aprobada ? "Aprobada" : "Rechazada")}",
                recursoId: usuarioId.ToString(),
                contexto: contextoJson);
            await _context.SaveChangesAsync();
        }

        public async Task<OverrideOjoPatron> SolicitarOverrideAsync(Guid repartidorId, MomentoPruebaOjoPatron momento, string motivo)
        {
            if (string.IsNullOrWhiteSpace(motivo))
                throw new InvalidOperationException("El motivo es obligatorio.");

            var hoy = OperationalClock.TodayStartUtc;
            var manana = OperationalClock.TomorrowStartUtc;
            var existente = await _context.OverridesOjoPatron.FirstOrDefaultAsync(o =>
                o.RepartidorId == repartidorId
                && o.SolicitadoEn >= hoy && o.SolicitadoEn < manana
                && o.Momento == momento
                && o.Estado == EstadoOverrideOjoPatron.Pendiente);
            if (existente is not null) return existente;

            var solicitud = new OverrideOjoPatron(repartidorId, momento, motivo);
            _context.OverridesOjoPatron.Add(solicitud);
            await _auditoria.RegistrarAsync(
                TipoAccion.PruebaOjoDelPatron,
                "Solicitud de override del Ojo del Patron",
                recursoId: repartidorId.ToString(),
                contexto: $"Momento: {momento} | Motivo: {motivo}");
            await _context.SaveChangesAsync();
            return solicitud;
        }

        public async Task<List<OverrideOjoPatron>> ListarOverridesSupervisorAsync(Guid supervisorId)
        {
            var supervisor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == supervisorId);
            if (supervisor?.SucursalId is null) return new List<OverrideOjoPatron>();
            var repartidoresSucursal = await _context.Usuarios
                .Where(u => u.SucursalId == supervisor.SucursalId && u is Repartidor)
                .Select(u => u.Id)
                .ToListAsync();
            return await _context.OverridesOjoPatron
                .Where(o => repartidoresSucursal.Contains(o.RepartidorId))
                .OrderByDescending(o => o.SolicitadoEn)
                .ToListAsync();
        }

        public async Task<OverrideOjoPatron> ResolverOverrideAsync(Guid supervisorId, Guid overrideId, bool aprobado, string? comentario)
        {
            var supervisor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == supervisorId);
            if (supervisor?.SucursalId is null) throw new InvalidOperationException("El supervisor no tiene sucursal asignada.");

            var solicitud = await _context.OverridesOjoPatron.FirstOrDefaultAsync(o => o.Id == overrideId)
                ?? throw new InvalidOperationException("Solicitud no encontrada.");
            var repartidor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == solicitud.RepartidorId);
            if (repartidor?.SucursalId != supervisor.SucursalId)
                throw new InvalidOperationException("No podes resolver solicitudes de otra sucursal.");

            solicitud.Resolver(supervisorId, aprobado, comentario);
            await _auditoria.RegistrarAsync(
                TipoAccion.PruebaOjoDelPatron,
                aprobado ? "Override del Ojo del Patron aprobado" : "Override del Ojo del Patron rechazado",
                recursoId: solicitud.RepartidorId.ToString(),
                contexto: comentario);
            await _context.SaveChangesAsync();
            return solicitud;
        }

        public async Task<List<object>> GetMetricasHistoricasAsync(Guid supervisorId)
        {
            var supervisor = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == supervisorId);
            if (supervisor?.SucursalId is null) return new List<object>();
            var repartidores = await _context.Usuarios
                .Where(u => u.SucursalId == supervisor.SucursalId && u is Repartidor)
                .ToListAsync();
            var ids = repartidores.Select(r => r.Id).ToList();
            var pruebas = await _context.PruebasOjoPatron.Where(p => ids.Contains(p.UsuarioId)).ToListAsync();
            var overrides = await _context.OverridesOjoPatron.Where(o => ids.Contains(o.RepartidorId)).ToListAsync();

            return repartidores.Select(r =>
            {
                var ps = pruebas.Where(p => p.UsuarioId == r.Id).ToList();
                var os = overrides.Where(o => o.RepartidorId == r.Id).ToList();
                return (object)new
                {
                    repartidorId = r.Id,
                    repartidorNombre = $"{r.Nombre} {r.Apellido}",
                    aprobadas = ps.Count(p => p.Resultado == ResultadoPruebaOjoPatron.Aprobada),
                    fallidas = ps.Count(p => p.Resultado != ResultadoPruebaOjoPatron.Aprobada),
                    overridesAprobados = os.Count(o => o.Estado == EstadoOverrideOjoPatron.Aprobado),
                    promedioAlertness = ps.Count == 0 ? 0 : Math.Round(ps.Average(p => p.AlertnessScore), 3),
                    ultimaPrueba = ps.OrderByDescending(p => p.FechaHora).FirstOrDefault()?.FechaHora,
                };
            }).ToList();
        }
    }
}
