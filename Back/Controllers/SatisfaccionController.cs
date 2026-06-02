using Back.Domain.Models;
using Back.Infrastructure.Database;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Back.Controllers
{
    [ApiController]
    [Route("api/encuesta")]
    [AllowAnonymous]
    public class SatisfaccionController : ControllerBase
    {
        private readonly LogiTrackDbContext _context;

        public SatisfaccionController(LogiTrackDbContext context)
        {
            _context = context;
        }

        [HttpGet("{token:guid}")]
        public async Task<IActionResult> GetEncuesta(Guid token)
        {
            var encuesta = await _context.SatisfaccionEncuestas
                .Include(e => e.Paquete)
                .FirstOrDefaultAsync(e => e.Token == token);

            if (encuesta == null) return NotFound();

            return Ok(new
            {
                paqueteCodigo = encuesta.Paquete.CodigoSeguimiento,
                destinatarioNombre = encuesta.Paquete.Destinatario.Nombre,
                yaRespondida = encuesta.RespuestaEn.HasValue,
                calificacion = encuesta.Calificacion,
                comentario = encuesta.Comentario,
            });
        }

        [HttpPost("{token:guid}")]
        public async Task<IActionResult> ResponderEncuesta(Guid token, [FromBody] ResponderEncuestaRequest request)
        {
            var encuesta = await _context.SatisfaccionEncuestas.FirstOrDefaultAsync(e => e.Token == token);
            if (encuesta == null) return NotFound();

            try
            {
                encuesta.Responder(request.Calificacion, request.Comentario);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(new { error = ex.Message });
            }

            await _context.SaveChangesAsync();
            return Ok();
        }
    }

    public class ResponderEncuestaRequest
    {
        public int Calificacion { get; set; }
        public string? Comentario { get; set; }
    }
}
