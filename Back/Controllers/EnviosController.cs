using System.ComponentModel.DataAnnotations;
using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Hubs;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/envios")]
    public class EnviosController : ControllerBase
    {
        private readonly IEnviosRepository _enviosRepository;
        private readonly IVehiculoRepository _vehiculoRepository;
        private readonly IRutasRepository _rutasRepository;
        private readonly EnviosService _enviosService;
        private readonly HistorialEstadoEnvioService _historialService;
        private readonly QrService _qrService;
        private readonly LogiTrackDbContext _context;


        public EnviosController(
            LogiTrackDbContext context,
            IRutasRepository rutasRepository,
            IEnviosRepository enviosRepository,
            IVehiculoRepository vehiculoRepository,
            EnviosService enviosService,
            HistorialEstadoEnvioService historialService,
            QrService qrService)
        {
            _context = context;
            _rutasRepository = rutasRepository;
            _enviosService = enviosService;
            _vehiculoRepository = vehiculoRepository;
            _enviosRepository = enviosRepository;
            _historialService = historialService;
            _qrService = qrService;
        }

        private Guid? CurrentUserId()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var id) ? id : null;
        }

        private async Task<Usuario?> CurrentUserAsync()
        {
            var userId = CurrentUserId();
            return userId is null ? null : await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == userId.Value);
        }

        private async Task<Guid?> CurrentSucursalScopeAsync()
        {
            if (User.IsInRole(Roles.Administrador) || User.IsInRole(Roles.Gerente)) return null;
            // Supervisor/Operador sin sucursal asignada → Guid.Empty no coincide con ninguna sucursal real.
            return (await CurrentUserAsync())?.SucursalId ?? Guid.Empty;
        }

        private async Task<bool> PuedeVerPaqueteAsync(Paquete paquete)
        {
            if (User.IsInRole(Roles.Administrador) || User.IsInRole(Roles.Gerente)) return true;
            var user = await CurrentUserAsync();
            if (user is null) return false;
            if (User.IsInRole(Roles.Repartidor))
                return paquete.RepartidorAsignadoId == user.Id
                    && paquete.FechaCalendarizada?.Date == OperationalClock.TodayUtcDate;
            // Supervisor/Operador: debe pertenecer a la misma sucursal. Sin sucursal → sin acceso.
            return user.SucursalId.HasValue && paquete.SucursalId == user.SucursalId;
        }

        private static double DistanciaKm(Ubicacion a, Ubicacion b)
        {
            const double radioTierraKm = 6371;
            static double Rad(double deg) => deg * Math.PI / 180;
            var dLat = Rad(b.Latitud - a.Latitud);
            var dLng = Rad(b.Longitud - a.Longitud);
            var lat1 = Rad(a.Latitud);
            var lat2 = Rad(b.Latitud);
            var h = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                + Math.Cos(lat1) * Math.Cos(lat2) * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);
            return 2 * radioTierraKm * Math.Asin(Math.Sqrt(h));
        }

        private async Task<List<Paquete>> OrdenarParadasDesdeSucursalAsync(List<Paquete> paquetes, GeocodingService geocoding)
        {
            var user = await CurrentUserAsync();
            if (user?.SucursalId is not Guid sucursalId) return paquetes;

            var sucursal = await _enviosRepository.GetSucursalById(sucursalId);
            if (sucursal is null) return paquetes;

            var origen = await geocoding.GeocodeAsync(sucursal.Direccion, sucursal.Ciudad, sucursal.CodigoPostal, sucursal.Provincia);
            if (origen is null) return paquetes;

            var pendientes = paquetes
                .Where(p => p.Destinatario.Direccion.Ubicacion is not null)
                .ToList();
            var sinCoords = paquetes
                .Where(p => p.Destinatario.Direccion.Ubicacion is null)
                .ToList();

            var ordenadas = new List<Paquete>();
            var actual = origen;
            while (pendientes.Count > 0)
            {
                var siguiente = pendientes
                    .OrderBy(p => DistanciaKm(actual, p.Destinatario.Direccion.Ubicacion!))
                    .ThenBy(p => p.CreadoEn)
                    .First();
                ordenadas.Add(siguiente);
                pendientes.Remove(siguiente);
                actual = siguiente.Destinatario.Direccion.Ubicacion!;
            }

            ordenadas.AddRange(sinCoords);
            return ordenadas;
        }

        // ============== G1L-10: Alta de envío ==============

        /// <summary>Registra un nuevo paquete (Operador).</summary>
        [Authorize(Roles = Roles.Operador)]
        [HttpPost("registrar-paquete")]
        public async Task<ActionResult<RegistrarPaqueteResult>> RegistrarPaquete([FromBody] RegistrarPaqueteRequest request)
        {
            try
            {
                var result = await _enviosService.RegistrarPaquete(request, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Operador)]
        [HttpPost("generar-lote-demo")]
        public async Task<ActionResult<GenerarLoteDemoResult>> GenerarLoteDemo([FromBody] GenerarLoteDemoRequest request)
        {
            try
            {
                var result = await _enviosService.GenerarLoteDemoAsync(request.Cantidad, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = Roles.Operador)]
        [HttpGet("importacion/template")]
        public ActionResult DescargarTemplateImportacion([FromServices] EnviosExcelImportService excel)
        {
            return File(
                excel.GenerarTemplate(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "template_envios_logitrack.xlsx");
        }

        [Authorize(Roles = Roles.Operador)]
        [HttpPost("importacion/excel")]
        public async Task<ActionResult<ImportarEnviosResult>> ImportarExcel([FromForm] ImportarEnviosExcelRequest request, [FromServices] EnviosExcelImportService excel)
        {
            if (request.File is null || request.File.Length == 0) return BadRequest("El archivo es obligatorio.");
            try
            {
                var rows = await excel.ParseAsync(request.File);
                var result = await _enviosService.ImportarDesdeExcelAsync(rows, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== Vista pública (no requiere auth) ==============

        /// <summary>Vista pública de seguimiento por código.</summary>
        [HttpGet("seguimiento/{codigoSeguimiento}")]
        public async Task<ActionResult<SeguimientoPublicoResponse>> Seguimiento(string codigoSeguimiento)
        {
            var paquete = await _enviosRepository.GetPaqueteByCodigoSeguimiento(codigoSeguimiento);
            if (paquete is null) return NotFound();

            return Ok(new SeguimientoPublicoResponse
            {
                Id = paquete.Id,
                SucursalId = paquete.SucursalId,
                CodigoSeguimiento = paquete.CodigoSeguimiento,
                Status = paquete.Status,
                TipoEnvio = paquete.TipoEnvio,
                TipoPaquete = paquete.TipoPaquete,
                CreadoEn = paquete.CreadoEn,
                FechaCalendarizada = paquete.FechaCalendarizada,
                FechaEstimadaEntrega = paquete.FechaEstimadaEntrega,
                Peso = paquete.Peso,
                Descripcion = paquete.Descripcion,
                RazonCancelacion = paquete.RazonCancelacion,
                UbicacionActual = paquete.Status is PaqueteStatus.EnTransito or PaqueteStatus.Demorado ? paquete.UbicacionActual : null,
                UbicacionActualActualizadaEn = paquete.Status is PaqueteStatus.EnTransito or PaqueteStatus.Demorado ? paquete.UbicacionActualActualizadaEn : null,
                Remitente = new SeguimientoPublicoCliente
                {
                    Ciudad = paquete.Remitente.Direccion.Ciudad,
                    CP = paquete.Remitente.Direccion.CP,
                },
                Destinatario = new SeguimientoPublicoCliente
                {
                    Ciudad = paquete.Destinatario.Direccion.Ciudad,
                    CP = paquete.Destinatario.Direccion.CP,
                }
            });
        }

        // ============== G1L-39 + G1L-40: Listado, búsqueda y filtros ==============

        /// <summary>Listado de paquetes con búsqueda parcial y filtros por estado y fecha.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador + "," + Roles.Repartidor)]
        [HttpGet("paquetes")]
        public async Task<ActionResult<PagedResponse<Paquete>>> BuscarYFiltrar(
            [FromQuery] string? search,
            [FromQuery(Name = "status")] List<PaqueteStatus>? estados,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] int? page,
            [FromQuery] int? pageSize)
        {
            var normalizedPage = PaginationDefaults.NormalizePage(page);
            var normalizedPageSize = PaginationDefaults.NormalizePageSize(pageSize);
            if (User.IsInRole(Roles.Repartidor))
            {
                var userId = CurrentUserId();
                if (userId is null) return Unauthorized();
                var asignados = await _enviosRepository.GetPaquetesAsignadosARepartidor(userId.Value);
                var query = asignados.AsEnumerable();
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var s = search.Trim().ToLowerInvariant();
                    query = query.Where(p =>
                        p.CodigoSeguimiento.ToLowerInvariant().Contains(s)
                        || p.Remitente.Nombre.ToLowerInvariant().Contains(s)
                        || p.Remitente.Apellido.ToLowerInvariant().Contains(s)
                        || p.Destinatario.Nombre.ToLowerInvariant().Contains(s)
                        || p.Destinatario.Apellido.ToLowerInvariant().Contains(s));
                }
                if (estados is { Count: > 0 }) query = query.Where(p => estados.Contains(p.Status));
                if (from.HasValue) query = query.Where(p => p.CreadoEn >= DateTime.SpecifyKind(from.Value, DateTimeKind.Utc));
                if (to.HasValue) query = query.Where(p => p.CreadoEn <= DateTime.SpecifyKind(to.Value, DateTimeKind.Utc));
                var filtered = query.OrderByDescending(p => p.CreadoEn).ToList();
                return Ok(PagedResponse<Paquete>.Create(
                    filtered.Skip((normalizedPage - 1) * normalizedPageSize).Take(normalizedPageSize).ToList(),
                    normalizedPage,
                    normalizedPageSize,
                    filtered.Count));
            }

            var paquetes = await _enviosRepository.Buscar(search, estados, from, to, normalizedPage, normalizedPageSize, await CurrentSucursalScopeAsync());
            return Ok(paquetes);
        }

        /// <summary>Paquetes pendientes de calendarización (Operador o Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor)]
        [HttpGet("paquetes-pendientes")]
        public async Task<ActionResult<List<Paquete>>> GetPaquetesPendientesDeCalendarizacion()
        {
            var paquetes = await _enviosRepository.GetPaquetesPendientesDeCalendarizacion(await CurrentSucursalScopeAsync());
            return Ok(paquetes);
        }

        // ============== G1L-23: Ruta del día (Repartidor) ==============

        /// <summary>Paquetes asignados al repartidor logueado para el día actual.</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("mi-ruta-del-dia")]
        public async Task<ActionResult<object>> GetMiRutaDelDia([FromQuery] DateTime? fecha, [FromServices] GeocodingService geocoding)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();

            var hoy = OperationalClock.TodayUtcDate;
            var paquetes = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(userId.Value, hoy);
            return Ok(new { fecha = DateTime.SpecifyKind(hoy, DateTimeKind.Utc), paradas = await OrdenarParadasDesdeSucursalAsync(paquetes, geocoding) });
        }

        /// <summary>G1L-42: Repartidor asignado al paquete (Supervisor / Operador / Admin).</summary>
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador + "," + Roles.Operador)]
        [HttpGet("paquete/{paqueteId:guid}/repartidor-asignado")]
        public async Task<ActionResult<object>> GetRepartidorAsignado(
            Guid paqueteId,
            [FromServices] RepartidoresMetricsService metrics)
        {
            var info = await metrics.GetRepartidorDePaqueteAsync(paqueteId, await CurrentSucursalScopeAsync());
            if (info is null) return NoContent();
            return Ok(info);
        }

        /// <summary>G1L-18: Actualizar ubicación GPS de un envío en tránsito (Admin).</summary>
        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPost("paquete/{paqueteId:guid}/ubicacion")]
        public async Task<ActionResult> ActualizarUbicacion(Guid paqueteId, [FromBody] ActualizarUbicacionRequest request, [FromServices] IHubContext<UbicacionHub> hub)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);
            if (paquete is null) return NotFound();
            if (!await PuedeVerPaqueteAsync(paquete)) return Forbid();
            if (paquete.Status != PaqueteStatus.EnTransito)
                return BadRequest("La simulación de movimiento solo está disponible para envíos en tránsito.");

            paquete.UbicacionActual = new Ubicacion(request.Latitud, request.Longitud);
            paquete.UbicacionActualActualizadaEn = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await hub.Clients.All.SendAsync("ubicacionActualizada", new
            {
                paqueteId = paquete.Id,
                codigoSeguimiento = paquete.CodigoSeguimiento,
                latitud = request.Latitud,
                longitud = request.Longitud,
                actualizadaEn = paquete.UbicacionActualActualizadaEn,
            });
            return Ok();
        }

        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("mi-ubicacion")]
        public async Task<ActionResult<object>> ActualizarMiUbicacion([FromBody] ActualizarUbicacionRequest request, [FromServices] IHubContext<UbicacionHub> hub)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            var hoy = OperationalClock.TodayUtcDate;
            var manana = hoy.AddDays(1);
            var paquetes = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == userId
                            && p.FechaCalendarizada >= hoy
                            && p.FechaCalendarizada < manana
                            && (p.Status == PaqueteStatus.EnTransito || p.Status == PaqueteStatus.Demorado))
                .ToListAsync();

            foreach (var paqueteActual in paquetes)
            {
                paqueteActual.UbicacionActual = new Ubicacion(request.Latitud, request.Longitud);
                paqueteActual.UbicacionActualActualizadaEn = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            foreach (var paqueteActual in paquetes)
            {
                await hub.Clients.All.SendAsync("ubicacionActualizada", new
                {
                    repartidorId = userId,
                    paqueteId = paqueteActual.Id,
                    codigoSeguimiento = paqueteActual.CodigoSeguimiento,
                    latitud = request.Latitud,
                    longitud = request.Longitud,
                    actualizadaEn = paqueteActual.UbicacionActualActualizadaEn,
                });
            }
            return Ok(new { actualizados = paquetes.Count });
        }

        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpGet("repartidores-ubicacion")]
        public async Task<ActionResult<List<RepartidorUbicacionDto>>> GetRepartidoresUbicacion()
        {
            var scope = await CurrentSucursalScopeAsync();
            var query = _context.Paquetes
                .Where(p => p.RepartidorAsignadoId.HasValue
                            && p.UbicacionActual != null
                            && (p.Status == PaqueteStatus.EnTransito || p.Status == PaqueteStatus.Demorado));
            if (scope.HasValue) query = query.Where(p => p.SucursalId == scope);

            var paquetes = await query.ToListAsync();
            var repartidorIds = paquetes.Select(p => p.RepartidorAsignadoId!.Value).Distinct().ToList();
            var repartidores = await _context.Usuarios
                .Where(u => repartidorIds.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => $"{u.Nombre} {u.Apellido}");

            var result = paquetes
                .GroupBy(p => p.RepartidorAsignadoId!.Value)
                .Select(g => g.OrderByDescending(p => p.UbicacionActualActualizadaEn).First())
                .Select(p => new RepartidorUbicacionDto(
                    p.RepartidorAsignadoId!.Value,
                    repartidores.TryGetValue(p.RepartidorAsignadoId!.Value, out var nombre) ? nombre : "Repartidor",
                    p.Id,
                    p.CodigoSeguimiento,
                    p.UbicacionActual!.Latitud,
                    p.UbicacionActual.Longitud,
                    p.UbicacionActualActualizadaEn))
                .ToList();

            return Ok(result);
        }

        /// <summary>Todas las fechas con asignaciones del repartidor logueado (para selector de día).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("mis-fechas-ruta")]
        public async Task<ActionResult<List<DateTime>>> GetMisFechasDeRuta()
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            var hoy = OperationalClock.TodayUtcDate;
            var paquetes = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(userId.Value, hoy);
            var fechas = paquetes.Count == 0
                ? new List<DateTime>()
                : new List<DateTime> { DateTime.SpecifyKind(hoy, DateTimeKind.Utc) };
            return Ok(fechas);
        }

        // ============== G1L-41: Detalle de envío ==============

        /// <summary>Detalle del paquete por ID (incluye flag isEditable).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpGet("paquete/{paqueteId:guid}")]
        public async Task<ActionResult<Paquete>> GetPaquete(Guid paqueteId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);
            if (paquete is null) return NotFound();
            if (!await PuedeVerPaqueteAsync(paquete)) return Forbid();
            return Ok(paquete);
        }

        // ============== G1L-12: Edición de envío ==============

        /// <summary>Edita un envío pendiente de calendarización (Operador).</summary>
        [Authorize(Roles = Roles.Operador)]
        [HttpPut("paquete/{paqueteId:guid}")]
        public async Task<ActionResult> EditarPaquete(Guid paqueteId, [FromBody] RegistrarPaqueteRequest request)
        {
            try
            {
                await _enviosService.EditarPaquete(paqueteId, request, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== G1L-9: Repartidor cambia estado ==============

        /// <summary>Repartidor: transición de estado (ListoParaSalir → EnTransito → Entregado/Cancelado).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("cambiar-estado-paquete/{paqueteId:guid}/estado/{status}")]
        public async Task<ActionResult> CambiarEstadoPaquete(
            Guid paqueteId, PaqueteStatus status, [FromBody] CambiarEstadoRequest? request,
            [FromServices] Application.Services.OjoPatronService ojoPatron)
        {
            try
            {
                // Fase B: gate de la prueba de voz a mitad de recorrido (al entregar).
                if (status == PaqueteStatus.Entregado && await ojoPatron.RequierePruebaMitadAsync(paqueteId))
                    return BadRequest(new { code = "PRUEBA_MITAD_REQUERIDA", message = "Debés completar la prueba de voz de mitad de recorrido antes de seguir entregando." });

                await _enviosService.CambiarEstadoPorRepartidor(paqueteId, status, request?.Motivo, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== G1L-82: Estado "Demorado" ==============

        /// <summary>Marca un envío En Tránsito como Demorado con motivo obligatorio (Repartidor o Supervisor).</summary>
        [Authorize(Roles = Roles.Repartidor + "," + Roles.Supervisor)]
        [HttpPost("paquete/{paqueteId:guid}/demorar")]
        public async Task<ActionResult> MarcarDemorado(Guid paqueteId, [FromBody] MarcarDemoradoRequest request)
        {
            try
            {
                var rol = User.IsInRole(Roles.Supervisor) ? "Supervisor" : "Repartidor";
                await _enviosService.MarcarDemoradoAsync(paqueteId, request.Motivo, CurrentUserId(), rol);
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Vuelve un envío Demorado a En Tránsito (Repartidor).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("paquete/{paqueteId:guid}/continuar-transito")]
        public async Task<ActionResult> ContinuarTransito(Guid paqueteId)
        {
            try
            {
                await _enviosService.ContinuarTransitoAsync(paqueteId, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== G1L-13: Cancelación con motivo ==============

        /// <summary>Cancelar un paquete con motivo obligatorio.
        /// Operador/Supervisor: Pendiente o Listo para Salir (G1L-13).
        /// Repartidor: solo En Tránsito (G1L-9, Entrega Fallida).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor + "," + Roles.Repartidor)]
        [HttpPost("cancelar-paquete/{paqueteId:guid}")]
        public async Task<ActionResult> CancelarPaquete(Guid paqueteId, [FromBody] CancelarPaqueteRequest request)
        {
            try
            {
                var esRepartidor = User.IsInRole(Roles.Repartidor);
                await _enviosService.CancelarPaquete(paqueteId, request.Motivo, request.Mode, CurrentUserId(), esRepartidor);
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>Reenvía un paquete cancelado (Operador o Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor)]
        [HttpPost("reenviar-paquete/{paqueteId:guid}")]
        public async Task<ActionResult> ReenviarPaquete(Guid paqueteId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);
            if (paquete is null) return NotFound("Paquete no encontrado");
            if (!await PuedeVerPaqueteAsync(paquete)) return Forbid();
            try
            {
                paquete.ReEnviar();
                paquete.LiberarAsignacion();
                await _historialService.RegistrarCambioAsync(paquete.Id, paquete.Status, CurrentUserId(), OrigenCambioEstado.Manual, "Reenvío del paquete");
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== G1L-15: Historial de estados ==============

        /// <summary>Historial cronológico (descendente) de cambios de estado del paquete.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor)]
        [HttpGet("paquete/{paqueteId:guid}/historial")]
        public async Task<ActionResult<List<HistorialEstadoEnvioDto>>> GetHistorial(Guid paqueteId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);
            if (paquete is null) return NotFound();
            if (!await PuedeVerPaqueteAsync(paquete)) return Forbid();
            var historial = await _historialService.GetHistorialPorPaqueteAsync(paqueteId);
            return Ok(historial);
        }

        // ============== G1L-32: QR ==============

        /// <summary>Devuelve el QR del paquete como PNG.</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor)]
        [HttpGet("paquete/{paqueteId:guid}/qr")]
        public async Task<ActionResult> GetQr(Guid paqueteId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);
            if (paquete is null) return NotFound();
            if (!await PuedeVerPaqueteAsync(paquete)) return Forbid();
            var bytes = _qrService.GenerarPng(paquete.CodigoSeguimiento);
            return File(bytes, "image/png");
        }

        // ============== G1L-43: Escaneo de QR ==============

        /// <summary>Escaneo de QR: transiciona estado o abre la ficha de entrega (Operador o Repartidor).</summary>
        [Authorize(Roles = Roles.OperadorORepartidor)]
        [HttpPost("escanear-qr/{codigoSeguimiento}")]
        public async Task<ActionResult<EscaneoResultado>> EscanearQr(string codigoSeguimiento)
        {
            try
            {
                var result = await _enviosService.EscanearQr(codigoSeguimiento, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok(result);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>G1L-43: Inicializa la ruta del día. Pasa todos los paquetes "Listo para Salir"
        /// del repartidor logueado para la fecha indicada (o hoy) a "En Tránsito".</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("inicializar-ruta")]
        public async Task<ActionResult<object>> InicializarRuta(
            [FromQuery] DateTime? fecha,
            [FromServices] Application.Services.OjoPatronService ojoPatron)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            // G1L-59: bloqueo de inicio de ruta si no hay consentimiento vigente del Ojo del Patrón.
            if (!await ojoPatron.TieneConsentimientoVigenteAsync(userId.Value))
                return BadRequest(new { message = "Debés aceptar el consentimiento del Ojo del Patrón antes de iniciar la ruta." });
            // G1L-61: bloqueo si no realizó la prueba acústica del día.
            if (!await ojoPatron.TienePruebaAprobadaHoyAsync(userId.Value))
                return BadRequest(new { message = "Debés completar la prueba acústica del Ojo del Patrón antes de iniciar la ruta." });
            try
            {
                var hoy = OperationalClock.TodayUtcDate;
                var dia = (fecha ?? hoy).Date;
                if (dia != hoy)
                    return BadRequest(new { message = "Solo podés iniciar la ruta del día actual." });
                var cantidad = await _enviosService.IniciarRutaDelDiaAsync(userId.Value, dia, userId);
                await _context.SaveChangesAsync();
                return Ok(new { cantidad });
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        /// <summary>Fase A: estado de jornada del repartidor logueado (Disponible/EnRuta/Retornando).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpGet("estado-jornada")]
        public async Task<ActionResult<object>> EstadoJornada([FromServices] IUserRepository userRepo)
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            var rep = await userRepo.GetUsuarioById(userId.Value) as Repartidor;
            return Ok(new { estadoJornada = rep?.EstadoJornadaLabel ?? "Disponible" });
        }

        /// <summary>Fase A: el repartidor confirma que volvió a la sucursal (cierra su jornada).</summary>
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("cerrar-jornada")]
        public async Task<ActionResult> CerrarJornada()
        {
            var userId = CurrentUserId();
            if (userId is null) return Unauthorized();
            try
            {
                await _enviosService.CerrarJornadaAsync(userId.Value);
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        // ============== G1L-28: Etiqueta ==============

        /// <summary>Datos de la etiqueta imprimible (Operador o Supervisor).</summary>
        [Authorize(Roles = Roles.OperadorOSupervisor)]
        [HttpGet("paquete/{paqueteId:guid}/etiqueta")]
        public async Task<ActionResult<EtiquetaResponse>> GetEtiqueta(Guid paqueteId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);
            if (paquete is null) return NotFound();
            if (!await PuedeVerPaqueteAsync(paquete)) return Forbid();

            var dto = new EtiquetaResponse
            {
                CodigoSeguimiento = paquete.CodigoSeguimiento,
                UrlSeguimiento = _qrService.BuildTrackingUrl(paquete.CodigoSeguimiento),
                QrBase64 = _qrService.GenerarBase64(paquete.CodigoSeguimiento),
                Remitente = new EtiquetaCliente
                {
                    Nombre = paquete.Remitente.Nombre,
                    Apellido = paquete.Remitente.Apellido,
                    Telefono = paquete.Remitente.Telefono,
                    Direccion = paquete.Remitente.Direccion.Calle,
                    Ciudad = paquete.Remitente.Direccion.Ciudad,
                    CP = paquete.Remitente.Direccion.CP,
                },
                Destinatario = new EtiquetaCliente
                {
                    Nombre = paquete.Destinatario.Nombre,
                    Apellido = paquete.Destinatario.Apellido,
                    Telefono = paquete.Destinatario.Telefono,
                    Direccion = paquete.Destinatario.Direccion.Calle,
                    Ciudad = paquete.Destinatario.Direccion.Ciudad,
                    CP = paquete.Destinatario.Direccion.CP,
                },
                Peso = paquete.Peso,
                TipoEnvio = paquete.TipoEnvio.ToString(),
                TipoPaquete = paquete.TipoPaquete.ToString(),
            };
            return Ok(dto);
        }

        // ============== Marcaje desde Ruta (Repartidor) ==============

        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("entregar-paquete/ruta/{rutaId:guid}/paquete/{paqueteId:guid}")]
        public async Task<ActionResult> EntregarPaquete(Guid rutaId, Guid paqueteId)
        {
            var ruta = await _rutasRepository.GetRutaById(rutaId);
            if (ruta is null) return NotFound();
            var paquete = await _enviosRepository.GetPaquete(paqueteId);
            if (paquete is null) return NotFound();
            if (!await PuedeVerPaqueteAsync(paquete)) return Forbid();
            try
            {
                ruta.EntregarPaquete(paqueteId);
                await _historialService.RegistrarCambioAsync(paqueteId, PaqueteStatus.Entregado, CurrentUserId(), OrigenCambioEstado.Manual);
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        // ============== Vehículos / Sucursales (mantener acceso administrativo) ==============

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPost("vehiculos/registrar-vehiculo")]
        public async Task<ActionResult> RegistrarVehiculo([FromBody] RegistrarVehiculoRequest request)
        {
            var vehiculo = new Vehiculo(request.Patente, request.Modelo, request.Capacidad);
            await _vehiculoRepository.Add(vehiculo);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpGet("vehiculos/activos")]
        public async Task<ActionResult<List<Vehiculo>>> GetVehiculosActivos()
        {
            var vehiculos = await _vehiculoRepository.GetVehiculosActivos();
            return Ok(vehiculos);
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpGet("vehiculos")]
        public async Task<ActionResult<List<Vehiculo>>> GetVehiculos([FromQuery] VehiculoEstado? estado)
        {
            var vehiculos = await _vehiculoRepository.GetAll(estado);
            return Ok(vehiculos);
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpGet("vehiculos/{vehiculoId:guid}")]
        public async Task<ActionResult<Vehiculo>> GetVehiculo(Guid vehiculoId)
        {
            var vehiculo = await _vehiculoRepository.GetVehiculo(vehiculoId);
            if (vehiculo is null) return NotFound("Vehículo no encontrado");
            return Ok(vehiculo);
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPost("vehiculos/{vehiculoId:guid}/suspender")]
        public async Task<ActionResult> SuspenderVehiculo(Guid vehiculoId)
        {
            var vehiculo = await _vehiculoRepository.GetVehiculo(vehiculoId);
            if (vehiculo is null) return NotFound("Vehículo no encontrado");
            vehiculo.Suspender();
            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor)]
        [HttpPost("vehiculos/{vehiculoId:guid}/estado/{estado}")]
        public async Task<ActionResult> CambiarEstadoVehiculo(Guid vehiculoId, VehiculoEstado estado)
        {
            var vehiculo = await _vehiculoRepository.GetVehiculo(vehiculoId);
            if (vehiculo is null) return NotFound("Vehículo no encontrado");
            vehiculo.CambiarEstado(estado);
            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize(Roles = Roles.Administrador + "," + Roles.Supervisor + "," + Roles.Operador + "," + Roles.Gerente)]
        [HttpGet("sucursales")]
        public async Task<ActionResult<List<Sucursal>>> GetSucursales()
        {
            var user = await CurrentUserAsync();
            // Obtener sucursales y, si es Gerente, filtrar por sus provincias asignadas
            var sucursalIdFilter = user is not null && user is not Gerente && user is not Administrador ? user.SucursalId : null;
            var all = await _enviosRepository.GetSucursales(null, sucursalIdFilter);
            if (user is Gerente gerente)
            {
                var provincias = await _context.GerentesProvincias.Where(gp => gp.GerenteId == gerente.Id).Select(gp => gp.Provincia).ToListAsync();
                var filtered = all.Where(s => provincias.Any(p => string.Equals(p, s.Provincia, StringComparison.OrdinalIgnoreCase))
                    || s.ProvinciasCubiertas.Any(pc => provincias.Any(p => string.Equals(p, pc, StringComparison.OrdinalIgnoreCase))))
                    .ToList();
                return Ok(filtered);
            }
            return Ok(all);
        }

        // Sucursal de origen con coordenadas (geocodificadas on-the-fly).
        // La usa el repartidor para mostrar su punto de salida en el mapa.
        [Authorize]
        [HttpGet("sucursal-origen")]
        public async Task<ActionResult<object>> GetSucursalOrigen([FromServices] GeocodingService geocoding)
        {
            var user = await CurrentUserAsync();
            var sucursalIdFilter = user is not null && user is not Gerente && user is not Administrador ? user.SucursalId : null;
            var sucursales = await _enviosRepository.GetSucursales(null, sucursalIdFilter);
            if (user is Gerente g)
            {
                var provincias = await _context.GerentesProvincias.Where(gp => gp.GerenteId == g.Id).Select(gp => gp.Provincia).ToListAsync();
                sucursales = sucursales.Where(s => provincias.Any(p => string.Equals(p, s.Provincia, StringComparison.OrdinalIgnoreCase))
                    || s.ProvinciasCubiertas.Any(pc => provincias.Any(p => string.Equals(p, pc, StringComparison.OrdinalIgnoreCase)))).ToList();
            }
            var sucursal = sucursales.FirstOrDefault(s => s.Estado == SucursalStatus.Activa)
                ?? sucursales.FirstOrDefault();
            if (sucursal is null) return NoContent();

            Ubicacion? coords = null;
            try
            {
                coords = await geocoding.GeocodeAsync(sucursal.Direccion, sucursal.Ciudad, sucursal.CodigoPostal, sucursal.Provincia);
            }
            catch
            {
                // No bloquea: si el geocoding falla, devolvemos sin coords y el front
                // hace fallback al centro de las paradas.
            }

            return Ok(new
            {
                id = sucursal.Id,
                nombre = sucursal.Nombre,
                direccion = sucursal.Direccion,
                ciudad = sucursal.Ciudad,
                codigoPostal = sucursal.CodigoPostal,
                provincia = sucursal.Provincia,
                telefono = sucursal.Telefono,
                latitud = coords?.Latitud,
                longitud = coords?.Longitud,
            });
        }

        // Épica D: multi-sucursal. El Gerente crea sucursales (idealmente de su provincia).
        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpPost("sucursales/registrar-sucursal")]
        public async Task<ActionResult> RegistrarSucursal([FromBody] RegistarSucursal request)
        {
            var error = await ValidarProvinciaGerente(request.Provincia);
            if (error is not null) return BadRequest(new { error });

            var sucursal = new Sucursal(request.Nombre, request.Direccion, request.Ciudad, request.CodigoPostal, request.Telefono, request.Provincia);
            if (request.ProvinciasCubiertas is not null)
                sucursal.DefinirCobertura(request.ProvinciasCubiertas);
            // Validar que, si el usuario es Gerente, las provincias cubiertas estén dentro de sus provincias asignadas
            if (request.ProvinciasCubiertas is not null && request.ProvinciasCubiertas.Count > 0)
            {
                var coveredError = await ValidarProvinciasCubiertas(request.ProvinciasCubiertas);
                if (coveredError is not null) return BadRequest(new { error = coveredError });
            }
            await _enviosRepository.Add(sucursal);
            await _context.SaveChangesAsync();

            // Si se abre una sucursal en una provincia, las demás sucursales ya no deben cubrirla.
            if (!string.IsNullOrWhiteSpace(request.Provincia))
            {
                var provinciaNew = request.Provincia.Trim();
                var otras = (await _context.Sucursales.ToListAsync())
                    .Where(s => s.Id != sucursal.Id &&
                                s.ProvinciasCubiertas.Any(p => string.Equals(p, provinciaNew, StringComparison.OrdinalIgnoreCase)))
                    .ToList();
                foreach (var s in otras)
                    s.DefinirCobertura(s.ProvinciasCubiertas.Where(p => !string.Equals(p, provinciaNew, StringComparison.OrdinalIgnoreCase)));
                if (otras.Count > 0)
                    await _context.SaveChangesAsync();
            }

            return Ok();
        }

        // Épica D: un Gerente solo puede crear/editar sucursales de su propia provincia.
        // Devuelve un mensaje de error si la provincia no coincide; null si es válido (o Admin).
        private async Task<string?> ValidarProvinciaGerente(string? provinciaSucursal)
        {
            if (!User.IsInRole(Roles.Gerente)) return null; // Admin sin restricción
            var userId = CurrentUserId();
            if (userId is null) return "No se pudo identificar al usuario.";
            var gerente = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == userId.Value) as Gerente;
            if (gerente is null) return "Usuario no es Gerente.";
            // Obtener provincias asignadas al gerente
            var provincias = await _context.GerentesProvincias
                .Where(gp => gp.GerenteId == gerente.Id)
                .Select(gp => gp.Provincia)
                .ToListAsync();
            if (!provincias.Any()) return "El gerente no tiene provincias asignadas.";
            var provNorm = provinciaSucursal?.Trim() ?? string.Empty;
            if (!provincias.Any(p => string.Equals(p.Trim(), provNorm, StringComparison.OrdinalIgnoreCase)))
                return $"Solo podés gestionar sucursales de tus provincias asignadas ({string.Join(", ", provincias)}).";
            return null;
        }

        // Valida que las provincias cubiertas no tengan gerente asignado (si el usuario es gerente).
        private async Task<string?> ValidarProvinciasCubiertas(List<string>? provinciasCubiertas)
        {
            if (!User.IsInRole(Roles.Gerente)) return null; // Admin sin restricción
            var userId = CurrentUserId();
            if (userId is null) return "No se pudo identificar al usuario.";
            var gerente = await _context.Usuarios.FirstOrDefaultAsync(u => u.Id == userId.Value) as Gerente;
            if (gerente is null) return "Usuario no es Gerente.";
            var provinciasOcupadas = await _context.GerentesProvincias
                .Select(gp => gp.Provincia)
                .ToListAsync();
            foreach (var prov in provinciasCubiertas ?? new List<string>())
            {
                var pNorm = prov?.Trim() ?? string.Empty;
                if (provinciasOcupadas.Any(p => string.Equals(p.Trim(), pNorm, StringComparison.OrdinalIgnoreCase)))
                    return "Solo podés asignar cobertura de provincias que no tengan gerente asignado.";
            }
            return null;
        }

        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpPut("sucursales/{id:guid}")]
        public async Task<ActionResult> ActualizarSucursal(Guid id, [FromBody] RegistarSucursal request)
        {
            var sucursal = await _enviosRepository.GetSucursalById(id);
            if (sucursal == null) return NotFound();
            // Bloqueamos tanto la provincia destino como la actual (no permitir mover fuera del ámbito).
            var error = await ValidarProvinciaGerente(request.Provincia)
                        ?? await ValidarProvinciaGerente(sucursal.Provincia);
            if (error is not null) return BadRequest(new { error });
            sucursal.Actualizar(request.Nombre, request.Direccion, request.Ciudad, request.CodigoPostal, request.Telefono, request.Provincia);
            if (request.ProvinciasCubiertas is not null)
                sucursal.DefinirCobertura(request.ProvinciasCubiertas);
            if (request.ProvinciasCubiertas is not null && request.ProvinciasCubiertas.Count > 0)
            {
                var coveredError = await ValidarProvinciasCubiertas(request.ProvinciasCubiertas);
                if (coveredError is not null) return BadRequest(new { error = coveredError });
            }
            await _context.SaveChangesAsync();
            return Ok();
        }

        [Authorize(Roles = Roles.GerenteOAdministrador)]
        [HttpDelete("sucursales/{id:guid}")]
        public async Task<ActionResult> EliminarSucursal(Guid id)
        {
            var sucursal = await _enviosRepository.GetSucursalById(id);
            if (sucursal == null) return NotFound();
            var error = await ValidarProvinciaGerente(sucursal.Provincia);
            if (error is not null) return BadRequest(new { error });
            _enviosRepository.DeleteSucursal(sucursal);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        /// <summary>Supervisor resuelve un incidente: reprograma o cancela un envío en cualquier estado.</summary>
        [Authorize(Roles = Roles.Supervisor)]
        [HttpPost("paquete/{paqueteId:guid}/resolver-incidente")]
        public async Task<ActionResult> ResolverIncidente(Guid paqueteId, [FromBody] ResolverIncidenteRequest request)
        {
            try
            {
                await _enviosService.ResolverIncidenteSupervisor(paqueteId, request.Accion, request.Motivo, CurrentUserId());
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }


    // ============== DTOs ==============

    public class ResolverIncidenteRequest
    {
        [Required] public string Accion { get; set; } = string.Empty;
        [Required] public string Motivo { get; set; } = string.Empty;
    }

    public class CancelarPaqueteRequest
    {
        [Required(ErrorMessage = "El motivo de cancelación es obligatorio.")]
        public string Motivo { get; set; } = string.Empty;
        public CancelarEnvioMode Mode { get; set; } = CancelarEnvioMode.Definitivo;
    }

    // G1L-82: motivos sugeridos por el CA — el front debería ofrecer estos como dropdown.
    public class MarcarDemoradoRequest
    {
        [Required(ErrorMessage = "El motivo de la demora es obligatorio.")]
        public string Motivo { get; set; } = string.Empty;
    }

    public class CambiarEstadoRequest
    {
        public string? Motivo { get; set; }
    }

    public class ActualizarUbicacionRequest
    {
        [Required] public double Latitud { get; set; }
        [Required] public double Longitud { get; set; }
    }

    public record RepartidorUbicacionDto(
        Guid RepartidorId,
        string RepartidorNombre,
        Guid PaqueteId,
        string CodigoSeguimiento,
        double Latitud,
        double Longitud,
        DateTime? ActualizadaEn);

    public class RegistrarPaqueteRequest
    {
        [Required] public double Peso { get; set; }
        public string? Comentarios { get; set; }
        public TipoEnvio TipoEnvio { get; set; } = TipoEnvio.Comun;
        public TipoPaquete TipoPaquete { get; set; } = TipoPaquete.Comun;
        [Required] public RegistrarClienteRequest Remitente { get; set; }
        [Required] public RegistrarClienteRequest Destinatario { get; set; }
        public Guid? PuntoPickUpId { get; set; }
    }

    public class GenerarLoteDemoRequest
    {
        [Required] public int Cantidad { get; set; }
    }

    public class ImportarEnviosExcelRequest
    {
        [Required] public IFormFile File { get; set; } = default!;
    }

    public class RegistrarClienteRequest
    {
        [Required] public string Direccion { get; set; } = string.Empty;
        [Required] public string Localidad { get; set; } = string.Empty;
        [Required] public string CP { get; set; } = string.Empty;
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Apellido { get; set; } = string.Empty;
        // Provincia es opcional. La envía el front a partir de la validación
        // del CP y se usa para que el geocoding (Nominatim) caiga en la provincia
        // correcta cuando el nombre de calle es ambiguo entre provincias.
        public string? Provincia { get; set; }
        public string? Telefono { get; set; }
        
        [EmailAddress(ErrorMessage = "El formato del correo electrónico no es válido.")]
        public string? Email { get; set; }
    }

    public class RegistrarVehiculoRequest
    {
        public string Patente { get; set; } = string.Empty;
        public string Modelo { get; set; } = string.Empty;
        public double Capacidad { get; set; }
    }

    public class RegistarSucursal
    {
        [Required] public string Nombre { get; set; } = string.Empty;
        [Required] public string Direccion { get; set; } = string.Empty;
        [Required] public string Ciudad { get; set; } = string.Empty;
        [Required] public string CodigoPostal { get; set; } = string.Empty;
        [Required] public string Telefono { get; set; } = string.Empty;
        // Opcional para no romper integraciones viejas; el front lo manda obligatorio.
        public string? Provincia { get; set; }
        // Épica D: provincias adicionales (sin sucursal propia) que cubre esta sucursal.
        public List<string>? ProvinciasCubiertas { get; set; }
    }

    public class EtiquetaResponse
    {
        public string CodigoSeguimiento { get; set; } = string.Empty;
        public string UrlSeguimiento { get; set; } = string.Empty;
        public string QrBase64 { get; set; } = string.Empty;
        public EtiquetaCliente Remitente { get; set; } = new();
        public EtiquetaCliente Destinatario { get; set; } = new();
        public double Peso { get; set; }
        public string TipoEnvio { get; set; } = string.Empty;
        public string TipoPaquete { get; set; } = string.Empty;
    }

    public class EtiquetaCliente
    {
        public string Nombre { get; set; } = string.Empty;
        public string Apellido { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string Direccion { get; set; } = string.Empty;
        public string Ciudad { get; set; } = string.Empty;
        public string CP { get; set; } = string.Empty;
    }

    public class SeguimientoPublicoResponse
    {
        public Guid Id { get; set; }
        public Guid? SucursalId { get; set; }
        public string CodigoSeguimiento { get; set; } = string.Empty;
        public PaqueteStatus Status { get; set; }
        public TipoEnvio TipoEnvio { get; set; }
        public TipoPaquete TipoPaquete { get; set; }
        public DateTime CreadoEn { get; set; }
        // G1L-17: fecha estimada de entrega (asignada por la calendarización).
        // Si está definida, el front la muestra como hito en la línea de tiempo.
        public DateTime? FechaCalendarizada { get; set; }
        public DateTime? FechaEstimadaEntrega { get; set; }
        public double Peso { get; set; }
        public string? Descripcion { get; set; }
        public string? RazonCancelacion { get; set; }
        public Ubicacion? UbicacionActual { get; set; }
        public DateTime? UbicacionActualActualizadaEn { get; set; }
        public SeguimientoPublicoCliente Remitente { get; set; } = new();
        public SeguimientoPublicoCliente Destinatario { get; set; } = new();
    }

    public class SeguimientoPublicoCliente
    {
        public string Ciudad { get; set; } = string.Empty;
        public string CP { get; set; } = string.Empty;
    }
}
