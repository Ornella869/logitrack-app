using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Hubs;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{

    [ApiController]
    [Route("api/rutas")]
    public class RutasController : ControllerBase
    {
        private readonly IEnviosRepository _enviosRepository;
        private readonly EnviosService _enviosService;

        private readonly RutasService _rutasService;

        private readonly IRutasRepository _rutasRepository;

        private readonly LogiTrackDbContext _context;


        public RutasController(
            LogiTrackDbContext context,
            IEnviosRepository enviosRepository, EnviosService enviosService, RutasService rutasService, IRutasRepository rutasRepository)
        {
            _context = context;
            _rutasService = rutasService;
            _rutasRepository = rutasRepository;
            _enviosRepository = enviosRepository;
            _enviosService = enviosService;
        }

        /// <summary>
        /// Obtiene todas las rutas disponibles.
        /// </summary>
        /// <returns>Lista de rutas</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Authorize(Roles = Roles.OperadorOSupervisorOAdministrador)]
        [HttpGet()]
        public async Task<ActionResult<List<Ruta>>> Index()
        {
            var rutas = await _rutasRepository.GetRutas();

            return Ok(rutas);
        }

        /// <summary>
        /// Obtiene historial de rutas de un repartidor específico.
        /// </summary>
        /// <param name="repartidorId">ID del repartidor</param>
        /// <returns>Listado de rutas del repartidor</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador + "," + Roles.Repartidor)]
        [HttpGet("repartidor/{repartidorId:guid}")]
        public async Task<ActionResult<List<Ruta>>> GetRutasByRepartidor(Guid repartidorId)
        {
            var rutas = await _rutasRepository.GetHistorialRutas(repartidorId);

            // Mapear a un objeto sin referencias circulares
            var rutasResponse = rutas.Select(r => new
            {
                id = r.Id,
                estado = r.Estado.ToString(),
                iniciadoEn = r.IniciadoEn,
                finalizadoEn = r.FinalizadoEn,
                razonCancelacion = r.RazonCancelacion,
                repartidor = new
                {
                    id = r.Repartidor.Id,
                    nombre = r.Repartidor.Nombre,
                    apellido = r.Repartidor.Apellido,
                    email = r.Repartidor.Email
                },
                vehiculo = new
                {
                    id = r.Vehiculo.Id,
                    patente = r.Vehiculo.Patente,
                    marca = r.Vehiculo.Marca,
                    capacidadCarga = r.Vehiculo.CapacidadCarga,
                    estado = r.Vehiculo.Estado.ToString()
                },
                paquetes = r.Paquetes.Select(p => new
                {
                    id = p.Id,
                    codigoSeguimiento = p.CodigoSeguimiento,
                    peso = p.Peso,
                    descripcion = p.Descripcion,
                    status = p.Status.ToString(),
                    creadoEn = p.CreadoEn,
                    remitente = new
                    {
                        nombre = p.Remitente.Nombre,
                        apellido = p.Remitente.Apellido,
                        direccion = new
                        {
                            calle = p.Remitente.Direccion.Calle,
                            ciudad = p.Remitente.Direccion.Ciudad,
                            cp = p.Remitente.Direccion.CP
                        }
                    },
                    destinatario = new
                    {
                        nombre = p.Destinatario.Nombre,
                        apellido = p.Destinatario.Apellido,
                        direccion = new
                        {
                            calle = p.Destinatario.Direccion.Calle,
                            ciudad = p.Destinatario.Direccion.Ciudad,
                            cp = p.Destinatario.Direccion.CP
                        }
                    }
                }).ToList()
            }).ToList();

            return Ok(rutasResponse);
        }

        /// <summary>
        /// Obtiene el historial de rutas del repartidor logueado.
        /// </summary>
        /// <returns>Historial de rutas</returns>
        ///
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("historial")]
        [Authorize]
        public async Task<ActionResult<List<Ruta>>> GetHistorialRutas()
        {
            Console.WriteLine("holaa");

            HttpContext.User.Claims.ToList().ForEach(c => Console.WriteLine($"Claim: {c.Type} - {c.Value}"));

            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;

            if (userId == null) return Unauthorized();

            var rutas = await _rutasRepository.GetHistorialRutas(Guid.Parse(userId));

            return Ok(rutas);
        }

        /// <summary>
        /// Marca una ruta como comenzada.
        /// </summary>
        /// <param name="rutaId">ID de la ruta</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("comenzar-ruta/{rutaId:guid}")]
        public async Task<ActionResult> ComenzarRuta(Guid rutaId)
        {

            var ruta = await _rutasRepository.GetRutaById(rutaId);

            if (ruta is null)
                return NotFound();

            ruta.Iniciar();

            await _context.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Finaliza una ruta existente.
        /// </summary>
        /// <param name="rutaId">ID de la ruta</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Authorize(Roles = Roles.Repartidor + "," + Roles.Supervisor)]
        [HttpPost("finalizar-ruta/{rutaId:guid}")]
        public async Task<ActionResult> FinalizarRuta(Guid rutaId)
        {
            var ruta = await _rutasRepository.GetRutaById(rutaId);

            if (ruta is null)
                return NotFound();

            try
            {
                ruta.Finalizar();
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Cancela una ruta existente con una razón opcional.
        /// </summary>
        /// <param name="rutaId">ID de la ruta</param>
        /// <param name="request">Motivo de cancelación</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpPost("cancelar-ruta/{rutaId:guid}")]
        public async Task<ActionResult> CancelarRuta(Guid rutaId, [FromBody] CancelarRutaRequest request)
        {
            var ruta = await _rutasRepository.GetRutaById(rutaId);

            if (ruta is null)
                return NotFound();

            var razon = string.IsNullOrWhiteSpace(request?.Razon)
                ? "Cancelada desde el sistema"
                : request.Razon;

            ruta.Cancelar(razon);

            await _context.SaveChangesAsync();

            return Ok();
        }


        /// <summary>
        /// Reasigna una ruta a otro repartidor.
        /// </summary>
        /// <param name="rutaId">ID de la ruta</param>
        /// <param name="repartidorId">ID del repartidor</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpPost("reasignar-ruta/ruta/{rutaId:guid}/repartidor/{repartidorId:guid}")]
        public async Task<ActionResult> ReasignarRuta(Guid rutaId, Guid repartidorId)
        {
            await _enviosService.ReasignarRuta(rutaId, repartidorId);

            await _context.SaveChangesAsync();

            return Ok();
        }

        /// <summary>G1L-121: Captura de ubicación GPS automática cada 10 segundos desde el repartidor.</summary>
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPut("mi-ubicacion")]
        public async Task<ActionResult> ActualizarUbicacion([FromBody] UbicacionRequest request, [FromServices] IHubContext<UbicacionHub> hub)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var repartidorId = Guid.Parse(userId);
            var ruta = await _rutasRepository.GetRutaActivaByRepartidorId(repartidorId);
            if (ruta is null) return NotFound("No hay ruta activa.");

            try
            {
                ruta.ActualizarUbicacion(request.Lat, request.Lng);
                await _emitirUbicacionSignalRAsync(repartidorId, request.Lat, request.Lng, hub);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>G1L-121: Envío de lote de posiciones GPS acumuladas offline.</summary>
        [ProducesResponseType(StatusCodes.Status204NoContent)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [Authorize(Roles = Roles.Repartidor)]
        [HttpPost("mi-ubicacion/lote")]
        public async Task<ActionResult> ActualizarUbicacionLote([FromBody] List<UbicacionConTimestampRequest> posiciones, [FromServices] IHubContext<UbicacionHub> hub)
        {
            if (posiciones == null || posiciones.Count == 0) return BadRequest("Lista vacía.");

            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (userId == null) return Unauthorized();

            var repartidorId = Guid.Parse(userId);
            var ruta = await _rutasRepository.GetRutaActivaByRepartidorId(repartidorId);
            if (ruta is null) return NotFound("No hay ruta activa.");

            var ultima = posiciones.OrderBy(p => p.Timestamp).Last();

            try
            {
                ruta.ActualizarUbicacion(ultima.Lat, ultima.Lng);
                await _emitirUbicacionSignalRAsync(repartidorId, ultima.Lat, ultima.Lng, hub);
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private async Task _emitirUbicacionSignalRAsync(Guid repartidorId, double lat, double lng, IHubContext<UbicacionHub> hub)
        {
            var ahora = DateTime.UtcNow;
            var paquetes = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId
                            && (p.Status == PaqueteStatus.EnTransito
                                || p.Status == PaqueteStatus.Demorado
                                || p.Status == PaqueteStatus.EnTransitoDescanso))
                .ToListAsync();

            foreach (var paquete in paquetes)
            {
                paquete.UbicacionActual = new Ubicacion(lat, lng);
                paquete.UbicacionActualActualizadaEn = ahora;
            }

            foreach (var paquete in paquetes)
            {
                await hub.Clients.All.SendAsync("ubicacionActualizada", new
                {
                    repartidorId,
                    paqueteId = paquete.Id,
                    codigoSeguimiento = paquete.CodigoSeguimiento,
                    latitud = lat,
                    longitud = lng,
                    actualizadaEn = ahora,
                });
            }
        }

        /// <summary>
        /// Crea una nueva ruta con un vehículo, repartidor y paquetes.
        /// </summary>
        /// <param name="request">Datos para crear la ruta</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [Authorize(Roles = Roles.Supervisor + "," + Roles.Administrador)]
        [HttpPost("crear-ruta")]
        public async Task<ActionResult> CrearRuta([FromBody] CrearRutaRequest request)
        {

            await _rutasService.CrearRuta(request);

            await _context.SaveChangesAsync();

            return Ok();
        }
    }


    public class CrearRutaRequest
    {
        public Guid VehiculoId { get; set; }
        public Guid RepartidorId { get; set; }
        public List<Guid> PaqueteIds { get; set; }
    }

    public class CancelarRutaRequest
    {
        public string Razon { get; set; } = string.Empty;
    }

    public class UbicacionRequest
    {
        public double Lat { get; set; }
        public double Lng { get; set; }
    }

    public class UbicacionConTimestampRequest
    {
        public double Lat { get; set; }
        public double Lng { get; set; }
        public long Timestamp { get; set; }
    }
}
