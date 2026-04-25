using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

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
        [HttpGet()]
        public async Task<ActionResult<List<Ruta>>> Index()
        {
            var rutas = await _rutasRepository.GetRutas();

            return Ok(rutas);
        }

        /// <summary>
        /// Obtiene historial de rutas de un transportista específico.
        /// </summary>
        /// <param name="transportistaId">ID del transportista</param>
        /// <returns>Listado de rutas del transportista</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("transportista/{transportistaId:guid}")]
        public async Task<ActionResult<List<Ruta>>> GetRutasByTransportista(Guid transportistaId)
        {
            var rutas = await _rutasRepository.GetHistorialRutas(transportistaId);

            // Mapear a un objeto sin referencias circulares
            var rutasResponse = rutas.Select(r => new
            {
                id = r.Id,
                estado = r.Estado.ToString(),
                iniciadoEn = r.IniciadoEn,
                finalizadoEn = r.FinalizadoEn,
                razonCancelacion = r.RazonCancelacion,
                transportista = new
                {
                    id = r.Transportista.Id,
                    nombre = r.Transportista.Nombre,
                    apellido = r.Transportista.Apellido,
                    email = r.Transportista.Email
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
        /// Obtiene el historial de rutas del transportista logueado.
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
        /// Reasigna una ruta a otro transportista.
        /// </summary>
        /// <param name="rutaId">ID de la ruta</param>
        /// <param name="transportistaId">ID del transportista</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("reasignar-ruta/ruta/{rutaId:guid}/transportista/{transportistaId:guid}")]
        public async Task<ActionResult> ReasignarRuta(Guid rutaId, Guid transportistaId)
        {
            await _enviosService.ReasignarRuta(rutaId, transportistaId);

            await _context.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Crea una nueva ruta con un vehículo, transportista y paquetes.
        /// </summary>
        /// <param name="request">Datos para crear la ruta</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
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
        public Guid TransportistaId { get; set; }
        public List<Guid> PaqueteIds { get; set; }
    }

    public class CancelarRutaRequest
    {
        public string Razon { get; set; } = string.Empty;
    }
}