using System.Text.RegularExpressions;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Back.Application.Abstractions;
using Back.Application.Common;
using Back.Application.Util;
using Back.Controllers;
using Back.Domain.Models;
using Back.Domain.Repositories;

namespace Back.Application.Services
{
    public enum CancelarEnvioMode
    {
        Definitivo = 0,
        Reagendar = 1,
    }

    public class EscaneoResultado
    {
        public required PaqueteStatus Status { get; init; }
        public required string Accion { get; init; } // "TransitoIniciado", "AbrirFichaEntrega"
        public required string CodigoSeguimiento { get; init; }
        public required Guid PaqueteId { get; init; }
    }

    public class RegistrarPaqueteResult
    {
        public required Guid Id { get; init; }
        public required string CodigoSeguimiento { get; init; }
        public required PaqueteStatus Status { get; init; }
        public required string QrBase64 { get; init; }
    }

    public class GenerarLoteDemoResult
    {
        public int Solicitados { get; init; }
        public int Creados { get; init; }
        public int Fallidos { get; init; }
        public List<string> TrackingIds { get; init; } = new();
        public List<string> Errores { get; init; } = new();
    }

    public class ImportarEnviosResult
    {
        public int Procesados { get; init; }
        public int Creados { get; init; }
        public int Fallidos { get; init; }
        public List<ImportarEnvioDetalleResult> Detalles { get; init; } = new();
    }

    public record ImportarEnvioDetalleResult(int Fila, bool Creado, string? CodigoSeguimiento, string? Error);

    public class EnviosService
    {
        private readonly IEnviosRepository _enviosRepository;
        private readonly IUserRepository _userRepository;
        private readonly IRutasRepository _rutasRepository;
        private readonly IMLPrioridadPrediction _mlPrioridadPrediction;
        private readonly HistorialEstadoEnvioService _historial;
        private readonly QrService _qrService;
        private readonly AuditoriaService _auditoria;
        private readonly GeocodingService _geocoding;
        private readonly TarifaService _tarifas;
        private readonly EmailNotificacionService _emails;
        private readonly OjoPatronService _ojoPatron;
        private const int DemoAddressesPerProvince = 1200;
        private static readonly Lazy<List<DemoAddress>> DemoAddressesCache = new(() =>
            ExpandirDireccionesDemo(CargarDireccionesDemoBase()));

        public EnviosService(
            IEnviosRepository enviosRepository,
            IUserRepository userRepository,
            IRutasRepository rutasRepository,
            IMLPrioridadPrediction mlPrioridadPrediction,
            HistorialEstadoEnvioService historial,
            QrService qrService,
            AuditoriaService auditoria,
            GeocodingService geocoding,
            TarifaService tarifas,
            EmailNotificacionService emails,
            OjoPatronService ojoPatron)
        {
            _rutasRepository = rutasRepository;
            _enviosRepository = enviosRepository;
            _userRepository = userRepository;
            _mlPrioridadPrediction = mlPrioridadPrediction;
            _historial = historial;
            _qrService = qrService;
            _auditoria = auditoria;
            _geocoding = geocoding;
            _tarifas = tarifas;
            _emails = emails;
            _ojoPatron = ojoPatron;
        }

        // G1L-88 / Épica D: cotización con tarifas y zonas de la provincia de destino.
        private async Task AplicarCotizacion(Paquete paquete, double peso, float distancia, Ubicacion? ubicacion, string? provinciaDestino)
        {
            var provincia = (provinciaDestino ?? string.Empty).Trim();
            var config = await _tarifas.GetConfiguracionAsync(provincia);
            var esPeligrosa = ubicacion is not null
                && await _tarifas.EsZonaPeligrosaAsync(provincia, ubicacion.Latitud, ubicacion.Longitud);
            var cotizacion = _tarifas.Calcular(peso, distancia, esPeligrosa, config);
            paquete.AsignarCotizacion(cotizacion.Total, cotizacion.CostoRecargo, esPeligrosa);
        }

        private async Task ValidarAccesoPaqueteAsync(Paquete paquete, Guid? usuarioId)
        {
            if (!usuarioId.HasValue) return;
            var usuario = await _userRepository.GetUsuarioById(usuarioId.Value);
            if (usuario is null || usuario is Administrador) return;
            if (usuario is Repartidor)
            {
                if (paquete.RepartidorAsignadoId != usuario.Id)
                    throw new InvalidOperationException("No podés operar envíos asignados a otro repartidor.");
                if (paquete.FechaCalendarizada?.Date != OperationalClock.TodayUtcDate
                    && paquete.Status is not (PaqueteStatus.EnTransito or PaqueteStatus.Demorado))
                    throw new InvalidOperationException("Solo podés operar envíos calendarizados para hoy.");
            }
            if (usuario is not Repartidor && usuario.SucursalId.HasValue && paquete.SucursalId != usuario.SucursalId)
                throw new InvalidOperationException("No podés operar envíos de otra sucursal.");
        }

        // Épica D: resuelve la sucursal responsable de un envío por la provincia de destino
        // y aplica el ruteo estricto (un operador no puede crear envíos fuera de su sucursal).
        private async Task<Sucursal?> ResolverSucursalDestinoAsync(string? provinciaDestino, Guid? usuarioId, List<Sucursal>? sucursalesPreCargadas = null)
        {
            var sucursales = sucursalesPreCargadas ?? await _enviosRepository.GetSucursales();
            if (sucursales.Count == 0) return null;

            var responsable = sucursales.FirstOrDefault(s => s.Cubre(provinciaDestino));

            // Ruteo estricto: si el operador tiene sucursal asignada, el destino debe estar
            // dentro de su cobertura. (Los usuarios sin sucursal —datos previos/admin— no se bloquean.)
            if (usuarioId.HasValue)
            {
                var operador = await _userRepository.GetUsuarioById(usuarioId.Value);
                if (operador?.SucursalId is Guid opSucId)
                {
                    var miSucursal = sucursales.FirstOrDefault(s => s.Id == opSucId);
                    if (miSucursal is not null && !miSucursal.Cubre(provinciaDestino))
                    {
                        var quien = responsable is not null ? $"la sucursal '{responsable.Nombre}'" : "otra sucursal";
                        throw new InvalidOperationException(
                            $"El destino ({provinciaDestino}) lo gestiona {quien}. No podés registrar envíos con destino en otra provincia. Solo se permiten envíos dentro de la provincia de tu sucursal o de las que cubra tu sucursal.");
                    }
                    // Dentro de cobertura: la sucursal responsable es la del operador.
                    return miSucursal;
                }
            }

            return responsable;
        }

        private async Task<bool> EsEnvioADomicilioAsync(string? provinciaDestino, Sucursal? sucursalDestino, List<Sucursal>? sucursalesPreCargadas = null)
        {
            if (sucursalDestino is null || string.IsNullOrWhiteSpace(provinciaDestino)) return false;
            var destino = provinciaDestino.Trim();
            var sucursales = sucursalesPreCargadas ?? await _enviosRepository.GetSucursales();
            return !sucursales.Any(s => string.Equals(s.Provincia?.Trim(), destino, StringComparison.OrdinalIgnoreCase));
        }

        private async Task<PuntoPickUp?> ResolverPuntoPickUpAsync(Guid? puntoPickUpId, Guid? usuarioId)
        {
            if (!puntoPickUpId.HasValue) return null;

            var punto = await _enviosRepository.GetPuntoPickUpById(puntoPickUpId.Value);
            if (punto is null || !punto.Activo)
                throw new InvalidOperationException("El punto PickUp seleccionado no existe o no esta activo.");

            if (usuarioId.HasValue)
            {
                var usuario = await _userRepository.GetUsuarioById(usuarioId.Value);
                if (usuario?.SucursalId is Guid sucursalId)
                {
                    var sucursal = (await _enviosRepository.GetSucursales(sucursalId: sucursalId)).FirstOrDefault();
                    if (sucursal is null || !sucursal.Cubre(punto.Provincia))
                        throw new InvalidOperationException("El punto PickUp seleccionado no pertenece a la cobertura de tu sucursal.");
                }
            }

            return punto;
        }

