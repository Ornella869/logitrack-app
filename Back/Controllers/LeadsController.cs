using System.ComponentModel.DataAnnotations;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/leads")]
    public class LeadsController : ControllerBase
    {
        private static readonly HashSet<string> PlanesValidos = new(StringComparer.OrdinalIgnoreCase)
        {
            "Basico",
            "Premium",
        };

        private readonly LogiTrackDbContext _context;

        public LeadsController(LogiTrackDbContext context)
        {
            _context = context;
        }

        [HttpPost]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult> CrearSolicitud([FromBody] CrearLeadRequest request)
        {
            var plan = request.PlanInteres.Trim();

            if (!PlanesValidos.Contains(plan))
            {
                return BadRequest("El plan de interés debe ser Básico o Premium.");
            }

            var lead = new SolicitudComercial(
                request.NombreEmpresa,
                request.NombreContacto,
                request.Email,
                request.Telefono,
                plan,
                request.Comentarios);

            _context.SolicitudesComerciales.Add(lead);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Recibimos tu solicitud. Te contactaremos a la brevedad",
            });
        }
    }

    public class CrearLeadRequest
    {
        [Required]
        [MaxLength(160)]
        public string NombreEmpresa { get; set; } = string.Empty;

        [Required]
        [MaxLength(160)]
        public string NombreContacto { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(160)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string Telefono { get; set; } = string.Empty;

        [Required]
        [MaxLength(80)]
        public string PlanInteres { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? Comentarios { get; set; }
    }
}
