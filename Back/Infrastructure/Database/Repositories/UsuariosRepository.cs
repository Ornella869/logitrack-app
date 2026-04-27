using Back.Domain.Models;
using Back.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Back.Infrastructure.Database.Repositories
{
    public class UsuariosRepository : IUserRepository
    {
        private readonly LogiTrackDbContext _context;

        public UsuariosRepository(LogiTrackDbContext context)
        {
            _context = context;
        }

        public Task Add(Usuario usuario) => _context.Usuarios.AddAsync(usuario).AsTask();

        public async Task<List<Usuario>> GetAll()
        {
            return await _context.Usuarios.ToListAsync();
        }

        public Task<List<Operador>> GetOperadores()
        {
            return _context.Usuarios.OfType<Operador>().ToListAsync();
        }

        public Task<List<Supervisor>> GetSupervisores()
        {
            return _context.Usuarios.OfType<Supervisor>().ToListAsync();
        }

        public Task<List<Repartidor>> GetRepartidores()
        {
            return _context.Usuarios.OfType<Repartidor>().ToListAsync();
        }

        public Task<List<Administrador>> GetAdministradores()
        {
            return _context.Usuarios.OfType<Administrador>().ToListAsync();
        }

        public Task<Usuario?> GetUsuarioByDni(string dni)
        {
            return _context.Usuarios.FirstOrDefaultAsync(u => u.DNI == dni);
        }

        public Task<Usuario?> GetUsuarioByEmail(string email)
        {
            return _context.Usuarios.FirstOrDefaultAsync(u => u.Email == email);
        }

        public Task<Usuario?> GetUsuarioById(Guid id)
        {
            return _context.Usuarios.FirstOrDefaultAsync(u => u.Id == id);
        }
    }
}
