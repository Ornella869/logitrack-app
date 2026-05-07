using Back.Application.Common;
using Back.Domain.Models;
using Back.Domain.Repositories;

namespace Back.Application.Services
{
    public class CalendarizacionResultado
    {
        public required int TotalPendientes { get; init; }
        public required int TotalCalendarizados { get; init; }
        public required int TotalSinAsignar { get; init; }
        public required List<DiaResumen> ResumenPorDia { get; init; }
    }

    public class DiaResumen
    {
        public required DateTime Fecha { get; init; }
        public required int Cantidad { get; init; }
        public required List<RepartidorResumen> Repartidores { get; init; }
    }

    public class RepartidorResumen
    {
        public required Guid RepartidorId { get; init; }
        public required string Nombre { get; init; }
        public required string Email { get; init; }
        public required int Cantidad { get; init; }
        public required double PesoTotal { get; init; }
    }

    public class CalendarioCelda
    {
        public required Guid RepartidorId { get; init; }
        public required string RepartidorNombre { get; init; }
        public required DateTime Fecha { get; init; }
        public required List<CalendarioPaquete> Paquetes { get; init; }
        public required double PesoTotal { get; init; }
    }

    public class CalendarioPaquete
    {
        public required Guid PaqueteId { get; init; }
        public required string CodigoSeguimiento { get; init; }
        public required string CpDestino { get; init; }
        public required double Peso { get; init; }
        public required bool EsPrioritario { get; init; }
        public required string Status { get; init; }
    }

    public class CalendarioOperativo
    {
        public required List<DateTime> Dias { get; init; }
        public required List<CalendarioRepartidor> Repartidores { get; init; }
    }

    public class CalendarioRepartidor
    {
        public required Guid RepartidorId { get; init; }
        public required string Nombre { get; init; }
        public required string Email { get; init; }
        public required List<CalendarioCelda> Celdas { get; init; }
    }

    public class CalendarizacionService
    {
        private const int MaxDiasParaProgramar = 30;

        private readonly IEnviosRepository _enviosRepository;
        private readonly IUserRepository _userRepository;
        private readonly HistorialEstadoEnvioService _historial;
        private readonly AuditoriaService _auditoria;

        public CalendarizacionService(
            IEnviosRepository enviosRepository,
            IUserRepository userRepository,
            HistorialEstadoEnvioService historial,
            AuditoriaService auditoria)
        {
            _enviosRepository = enviosRepository;
            _userRepository = userRepository;
            _historial = historial;
            _auditoria = auditoria;
        }

        public async Task<int> ContarPendientesAsync()
        {
            var pendientes = await _enviosRepository.GetPaquetesPendientesDeCalendarizacion();
            return pendientes.Count;
        }

        public async Task<CalendarioOperativo> GetCalendarioOperativoAsync(int dias = 14)
        {
            var hoy = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
            var diasList = Enumerable.Range(0, dias).Select(i => hoy.AddDays(i)).ToList();

            var repartidores = (await _userRepository.GetRepartidores())
                .Where(r => r.Activo && r.PuedeSerAsignado)
                .OrderBy(r => r.Nombre)
                .ToList();

            var asignados = await _enviosRepository.GetPaquetesConAsignacionActiva();

            var paquetesPorRepartidorYDia = asignados
                .Where(p => p.FechaCalendarizada.HasValue && p.RepartidorAsignadoId.HasValue)
                .GroupBy(p => (p.RepartidorAsignadoId!.Value, p.FechaCalendarizada!.Value.Date))
                .ToDictionary(g => g.Key, g => g.ToList());

            var calendarioReps = repartidores.Select(r =>
            {
                var celdas = diasList.Select(d =>
                {
                    var key = (r.Id, d);
                    paquetesPorRepartidorYDia.TryGetValue(key, out var pks);
                    pks ??= new List<Paquete>();
                    return new CalendarioCelda
                    {
                        RepartidorId = r.Id,
                        RepartidorNombre = $"{r.Nombre} {r.Apellido}",
                        Fecha = d,
                        PesoTotal = pks.Sum(p => p.Peso),
                        Paquetes = pks.Select(p => new CalendarioPaquete
                        {
                            PaqueteId = p.Id,
                            CodigoSeguimiento = p.CodigoSeguimiento,
                            CpDestino = p.Destinatario.Direccion.CP,
                            Peso = p.Peso,
                            EsPrioritario = p.TipoEnvio == TipoEnvio.Prioritario,
                            Status = p.Status.ToString(),
                        }).ToList(),
                    };
                }).ToList();

                return new CalendarioRepartidor
                {
                    RepartidorId = r.Id,
                    Nombre = $"{r.Nombre} {r.Apellido}",
                    Email = r.Email,
                    Celdas = celdas,
                };
            }).ToList();

            return new CalendarioOperativo
            {
                Dias = diasList,
                Repartidores = calendarioReps,
            };
        }

        public async Task<List<DiaResumen>> GetEstadoActualAsync()
        {
            var asignados = await _enviosRepository.GetPaquetesConAsignacionActiva();
            if (asignados.Count == 0) return new List<DiaResumen>();

            var repartidores = await _userRepository.GetRepartidores();
            var repIndex = repartidores.ToDictionary(r => r.Id);

            return asignados
                .GroupBy(p => p.FechaCalendarizada!.Value.Date)
                .OrderBy(g => g.Key)
                .Select(g => new DiaResumen
                {
                    Fecha = g.Key,
                    Cantidad = g.Count(),
                    Repartidores = g
                        .GroupBy(p => p.RepartidorAsignadoId!.Value)
                        .Select(rg =>
                        {
                            repIndex.TryGetValue(rg.Key, out var rep);
                            return new RepartidorResumen
                            {
                                RepartidorId = rg.Key,
                                Nombre = rep is null ? "(repartidor desconocido)" : $"{rep.Nombre} {rep.Apellido}",
                                Email = rep?.Email ?? "",
                                Cantidad = rg.Count(),
                                PesoTotal = rg.Sum(p => p.Peso),
                            };
                        })
                        .OrderBy(r => r.Nombre)
                        .ToList(),
                })
                .ToList();
        }

