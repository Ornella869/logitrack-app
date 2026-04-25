using Back.Domain.Models;
using Back.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Back.Infrastructure.Database.Repositories
{
    public class EnviosRepository : IEnviosRepository
    {

        private readonly LogiTrackDbContext _context;

        public EnviosRepository(LogiTrackDbContext context)
        {
            _context = context;
        }

        public  async Task Add(Paquete envio)
        {   
            await _context.Paquetes.AddAsync(envio);
        }

        public  async Task Add(Sucursal sucursal)
        {   
            await _context.Sucursales.AddAsync(sucursal);
        }

        public async Task<List<Paquete>> GetAll()
        {   
            return await _context.Paquetes.ToListAsync();
        }

        public async Task<Paquete?> GetPaquete(Guid id)
        {
            return await _context.Paquetes.FindAsync(id);
        }

        public async     Task<Paquete?> GetPaqueteByCodigoSeguimiento(string codigoSeguimiento)
        {
            return await _context.Paquetes.FirstOrDefaultAsync(p => p.CodigoSeguimiento == codigoSeguimiento);
        }

        public async Task<List<Paquete>> GetPaquetes(string? codigoSeguimiento, string? destinatario)
        {   
            var query = _context.Paquetes.AsQueryable();

            if (!string.IsNullOrEmpty(codigoSeguimiento))
                query = query.Where(p => p.CodigoSeguimiento.Contains(codigoSeguimiento));

            if (!string.IsNullOrEmpty(destinatario))
                query = query.Where(p => p.DestinatarioCompleto.Contains(destinatario));

            return await query.ToListAsync();            
        }

        public async Task<List<Paquete>> GetPaquetesByIds(List<Guid> paqueteIds)
        {
            return await _context.Paquetes.Where(p => paqueteIds.Contains(p.Id)).ToListAsync();
        }

        public async     Task<List<Paquete>> GetPaquetesEnSucursal()
        {
            return await _context.Paquetes.Where(p => p.Status == PaqueteStatus.EnSucursal).ToListAsync();
        }

        public async Task<List<Sucursal>> GetSucursales()
        {
            return await _context.Sucursales.ToListAsync();
        }
    }
}