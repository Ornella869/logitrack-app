using Back.Application.Common;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/plantillas-email")]
    [Authorize(Roles = Roles.Gerente)]
    public class PlantillasEmailController : ControllerBase
    {
        private readonly LogiTrackDbContext _context;

        private static readonly HashSet<string> VariablesSoportadas = new(StringComparer.OrdinalIgnoreCase)
        {
            "{{tracking}}", "{{destinatario}}", "{{estado}}", "{{nombre}}",
            "{{codigoEntrega}}", "{{fecha}}", "{{provincia}}"
        };

        private static readonly Dictionary<EventoEmailNotificacion, (string Nombre, string AsuntoPorDefecto, string DescripcionVariables)> MetadataEventos = new()
        {
            [EventoEmailNotificacion.SalidaRuta]        = ("Salida a ruta",          "Tu envío {{tracking}} salió a ruta",            "{{tracking}}, {{destinatario}}, {{nombre}}, {{estado}}, {{fecha}}"),
            [EventoEmailNotificacion.EntregaConfirmada] = ("Entrega confirmada",      "Tu envío {{tracking}} fue entregado",           "{{tracking}}, {{destinatario}}, {{nombre}}, {{estado}}"),
            [EventoEmailNotificacion.CodigoEntrega]     = ("Código de entrega",       "Código de entrega para tu envío {{tracking}}", "{{tracking}}, {{destinatario}}, {{nombre}}, {{codigoEntrega}}"),
            [EventoEmailNotificacion.CargadoEnVehiculo] = ("Cargado en vehículo",     "Tu envío {{tracking}} fue cargado al vehículo", "{{tracking}}, {{destinatario}}, {{nombre}}, {{estado}}"),
            [EventoEmailNotificacion.Demorado]          = ("Demorado",                "Tu envío {{tracking}} está demorado",           "{{tracking}}, {{destinatario}}, {{nombre}}, {{estado}}"),
            [EventoEmailNotificacion.Cancelado]         = ("Cancelado",               "Tu envío {{tracking}} fue cancelado",           "{{tracking}}, {{destinatario}}, {{nombre}}, {{estado}}"),
            [EventoEmailNotificacion.EncuestaPostEntrega]= ("Encuesta post-entrega",  "Contanos cómo fue tu entrega {{tracking}}",     "{{tracking}}, {{destinatario}}, {{nombre}}"),
            [EventoEmailNotificacion.ListoParaRetirar]  = ("Listo para retirar (PickUp)", "Tu envío {{tracking}} está listo en el punto Pick Up", "{{tracking}}, {{destinatario}}, {{nombre}}, {{codigoEntrega}}, {{provincia}}"),
        };

        public PlantillasEmailController(LogiTrackDbContext context)
        {
            _context = context;
        }

        private Guid? CurrentUserId()
        {
            var s = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            return Guid.TryParse(s, out var id) ? id : null;
        }

        private async Task<string?> GetProvinciaAsync()
        {
            var userId = CurrentUserId();
            if (userId is null) return null;
            var gp = await _context.GerentesProvincias.FirstOrDefaultAsync(g => g.GerenteId == userId.Value);
            return gp?.Provincia;
        }

        [HttpGet]
        public async Task<ActionResult<List<PlantillaEmailResponse>>> Listar()
        {
            var provincia = await GetProvinciaAsync();
            if (provincia is null) return Forbid();

            var existentes = await _context.PlantillasEmail
                .Where(p => p.Provincia == provincia)
                .ToListAsync();

            var resultado = MetadataEventos.Select(kv =>
            {
                var personalizada = existentes.FirstOrDefault(e => e.Evento == kv.Key);
                return new PlantillaEmailResponse
                {
                    Id = personalizada?.Id,
                    Provincia = provincia,
                    Evento = (int)kv.Key,
                    EventoNombre = kv.Value.Nombre,
                    Asunto = personalizada?.Asunto ?? kv.Value.AsuntoPorDefecto,
                    Cuerpo = personalizada?.Cuerpo ?? string.Empty,
                    VariablesDisponibles = kv.Value.DescripcionVariables,
                    EsPersonalizada = personalizada is not null,
                    ModificadoEn = personalizada?.ModificadoEn,
                };
            }).ToList();

            return Ok(resultado);
        }

        [HttpGet("{evento:int}")]
        public async Task<ActionResult<PlantillaEmailResponse>> Obtener(int evento)
        {
            if (!Enum.IsDefined(typeof(EventoEmailNotificacion), evento))
                return NotFound("Evento no reconocido.");

            var eventoEnum = (EventoEmailNotificacion)evento;
            if (!MetadataEventos.TryGetValue(eventoEnum, out var meta))
                return NotFound("Evento no editable.");

            var provincia = await GetProvinciaAsync();
            if (provincia is null) return Forbid();

            var existente = await _context.PlantillasEmail
                .FirstOrDefaultAsync(p => p.Provincia == provincia && p.Evento == eventoEnum);

            return Ok(new PlantillaEmailResponse
            {
                Id = existente?.Id,
                Provincia = provincia,
                Evento = evento,
                EventoNombre = meta.Nombre,
                Asunto = existente?.Asunto ?? meta.AsuntoPorDefecto,
                Cuerpo = existente?.Cuerpo ?? string.Empty,
                VariablesDisponibles = meta.DescripcionVariables,
                EsPersonalizada = existente is not null,
                ModificadoEn = existente?.ModificadoEn,
            });
        }

        [HttpPut("{evento:int}")]
        public async Task<ActionResult<PlantillaEmailResponse>> Guardar(int evento, [FromBody] PlantillaEmailRequest request)
        {
            if (!Enum.IsDefined(typeof(EventoEmailNotificacion), evento))
                return NotFound("Evento no reconocido.");

            var eventoEnum = (EventoEmailNotificacion)evento;
            if (!MetadataEventos.TryGetValue(eventoEnum, out var meta))
                return NotFound("Evento no editable.");

            if (string.IsNullOrWhiteSpace(request.Asunto))
                return BadRequest("El asunto no puede estar vacío.");

            if (string.IsNullOrWhiteSpace(request.Cuerpo))
                return BadRequest("El cuerpo no puede estar vacío.");

            var erroresVariables = ValidarVariables(request.Asunto + " " + request.Cuerpo);
            if (erroresVariables.Count > 0)
                return BadRequest(new { mensaje = "Variables inválidas detectadas.", variables = erroresVariables, soportadas = VariablesSoportadas });

            var userId = CurrentUserId();
            if (userId is null) return Forbid();

            var provincia = await GetProvinciaAsync();
            if (provincia is null) return Forbid();

            var existente = await _context.PlantillasEmail
                .FirstOrDefaultAsync(p => p.Provincia == provincia && p.Evento == eventoEnum);

            if (existente is null)
            {
                existente = new PlantillaEmail(provincia, eventoEnum, request.Asunto.Trim(), request.Cuerpo.Trim(), userId.Value);
                _context.PlantillasEmail.Add(existente);
            }
            else
            {
                existente.Actualizar(request.Asunto.Trim(), request.Cuerpo.Trim(), userId.Value);
            }

            await _context.SaveChangesAsync();

            return Ok(new PlantillaEmailResponse
            {
                Id = existente.Id,
                Provincia = provincia,
                Evento = evento,
                EventoNombre = meta.Nombre,
                Asunto = existente.Asunto,
                Cuerpo = existente.Cuerpo,
                VariablesDisponibles = meta.DescripcionVariables,
                EsPersonalizada = true,
                ModificadoEn = existente.ModificadoEn,
            });
        }

        [HttpDelete("{evento:int}")]
        public async Task<IActionResult> Restaurar(int evento)
        {
            if (!Enum.IsDefined(typeof(EventoEmailNotificacion), evento))
                return NotFound();

            var eventoEnum = (EventoEmailNotificacion)evento;
            var provincia = await GetProvinciaAsync();
            if (provincia is null) return Forbid();

            var existente = await _context.PlantillasEmail
                .FirstOrDefaultAsync(p => p.Provincia == provincia && p.Evento == eventoEnum);

            if (existente is not null)
            {
                _context.PlantillasEmail.Remove(existente);
                await _context.SaveChangesAsync();
            }

            return NoContent();
        }

        private static List<string> ValidarVariables(string texto)
        {
            var invalidas = new List<string>();
            var idx = 0;
            while (true)
            {
                var start = texto.IndexOf("{{", idx, StringComparison.Ordinal);
                if (start < 0) break;
                var end = texto.IndexOf("}}", start, StringComparison.Ordinal);
                if (end < 0) break;
                var variable = texto.Substring(start, end - start + 2);
                if (!VariablesSoportadas.Contains(variable))
                    invalidas.Add(variable);
                idx = end + 2;
            }
            return invalidas;
        }
    }

    public class PlantillaEmailRequest
    {
        public string Asunto { get; set; } = string.Empty;
        public string Cuerpo { get; set; } = string.Empty;
    }

    public class PlantillaEmailResponse
    {
        public Guid? Id { get; set; }
        public string Provincia { get; set; } = string.Empty;
        public int Evento { get; set; }
        public string EventoNombre { get; set; } = string.Empty;
        public string Asunto { get; set; } = string.Empty;
        public string Cuerpo { get; set; } = string.Empty;
        public string VariablesDisponibles { get; set; } = string.Empty;
        public bool EsPersonalizada { get; set; }
        public DateTime? ModificadoEn { get; set; }
    }
}
