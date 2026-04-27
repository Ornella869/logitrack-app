
namespace Back.Application.Abstractions
{
    public interface IMLPrioridadPrediction
    {
        public Task<float> Predecir(float peso, float distancia);
    }

}
