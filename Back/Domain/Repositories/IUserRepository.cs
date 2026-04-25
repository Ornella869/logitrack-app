
using Back.Domain.Models;

namespace Back.Domain.Repositories;

public interface IUserRepository
{
    Task<List<Operador>> GetOperadores();
    Task<List<Supervisor>> GetSupervisores();
    Task<List<Transportista>> GetTransportistas();
    Task<Usuario?> GetUsuarioByEmail(string email);
    Task<Usuario?> GetUsuarioByDni(string dni);
    Task<Usuario?> GetUsuarioById(Guid id);
    Task<List<Usuario>> GetAll();
    Task Add(Usuario usuario);

}