using Back.Domain.Models;
using Back.Infrastructure.Database;
using Back.Ml.Service;
using Microsoft.EntityFrameworkCore;

namespace Back.Application.Services
{
    public class EstimacionEntregaService
    {
        private readonly LogiTrackDbContext _context;

        public EstimacionEntregaService(LogiTrackDbContext context)
        {
            _context = context;
        }

        public async Task ReestimarYActualizarAsync(Paquete paquete, TramoEnvio tramoCompletado)
        {
            var tramosRestantes = await _context.TramosEnvio
                .Where(t => t.PaqueteId == paquete.Id
                    && t.Estado != TramoEnvioStatus.RecibidoEnSucursal
                    && t.Estado != TramoEnvioStatus.Entregado
                    && t.Estado != TramoEnvioStatus.Cancelado)
                .OrderBy(t => t.Orden)
                .ToListAsync();

            if (tramosRestantes.Count == 0) return;

            double horasEstimadas = 0;
            int tramosConHistorial = 0;

            foreach (var tramo in tramosRestantes)
            {
                if (!tramo.SucursalDestinoId.HasValue)
                {
                    horasEstimadas += tramo.HorasEstimadas;
                    continue;
                }

                var historial = await _context.DatosEntrenamientoTramo
                    .Where(d => d.SucursalOrigenId == tramo.SucursalOrigenId
                             && d.SucursalDestinoId == tramo.SucursalDestinoId!.Value)
                    .OrderByDescending(d => d.RegistradoEn)
                    .Take(100)
                    .ToListAsync();

                if (historial.Count >= 10)
                {
                    horasEstimadas += historial.Average(h => h.TiempoRealHoras);
                    tramosConHistorial++;
                }
                else
                {
                    horasEstimadas += tramo.HorasEstimadas;
                }
            }

            var score = tramosRestantes.Count > 0
                ? (float)tramosConHistorial / tramosRestantes.Count
                : 0f;

            if (score >= 0.6f || tramosConHistorial > 0)
            {
                var nuevaFecha = DateTime.UtcNow.AddHours(horasEstimadas);
                paquete.AsignarFechaEstimada(nuevaFecha);
            }

            await GenerarAlertaRiesgoSiCorrespondeAsync(paquete, tramoCompletado);
        }

        public async Task RegistrarDatoTramoAsync(
            Paquete paquete,
            TramoEnvio tramo,
            DateTime fechaLlegada)
        {
            if (!tramo.IniciadoEn.HasValue || !tramo.SucursalDestinoId.HasValue) return;

            var tiempoReal = (fechaLlegada - tramo.IniciadoEn.Value).TotalHours;
            var estimacionPrevia = tramo.HorasEstimadas;
            var error = Math.Abs(tiempoReal - estimacionPrevia);

            var cargaOrigen = await _context.TramosEnvio
                .CountAsync(t => t.SucursalOrigenId == tramo.SucursalOrigenId
                              && (t.Estado == TramoEnvioStatus.PendienteDeCalendarizacion
                               || t.Estado == TramoEnvioStatus.Asignado
                               || t.Estado == TramoEnvioStatus.EnTransito));

            var repartidoresActivos = await _context.Usuarios
                .OfType<Repartidor>()
                .CountAsync(r => r.SucursalId == tramo.SucursalDestinoId
                              && r.Estado == Repartidor.EstadoRepartidor.Activo);

            var dato = new DatoEntrenamientoTramo
            {
                PaqueteId = paquete.Id,
                TramoId = tramo.Id,
                SucursalOrigenId = tramo.SucursalOrigenId,
                SucursalDestinoId = tramo.SucursalDestinoId.Value,
                FechaSalida = tramo.IniciadoEn.Value,
                FechaLlegada = fechaLlegada,
                TiempoRealHoras = tiempoReal,
                PesoKg = paquete.Peso,
                TipoEnvio = paquete.TipoEnvio.ToString(),
                EsPrioritario = paquete.TipoEnvio == TipoEnvio.Prioritario,
                DiaSemana = (int)tramo.IniciadoEn.Value.DayOfWeek,
                HoraSalida = tramo.IniciadoEn.Value.Hour,
                CargaSucursalOrigen = cargaOrigen,
                RepartidoresActivosDestino = repartidoresActivos,
                TuvoDemora = tiempoReal > estimacionPrevia * 1.5,
                EstimacionPreviaHoras = estimacionPrevia,
                ErrorAbsolutoHoras = error,
            };

            _context.DatosEntrenamientoTramo.Add(dato);
        }

