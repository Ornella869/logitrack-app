using Back.Application.Services;
using Back.Domain.Models;
using Microsoft.EntityFrameworkCore;

namespace Back.Infrastructure.Database
{

    public class PesoGenerator
    {
        static readonly Random _random = new Random();

        public static double GenerarPeso()
        {

            var randomValue = _random.NextDouble() * 100;

            if (randomValue < 10)
            {
                // 10% de probabilidades: entre 40 y 55 kg
                return _random.NextDouble() * 15 + 40;
            }
            else if (randomValue < 40)
            {
                // 30% de probabilidades: entre 0.5 y 5 kg (paquetes livianos)
                return _random.NextDouble() * 4.5 + 0.5;
            }
            else if (randomValue < 80)
            {
                // 40% de probabilidades: entre 5 y 20 kg (paquetes medianos)
                return _random.NextDouble() * 15 + 5;
            }
            else
            {
                // 20% de probabilidades: entre 20 y 40 kg (paquetes pesados)
                return _random.NextDouble() * 20 + 20;
            }

        }
    }


    public class DatabaseSeeder
    {

        private readonly LogiTrackDbContext _context;

        private readonly IConfiguration _configuration;

        public DatabaseSeeder(LogiTrackDbContext context, IConfiguration configuration)
        {
            this._context = context;
            this._configuration = configuration;

        }

        public async Task SeedAsync()
        {
            DatabaseSeederConfiguration config = _configuration.GetSection("DatabaseSeederConfiguration").Get<DatabaseSeederConfiguration>() ?? new DatabaseSeederConfiguration();

            // Guard de idempotencia: si ya hay datos, no duplicar.
            if (await _context.Usuarios.AnyAsync())
            {
                return;
            }

            // Generar usuarios específicos (establecidos)
            var usuariosEspecificos = UsuarioGenerator.GenerarUsuariosEspecificos();
            _context.Usuarios.AddRange(usuariosEspecificos);

            // Generar usuarios aleatorios adicionales
            List<Operador> operadores = UsuarioGenerator.GenerarOperadores(config.CantidadOperadores);
            List<Supervisor> supervisores = UsuarioGenerator.GenerarSupervisores(config.CantidadSupervisores);
            List<Repartidor> repartidores = UsuarioGenerator.GenerarRepartidores(config.CantidadRepartidores);

            _context.Usuarios.AddRange([.. operadores, .. supervisores, .. repartidores]);

            // Por ahora una única sucursal de demo. El admin puede eliminarla y crear la suya.
            _context.Sucursales.Add(new Sucursal(
                "Sucursal Centro",
                "Av. Corrientes 1234",
                "CABA",
                "1043",
                "011-4000-0000"
            ));

            // Generar vehículos específicos (establecidos)
            var vehiculosEspecificos = PaquetesGenerator.GenerarVehiculosEspecificos();
            _context.Vehiculos.AddRange(vehiculosEspecificos);

            // Generar vehículos aleatorios adicionales
            var vehiculos = PaquetesGenerator.GenerarVehiculos(config.CantidadVehiculos);

            var paquetes = PaquetesGenerator.GenerarPaquetes(config.CantidadPaquetes);

            var rutas = RutasGenerator.GenerarRutas(paquetes, repartidores, vehiculos);

            RutaRandomizerManager.Randomizar(rutas);

            // Generar paquetes específicos y crear una ruta con ellos
            var paquetesEspecificos = PaquetesGenerator.GenerarPaquetesEspecificos();
            _context.Paquetes.AddRange(paquetesEspecificos);

            // Asignar ruta específica al repartidor luis.lopez con vehículo específico
            var repartidorLuis = usuariosEspecificos.FirstOrDefault(u => u.Email == "luis.lopez@logitrack.com") as Repartidor;
            var vehiculoEspecifico = vehiculosEspecificos.FirstOrDefault(v => v.Patente == "ABC123"); // Usar el primer vehículo específico

            if (repartidorLuis != null && vehiculoEspecifico != null)
            {
                var rutaEspecifica = new Ruta(repartidorLuis, vehiculoEspecifico);
                var paquetesPendientes = paquetesEspecificos.Where(p => p.EstaPendienteDeCalendarizacion).ToList();
                paquetesPendientes.ForEach(p => p.MarcarListoParaSalir());
                rutaEspecifica.AgregarPaquetes(paquetesPendientes);
                rutas.Add(rutaEspecifica);
            }

            _context.Paquetes.AddRange([.. PaquetesGenerator.GenerarPaquetes(20)]);
            _context.Rutas.AddRange(rutas);

            await _context.SaveChangesAsync();
        }
    }

