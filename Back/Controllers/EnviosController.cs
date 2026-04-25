using System.ComponentModel.DataAnnotations;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;

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
        private readonly LogiTrackDbContext _context;


        public EnviosController(
            LogiTrackDbContext context,
            IRutasRepository rutasRepository,
            IEnviosRepository enviosRepository, IVehiculoRepository vehiculoRepository, EnviosService enviosService)
        {
            _context = context;
            _rutasRepository = rutasRepository;
            _enviosService = enviosService;
            _vehiculoRepository = vehiculoRepository;
            _enviosRepository = enviosRepository;
        }

        /// <summary>
        /// Registra un nuevo paquete en el sistema.
        /// </summary>
        /// <param name="request">Datos del paquete a registrar</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("registrar-paquete")]
        public async Task<ActionResult> RegistrarPaquete([FromBody] RegistrarPaqueteRequest request)
        {
            await _enviosService.RegistrarPaquete(request);


            await _context.SaveChangesAsync();

            return Ok();
        }


        /// <summary>
        /// Obtiene el paquete por código de seguimiento.
        /// </summary>
        /// <param name="codigoSeguimiento">Código único de seguimiento</param>
        /// <returns>El paquete encontrado o NotFound</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("seguimiento/{codigoSeguimiento}")]
        public async Task<ActionResult<Paquete>> Seguimiento(string codigoSeguimiento)
        {

            var paquete = await _enviosRepository.GetPaqueteByCodigoSeguimiento(codigoSeguimiento);

            if (paquete is null)
                return NotFound();

            await _context.SaveChangesAsync();

            return Ok(paquete);
        }

        /// <summary>
        /// Obtiene el paquete con el id provisto.
        /// </summary>
        /// <param name="paqueteId">ID del paquete</param>
        /// <returns>El paquete encontrado o NotFound</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("paquete/{paqueteId:guid}")]
        public async Task<ActionResult<Paquete>> GetPaquete(Guid paqueteId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);

            if (paquete is null)
                return NotFound();

            await _context.SaveChangesAsync();

            return Ok(paquete);
        }

        /// <summary>
        /// Consulta paquetes que se encuentran en sucursal.
        /// </summary>
        /// <returns>Lista de paquetes en sucursal</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("paquetes-en-sucursal")]
        public async Task<ActionResult<List<Paquete>>> GetPaquetesEnSucursal()
        {
            var paquetes = await _enviosRepository.GetPaquetesEnSucursal();

            await _context.SaveChangesAsync();

            return Ok(paquetes);
        }

        /// <summary>
        /// Devuelve todos los paquetes registrados.
        /// </summary>
        /// <returns>Lista completa de paquetes</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("todos-los-paquetes")]
        public async Task<ActionResult<List<Paquete>>> GetTodosLosPaquetes()
        {
            var paquetes = await _enviosRepository.GetAll();
            await _context.SaveChangesAsync();
            return Ok(paquetes);
        }


        /// <summary>
        /// Busca paquetes por código de seguimiento o destinatario.
        /// </summary>
        /// <param name="request">Filtros de búsqueda</param>
        /// <returns>Lista de paquetes coincidencia</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("busqueda-de-paquetes")]
        public async Task<ActionResult<List<Paquete>>> BusquedaDePaquetes([FromBody] BusquedaDePaquetesRequest request)
        {
            var paquetes = await _enviosRepository.GetPaquetes(request.CodigoSeguimiento, request.Destinatario);

            await _context.SaveChangesAsync();

            return Ok(paquetes);
        }

        /// <summary>
        /// Registra un vehículo en el sistema.
        /// </summary>
        /// <param name="request">Datos del vehículo</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("vehiculos/registrar-vehiculo")]
        public async Task<ActionResult> RegistrarVehiculo([FromBody] RegistrarVehiculoRequest request)
        {
            var vehiculo = new Vehiculo(
                request.Patente,
                request.Modelo,
                request.Capacidad
            );

            await _vehiculoRepository.Add(vehiculo);

            await _context.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Obtiene vehículos activos.
        /// </summary>
        /// <returns>Lista de vehículos activos</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("vehiculos/activos")]
        public async Task<ActionResult<List<Vehiculo>>> GetVehiculosActivos()
        {
            var vehiculos = await _vehiculoRepository.GetVehiculosActivos();

            await _context.SaveChangesAsync();

            return Ok(vehiculos);
        }

        /// <summary>
        /// Obtiene todos los vehículos registrados con la posibilidad de filtrarlos por estado.
        /// </summary>
        /// <returns>Lista de todos los vehículos</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("vehiculos")]
        public async Task<ActionResult<List<Vehiculo>>> GetVehiculos([FromQuery] VehiculoEstado? estado)
        {
            var vehiculos = await _vehiculoRepository.GetAll(estado);

            return Ok(vehiculos);
        }


        /// <summary>
        /// Obtiene un vehículo por ID.
        /// </summary>
        /// <param name="vehiculoId">ID del vehículo</param>
        /// <returns>Vehículo encontrado o NotFound</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("vehiculos/{vehiculoId:guid}")]
        public async Task<ActionResult<Vehiculo>> GetVehiculo(Guid vehiculoId)
        {
            var vehiculo = await _vehiculoRepository.GetVehiculo(vehiculoId);

            if (vehiculo is null)
                return NotFound("Vehículo no encontrado");

            await _context.SaveChangesAsync();

            return Ok(vehiculo);
        }

        /// <summary>
        /// Suspende un vehículo por ID.
        /// </summary>
        /// <param name="vehiculoId">ID del vehículo</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("vehiculos/{vehiculoId:guid}/suspender")]
        public async Task<ActionResult> SuspenderVehiculo(Guid vehiculoId)
        {
            var vehiculo = await _vehiculoRepository.GetVehiculo(vehiculoId);

            if (vehiculo is null)
                return NotFound("Vehículo no encontrado");

            vehiculo.Suspender();

            await _context.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Cambia el estado de un vehículo.
        /// </summary>
        /// <param name="vehiculoId">ID del vehículo</param>
        /// <param name="estado">Estado deseado</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("vehiculos/{vehiculoId:guid}/estado/{estado}")]
        public async Task<ActionResult> CambiarEstadoVehiculo(Guid vehiculoId, VehiculoEstado estado)
        {
            var vehiculo = await _vehiculoRepository.GetVehiculo(vehiculoId);

            if (vehiculo is null)
                return NotFound("Vehículo no encontrado");

            vehiculo.CambiarEstado(estado);

            await _context.SaveChangesAsync();

            return Ok();
        }

        /// <summary>
        /// Obtiene todas las sucursales.
        /// </summary>
        /// <returns>Lista de sucursales</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpGet("sucursales")]
        public async Task<ActionResult<List<Sucursal>>> GetSucursales()
        {
            var sucursales = await _enviosRepository.GetSucursales();
            await _context.SaveChangesAsync();
            return Ok(sucursales);
        }

        /// <summary>
        /// Registra una nueva sucursal.
        /// </summary>
        /// <param name="request">Datos de la sucursal</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("sucursales/registrar-sucursal")]
        public async Task<ActionResult> RegistrarSucursal([FromBody] RegistarSucursal request)
        {
            var sucursal = new Sucursal(
                request.Nombre,
                request.Direccion,
                request.Ciudad,
                request.Telefono
            );

            await _enviosRepository.Add(sucursal);

            await _context.SaveChangesAsync();

            return Ok();
        }


        /// <summary>
        /// Cambia el estado de un paquete.
        /// </summary>
        /// <param name="paqueteId">ID del paquete</param>
        /// <param name="status">Estado objetivo</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("cambiar-estado-paquete/{paqueteId:guid}/estado/{status}")]
        public async Task<ActionResult> CambiarEstadoPaquete(Guid paqueteId, PaqueteStatus status)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);

            if (paquete is null)
                return NotFound("Paquete no encontrado");

            try
            {
                // Usar los métodos del dominio que incluyen validaciones
                switch (status)
                {
                    case PaqueteStatus.EnTransito:
                        paquete.EnTransito();
                        break;
                    case PaqueteStatus.Entregado:
                        paquete.Entregar();
                        break;
                    case PaqueteStatus.Cancelado:
                        paquete.Cancelar("Cancelado desde el sistema");
                        break;
                    case PaqueteStatus.EnSucursal:
                        // Para volver a sucursal, usar reenvío si está cancelado
                        if (paquete.Status == PaqueteStatus.Cancelado)
                        {
                            paquete.ReEnviar();
                        }
                        else
                        {
                            return BadRequest("Transición de estado no válida");
                        }
                        break;
                    default:
                        return BadRequest("Estado no válido");
                }

                await _context.SaveChangesAsync();

                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Cancela un paquete existente.
        /// </summary>
        /// <param name="paqueteId">ID del paquete</param>
        /// <param name="request">Motivo de cancelación</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("cancelar-paquete/{paqueteId:guid}")]
        public async Task<ActionResult> CancelarPaquete(Guid paqueteId, [FromBody] CancelarPaqueteRequest request)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);

            if (paquete is null)
                return NotFound("Paquete no encontrado");

            try
            {
                var motivo = !string.IsNullOrWhiteSpace(request.Motivo)
                    ? request.Motivo
                    : "Cancelado desde el sistema";

                paquete.Cancelar(motivo);
                await _context.SaveChangesAsync();
                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Reenvía un paquete que se encontraba cancelado.
        /// </summary>
        /// <param name="paqueteId">ID del paquete</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("reenviar-paquete/{paqueteId:guid}")]
        public async Task<ActionResult> ReenviarPaquete(Guid paqueteId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId);

            if (paquete is null)
                return NotFound("Paquete no encontrado");
            try
            {
                paquete.ReEnviar();
                
                await _context.SaveChangesAsync();

                return Ok();
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        /// <summary>
        /// Marca un paquete como entregado en una ruta específica.
        /// </summary>
        /// <param name="rutaId">ID de la ruta</param>
        /// <param name="paqueteId">ID del paquete</param>
        /// <returns>Resultado de la operación</returns>
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status404NotFound)]
        [ProducesResponseType(StatusCodes.Status500InternalServerError)]
        [HttpPost("entregar-paquete/ruta/{rutaId:guid}/paquete/{paqueteId:guid}")]
        public async Task<ActionResult> EntregarPaquete(Guid rutaId, Guid paqueteId)
        {
            var ruta = await _rutasRepository.GetRutaById(rutaId);


            if (ruta is null)
                return NotFound();

            ruta.EntregarPaquete(paqueteId);

            await _context.SaveChangesAsync();

            return Ok();
        }
    }


    public class CancelarPaqueteRequest
    {
        public string Motivo { get; set; } = string.Empty;
    }

    public class RegistrarPaqueteRequest
    {
        public double Peso { get; set; }
        public string? Comentarios { get; set; }
        public RegistrarClienteRequest Remitente { get; set; }
        public RegistrarClienteRequest Destinatario { get; set; }
    }

    public class RegistrarClienteRequest
    {
        [Required]
        public string Direccion { get; set; } = string.Empty;
        [Required]
        public string Localidad { get; set; } = string.Empty;
        [Required]
        public string CP { get; set; } = string.Empty;
        [Required]
        public string Nombre { get; set; } = string.Empty;
        [Required]
        public string Apellido { get; set; } = string.Empty;
    }

    public class RegistrarVehiculoRequest
    {
        public string Patente { get; set; } = string.Empty;
        public string Modelo { get; set; } = string.Empty;
        public double Capacidad { get; set; }
    }

    public class RegistarSucursal
    {
        [Required]
        public string Nombre { get; set; } = string.Empty;
        [Required]
        public string Direccion { get; set; } = string.Empty;
        [Required]
        public string Ciudad { get; set; } = string.Empty;
        [Required]
        public string Telefono { get; set; } = string.Empty;

    }

    public class BusquedaDePaquetesRequest
    {
        public string? CodigoSeguimiento { get; set; }
        public string? Destinatario { get; set; }
    }
}