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

            if (estado == PaqueteStatus.CargadoEnVehiculo)
            {
                await CrearYEnviarAsync(
                    paquete,
                    EventoEmailNotificacion.CargadoEnVehiculo,
                    $"Tu envio {paquete.CodigoSeguimiento} fue cargado al vehiculo",
                    BuildPaqueteEmail(
                        paquete,
                        "Tu envio fue cargado al vehiculo",
                        "El paquete ya fue cargado y esta listo para salir a reparto.",
                        "Ver seguimiento"));
            }

            if (estado == PaqueteStatus.EnTransito)
            {
                await CrearYEnviarAsync(
                    paquete,
                    EventoEmailNotificacion.SalidaRuta,
                    $"Tu envio {paquete.CodigoSeguimiento} salio a ruta",
                    BuildPaqueteEmail(
                        paquete,
                        "Tu envio salio a ruta",
                        "Ya esta en transito y podes seguir el avance desde el portal.",
                        "Seguir envio"));
            }

            if (estado == PaqueteStatus.Entregado)
            {
                await CrearYEnviarAsync(
                    paquete,
                    EventoEmailNotificacion.EntregaConfirmada,
                    $"Tu envio {paquete.CodigoSeguimiento} fue entregado",
                    BuildPaqueteEmail(
                        paquete,
                        "Entrega confirmada",
                        "Confirmamos que tu envio fue entregado correctamente.",
                        "Ver seguimiento"));

                await CrearYEnviarAsync(
                    paquete,
                    EventoEmailNotificacion.EncuestaPostEntrega,
                    $"Contanos como fue tu entrega {paquete.CodigoSeguimiento}",
                    BuildPaqueteEmail(
                        paquete,
                        "Como fue tu experiencia?",
                        "Tu opinion nos ayuda a mejorar la calidad del servicio.",
                        "Ver envio"));
            }

            if (estado == PaqueteStatus.Demorado)
            {
                await CrearYEnviarAsync(
                    paquete,
                    EventoEmailNotificacion.Demorado,
                    $"Tu envio {paquete.CodigoSeguimiento} esta demorado",
                    BuildPaqueteEmail(
                        paquete,
                        "Tu envio esta demorado",
                        string.IsNullOrWhiteSpace(paquete.RazonDemora)
                            ? "Detectamos una demora operativa. Te avisaremos cuando el recorrido continue."
                            : $"Detectamos una demora operativa: {paquete.RazonDemora}. Te avisaremos cuando el recorrido continue.",
                        "Ver seguimiento"));
            }

            if (estado == PaqueteStatus.Cancelado)
            {
                await CrearYEnviarAsync(
                    paquete,
                    EventoEmailNotificacion.Cancelado,
                    $"Tu envio {paquete.CodigoSeguimiento} fue cancelado",
                    BuildPaqueteEmail(
                        paquete,
                        "Tu envio fue cancelado",
                        string.IsNullOrWhiteSpace(paquete.RazonCancelacion)
                            ? "El envio fue cancelado."
                            : $"El envio fue cancelado. Motivo: {paquete.RazonCancelacion}.",
                        "Ver seguimiento"));
            }
        }

        public async Task NotificarCodigoEntregaAsync(Paquete paquete)
        {
            if (paquete.Destinatario.Email is null) return;

            await CrearYEnviarAsync(
                paquete,
                EventoEmailNotificacion.CodigoEntrega,
                $"Codigo de entrega para tu envio {paquete.CodigoSeguimiento}",
                BuildTemplate(
                    "Codigo de entrega",
                    $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                    "Este codigo se lo tenes que informar al repartidor cuando recibas el paquete.",
                    "#",
                    "Ver seguimiento",
                    $"""
                    <div style="background:#f4f9fd;border:1px solid #d8e6f0;border-radius:12px;padding:14px 16px;margin:16px 0;color:#263b50;line-height:1.7;">
                      <div><strong>Codigo de seguimiento:</strong> {SecurityElement.Escape(paquete.CodigoSeguimiento)}</div>
                      <div style="font-size:28px;letter-spacing:8px;font-weight:800;margin-top:10px;color:#0b5f93;">{SecurityElement.Escape(paquete.CodigoEntrega)}</div>
                    </div>
                    """));
        }

        public async Task CrearEmailLeadAsync(SolicitudComercial lead)
        {
            var email = new EmailNotificacion(
                null,
                null,
                null,
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

        private async Task CrearYEnviarAsync(Paquete paquete, EventoEmailNotificacion evento, string asunto, string cuerpo)
        {
            var yaExiste = await _context.EmailNotificaciones.AnyAsync(e =>
                e.PaqueteId == paquete.Id && e.Evento == evento);
            if (yaExiste) return;

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

        private string BuildPaqueteEmail(Paquete paquete, string titulo, string mensaje, string cta)
        {
            var urlBase = _configuration["PublicTrackingBaseUrl"]?.TrimEnd('/') ?? string.Empty;
            var trackingUrl = string.IsNullOrWhiteSpace(urlBase)
                ? "#"
                : $"{urlBase}/{SecurityElement.Escape(paquete.CodigoSeguimiento)}";
            return BuildTemplate(
                titulo,
                $"Hola {SecurityElement.Escape(paquete.Destinatario.Nombre)},",
                mensaje,
                trackingUrl,
                cta,
                $"""
                <div style="background:#f4f9fd;border:1px solid #d8e6f0;border-radius:12px;padding:14px 16px;margin:16px 0;color:#263b50;line-height:1.7;">
                  <div><strong>Codigo:</strong> {SecurityElement.Escape(paquete.CodigoSeguimiento)}</div>
                  <div><strong>Destino:</strong> {SecurityElement.Escape(paquete.Destinatario.Direccion.Calle)}, {SecurityElement.Escape(paquete.Destinatario.Direccion.Ciudad)}</div>
                  <div><strong>Peso:</strong> {paquete.Peso:0.##} kg</div>
                </div>
                """);
        }

        private string BuildLeadEmail(SolicitudComercial lead)
        {
            return BuildTemplate(
                "Gracias por tu interes en LogiTrack",
                $"Hola {SecurityElement.Escape(lead.NombreContacto)},",
                $"Recibimos tu solicitud por el plan {SecurityElement.Escape(lead.PlanInteres)}. Un asesor se va a contactar con vos para ayudarte a elegir la mejor opcion.",
                "https://logitrack-app-1.onrender.com",
                "Conocer LogiTrack",
                $"""
                <div style="background:#f4f9fd;border:1px solid #d8e6f0;border-radius:12px;padding:14px 16px;margin:16px 0;color:#263b50;line-height:1.7;">
                  <div><strong>Empresa:</strong> {SecurityElement.Escape(lead.NombreEmpresa)}</div>
                  <div><strong>Plan de interes:</strong> {SecurityElement.Escape(lead.PlanInteres)}</div>
                </div>
                """);
        }

        private static string BuildTemplate(string titulo, string saludo, string mensaje, string ctaUrl, string cta, string detalleHtml)
        {
            return $"""
            <!doctype html>
            <html>
            <body style="margin:0;background:#eef5fb;font-family:Arial,sans-serif;color:#102033;">
              <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
                <div style="background:#0b5f93;color:white;padding:22px 24px;border-radius:16px 16px 0 0;">
                  <div style="font-size:14px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">LogiTrack</div>
                  <h1 style="margin:8px 0 0;font-size:26px;line-height:1.2;">{SecurityElement.Escape(titulo)}</h1>
                </div>
                <div style="background:white;padding:24px;border-radius:0 0 16px 16px;border:1px solid #d8e6f0;border-top:0;">
                  <p style="font-size:17px;margin:0 0 10px;">{saludo}</p>
                  <p style="font-size:15px;line-height:1.55;margin:0 0 18px;color:#425466;">{SecurityElement.Escape(mensaje)}</p>
                  {detalleHtml}
                  <a href="{ctaUrl}" style="display:inline-block;background:#1976d2;color:white;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:10px;margin-top:10px;">{SecurityElement.Escape(cta)}</a>
                  <p style="font-size:12px;color:#78909c;margin-top:22px;">Este mensaje fue generado automaticamente por LogiTrack.</p>
                </div>
              </div>
            </body>
            </html>
            """;
        }
    }
}
