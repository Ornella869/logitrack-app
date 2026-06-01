using System;

namespace Back.Domain.Models
{
    public class GerenteProvincia
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid GerenteId { get; private set; }
        public string Provincia { get; private set; } = string.Empty;

        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

        public GerenteProvincia() { }

        public GerenteProvincia(Guid gerenteId, string provincia)
        {
            GerenteId = gerenteId;
            Provincia = provincia?.Trim() ?? string.Empty;
        }
    }
}
