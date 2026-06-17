namespace Back.Domain.Models
{
    public class GerenteSucursal
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid GerenteId { get; private set; }
        public Guid SucursalId { get; private set; }
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

        public GerenteSucursal() { }

        public GerenteSucursal(Guid gerenteId, Guid sucursalId)
        {
            GerenteId = gerenteId;
            SucursalId = sucursalId;
        }
    }
}
