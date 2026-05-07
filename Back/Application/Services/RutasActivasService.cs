using Back.Domain.Models;
using Back.Domain.Repositories;

namespace Back.Application.Services
{
    public class RutaActivaItem
    {
        public required Guid RepartidorId { get; init; }
        public required string RepartidorNombre { get; init; }
        public required string RepartidorEmail { get; init; }
        public required DateTime Fecha { get; init; }
        public required string CpZona { get; init; } // CP más frecuente entre las paradas
        public required int TotalParadas { get; init; }
        public required int Entregadas { get; init; }
        public required int Canceladas { get; init; }
        public required double PesoTotal { get; init; }
        public required string Estado { get; init; } // EnTransito | ListoParaSalir | Completada | Demorada
        public required bool EsDemorada { get; init; }
    }

    public class DetalleRutaResponse
    {
        public required Guid RepartidorId { get; init; }
        public required string RepartidorNombre { get; init; }
        public required string RepartidorEmail { get; init; }
        public required DateTime Fecha { get; init; }
        public required List<DetalleRutaParada> Paradas { get; init; }
    }

    public class DetalleRutaParada
    {
        public required Guid PaqueteId { get; init; }
        public required string CodigoSeguimiento { get; init; }
        public required int Orden { get; init; }
        public required string Direccion { get; init; }
        public required string Localidad { get; init; }
        public required string CodigoPostal { get; init; }
        public required string Destinatario { get; init; }
        public required string? Telefono { get; init; }
        public required double Peso { get; init; }
        public required string TipoEnvio { get; init; }
        public required string Status { get; init; }
        public required bool EsPrioritario { get; init; }
        public required string? Observaciones { get; init; }
    }

    public class RutasActivasService
    {
        private readonly IEnviosRepository _enviosRepository;
        private readonly IUserRepository _userRepository;

        public RutasActivasService(IEnviosRepository enviosRepository, IUserRepository userRepository)
        {
            _enviosRepository = enviosRepository;
            _userRepository = userRepository;
        }

        public async Task<List<RutaActivaItem>> GetRutasDeHoyAsync()
        {
            var hoy = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
            var manana = hoy.AddDays(1);
            var asignados = await _enviosRepository.GetPaquetesConAsignacionActiva();
            var paquetesHoy = asignados
                .Where(p => p.FechaCalendarizada >= hoy && p.FechaCalendarizada < manana)
                .ToList();

            // Incluir también los Entregados/Cancelados de hoy (para el contador)
            // (no vienen en GetPaquetesConAsignacionActiva, así que armamos el cuadro general)
            var repartidoresIds = paquetesHoy.Select(p => p.RepartidorAsignadoId!.Value).Distinct().ToList();

            var repartidoresAll = await _userRepository.GetRepartidores();
            var repIndex = repartidoresAll.ToDictionary(r => r.Id);

            var ahora = DateTime.UtcNow;
            var pasoMediodia = ahora.Hour >= 12;

            var items = paquetesHoy
                .GroupBy(p => p.RepartidorAsignadoId!.Value)
                .Select(g =>
                {
                    repIndex.TryGetValue(g.Key, out var rep);
                    var totalParadas = g.Count();
                    var entregadas = g.Count(p => p.Status == PaqueteStatus.Entregado);
                    var canceladas = g.Count(p => p.Status == PaqueteStatus.Cancelado);
                    var enTransito = g.Any(p => p.Status == PaqueteStatus.EnTransito);
                    var pesoTotal = g.Sum(p => p.Peso);
                    var cpMasComun = g
                        .GroupBy(p => p.Destinatario.Direccion.CP)
                        .OrderByDescending(c => c.Count())
                        .First()
                        .Key;

                    var avancePct = totalParadas > 0 ? ((double)(entregadas + canceladas) / totalParadas) * 100 : 0;
                    var demorada = pasoMediodia && enTransito && avancePct < 50;
                    var completada = totalParadas > 0 && (entregadas + canceladas) == totalParadas;
                    var estado = completada
                        ? "Completada"
                        : demorada
                            ? "Demorada"
                            : enTransito
                                ? "EnTransito"
                                : "ListoParaSalir";

                    return new RutaActivaItem
                    {
                        RepartidorId = g.Key,
                        RepartidorNombre = rep is null ? "(desconocido)" : $"{rep.Nombre} {rep.Apellido}",
                        RepartidorEmail = rep?.Email ?? "",
                        Fecha = hoy,
                        CpZona = cpMasComun,
                        TotalParadas = totalParadas,
                        Entregadas = entregadas,
                        Canceladas = canceladas,
                        PesoTotal = pesoTotal,
                        Estado = estado,
                        EsDemorada = demorada,
                    };
                })
                .OrderBy(r => r.RepartidorNombre)
                .ToList();

            return items;
        }

        public async Task<DetalleRutaResponse?> GetDetalleRutaAsync(Guid repartidorId, DateTime fecha)
        {
            var rep = await _userRepository.GetUsuarioById(repartidorId) as Repartidor;
            if (rep is null) return null;

            var paquetes = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(repartidorId, fecha);

            return new DetalleRutaResponse
            {
                RepartidorId = rep.Id,
                RepartidorNombre = $"{rep.Nombre} {rep.Apellido}",
                RepartidorEmail = rep.Email,
                Fecha = DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc),
                Paradas = paquetes.Select((p, idx) => new DetalleRutaParada
                {
                    PaqueteId = p.Id,
                    CodigoSeguimiento = p.CodigoSeguimiento,
                    Orden = idx + 1,
                    Direccion = p.Destinatario.Direccion.Calle,
                    Localidad = p.Destinatario.Direccion.Ciudad,
                    CodigoPostal = p.Destinatario.Direccion.CP,
                    Destinatario = $"{p.Destinatario.Nombre} {p.Destinatario.Apellido}",
                    Telefono = p.Destinatario.Telefono,
                    Peso = p.Peso,
                    TipoEnvio = p.TipoEnvio.ToString(),
                    Status = p.Status.ToString(),
                    EsPrioritario = p.TipoEnvio == TipoEnvio.Prioritario,
                    Observaciones = p.Descripcion,
                }).ToList(),
            };
        }
    }
}
