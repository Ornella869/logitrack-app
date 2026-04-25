using Back.Domain.Models;
using NetTopologySuite.Geometries;

namespace Back.Application.Services
{
    public class DistanciasService
    {


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

        static readonly Dictionary<string, float> _distancias_de_municipios = new Dictionary<string, float>
            {
                { "Almirante Brown", 25.5f },
                { "Avellaneda", 10.2f },
                { "Bahía Blanca", 240.5f },
                { "Berazategui", 30.1f },
                { "Berisso", 65.4f },
                { "Campana", 85.2f },
                { "Cañuelas", 68.9f },
                { "Chivilcoy", 160.5f },
                { "Escobar", 55.3f },
                { "Esteban Echeverría", 32.7f },
                { "Ezeiza", 35.0f },
                { "Florencio Varela", 28.4f },
                { "General Pueyrredón", 245.2f },
                { "General Rodríguez", 58.1f },
                { "General San Martín", 15.6f },
                { "Hurlingham", 22.3f },
                { "Ituzaingó", 28.9f },
                { "José C. Paz", 42.1f },
                { "Junín", 248.4f },
                { "La Matanza", 20.5f },
                { "La Plata", 60.0f },
                { "Lanús", 12.8f },
                { "Lomas de Zamora", 18.2f },
                { "Luján", 72.4f },
                { "Malvinas Argentinas", 38.6f },
                { "Merlo", 34.2f },
                { "Moreno", 40.8f },
                { "Morón", 24.1f },
                { "Olavarría", 235.7f },
                { "Pilar", 58.9f },
                { "Quilmes", 22.1f },
                { "San Fernando", 28.5f },
                { "San Isidro", 22.8f },
                { "San Miguel", 33.4f },
                { "San Nicolás", 230.2f },
                { "San Vicente", 52.4f },
                { "Tandil", 248.5f },
                { "Tigre", 32.6f },
                { "Tres de Febrero", 19.3f },
                { "Vicente López", 14.7f },
                { "Zárate", 92.5f },
                { "Córdoba Capital", 240.0f },
                { "Río Cuarto", 235.0f },
                { "Villa María", 220.0f },
                { "Villa Carlos Paz", 248.0f },
                { "San Francisco", 215.0f },
                { "Alta Gracia", 249.0f },
                { "Río Tercero", 246.0f },
                { "Bell Ville", 230.0f },
                { "La Calera", 250.0f },
                { "Rosario", 240.0f },
                { "Santa Fe Capital", 248.0f },
                { "Rafaela", 249.5f },
                { "Venado Tuerto", 242.0f },
                { "Reconquista", 250.0f },
                { "Santo Tomé", 247.5f },
                { "Villa Constitución", 235.0f },
                { "Esperanza", 248.5f },
                { "Granadero Baigorria", 241.5f },
                { "San Lorenzo", 243.0f },
                { "Mendoza Capital", 250.0f },
                { "Guaymallén", 249.5f },
                { "Godoy Cruz", 248.5f },
                { "Las Heras", 249.0f },
                { "Maipú", 247.0f },
                { "San Rafael", 250.0f },
                { "Luján de Cuyo", 248.0f },
                { "San Martín", 246.0f },
                { "Rivadavia", 245.0f },
                { "Tunuyán", 249.0f },
                { "San Miguel de Tucumán", 250.0f },
                { "Yerba Buena", 249.5f },
                { "Tafí Viejo", 249.0f },
                { "Concepción", 245.0f },
                { "Banda del Río Salí", 248.5f },
                { "Salta Capital", 250.0f },
                { "San Ramón de la Nueva Orán", 250.0f },
                { "Tartagal", 250.0f },
                { "General Güemes", 248.0f },
                { "Rosario de la Frontera", 245.0f },
                { "San Salvador de Jujuy", 250.0f },
                { "San Pedro de Jujuy", 249.0f },
                { "Palpalá", 249.5f },
                { "Perico", 248.0f },
                { "Libertador General San Martín", 250.0f },
                { "Resistencia", 250.0f },
                { "Presidencia Roque Sáenz Peña", 248.0f },
                { "Villa Ángela", 245.0f },
                { "Charata", 246.0f },
                { "Fontana", 249.5f },
                { "Posadas", 250.0f },
                { "Oberá", 245.0f },
                { "Eldorado", 248.0f },
                { "Puerto Iguazú", 250.0f },
                { "Apóstoles", 246.0f },
                { "Corrientes Capital", 250.0f },
                { "Goya", 245.0f },
                { "Paso de los Libres", 248.0f },
                { "Curuzú Cuatiá", 246.0f },
                { "Mercedes", 244.0f }
            };


        public static float CalcularDistancia(string destino)
        {
            if (_distancias_de_municipios.TryGetValue(destino, out float distancia))
            {
                return distancia;
            }
            return 150;
        }
    }
}