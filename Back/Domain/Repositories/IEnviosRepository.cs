using Back.Domain.Models;

namespace Back.Domain.Repositories
{
    public interface IEnviosRepository
    {
        Task Add(Paquete envio);
        Task Add(Sucursal sucursal);
        Task<Paquete?> GetPaquete(Guid id);
        Task<Paquete?> GetPaqueteByCodigoSeguimiento(string codigoSeguimiento);
        Task<List<Paquete>> GetPaquetesEnSucursal();
        Task<List<Sucursal>> GetSucursales();
        Task<List<Paquete>> GetPaquetesByIds(List<Guid> paqueteIds);
        Task<List<Paquete>> GetPaquetes(string? codigoSeguimiento, string? destinatario);
        Task<List<Paquete>> GetAll();
    }}