        // G1L-161: al entregar (última milla), registra el tiempo total real (CreadoEn → EntregadoEn) y la
        // desviación vs la última estimación. La última milla no tiene sucursal destino (se entrega al cliente):
        // usamos la sucursal origen del tramo como referencia (origen==destino), por lo que NO interfiere con la
        // estimación inter-sucursal (que busca pares origen≠destino).
        public async Task RegistrarDatoUltimaMillaAsync(Paquete paquete, TramoEnvio tramo)
        {
            if (!paquete.EntregadoEn.HasValue) return;

            var tiempoReal = (paquete.EntregadoEn.Value - paquete.CreadoEn).TotalHours;
            double? estimacionPrevia = paquete.FechaEstimadaEntrega.HasValue
                ? (paquete.FechaEstimadaEntrega.Value - paquete.CreadoEn).TotalHours
                : null;
            double? error = estimacionPrevia.HasValue ? Math.Abs(tiempoReal - estimacionPrevia.Value) : null;

            var dato = new DatoEntrenamientoTramo
            {
                PaqueteId = paquete.Id,
                TramoId = tramo.Id,
                SucursalOrigenId = tramo.SucursalOrigenId,
                SucursalDestinoId = tramo.SucursalOrigenId,
                FechaSalida = paquete.CreadoEn,
                FechaLlegada = paquete.EntregadoEn.Value,
                TiempoRealHoras = tiempoReal,
                PesoKg = paquete.Peso,
                TipoEnvio = paquete.TipoEnvio.ToString(),
                EsPrioritario = paquete.TipoEnvio == TipoEnvio.Prioritario,
                DiaSemana = (int)paquete.CreadoEn.DayOfWeek,
                HoraSalida = paquete.CreadoEn.Hour,
                CargaSucursalOrigen = 0,
                RepartidoresActivosDestino = 0,
                TuvoDemora = estimacionPrevia.HasValue && tiempoReal > estimacionPrevia.Value * 1.5,
                EstimacionPreviaHoras = estimacionPrevia,
                ErrorAbsolutoHoras = error,
            };

            _context.DatosEntrenamientoTramo.Add(dato);
        }

        private async Task GenerarAlertaRiesgoSiCorrespondeAsync(Paquete paquete, TramoEnvio tramoActual)
        {
            var siguienteTramo = await _context.TramosEnvio
                .Where(t => t.PaqueteId == paquete.Id && t.Orden == tramoActual.Orden + 1)
                .FirstOrDefaultAsync();

            if (siguienteTramo?.SucursalDestinoId == null) return;

            var origenId = siguienteTramo.SucursalOrigenId;
            var destinoId = siguienteTramo.SucursalDestinoId!.Value;

            var total = await _context.DatosEntrenamientoTramo
                .CountAsync(d => d.SucursalOrigenId == origenId && d.SucursalDestinoId == destinoId);

            if (total < 5) return;

            var conDemora = await _context.DatosEntrenamientoTramo
                .CountAsync(d => d.SucursalOrigenId == origenId
                              && d.SucursalDestinoId == destinoId
                              && d.TuvoDemora);

            var probabilidad = (float)conDemora / total;
            if (probabilidad < 0.70f) return;

            var yaExiste = await _context.AlertasRiesgoDemoraMl
                .AnyAsync(a => a.PaqueteId == paquete.Id && !a.Gestionada);
            if (yaExiste) return;

            var origen = await _context.Sucursales.FindAsync(origenId);
            var destino = await _context.Sucursales.FindAsync(destinoId);
            var causa = $"Alta tasa histórica de demora en tramo {origen?.Nombre ?? origenId.ToString()} → {destino?.Nombre ?? destinoId.ToString()} ({(int)(probabilidad * 100)}% de casos)";

            var alerta = new AlertaRiesgoDemoraMl
            {
                PaqueteId = paquete.Id,
                CodigoSeguimiento = paquete.CodigoSeguimiento,
                ProbabilidadDemora = probabilidad,
                CausaPrincipal = causa,
                SucursalId = origenId,
            };

            _context.AlertasRiesgoDemoraMl.Add(alerta);

            // G1L-163: notificar a los supervisores activos de la sucursal (queda registrado y visible en notificaciones).
            var supervisores = await _context.Usuarios.OfType<Supervisor>()
                .Where(s => s.SucursalId == origenId && s.Activo)
                .ToListAsync();
            alerta.SupervisorId = supervisores.FirstOrDefault()?.Id;
            foreach (var sup in supervisores)
            {
                var asunto = $"Riesgo de demora — envío {paquete.CodigoSeguimiento}";
                var cuerpo = $"El modelo predice alta probabilidad de demora ({(int)(probabilidad * 100)}%). {causa}";
                _context.EmailNotificaciones.Add(new EmailNotificacion(
                    paquete.Id, origenId, paquete.CodigoSeguimiento, sup.Email, asunto, cuerpo,
                    EventoEmailNotificacion.AlertaRiesgoDemoraMl));
            }
        }

