namespace Back.Domain.Repositories
{
    public interface IGerenteSucursalRepository
    {
        Task<List<Guid>> GetSucursalesByGerente(Guid gerenteId);
        Task AssignSucursales(Guid gerenteId, IEnumerable<Guid> sucursalIds);
    }
}
