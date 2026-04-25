using Back.Controllers;
using Back.Domain.Models;
using Back.Domain.Repositories;

namespace Back.Application.Services
{
    public class RutasService
    {

        private readonly IEnviosRepository _enviosRepository;

        private readonly IVehiculoRepository _vehiculoRepository;

        private readonly IRutasRepository _rutasRepository;
        private readonly IUserRepository _userRepository;
        public RutasService(IEnviosRepository enviosRepository, IVehiculoRepository vehiculoRepository, IRutasRepository rutasRepository, IUserRepository userRepository)
        {
            _enviosRepository = enviosRepository;
            _rutasRepository = rutasRepository;
            _vehiculoRepository = vehiculoRepository;
            _userRepository = userRepository;
        }
        public  async Task CrearRuta(CrearRutaRequest request)
        {

            if(request.PaqueteIds == null || !request.PaqueteIds.Any())
                throw new InvalidOperationException("No se pueden crear rutas sin paquetes.");

            var vehiculo = await _vehiculoRepository.GetVehiculo(request.VehiculoId);

            if (vehiculo is null)
                throw new InvalidOperationException("Vehiculo no encontrado.");


            if(await _rutasRepository.IsVehiculoEnRuta(request.VehiculoId))
            {
                throw new InvalidOperationException("El vehículo ya está asignado a una ruta activa.");
            }

            var paquetes = await _enviosRepository.GetPaquetesByIds(request.PaqueteIds);

            Usuario? user = await _userRepository.GetUsuarioById(request.TransportistaId);

            if (user is null || user is not Transportista transportista)
                throw new InvalidOperationException("Transportista no encontrado.");

            if (!transportista.PuedeSerAsignado)
                throw new InvalidOperationException("El transportista está suspendido o inhabilitado y no puede recibir rutas.");

            var ruta = new Ruta(transportista, vehiculo);

            ruta.AgregarPaquetes(paquetes);

            await _rutasRepository.Add(ruta);
        }
    }
}