    public static class PaquetesGenerator
    {
        private static readonly Ubicacion BuenosAires = new Ubicacion(-34.6037, -58.3816);
        private static List<string> nombres = new List<string>
        {
            "Juan", "María", "Carlos", "Ana", "Luis", "Sofía", "Diego", "Valentina",
            "Matías", "Camila", "Federico", "Lucía", "Martín", "Isabella", "Santiago", "Alejandro",
            "Beatriz", "Daniel", "Elena", "Facundo", "Gabriela", "Hugo", "Irene", "Javier",
            "Karina", "Leonardo", "Mónica", "Nicolás", "Olivia", "Pablo", "Raquel", "Sebastián",
            "Teresa", "Ulises", "Victoria", "Roberto", "Adrián", "Bárbara", "Cristian", "Delfina"

        };

        private static List<string> apellidos = new List<string>
        {
            "Pérez", "Gómez", "Rodríguez", "Martínez", "López", "Fernández", "Díaz", "Morales",
            "Castro", "Ortiz", "Sánchez", "Torres", "Ramírez", "Flores", "Herrera", "García",
            "Pellegrini", "Sarmiento", "Vázquez", "Blanco", "Ramos", "Ruiz", "Medina", "Suárez",
            "Castillo", "Romero", "Méndez", "Guzmán", "Álvarez", "Moreno", "Ibarra", "Rojas",
            "Ortega", "Vargas", "Mendoza", "Silva", "Farías", "Acosta", "Ríos", "Benítez"
        };


        static readonly List<string> municipios = new List<string>
{
    "Almirante Brown", "Avellaneda", "Bahía Blanca", "Berazategui", "Berisso",
    "Campana", "Cañuelas", "Chivilcoy", "Escobar", "Esteban Echeverría",
    "Ezeiza", "Florencio Varela", "General Pueyrredón", "General Rodríguez", "General San Martín",
    "Hurlingham", "Ituzaingó", "José C. Paz", "Junín", "La Matanza",
    "La Plata", "Lanús", "Lomas de Zamora", "Luján", "Malvinas Argentinas",
    "Merlo", "Moreno", "Morón", "Olavarría", "Pilar",
    "Quilmes", "San Fernando", "San Isidro", "San Miguel", "San Nicolás",
    "San Vicente", "Tandil", "Tigre", "Tres de Febrero", "Vicente López",
    "Zárate", "Córdoba Capital", "Río Cuarto", "Villa María", "Villa Carlos Paz",
    "San Francisco", "Alta Gracia", "Río Tercero", "Bell Ville", "La Calera",
    "Rosario", "Santa Fe Capital", "Rafaela", "Venado Tuerto", "Reconquista",
    "Santo Tomé", "Villa Constitución", "Esperanza", "Granadero Baigorria", "San Lorenzo",
    "Mendoza Capital", "Guaymallén", "Godoy Cruz", "Las Heras", "Maipú",
    "San Rafael", "Luján de Cuyo", "San Martín", "Rivadavia", "Tunuyán",
    "San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo", "Concepción", "Banda del Río Salí",
    "Salta Capital", "San Ramón de la Nueva Orán", "Tartagal", "General Güemes", "Rosario de la Frontera",
    "San Salvador de Jujuy", "San Pedro de Jujuy", "Palpalá", "Perico", "Libertador General San Martín",
    "Resistencia", "Presidencia Roque Sáenz Peña", "Villa Ángela", "Charata", "Fontana",
    "Posadas", "Oberá", "Eldorado", "Puerto Iguazú", "Apóstoles",
    "Corrientes Capital", "Goya", "Paso de los Libres", "Curuzú Cuatiá", "Mercedes"
};


