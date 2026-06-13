using System.Security.Claims;
using Back.Application.Common;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class AuditoriaService
    {
        private static readonly HashSet<TipoAccion> AccionesSupervisorPermitidas = new()
        {
            TipoAccion.CreacionEnvio,
            TipoAccion.EdicionEnvio,
            TipoAccion.CambioEstadoEnvio,
            TipoAccion.CancelacionEnvio,
            TipoAccion.Calendarizacion,
            TipoAccion.Recalendarizacion,
            TipoAccion.ConsentimientoOjoPatron,
            TipoAccion.PruebaOjoDelPatron,
            TipoAccion.Notificacion,
            TipoAccion.JornadaLaboral,
            TipoAccion.Otro,
        };

        private readonly LogiTrackDbContext _context;
        private readonly IHttpContextAccessor _httpContext;
        private readonly IUserRepository _userRepository;

        public AuditoriaService(LogiTrackDbContext context, IHttpContextAccessor httpContext, IUserRepository userRepository)
        {
            _context = context;
            _httpContext = httpContext;
            _userRepository = userRepository;
        }

        public async Task RegistrarAsync(
            TipoAccion accion,
            string descripcion,
            string? recursoId = null,
            string? contexto = null)
        {
            var (usuarioId, nombre, rol) = await ResolverUsuarioActualAsync();
            var log = new LogAuditoria(usuarioId, nombre, rol, accion, descripcion, recursoId, contexto);
            await _context.LogsAuditoria.AddAsync(log);
        }

        public async Task RegistrarAsync(
            Guid? usuarioId,
            string usuarioNombre,
            string usuarioRol,
            TipoAccion accion,
            string descripcion,
            string? recursoId = null,
            string? contexto = null)
        {
            var log = new LogAuditoria(usuarioId, usuarioNombre, usuarioRol, accion, descripcion, recursoId, contexto);
            await _context.LogsAuditoria.AddAsync(log);
        }

        private async Task<(Guid? id, string nombre, string rol)> ResolverUsuarioActualAsync()
        {
            var user = _httpContext.HttpContext?.User;
            if (user is null || !(user.Identity?.IsAuthenticated ?? false)) return (null, "(sistema)", "Sistema");

            var idStr = user.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            var rol = user.FindFirst(ClaimTypes.Role)?.Value ?? "Desconocido";
            if (Guid.TryParse(idStr, out var id))
            {
                var u = await _userRepository.GetUsuarioById(id);
                var nombre = u is null ? "(desconocido)" : $"{u.Nombre} {u.Apellido}";
                return (id, nombre, rol);
            }
            return (null, "(anonimo)", rol);
        }

        public async Task<PagedResponse<LogAuditoria>> ListarAsync(
            Guid? usuarioId,
            TipoAccion? accion,
            string? rol,
            DateTime? from,
            DateTime? to,
            string? search,
            bool limitarASucursalSupervisor,
            Guid? filtroSucursalId,
            int page,
            int pageSize)
        {
            var query = _context.LogsAuditoria.AsQueryable();

            // Supervisor: scope automático a su propia sucursal.
            if (limitarASucursalSupervisor)
            {
                if (accion.HasValue && !AccionesSupervisorPermitidas.Contains(accion.Value))
                    return PagedResponse<LogAuditoria>.Create(new List<LogAuditoria>(), page, pageSize, 0);

                var sucursalId = await ResolverSucursalUsuarioActualAsync();
                if (!sucursalId.HasValue)
                    return PagedResponse<LogAuditoria>.Create(new List<LogAuditoria>(), page, pageSize, 0);

                var rolesOperativos = new[] { nameof(Supervisor), nameof(Operador), nameof(Repartidor) };
                var usuariosSucursalIds = await _context.Usuarios
                    .Where(u => u.SucursalId == sucursalId.Value
                        && rolesOperativos.Contains(EF.Property<string>(u, "Discriminator")))
                    .Select(u => u.Id)
                    .ToListAsync();

                query = query.Where(l => l.UsuarioId.HasValue && usuariosSucursalIds.Contains(l.UsuarioId.Value));
                query = query.Where(l => AccionesSupervisorPermitidas.Contains(l.Accion));
                rol = null;
            }
            // Administrador: filtro explícito por sucursal (opcional).
            else if (filtroSucursalId.HasValue)
            {
                var rolesOperativos = new[] { nameof(Supervisor), nameof(Operador), nameof(Repartidor) };
                var usuariosSucursalIds = await _context.Usuarios
                    .Where(u => u.SucursalId == filtroSucursalId.Value
                        && rolesOperativos.Contains(EF.Property<string>(u, "Discriminator")))
                    .Select(u => u.Id)
                    .ToListAsync();

                query = query.Where(l => l.UsuarioId.HasValue && usuariosSucursalIds.Contains(l.UsuarioId.Value));
            }

            if (usuarioId.HasValue) query = query.Where(l => l.UsuarioId == usuarioId);
            if (accion.HasValue) query = query.Where(l => l.Accion == accion);
            if (!string.IsNullOrWhiteSpace(rol))
            {
                var r = rol.Trim();
                query = query.Where(l => l.UsuarioRol == r
                    || (l.Contexto != null && EF.Functions.ILike(l.Contexto, $"%Rol destino: {r}%")));
            }
            if (from.HasValue)
            {
                var f = DateTime.SpecifyKind(from.Value, DateTimeKind.Utc);
                query = query.Where(l => l.Timestamp >= f);
            }
            if (to.HasValue)
            {
                var t = DateTime.SpecifyKind(to.Value.Date.AddDays(1), DateTimeKind.Utc);
                query = query.Where(l => l.Timestamp < t);
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var s = search.Trim();
                query = query.Where(l =>
                    EF.Functions.ILike(l.UsuarioNombre, $"%{s}%")
                    || (l.RecursoId != null && EF.Functions.ILike(l.RecursoId, $"%{s}%"))
                    || EF.Functions.ILike(l.Descripcion, $"%{s}%"));
            }
            var totalItems = await query.CountAsync();
            var items = await query
                .OrderByDescending(l => l.Timestamp)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();
            return PagedResponse<LogAuditoria>.Create(items, page, pageSize, totalItems);
        }

        private async Task<Guid?> ResolverSucursalUsuarioActualAsync()
        {
            var idStr = _httpContext.HttpContext?.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!Guid.TryParse(idStr, out var id)) return null;

            var usuario = await _userRepository.GetUsuarioById(id);
            return usuario?.SucursalId;
        }
    }
}