        // G1L-162: reentrenamiento real del modelo ML sobre los datos históricos + versionado y comparativa.
        public async Task<ModeloVersionTramo> EntrenarAsync()
        {
            var datos = await _context.DatosEntrenamientoTramo.ToListAsync();
            var conEstimacion = datos.Where(d => d.EstimacionPreviaHoras.HasValue).ToList();
            var maeHeuristico = conEstimacion.Count > 0 ? conEstimacion.Average(d => d.ErrorAbsolutoHoras ?? 0) : 0;

            var rutaModelo = Path.Combine(AppContext.BaseDirectory, "ML", "Models", "tramo_model.zip");
            var res = MlTramoTrainer.EntrenarYGuardar(datos, rutaModelo);
            if (!res.Entrenado)
                throw new InvalidOperationException(
                    $"Datos insuficientes para entrenar: se necesitan al menos {MlTramoTrainer.MinimoRegistros} tramos completados (hay {res.Registros}).");

            var nro = await _context.ModeloVersionesTramo.CountAsync() + 1;
            var version = new ModeloVersionTramo
            {
                RegistrosUsados = res.Registros,
                MaeModelo = res.MaeModelo,
                MaeHeuristico = Math.Round(maeHeuristico, 2),
                Algoritmo = "FastTree",
                Version = $"v{nro}.0",
            };
            _context.ModeloVersionesTramo.Add(version);
            await _context.SaveChangesAsync();
            return version;
        }

