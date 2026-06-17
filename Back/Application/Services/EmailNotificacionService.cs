using System.Net;
using System.Net.Mail;
using System.Security;
using Back.Application.Util;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class EmailNotificacionService
    {
        private readonly LogiTrackDbContext _context;
        private readonly IConfiguration _configuration;

        public EmailNotificacionService(LogiTrackDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        public async Task NotificarCambioEstadoAsync(Guid paqueteId, PaqueteStatus estado)
        {
            if (estado is not (PaqueteStatus.EnTransito or PaqueteStatus.Entregado or PaqueteStatus.CargadoEnVehiculo or PaqueteStatus.Demorado or PaqueteStatus.Cancelado)) return;

            var paquete = await _context.Paquetes.FirstOrDefaultAsync(p => p.Id == paqueteId);
            if (paquete?.Destinatario.Email is null) return;

            var historial = await _context.HistorialEstadosEnvio
                .Where(h => h.PaqueteId == paqueteId)
                .OrderBy(h => h.FechaHora)
                .ToListAsync();

            if (estado == PaqueteStatus.CargadoEnVehiculo)
            {
                await CrearYEnviarAsync(paquete, EventoEmailNotificacion.CargadoEnVehiculo,
                    $"Tu envio {paquete.CodigoSeguimiento} fue cargado al vehiculo",
                    BuildEstadoEmail(paquete, estado, historial,
                        "Envio cargado al vehiculo",
                        "El paquete ya esta cargado y listo para salir a reparto."));
            }

            if (estado == PaqueteStatus.EnTransito)
            {
                await CrearYEnviarAsync(paquete, EventoEmailNotificacion.SalidaRuta,
                    $"Tu envio {paquete.CodigoSeguimiento} salio a ruta",
                    BuildEstadoEmail(paquete, estado, historial,
                        "Tu envio salio a ruta",
                        "Ya esta en transito. Podes seguir el avance desde el portal."));
            }

            if (estado == PaqueteStatus.Entregado)
            {
                await CrearYEnviarAsync(paquete, EventoEmailNotificacion.EntregaConfirmada,
                    $"Tu envio {paquete.CodigoSeguimiento} fue entregado",
                    BuildEstadoEmail(paquete, estado, historial,
                        "Entrega confirmada",
                        "Confirmamos que tu envio fue entregado correctamente."));

                var token = await ObtenerOCrearTokenEncuestaAsync(paquete.Id);
                await CrearYEnviarAsync(paquete, EventoEmailNotificacion.EncuestaPostEntrega,
                    $"Contanos como fue tu entrega {paquete.CodigoSeguimiento}",
                    BuildEncuestaEmail(paquete, token));
            }

            if (estado == PaqueteStatus.Demorado)
            {
                var motivo = string.IsNullOrWhiteSpace(paquete.RazonDemora)
                    ? "Detectamos una demora operativa. Te avisaremos cuando el recorrido continue."
                    : $"Detectamos una demora: {paquete.RazonDemora}. Te avisaremos cuando el recorrido continue.";

                await CrearYEnviarAsync(paquete, EventoEmailNotificacion.Demorado,
                    $"Tu envio {paquete.CodigoSeguimiento} esta demorado",
                    BuildEstadoEmail(paquete, estado, historial, "Tu envio esta demorado", motivo));
            }

            if (estado == PaqueteStatus.Cancelado)
            {
                var motivo = string.IsNullOrWhiteSpace(paquete.RazonCancelacion)
                    ? "El envio fue cancelado."
                    : $"El envio fue cancelado. Motivo: {paquete.RazonCancelacion}.";

                await CrearYEnviarAsync(paquete, EventoEmailNotificacion.Cancelado,
                    $"Tu envio {paquete.CodigoSeguimiento} fue cancelado",
                    BuildEstadoEmail(paquete, estado, historial, "Envio cancelado", motivo));
            }
        }

        public async Task NotificarCodigoEntregaAsync(Paquete paquete)
        {
            if (paquete.Destinatario.Email is null) return;

            var urlBase = _configuration["PublicTrackingBaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var trackingUrl = string.IsNullOrWhiteSpace(urlBase) ? "#" : $"{urlBase}/{SecurityElement.Escape(paquete.CodigoSeguimiento)}";
            var esPickUp = paquete.PuntoPickUpId.HasValue;
            var instruccionCodigo = esPickUp
                ? "Este codigo se lo tenes que informar al punto Pick Up cuando retires el paquete."
                : "Este codigo se lo tenes que informar al repartidor cuando recibas el paquete.";
            var avisoSeguridad = esPickUp
                ? "&#128274; Por tu seguridad, no compartas este c&#243;digo con nadie. Solo el punto Pick Up debe recibirlo."
                : "&#128274; Por tu seguridad, no compartas este c&#243;digo con nadie. Solo el repartidor designado debe recibirlo.";

            var cuerpo = BuildTemplate(
                "indigo",
                "Codigo de entrega",
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                instruccionCodigo,
                trackingUrl,
                "Ver seguimiento",
                $"""
                <div style="background:#0f172a;border:1px solid #4f46e5;border-radius:10px;padding:14px 16px;margin:14px 0;text-align:center;">
                  <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Codigo: {SecurityElement.Escape(paquete.CodigoSeguimiento)}</div>
                  <div style="font-size:34px;letter-spacing:10px;font-weight:900;color:#a78bfa;">{SecurityElement.Escape(paquete.CodigoEntrega)}</div>
                </div>
                <div style="background:#1e1033;border:1px solid #7c3aed;border-radius:8px;padding:10px 14px;margin:8px 0;text-align:center;">
                  <span style="font-size:13px;color:#c4b5fd;">{avisoSeguridad}</span>
                </div>
                """);

            await CrearYEnviarAsync(paquete, EventoEmailNotificacion.CodigoEntrega,
                $"Codigo de entrega para tu envio {paquete.CodigoSeguimiento}", cuerpo);
        }

        public async Task NotificarListoParaRetirarAsync(Paquete paquete, PuntoPickUp? punto)
        {
            if (paquete.Destinatario.Email is null) return;

            var urlBase = _configuration["PublicTrackingBaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var trackingUrl = string.IsNullOrWhiteSpace(urlBase) ? "#" : $"{urlBase}/{SecurityElement.Escape(paquete.CodigoSeguimiento)}";

            var nombrePunto = punto?.Nombre ?? "el punto Pick Up";
            var direccionPunto = punto is not null ? $"{punto.Direccion}, {punto.Localidad}" : string.Empty;
            var horariosHtml = string.IsNullOrWhiteSpace(punto?.Horarios) ? string.Empty
                : $"""<div style="font-size:12px;color:#6ee7b7;margin-top:4px;">🕐 {SecurityElement.Escape(punto.Horarios)}</div>""";

            var detalleHtml = $"""
                <div style="background:#052e16;border:1px solid #16a34a;border-radius:10px;padding:14px 16px;margin:14px 0;">
                  <div style="font-size:13px;color:#86efac;margin-bottom:4px;">Punto Pick Up</div>
                  <div style="font-size:15px;font-weight:700;color:#4ade80;">{SecurityElement.Escape(nombrePunto)}</div>
                  <div style="font-size:13px;color:#86efac;margin-top:4px;">{SecurityElement.Escape(direccionPunto)}</div>
                  {horariosHtml}
                </div>
                <div style="background:#0f172a;border:1px solid #16a34a;border-radius:10px;padding:14px 16px;margin:14px 0;text-align:center;">
                  <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Codigo: {SecurityElement.Escape(paquete.CodigoSeguimiento)}</div>
                  <div style="font-size:34px;letter-spacing:10px;font-weight:900;color:#4ade80;">{SecurityElement.Escape(paquete.CodigoEntrega)}</div>
                </div>
                <div style="background:#14532d;border:1px solid #16a34a;border-radius:8px;padding:10px 14px;margin:8px 0;text-align:center;">
                  <span style="font-size:13px;color:#86efac;">&#128274; Mostrale este codigo al local cuando vayas a retirar tu paquete.</span>
                </div>
                """;

            var cuerpo = BuildTemplate("green",
                "Tu paquete llego al punto Pick Up",
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                $"Tu paquete esta disponible en <strong>{SecurityElement.Escape(nombrePunto)}</strong>. Podes acercarte a retirarlo cuando quieras.",
                trackingUrl, "Ver seguimiento", detalleHtml);

            await CrearYEnviarAsync(paquete, EventoEmailNotificacion.ListoParaRetirar,
                $"Tu paquete {paquete.CodigoSeguimiento} esta listo para retirar", cuerpo);
        }

        public async Task NotificarLlegadaSucursalAsync(Paquete paquete, string nombreSucursal, DateTime? fechaEstimadaEntrega = null)
        {
            if (paquete.Destinatario.Email is null) return;

            var urlBase = _configuration["PublicTrackingBaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var trackingUrl = string.IsNullOrWhiteSpace(urlBase) ? "#" : $"{urlBase}/{SecurityElement.Escape(paquete.CodigoSeguimiento)}";

            var detalleHtml = "";
            if (fechaEstimadaEntrega.HasValue)
            {
                var fechaStr = fechaEstimadaEntrega.Value.ToString("dd/MM/yyyy");
                detalleHtml = $"""
                    <div style="background:#0f172a;border:1px solid #3b82f6;border-radius:10px;padding:14px 16px;margin:14px 0;text-align:center;">
                      <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Nueva fecha estimada de entrega:</div>
                      <div style="font-size:24px;font-weight:900;color:#60a5fa;">{fechaStr}</div>
                      <div style="font-size:12px;color:#64748b;margin-top:4px;">Estimaci&oacute;n actualizada en base al recorrido real</div>
                    </div>
                    """;
            }

            var cuerpo = BuildTemplate(
                "blue",
                "Actualizacion de tu envio",
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                $"Te avisamos que tu envio llego y fue procesado en la {SecurityElement.Escape(nombreSucursal)}.",
                trackingUrl,
                "Ver seguimiento",
                detalleHtml);

            await CrearYEnviarAsync(paquete, EventoEmailNotificacion.LlegadaSucursalIntermedia,
                $"Tu envio {paquete.CodigoSeguimiento} llego a {nombreSucursal}", cuerpo);
        }

        public async Task NotificarFechaEstimadaEntregaAsync(Paquete paquete, DateTime fechaEstimada)
        {
            if (paquete.Destinatario.Email is null) return;

            var urlBase = _configuration["PublicTrackingBaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var trackingUrl = string.IsNullOrWhiteSpace(urlBase) ? "#" : $"{urlBase}/{SecurityElement.Escape(paquete.CodigoSeguimiento)}";

            var fechaStr = fechaEstimada.ToString("dd/MM/yyyy");

            var detalleHtml = $"""
                <div style="background:#0f172a;border:1px solid #3b82f6;border-radius:10px;padding:14px 16px;margin:14px 0;text-align:center;">
                  <div style="font-size:13px;color:#94a3b8;margin-bottom:6px;">Fecha estimada de entrega:</div>
                  <div style="font-size:24px;font-weight:900;color:#60a5fa;">{fechaStr}</div>
                </div>
                """;

            var cuerpo = BuildTemplate(
                "indigo",
                "Fecha estimada de tu envio",
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                "Ya tenemos una fecha estimada para la llegada de tu paquete basandonos en el itinerario de viaje.",
                trackingUrl,
                "Ver seguimiento",
                detalleHtml);

            await CrearYEnviarAsync(paquete, EventoEmailNotificacion.FechaEstimadaEntrega,
                $"Fecha estimada para tu envio {paquete.CodigoSeguimiento}", cuerpo);
        }

        public async Task NotificarReagendamientoAsync(Paquete paquete)
        {
            if (paquete.Destinatario.Email is null) return;

            var urlBase = _configuration["PublicTrackingBaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var trackingUrl = string.IsNullOrWhiteSpace(urlBase) ? "#" : $"{urlBase}/{SecurityElement.Escape(paquete.CodigoSeguimiento)}";

            var detalleHtml = $"""
                <div style="background:#1e293b;border:1px solid #f97316;border-radius:10px;padding:14px 16px;margin:14px 0;text-align:center;">
                  <div style="font-size:15px;font-weight:700;color:#fb923c;">Tu envio fue reagendado</div>
                  <div style="font-size:13px;color:#94a3b8;margin-top:6px;">Nuestro equipo intentara entregarlo nuevamente en los proximos dias habiles.</div>
                </div>
                """;

            var cuerpo = BuildTemplate(
                "orange",
                "Nuevo intento de entrega en camino",
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                "No pudimos entregarte el paquete en el intento anterior. Lo hemos reagendado y volvera a salir a ruta pronto.",
                trackingUrl,
                "Seguir mi envio",
                detalleHtml);

            await CrearYEnviarAsync(paquete, EventoEmailNotificacion.FechaEstimadaEntrega,
                $"Nuevo intento de entrega — {paquete.CodigoSeguimiento}", cuerpo);
        }

        public async Task CrearEmailLeadAsync(SolicitudComercial lead)
        {
            var email = new EmailNotificacion(
                null, null, null,
                lead.Email,
                "Informacion de planes LogiTrack",
                BuildLeadEmail(lead),
                EventoEmailNotificacion.LeadPlanes);

            _context.EmailNotificaciones.Add(email);
            await EnviarAsync(email);
        }

        public async Task<bool> ReintentarAsync(Guid emailId, Guid? sucursalScope)
        {
            var email = await _context.EmailNotificaciones.FirstOrDefaultAsync(e => e.Id == emailId);
            if (email is null) return false;
            if (sucursalScope.HasValue && email.SucursalId != sucursalScope) return false;
            await EnviarAsync(email);
            return true;
        }

        private async Task<Guid> ObtenerOCrearTokenEncuestaAsync(Guid paqueteId)
        {
            var existente = await _context.SatisfaccionEncuestas.FirstOrDefaultAsync(e => e.PaqueteId == paqueteId);
            if (existente != null) return existente.Token;

            var encuesta = new SatisfaccionEncuesta(paqueteId);
            _context.SatisfaccionEncuestas.Add(encuesta);
            await _context.SaveChangesAsync();
            return encuesta.Token;
        }

        private async Task CrearYEnviarAsync(Paquete paquete, EventoEmailNotificacion evento, string asunto, string cuerpo)
        {
            var yaExiste = await _context.EmailNotificaciones.AnyAsync(e =>
                e.PaqueteId == paquete.Id && e.Evento == evento && e.Asunto == asunto);
            if (yaExiste) return;

            // Aplica plantilla personalizada de la provincia si existe
            var plantilla = paquete.ProvinciaDestino is not null
                ? await _context.PlantillasEmail.FirstOrDefaultAsync(p =>
                    p.Provincia == paquete.ProvinciaDestino && p.Evento == evento)
                : null;

            if (plantilla is not null)
            {
                asunto = AplicarVariables(plantilla.Asunto, paquete);
                // El cuerpo personalizado reemplaza solo el texto del cuerpo principal
                cuerpo = cuerpo.Replace("{{cuerpoPersonalizado}}", plantilla.Cuerpo)
                               .Replace(plantilla.Asunto, asunto);
            }

            var email = new EmailNotificacion(
                paquete.Id,
                paquete.SucursalId,
                paquete.CodigoSeguimiento,
                paquete.Destinatario.Email!,
                asunto,
                cuerpo,
                evento);

            _context.EmailNotificaciones.Add(email);
            await EnviarAsync(email);
        }

        private static string AplicarVariables(string template, Paquete paquete, PaqueteStatus? estado = null)
        {
            var estadoLabel = estado switch
            {
                PaqueteStatus.EnTransito => "En tránsito",
                PaqueteStatus.Entregado => "Entregado",
                PaqueteStatus.CargadoEnVehiculo => "Cargado en vehículo",
                PaqueteStatus.Demorado => "Demorado",
                PaqueteStatus.Cancelado => "Cancelado",
                PaqueteStatus.RetornandoASucursal => "Retornando a sucursal",
                PaqueteStatus.RetornadoASucursal => "Retornado a sucursal",
                _ => ""
            };
            return template
                .Replace("{{tracking}}", System.Security.SecurityElement.Escape(paquete.CodigoSeguimiento))
                .Replace("{{destinatario}}", System.Security.SecurityElement.Escape($"{paquete.Destinatario.Nombre} {paquete.Destinatario.Apellido}".Trim()))
                .Replace("{{nombre}}", System.Security.SecurityElement.Escape(paquete.Destinatario.Nombre ?? ""))
                .Replace("{{estado}}", estadoLabel)
                .Replace("{{codigoEntrega}}", System.Security.SecurityElement.Escape(paquete.CodigoEntrega))
                .Replace("{{fecha}}", paquete.FechaEstimadaEntrega?.ToLocalTime().ToString("dd/MM/yyyy") ?? "")
                .Replace("{{provincia}}", System.Security.SecurityElement.Escape(paquete.ProvinciaDestino ?? ""));
        }

        private async Task EnviarAsync(EmailNotificacion email)
        {
            if (!EmailService.IsEmailValid(email.DestinatarioEmail))
            {
                email.MarcarFallido("Email invalido.");
                return;
            }

            var host = _configuration["Email:Smtp:Host"];
            if (string.IsNullOrWhiteSpace(host))
            {
                email.MarcarEnviado();
                return;
            }

            try
            {
                using var client = new SmtpClient(host, int.TryParse(_configuration["Email:Smtp:Port"], out var port) ? port : 587)
                {
                    EnableSsl = bool.TryParse(_configuration["Email:Smtp:EnableSsl"], out var ssl) ? ssl : true,
                };

                var user = _configuration["Email:Smtp:User"];
                var pass = _configuration["Email:Smtp:Password"];
                if (!string.IsNullOrWhiteSpace(user))
                    client.Credentials = new NetworkCredential(user, pass);

                var from = _configuration["Email:From"] ?? "noreply@logitrack.local";
                using var message = new MailMessage(from, email.DestinatarioEmail, email.Asunto, email.Cuerpo)
                {
                    IsBodyHtml = true,
                };
                await client.SendMailAsync(message);
                email.MarcarEnviado();
            }
            catch (Exception ex)
            {
                email.MarcarFallido(ex.Message);
            }
        }

        private string BuildEstadoEmail(Paquete paquete, PaqueteStatus estado, List<HistorialEstadoEnvio> historial, string titulo, string mensaje)
        {
            var urlBase = _configuration["PublicTrackingBaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var trackingUrl = string.IsNullOrWhiteSpace(urlBase) ? "#" : $"{urlBase}/{SecurityElement.Escape(paquete.CodigoSeguimiento)}";
            var color = ColorPorEstado(estado);

            var detalleHtml = $"""
                <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:12px 14px;margin:14px 0;font-size:13px;line-height:1.8;color:#cbd5e1;">
                  <div><b style="color:#94a3b8;">Codigo:</b> {SecurityElement.Escape(paquete.CodigoSeguimiento)}</div>
                  <div><b style="color:#94a3b8;">Destino:</b> {SecurityElement.Escape(paquete.Destinatario.Direccion.Calle)}, {SecurityElement.Escape(paquete.Destinatario.Direccion.Ciudad)}</div>
                  <div><b style="color:#94a3b8;">Peso:</b> {paquete.Peso:0.##} kg</div>
                </div>
                {BuildTimelineHtml(historial)}
                """;

            return BuildTemplate(color, titulo,
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                SecurityElement.Escape(mensaje),
                trackingUrl, "Ver seguimiento", detalleHtml);
        }

        private string BuildEncuestaEmail(Paquete paquete, Guid token)
        {
            var appBase = (_configuration["PublicAppBaseUrl"] ?? _configuration["PublicTrackingBaseUrl"] ?? string.Empty)
                .TrimEnd('/')
                .Replace("/seguimiento", "");
            var surveyUrl = string.IsNullOrWhiteSpace(appBase) ? "#" : $"{appBase}/encuesta/{token}";

            var detalleHtml = $"""
                <div style="text-align:center;padding:10px 0 6px;">
                  <div style="font-size:28px;letter-spacing:2px;margin-bottom:8px;">⭐⭐⭐⭐⭐</div>
                  <p style="font-size:14px;color:#94a3b8;margin:0 0 14px;">Toma solo 30 segundos y nos ayuda a mejorar.</p>
                </div>
                """;

            return BuildTemplate("purple",
                "Como fue tu experiencia?",
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                "Tu opinion nos ayuda a mejorar la calidad del servicio. Contanos como salio tu entrega.",
                surveyUrl, "Calificar mi entrega", detalleHtml);
        }

        private string BuildLeadEmail(SolicitudComercial lead)
        {
            var appBase = (_configuration["PublicAppBaseUrl"]
                ?? _configuration["PublicTrackingBaseUrl"]
                ?? "https://logitrack-app-1.onrender.com")
                .TrimEnd('/').Replace("/seguimiento", "");

            var nombre = lead.NombreContacto is "-" or ""
                ? null
                : SecurityElement.Escape(lead.NombreContacto);
            var saludo = nombre is null ? "¡Hola!" : $"Hola {nombre},";

            var esPremium = lead.PlanInteres.Equals("Premium", StringComparison.OrdinalIgnoreCase);
            var basicoBorder = !esPremium ? "#38bdf8" : "#334155";
            var premiumBorder = esPremium ? "#c084fc" : "#334155";

            static string Feat(string text) =>
                $"""<div style="font-size:12.5px;color:#cbd5e1;padding:3px 0;"><span style="color:#4ade80;margin-right:5px;">✓</span>{text}</div>""";
            static string NoFeat(string text) =>
                $"""<div style="font-size:12.5px;color:#475569;padding:3px 0;"><span style="margin-right:5px;">—</span>{text}</div>""";

            var basicoFeatures = string.Join("\n", new[]
            {
                Feat("1 sucursal"),
                Feat("Hasta 50 envios activos"),
                Feat("Hasta 5 usuarios"),
                Feat("Hasta 3 repartidores"),
                Feat("Seguimiento en tiempo real"),
                Feat("Notificaciones por email"),
                Feat("Pagina publica de tracking"),
                Feat("Codigo OTP de entrega"),
                Feat("Encuesta post-entrega"),
                Feat("Dashboard operativo"),
                NoFeat("Sucursales multiples"),
                NoFeat("Planificacion de rutas avanzada"),
                NoFeat("Lotes de envios masivos"),
                NoFeat("Ojo del Patron"),
                NoFeat("Prueba acustica de identidad"),
                NoFeat("Reportes ejecutivos"),
            });

            var premiumFeatures = string.Join("\n", new[]
            {
                Feat("Sucursales ilimitadas"),
                Feat("Envios ilimitados"),
                Feat("Usuarios y repartidores ilimitados"),
                Feat("Todo lo del plan Basico +"),
                Feat("Planificacion de rutas avanzada"),
                Feat("Lotes de envios masivos"),
                Feat("Calendario de despachos"),
                Feat("Ojo del Patron (supervision en tiempo real)"),
                Feat("Prueba acustica de identidad (verificacion por voz)"),
                Feat("Reportes ejecutivos y metricas ampliadas"),
                Feat("Soporte prioritario y acompanamiento"),
            });

            var detalleHtml = $"""
                <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                  <tr>
                    <td width="48%" style="vertical-align:top;padding-right:6px;">
                      <div style="background:#0f172a;border:2px solid {basicoBorder};border-radius:12px;padding:14px;">
                        <div style="text-align:center;margin-bottom:10px;">
                          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Plan</div>
                          <div style="font-size:19px;font-weight:700;color:#38bdf8;margin:4px 0;">Basico</div>
                          <div style="font-size:20px;font-weight:700;color:#e2e8f0;margin:6px 0 2px;">$49.900<span style="font-size:11px;font-weight:400;color:#64748b;">&nbsp;/mes + IVA</span></div>
                          <div style="font-size:11px;color:#475569;">$479.000 / año</div>
                          <div style="font-size:11px;color:#60a5fa;margin-top:5px;">Hasta 50 cuentas</div>
                        </div>
                        <div style="border-top:1px solid #1e293b;padding-top:8px;">
                          {basicoFeatures}
                        </div>
                      </div>
                    </td>
                    <td width="4%"></td>
                    <td width="48%" style="vertical-align:top;padding-left:6px;">
                      <div style="background:#0f172a;border:2px solid {premiumBorder};border-radius:12px;padding:14px;">
                        <div style="text-align:center;margin-bottom:4px;">
                          <span style="background:#7c3aed;color:#fff;font-size:9px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:20px;letter-spacing:0.5px;">MAS FUNCIONES</span>
                        </div>
                        <div style="text-align:center;margin-bottom:10px;">
                          <div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:700;">Plan</div>
                          <div style="font-size:19px;font-weight:700;color:#c084fc;margin:4px 0;">Premium</div>
                          <div style="font-size:20px;font-weight:700;color:#e2e8f0;margin:6px 0 2px;">$189.900<span style="font-size:11px;font-weight:400;color:#64748b;">&nbsp;/mes + IVA</span></div>
                          <div style="font-size:11px;color:#475569;">$1.819.000 / año</div>
                          <div style="font-size:11px;color:#a78bfa;margin-top:5px;">Hasta 100 cuentas</div>
                        </div>
                        <div style="border-top:1px solid #1e293b;padding-top:8px;">
                          {premiumFeatures}
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>

                <div style="background:#0f172a;border:1px solid #334155;border-radius:10px;padding:14px 16px;margin:0 0 4px;">
                  <div style="font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">¿Tenes dudas?</div>
                  <div style="font-size:13px;color:#cbd5e1;line-height:1.5;">Un asesor de LogiTrack se va a contactar con vos a la brevedad para guiarte en la eleccion del plan ideal para tu empresa.</div>
                  <div style="font-size:12px;color:#475569;margin-top:8px;">📧 notificaciones.logitrack@gmail.com</div>
                </div>
                """;

            return BuildTemplate("blue",
                "Informacion de planes LogiTrack",
                saludo,
                "Gracias por tu interes. Aca te dejamos la informacion completa de nuestros planes:",
                appBase,
                "Ir a LogiTrack",
                detalleHtml);
        }

        private static string BuildTimelineHtml(List<HistorialEstadoEnvio> historial)
        {
            if (historial.Count == 0) return string.Empty;

            var items = historial.TakeLast(5).Select(h =>
            {
                var label = h.EstadoNuevo switch
                {
                    PaqueteStatus.PendienteDeCalendarizacion => "Registrado",
                    PaqueteStatus.AsignadoAVehiculo => "Asignado",
                    PaqueteStatus.CargadoEnVehiculo => "Cargado en vehiculo",
                    PaqueteStatus.ListoParaSalir => "Listo para salir",
                    PaqueteStatus.EnTransito => "En transito",
                    PaqueteStatus.Demorado => "Demorado",
                    PaqueteStatus.Entregado => "Entregado",
                    PaqueteStatus.Cancelado => "Cancelado",
                    PaqueteStatus.RetornandoASucursal => "Retornando a sucursal",
                    PaqueteStatus.RetornadoASucursal => "Retornado a sucursal",
                    _ => "Actualizado"
                };
                var dot = h.EstadoNuevo switch
                {
                    PaqueteStatus.Entregado => "#22c55e",
                    PaqueteStatus.Cancelado => "#ef4444",
                    PaqueteStatus.RetornandoASucursal => "#f97316",
                    PaqueteStatus.RetornadoASucursal => "#14b8a6",
                    PaqueteStatus.Demorado => "#f97316",
                    PaqueteStatus.EnTransito => "#3b82f6",
                    _ => "#64748b"
                };
                var fecha = h.FechaHora.ToLocalTime().ToString("dd/MM HH:mm");
                return $"""<div style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:#94a3b8;"><span style="width:8px;height:8px;border-radius:50%;background:{dot};flex-shrink:0;display:inline-block;"></span><span style="color:#cbd5e1;">{SecurityElement.Escape(label)}</span><span style="margin-left:auto;">{fecha}</span></div>""";
            });

            return $"""
                <div style="background:#0f172a;border:1px solid #1e293b;border-radius:10px;padding:10px 14px;margin:10px 0;">
                  <div style="font-size:11px;color:#64748b;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;">Historial</div>
                  {string.Join("\n", items)}
                </div>
                """;
        }

        private const string EmailCss = "@keyframes go{0%,100%{transform:translateX(0)}50%{transform:translateX(12px)}}.t{animation:go 1.8s ease-in-out infinite;display:inline-block;font-size:38px;}";

        private static string ColorPorEstado(PaqueteStatus estado) => estado switch
        {
            PaqueteStatus.CargadoEnVehiculo => "amber",
            PaqueteStatus.EnTransito => "blue",
            PaqueteStatus.Entregado => "green",
            PaqueteStatus.Demorado => "orange",
            PaqueteStatus.Cancelado => "red",
            PaqueteStatus.RetornandoASucursal => "orange",
            PaqueteStatus.RetornadoASucursal => "green",
            _ => "blue"
        };

        private static string BuildTemplate(string color, string titulo, string saludo, string mensaje, string ctaUrl, string cta, string detalleHtml)
        {
            var (grad1, grad2, btn) = color switch
            {
                "green" => ("#16a34a", "#15803d", "#16a34a"),
                "amber" => ("#d97706", "#b45309", "#d97706"),
                "orange" => ("#ea580c", "#c2410c", "#ea580c"),
                "red" => ("#dc2626", "#b91c1c", "#dc2626"),
                "indigo" => ("#7c3aed", "#6d28d9", "#7c3aed"),
                "purple" => ("#9333ea", "#7e22ce", "#9333ea"),
                _ => ("#1d4ed8", "#1e40af", "#1d4ed8")
            };

            return $"""
            <!doctype html><html><head></head>
            <body style="margin:0;background:#0f172a;font-family:Arial,sans-serif;">
            <style>{EmailCss}</style>
            <div style="max-width:580px;margin:0 auto;padding:20px 14px;">
              <div style="background:linear-gradient(135deg,{grad1},{grad2});padding:26px 22px;border-radius:14px 14px 0 0;text-align:center;">
                <div class="t">🚛</div>
                <h1 style="margin:10px 0 0;font-size:21px;color:#fff;line-height:1.2;">{SecurityElement.Escape(titulo)}</h1>
              </div>
              <div style="background:#1e293b;padding:22px;border-radius:0 0 14px 14px;border:1px solid #334155;border-top:0;color:#e2e8f0;">
                <p style="font-size:16px;margin:0 0 10px;">{saludo}</p>
                <p style="font-size:14px;color:#94a3b8;margin:0 0 14px;line-height:1.5;">{mensaje}</p>
                {detalleHtml}
                <a href="{ctaUrl}" style="display:inline-block;background:{btn};color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:9px;font-size:14px;margin-top:6px;">{SecurityElement.Escape(cta)}</a>
                <p style="font-size:11px;color:#475569;margin-top:18px;border-top:1px solid #1e293b;padding-top:12px;">Este mensaje fue generado automaticamente por LogiTrack.</p>
              </div>
            </div>
            </body></html>
            """;
        }
    }
}