        private static List<string> calles = new List<string>
        {
            "Avenida de Mayo", "9 de Julio", "Corrientes", "Rivadavia", "Belgrano",
            "San Martín", "Santa Fe", "Callao", "Córdoba", "Leandro N. Alem",
            "Paseo Colón", "Libertador", "Juan B. Justo", "Pueyrredón", "Jujuy",
            "Entre Ríos", "Las Heras", "Alvear", "Quintana", "Sarmiento",
            "Mitre", "Roca", "Urquiza", "Saavedra", "Moreno",
            "Castelli", "Paso", "Larrea", "Azcuénaga", "Matheu",
            "Alberti", "Hipólito Yrigoyen", "Florida", "Lavalle", "Esmeralda",
            "Maipú", "Chacabuco", "Suipacha", "Reconquista", "25 de Mayo",
            "Defensa", "Balcarce", "Bolívar", "Perú", "Chile",
            "México", "Venezuela", "Estados Unidos", "Carlos Calvo", "Humberto 1°",
            "San Juan", "Cochabamba", "Constitución", "Pavón", "Garay",
            "Brasil", "Caseros", "Monteagudo", "Iguazú", "Uspallata",
            "Almafuerte", "Pedro de Mendoza", "Regimiento de Patricios", "Montes de Oca", "Suárez",
            "Olavarría", "Brandsen", "Pinzón", "Aristóbulo del Valle", "Wenceslao Villafañe",
            "Benito Quinquela Martín", "Magallanes", "Rocha", "Mendoza", "Juramento",
            "Echeverría", "Sucre", "La Pampa", "Triunvirato", "Olazábal",
            "Blanco Encalada", "Monroe", "Roosevelt", "Congreso", "Ugarte",
            "Quesada", "Iberá", "Guayra", "Campos Salles", "Manuela Pedraza",
            "Juana Azurduy", "Crisólogo Larralde", "Núñez", "Comodoro Rivadavia", "Vilela",
            "Paroissien", "García del Río", "San Isidro Labrador", "Pico", "Deheza",
            "Arias", "Ramallo", "Correa", "Ruiz Huidobro", "Besares",
            "Vedia", "General Paz", "Donado", "Holmberg", "Estomba",
            "Tronador", "Plaza", "Melián", "Conesa", "Zapiola",
            "Pinto", "Freire", "Conde", "Superí", "Capdevila",
            "Bauness", "Bucarelli", "Andonaegui", "Barzana", "Mariano Acha",
            "Lugones", "Miller", "Valdenegro", "Galván", "Constituyentes",
            "Beiró", "Lope de Vega", "Segurola", "Chivilcoy", "Bahía Blanca",
            "Joaquín V. González", "Mercedes", "Gualeguaychú", "Cuenca", "Campana",
            "Llavallol", "Concordia", "Helguera", "Argerich", "Artigas",
            "Bolivia", "Condarco", "Terrada", "Nazca", "Argerich"
        };


        private static Random _random = new Random();

        public static Cliente GenerarCliente()
        {
            return new Cliente(
                nombres[_random.Next(nombres.Count)],
                apellidos[_random.Next(apellidos.Count)],
                new Direccion(calles[_random.Next(calles.Count)] + " " + _random.Next(100, 999), municipios[_random.Next(municipios.Count)], _random.Next(100, 9999).ToString(), null),
                $"11{_random.Next(1000, 9999)}{_random.Next(1000, 9999)}"
            );
        }

        public static List<Vehiculo> GenerarVehiculos(int count)
        {
            var marcas = new List<string> { "Ford", "Chevrolet", "Toyota", "Renault", "Volkswagen" };
            var result = new List<Vehiculo>();

            for (int i = 0; i < count; i++)
            {
                var patente = $"PAT{_random.Next(100, 999)}{(char)_random.Next('A', 'Z' + 1)}";
                var marca = marcas[_random.Next(marcas.Count)];
                var capacidad = _random.Next(500, 2000);

                result.Add(new Vehiculo(patente, marca, capacidad));
            }

            return result;
        }

        public static List<Vehiculo> GenerarVehiculosEspecificos()
        {
            var result = new List<Vehiculo>();

            var vehiculosData = new List<(string patente, string marca, int capacidad)>
            {
                ("ABC123", "Ford", 1500),
                ("DEF456", "Chevrolet", 1200),
                ("GHI789", "Toyota", 1800),
                ("JKL012", "Renault", 1000),
                ("MNO345", "Volkswagen", 1600),
                ("PQR678", "Ford", 1400),
                ("STU901", "Chevrolet", 1300)
            };

            foreach (var (patente, marca, capacidad) in vehiculosData)
            {
                result.Add(new Vehiculo(patente, marca, capacidad));
            }

            return result;
        }