        public async Task<MlMetricasDto> ObtenerMetricasAsync()
        {
            var datos = await _context.DatosEntrenamientoTramo.ToListAsync();
            var totalRegistros = datos.Count;

            var datosConEstimacion = datos.Where(d => d.EstimacionPreviaHoras.HasValue).ToList();
            var maeModelo = datosConEstimacion.Count > 0
                ? datosConEstimacion.Average(d => d.ErrorAbsolutoHoras ?? 0)
                : 0;

            var dist = new ErrorDistribucionDto
            {
                MenosDe4h = totalRegistros > 0 ? (int)(datos.Count(d => (d.ErrorAbsolutoHoras ?? 0) < 4) * 100.0 / totalRegistros) : 0,
                De4a8h = totalRegistros > 0 ? (int)(datos.Count(d => (d.ErrorAbsolutoHoras ?? 0) >= 4 && (d.ErrorAbsolutoHoras ?? 0) < 8) * 100.0 / totalRegistros) : 0,
                De8a24h = totalRegistros > 0 ? (int)(datos.Count(d => (d.ErrorAbsolutoHoras ?? 0) >= 8 && (d.ErrorAbsolutoHoras ?? 0) < 24) * 100.0 / totalRegistros) : 0,
                MasDe24h = totalRegistros > 0 ? (int)(datos.Count(d => (d.ErrorAbsolutoHoras ?? 0) >= 24) * 100.0 / totalRegistros) : 0,
            };

            var tramosConError = datos
                .GroupBy(d => new { d.SucursalOrigenId, d.SucursalDestinoId })
                .Select(g => new { g.Key.SucursalOrigenId, g.Key.SucursalDestinoId, Mae = g.Average(x => x.ErrorAbsolutoHoras ?? 0), Count = g.Count() })
                .OrderByDescending(x => x.Mae)
                .Take(5)
                .ToList();

            var sucursalIds = tramosConError
                .SelectMany(t => new[] { t.SucursalOrigenId, t.SucursalDestinoId })
                .Distinct()
                .ToList();

            var sucursales = await _context.Sucursales
                .Where(s => sucursalIds.Contains(s.Id))
                .ToDictionaryAsync(s => s.Id, s => s.Nombre);

            var tramoDificiles = tramosConError.Select(t => new TramoDificilDto
            {
                Origen = sucursales.GetValueOrDefault(t.SucursalOrigenId, t.SucursalOrigenId.ToString()),
                Destino = sucursales.GetValueOrDefault(t.SucursalDestinoId, t.SucursalDestinoId.ToString()),
                MaeHoras = Math.Round(t.Mae, 2),
                CantidadViajes = t.Count,
            }).ToList();

            var hoy = DateTime.UtcNow;
            var maeHistorico = Enumerable.Range(0, 6)
                .Select(i =>
                {
                    var desde = hoy.AddMonths(-i - 1);
                    var hasta = hoy.AddMonths(-i);
                    var registrosMes = datos.Where(d => d.RegistradoEn >= desde && d.RegistradoEn < hasta).ToList();
                    return new PuntoMaeHistoricoDto
                    {
                        Mes = desde.ToString("MMM yyyy"),
                        Mae = registrosMes.Count > 0 ? Math.Round(registrosMes.Average(d => d.ErrorAbsolutoHoras ?? 0), 2) : 0,
                        Registros = registrosMes.Count,
                    };
                })
                .Reverse()
                .ToList();

            var nuevosRegistros30Dias = datos.Count(d => d.RegistradoEn >= hoy.AddDays(-30));

            var versiones = await _context.ModeloVersionesTramo
                .OrderByDescending(v => v.EntrenadoEn)
                .Select(v => new ModeloVersionDto
                {
                    EntrenadoEn = v.EntrenadoEn,
                    RegistrosUsados = v.RegistrosUsados,
                    MaeModelo = v.MaeModelo,
                    MaeHeuristico = v.MaeHeuristico,
                    Version = v.Version,
                    Algoritmo = v.Algoritmo,
                })
                .ToListAsync();
            var ultima = versiones.FirstOrDefault();

            // G1L-163: precisión de las alertas de riesgo ya gestionadas (acertó si el envío NO llegó a tiempo).
            var alertasEvaluadas = await _context.AlertasRiesgoDemoraMl
                .Where(a => a.Gestionada && a.LlegoATiempo != null)
                .ToListAsync();
            double? precisionAlertas = alertasEvaluadas.Count > 0
                ? Math.Round(alertasEvaluadas.Count(a => a.LlegoATiempo == false) * 100.0 / alertasEvaluadas.Count, 1)
                : null;

            return new MlMetricasDto
            {
                TotalRegistros = totalRegistros,
                PrecisionAlertas = precisionAlertas,
                AlertasEvaluadas = alertasEvaluadas.Count,
                MaeModelo = Math.Round(maeModelo, 2),
                MaeHeuristico = Math.Round(maeModelo, 2),
                MaeModeloMl = ultima?.MaeModelo,
                ComparativaDisponible = ultima is not null,
                NuevosRegistros30Dias = nuevosRegistros30Dias,
                DistribucionErrores = dist,
                TramosConMayorError = tramoDificiles,
                MaeHistorico = maeHistorico,
                Versiones = versiones,
                PuedeReentrenar = totalRegistros >= MlTramoTrainer.MinimoRegistros,
                Version = ultima?.Version ?? (totalRegistros >= MlTramoTrainer.MinimoRegistros ? "Sin entrenar" : "Datos insuficientes"),
            };
        }
    }

    public class MlMetricasDto
    {
        public int TotalRegistros { get; set; }
        public double MaeModelo { get; set; }
        public double MaeHeuristico { get; set; }
        public double? MaeModeloMl { get; set; }
        public bool ComparativaDisponible { get; set; }
        public int NuevosRegistros30Dias { get; set; }
        public ErrorDistribucionDto DistribucionErrores { get; set; } = new();
        public List<TramoDificilDto> TramosConMayorError { get; set; } = [];
        public List<PuntoMaeHistoricoDto> MaeHistorico { get; set; } = [];
        public List<ModeloVersionDto> Versiones { get; set; } = [];
        public bool PuedeReentrenar { get; set; }
        public string Version { get; set; } = string.Empty;
        public double? PrecisionAlertas { get; set; }
        public int AlertasEvaluadas { get; set; }
    }

    public class ModeloVersionDto
    {
        public DateTime EntrenadoEn { get; set; }
        public int RegistrosUsados { get; set; }
        public double MaeModelo { get; set; }
        public double MaeHeuristico { get; set; }
        public string Version { get; set; } = string.Empty;
        public string Algoritmo { get; set; } = string.Empty;
    }

    public class ErrorDistribucionDto
    {
        public int MenosDe4h { get; set; }
        public int De4a8h { get; set; }
        public int De8a24h { get; set; }
        public int MasDe24h { get; set; }
    }

    public class TramoDificilDto
    {
        public string Origen { get; set; } = string.Empty;
        public string Destino { get; set; } = string.Empty;
        public double MaeHoras { get; set; }
        public int CantidadViajes { get; set; }
    }

    public class PuntoMaeHistoricoDto
    {
        public string Mes { get; set; } = string.Empty;
        public double Mae { get; set; }
        public int Registros { get; set; }
    }
}
