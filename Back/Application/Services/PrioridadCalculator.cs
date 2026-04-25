using Back.Domain.Models;
using NetTopologySuite.Geometries;

namespace Back.Application.Services
{
    public class PrioridadCalculator
    {

        static public float CalcularPrioridad(double peso, double distancia)
        {
            float prioridad = 1.0f;

            // Entre más cercano, más prioridad. 
            // Si la distancia es menor a 50km sumamos 3, si es menor a 150km sumamos 1.
            if (distancia < 50)
            {
                prioridad += 1.5f;
            }
            else if (distancia < 150)
            {
                prioridad += 0.5f;
            }

            // Por cada 500 gramos (0.5 kg) suma 1 de prioridad
            prioridad += (float)(peso / 3.0);


            // Asegurar que el rango esté entre 1 y 10
            return Math.Clamp(prioridad, 1.0f, 10.0f);

        }
    }
}