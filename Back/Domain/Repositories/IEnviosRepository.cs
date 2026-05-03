using Back.Domain.Models;

namespace Back.Domain.Repositories
{
    public interface IEnviosRepository
    {
        Task Add(Paquete envio);
        Task Add(Sucursal sucursal);
        Task<Paquete?> GetPaquete(Guid id);
        Task<Paquete?> GetPaqueteByCodigoSeguimiento(string codigoSeguimiento);
        Task<List<Paquete>> GetPaquetesPendientesDeCalendarizacion();
        Task<List<Sucursal>> GetSucursales();
        Task<Sucursal?> GetSucursalById(Guid id);
        void DeleteSucursal(Sucursal sucursal);
        Task<List<Paquete>> GetPaquetesByIds(List<Guid> paqueteIds);
        Task<List<Paquete>> Buscar(string? search, List<PaqueteStatus>? estados, DateTime? from, DateTime? to);
        Task<List<Paquete>> GetAll();
    }
}
