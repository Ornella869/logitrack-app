using Back.Domain.Models;

namespace Back.Domain.Repositories
{
    public interface IVehiculoRepository
    {
        Task Add(Vehiculo vehiculo);
        Task<Vehiculo?> GetVehiculo(Guid id);
        Task<List<Vehiculo>> GetVehiculosActivos();
        Task<List<Vehiculo>> GetAll(VehiculoEstado? estado);
    }
}