        public static List<Paquete> GenerarPaquetes(int count)
        {
            var descripciones = new List<string>
            {
                "Electrónicos", "Elementos de cocina", "Productos de limpieza",
                "Indumentaria", "Libros", "Juguetes", "Herramientas", "Documentación",
                "Artículos de oficina", "Calzado deportivo", "Repuestos automotrices",
                "Pequeños electrodomésticos", "Materiales de construcción", "Insumos médicos",
                "Artículos de jardinería", "Decoración para el hogar", "Instrumentos musicales",
                "Equipamiento de camping", "Suplementos dietarios", "Cosméticos",
                "Perfumería", "Relojería", "Joyería de fantasía", "Papelería",
                "Muebles para armar", "Cuadros y marcos", "Lámparas", "Alfombras",
                "Vajilla de vidrio", "Cubiertos", "Mantelería", "Blanquería",
                "Alimentos no perecederos", "Bebidas embotelladas", "Café y té",
                "Golosinas", "Artículos para mascotas", "Accesorios de telefonía",
                "Componentes de PC", "Cámaras fotográficas", "Videojuegos",
                "Películas y música", "Equipos de sonido", "Bicicletas",
                "Artículos de pesca", "Pelotas y balones", "Pesas y mancuernas",
                "Ropa de cama"

            };

            var result = new List<Paquete>();

            for (int i = 0; i < count; i++)
            {

                double peso = PesoGenerator.GenerarPeso();

                Cliente destino = GenerarCliente();
                Paquete paquete = new Paquete(
                    peso,
                    _random.Next(10, 100),
                    _random.Next(10, 100),
                    GenerarCliente(),
                    destino,
                    PrioridadCalculator.CalcularPrioridad(peso, DistanciasService.CalcularDistancia(destino.Direccion.Ciudad)), // Prioridad calculada
                    DistanciasService.CalcularDistancia(GenerarCliente().Direccion.Ciudad)
                    ,descripciones[_random.Next(descripciones.Count)]
                );

                result.Add(paquete);
            }

            return result;
        }

        public static List<Paquete> GenerarPaquetesEspecificos()
        {
            var result = new List<Paquete>();

            var paquetesData = new List<(string codigo, string estado, string descripcion)>
            {
                ("LOG-2024-001", "PendienteDeCalendarizacion", "En espera de ser enviado"),
                ("LOG-2024-002", "EnTransito", "En ruta de entrega"),
                ("LOG-2024-003", "Entregado", "Ya fue entregado"),
                ("LOG-2024-004", "Cancelado", "Cancelado por cliente"),
                ("LOG-2024-005", "PendienteDeCalendarizacion", "Pequeño documento"),
                ("LOG-2024-006", "EnTransito", "Carga grande"),
                ("LOG-2024-007", "Entregado", "Histórico")
            };

            foreach (var (codigo, estado, descripcion) in paquetesData)
            {

                double peso = PesoGenerator.GenerarPeso();
                Paquete paquete = new Paquete(
                    codigo,
                    peso,
                    _random.Next(10, 100),
                    _random.Next(10, 100),
                    GenerarCliente(),
                    GenerarCliente(),
                    PrioridadCalculator.CalcularPrioridad(peso, DistanciasService.CalcularDistancia(GenerarCliente().Direccion.Ciudad)),
                    DistanciasService.CalcularDistancia(GenerarCliente().Direccion.Ciudad),
                    descripcion
                );

                // Establecer el estado del paquete
                switch (estado)
                {
                    case "PendienteDeCalendarizacion":
                        // Estado por defecto
                        break;
                    case "EnTransito":
                        paquete.MarcarListoParaSalir();
                        paquete.IniciarTransito();
                        break;
                    case "Entregado":
                        paquete.MarcarListoParaSalir();
                        paquete.IniciarTransito();
                        paquete.Entregar();
                        break;
                    case "Cancelado":
                        paquete.Cancelar("Cancelado por cliente");
                        break;
                }

                result.Add(paquete);
            }

            return result;
        }

    }



    public static class RutasGenerator
    {

