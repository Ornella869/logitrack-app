using Back.Application.Abstractions;
using Back.Application.Util;
using Back.Controllers;
using Back.Domain.Models;
using Back.Domain.Repositories;
using Back.Infrastructure.Database;

namespace Back.Application.Services
{
    public class EnviosService 
    {
        private readonly IEnviosRepository _enviosRepository;
        private readonly IUserRepository _userRepository;
        private readonly IRutasRepository _rutasRepository;

        private readonly IMLPrioridadPrediction _mlPrioridadPrediction;

        public EnviosService(IEnviosRepository enviosRepository, IUserRepository userRepository, IRutasRepository rutasRepository, IMLPrioridadPrediction mlPrioridadPrediction)
        {
            _rutasRepository = rutasRepository;
            _enviosRepository = enviosRepository;
            _userRepository = userRepository;
            _rutasRepository = rutasRepository;
             _mlPrioridadPrediction = mlPrioridadPrediction;
        }

        public async Task RegistrarPaquete(RegistrarPaqueteRequest request)
        {

            // Ubicacion destino = CoordenadasGenerator.GenerarCoodenadasEnRadio(PrioridadCalculator.sucursal, 250); // Genera coordenadas aleatorias dentro de un radio de 50km desde la sucursal

            var paquete = new Paquete(
                request.Peso,
                0,
                0,
                new Cliente(request.Remitente.Nombre, request.Remitente.Apellido, new Direccion(request.Remitente.Direccion, request.Remitente.Localidad, request.Remitente.CP)),
                new Cliente(request.Destinatario.Nombre, request.Destinatario.Apellido, new Direccion(request.Destinatario.Direccion, request.Destinatario.Localidad, request.Destinatario.CP)),
                await _mlPrioridadPrediction.Predecir((float)request.Peso, DistanciasService.CalcularDistancia(request.Destinatario.Localidad)), // Prioridad usando ML
                DistanciasService.CalcularDistancia(request.Destinatario.Localidad),
                request.Comentarios
            );

            await _enviosRepository.Add(paquete);
        }


        public async Task ReasignarRuta(Guid rutaId, Guid transportistaId)
        {
            var ruta = await _rutasRepository.GetRutaById(rutaId);
            if (ruta is null)
                throw new InvalidOperationException("Ruta no encontrada");

            Usuario? usuario = await _userRepository.GetUsuarioById(transportistaId);

            if (usuario is null || usuario is not Transportista transportista)
                throw new InvalidOperationException("Transportista no encontrado");

            if (!transportista.PuedeSerAsignado)
                throw new InvalidOperationException("El transportista está suspendido o inhabilitado y no puede recibir rutas.");

            ruta.ReasignarTransportista(transportista);

            await _rutasRepository.Add(ruta);
        }
    }
}