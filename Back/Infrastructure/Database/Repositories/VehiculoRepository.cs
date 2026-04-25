using Back.Domain.Models;
using Back.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Back.Infrastructure.Database.Repositories
{

    public class VehiculosRepository : IVehiculoRepository
    {
        private readonly LogiTrackDbContext _context;

        public VehiculosRepository(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task Add(Vehiculo vehiculo)
        {
            await _context.Vehiculos.AddAsync(vehiculo);
        }

        public async Task<List<Vehiculo>> GetAll(VehiculoEstado? estado)
        {
            if (estado == null)
                return await _context.Vehiculos.ToListAsync();

            return await _context.Vehiculos.Where(v => v.Estado == estado).ToListAsync();
        }

        public Task<Vehiculo?> GetVehiculo(Guid id)
        {   
            return _context.Vehiculos.FindAsync(id).AsTask();
        }

        public async Task<Vehiculo?> GetVehiculoById(Guid id)
        {
            return await _context.Vehiculos.FindAsync(id);
        }

        public Task<List<Vehiculo>> GetVehiculosActivos()
        {   
            return _context.Vehiculos.Where(v => v.Estado == VehiculoEstado.Disponible).ToListAsync();
            
        }
    }   
}