        public static List<Ruta> GenerarRutas(List<Paquete> paquetes, List<Repartidor> repartidores, List<Vehiculo> vehiculos)
        {
            var rutas = new List<Ruta>();

            var paquetesDisponibles = paquetes.Where(p => p.EstaPendienteDeCalendarizacion).ToList();

            var repartidoresActivos = repartidores.Where(r => r.PuedeSerAsignado).ToList();
            var vehiculosDisponibles = vehiculos.Where(v => v.Estado == VehiculoEstado.Disponible).ToList();

            if (!paquetesDisponibles.Any() || !repartidoresActivos.Any() || !vehiculosDisponibles.Any())
                return rutas;

            int cantidadRutas = Math.Min(repartidoresActivos.Count, vehiculosDisponibles.Count);

            int paquetesPorRuta = (int)Math.Ceiling((double)paquetesDisponibles.Count / cantidadRutas);

            for (int i = 0; i < cantidadRutas; i++)
            {
                var repartidor = repartidoresActivos[i];
                var vehiculo = vehiculosDisponibles[i];
                var paquetesAsignados = paquetesDisponibles.Skip(i * paquetesPorRuta).Take(paquetesPorRuta).ToList();

                if (paquetesAsignados.Any())
                {
                    paquetesAsignados.ForEach(p => p.MarcarListoParaSalir());
                    var ruta = new Ruta(repartidor, vehiculo);
                    ruta.AgregarPaquetes(paquetesAsignados);

                    rutas.Add(ruta);
                }

            }
            return rutas;
        }
    }


    public static class RutaRandomizerManager
    {
        private static readonly Random _random = new Random();

        public static void Randomizar(List<Ruta> rutas)
        {
            foreach (var ruta in rutas)
            {
                Randomizar(ruta);
            }
        }

        public static void Randomizar(Ruta ruta)
        {
            var decision = _random.Next(0, 100);

            // 1. Probabilidad de que NO SUCEDA NADA (ej. 15%)
            if (decision < 15)
            {
                // La ruta queda en su estado actual (creada/pendiente)
                return;
            }

            // 2. Probabilidad de CANCELAR (10%)
            if (decision < 25) // De 15 a 25
            {
                ruta.Cancelar("Cancelación aleatoria por simulación");
                return;
            }

            // A partir de aquí, la ruta SIEMPRE se inicia
            ruta.Iniciar();

            // 3. Probabilidad de quedar EN TRÁNSITO sin entregas (20%)
            if (decision < 45) // De 25 a 45
            {
                return;
            }

            // 4. Probabilidad de ENTREGA PARCIAL (40%)
            if (decision < 85) // De 45 a 85
            {
                var paquetesAEntregar = ruta.Paquetes.Take(_random.Next(1, ruta.Paquetes.Count)).ToList();
                foreach (var p in paquetesAEntregar)
                {
                    ruta.EntregarPaquete(p.Id);
                }
            }
            // 5. Probabilidad de ENTREGA TOTAL (15%)
            else // De 85 a 100
            {
                var paquetesIds = ruta.Paquetes.Select(p => p.Id).ToList();
                foreach (var id in paquetesIds)
                {
                    ruta.EntregarPaquete(id);
                }
            }
        }
    }

    public class DatabaseSeederConfiguration
    {
        public int CantidadRepartidores { get; set; } = 50;
        public int CantidadOperadores { get; set; } = 20;
        public int CantidadSupervisores { get; set; } = 20;
        public int CantidadVehiculos { get; set; } = 20;
        public int CantidadPaquetes { get; set; } = 150;
    }


    public static class UsuarioGenerator
    {


        private static List<string> nombres = new List<string>
        {
            "Juan",
            "María",
            "Carlos",
            "Ana",
            "Luis",
            "Sofía",
            "Diego",
            "Valentina",
            "Matías",
            "Camila",
            "Federico",
            "Lucía",
            "Martín",
            "Isabella",
            "Santiago",
            "Alejandro",
            "Beatriz",
            "Daniel",
            "Elena",
            "Facundo",
            "Gabriela",
            "Hugo",
            "Irene",
            "Javier",
            "Karina",
            "Leonardo",
            "Mónica",
            "Nicolás",
            "Olivia",
            "Pablo",
            "Raquel",
            "Sebastián",
            "Teresa",
            "Ulises",
            "Victoria",

            "Roberto",
        };

        private static List<string> apellidos = new List<string>
        {
            "Pérez",
            "Gómez",
            "Rodríguez",
            "Martínez",
            "López",
            "Fernández",
            "Díaz",
            "Morales",
            "Castro",
            "Ortiz",
            "Sánchez",
            "Torres",
            "Ramírez",
            "Flores",
            "Herrera",
            "García",
            "Pellegrini",
            "Sarmiento",
            "Vázquez",
            "Blanco",
            "Ramos",
            "Ruiz",
            "Medina",
            "Suárez",
            "Castillo",
            "Romero",
            "Méndez",
            "Guzmán",
            "Álvarez",
            "Moreno"

        };

