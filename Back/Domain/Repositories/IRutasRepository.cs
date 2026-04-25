using Back.Domain.Models;

namespace Back.Domain.Repositories
{
    public interface IRutasRepository
    {
        Task Add(Ruta ruta);
        Task<Ruta?> GetRutaById(Guid id);
        Task<List<Ruta>> GetHistorialRutas(Guid transportista);
        Task<List<Ruta>> GetMisRutasSupervisadas(Guid supervisor);
        Task<List<Ruta>> GetRutas();
        Task<bool> IsVehiculoEnRuta(Guid vehiculoId);
    }
}