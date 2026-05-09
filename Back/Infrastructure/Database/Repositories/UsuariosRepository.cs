using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Application.Common;
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

        public async Task<PagedResponse<Usuario>> GetPaged(string? search, string? role, bool? active, int page, int pageSize)
        {
            var query = _context.Usuarios.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim().ToLowerInvariant();
                query = query.Where(u =>
                    u.Nombre.ToLower().Contains(s)
                    || u.Apellido.ToLower().Contains(s)
                    || u.Email.ToLower().Contains(s)
                    || u.DNI.Contains(s));
            }

            if (!string.IsNullOrWhiteSpace(role))
            {
                var normalizedRole = role.Trim().ToLowerInvariant();
                query = normalizedRole switch
                {
                    "administrador" => query.OfType<Administrador>(),
                    "supervisor" => query.OfType<Supervisor>(),
                    "operador" => query.OfType<Operador>(),
                    "repartidor" => query.OfType<Repartidor>(),
                    _ => query,
                };
            }

            if (active.HasValue)
            {
                query = query.Where(u => u.Activo == active.Value);
            }

            var totalItems = await query.CountAsync();
            var items = await query
                .OrderBy(u => u.Nombre)
                .ThenBy(u => u.Apellido)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return PagedResponse<Usuario>.Create(items, page, pageSize, totalItems);
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
