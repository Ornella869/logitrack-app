using System.Text.RegularExpressions;
using Back.Application.Abstractions;
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

        public EnviosService(
            IEnviosRepository enviosRepository,
            IUserRepository userRepository,
            IRutasRepository rutasRepository,
            IMLPrioridadPrediction mlPrioridadPrediction,
            HistorialEstadoEnvioService historial,
            QrService qrService,
            AuditoriaService auditoria,
            GeocodingService geocoding)
        {
            _rutasRepository = rutasRepository;
            _enviosRepository = enviosRepository;
            _userRepository = userRepository;
            _mlPrioridadPrediction = mlPrioridadPrediction;
            _historial = historial;
            _qrService = qrService;
            _auditoria = auditoria;
            _geocoding = geocoding;
        }

        // G1L-10
        public async Task<RegistrarPaqueteResult> RegistrarPaquete(RegistrarPaqueteRequest request, Guid? usuarioId)
        {
            ValidarPaqueteData(request);

            var ubicacionDestinatario = await _geocoding.GeocodeAsync(
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

            var paquete = new Paquete(
                request.Peso,
                0,
                0,
                new Cliente(request.Remitente.Nombre, request.Remitente.Apellido, new Direccion(request.Remitente.Direccion, request.Remitente.Localidad, request.Remitente.CP), request.Remitente.Telefono),
                new Cliente(request.Destinatario.Nombre, request.Destinatario.Apellido, new Direccion(request.Destinatario.Direccion, request.Destinatario.Localidad, request.Destinatario.CP, ubicacion: ubicacionDestinatario), request.Destinatario.Telefono),
                prioridad,
                distancia,
                request.Comentarios
            )
            {
                TipoEnvio = request.TipoEnvio,
                TipoPaquete = request.TipoPaquete,
            };

            await _enviosRepository.Add(paquete);

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

        // G1L-12
        public async Task EditarPaquete(Guid paqueteId, RegistrarPaqueteRequest request, Guid? usuarioId)
        {
            ValidarPaqueteData(request);

            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");

            if (paquete.Status != PaqueteStatus.PendienteDeCalendarizacion)
                throw new InvalidOperationException("El envío ya fue calendarizado y no puede modificarse.");

            var ubicacionDestinatario = await _geocoding.GeocodeAsync(
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

            paquete.ActualizarDatos(
                new Cliente(request.Remitente.Nombre, request.Remitente.Apellido, new Direccion(request.Remitente.Direccion, request.Remitente.Localidad, request.Remitente.CP), request.Remitente.Telefono),
                new Cliente(request.Destinatario.Nombre, request.Destinatario.Apellido, new Direccion(request.Destinatario.Direccion, request.Destinatario.Localidad, request.Destinatario.CP, ubicacion: ubicacionDestinatario), request.Destinatario.Telefono),
                request.Peso,
                request.TipoEnvio,
                request.TipoPaquete,
                request.Comentarios,
                distancia,
                prioridad);

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
                    break;

                case PaqueteStatus.EnTransito:
                    // G1L-9 (Entrega Fallida): solo repartidor.
                    if (!esRepartidor)
                        throw new InvalidOperationException("Un envío En Tránsito solo puede cancelarlo el repartidor (Entrega Fallida).");
                    paquete.Cancelar(motivo);
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, usuarioId, OrigenCambioEstado.Manual, motivo);
                    break;

                default:
                    throw new InvalidOperationException("El paquete no puede cancelarse en su estado actual desde el flujo de operación.");
            }
        }

        // G1L-9: Repartidor cambia estado del paquete.
        public async Task CambiarEstadoPorRepartidor(Guid paqueteId, PaqueteStatus destino, string? motivo, Guid? usuarioId)
        {
            var paquete = await _enviosRepository.GetPaquete(paqueteId)
                ?? throw new InvalidOperationException("Paquete no encontrado.");

            switch (destino)
            {
                case PaqueteStatus.EnTransito:
                    paquete.IniciarTransito();
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.EnTransito, usuarioId, OrigenCambioEstado.Manual);
                    break;

                case PaqueteStatus.Entregado:
                    paquete.Entregar();
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Entregado, usuarioId, OrigenCambioEstado.Manual);
                    break;

                case PaqueteStatus.Cancelado:
                    if (string.IsNullOrWhiteSpace(motivo))
                        throw new InvalidOperationException("Se requiere un motivo para cancelar la entrega.");
                    if (paquete.Status != PaqueteStatus.EnTransito)
                        throw new InvalidOperationException("Solo se puede cancelar una entrega en tránsito.");
                    paquete.Cancelar(motivo);
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.Cancelado, usuarioId, OrigenCambioEstado.Manual, motivo);
                    break;

                default:
                    throw new InvalidOperationException("Transición de estado no válida.");
            }
        }

        // G1L-43: Escaneo QR con estados intermedios
        public async Task<EscaneoResultado> EscanearQr(string codigoSeguimiento, Guid? usuarioId)
        {
            var paquete = await _enviosRepository.GetPaqueteByCodigoSeguimiento(codigoSeguimiento)
                ?? throw new InvalidOperationException("No se encontró un envío con ese código.");

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
                    paquete.IniciarTransito();
                    await _historial.RegistrarCambioAsync(paquete.Id, PaqueteStatus.EnTransito, usuarioId, OrigenCambioEstado.QR);
                    await _auditoria.RegistrarAsync(
                        Domain.Models.TipoAccion.CambioEstadoEnvio,
                        $"Inició tránsito de {paquete.CodigoSeguimiento} (escaneo QR)",
                        recursoId: paquete.CodigoSeguimiento);
                    return new EscaneoResultado
                    {
                        Status = paquete.Status,
                        Accion = "TransitoIniciado",
                        CodigoSeguimiento = paquete.CodigoSeguimiento,
                        PaqueteId = paquete.Id,
                    };

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

        private static void ValidarPaqueteData(RegistrarPaqueteRequest request)
        {
            if (request.Peso <= 0)
                throw new InvalidOperationException("El peso debe ser mayor a 0.");

            if (request.Remitente is null || request.Destinatario is null)
                throw new InvalidOperationException("Remitente y destinatario son obligatorios.");

            if (string.IsNullOrWhiteSpace(request.Destinatario.CP) || !Regex.IsMatch(request.Destinatario.CP, @"^[A-Za-z0-9]{4,8}$"))
                throw new InvalidOperationException("El código postal de destino no es válido.");
        }
    }
}
