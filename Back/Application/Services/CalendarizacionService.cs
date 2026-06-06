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
        /// <summary>"Disponible", "EnRuta" o "Retornando".</summary>
        public required string EstadoJornada { get; init; }
        public required int HorasTrabajo { get; init; }
        /// <summary>"Part Time" (≤ 6 h) o "Full Time" (≥ 7 h).</summary>
        public required string TipoJornada { get; init; }
        public required List<CalendarioCelda> Celdas { get; init; }
    }

    // G1L-83: resultado de la precalendarización manual.
    public class PrecalendarizacionResultado
    {
        public required double PesoActual { get; init; }
        public required double PesoResultante { get; init; }
        public required double CapacidadKg { get; init; }
        public required bool HuboReversion { get; init; }
        public string? Mensaje { get; init; }
        /// <summary>Fecha real en la que quedó agendado el envío.</summary>
        public DateTime? FechaAsignada { get; init; }
    }

    public class CalendarizacionService
    {
        private const int MaxDiasParaProgramar = 30;

        private readonly IEnviosRepository _enviosRepository;
        private readonly IUserRepository _userRepository;
        private readonly HistorialEstadoEnvioService _historial;
        private readonly AuditoriaService _auditoria;
        private readonly OjoPatronService _ojoPatron;

        public CalendarizacionService(
            IEnviosRepository enviosRepository,
            IUserRepository userRepository,
            HistorialEstadoEnvioService historial,
            AuditoriaService auditoria,
            OjoPatronService ojoPatron)
        {
            _enviosRepository = enviosRepository;
            _userRepository = userRepository;
            _historial = historial;
            _auditoria = auditoria;
            _ojoPatron = ojoPatron;
        }

        // Épica D: si se pasa sucursalId, todo se filtra a esa sucursal (envíos y repartidores).
        public async Task<int> ContarPendientesAsync(Guid? sucursalId = null)
        {
            var pendientes = await _enviosRepository.GetPaquetesPendientesDeCalendarizacion(sucursalId);
            return pendientes.Count;
        }

        public async Task<CalendarioOperativo> GetCalendarioOperativoAsync(int dias = 14, Guid? sucursalId = null)
        {
            var hoy = OperationalClock.TodayUtcDate;
            var diasList = Enumerable.Range(0, dias).Select(i => hoy.AddDays(i)).ToList();

            var repartidores = (await _userRepository.GetRepartidores())
                .Where(r => r.Activo && r.PuedeSerAsignado)
                .Where(r => sucursalId == null || r.SucursalId == sucursalId)
                .OrderBy(r => r.Nombre)
                .ToList();

            var asignados = (await _enviosRepository.GetPaquetesConAsignacionActiva())
                .Where(p => sucursalId == null || p.SucursalId == sucursalId)
                .ToList();

            var paquetesExpandidos = new List<(Guid RepId, DateTime Fecha, Paquete Pk)>();
            foreach (var p in asignados)
            {
                if (p.FechaCalendarizada.HasValue && p.RepartidorAsignadoId.HasValue)
                {
                    var current = p.FechaCalendarizada.Value.Date;
                    int diasHabilesRestantes = p.DiasEstimadosEntrega;
                    while (diasHabilesRestantes > 0)
                    {
                        paquetesExpandidos.Add((p.RepartidorAsignadoId.Value, current, p));
                        
                        if (current.DayOfWeek != DayOfWeek.Sunday)
                        {
                            diasHabilesRestantes--;
                        }
                        if (diasHabilesRestantes > 0) current = current.AddDays(1);
                    }
                }
            }

            var paquetesPorRepartidorYDia = paquetesExpandidos
                .GroupBy(x => (x.RepId, x.Fecha))
                .ToDictionary(g => g.Key, g => g.Select(x => x.Pk).ToList());

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
                    EstadoJornada = r.EstadoJornada.ToString(),
                    HorasTrabajo = r.HorasTrabajo,
                    TipoJornada = r.TipoJornada,
                    Celdas = celdas,
                };
            }).ToList();

            return new CalendarioOperativo
            {
                Dias = diasList,
                Repartidores = calendarioReps,
            };
        }

        public async Task<List<DiaResumen>> GetEstadoActualAsync(Guid? sucursalId = null)
        {
            var asignados = (await _enviosRepository.GetPaquetesConAsignacionActiva())
                .Where(p => sucursalId == null || p.SucursalId == sucursalId)
                .ToList();
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

        // G1L-83: Precalendarización manual de un envío a un repartidor y día específicos.
        public async Task<PrecalendarizacionResultado> PrecalendarizarManualAsync(
            Guid paqueteId, Guid repartidorId, DateTime fecha, Guid? supervisorId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");

            if (paquete.Status != PaqueteStatus.PendienteDeCalendarizacion)
                throw new InvalidOperationException("Solo se pueden asignar manualmente envíos pendientes de calendarización.");

            var rep = await _userRepository.GetUsuarioById(repartidorId) as Repartidor
                ?? throw new InvalidOperationException("Repartidor no encontrado.");
            if (supervisorId.HasValue && await _userRepository.GetUsuarioById(supervisorId.Value) is Usuario sup && sup.SucursalId.HasValue)
            {
                if (paquete.SucursalId != sup.SucursalId)
                    throw new InvalidOperationException("No podés calendarizar envíos de otra sucursal.");
                if (rep.SucursalId != sup.SucursalId)
                    throw new InvalidOperationException("No podés asignar envíos a repartidores de otra sucursal.");
            }
            if (!rep.Activo || !rep.PuedeSerAsignado)
                throw new InvalidOperationException("El repartidor está suspendido o inhabilitado y no puede recibir asignaciones.");
            // Si está retornando, no puede recibir envíos hasta cerrar la jornada.
            if (rep.EstadoJornada == Repartidor.EstadoJornadaRepartidor.Retornando)
                throw new InvalidOperationException("El repartidor está retornando a la sucursal. Debe cerrar su jornada antes de recibir nuevos envíos.");

            var fechaUtc = DateTime.SpecifyKind(fecha.Date, DateTimeKind.Utc);

            // Validar compatibilidad de jornada: un repartidor Part Time no puede recibir
            // envíos que superen sus horas de trabajo diario (umbral: > 6 h de ruta).
            if (rep.EsPartTime && paquete.HorasEstimadasRuta > 6f)
                throw new InvalidOperationException(
                    $"Este envío requiere aproximadamente {paquete.HorasEstimadasRuta:0.#} horas de ruta " +
                    $"y no puede asignarse a repartidores de jornada Part Time ({rep.HorasTrabajo} h/día). " +
                    "Elegí un repartidor Full Time.");

            // Si el repartidor está en ruta HOY y el supervisor eligió hoy, bloqueamos:
            // no se puede agregar al viaje en curso. El supervisor debe elegir otro día.
            if (rep.EstadoJornada == Repartidor.EstadoJornadaRepartidor.EnRuta
                && fechaUtc.Date == OperationalClock.TodayUtcDate)
            {
                throw new InvalidOperationException(
                    $"El repartidor {rep.Nombre} {rep.Apellido} está actualmente en tránsito. " +
                    "Esperá a que regrese a la sucursal o elegí otro día.");
            }

            var delDia = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(repartidorId, fechaUtc);

            // Excluir paquetes ya finalizados del cálculo de peso.
            var pesoActual = delDia
                .Where(p => p.Status != PaqueteStatus.Entregado && p.Status != PaqueteStatus.Cancelado)
                .Sum(p => p.Peso);
            var pesoResultante = pesoActual + paquete.Peso;

            // Capacidad superada: bloqueamos la asignación; el supervisor debe elegir otro día.
            if (pesoResultante > Capacidad.RepartidorKg)
            {
                throw new InvalidOperationException(
                    $"El repartidor {rep.Nombre} {rep.Apellido} ya tiene la capacidad máxima para este día " +
                    $"({pesoActual:0.#}/{Capacidad.RepartidorKg} kg). Elegí otro día.");
            }

            paquete.AsignarParaCalendarizacion(repartidorId, fechaUtc);
            await _ojoPatron.InvalidarPruebasAprobadasDelDiaAsync(repartidorId, fechaUtc);

            // Recálculo post-asignación manual: si el repartidor ya estaba "Listo para
            // Salir", entra carga nueva → el vehículo deja de estar completo. Los paquetes
            // que ya estaban cargados NO se bajan: bajan de "Listo para Salir" a "Cargado
            // en Vehículo". Solo el nuevo queda en "Asignado a Vehículo" (falta cargarlo).
            // Al escanear el nuevo, TalvezMarcarTodosListosParaSalir vuelve a dejarlos "Listo".
            var aBajar = delDia
                .Where(p => p.Status == PaqueteStatus.ListoParaSalir)
                .ToList();
            bool huboReversion = aBajar.Count > 0;
            foreach (var p in aBajar)
            {
                p.CambiarEstado(PaqueteStatus.CargadoEnVehiculo);
                await _historial.RegistrarCambioAsync(
                    p.Id, PaqueteStatus.CargadoEnVehiculo, supervisorId, OrigenCambioEstado.Sistema,
                    "Vuelve a Cargado: ingresó un envío nuevo al reparto");
            }

            await _historial.RegistrarCambioAsync(
                paquete.Id, PaqueteStatus.AsignadoAVehiculo, supervisorId, OrigenCambioEstado.Manual,
                "Precalendarización manual por Supervisor");

            await _auditoria.RegistrarAsync(
                TipoAccion.Calendarizacion,
                $"Asignación manual de {paquete.CodigoSeguimiento} a {rep.Nombre} {rep.Apellido} ({fechaUtc:yyyy-MM-dd})",
                recursoId: paquete.CodigoSeguimiento,
                contexto: huboReversion
                    ? $"Repartidor: {repartidorId} | Día: {fechaUtc:yyyy-MM-dd} | {aBajar.Count} envíos pasaron de Listo para Salir a Cargado en Vehículo"
                    : $"Repartidor: {repartidorId} | Día: {fechaUtc:yyyy-MM-dd}");

            return new PrecalendarizacionResultado
            {
                PesoActual = pesoActual,
                PesoResultante = pesoResultante,
                CapacidadKg = Capacidad.RepartidorKg,
                HuboReversion = huboReversion,
                FechaAsignada = fechaUtc,
                Mensaje = huboReversion
                    ? "El repartidor estaba listo para salir. Debe escanear el nuevo envío antes de iniciar la ruta; los ya cargados siguen en el vehículo."
                    : null,
            };
        }

        public async Task<CalendarizacionResultado> EjecutarAsync(Guid? supervisorId)
        {
            // Épica D: el supervisor calendariza solo su sucursal (envíos y repartidores).
            Guid? sucursalId = null;
            if (supervisorId.HasValue && await _userRepository.GetUsuarioById(supervisorId.Value) is Usuario sup)
                sucursalId = sup.SucursalId;

            var pendientes = await _enviosRepository.GetPaquetesPendientesDeCalendarizacion(sucursalId);

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
                .Where(r => sucursalId == null || r.SucursalId == sucursalId)
                .Where(r => r.Activo && r.PuedeSerAsignado)
                .ToList();

            if (todosRepartidores.Count == 0)
                throw new InvalidOperationException("No hay repartidores activos disponibles.");

            // Cargamos lo que ya está asignado (no pendiente) para:
            //  1) Excluir repartidores con paquetes En Tránsito (ya están en la calle).
            //  2) Inicializar la matriz `carga` con sus asignaciones existentes,
            //     para que el algoritmo respete la capacidad real y la cercanía
            //     a su CP actual del día.
            var existentes = (await _enviosRepository.GetPaquetesConAsignacionActiva())
                .Where(p => sucursalId == null || p.SucursalId == sucursalId)
                .ToList();

            var enTransito = existentes
                .Where(p => p.Status == PaqueteStatus.EnTransito && p.RepartidorAsignadoId.HasValue)
                .Select(p => p.RepartidorAsignadoId!.Value)
                .ToHashSet();

            // Solo excluir los que están retornando: no pueden recibir envíos nuevos.
            // Los que están EnRuta SÍ se incluyen: sus nuevos envíos irán al día siguiente.
            var repartidores = todosRepartidores
                .Where(r => r.EstadoJornada != Repartidor.EstadoJornadaRepartidor.Retornando)
                .ToList();

            if (repartidores.Count == 0)
                throw new InvalidOperationException(
                    "Todos los repartidores activos están retornando a la sucursal. Esperá a que cierren su jornada para calendarizar nuevos envíos.");

            // Orden requerido: Prioritarios primero, luego Comunes; ambos por orden de creación.
            var cola = pendientes
                .OrderByDescending(p => p.Distancia)
                .ThenByDescending(p => p.Prioridad)
                .ThenBy(p => p.CreadoEn)
                .ToList();

            var carga = new Dictionary<(Guid repartidorId, DateTime fecha), List<Paquete>>();
            foreach (var existente in existentes)
            {
                if (!existente.RepartidorAsignadoId.HasValue || !existente.FechaCalendarizada.HasValue) continue;
                // Paquetes ya en tránsito no cuentan para la carga futura (están en el viaje actual).
                if (existente.Status == PaqueteStatus.EnTransito) continue;

                var current = existente.FechaCalendarizada.Value.Date;
                int dias = existente.DiasEstimadosEntrega;
                while (dias > 0)
                {
                    AsignarEnMemoria(carga, existente.RepartidorAsignadoId.Value, current, existente);
                    if (current.DayOfWeek != DayOfWeek.Sunday)
                    {
                        dias--;
                    }
                    if (dias > 0) current = current.AddDays(1);
                }
            }

            // Total histórico por repartidor → para round-robin entre libres
            // (evita que siempre caiga el mismo cuando todos están vacíos).
            var totalHistorico = repartidores.ToDictionary(
                r => r.Id,
                r => existentes.Count(p => p.RepartidorAsignadoId == r.Id));

            var hoy = OperationalClock.TodayUtcDate;
            int sinAsignar = 0;

            // Mantenemos un mapa de quién recibió un paquete recién calendarizado
            // (por día) para resumen final y para la auditoría/notificaciones.
            var asignacionesNuevas = new Dictionary<(Guid, DateTime), List<Paquete>>();

            foreach (var paquete in cola)
            {
                bool asignado = false;
                var cpPaquete = ParseCp(paquete.Destinatario.Direccion.CP);

                // Solo se usan repartidores de la misma sucursal que el paquete.
                // Si el paquete no tiene sucursal asignada, se usan todos los disponibles.
                // Los repartidores Part Time (≤ 6 h/día) solo reciben envíos con
                // HorasEstimadasRuta ≤ 6; para rutas más largas solo Full Time.
                var repsElegibles = (paquete.SucursalId.HasValue
                    ? repartidores.Where(r => r.SucursalId == paquete.SucursalId)
                    : repartidores.AsEnumerable())
                    .Where(r => !r.EsPartTime || paquete.HorasEstimadasRuta <= 6f)
                    .ToList();

                if (repsElegibles.Count == 0) { sinAsignar++; continue; }

                for (int offset = 1; offset <= MaxDiasParaProgramar && !asignado; offset++)
                {
                    var fecha = hoy.AddDays(offset);

                    // 1) Match exacto de CP con control de equidad.
                    //    Solo agrupa por zona si el repartidor con ese CP no tiene más de 1 paquete
                    //    extra respecto al menos cargado ese día. Esto evita que todos los paquetes
                    //    del mismo CP terminen en un solo repartidor.
                    var candidatosCP = repsElegibles
                        .Where(r =>
                        {
                            if (!carga.TryGetValue((r.Id, fecha), out var lista) || lista.Count == 0) return false;
                            var coincide = lista.Any(p => p.Destinatario.Direccion.CP == paquete.Destinatario.Direccion.CP);
                            return coincide && (lista.Sum(p => p.Peso) + paquete.Peso) <= Capacidad.RepartidorKg;
                        })
                        .ToList();
                    if (candidatosCP.Count > 0)
                    {
                        var minCargaDia = repsElegibles
                            .Select(r => carga.TryGetValue((r.Id, fecha), out var l) ? l.Count : 0)
                            .Min();
                        var matchCp = candidatosCP
                            .Where(r => (carga.TryGetValue((r.Id, fecha), out var l2) ? l2.Count : 0) <= minCargaDia + 1)
                            .OrderBy(r => carga[(r.Id, fecha)].Sum(p => p.Peso))
                            .FirstOrDefault();
                        if (matchCp is not null)
                        {
                            Asignar(matchCp, fecha, paquete);
                            asignado = true;
                            break;
                        }
                    }

                    // 2) Repartidor con menor carga ese día (round-robin equitativo).
                    //    Ya no exige "libre" (0 paquetes): distribuye entre todos los disponibles
                    //    ordenando por cantidad de paquetes asignados, garantizando reparto parejo.
                    var menosCargado = repsElegibles
                        .Where(r => (carga.TryGetValue((r.Id, fecha), out var lista2) ? lista2.Sum(p => p.Peso) : 0) + paquete.Peso <= Capacidad.RepartidorKg)
                        .OrderBy(r => carga.TryGetValue((r.Id, fecha), out var l3) ? l3.Count : 0)
                        .ThenBy(r => totalHistorico[r.Id])
                        .ThenBy(r => r.Id)
                        .FirstOrDefault();
                    if (menosCargado is not null)
                    {
                        Asignar(menosCargado, fecha, paquete);
                        asignado = true;
                        break;
                    }

                    // 3) Sin libres → al repartidor con CP más cercano en su carga del día.
                    //    Si no hay ninguno con capacidad, avanzamos al siguiente día.
                    var cercano = repsElegibles
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
            foreach (var asignacion in asignacionesNuevas.Keys)
                await _ojoPatron.InvalidarPruebasAprobadasDelDiaAsync(asignacion.Item1, asignacion.Item2);

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
                contexto: $"Días: {resumen.Count} | Repartidores afectados: {resumen.SelectMany(d => d.Repartidores.Select(r => r.RepartidorId)).Distinct().Count()} | En ruta hoy: {enTransito.Count}");

            return resultado;

            void Asignar(Repartidor rep, DateTime fecha, Paquete pk)
            {
                var current = fecha;
                int diasHabilesAAgregar = pk.DiasEstimadosEntrega;
                while (diasHabilesAAgregar > 0)
                {
                    AsignarEnMemoria(carga, rep.Id, current, pk);
                    AsignarEnMemoria(asignacionesNuevas, rep.Id, current, pk);
                    
                    if (current.DayOfWeek != DayOfWeek.Sunday)
                    {
                        diasHabilesAAgregar--;
                    }
                    if (diasHabilesAAgregar > 0) current = current.AddDays(1);
                }

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
