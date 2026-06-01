using Back.Domain.Models;

namespace Back.Domain.Repositories
{
    public interface IEnviosRepository
    {
        Task Add(Paquete envio);
        Task Add(Sucursal sucursal);
        Task<Paquete?> GetPaquete(Guid id);
        Task<Paquete?> GetPaqueteByCodigoSeguimiento(string codigoSeguimiento);
        Task<List<Paquete>> GetPaquetesPendientesDeCalendarizacion(Guid? sucursalId = null);
        Task<List<Sucursal>> GetSucursales(string? provincia = null, Guid? sucursalId = null);
        Task<Sucursal?> GetSucursalById(Guid id);
        Task<PuntoPickUp?> GetPuntoPickUpById(Guid id);
        void DeleteSucursal(Sucursal sucursal);
        Task<List<Paquete>> GetPaquetesByIds(List<Guid> paqueteIds);
        Task<Back.Application.Common.PagedResponse<Paquete>> Buscar(string? search, List<PaqueteStatus>? estados, DateTime? from, DateTime? to, int page, int pageSize, Guid? sucursalId = null);
        Task<List<Paquete>> GetAll();
        Task<List<Paquete>> GetPaquetesAsignadosARepartidorEnFecha(Guid repartidorId, DateTime fecha);
        Task<List<Paquete>> GetPaquetesConAsignacionActiva();
        Task<DateTime?> GetProximaFechaConAsignacionDeRepartidor(Guid repartidorId, DateTime desde);
        Task<List<Paquete>> GetPaquetesAsignadosARepartidor(Guid repartidorId);
    }
}
