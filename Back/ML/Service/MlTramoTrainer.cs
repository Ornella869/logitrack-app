using Back.Domain.Models;
using Microsoft.ML;

namespace Back.Ml.Service
{
    // G1L-162: entrenamiento real (ML.NET / FastTree) del modelo de estimación de tiempo de tramo
    // a partir de los datos históricos (DatoEntrenamientoTramo). Mejora a medida que se acumulan datos.
    public class TramoTrainRow
    {
        public float DiaSemana { get; set; }
        public float HoraSalida { get; set; }
        public float PesoKg { get; set; }
        public float CargaOrigen { get; set; }
        public float RepartidoresDestino { get; set; }
        public float EsPrioritario { get; set; }
        public string Tramo { get; set; } = string.Empty;
        public float TiempoRealHoras { get; set; } // label
    }

    public class TramoTrainResult
    {
        public bool Entrenado { get; set; }
        public int Registros { get; set; }
        public double MaeModelo { get; set; }
    }

    public static class MlTramoTrainer
    {
        public const int MinimoRegistros = 10;

        public static TramoTrainResult EntrenarYGuardar(IEnumerable<DatoEntrenamientoTramo> datos, string rutaModelo)
        {
            var rows = datos.Select(d => new TramoTrainRow
            {
                DiaSemana = d.DiaSemana,
                HoraSalida = d.HoraSalida,
                PesoKg = (float)d.PesoKg,
                CargaOrigen = d.CargaSucursalOrigen,
                RepartidoresDestino = d.RepartidoresActivosDestino,
                EsPrioritario = d.EsPrioritario ? 1f : 0f,
                Tramo = $"{d.SucursalOrigenId}->{d.SucursalDestinoId}",
                TiempoRealHoras = (float)d.TiempoRealHoras,
            }).ToList();

            if (rows.Count < MinimoRegistros)
                return new TramoTrainResult { Entrenado = false, Registros = rows.Count };

            var ml = new MLContext(seed: 1);
            var data = ml.Data.LoadFromEnumerable(rows);

            var pipeline = ml.Transforms.Categorical.OneHotEncoding("TramoEnc", nameof(TramoTrainRow.Tramo))
                .Append(ml.Transforms.Concatenate("Features",
                    nameof(TramoTrainRow.DiaSemana), nameof(TramoTrainRow.HoraSalida),
                    nameof(TramoTrainRow.PesoKg), nameof(TramoTrainRow.CargaOrigen),
                    nameof(TramoTrainRow.RepartidoresDestino), nameof(TramoTrainRow.EsPrioritario),
                    "TramoEnc"))
                .Append(ml.Regression.Trainers.FastTree(
                    labelColumnName: nameof(TramoTrainRow.TiempoRealHoras),
                    featureColumnName: "Features"));

            double mae;
            try
            {
                var folds = Math.Min(5, Math.Max(2, rows.Count / 5));
                var cv = ml.Regression.CrossValidate(data, pipeline,
                    numberOfFolds: folds, labelColumnName: nameof(TramoTrainRow.TiempoRealHoras));
                mae = cv.Average(f => f.Metrics.MeanAbsoluteError);
            }
            catch
            {
                // pocos datos: holdout simple en vez de validación cruzada
                var split = ml.Data.TrainTestSplit(data, testFraction: 0.25);
                var fitted = pipeline.Fit(split.TrainSet);
                var metrics = ml.Regression.Evaluate(fitted.Transform(split.TestSet),
                    labelColumnName: nameof(TramoTrainRow.TiempoRealHoras));
                mae = metrics.MeanAbsoluteError;
            }

            var model = pipeline.Fit(data);
            var dir = Path.GetDirectoryName(rutaModelo);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            ml.Model.Save(model, data.Schema, rutaModelo);

            return new TramoTrainResult { Entrenado = true, Registros = rows.Count, MaeModelo = Math.Round(mae, 2) };
        }
    }
}
