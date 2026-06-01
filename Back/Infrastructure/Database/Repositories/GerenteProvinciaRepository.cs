using Back.Domain.Repositories;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Back.Infrastructure.Database.Repositories
{
    public class GerenteProvinciaRepository : IGerenteProvinciaRepository
    {
        private readonly LogiTrackDbContext _context;

        public GerenteProvinciaRepository(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task<List<string>> GetProvinciasByGerente(Guid gerenteId)
        {
            return await _context.GerentesProvincias
                .Where(gp => gp.GerenteId == gerenteId)
                .Select(gp => gp.Provincia)
                .ToListAsync();
        }

        public async Task<Guid?> GetGerenteIdByProvincia(string provincia)
        {
            if (string.IsNullOrWhiteSpace(provincia)) return null;
            var norm = provincia.Trim();
            var entry = await _context.GerentesProvincias.FirstOrDefaultAsync(gp => gp.Provincia == norm);
            return entry?.GerenteId;
        }

        public async Task AssignProvincias(Guid gerenteId, IEnumerable<string> provincias)
        {
            var lista = provincias?.Select(p => p?.Trim())
                .Where(p => !string.IsNullOrEmpty(p))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList() ?? new List<string>();

            // Remove existing mappings for this gerente
            var existentes = _context.GerentesProvincias.Where(gp => gp.GerenteId == gerenteId);
            _context.GerentesProvincias.RemoveRange(existentes);

            // Add new mappings
            foreach (var p in lista)
            {
                _context.GerentesProvincias.Add(new GerenteProvincia(gerenteId, p));
            }
        }
    }
}
