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
        private readonly EmailNotificacionService _emails;

        public PickUpOperacionController(
            LogiTrackDbContext context,
            HistorialEstadoEnvioService historial,
            PlanificacionTramosService tramos,
            EmailNotificacionService emails)
        {
            _context = context;
            _historial = historial;
            _tramos = tramos;
            _emails = emails;
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

            // Solo los físicamente almacenados cuentan para la capacidad
            var fisicamenteAlmacenados = paquetes.Count(p => p.Status == PaqueteStatus.ListoParaRetirar);
            var paqueteIds = paquetes.Select(p => p.Id).ToList();
            var hoyUtc = DateTime.UtcNow.Date;
            var entregadosHoy = await _context.HistorialEstadosEnvio.CountAsync(h =>
                paqueteIds.Contains(h.PaqueteId) &&
                h.EstadoNuevo == PaqueteStatus.Entregado &&
                h.FechaHora >= hoyUtc);

            // Fecha en que cada paquete entró en ListoParaRetirar (para calcular días almacenado)
            var listosIds = paquetes
                .Where(p => p.Status == PaqueteStatus.ListoParaRetirar)
                .Select(p => p.Id)
                .ToList();
            Dictionary<Guid, DateTime> fechasListoParaRetirar = new();
            if (listosIds.Count > 0)
            {
                fechasListoParaRetirar = await _context.HistorialEstadosEnvio
                    .Where(h => listosIds.Contains(h.PaqueteId) && h.EstadoNuevo == PaqueteStatus.ListoParaRetirar)
                    .GroupBy(h => h.PaqueteId)
                    .Select(g => new { PaqueteId = g.Key, Fecha = g.Max(h => h.FechaHora) })
                    .ToDictionaryAsync(x => x.PaqueteId, x => x.Fecha);
            }

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
                CapacidadUsada = fisicamenteAlmacenados,
                CapacidadLibre = Math.Max(0, punto.CapacidadDiaria - fisicamenteAlmacenados),
                PendienteRecepcion = paquetes.Count(p => p.Status == PaqueteStatus.EntregadoEnPunto),
                EnCamino = paquetes.Count(p => p.Status is PaqueteStatus.EnTransito or PaqueteStatus.Demorado or PaqueteStatus.EnTransitoDescanso),
                ListosParaRetirar = fisicamenteAlmacenados,
                EntregadosHoy = entregadosHoy,
                Paquetes = paquetes.Select(p =>
                    MapPaquete(p, fechasListoParaRetirar.TryGetValue(p.Id, out var f) ? f : null)).ToList(),
            });
        }

        [HttpPost("devolver")]
        public async Task<ActionResult<PickUpPaqueteResponse>> Devolver([FromBody] PickUpCodigoRequest request)
        {
            var socio = await CurrentSocioAsync();
            if (socio is null) return Forbid();

            var paquete = await BuscarPaqueteSocioAsync(socio.PuntoPickUpId, request.CodigoSeguimiento);
            if (paquete is null) return NotFound("Envio no encontrado para este punto Pick Up.");
            if (paquete.Status != PaqueteStatus.ListoParaRetirar)
                return BadRequest("Solo se puede gestionar devolución de envíos en estado Listo para retirar.");

            try
            {
                paquete.Cancelar("Devolucion por abandono en punto Pick Up");
                await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, socio.Id, OrigenCambioEstado.Manual, "Devolucion por abandono en punto Pick Up");
                await _context.SaveChangesAsync();
                return Ok(MapPaquete(paquete));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
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
                var repartidorId = paquete.RepartidorAsignadoId;
                var fechaRuta = paquete.FechaCalendarizada;
                if (paquete.Status is PaqueteStatus.EnTransito or PaqueteStatus.Demorado or PaqueteStatus.EnTransitoDescanso)
                {
                    paquete.EntregarEnPunto();
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.EntregadoEnPunto, socio.Id, OrigenCambioEstado.QR, "Deposito recibido en punto Pick Up");
                }
                paquete.MarcarListoParaRetirar();
                await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.ListoParaRetirar, socio.Id, OrigenCambioEstado.QR, "Recepcion en punto Pick Up");
                await TalvezMarcarRetornandoAsync(repartidorId, fechaRuta);
                await _context.SaveChangesAsync();
                var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == socio.PuntoPickUpId);
                await _emails.NotificarListoParaRetirarAsync(paquete, punto);
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

        private async Task TalvezMarcarRetornandoAsync(Guid? repartidorId, DateTime? fecha)
        {
            if (!repartidorId.HasValue || !fecha.HasValue) return;
            var dia = DateTime.SpecifyKind(fecha.Value.Date, DateTimeKind.Utc);
            var diaSiguiente = dia.AddDays(1);
            var paquetesDia = await _context.Paquetes
                .Where(p => p.RepartidorAsignadoId == repartidorId.Value
                            && p.FechaCalendarizada >= dia
                            && p.FechaCalendarizada < diaSiguiente)
                .ToListAsync();
            if (paquetesDia.Count == 0) return;
            var todasFinalizadas = paquetesDia.All(p =>
                p.Status == PaqueteStatus.Entregado
                || p.Status == PaqueteStatus.EntregadoEnPunto
                || p.Status == PaqueteStatus.ListoParaRetirar
                || p.Status == PaqueteStatus.Cancelado);
            if (!todasFinalizadas) return;

            var repartidor = await _context.Usuarios.OfType<Repartidor>().FirstOrDefaultAsync(u => u.Id == repartidorId.Value);
            if (repartidor?.EstadoJornada == Repartidor.EstadoJornadaRepartidor.EnRuta)
            {
                repartidor.MarcarRetornando();
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

        private static PickUpPaqueteResponse MapPaquete(Paquete p, DateTime? fechaListoParaRetirar = null) => new()
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
            FechaListoParaRetirar = fechaListoParaRetirar,
            DiasAlmacenado = fechaListoParaRetirar.HasValue
                ? (int)(DateTime.UtcNow - fechaListoParaRetirar.Value).TotalDays
                : null,
        };

        // AC3: Panel del socio — resumen de calificaciones del punto
        [HttpGet("calificaciones")]
        public async Task<ActionResult<ResumenCalificacionesResponse>> MisCalificaciones()
        {
            var socio = await CurrentSocioAsync();
            if (socio is null) return Forbid();

            var calificaciones = await _context.CalificacionesPickUp
                .Where(c => c.PuntoPickUpId == socio.PuntoPickUpId)
                .OrderByDescending(c => c.CreadoEn)
                .ToListAsync();

            if (calificaciones.Count == 0)
                return Ok(new ResumenCalificacionesResponse());

            var paqueteIds = calificaciones.Select(c => c.PaqueteId).ToList();
            var trackings = await _context.Paquetes
                .Where(p => paqueteIds.Contains(p.Id))
                .Select(p => new { p.Id, p.CodigoSeguimiento })
                .ToDictionaryAsync(p => p.Id, p => p.CodigoSeguimiento);

            var porEstrella = new int[5];
            foreach (var c in calificaciones)
                porEstrella[c.Estrellas - 1]++;

            return Ok(new ResumenCalificacionesResponse
            {
                Total = calificaciones.Count,
                Promedio = Math.Round(calificaciones.Average(c => c.Estrellas), 1),
                PorEstrella = porEstrella,
                Ultimas = calificaciones.Take(50).Select(c => new CalificacionPickUpResponse
                {
                    Id = c.Id,
                    Estrellas = c.Estrellas,
                    Comentario = c.Comentario,
                    AutorNombre = c.AutorNombre,
                    CreadoEn = c.CreadoEn,
                    TrackingCode = trackings.TryGetValue(c.PaqueteId, out var tc) ? tc : string.Empty,
                }).ToList(),
            });
        }

    [HttpPatch("configuracion")]
    public async Task<ActionResult> ActualizarConfiguracion([FromBody] ConfiguracionPickUpRequest request)
    {
        var socio = await CurrentSocioAsync();
        if (socio is null) return Forbid();

        var punto = await _context.PuntosPickUp.FirstOrDefaultAsync(p => p.Id == socio.PuntoPickUpId);
        if (punto is null) return NotFound("Punto Pick Up no encontrado.");

        try
        {
            punto.ActualizarHorariosYCapacidad(request.Horarios, request.CapacidadDiaria);
            await _context.SaveChangesAsync();
            return Ok(new { punto.Horarios, punto.CapacidadDiaria });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
    }

    public class ConfiguracionPickUpRequest
    {
        public string Horarios { get; set; } = string.Empty;
        public int CapacidadDiaria { get; set; }
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
        public int PendienteRecepcion { get; set; }
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
        public DateTime? FechaListoParaRetirar { get; set; }
        public int? DiasAlmacenado { get; set; }
    }

    public class CalificacionPickUpResponse
    {
        public Guid Id { get; set; }
        public int Estrellas { get; set; }
        public string? Comentario { get; set; }
        public string? AutorNombre { get; set; }
        public DateTime CreadoEn { get; set; }
        public string TrackingCode { get; set; } = string.Empty;
    }

    public class ResumenCalificacionesResponse
    {
        public double Promedio { get; set; }
        public int Total { get; set; }
        public int[] PorEstrella { get; set; } = new int[5];
        public List<CalificacionPickUpResponse> Ultimas { get; set; } = [];
    }
}
