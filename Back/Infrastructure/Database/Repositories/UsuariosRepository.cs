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

        public async Task<PagedResponse<Usuario>> GetPaged(string? search, string? role, bool? active, Guid? sucursalId, int page, int pageSize)
        {
            var query = _context.Usuarios.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                // Divide por espacios para que "pablo blanco" encuentre nombre=Pablo, apellido=Blanco.
                var parts = search.Trim().ToLowerInvariant()
                    .Split(' ', StringSplitOptions.RemoveEmptyEntries);
                foreach (var part in parts)
                {
                    var p = part;
                    query = query.Where(u =>
                        u.Nombre.ToLower().Contains(p)
                        || u.Apellido.ToLower().Contains(p)
                        || u.Email.ToLower().Contains(p)
                        || u.DNI.Contains(p));
                }
            }

            var normalizedRole = role?.Trim().ToLowerInvariant();

            if (!string.IsNullOrWhiteSpace(normalizedRole))
            {
                query = normalizedRole switch
                {
                    "administrador" => query.OfType<Administrador>(),
                    "supervisor" => query.OfType<Supervisor>(),
                    "operador" => query.OfType<Operador>(),
                    "repartidor" => query.OfType<Repartidor>(),
                    "gerente" => query.OfType<Gerente>(),
                    "sociopickup" or "socio_pickup" => query.OfType<SocioPickUp>(),
                    _ => query,
                };
            }

            if (active.HasValue)
            {
                query = query.Where(u => u.Activo == active.Value);
            }

            if (sucursalId.HasValue)
            {
                var sucursal = await _context.Sucursales.FindAsync(sucursalId.Value);
                var prov = sucursal?.Provincia;

                if (!string.IsNullOrWhiteSpace(prov))
                {
                    var gerentesIds = await _context.GerentesProvincias
                        .Where(gp => gp.Provincia == prov)
                        .Select(gp => gp.GerenteId)
                        .ToListAsync();

                    query = query.Where(u =>
                        u.SucursalId == sucursalId.Value
                        || gerentesIds.Contains(u.Id));
                }
                else
                {
                    query = query.Where(u => u.SucursalId == sucursalId.Value);
                }
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
            var tracked = _context.Usuarios.Local.FirstOrDefault(u => u.Id == id);
            if (tracked is not null)
                return Task.FromResult<Usuario?>(tracked);

            return _context.Usuarios.FirstOrDefaultAsync(u => u.Id == id);
        }
    }
}