        public async Task<CalendarizacionResultado> EjecutarAsync(Guid? supervisorId)
        {
            var pendientes = await _enviosRepository.GetPaquetesPendientesDeCalendarizacion();

            if (pendientes.Count == 0)
            {
                return new CalendarizacionResultado
                {
                    TotalPendientes = 0,
                    TotalCalendarizados = 0,
                    TotalSinAsignar = 0,
                    ResumenPorDia = new List<DiaResumen>(),
                };
            }

            var repartidores = (await _userRepository.GetRepartidores())
                .Where(r => r.Activo && r.PuedeSerAsignado)
                .ToList();

            if (repartidores.Count == 0)
                throw new InvalidOperationException("No hay repartidores activos disponibles.");

            // Orden requerido: Prioritarios primero, luego Comunes; ambos por orden de creación.
            var cola = pendientes
                .OrderByDescending(p => p.TipoEnvio == TipoEnvio.Prioritario)
                .ThenBy(p => p.CreadoEn)
                .ToList();

            // Carga acumulada en memoria por (repartidor, día).
            var carga = new Dictionary<(Guid repartidorId, DateTime fecha), List<Paquete>>();
            var hoy = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);

            int sinAsignar = 0;

            foreach (var paquete in cola)
            {
                bool asignado = false;

                for (int offset = 1; offset <= MaxDiasParaProgramar && !asignado; offset++)
                {
                    var fecha = hoy.AddDays(offset);

                    // 1) Buscar primer repartidor LIBRE ese día.
                    var libre = repartidores.FirstOrDefault(r =>
                        !carga.ContainsKey((r.Id, fecha)) || carga[(r.Id, fecha)].Count == 0);

                    if (libre is not null)
                    {
                        AsignarEnMemoria(carga, libre.Id, fecha, paquete);
                        paquete.AsignarParaCalendarizacion(libre.Id, fecha);
                        asignado = true;
                        break;
                    }

                    // 2) Buscar repartidor con CP coincidente y capacidad disponible.
                    var cpDestino = paquete.Destinatario.Direccion.CP;
                    var matchCp = repartidores.FirstOrDefault(r =>
                    {
                        if (!carga.TryGetValue((r.Id, fecha), out var lista) || lista.Count == 0)
                            return false;

                        var coincide = lista.Any(p => p.Destinatario.Direccion.CP == cpDestino);
                        var pesoActual = lista.Sum(p => p.Peso);
                        return coincide && (pesoActual + paquete.Peso) <= Capacidad.RepartidorKg;
                    });

                    if (matchCp is not null)
                    {
                        AsignarEnMemoria(carga, matchCp.Id, fecha, paquete);
                        paquete.AsignarParaCalendarizacion(matchCp.Id, fecha);
                        asignado = true;
                        break;
                    }
                }

                if (!asignado)
                {
                    sinAsignar++;
                    continue;
                }

                await _historial.RegistrarCambioAsync(
                    paquete.Id,
                    paquete.Status,
                    supervisorId,
                    OrigenCambioEstado.Sistema,
                    "Calendarización automática");
            }

            var resumen = carga
                .GroupBy(kv => kv.Key.fecha)
                .OrderBy(g => g.Key)
                .Select(g => new DiaResumen
                {
                    Fecha = g.Key,
                    Cantidad = g.Sum(x => x.Value.Count),
                    Repartidores = g.Select(x =>
                    {
                        var rep = repartidores.First(r => r.Id == x.Key.repartidorId);
                        return new RepartidorResumen
                        {
                            RepartidorId = rep.Id,
                            Nombre = $"{rep.Nombre} {rep.Apellido}",
                            Email = rep.Email,
                            Cantidad = x.Value.Count,
                            PesoTotal = x.Value.Sum(p => p.Peso),
                        };
                    }).ToList(),
                })
                .ToList();

            var resultado = new CalendarizacionResultado
            {
                TotalPendientes = pendientes.Count,
                TotalCalendarizados = pendientes.Count - sinAsignar,
                TotalSinAsignar = sinAsignar,
                ResumenPorDia = resumen,
            };

            await _auditoria.RegistrarAsync(
                TipoAccion.Calendarizacion,
                $"Calendarización ejecutada: {resultado.TotalCalendarizados} envíos asignados, {resultado.TotalSinAsignar} sin asignar",
                contexto: $"Días: {resumen.Count} | Repartidores afectados: {resumen.SelectMany(d => d.Repartidores.Select(r => r.RepartidorId)).Distinct().Count()}");

            return resultado;
        }

        private static void AsignarEnMemoria(
            Dictionary<(Guid, DateTime), List<Paquete>> carga,
            Guid repartidorId,
            DateTime fecha,
            Paquete paquete)
        {
            if (!carga.TryGetValue((repartidorId, fecha), out var lista))
            {
                lista = new List<Paquete>();
                carga[(repartidorId, fecha)] = lista;
            }
            lista.Add(paquete);
        }
    }
}
