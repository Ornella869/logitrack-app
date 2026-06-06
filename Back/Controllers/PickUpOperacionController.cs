using Back.Application.Common;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/pickup-operacion")]
    [Authorize(Roles = Roles.SocioPickUp)]
    public class PickUpOperacionController : ControllerBase
    {
        private readonly LogiTrackDbContext _context;
        private readonly HistorialEstadoEnvioService _historial;
        private readonly PlanificacionTramosService _tramos;

        public PickUpOperacionController(
            LogiTrackDbContext context,
            HistorialEstadoEnvioService historial,
            PlanificacionTramosService tramos)
        {
            _context = context;
            _historial = historial;
            _tramos = tramos;
        }

        private Guid? CurrentUserId()
        {
            var userIdStr = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(userIdStr, out var id) ? id : null;
        }

        private async Task<SocioPickUp?> CurrentSocioAsync()
        {
            var userId = CurrentUserId();
            if (userId is null) return null;
            return await _context.Usuarios.OfType<SocioPickUp>().FirstOrDefaultAsync(u => u.Id == userId.Value);
        }

        [HttpGet("inventario")]
        public async Task<ActionResult<PickUpInventarioResponse>> Inventario()
        {
            var socio = await CurrentSocioAsync();
            if (socio is null) return Forbid();

            var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == socio.PuntoPickUpId);
            if (punto is null) return NotFound("Punto Pick Up no encontrado.");

            var paquetes = await _context.Paquetes
                .Where(p => p.PuntoPickUpId == punto.Id)
                .OrderByDescending(p => p.CreadoEn)
                .Take(250)
                .ToListAsync();

            var activos = paquetes.Count(p => p.Status != PaqueteStatus.Entregado && p.Status != PaqueteStatus.Cancelado);
            var paqueteIds = paquetes.Select(p => p.Id).ToList();
            var hoyUtc = DateTime.UtcNow.Date;
            var entregadosHoy = await _context.HistorialEstadosEnvio.CountAsync(h =>
                paqueteIds.Contains(h.PaqueteId) &&
                h.EstadoNuevo == PaqueteStatus.Entregado &&
                h.FechaHora >= hoyUtc);
            return Ok(new PickUpInventarioResponse
            {
                Punto = new PickUpPuntoResponse
                {
                    Id = punto.Id,
                    Nombre = punto.Nombre,
                    Direccion = punto.Direccion,
                    Localidad = punto.Localidad,
                    Provincia = punto.Provincia,
                    Horarios = punto.Horarios,
                    CapacidadDiaria = punto.CapacidadDiaria,
                    Activo = punto.Activo,
                },
                CapacidadUsada = activos,
                CapacidadLibre = Math.Max(0, punto.CapacidadDiaria - activos),
                EnCamino = paquetes.Count(p => p.Status is PaqueteStatus.EnTransito or PaqueteStatus.Demorado),
                ListosParaRetirar = paquetes.Count(p => p.Status == PaqueteStatus.ListoParaRetirar),
                EntregadosHoy = entregadosHoy,
                Paquetes = paquetes.Select(MapPaquete).ToList(),
            });
        }

        [HttpPost("recibir")]
        public async Task<ActionResult<PickUpPaqueteResponse>> Recibir([FromBody] PickUpCodigoRequest request)
        {
            var socio = await CurrentSocioAsync();
            if (socio is null) return Forbid();

            var paquete = await BuscarPaqueteSocioAsync(socio.PuntoPickUpId, request.CodigoSeguimiento);
            if (paquete is null) return NotFound("Envio no encontrado para este punto Pick Up.");

            try
            {
                paquete.MarcarListoParaRetirar();
                await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.ListoParaRetirar, socio.Id, OrigenCambioEstado.QR, "Recepcion en punto Pick Up");
                await _context.SaveChangesAsync();
                return Ok(MapPaquete(paquete));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("entregar")]
        public async Task<ActionResult<PickUpPaqueteResponse>> Entregar([FromBody] PickUpEntregaRequest request)
        {
            var socio = await CurrentSocioAsync();
            if (socio is null) return Forbid();

            var paquete = await BuscarPaqueteSocioAsync(socio.PuntoPickUpId, request.CodigoSeguimiento);
            if (paquete is null) return NotFound("Envio no encontrado para este punto Pick Up.");
            if (paquete.Status != PaqueteStatus.ListoParaRetirar)
                return BadRequest("El envio todavia no esta listo para retirar.");
            if (!string.Equals(paquete.CodigoEntrega, request.CodigoEntrega?.Trim(), StringComparison.Ordinal))
                return BadRequest("El codigo de entrega no coincide.");

            try
            {
                paquete.Entregar();
                await _tramos.SincronizarEntregaAsync(paquete);
                await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Entregado, socio.Id, OrigenCambioEstado.Manual, "Entrega en punto Pick Up");
                await _context.SaveChangesAsync();
                return Ok(MapPaquete(paquete));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private async Task<Paquete?> BuscarPaqueteSocioAsync(Guid puntoPickUpId, string codigoSeguimiento)
        {
            var codigo = codigoSeguimiento?.Trim();
            if (string.IsNullOrWhiteSpace(codigo)) return null;
            return await _context.Paquetes.FirstOrDefaultAsync(p =>
                p.PuntoPickUpId == puntoPickUpId &&
                p.CodigoSeguimiento == codigo);
        }

        private static PickUpPaqueteResponse MapPaquete(Paquete p) => new()
        {
            Id = p.Id,
            CodigoSeguimiento = p.CodigoSeguimiento,
            CodigoEntrega = p.CodigoEntrega,
            Status = p.Status,
            Destinatario = $"{p.Destinatario.Nombre} {p.Destinatario.Apellido}".Trim(),
            Telefono = p.Destinatario.Telefono,
            Email = p.Destinatario.Email,
            Direccion = p.Destinatario.Direccion.Calle,
            Localidad = p.Destinatario.Direccion.Ciudad,
            CodigoPostal = p.Destinatario.Direccion.CP,
            Provincia = p.ProvinciaDestino ?? p.Destinatario.Direccion.Provincia,
            Peso = p.Peso,
            CreadoEn = p.CreadoEn,
            FechaEstimadaEntrega = p.FechaEstimadaEntrega,
        };
    }

    public class PickUpCodigoRequest
    {
        public string CodigoSeguimiento { get; set; } = string.Empty;
    }

    public class PickUpEntregaRequest : PickUpCodigoRequest
    {
        public string CodigoEntrega { get; set; } = string.Empty;
    }

    public class PickUpInventarioResponse
    {
        public PickUpPuntoResponse Punto { get; set; } = new();
        public int CapacidadUsada { get; set; }
        public int CapacidadLibre { get; set; }
        public int EnCamino { get; set; }
        public int ListosParaRetirar { get; set; }
        public int EntregadosHoy { get; set; }
        public List<PickUpPaqueteResponse> Paquetes { get; set; } = new();
    }

    public class PickUpPuntoResponse
    {
        public Guid Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string Direccion { get; set; } = string.Empty;
        public string Localidad { get; set; } = string.Empty;
        public string Provincia { get; set; } = string.Empty;
        public string Horarios { get; set; } = string.Empty;
        public int CapacidadDiaria { get; set; }
        public bool Activo { get; set; }
    }

    public class PickUpPaqueteResponse
    {
        public Guid Id { get; set; }
        public string CodigoSeguimiento { get; set; } = string.Empty;
        public string CodigoEntrega { get; set; } = string.Empty;
        public PaqueteStatus Status { get; set; }
        public string Destinatario { get; set; } = string.Empty;
        public string? Telefono { get; set; }
        public string? Email { get; set; }
        public string Direccion { get; set; } = string.Empty;
        public string Localidad { get; set; } = string.Empty;
        public string CodigoPostal { get; set; } = string.Empty;
        public string? Provincia { get; set; }
        public double Peso { get; set; }
        public DateTime CreadoEn { get; set; }
        public DateTime? FechaEstimadaEntrega { get; set; }
    }
}
