namespace Back.Ml.Service
{
    using Back.Application.Abstractions;
    using Microsoft.Extensions.ML;
    using Microsoft.ML.Data;

    public class MLNetPrioridadService : IMLPrioridadPrediction
    {
        private readonly PredictionEnginePool<PaqueteData, PrioridadPrediction> _modelPool;

        public MLNetPrioridadService(PredictionEnginePool<PaqueteData, PrioridadPrediction> modelPool)
        {
            _modelPool = modelPool;
        }

        public async Task<float> Predecir(float peso, float distancia)
        {
            var input = new PaqueteData
            {
                Peso = peso,
                Distancia = distancia
            };
            var prediccion = _modelPool.Predict(input);

            return prediccion.Prioridad;
        }
    }


    public class PaqueteData
    {
        public float Peso { get; set; }
        public float Distancia { get; set; }
    }

    public class PrioridadPrediction
    {
        // ML.NET pone el resultado de la regresión en la columna "Score"
        [ColumnName("Score")]
        public float Prioridad { get; set; }
    }
}