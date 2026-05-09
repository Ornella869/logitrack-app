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

            var todosRepartidores = (await _userRepository.GetRepartidores())
                .Where(r => r.Activo && r.PuedeSerAsignado)
                .ToList();

            if (todosRepartidores.Count == 0)
                throw new InvalidOperationException("No hay repartidores activos disponibles.");

            // Cargamos lo que ya está asignado (no pendiente) para:
            //  1) Excluir repartidores con paquetes En Tránsito (ya están en la calle).
            //  2) Inicializar la matriz `carga` con sus asignaciones existentes,
            //     para que el algoritmo respete la capacidad real y la cercanía
            //     a su CP actual del día.
            var existentes = await _enviosRepository.GetPaquetesConAsignacionActiva();

            var enTransito = existentes
                .Where(p => p.Status == PaqueteStatus.EnTransito && p.RepartidorAsignadoId.HasValue)
                .Select(p => p.RepartidorAsignadoId!.Value)
                .ToHashSet();

            var repartidores = todosRepartidores
                .Where(r => !enTransito.Contains(r.Id))
                .ToList();

            if (repartidores.Count == 0)
                throw new InvalidOperationException(
                    "Todos los repartidores activos están En Tránsito. Esperá a que vuelvan para calendarizar nuevos envíos.");

            // Orden requerido: Prioritarios primero, luego Comunes; ambos por orden de creación.
            var cola = pendientes
                .OrderByDescending(p => p.TipoEnvio == TipoEnvio.Prioritario)
                .ThenBy(p => p.CreadoEn)
                .ToList();

            var carga = new Dictionary<(Guid repartidorId, DateTime fecha), List<Paquete>>();
            foreach (var existente in existentes)
            {
                if (!existente.RepartidorAsignadoId.HasValue || !existente.FechaCalendarizada.HasValue) continue;
                if (enTransito.Contains(existente.RepartidorAsignadoId.Value)) continue;
                AsignarEnMemoria(carga, existente.RepartidorAsignadoId.Value, existente.FechaCalendarizada.Value.Date, existente);
            }

            // Total histórico por repartidor → para round-robin entre libres
            // (evita que siempre caiga el mismo cuando todos están vacíos).
            var totalHistorico = repartidores.ToDictionary(
                r => r.Id,
                r => existentes.Count(p => p.RepartidorAsignadoId == r.Id));

            var hoy = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc);
            int sinAsignar = 0;

            // Mantenemos un mapa de quién recibió un paquete recién calendarizado
            // (por día) para resumen final y para la auditoría/notificaciones.
            var asignacionesNuevas = new Dictionary<(Guid, DateTime), List<Paquete>>();

            foreach (var paquete in cola)
            {
                bool asignado = false;
                var cpPaquete = ParseCp(paquete.Destinatario.Direccion.CP);

                for (int offset = 1; offset <= MaxDiasParaProgramar && !asignado; offset++)
                {
                    var fecha = hoy.AddDays(offset);

                    // 1) Match exacto de CP — el ideal para batching de zona.
                    var matchCp = repartidores
                        .Where(r =>
                        {
                            if (!carga.TryGetValue((r.Id, fecha), out var lista) || lista.Count == 0) return false;
                            var coincide = lista.Any(p => p.Destinatario.Direccion.CP == paquete.Destinatario.Direccion.CP);
                            return coincide && (lista.Sum(p => p.Peso) + paquete.Peso) <= Capacidad.RepartidorKg;
                        })
                        .OrderBy(r => carga[(r.Id, fecha)].Sum(p => p.Peso))
                        .FirstOrDefault();
                    if (matchCp is not null)
                    {
                        Asignar(matchCp, fecha, paquete);
                        asignado = true;
                        break;
                    }

                    // 2) Repartidor libre ese día (round-robin: el menos usado en total).
                    //    Esto rota la carga entre repartidores y evita que siempre
                    //    caiga el mismo cuando no hay match de CP.
                    var libre = repartidores
                        .Where(r => !carga.TryGetValue((r.Id, fecha), out var l) || l.Count == 0)
                        .OrderBy(r => totalHistorico[r.Id])
                        .ThenBy(r => r.Id) // tie-break determinístico
                        .FirstOrDefault();
                    if (libre is not null)
                    {
                        Asignar(libre, fecha, paquete);
                        asignado = true;
                        break;
                    }

                    // 3) Sin libres → al repartidor con CP más cercano en su carga del día.
                    //    Si no hay ninguno con capacidad, avanzamos al siguiente día.
                    var cercano = repartidores
                        .Where(r => carga.TryGetValue((r.Id, fecha), out var lista) && lista.Count > 0
                                    && (lista.Sum(p => p.Peso) + paquete.Peso) <= Capacidad.RepartidorKg)
                        .Select(r => new
                        {
                            Rep = r,
                            Distancia = carga[(r.Id, fecha)].Min(p => Math.Abs(ParseCp(p.Destinatario.Direccion.CP) - cpPaquete)),
                            Peso = carga[(r.Id, fecha)].Sum(p => p.Peso),
                        })
                        .OrderBy(x => x.Distancia)
                        .ThenBy(x => x.Peso)
                        .FirstOrDefault();
                    if (cercano is not null)
                    {
                        Asignar(cercano.Rep, fecha, paquete);
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

            // Resumen por día — sólo de lo NUEVO calendarizado en esta corrida.
            var resumen = asignacionesNuevas
                .GroupBy(kv => kv.Key.Item2)
                .OrderBy(g => g.Key)
                .Select(g => new DiaResumen
                {
                    Fecha = g.Key,
                    Cantidad = g.Sum(x => x.Value.Count),
                    Repartidores = g.Select(x =>
                    {
                        var rep = repartidores.First(r => r.Id == x.Key.Item1);
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
                contexto: $"Días: {resumen.Count} | Repartidores afectados: {resumen.SelectMany(d => d.Repartidores.Select(r => r.RepartidorId)).Distinct().Count()} | Excluidos por En Tránsito: {enTransito.Count}");

            return resultado;

            void Asignar(Repartidor rep, DateTime fecha, Paquete pk)
            {
                AsignarEnMemoria(carga, rep.Id, fecha, pk);
                AsignarEnMemoria(asignacionesNuevas, rep.Id, fecha, pk);
                pk.AsignarParaCalendarizacion(rep.Id, fecha);
                totalHistorico[rep.Id] = totalHistorico[rep.Id] + 1;
            }
        }

        private static int ParseCp(string cp)
        {
            // CPs argentinos: 4 dígitos. Si vinieran con prefijos alfanuméricos
            // (ej "C1425"), nos quedamos con la parte numérica y truncamos a 4.
            var soloDigitos = new string((cp ?? string.Empty).Where(char.IsDigit).ToArray());
            if (soloDigitos.Length == 0) return int.MaxValue;
            if (soloDigitos.Length > 4) soloDigitos = soloDigitos[..4];
            return int.TryParse(soloDigitos, out var n) ? n : int.MaxValue;
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
