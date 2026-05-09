
using Back.Domain.Models;
using Back.Application.Common;

namespace Back.Domain.Repositories;

public interface IUserRepository
{
    Task<List<Operador>> GetOperadores();
    Task<List<Supervisor>> GetSupervisores();
    Task<List<Repartidor>> GetRepartidores();
    Task<List<Administrador>> GetAdministradores();
    Task<Usuario?> GetUsuarioByEmail(string email);
    Task<Usuario?> GetUsuarioByDni(string dni);
    Task<Usuario?> GetUsuarioById(Guid id);
    Task<List<Usuario>> GetAll();
    Task<PagedResponse<Usuario>> GetPaged(string? search, string? role, bool? active, int page, int pageSize);
    Task Add(Usuario usuario);

}
