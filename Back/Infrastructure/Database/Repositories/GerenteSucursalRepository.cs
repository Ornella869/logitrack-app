using Back.Domain.Models;
using Back.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Back.Infrastructure.Database.Repositories
{
    public class GerenteSucursalRepository : IGerenteSucursalRepository
    {
        private readonly LogiTrackDbContext _context;

        public GerenteSucursalRepository(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task<List<Guid>> GetSucursalesByGerente(Guid gerenteId)
        {
            return await _context.GerentesSucursales
                .Where(gs => gs.GerenteId == gerenteId)
                .Select(gs => gs.SucursalId)
                .ToListAsync();
        }

        public async Task AssignSucursales(Guid gerenteId, IEnumerable<Guid> sucursalIds)
        {
            var lista = sucursalIds?.Distinct().ToList() ?? new List<Guid>();

            var existentes = _context.GerentesSucursales.Where(gs => gs.GerenteId == gerenteId);
            _context.GerentesSucursales.RemoveRange(existentes);

            foreach (var id in lista)
                _context.GerentesSucursales.Add(new GerenteSucursal(gerenteId, id));
        }
    }
}