        // G1L-10
        public async Task<RegistrarPaqueteResult> RegistrarPaquete(RegistrarPaqueteRequest request, Guid? usuarioId)
        {
            ValidarPaqueteData(request);

            var puntoPickUp = await ResolverPuntoPickUpAsync(request.PuntoPickUpId, usuarioId);
            if (puntoPickUp is not null)
            {
                request.Destinatario.Direccion = puntoPickUp.Direccion;
                request.Destinatario.Localidad = puntoPickUp.Localidad;
                request.Destinatario.CP = puntoPickUp.CodigoPostal;
                request.Destinatario.Provincia = puntoPickUp.Provincia;
            }

            var ubicacionDestinatario = await _geocoding.GeocodeExactAsync(
                request.Destinatario.Direccion,
                request.Destinatario.Localidad,
                request.Destinatario.CP,
                request.Destinatario.Provincia);
            if (ubicacionDestinatario is null)
                throw new InvalidOperationException(
                    $"No se pudo geocodificar la dirección del destinatario: \"{request.Destinatario.Direccion}, {request.Destinatario.Localidad}\". " +
                    "Por favor, verificá que la dirección sea correcta e intentá nuevamente.");

            var distancia = DistanciasService.CalcularDistancia(request.Destinatario.Localidad);
            var prioridad = await _mlPrioridadPrediction.Predecir((float)request.Peso, distancia);

            // Épica D: sucursal responsable por provincia de destino + ruteo estricto.
            var sucursalDestino = await ResolverSucursalDestinoAsync(request.Destinatario.Provincia, usuarioId);

            var esEnvioADomicilio = await EsEnvioADomicilioAsync(request.Destinatario.Provincia, sucursalDestino);

            var paquete = new Paquete(
                request.Peso,
                0,
                0,
                new Cliente(request.Remitente.Nombre, request.Remitente.Apellido, new Direccion(request.Remitente.Direccion, request.Remitente.Localidad, request.Remitente.CP, request.Remitente.Provincia), request.Remitente.Telefono, request.Remitente.Email),
                new Cliente(request.Destinatario.Nombre, request.Destinatario.Apellido, new Direccion(request.Destinatario.Direccion, request.Destinatario.Localidad, request.Destinatario.CP, request.Destinatario.Provincia, ubicacion: ubicacionDestinatario), request.Destinatario.Telefono, request.Destinatario.Email),
                prioridad,
                distancia,
                request.Comentarios
            )
            {
                TipoEnvio = request.TipoEnvio,
                TipoPaquete = request.TipoPaquete,
                SucursalId = sucursalDestino?.Id,
                ProvinciaDestino = request.Destinatario.Provincia?.Trim(),
                EsEnvioADomicilio = puntoPickUp is null && esEnvioADomicilio,
            };

            paquete.ActualizarEstimacionEntrega(distancia);
            await AplicarCotizacion(paquete, request.Peso, distancia, ubicacionDestinatario, request.Destinatario.Provincia);
            if (puntoPickUp is not null)
                paquete.AsignarPuntoPickUp(puntoPickUp.Id);

            await _enviosRepository.Add(paquete);
            await _emails.NotificarCodigoEntregaAsync(paquete);

            await _historial.RegistrarCambioAsync(
                paquete.Id,
                paquete.Status,
                usuarioId,
                OrigenCambioEstado.Sistema,
                "Alta del envío");

            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.CreacionEnvio,
                $"Creó envío {paquete.CodigoSeguimiento} (Pendiente de Calendarización)",
                recursoId: paquete.CodigoSeguimiento);

            return new RegistrarPaqueteResult
            {
                Id = paquete.Id,
                CodigoSeguimiento = paquete.CodigoSeguimiento,
                Status = paquete.Status,
                QrBase64 = _qrService.GenerarBase64(paquete.CodigoSeguimiento),
            };
        }

        public async Task<GenerarLoteDemoResult> GenerarLoteDemoAsync(int cantidad, Guid? usuarioId)
        {
            if (!new[] { 100, 250, 500, 1000 }.Contains(cantidad))
                throw new InvalidOperationException("La cantidad debe ser 100, 250, 500 o 1000.");

            var direcciones = await ObtenerDireccionesDemoHabilitadasAsync(usuarioId);
            if (direcciones.Count == 0)
                throw new InvalidOperationException("No hay direcciones demo para la cobertura de tu sucursal.");

            var sucursalOrigen = await ObtenerSucursalUsuarioAsync(usuarioId);
            var creados = new List<string>();
            var errores = new List<string>();
            var paquetesAAgregar = new List<Paquete>();

            var todasSucursales = await _enviosRepository.GetSucursales();
            var configsCache = new Dictionary<string, ConfiguracionTarifa>();
            var zonasCache = new Dictionary<string, List<ZonaPeligrosa>>();

            for (var i = 0; i < cantidad; i++)
            {
                try
                {
                    var destino = direcciones[i % direcciones.Count];
                    var remitente = CrearRemitenteDemo(sucursalOrigen, destino);
                    var peso = Math.Round(1.5 + (i * 3.7 % 38), 1);
                    var distancia = DistanciasService.CalcularDistancia(destino.Localidad);
                    var prioridad = await _mlPrioridadPrediction.Predecir((float)peso, distancia);
                    var sucursalDestino = await ResolverSucursalDestinoAsync(destino.Provincia, usuarioId, todasSucursales);
                    var esEnvioADomicilio = await EsEnvioADomicilioAsync(destino.Provincia, sucursalDestino, todasSucursales);

                    var paquete = new Paquete(
                        peso,
                        0,
                        0,
                        new Cliente(
                            remitente.Item1,
                            remitente.Item2,
                            new Direccion(remitente.Item3, remitente.Item4, remitente.Item5, remitente.Item7),
                            remitente.Item6),
                        new Cliente(
                            destino.Nombre,
                            destino.Apellido,
                            new Direccion(destino.Direccion, destino.Localidad, destino.CP, destino.Provincia, ubicacion: new Ubicacion(destino.Latitud, destino.Longitud)),
                            destino.Telefono,
                            $"cliente{i + 1}@demo.logitrack.local"),
                        prioridad,
                        distancia,
                        $"Carga demo #{i + 1}")
                    {
                        TipoEnvio = i % 8 == 0 ? TipoEnvio.Prioritario : TipoEnvio.Comun,
                        TipoPaquete = i % 11 == 0 ? TipoPaquete.Fragil : TipoPaquete.Comun,
                        SucursalId = sucursalDestino?.Id,
                        ProvinciaDestino = destino.Provincia,
                        EsEnvioADomicilio = esEnvioADomicilio,
                    };

                    paquete.ActualizarEstimacionEntrega(distancia);

                    var provKey = (destino.Provincia ?? string.Empty).Trim();
                    if (!configsCache.TryGetValue(provKey, out var config))
                    {
                        config = await _tarifas.GetConfiguracionAsync(provKey);
                        configsCache[provKey] = config;
                    }
                    if (!zonasCache.TryGetValue(provKey, out var zonas))
                    {
                        zonas = await _tarifas.GetZonasAsync(provKey);
                        zonasCache[provKey] = zonas;
                    }
                    var esPeligrosa = zonas.Where(z => z.Activa).Any(z => z.Contiene(destino.Latitud, destino.Longitud));
                    
                    var cotizacion = _tarifas.Calcular(peso, distancia, esPeligrosa, config, null);
                    paquete.AsignarCotizacion(cotizacion.Total, cotizacion.CostoRecargo, esPeligrosa);

                    paquetesAAgregar.Add(paquete);
                    creados.Add(paquete.CodigoSeguimiento);
                }
                catch (Exception ex)
                {
                    errores.Add($"Fila {i + 1}: {ex.Message}");
                }
            }

            if (paquetesAAgregar.Count > 0)
            {
                await _enviosRepository.AddRange(paquetesAAgregar);
                await _historial.RegistrarCambiosMasivosDemoAsync(paquetesAAgregar, usuarioId);
            }

            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.CreacionEnvio,
                $"Carga masiva demo: {creados.Count} envios creados",
                contexto: $"Solicitados: {cantidad} | Fallidos: {errores.Count}");

