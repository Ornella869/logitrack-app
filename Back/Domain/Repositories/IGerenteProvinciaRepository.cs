using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Back.Domain.Repositories
{
    public interface IGerenteProvinciaRepository
    {
        Task<List<string>> GetProvinciasByGerente(Guid gerenteId);
        Task<Guid?> GetGerenteIdByProvincia(string provincia);
        Task AssignProvincias(Guid gerenteId, IEnumerable<string> provincias);
    }
}
