namespace Back.Domain.Models
{
    public enum PlanEmpresa
    {
        Basico = 0,
        Premium = 1,
    }

    public enum EstadoEmpresa
    {
        Activa = 0,
        Suspendida = 1,
    }

    public class Empresa
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public string Nombre { get; private set; } = string.Empty;
        public PlanEmpresa Plan { get; private set; } = PlanEmpresa.Basico;
        public int LimiteCuentas { get; private set; } = 50;
        public EstadoEmpresa Estado { get; private set; } = EstadoEmpresa.Activa;
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;
        public DateTime ActualizadoEn { get; private set; } = DateTime.UtcNow;

        // Para flujo de cambio de plan con código de verificación (G1L-63).
        public string? CodigoCambioPendiente { get; private set; }
        public PlanEmpresa? PlanDestinoPendiente { get; private set; }
        public int? LimiteDestinoPendiente { get; private set; }
        public int IntentosCodigoFallidos { get; private set; }
        public DateTime? CodigoEmitidoEn { get; private set; }

        private Empresa() { }

        public Empresa(string nombre, PlanEmpresa plan, int limiteCuentas)
        {
            Nombre = nombre;
            Plan = plan;
            LimiteCuentas = limiteCuentas;
        }

        public void EmitirCodigoCambio(PlanEmpresa planDestino, int limiteDestino)
        {
            CodigoCambioPendiente = GenerarCodigo();
            PlanDestinoPendiente = planDestino;
            LimiteDestinoPendiente = limiteDestino;
            IntentosCodigoFallidos = 0;
            CodigoEmitidoEn = DateTime.UtcNow;
            ActualizadoEn = DateTime.UtcNow;
        }

        public bool VerificarCodigoYAplicar(string codigo)
        {
            if (CodigoCambioPendiente is null || PlanDestinoPendiente is null || LimiteDestinoPendiente is null)
                throw new InvalidOperationException("No hay un cambio de plan pendiente.");

            if (IntentosCodigoFallidos >= 3)
                throw new InvalidOperationException("Código inválido tras 3 intentos. Solicitá un nuevo cambio.");

            if (!string.Equals(codigo?.Trim(), CodigoCambioPendiente, StringComparison.OrdinalIgnoreCase))
            {
                IntentosCodigoFallidos++;
                ActualizadoEn = DateTime.UtcNow;
                if (IntentosCodigoFallidos >= 3)
                {
                    CodigoCambioPendiente = null;
                    PlanDestinoPendiente = null;
                    LimiteDestinoPendiente = null;
                }
                return false;
            }

            Plan = PlanDestinoPendiente.Value;
            LimiteCuentas = LimiteDestinoPendiente.Value;
            CodigoCambioPendiente = null;
            PlanDestinoPendiente = null;
            LimiteDestinoPendiente = null;
            IntentosCodigoFallidos = 0;
            ActualizadoEn = DateTime.UtcNow;
            return true;
        }

        public void Suspender()
        {
            Estado = EstadoEmpresa.Suspendida;
            ActualizadoEn = DateTime.UtcNow;
        }

        public void Reactivar()
        {
            Estado = EstadoEmpresa.Activa;
            ActualizadoEn = DateTime.UtcNow;
        }

        private static string GenerarCodigo()
        {
            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            var rng = Random.Shared;
            return new string(Enumerable.Range(0, 6).Select(_ => chars[rng.Next(chars.Length)]).ToArray());
        }
    }
}