            return new GenerarLoteDemoResult
            {
                Solicitados = cantidad,
                Creados = creados.Count,
                Fallidos = errores.Count,
                TrackingIds = creados.Take(20).ToList(),
                Errores = errores.Take(20).ToList(),
            };
        }

        public async Task<ImportarEnviosResult> ImportarDesdeExcelAsync(IEnumerable<ImportarEnvioRow> rows, Guid? usuarioId)
        {
            var detalles = new List<ImportarEnvioDetalleResult>();
            var sucursalOrigen = await ObtenerSucursalUsuarioAsync(usuarioId);
            foreach (var row in rows)
            {
                try
                {
                    if (sucursalOrigen is not null)
                    {
                        row.Request.Remitente = new RegistrarClienteRequest
                        {
                            Nombre = "Sucursal",
                            Apellido = sucursalOrigen.Nombre,
                            Direccion = sucursalOrigen.Direccion,
                            Localidad = sucursalOrigen.Ciudad,
                            CP = sucursalOrigen.CodigoPostal,
                            Provincia = sucursalOrigen.Provincia,
                            Telefono = sucursalOrigen.Telefono,
                        };
                    }
                    var creado = await RegistrarPaquete(row.Request, usuarioId);
                    detalles.Add(new ImportarEnvioDetalleResult(row.Fila, true, creado.CodigoSeguimiento, null));
                }
                catch (Exception ex)
                {
                    detalles.Add(new ImportarEnvioDetalleResult(row.Fila, false, null, ex.Message));
                }
            }

            return new ImportarEnviosResult
            {
                Procesados = detalles.Count,
                Creados = detalles.Count(d => d.Creado),
                Fallidos = detalles.Count(d => !d.Creado),
                Detalles = detalles,
            };
        }

        // G1L-12 / G1L-80
        public async Task EditarPaquete(Guid paqueteId, RegistrarPaqueteRequest request, Guid? usuarioId)
        {
            ValidarPaqueteData(request);

            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");
            await ValidarAccesoPaqueteAsync(paquete, usuarioId);

            if (paquete.Status != PaqueteStatus.PendienteDeCalendarizacion)
            {
                // G1L-80: el botón Editar ya se esconde en el front cuando isEditable=false.
                // Llegar acá implica un PUT directo a la API saltándose la UI → lo dejamos
                // registrado para el log de auditoría como intento bloqueado.
                var mensaje = MensajeBloqueoEdicion(paquete.Status);
                await _auditoria.RegistrarAsync(
                    Domain.Models.TipoAccion.Otro,
                    $"Intento de edición bloqueado sobre {paquete.CodigoSeguimiento}",
                    recursoId: paquete.CodigoSeguimiento,
                    contexto: $"Estado: {paquete.Status}");
                throw new InvalidOperationException(mensaje);
            }

            var puntoPickUp = await ResolverPuntoPickUpAsync(request.PuntoPickUpId, usuarioId);
            if (puntoPickUp is not null)
            {
                request.Destinatario.Direccion = puntoPickUp.Direccion;
                request.Destinatario.Localidad = puntoPickUp.Localidad;
                request.Destinatario.CP = puntoPickUp.CodigoPostal;
                request.Destinatario.Provincia = puntoPickUp.Provincia;
            }

            var ubicacionDestinatario = await _geocoding.GeocodeExactAsync(
                request.Destinatario.Direccion,
                request.Destinatario.Localidad,
                request.Destinatario.CP,
                request.Destinatario.Provincia);
            if (ubicacionDestinatario is null)
                throw new InvalidOperationException(
                    $"No se pudo geocodificar la dirección del destinatario: \"{request.Destinatario.Direccion}, {request.Destinatario.Localidad}\". " +
                    "Por favor, verificá que la dirección sea correcta e intentá nuevamente.");

            var distancia = DistanciasService.CalcularDistancia(request.Destinatario.Localidad);
            var prioridad = await _mlPrioridadPrediction.Predecir((float)request.Peso, distancia);
            var sucursalDestino = await ResolverSucursalDestinoAsync(request.Destinatario.Provincia, usuarioId);
            var esEnvioADomicilio = await EsEnvioADomicilioAsync(request.Destinatario.Provincia, sucursalDestino);

            paquete.ActualizarDatos(
                new Cliente(request.Remitente.Nombre, request.Remitente.Apellido, new Direccion(request.Remitente.Direccion, request.Remitente.Localidad, request.Remitente.CP, request.Remitente.Provincia), request.Remitente.Telefono, request.Remitente.Email),
                new Cliente(request.Destinatario.Nombre, request.Destinatario.Apellido, new Direccion(request.Destinatario.Direccion, request.Destinatario.Localidad, request.Destinatario.CP, request.Destinatario.Provincia, ubicacion: ubicacionDestinatario), request.Destinatario.Telefono, request.Destinatario.Email),
                request.Peso,
                request.TipoEnvio,
                request.TipoPaquete,
                request.Comentarios,
                distancia,
                prioridad);
            paquete.SucursalId = sucursalDestino?.Id;
            paquete.ProvinciaDestino = request.Destinatario.Provincia?.Trim();
            paquete.EsEnvioADomicilio = puntoPickUp is null && !paquete.PuntoPickUpId.HasValue && esEnvioADomicilio;
            paquete.ActualizarEstimacionEntrega(distancia);

            await AplicarCotizacion(paquete, request.Peso, distancia, ubicacionDestinatario, request.Destinatario.Provincia);
            if (puntoPickUp is not null)
            {
                var yaTeniaPickUp = paquete.PuntoPickUpId.HasValue;
                paquete.AsignarPuntoPickUp(puntoPickUp.Id);
                if (yaTeniaPickUp)
                    paquete.AplicarDescuentoPickUp();
            }
            else if (paquete.PuntoPickUpId.HasValue)
            {
                paquete.AplicarDescuentoPickUp();
            }

            await _historial.RegistrarCambioAsync(
                paquete.Id,
                paquete.Status,
                usuarioId,
                OrigenCambioEstado.Manual,
                "Datos del envío editados");

            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.EdicionEnvio,
                $"Editó envío {paquete.CodigoSeguimiento}",
                recursoId: paquete.CodigoSeguimiento);
        }

        // G1L-13 + G1L-9. Reglas cruzadas rol/estado:
        //   Operador / Supervisor → solo PendienteDeCalendarizacion o ListoParaSalir.
        //   Repartidor             → solo EnTransito (Entrega Fallida).
        public async Task CancelarPaquete(Guid paqueteId, string motivo, CancelarEnvioMode mode, Guid? usuarioId, bool esRepartidor)
        {
            if (string.IsNullOrWhiteSpace(motivo))
                throw new InvalidOperationException("El motivo de cancelación es obligatorio.");

            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");
            await ValidarAccesoPaqueteAsync(paquete, usuarioId);

            switch (paquete.Status)
            {
                case PaqueteStatus.PendienteDeCalendarizacion:
                    if (esRepartidor)
                        throw new InvalidOperationException("El repartidor solo puede cancelar envíos En Tránsito.");
                    paquete.Cancelar(motivo);
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, usuarioId, OrigenCambioEstado.Manual, motivo);
                    break;

                case PaqueteStatus.AsignadoAVehiculo:
                case PaqueteStatus.CargadoEnVehiculo:
                case PaqueteStatus.ListoParaSalir:
                    if (esRepartidor)
                        throw new InvalidOperationException("El repartidor solo puede cancelar envíos En Tránsito.");
                    // G1L-79: si estaba en "Cargado en Vehículo" y al cancelar deja al
                    // repartidor sin asignados sin cargar, hay que recalcular si los
                    // restantes pueden avanzar a "Listo para Salir".
                    var repartidorParaRecalculo = paquete.RepartidorAsignadoId;
                    var fechaParaRecalculo = paquete.FechaCalendarizada;
                    var debeRecalcular = paquete.Status == PaqueteStatus.AsignadoAVehiculo
                        || paquete.Status == PaqueteStatus.CargadoEnVehiculo;

                    if (mode == CancelarEnvioMode.Reagendar)
                    {
                        // G1L-68: Volver a calendarizar — limpia repartidor y fecha, vuelve a Pendiente
                        paquete.LiberarAsignacion();
                        await DesvincularDeRutasPendientes(paquete.Id);
                        await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.PendienteDeCalendarizacion, usuarioId, OrigenCambioEstado.Manual, motivo);
                        await _auditoria.RegistrarAsync(
                            Domain.Models.TipoAccion.Recalendarizacion,
                            $"Devolvió {paquete.CodigoSeguimiento} a Pendiente de Calendarización",
                            recursoId: paquete.CodigoSeguimiento,
                            contexto: $"Motivo: {motivo}");
                    }
                    else
                    {
                        paquete.Cancelar(motivo);
                        await DesvincularDeRutasPendientes(paquete.Id);
                        await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, usuarioId, OrigenCambioEstado.Manual, motivo);
                        await _auditoria.RegistrarAsync(
                            Domain.Models.TipoAccion.CancelacionEnvio,
                            $"Canceló {paquete.CodigoSeguimiento} (definitivo)",
                            recursoId: paquete.CodigoSeguimiento,
                            contexto: $"Motivo: {motivo}");
                    }

                    if (debeRecalcular && mode != CancelarEnvioMode.Reagendar)
                        await TalvezMarcarTodosListosParaSalirAsync(repartidorParaRecalculo, fechaParaRecalculo, usuarioId);
                    break;

                case PaqueteStatus.EnTransito:
                case PaqueteStatus.Demorado:
                    // G1L-9 / G1L-82 (Entrega Fallida): solo repartidor, desde tránsito o demorado.
                    if (!esRepartidor)
                        throw new InvalidOperationException("Un envío En Tránsito o Demorado solo puede cancelarlo el repartidor (Entrega Fallida).");
                    paquete.Cancelar(motivo);
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, usuarioId, OrigenCambioEstado.Manual, motivo);
                    await TalvezMarcarRetornandoAsync(paquete.RepartidorAsignadoId, paquete.FechaCalendarizada);
                    break;

                default:
                    throw new InvalidOperationException("El paquete no puede cancelarse en su estado actual desde el flujo de operación.");
            }
        }

        // Resolución de incidencia por Supervisor: puede reprogramar o cancelar envíos
        // en cualquier estado (incluyendo EnTransito/Demorado) cuando hay un incidente activo.
        public async Task ResolverIncidenteSupervisor(Guid paqueteId, string accion, string motivo, Guid? supervisorId)
        {
            if (string.IsNullOrWhiteSpace(motivo))
                throw new InvalidOperationException("El motivo es obligatorio.");

            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");
            await ValidarAccesoPaqueteAsync(paquete, supervisorId);

            if (paquete.Status == PaqueteStatus.Entregado)
                throw new InvalidOperationException("No se puede actuar sobre un envío ya entregado.");

            if (accion == "Reprogramar")
            {
                paquete.LiberarAsignacion();
                await DesvincularDeRutasPendientes(paquete.Id);
                await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.PendienteDeCalendarizacion, supervisorId, OrigenCambioEstado.Manual, motivo);
                await _auditoria.RegistrarAsync(
                    Domain.Models.TipoAccion.Recalendarizacion,
                    $"Supervisor reprogramó {paquete.CodigoSeguimiento} por incidente: {motivo}",
                    recursoId: paquete.CodigoSeguimiento);
            }
            else if (accion == "Cancelar")
            {
                paquete.Cancelar(motivo);
                await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, supervisorId, OrigenCambioEstado.Manual, motivo);
                await _auditoria.RegistrarAsync(
                    Domain.Models.TipoAccion.CancelacionEnvio,
                    $"Supervisor canceló {paquete.CodigoSeguimiento} por incidente: {motivo}",
                    recursoId: paquete.CodigoSeguimiento);
            }
            else
            {
                throw new InvalidOperationException("Acción no válida. Use 'Reprogramar' o 'Cancelar'.");
            }
        }

        // G1L-9: Repartidor cambia estado del paquete.
        public async Task CambiarEstadoPorRepartidor(Guid paqueteId, PaqueteStatus destino, string? motivo, Guid? usuarioId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");
            await ValidarAccesoPaqueteAsync(paquete, usuarioId);

            switch (destino)
            {
                case PaqueteStatus.EnTransito:
                    paquete.IniciarTransito();
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.EnTransito, usuarioId, OrigenCambioEstado.Manual);
                    break;

                case PaqueteStatus.Entregado:
                    paquete.Entregar();
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Entregado, usuarioId, OrigenCambioEstado.Manual);
                    await _auditoria.RegistrarAsync(
                        Domain.Models.TipoAccion.Notificacion,
                        $"Notificacion al repartidor: parada entregada {paquete.CodigoSeguimiento}",
                        recursoId: paquete.CodigoSeguimiento,
                        contexto: "Rol destino: Repartidor");
                    await TalvezMarcarRetornandoAsync(paquete.RepartidorAsignadoId, paquete.FechaCalendarizada);
                    break;

                case PaqueteStatus.Cancelado:
                    if (string.IsNullOrWhiteSpace(motivo))
                        throw new InvalidOperationException("Se requiere un motivo para cancelar la entrega.");
                    // G1L-82: la entrega fallida es válida desde EnTransito y desde Demorado.
                    if (paquete.Status != PaqueteStatus.EnTransito && paquete.Status != PaqueteStatus.Demorado)
                        throw new InvalidOperationException("Solo se puede cancelar una entrega en tránsito o demorada.");
                    paquete.Cancelar(motivo);
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, usuarioId, OrigenCambioEstado.Manual, motivo);
                    await TalvezMarcarRetornandoAsync(paquete.RepartidorAsignadoId, paquete.FechaCalendarizada);
                    break;

                default:
                    throw new InvalidOperationException("Transición de estado no válida.");
            }
        }

        // G1L-82: marcar un envío como "Demorado" (Repartidor o Supervisor).
        public async Task MarcarDemoradoAsync(Guid paqueteId, string motivo, Guid? usuarioId, string rolUsuario)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");
            await ValidarAccesoPaqueteAsync(paquete, usuarioId);

            paquete.MarcarDemorado(motivo);
            await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Demorado, usuarioId, OrigenCambioEstado.Manual, motivo);
            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.CambioEstadoEnvio,
                $"Marcó {paquete.CodigoSeguimiento} como Demorado",
                recursoId: paquete.CodigoSeguimiento,
                contexto: $"Rol: {rolUsuario} | Motivo: {motivo}");
        }

        // G1L-82: el repartidor retoma el recorrido tras resolver el imprevisto.
        public async Task ContinuarTransitoAsync(Guid paqueteId, Guid? usuarioId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");
            await ValidarAccesoPaqueteAsync(paquete, usuarioId);

            paquete.ContinuarTransito();
            await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.EnTransito, usuarioId, OrigenCambioEstado.Manual, "Continuación de ruta tras demora");
            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.CambioEstadoEnvio,
                $"Retomó la ruta del envío {paquete.CodigoSeguimiento} (de Demorado a En Tránsito)",
                recursoId: paquete.CodigoSeguimiento);
        }

        // G1L-43: Escaneo QR con estados intermedios
        public async Task<EscaneoResultado> EscanearQr(string codigoSeguimiento, Guid? usuarioId)
        {
            var paquete = await _enviosRepository.GetPaqueteByCodigoSeguimiento(codigoSeguimiento)
                ?? throw new InvalidOperationException("No se encontró un envío con ese código.");
            await ValidarAccesoPaqueteAsync(paquete, usuarioId);

            switch (paquete.Status)
            {
                case PaqueteStatus.AsignadoAVehiculo:
                    paquete.CambiarEstado(PaqueteStatus.CargadoEnVehiculo);
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.CargadoEnVehiculo, usuarioId, OrigenCambioEstado.QR);
                    await _auditoria.RegistrarAsync(
                        Domain.Models.TipoAccion.CambioEstadoEnvio,
                        $"Cargó {paquete.CodigoSeguimiento} en vehículo (escaneo QR)",
                        recursoId: paquete.CodigoSeguimiento);
                    await TalvezMarcarTodosListosParaSalirAsync(paquete.RepartidorAsignadoId, paquete.FechaCalendarizada, usuarioId);
                    return new EscaneoResultado
                    {
                        Status = paquete.Status,
                        Accion = "Cargado",
                        CodigoSeguimiento = paquete.CodigoSeguimiento,
                        PaqueteId = paquete.Id,
                    };

                case PaqueteStatus.CargadoEnVehiculo:
                    throw new InvalidOperationException("El paquete ya está cargado en el vehículo. Esperá a que todos los del día estén cargados para que pase a 'Listo para Salir'.");

                case PaqueteStatus.ListoParaSalir:
                    // G1L-43: la transición Listo→En Tránsito se dispara con el botón
                    // "Inicializar Ruta" desde el panel del repartidor, no por escaneo QR.
                    throw new InvalidOperationException(
                        "Para iniciar el tránsito de tus paquetes usá el botón 'Inicializar Ruta' desde tu panel.");

                case PaqueteStatus.EnTransito:
                    return new EscaneoResultado
                    {
                        Status = paquete.Status,
                        Accion = "AbrirFichaEntrega",
                        CodigoSeguimiento = paquete.CodigoSeguimiento,
                        PaqueteId = paquete.Id,
                    };

                case PaqueteStatus.PendienteDeCalendarizacion:
                    throw new InvalidOperationException("El paquete aún no está listo para ser cargado.");

                default:
                    throw new InvalidOperationException($"El paquete está en estado {paquete.Status} y no puede escanearse.");
            }
        }

        // G1L-43: el repartidor inicia su ruta del día. Toma todos los paquetes en
        // "Listo para Salir" para esa fecha y los pasa a "En Tránsito" en bloque.
        // Se queda como responsable él mismo (ya está asignado por la calendarización).
        public async Task<int> IniciarRutaDelDiaAsync(Guid repartidorId, DateTime fecha, Guid? usuarioId)
        {
            if (fecha.Date != OperationalClock.TodayUtcDate)
                throw new InvalidOperationException("Solo podés iniciar la ruta del día actual.");

            var paquetesDia = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(repartidorId, fecha);
            var listos = paquetesDia.Where(p => p.Status == PaqueteStatus.ListoParaSalir).ToList();

            if (listos.Count == 0)
                throw new InvalidOperationException(
                    "No tenés paquetes en estado 'Listo para Salir' para iniciar la ruta. " +
                    "Asegurate de haber escaneado todos los paquetes del día.");

            foreach (var p in listos)
            {
                p.IniciarTransito();
                await _historial.RegistrarCambioAsync(
                    p.Id, PaqueteStatus.EnTransito, usuarioId, OrigenCambioEstado.Manual, "Inicializar Ruta");
            }

            // Fase A: el repartidor entra "EnRuta" (jornada activa).
            if (await _userRepository.GetUsuarioById(repartidorId) is Repartidor rep)
                rep.IniciarJornada();

            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.CambioEstadoEnvio,
                $"Inicializó la ruta del día: {listos.Count} envíos pasaron a 'En Tránsito'",
                contexto: $"Repartidor {repartidorId} fecha {fecha:yyyy-MM-dd}");

            return listos.Count;
        }

        // Fase A: el repartidor confirma que volvió a la sucursal → queda disponible
        // para recibir nuevos envíos calendarizados del día.
        public async Task CerrarJornadaAsync(Guid repartidorId)
        {
            if (await _userRepository.GetUsuarioById(repartidorId) is not Repartidor rep)
                throw new InvalidOperationException("Repartidor no encontrado.");
            rep.CerrarJornada();
            await _ojoPatron.InvalidarPruebasAprobadasDelDiaAsync(repartidorId, OperationalClock.TodayUtcDate);
            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.CambioEstadoEnvio,
                "Repartidor cerró su jornada (volvió a la sucursal)",
                contexto: $"Repartidor {repartidorId}");
        }

        // Fase A: si todas las paradas del repartidor para esa fecha están finalizadas
        // (Entregado/Cancelado), pasa a "Retornando" → deja de recibir envíos nuevos.
        private async Task TalvezMarcarRetornandoAsync(Guid? repartidorId, DateTime? fecha)
        {
            if (!repartidorId.HasValue || !fecha.HasValue) return;
            var paquetesDia = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(repartidorId.Value, fecha.Value);
            if (paquetesDia.Count == 0) return;
            var todasFinalizadas = paquetesDia.All(p =>
                p.Status == PaqueteStatus.Entregado || p.Status == PaqueteStatus.Cancelado);
            if (!todasFinalizadas) return;

            if (await _userRepository.GetUsuarioById(repartidorId.Value) is Repartidor rep
                && rep.EstadoJornada == Repartidor.EstadoJornadaRepartidor.EnRuta)
            {
                rep.MarcarRetornando();
            }
        }

        // Cuando todos los paquetes del repartidor para esa fecha están "Cargados", pasa todos a "Listo para Salir".
        private async Task TalvezMarcarTodosListosParaSalirAsync(Guid? repartidorId, DateTime? fecha, Guid? usuarioId)
        {
            if (!repartidorId.HasValue || !fecha.HasValue) return;
            var paquetesDia = await _enviosRepository.GetPaquetesAsignadosARepartidorEnFecha(repartidorId.Value, fecha.Value);
            // Si quedan asignados sin cargar todavía, no avanzamos
            if (paquetesDia.Any(p => p.Status == PaqueteStatus.AsignadoAVehiculo)) return;

            var aListos = paquetesDia.Where(p => p.Status == PaqueteStatus.CargadoEnVehiculo).ToList();
            if (aListos.Count == 0) return;

            foreach (var p in aListos)
            {
                p.CambiarEstado(PaqueteStatus.ListoParaSalir);
                await _historial.RegistrarCambioAsync(p.Id, PaqueteStatus.ListoParaSalir, usuarioId, OrigenCambioEstado.Sistema, "Avance automático tras cargar el último");
            }
            await _auditoria.RegistrarAsync(
                Domain.Models.TipoAccion.CambioEstadoEnvio,
                $"Avance automático: {aListos.Count} envíos pasaron a 'Listo para Salir'",
                contexto: $"Repartidor {repartidorId.Value} fecha {fecha.Value:yyyy-MM-dd}");
        }

        public async Task ReasignarRuta(Guid rutaId, Guid repartidorId)
        {
            var ruta = await _rutasRepository.GetRutaById(rutaId)
                ?? throw new InvalidOperationException("Ruta no encontrada");

            var usuario = await _userRepository.GetUsuarioById(repartidorId);

            if (usuario is null || usuario is not Repartidor repartidor)
                throw new InvalidOperationException("Repartidor no encontrado");

            if (!repartidor.PuedeSerAsignado)
                throw new InvalidOperationException("El repartidor está suspendido o inhabilitado y no puede recibir rutas.");

            ruta.ReasignarRepartidor(repartidor);
            await _rutasRepository.Add(ruta);
        }

        private async Task DesvincularDeRutasPendientes(Guid paqueteId)
        {
            var rutas = await _rutasRepository.GetRutasPendientesConPaquete(paqueteId);
            foreach (var ruta in rutas)
            {
                var paquete = ruta.Paquetes.FirstOrDefault(p => p.Id == paqueteId);
                if (paquete is not null) ruta.Paquetes.Remove(paquete);
            }
        }

        // G1L-80: mensajes específicos según el estado bloqueado.
        // Solo genera hacia provincias cubiertas por sucursales activas en el sistema.
        private async Task<List<DemoAddress>> ObtenerDireccionesDemoHabilitadasAsync(Guid? usuarioId)
        {
            var disponibles = DireccionesDemo();
            var sucursalUsuario = await ObtenerSucursalUsuarioAsync(usuarioId);
            if (sucursalUsuario is not null)
            {
                return disponibles
                    .Where(d => CubreAcentoInsensible(sucursalUsuario, d.Provincia))
                    .ToList();
            }

            var sucursales = (await _enviosRepository.GetSucursales())
                .Where(s => s.Estado == SucursalStatus.Activa)
                .ToList();

            if (sucursales.Count == 0) return disponibles; // fallback si no hay ninguna

            return disponibles
                .Where(d => sucursales.Any(s => CubreAcentoInsensible(s, d.Provincia)))
                .ToList();
        }

        private static bool CubreAcentoInsensible(Sucursal sucursal, string provinciaAddress)
        {
            var norm = NormalizarProvincia(provinciaAddress);
            if (NormalizarProvincia(sucursal.Provincia) == norm) return true;
            return sucursal.ProvinciasCubiertas.Any(p => NormalizarProvincia(p) == norm);
        }

        private static string NormalizarProvincia(string? p)
        {
            if (string.IsNullOrWhiteSpace(p)) return string.Empty;
            var normalized = p.Trim().ToLowerInvariant();
            // Strip common accents
            normalized = normalized
                .Replace('á', 'a').Replace('é', 'e').Replace('í', 'i')
                .Replace('ó', 'o').Replace('ú', 'u').Replace('ü', 'u').Replace('ñ', 'n');
            return normalized;
        }

        private async Task<Sucursal?> ObtenerSucursalUsuarioAsync(Guid? usuarioId)
        {
            if (!usuarioId.HasValue) return null;

            var usuario = await _userRepository.GetUsuarioById(usuarioId.Value);
            if (usuario?.SucursalId is not Guid sucursalId) return null;

            return (await _enviosRepository.GetSucursales()).FirstOrDefault(s => s.Id == sucursalId);
        }

        private static (string, string, string, string, string, string, string) CrearRemitenteDemo(Sucursal? sucursal, DemoAddress destino)
        {
            if (sucursal is not null)
                return ("Sucursal", sucursal.Nombre, sucursal.Direccion, sucursal.Ciudad, sucursal.CodigoPostal, sucursal.Telefono, sucursal.Provincia ?? string.Empty);

            return ("Centro", "Logistico", destino.Direccion, destino.Localidad, destino.CP, destino.Telefono, destino.Provincia);
        }

        // Direcciones demo por provincia — cubre todas las sucursales seeded.
        // El generador masivo cicla con i % Count, así que con 8+ por provincia
        // los 1000 envíos tienen buena variedad de destinos.
        private static List<DemoAddress> DireccionesDemo() => DemoAddressesCache.Value.ToList();

        private static List<DemoAddress> CargarDireccionesDemoBase()
        {
            var paths = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "Infrastructure", "Data", "demo-addresses.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "Infrastructure", "Data", "demo-addresses.json"),
            };

            foreach (var path in paths.Distinct())
            {
                if (!File.Exists(path)) continue;

                try
                {
                    var json = File.ReadAllText(path);
                    var items = JsonSerializer.Deserialize<List<DemoAddressDto>>(json, new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true,
                    }) ?? new List<DemoAddressDto>();

                    var mapped = items
                        .Where(i => !string.IsNullOrWhiteSpace(i.Provincia)
                            && !string.IsNullOrWhiteSpace(i.Localidad)
                            && !string.IsNullOrWhiteSpace(i.CP)
                            && !string.IsNullOrWhiteSpace(i.Direccion))
                        .Select(i => new DemoAddress(
                            i.Provincia!.Trim(),
                            i.Localidad!.Trim(),
                            i.CP!.Trim(),
                            i.Direccion!.Trim(),
                            i.Latitud,
                            i.Longitud,
                            string.IsNullOrWhiteSpace(i.Nombre) ? "Cliente" : i.Nombre!.Trim(),
                            string.IsNullOrWhiteSpace(i.Apellido) ? "Demo" : i.Apellido!.Trim(),
                            string.IsNullOrWhiteSpace(i.Telefono) ? "1100000000" : i.Telefono!.Trim()))
                        .ToList();

                    if (mapped.Count > 0) return mapped;
                }
                catch
                {
                    // Si el archivo externo falla, queda el fallback compilado.
                }
            }

            return DireccionesDemoFallback();
        }

        private static List<DemoAddress> ExpandirDireccionesDemo(List<DemoAddress> bases)
        {
            var nombres = new[] { "Sofia", "Diego", "Martina", "Lucas", "Valentina", "Tomas", "Camila", "Mateo", "Lucia", "Joaquin", "Paula", "Nicolas" };
            var apellidos = new[] { "Gomez", "Rios", "Herrera", "Sosa", "Torres", "Vega", "Molina", "Castro", "Romero", "Silva", "Acosta", "Medina" };
            var result = new List<DemoAddress>();

            foreach (var grupo in bases.GroupBy(x => NormalizarProvincia(x.Provincia)))
            {
                var baseProvincia = grupo.ToList();
                var variantsPerBase = Math.Max(1, (int)Math.Ceiling(DemoAddressesPerProvince / (double)baseProvincia.Count));
                var creadasProvincia = 0;

                for (var baseIndex = 0; baseIndex < baseProvincia.Count && creadasProvincia < DemoAddressesPerProvince; baseIndex++)
                {
                    var seed = baseProvincia[baseIndex];
                    for (var variant = 0; variant < variantsPerBase && creadasProvincia < DemoAddressesPerProvince; variant++)
                    {
                        var offset = ((variant * 17) + (baseIndex * 31)) % 1800;
                        result.Add(new DemoAddress(
                            seed.Provincia,
                            seed.Localidad,
                            seed.CP,
                            VariarDireccion(seed.Direccion, offset),
                            seed.Latitud + (((variant % 9) - 4) * 0.00035),
                            seed.Longitud + ((((variant / 9) % 9) - 4) * 0.00035),
                            nombres[(baseIndex + variant) % nombres.Length],
                            apellidos[(baseIndex * 3 + variant) % apellidos.Length],
                            VariarTelefono(seed.Telefono, baseIndex, variant)));
                        creadasProvincia++;
                    }
                }
            }

            return result;
        }

        private static string VariarDireccion(string direccion, int offset)
        {
            if (offset == 0) return direccion;
            var regex = new Regex(@"\d+");
            return regex.Replace(direccion, m =>
            {
                return int.TryParse(m.Value, out var numero)
                    ? (numero + offset).ToString(CultureInfo.InvariantCulture)
                    : m.Value;
            }, 1);
        }

        private static string VariarTelefono(string telefono, int baseIndex, int variant)
        {
            var digits = Regex.Replace(telefono, @"\D", string.Empty);
            if (digits.Length < 6) digits = "1100000000";
            var suffix = ((baseIndex * 1000 + variant) % 10000).ToString("0000", CultureInfo.InvariantCulture);
            return digits.Length > 4 ? digits[..^4] + suffix : digits + suffix;
        }

        private static List<DemoAddress> DireccionesDemoFallback() => new()
        {
            // ── Buenos Aires ─────────────────────────────────────────────────
            new("Buenos Aires", "La Plata",            "1900", "Calle 12 800",           -34.9214, -57.9544, "Camila",    "Torres",   "2214551200"),
            new("Buenos Aires", "Hurlingham",           "1686", "Av. Vergara 2400",        -34.5885, -58.6324, "Martin",    "Rios",     "1145512001"),
            new("Buenos Aires", "Mar del Plata",        "7600", "Av. Luro 3050",           -38.0023, -57.5575, "Lucia",     "Mendez",   "2234551202"),
            new("Buenos Aires", "Quilmes",              "1878", "Rivadavia 450",           -34.7224, -58.2526, "Sebastian", "Flores",   "1145512003"),
            new("Buenos Aires", "Lomas de Zamora",      "1832", "San Martin 1234",         -34.7592, -58.4021, "Valentina", "Cruz",     "1145512004"),
            new("Buenos Aires", "Avellaneda",           "1870", "Mitre 567",              -34.6641, -58.3617, "Diego",     "Mendez",   "1145512005"),
            new("Buenos Aires", "Lanús",                "1824", "Rivadavia 2340",          -34.7046, -58.3974, "Lucia",     "Herrera",  "1145512006"),
            new("Buenos Aires", "Florencio Varela",     "1888", "Corrientes 890",          -34.8074, -58.2771, "Facundo",   "Torres",   "1145512007"),
            new("Buenos Aires", "Berazategui",          "1880", "Moreno 456",             -34.7600, -58.2109, "Gabriela",  "Sanchez",  "1145512008"),
            new("Buenos Aires", "Tigre",                "1648", "Av. Cazón 1200",          -34.4260, -58.5797, "Ramiro",    "Blanco",   "1145512009"),
            new("Buenos Aires", "Morón",                "1708", "Av. Rivadavia 8800",      -34.6524, -58.6193, "Beatriz",   "Gomez",    "1145512010"),
            new("Buenos Aires", "San Isidro",           "1642", "Av. del Libertador 1500", -34.4727, -58.5302, "Pablo",     "Ibarra",   "1145512011"),

            // ── Córdoba ──────────────────────────────────────────────────────
            new("Córdoba", "Córdoba Capital",    "5000", "Av. Colón 500",          -31.4135, -64.1888, "Julian",    "Acosta",   "3514551205"),
            new("Córdoba", "Córdoba Capital",    "5000", "Bv. San Juan 1100",      -31.4251, -64.1817, "Marcela",   "Peralta",  "3514551206"),
            new("Córdoba", "Río Cuarto",         "5800", "Av. Hipólito Yrigoyen 900", -33.1234, -64.3493, "Ariel",  "Dominguez","3584551207"),
            new("Córdoba", "Villa María",        "5900", "Av. Sabattini 450",       -32.4075, -63.2435, "Daniela",   "Ruiz",     "3534551208"),
            new("Córdoba", "Villa Carlos Paz",   "5152", "Av. San Martín 600",      -31.4221, -64.4979, "Gustavo",   "Soto",     "3544551209"),
            new("Córdoba", "Alta Gracia",        "5186", "Urquiza 300",             -31.6557, -64.4299, "Florencia", "Vega",     "3547551210"),
            new("Córdoba", "San Francisco",      "2400", "9 de Julio 800",          -31.4261, -62.0806, "Rodrigo",   "Cano",     "3564551211"),
            new("Córdoba", "Bell Ville",         "2550", "Av. Vélez Sarsfield 200", -32.6267, -62.6884, "Lorena",    "Medina",   "3537551212"),

            // ── Santa Fe ─────────────────────────────────────────────────────
            new("Santa Fe", "Rosario",           "2000", "Bv. Oroño 1100",          -32.9442, -60.6505, "Valentina", "Molina",   "3414551206"),
            new("Santa Fe", "Rosario",           "2000", "San Lorenzo 800",         -32.9468, -60.6357, "Agustin",   "Benitez",  "3414551207"),
            new("Santa Fe", "Santa Fe Capital",  "3000", "Bv. Pellegrini 2500",     -31.6333, -60.7000, "Carolina",  "Vega",     "3424551208"),
            new("Santa Fe", "Santa Fe Capital",  "3000", "Av. Freyre 1200",         -31.6277, -60.6989, "Nicolas",   "Ponce",    "3424551209"),
            new("Santa Fe", "Rafaela",           "2300", "Bv. Santa Fe 800",        -31.2519, -61.4874, "Luciana",   "Gimenez",  "3492551210"),
            new("Santa Fe", "Venado Tuerto",     "2600", "Av. Presidente Perón 600",-33.7463, -61.9653, "Ezequiel",  "Herrera",  "3462551211"),
            new("Santa Fe", "Reconquista",       "3560", "Av. Rivadavia 400",       -29.1449, -59.6430, "Paola",     "Ibañez",   "3482551212"),
            new("Santa Fe", "Santo Tomé",        "3016", "San Martín 700",          -31.6604, -60.7671, "Fernando",  "Salas",    "3422551213"),

            // ── Mendoza ──────────────────────────────────────────────────────
            new("Mendoza", "Mendoza Capital",    "5500", "San Martín 1200",         -32.8895, -68.8458, "Pablo",     "Sosa",     "2614551207"),
            new("Mendoza", "Mendoza Capital",    "5500", "Av. Las Heras 600",       -32.8833, -68.8500, "Claudio",   "Ojeda",    "2614551208"),
            new("Mendoza", "Godoy Cruz",         "5501", "Av. San Martín 3800",     -32.9272, -68.8448, "Lorena",    "Quiroga",  "2614551209"),
            new("Mendoza", "San Rafael",         "5600", "Av. Hipólito Yrigoyen 350",-34.6178,-68.3298,"Emiliano",   "Aranda",   "2604551210"),
            new("Mendoza", "Luján de Cuyo",      "5507", "Av. San Martín 1100",     -33.0566, -68.8784, "Mariela",   "Blanco",   "2614551211"),
            new("Mendoza", "Guaymallén",         "5521", "Av. Acceso Este 1800",    -32.8937, -68.7862, "Santiago",  "Castro",   "2614551212"),
            new("Mendoza", "Maipú",              "5515", "Urquiza 900",             -32.9786, -68.7878, "Veronica",  "Ramos",    "2614551213"),
            new("Mendoza", "Las Heras",          "5539", "Av. Champagnat 1500",     -32.8421, -68.8318, "Roberto",   "Diaz",     "2614551214"),

            // ── Tucumán ──────────────────────────────────────────────────────
            new("Tucumán", "San Miguel de Tucumán", "4000", "24 de Septiembre 600",  -26.8241, -65.2226, "Natalia",   "Paz",      "3814551208"),
            new("Tucumán", "San Miguel de Tucumán", "4000", "Congreso 1200",         -26.8291, -65.2170, "Sebastian", "Chavez",   "3814551209"),
            new("Tucumán", "Yerba Buena",           "4107", "Av. Aconquija 3500",    -26.8162, -65.2751, "Mariana",   "Acosta",   "3814551210"),
            new("Tucumán", "Tafí Viejo",            "4103", "Alem 800",              -26.7277, -65.2582, "Facundo",   "Rivero",   "3814551211"),
            new("Tucumán", "Concepción",            "4100", "Av. Belgrano 600",      -27.3355, -65.5940, "Yanina",    "Campos",   "3865551212"),
            new("Tucumán", "Banda del Río Salí",    "4006", "Av. 25 de Mayo 1000",   -26.8388, -65.1740, "Ernesto",   "Gutierrez","3814551213"),
            new("Tucumán", "Aguilares",             "4200", "San Martín 400",        -27.4325, -65.6124, "Cecilia",   "Lopez",    "3865551214"),
            new("Tucumán", "Monteros",              "4142", "Belgrano 700",          -27.1654, -65.4934, "Alberto",   "Perez",    "3863551215"),

            // ── Catamarca ────────────────────────────────────────────────────
            new("Catamarca", "San Fernando del Valle de Catamarca", "4700", "Av. Güemes 650",       -28.4696, -65.7795, "Sofia",     "Herrera",  "3834551203"),
            new("Catamarca", "Valle Viejo",          "4707", "Av. Presidente Castillo 1200", -28.4691, -65.7206, "Diego",  "Nunez",    "3834551204"),
            new("Catamarca", "San Fernando del Valle de Catamarca", "4700", "Sarmiento 900",         -28.4723, -65.7868, "Oscar",     "Heredia",  "3834551205"),
            new("Catamarca", "San Fernando del Valle de Catamarca", "4700", "República 400",          -28.4660, -65.7805, "Paola",     "Juarez",   "3834551206"),
            new("Catamarca", "Recreo",               "4650", "Av. del Bicentenario 200", -29.2807, -65.0618, "Ezequiel","Valdez",    "3837551207"),
            new("Catamarca", "Tinogasta",            "5340", "Av. San Martín 600",     -28.0644, -67.5699, "Micaela",   "Gimenez",  "3835551208"),
            new("Catamarca", "Belén",                "4750", "General Roca 300",       -27.6491, -67.0271, "Hector",    "Mansilla",  "3835551209"),
            new("Catamarca", "Santa María",          "4163", "Buenos Aires 450",       -26.6823, -66.0392, "Graciela",  "Ruiz",     "3838551210"),

            // ── Salta ─────────────────────────────────────────────────────────
            new("Salta", "Salta Capital",       "4400", "Caseros 900",              -24.7897, -65.4105, "Bruno",     "Vega",     "3874551209"),
            new("Salta", "Salta Capital",       "4400", "España 600",               -24.7921, -65.4071, "Diego",     "Flores",   "3874551210"),
            new("Salta", "San Ramón de la Nueva Orán", "4530", "Alvarado 700",      -23.1333, -64.3253, "Karina",    "Vargas",   "3878551211"),
            new("Salta", "Tartagal",            "4560", "Av. 9 de Julio 1200",      -22.5233, -63.8000, "Walter",    "Morales",  "3876551212"),
            new("Salta", "General Güemes",      "4450", "Belgrano 400",             -24.6707, -65.0509, "Silvina",   "Castillo", "3876551213"),
            new("Salta", "Rosario de la Frontera", "4760", "San Martín 800",        -25.8058, -64.9715, "Edgardo",   "Palacios", "3876551214"),
            new("Salta", "Embarcación",         "4550", "Urquiza 300",              -23.2167, -64.1000, "Ramira",    "Saenz",    "3877551215"),
            new("Salta", "Metán",               "4530", "9 de Julio 600",           -25.4931, -64.9722, "Ignacio",   "Torino",   "3876551216"),

            // ── Neuquén ──────────────────────────────────────────────────────
            new("Neuquén", "Neuquén Capital",   "8300", "Av. Argentina 400",        -38.9516, -68.0591, "Rocio",     "Luna",     "2994551210"),
            new("Neuquén", "Neuquén Capital",   "8300", "Roca 1200",                -38.9540, -68.0628, "Ariel",     "Cano",     "2994551211"),
            new("Neuquén", "Cipolletti",        "8324", "Av. Roca 600",             -38.9370, -67.9910, "Mariana",   "Diaz",     "2994551212"),
            new("Neuquén", "Centenario",        "8309", "San Martín 450",           -38.8292, -68.1310, "Javier",    "Gomez",    "2994551213"),

            // ── Entre Ríos ───────────────────────────────────────────────────
            new("Entre Ríos", "Paraná",         "3100", "Urquiza 950",              -31.7413, -60.5115, "Emilia",    "Castro",   "3434551211"),
            new("Entre Ríos", "Paraná",         "3100", "San Martín 1200",          -31.7385, -60.5146, "Rodrigo",   "Suarez",   "3434551212"),
            new("Entre Ríos", "Concordia",      "3200", "Av. Urquiza 1800",         -31.3932, -58.0223, "Lucia",     "Fernandez","3454551213"),
            new("Entre Ríos", "Gualeguaychú",   "2820", "Andrade 600",              -33.0052, -58.5153, "Pablo",     "Mendez",   "3446551214"),

            // ── Misiones ─────────────────────────────────────────────────────
            new("Misiones", "Posadas",           "3300", "Av. Roque Pérez 1200",     -27.3671, -55.8962, "Veronica",  "Alderete", "3764551300"),
            new("Misiones", "Posadas",           "3300", "Bolívar 800",              -27.3710, -55.8972, "Carlos",    "Bejarano", "3764551301"),
            new("Misiones", "Oberá",             "3360", "Av. Libertad 600",         -27.4869, -55.1196, "Liliana",   "Gimenez",  "3755551302"),
            new("Misiones", "Eldorado",          "3380", "Av. San Martín 1100",      -26.4044, -54.6269, "Marcos",    "Rueda",    "3751551303"),
            new("Misiones", "Puerto Iguazú",     "3370", "Av. Victoria Aguirre 300", -25.5972, -54.5788, "Patricia",  "Rojas",    "3757551304"),
            new("Misiones", "Apóstoles",         "3316", "San Martín 500",           -27.9148, -55.7622, "Esteban",   "Miño",     "3758551305"),
            new("Misiones", "Jardín América",    "3328", "Av. Independencia 800",    -27.0433, -55.2271, "Natalia",   "Acuña",    "3751551306"),
            new("Misiones", "Leandro N. Alem",   "3315", "Belgrano 700",             -27.5971, -55.3283, "Hugo",      "Pucheta",  "3754551307"),

            // ── Corrientes ───────────────────────────────────────────────────
            new("Corrientes", "Corrientes Capital","3400", "Junín 1000",              -27.4696, -58.8341, "Adriana",   "Vallejos", "3794551400"),
            new("Corrientes", "Corrientes Capital","3400", "Carlos Pellegrini 600",   -27.4723, -58.8310, "Gustavo",   "Leiva",    "3794551401"),
            new("Corrientes", "Goya",             "3450", "25 de Mayo 800",           -29.1427, -59.2637, "Miriam",    "Portillo", "3777551402"),
            new("Corrientes", "Paso de los Libres","3230", "Av. Lavalle 1400",        -29.7118, -57.0794, "Fernando",  "Aquino",   "3772551403"),
            new("Corrientes", "Curuzú Cuatiá",    "3460", "Av. San Martín 500",      -29.7919, -58.0541, "Rosa",      "Sandoval", "3774551404"),
            new("Corrientes", "Mercedes",         "3470", "Belgrano 900",             -29.1862, -58.0783, "Daniel",    "Vera",     "3773551405"),

            // ── Chaco ────────────────────────────────────────────────────────
            new("Chaco", "Resistencia",           "3500", "Av. 9 de Julio 1100",      -27.4514, -58.9862, "Oscar",     "Benítez",  "3624551500"),
            new("Chaco", "Resistencia",           "3500", "San Martín 700",           -27.4539, -58.9831, "Hilda",     "Chamorro", "3624551501"),
            new("Chaco", "Presidencia R. S. Peña","3700", "Av. Belgrano 900",         -26.7924, -60.4424, "Reinaldo",  "Cáceres",  "3732551502"),
            new("Chaco", "Villa Ángela",          "3540", "Salta 600",                -27.5694, -60.7180, "Claudia",   "Encina",   "3735551503"),
            new("Chaco", "Charata",               "3730", "Av. Rivadavia 800",        -27.2154, -61.1882, "Abelardo",  "Godoy",    "3731551504"),

            // ── Jujuy ────────────────────────────────────────────────────────
            new("Jujuy", "San Salvador de Jujuy", "4600", "Belgrano 1200",            -24.1858, -65.2995, "Alicia",    "Mamani",   "3884551600"),
            new("Jujuy", "San Salvador de Jujuy", "4600", "Gorriti 800",              -24.1871, -65.3012, "Ernesto",   "Condori",  "3884551601"),
            new("Jujuy", "San Pedro de Jujuy",    "4630", "Av. Libertad 500",         -24.2264, -64.8685, "Yolanda",   "Flores",   "3886551602"),
            new("Jujuy", "Palpalá",               "4612", "San Martín 900",           -24.2535, -65.2173, "Domingo",   "Quispe",   "3884551603"),
            new("Jujuy", "La Quiaca",             "4650", "Belgrano 300",             -22.1029, -65.5967, "Juana",     "Llanos",   "3887551604"),

            // ── Santiago del Estero ──────────────────────────────────────────
            new("Santiago del Estero", "Santiago del Estero Capital", "4200", "Av. Belgrano 500", -27.7951, -64.2615, "Mario",    "Juárez",   "3854551700"),
            new("Santiago del Estero", "Santiago del Estero Capital", "4200", "Independencia 900",-27.7978, -64.2647, "Beatriz",  "Nassif",   "3854551701"),
            new("Santiago del Estero", "La Banda",  "4300", "Av. 9 de Julio 700",     -27.7353, -64.2477, "Ramón",     "Soria",    "3854551702"),
            new("Santiago del Estero", "Termas de Río Hondo","4220","Alberdi 400",     -27.4941, -64.8590, "Carmen",    "Taboada",  "3858551703"),
            new("Santiago del Estero", "Frías",     "4230", "Buenos Aires 600",       -28.6497, -65.1495, "Adolfo",    "Figueroa", "3843551704"),

            // ── La Rioja ─────────────────────────────────────────────────────
            new("La Rioja", "La Rioja Capital",   "5300", "Av. Ortiz de Ocampo 1200", -29.4133, -66.8563, "Sandra",    "Araoz",    "3822551800"),
            new("La Rioja", "La Rioja Capital",   "5300", "San Nicolás de Bari 600",  -29.4158, -66.8590, "Leandro",   "Barraza",  "3822551801"),
            new("La Rioja", "Chilecito",          "5360", "Libertad 800",             -29.1618, -67.4955, "Estela",    "Perez",    "3825551802"),
            new("La Rioja", "Aimogasta",          "5330", "San Martín 400",           -28.5604, -66.8125, "Roberto",   "Ontiveros","3827551803"),

            // ── San Juan ─────────────────────────────────────────────────────
            new("San Juan", "San Juan Capital",   "5400", "Av. Ignacio de la Roza 800",  -31.5375, -68.5364, "Adrián",  "Lucero",   "2644551900"),
            new("San Juan", "San Juan Capital",   "5400", "Rivadavia 1200",           -31.5392, -68.5399, "Celeste",   "Maldonado","2644551901"),
            new("San Juan", "Rawson",             "5409", "Sarmiento 600",            -31.5773, -68.5358, "Horacio",   "Sánchez",  "2644551902"),
            new("San Juan", "Caucete",            "5440", "25 de Mayo 400",           -31.6517, -68.2802, "Liliana",   "Rojas",    "2646551903"),

            // ── San Luis ─────────────────────────────────────────────────────
            new("San Luis", "San Luis Capital",   "5700", "Colón 1100",               -33.2950, -66.3356, "Nicolás",   "Agüero",   "2664552000"),
            new("San Luis", "San Luis Capital",   "5700", "Av. Illía 800",            -33.2967, -66.3374, "Virginia",  "Castro",   "2664552001"),
            new("San Luis", "Villa Mercedes",     "5730", "Av. del Trabajador 600",   -33.6742, -65.4595, "Jorge",     "Morán",    "2657552002"),
            new("San Luis", "Merlo",              "5881", "Av. del Sol 400",          -32.3497, -65.0133, "Susana",    "Quiroga",  "2656552003"),

            // ── La Pampa ─────────────────────────────────────────────────────
            new("La Pampa", "Santa Rosa",         "6300", "Av. San Martín 1100",      -36.6209, -64.2908, "Jorge",     "Tello",    "2954552100"),
            new("La Pampa", "Santa Rosa",         "6300", "Pellegrini 700",           -36.6223, -64.2927, "Ana",       "Bianchi",  "2954552101"),
            new("La Pampa", "General Pico",       "6360", "Av. San Martín 800",       -35.6565, -63.7582, "Marcelo",   "Rivarola", "2302552102"),
            new("La Pampa", "Toay",               "6303", "Buenos Aires 400",         -36.6726, -64.3816, "Graciela",  "Velarde",  "2954552103"),

            // ── Río Negro ────────────────────────────────────────────────────
            new("Río Negro", "Viedma",            "8500", "Av. Rivadavia 800",        -40.8135, -62.9967, "Gustavo",   "Pereyra",  "2920552200"),
            new("Río Negro", "Viedma",            "8500", "Buenos Aires 1200",        -40.8152, -62.9985, "Silvia",    "Martínez", "2920552201"),
            new("Río Negro", "Bariloche",         "8400", "Av. San Martín 1500",      -41.1335, -71.3103, "Alejandro", "Hoffmann", "2944552202"),
            new("Río Negro", "General Roca",      "8332", "Av. Roca 1400",            -39.0229, -67.5731, "Mónica",    "Oyarzo",   "2984552203"),
            new("Río Negro", "Cipolletti",        "8324", "Liniers 600",              -38.9408, -67.9926, "Fabián",    "González", "2994552204"),

            // ── Chubut ───────────────────────────────────────────────────────
            new("Chubut", "Rawson",               "9103", "Belgrano 500",             -43.3003, -65.1023, "Néstor",    "Albornoz", "2965552300"),
            new("Chubut", "Trelew",               "9100", "25 de Mayo 900",           -43.2489, -65.3027, "Liliana",   "Cano",     "2965552301"),
            new("Chubut", "Puerto Madryn",        "9120", "Av. Roca 1200",            -42.7682, -65.0368, "Ramiro",    "Flores",   "2965552302"),
            new("Chubut", "Comodoro Rivadavia",   "9000", "Av. Hipólito Yrigoyen 1100",-45.8651,-67.4978,"Valeria",    "Torres",   "297 5552303"),
            new("Chubut", "Esquel",               "9200", "Av. Fontana 600",          -42.9079, -71.3138, "Osvaldo",   "Pichun",   "2945552304"),

            // ── Formosa ──────────────────────────────────────────────────────
            new("Formosa", "Formosa Capital",     "3600", "Av. 25 de Mayo 800",       -26.1786, -58.1754, "Elsa",      "Ramírez",  "3717552400"),
            new("Formosa", "Formosa Capital",     "3600", "Belgrano 500",             -26.1803, -58.1771, "Silvio",    "Insfrán",  "3717552401"),
            new("Formosa", "Clorinda",            "3612", "San Martín 700",           -25.2855, -57.7233, "Teresa",    "González", "3718552402"),
            new("Formosa", "Pirané",              "3636", "Urquiza 400",              -25.7294, -59.1078, "Bernardo",  "Paez",     "3716552403"),

            // ── Santa Cruz ───────────────────────────────────────────────────
            new("Santa Cruz", "Río Gallegos",     "9400", "Av. Roca 1100",            -51.6352, -69.2172, "Patricia",  "Mercado",  "2966552500"),
            new("Santa Cruz", "Río Gallegos",     "9400", "San Martín 700",           -51.6369, -69.2190, "Claudio",   "Cárdenas", "2966552501"),
            new("Santa Cruz", "Caleta Olivia",    "9011", "Av. Hipólito Yrigoyen 800",-46.4384,-67.5249, "Andrea",    "Mansilla", "297 5552502"),
            new("Santa Cruz", "Puerto Deseado",   "9050", "Colón 500",                -47.7535, -65.9034, "Rubén",     "Funes",    "2974552503"),

            // ── Tierra del Fuego ─────────────────────────────────────────────
            new("Tierra del Fuego", "Ushuaia",    "9410", "Av. Maipú 1200",           -54.8019, -68.3029, "Alejandra", "Lagos",    "2901552600"),
            new("Tierra del Fuego", "Ushuaia",    "9410", "San Martín 800",           -54.8036, -68.3051, "Mateo",     "Montes",   "2901552601"),
            new("Tierra del Fuego", "Río Grande", "9420", "Av. Belgrano 1100",        -53.7878, -67.7072, "Graciela",  "Mansilla", "2964552602"),
            new("Tierra del Fuego", "Tolhuin",    "9432", "El Yagán 300",             -54.5045, -67.1995, "Diego",     "Zurita",   "2901552603"),

            // ── Ciudad Autónoma de Buenos Aires (CABA) ───────────────────────
            new("Ciudad Autónoma de Buenos Aires", "CABA - Palermo",     "1414", "Thames 2200",       -34.5880, -58.4258, "Sofía",    "Ríos",     "1145512100"),
            new("Ciudad Autónoma de Buenos Aires", "CABA - San Telmo",   "1070", "Defensa 800",       -34.6199, -58.3733, "Matías",   "Conte",    "1145512101"),
            new("Ciudad Autónoma de Buenos Aires", "CABA - Belgrano",    "1428", "Av. Cabildo 2200",  -34.5606, -58.4512, "Laura",    "Visconti", "1145512102"),
            new("Ciudad Autónoma de Buenos Aires", "CABA - Caballito",   "1406", "Av. Rivadavia 5800",-34.6188, -58.4406, "Rodrigo",  "Ponti",    "1145512103"),
            new("Ciudad Autónoma de Buenos Aires", "CABA - Villa Urquiza","1431","Av. Triunvirato 4500",-34.5773,-58.4889,"Fernanda","Greco",     "1145512104"),
            new("Ciudad Autónoma de Buenos Aires", "CABA - Almagro",     "1196", "Av. Corrientes 3800",-34.6054,-58.4237,"Gabriel",  "Suárez",   "1145512105"),
        };

        private sealed record DemoAddress(
            string Provincia,
            string Localidad,
            string CP,
            string Direccion,
            double Latitud,
            double Longitud,
            string Nombre,
            string Apellido,
            string Telefono);

        private sealed class DemoAddressDto
        {
            public string? Provincia { get; set; }
            public string? Localidad { get; set; }
            public string? CP { get; set; }
            public string? Direccion { get; set; }
            public double Latitud { get; set; }
            public double Longitud { get; set; }
            public string? Nombre { get; set; }
            public string? Apellido { get; set; }
            public string? Telefono { get; set; }
        }

        private static string MensajeBloqueoEdicion(PaqueteStatus status) => status switch
        {
            PaqueteStatus.AsignadoAVehiculo => "El envío ya fue asignado a un vehículo y no puede modificarse.",
            PaqueteStatus.CargadoEnVehiculo => "El envío ya fue cargado en el vehículo y no puede modificarse.",
            PaqueteStatus.ListoParaSalir => "El envío ya está listo para salir y no puede modificarse.",
            PaqueteStatus.EnTransito => "El envío está en tránsito y no puede modificarse.",
            PaqueteStatus.Entregado => "El envío fue entregado y no puede modificarse.",
            PaqueteStatus.Cancelado => "El envío fue cancelado y no puede modificarse.",
            _ => "El envío no puede modificarse en su estado actual.",
        };

        private static void ValidarPaqueteData(RegistrarPaqueteRequest request)
        {
            if (request.Peso <= 0)
                throw new InvalidOperationException("El peso debe ser mayor a 0.");

            if (request.Remitente is null || request.Destinatario is null)
                throw new InvalidOperationException("Remitente y destinatario son obligatorios.");

            if (string.IsNullOrWhiteSpace(request.Destinatario.CP) || !Regex.IsMatch(request.Destinatario.CP, @"^[A-Za-z0-9]{4,8}$"))
                throw new InvalidOperationException("El código postal de destino no es válido.");

            if (string.IsNullOrWhiteSpace(request.Destinatario.Email))
                throw new InvalidOperationException("El correo electrónico del destinatario es obligatorio.");

            if (!Regex.IsMatch(request.Destinatario.Email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
                throw new InvalidOperationException("El formato del correo electrónico del destinatario no es válido.");
        }
    }
}