        static List<string> emailProviders = new List<string>
    {
        "gmail.com",
        "hotmail.com",
        "yahoo.com",
        "logitrack.com"
    };

        private static readonly Random random = new Random();
        public static Supervisor GenerateSupervisor(string nombre, string apellido, string email, string password, string dni)
        {
            return new Supervisor(nombre, apellido, email, password, dni);
        }

        public static Operador GenerateOperador(string nombre, string apellido, string email, string password, string dni)
        {
            return new Operador(nombre, apellido, email, password, dni);
        }

        public static Repartidor GenerateRepartidor(string nombre, string apellido, string email, string password, string dni, string licencia)
        {
            return new Repartidor(nombre, apellido, email, password, dni, licencia);
        }

        public static List<Repartidor> GenerarRepartidores(int count)
        {
            var result = new List<Repartidor>();

            for (int i = 0; i < count; i++)
            {
                var nombre = nombres[random.Next(nombres.Count)];
                var apellido = apellidos[random.Next(apellidos.Count)];

                result.Add(new Repartidor(
                    nombre,
                    apellido,
                    $"repartidor{i + 1}@logitrack.com",
                    PasswordHasher.HashPassword($"kjkszpj1234"),
                    $"{random.Next(10000000, 99999999)}",
                    $"LIC-{random.Next(1000, 9999)}"
                ));
            }

            return result;
        }

        public static List<Operador> GenerarOperadores(int count)
        {
            var result = new List<Operador>();

            for (int i = 0; i < count; i++)
            {
                var nombre = nombres[random.Next(nombres.Count)];
                var apellido = apellidos[random.Next(apellidos.Count)];

                result.Add(new Operador(
                    nombre,
                    apellido,
                    $"operador{i + 1}@logitrack.com",
                    PasswordHasher.HashPassword($"kjkszpj1234"),
                    $"{random.Next(10000000, 99999999)}"
                ));
            }

            return result;
        }


        public static List<Supervisor> GenerarSupervisores(int count)
        {
            var result = new List<Supervisor>();

            for (int i = 0; i < count; i++)
            {
                var nombre = nombres[random.Next(nombres.Count)];
                var apellido = apellidos[random.Next(apellidos.Count)];


                result.Add(new Supervisor(
                    nombre,
                    apellido,
                    $"supervisor{i + 1}@logitrack.com",
                    PasswordHasher.HashPassword($"kjkszpj1234"),
                    $"{random.Next(10000000, 99999999)}"
                ));
            }

            return result;
        }

        public static List<Usuario> GenerarUsuariosEspecificos()
        {
            var result = new List<Usuario>();

            var usuariosData = new List<(string nombre, string apellido, string rol)>
            {
                ("admin", "logitrack", "Administrador"),
                ("juan", "perez", "Operador"),
                ("maria", "gomez", "Operador"),
                ("carlos", "rodriguez", "Supervisor"),
                ("ana", "martinez", "Supervisor"),
                ("luis", "lopez", "Repartidor"),
                ("sofia", "fernandez", "Repartidor")
            };

            foreach (var (nombre, apellido, rol) in usuariosData)
            {
                string email = rol == "Administrador"
                    ? "admin@logitrack.com"
                    : $"{nombre}.{apellido}@logitrack.com";
                string password = "kjkszpj1234";

                Usuario usuario;
                string dni = random.Next(10000000, 99999999).ToString();
                switch (rol)
                {
                    case "Administrador":
                        usuario = new Administrador(nombre, apellido, email, PasswordHasher.HashPassword(password), dni);
                        break;
                    case "Operador":
                        usuario = new Operador(nombre, apellido, email, PasswordHasher.HashPassword(password), dni);
                        break;
                    case "Supervisor":
                        usuario = new Supervisor(nombre, apellido, email, PasswordHasher.HashPassword(password), dni);
                        break;
                    case "Repartidor":
                        usuario = new Repartidor(nombre, apellido, email, PasswordHasher.HashPassword(password), dni);
                        break;
                    default:
                        continue;
                }

                result.Add(usuario);
            }

            return result;
        }

    }


}
