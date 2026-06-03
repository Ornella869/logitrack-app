using System.ComponentModel.DataAnnotations;
using Back.Application.Services;
using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
        private readonly EmailNotificacionService _emails;

        public LeadsController(LogiTrackDbContext context, EmailNotificacionService emails)
        {
            _context = context;
            _emails = emails;
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

            var emailNorm = request.Email.Trim().ToLowerInvariant();
            var existente = await _context.SolicitudesComerciales
                .FirstOrDefaultAsync(s => s.Email == emailNorm);

            if (existente != null)
            {
                existente.RefrescarInteres();
                await _emails.CrearEmailLeadAsync(existente);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Ya teníamos tu contacto registrado. Te reenviamos la información." });
            }

            var lead = new SolicitudComercial(
                request.NombreEmpresa,
                request.NombreContacto,
                request.Email,
                request.Telefono,
                plan,
                request.Comentarios);

            _context.SolicitudesComerciales.Add(lead);
            await _emails.CrearEmailLeadAsync(lead);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Recibimos tu solicitud. Te contactaremos a la brevedad" });
        }

        [HttpPost("email")]
        [ProducesResponseType(StatusCodes.Status200OK)]
        [ProducesResponseType(StatusCodes.Status400BadRequest)]
        public async Task<ActionResult> RegistrarEmailInteres([FromBody] EmailInteresRequest request)
        {
            var emailNorm = request.Email.Trim().ToLowerInvariant();
            var existente = await _context.SolicitudesComerciales
                .FirstOrDefaultAsync(s => s.Email == emailNorm);

            if (existente != null)
            {
                existente.RefrescarInteres();
                await _emails.CrearEmailLeadAsync(existente);
                await _context.SaveChangesAsync();
                return Ok(new { message = "Ya teníamos tu contacto. Te reenviamos información sobre nuestros planes." });
            }

            var lead = new SolicitudComercial("-", "-", request.Email, "-", "General", null);
            _context.SolicitudesComerciales.Add(lead);
            await _emails.CrearEmailLeadAsync(lead);
            await _context.SaveChangesAsync();

            return Ok(new { message = "¡Listo! Te enviamos información sobre nuestros planes al correo indicado." });
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
        [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
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

    public class EmailInteresRequest
    {
        [Required(ErrorMessage = "El email es obligatorio.")]
        [EmailAddress(ErrorMessage = "El formato del email no es válido.")]
        [MaxLength(160)]
        public string Email { get; set; } = string.Empty;
    }
}
