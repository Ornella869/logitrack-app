using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class HistorialEstadoEnvioService
    {
        private readonly LogiTrackDbContext _context;

        public HistorialEstadoEnvioService(LogiTrackDbContext context)
        {
            _context = context;
        }

        public Task RegistrarCambioAsync(
            Guid paqueteId,
            PaqueteStatus estadoNuevo,
            Guid? usuarioId,
            OrigenCambioEstado origen = OrigenCambioEstado.Manual,
            string? motivo = null)
        {
            var entry = new HistorialEstadoEnvio(paqueteId, estadoNuevo, usuarioId, origen, motivo);
            return _context.HistorialEstadosEnvio.AddAsync(entry).AsTask();
        }

        public async Task<List<HistorialEstadoEnvio>> GetHistorialPorPaqueteAsync(Guid paqueteId)
        {
            return await _context.HistorialEstadosEnvio
                .Where(h => h.PaqueteId == paqueteId)
                .OrderByDescending(h => h.FechaHora)
                .ToListAsync();
        }
    }
}
