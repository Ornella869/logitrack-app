using Back.Application.Common;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Background
{
    public class LicenciasRepartidoresService : BackgroundService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<LicenciasRepartidoresService> _logger;

        public LicenciasRepartidoresService(IServiceScopeFactory scopeFactory, ILogger<LicenciasRepartidoresService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await SuspenderLicenciasVencidasAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error al suspender repartidores con licencia vencida.");
                }

                await Task.Delay(TimeSpan.FromDays(1), stoppingToken);
            }
        }

        private async Task SuspenderLicenciasVencidasAsync(CancellationToken cancellationToken)
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            var context = scope.ServiceProvider.GetRequiredService<LogiTrackDbContext>();
            var hoy = OperationalClock.TodayUtcDate;

            var repartidores = await context.Usuarios
                .OfType<Repartidor>()
                .Where(r => r.Estado == Repartidor.EstadoRepartidor.Activo
                    && r.FechaVencimientoLicencia.HasValue
                    && r.FechaVencimientoLicencia.Value.Date <= hoy)
                .ToListAsync(cancellationToken);

            foreach (var repartidor in repartidores)
            {
                repartidor.SuspenderPorLicenciaVencida();
            }

            if (repartidores.Count == 0)
                return;

            await context.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Se suspendieron {Cantidad} repartidores por licencia vencida.", repartidores.Count);
        }
    }
}
