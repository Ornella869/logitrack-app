using Back.Domain.Models;
using Back.Domain.Repositories;
using Microsoft.EntityFrameworkCore;

namespace Back.Infrastructure.Database.Repositories
{
    public class EnviosRepository : IEnviosRepository
    {

        private readonly LogiTrackDbContext _context;

        public EnviosRepository(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task Add(Paquete envio)
        {
            await _context.Paquetes.AddAsync(envio);
        }

        public async Task Add(Sucursal sucursal)
        {
            await _context.Sucursales.AddAsync(sucursal);
        }

        public async Task<List<Paquete>> GetAll()
        {
            return await _context.Paquetes.ToListAsync();
        }

        public async Task<Paquete?> GetPaquete(Guid id)
        {
            return await _context.Paquetes.FindAsync(id);
        }

        public async Task<Paquete?> GetPaqueteByCodigoSeguimiento(string codigoSeguimiento)
        {
            return await _context.Paquetes.FirstOrDefaultAsync(p => p.CodigoSeguimiento == codigoSeguimiento);
        }

        public async Task<List<Paquete>> Buscar(string? search, List<PaqueteStatus>? estados, DateTime? from, DateTime? to)
        {
            var query = _context.Paquetes.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(p =>
                    EF.Functions.ILike(p.CodigoSeguimiento, $"%{s}%")
                    || EF.Functions.ILike(p.Remitente.Nombre, $"%{s}%")
                    || EF.Functions.ILike(p.Remitente.Apellido, $"%{s}%")
                    || EF.Functions.ILike(p.Destinatario.Nombre, $"%{s}%")
                    || EF.Functions.ILike(p.Destinatario.Apellido, $"%{s}%"));
            }

            if (estados is { Count: > 0 })
            {
                query = query.Where(p => estados.Contains(p.Status));
            }

            if (from.HasValue)
            {
                var fromUtc = DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
                query = query.Where(p => p.CreadoEn >= fromUtc);
            }

            if (to.HasValue)
            {
                var toUtc = DateTime.SpecifyKind(to.Value, DateTimeKind.Utc);
                query = query.Where(p => p.CreadoEn <= toUtc);
            }

            return await query.OrderByDescending(p => p.CreadoEn).ToListAsync();
        }

        public async Task<List<Paquete>> GetPaquetesByIds(List<Guid> paqueteIds)
        {
            return await _context.Paquetes.Where(p => paqueteIds.Contains(p.Id)).ToListAsync();
        }

        public async Task<List<Paquete>> GetPaquetesPendientesDeCalendarizacion()
        {
            return await _context.Paquetes.Where(p => p.Status == PaqueteStatus.PendienteDeCalendarizacion).ToListAsync();
        }

        public async Task<List<Paquete>> GetPaquetesConAsignacionActiva()
        {
            var estadosActivos = new[]
            {
                PaqueteStatus.AsignadoAVehiculo,
                PaqueteStatus.CargadoEnVehiculo,
                PaqueteStatus.ListoParaSalir,
                PaqueteStatus.EnTransito,
            };
            return await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId != null
                            && p.FechaCalendarizada != null
                            && estadosActivos.Contains(p.Status))
                .ToListAsync();
        }

        public async Task<DateTime?> GetProximaFechaConAsignacionDeRepartidor(Guid repartidorId, DateTime desde)
        {
            var desdeUtc = DateTime.SpecifyKind(desde.Date, DateTimeKind.Utc);
            var estadosActivos = new[]
            {
                PaqueteStatus.AsignadoAVehiculo,
                PaqueteStatus.CargadoEnVehiculo,
                PaqueteStatus.ListoParaSalir,
                PaqueteStatus.EnTransito,
            };
            var fecha = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada != null
                            && p.FechaCalendarizada >= desdeUtc
                            && estadosActivos.Contains(p.Status))
                .OrderBy(p => p.FechaCalendarizada)
                .Select(p => p.FechaCalendarizada)
                .FirstOrDefaultAsync();
            return fecha;
        }

        public async Task<List<Paquete>> GetPaquetesAsignadosARepartidor(Guid repartidorId)
        {
            return await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada != null)
                .OrderBy(p => p.FechaCalendarizada)
                .ThenBy(p => p.Destinatario.Direccion.CP)
                .ToListAsync();
        }

        public async Task<List<Paquete>> GetPaquetesAsignadosARepartidorEnFecha(Guid repartidorId, DateTime fecha)
        {
            var dia = DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc);
            var diaSiguiente = dia.AddDays(1);
            return await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && p.FechaCalendarizada >= dia
                            && p.FechaCalendarizada < diaSiguiente)
                .OrderBy(p => p.Destinatario.Direccion.CP)
                .ThenBy(p => p.CreadoEn)
                .ToListAsync();
        }

        public async Task<List<Sucursal>> GetSucursales()
        {
            return await _context.Sucursales.ToListAsync();
        }

        public async Task<Sucursal?> GetSucursalById(Guid id)
        {
            return await _context.Sucursales.FindAsync(id);
        }

        public void DeleteSucursal(Sucursal sucursal)
        {
            _context.Sucursales.Remove(sucursal);
        }
    }
}
