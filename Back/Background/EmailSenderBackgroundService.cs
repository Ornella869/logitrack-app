using Back.Application.Services;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using System.Diagnostics;

namespace Back.Background
{
    public class EmailSenderBackgroundService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<EmailSenderBackgroundService> _logger;

        public EmailSenderBackgroundService(IServiceScopeFactory scopeFactory, ILogger<EmailSenderBackgroundService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("EmailSenderBackgroundService is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessPendingEmailsAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred processing pending emails.");
                }

                await Task.Delay(5000, stoppingToken);
            }

            _logger.LogInformation("EmailSenderBackgroundService is stopping.");
        }

        private async Task ProcessPendingEmailsAsync(CancellationToken stoppingToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<LogiTrackDbContext>();
            var emailService = scope.ServiceProvider.GetRequiredService<EmailNotificacionService>();

            var pendientes = await context.EmailNotificaciones
                .Where(e => e.Estado == EstadoEmailNotificacion.Pendiente && e.Intentos < 3)
                .OrderBy(e => e.CreadoEn)
                .Take(20)
                .ToListAsync(stoppingToken);

            if (pendientes.Count == 0)
                return;

            foreach (var email in pendientes)
            {
                var sw = Stopwatch.StartNew();
                try
                {
                    await emailService.EnviarAsync(email);
                    _logger.LogInformation("Email {EmailId} enviado en {ElapsedMs}ms", email.Id, sw.ElapsedMilliseconds);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send email {EmailId}", email.Id);
                    // email.MarcarFallido() ya es llamado dentro de EnviarAsync en caso de error.
                }
            }

            await context.SaveChangesAsync(stoppingToken);
        }
    }
}
