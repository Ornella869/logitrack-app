using Back.Application.Common;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public record PermisoDefinicion(
        string Clave,
        string Nombre,
        string Grupo,
        string[] RolesPredeterminados,
        string[] RolesCompatibles);

    public class PermisosService
    {
        public const string PermisoGestionarPermisos = "gestionar_permisos";

        public static readonly IReadOnlyList<PermisoDefinicion> Catalogo = new[]
        {
            Definir("dashboard", "Dashboard", "General",
                new[] { Roles.Administrador, Roles.Supervisor },
                Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("envios_ver", "Consultar envíos", "Envíos",
                new[] { Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador },
                Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("envios_detalle", "Ver detalle de envíos", "Envíos",
                new[] { Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor },
                Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("envios_crear", "Crear e importar envíos", "Envíos",
                new[] { Roles.Operador },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("envios_editar", "Editar envíos pendientes", "Envíos",
                new[] { Roles.Operador },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("envios_cancelar", "Cancelar o reenviar envíos", "Envíos",
                new[] { Roles.Supervisor, Roles.Operador, Roles.Repartidor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("calendarizacion", "Calendarización", "Operación",
                new[] { Roles.Supervisor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("repartidores", "Repartidores", "Operación",
                new[] { Roles.Administrador, Roles.Gerente, Roles.Supervisor },
                Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("calendario", "Calendario operativo", "Operación",
                new[] { Roles.Supervisor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("rutas_activas", "Rutas activas", "Operación",
                new[] { Roles.Supervisor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("alertas", "Alertas", "Operación",
                new[] { Roles.Supervisor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("incidencias", "Gestión de incidencias", "Operación",
                new[] { Roles.Supervisor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("sucursales", "Sucursales", "Gestión",
                new[] { Roles.Gerente },
                Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("pickups", "Puntos PickUp", "Gestión",
                new[] { Roles.Gerente },
                Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("pickup_operacion", "Operación PickUp", "PickUp",
                new[] { Roles.SocioPickUp }, Roles.SocioPickUp),
            Definir("pickup_historial", "Historial PickUp", "PickUp",
                new[] { Roles.SocioPickUp }, Roles.SocioPickUp),
            Definir("tarifas", "Tarifas y zonas peligrosas", "Gestión",
                new[] { Roles.Gerente },
                Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("ojo_patron", "Ojo del Patrón", "Gestión",
                new[] { Roles.Gerente, Roles.Supervisor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("reportes", "Reportes", "Análisis",
                new[] { Roles.Gerente, Roles.Supervisor },
                Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("satisfaccion", "Satisfacción", "Análisis",
                new[] { Roles.Administrador, Roles.Gerente, Roles.Supervisor },
                Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("auditoria", "Auditoría", "Administración",
                new[] { Roles.Administrador, Roles.Supervisor }, Roles.Administrador, Roles.Supervisor),
            Definir("auditoria_notificaciones", "Auditoría de notificaciones", "Administración",
                new[] { Roles.Administrador }, Roles.Administrador),
            Definir("mi_plan", "Mi plan", "Administración",
                new[] { Roles.Administrador }, Roles.Administrador),
            Definir("plantillas_email", "Plantillas de email", "Gestión",
                new[] { Roles.Gerente },
                Roles.Gerente, Roles.Supervisor, Roles.Operador),
            Definir("ruta_repartidor", "Ruta del repartidor", "Repartidor",
                new[] { Roles.Repartidor }, Roles.Repartidor),
            Definir("historial_repartidor", "Historial del repartidor", "Repartidor",
                new[] { Roles.Repartidor }, Roles.Repartidor),
            Definir("perfil_rendimiento", "Perfil de rendimiento", "Operación",
                new[] { Roles.Administrador, Roles.Gerente, Roles.Supervisor },
                Roles.Administrador, Roles.Gerente, Roles.Supervisor, Roles.Operador, Roles.Repartidor),
            Definir("transferir_repartidores", "Transferir repartidores entre sucursales", "Operación",
                new[] { Roles.Gerente },
                Roles.Gerente, Roles.Supervisor),
            Definir(PermisoGestionarPermisos, "Permisos por rol y usuario", "Administración",
                new[] { Roles.Administrador }, Roles.Administrador),
        };

        public static readonly string[] RolesConfigurables =
        {
            Roles.Administrador,
            Roles.Gerente,
            Roles.Supervisor,
            Roles.Operador,
            Roles.Repartidor,
            Roles.SocioPickUp,
        };

        private readonly LogiTrackDbContext _context;
        private readonly AuditoriaService _auditoria;

        public PermisosService(LogiTrackDbContext context, AuditoriaService auditoria)
        {
            _context = context;
            _auditoria = auditoria;
        }

        public async Task<IReadOnlyList<PermisoRolResponse>> ObtenerPorRolAsync(string rol)
        {
            rol = NormalizarRol(rol);
            var configurados = await _context.PermisosRol
                .Where(x => x.Rol == rol)
                .ToDictionaryAsync(x => x.Permiso, x => x.Habilitado);

            return Catalogo.Select(p =>
            {
                var compatible = EsRolCompatible(rol, p.Clave);
                return new PermisoRolResponse(
                    p.Clave,
                    p.Nombre,
                    p.Grupo,
                    compatible && (TryGetConfigurado(configurados, p.Clave, out var valor)
                        ? valor
                        : p.RolesPredeterminados.Contains(rol)),
                    compatible,
                    p.Clave == PermisoGestionarPermisos && rol == Roles.Administrador);
            }).ToList();
        }

        public async Task<IReadOnlyList<PermisoUsuarioResponse>> ObtenerPorUsuarioAsync(Guid usuarioId)
        {
            var usuario = await _context.Usuarios.FindAsync(usuarioId)
                ?? throw new KeyNotFoundException("Usuario no encontrado.");
            var rol = ObtenerRol(usuario);
            if (!RolesConfigurables.Contains(rol))
            {
                return Catalogo.Select(p => new PermisoUsuarioResponse(
                    p.Clave, p.Nombre, p.Grupo, "SinExcepcion", false, false, false)).ToList();
            }
            var rolConfig = (await ObtenerPorRolAsync(rol)).ToDictionary(x => x.Clave);
            var excepciones = await _context.PermisosUsuario
                .Where(x => x.UsuarioId == usuarioId)
                .ToDictionaryAsync(x => x.Permiso, x => x.Habilitado);

            return Catalogo.Select(p =>
            {
                var compatible = EsRolCompatible(rol, p.Clave);
                var tieneExcepcion = TryGetConfigurado(excepciones, p.Clave, out var valor);
                var estado = tieneExcepcion ? (valor ? "Habilitado" : "Deshabilitado") : "SinExcepcion";
                var efectivo = compatible && (tieneExcepcion ? valor : rolConfig[p.Clave].Habilitado);
                var obligatorio = p.Clave == PermisoGestionarPermisos && rol == Roles.Administrador;
                return new PermisoUsuarioResponse(p.Clave, p.Nombre, p.Grupo, estado, efectivo, compatible, obligatorio);
            }).ToList();
        }

        public async Task<IReadOnlyList<string>> ObtenerEfectivosAsync(Guid usuarioId)
        {
            return (await ObtenerPorUsuarioAsync(usuarioId))
                .Where(x => x.HabilitadoEfectivo)
                .Select(x => x.Clave)
                .ToList();
        }

        public async Task ActualizarRolAsync(string rol, string permiso, bool habilitado, Guid administradorId)
        {
            rol = NormalizarRol(rol);
            ValidarPermiso(permiso);
            if (!EsRolCompatible(rol, permiso))
                throw new InvalidOperationException("Ese permiso no es compatible con el ámbito operativo del rol.");
            if (rol == Roles.Administrador && permiso == PermisoGestionarPermisos && !habilitado)
                throw new InvalidOperationException("El permiso para administrar permisos es obligatorio para el Administrador.");

            var actual = await _context.PermisosRol.SingleOrDefaultAsync(x => x.Rol == rol && x.Permiso == permiso);
            if (actual is null)
                await _context.PermisosRol.AddAsync(new PermisoRol(rol, permiso, habilitado, administradorId));
            else
                actual.Actualizar(habilitado, administradorId);

            await _auditoria.RegistrarAsync(TipoAccion.Permisos,
                $"Permiso '{permiso}' {(habilitado ? "habilitado" : "deshabilitado")} para el rol {rol}.",
                rol);
            await _context.SaveChangesAsync();
        }

        public async Task ActualizarUsuarioAsync(Guid usuarioId, string permiso, string estado, Guid administradorId)
        {
            ValidarPermiso(permiso);
            var usuario = await _context.Usuarios.FindAsync(usuarioId)
                ?? throw new KeyNotFoundException("Usuario no encontrado.");
            var rol = ObtenerRol(usuario);
            if (!EsRolCompatible(rol, permiso))
                throw new InvalidOperationException("Ese permiso no es compatible con el ámbito operativo del usuario.");
            var actual = await _context.PermisosUsuario.SingleOrDefaultAsync(x => x.UsuarioId == usuarioId && x.Permiso == permiso);

            if (estado == "SinExcepcion")
            {
                if (actual is not null) _context.PermisosUsuario.Remove(actual);
            }
            else
            {
                var habilitado = estado switch
                {
                    "Habilitado" => true,
                    "Deshabilitado" => false,
                    _ => throw new InvalidOperationException("Estado de permiso inválido."),
                };
                if (rol == Roles.Administrador && permiso == PermisoGestionarPermisos && !habilitado)
                    throw new InvalidOperationException("No se puede quitar a un Administrador el acceso a la gestión de permisos.");

                if (actual is null)
                    await _context.PermisosUsuario.AddAsync(new PermisoUsuario(usuarioId, permiso, habilitado, administradorId));
                else
                    actual.Actualizar(habilitado, administradorId);
            }

            await _auditoria.RegistrarAsync(TipoAccion.Permisos,
                $"Excepción '{estado}' aplicada al permiso '{permiso}' para {usuario.Nombre} {usuario.Apellido}.",
                usuarioId.ToString());
            await _context.SaveChangesAsync();
        }

        public static string ObtenerRol(Usuario usuario) => usuario switch
        {
            Administrador => Roles.Administrador,
            Gerente => Roles.Gerente,
            Supervisor => Roles.Supervisor,
            Operador => Roles.Operador,
            Repartidor => Roles.Repartidor,
            SocioPickUp => Roles.SocioPickUp,
            _ => usuario.GetType().Name,
        };

        private static string NormalizarRol(string rol)
        {
            var encontrado = RolesConfigurables.FirstOrDefault(x => x.Equals(rol, StringComparison.OrdinalIgnoreCase));
            return encontrado ?? throw new InvalidOperationException("Rol inválido.");
        }

        private static void ValidarPermiso(string permiso)
        {
            if (!Catalogo.Any(x => x.Clave == permiso))
                throw new InvalidOperationException("Permiso inválido.");
        }

        private static PermisoDefinicion Definir(
            string clave,
            string nombre,
            string grupo,
            string[] predeterminados,
            params string[] compatibles) =>
            new(clave, nombre, grupo, predeterminados, compatibles);

        private static bool TryGetConfigurado(
            IReadOnlyDictionary<string, bool> configurados,
            string permiso,
            out bool valor) =>
            configurados.TryGetValue(permiso, out valor)
            || (permiso.StartsWith("envios_", StringComparison.Ordinal)
                && configurados.TryGetValue("envios", out valor));

        private static bool EsRolCompatible(string rol, string permiso) =>
            Catalogo.First(x => x.Clave == permiso).RolesCompatibles.Contains(rol);
    }

    public record PermisoRolResponse(
        string Clave,
        string Nombre,
        string Grupo,
        bool Habilitado,
        bool Compatible,
        bool Obligatorio);

    public record PermisoUsuarioResponse(
        string Clave,
        string Nombre,
        string Grupo,
        string Estado,
        bool HabilitadoEfectivo,
        bool Compatible,
        bool Obligatorio);
}
