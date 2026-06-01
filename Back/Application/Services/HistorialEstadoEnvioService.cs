using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    // G1L-81: el front necesita identificar quién realizó cada cambio (especialmente
    // el escaneo que pasó el paquete a "Cargado en Vehículo"). Devolvemos el nombre
    // del usuario junto al evento para no obligar al cliente a resolver el ID.
    public class HistorialEstadoEnvioDto
    {
        public Guid Id { get; init; }
        public Guid PaqueteId { get; init; }
        public PaqueteStatus EstadoNuevo { get; init; }
        public DateTime FechaHora { get; init; }
        public Guid? UsuarioId { get; init; }
        public string? UsuarioNombre { get; init; }
        public OrigenCambioEstado Origen { get; init; }
        public string? Motivo { get; init; }
    }

    public class HistorialEstadoEnvioService
    {
        private readonly LogiTrackDbContext _context;
        private readonly EmailNotificacionService _emails;

        public HistorialEstadoEnvioService(LogiTrackDbContext context, EmailNotificacionService emails)
        {
            _context = context;
            _emails = emails;
        }

        public async Task RegistrarCambioAsync(
            Guid paqueteId,
            PaqueteStatus estadoNuevo,
            Guid? usuarioId,
            OrigenCambioEstado origen = OrigenCambioEstado.Manual,
            string? motivo = null)
        {
            var entry = new HistorialEstadoEnvio(paqueteId, estadoNuevo, usuarioId, origen, motivo);
            await _context.HistorialEstadosEnvio.AddAsync(entry);
            await _emails.NotificarCambioEstadoAsync(paqueteId, estadoNuevo);
        }

        public async Task<List<HistorialEstadoEnvioDto>> GetHistorialPorPaqueteAsync(Guid paqueteId)
        {
            return await _context.HistorialEstadosEnvio
                .Where(h => h.PaqueteId == paqueteId)
                .OrderByDescending(h => h.FechaHora)
                .Select(h => new HistorialEstadoEnvioDto
                {
                    Id = h.Id,
                    PaqueteId = h.PaqueteId,
                    EstadoNuevo = h.EstadoNuevo,
                    FechaHora = h.FechaHora,
                    UsuarioId = h.UsuarioId,
                    UsuarioNombre = h.UsuarioId.HasValue
                        ? _context.Usuarios
                            .Where(u => u.Id == h.UsuarioId.Value)
                            .Select(u => u.Nombre + " " + u.Apellido)
                            .FirstOrDefault()
                        : null,
                    Origen = h.Origen,
                    Motivo = h.Motivo,
                })
                .ToListAsync();
        }
    }
}
