using System.Text.Json;

namespace Back.Domain.Models
{
    public class ObservacionIncidencia
    {
        public string Texto { get; set; } = string.Empty;
        public string SupervisorNombre { get; set; } = string.Empty;
        public Guid SupervisorId { get; set; }
        public DateTime Fecha { get; set; } = DateTime.UtcNow;
    }

    public class HistorialEstadoIncidencia
    {
        public string EstadoAnterior { get; set; } = "Abierta";
        public string EstadoNuevo { get; set; } = "Abierta";
        public string PorNombre { get; set; } = string.Empty;
        public Guid? PorId { get; set; }
        public DateTime Fecha { get; set; } = DateTime.UtcNow;
    }

    public class Incidencia
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public Guid? PaqueteId { get; private set; }
        public string? CodigoSeguimiento { get; private set; }
        public Guid? SucursalId { get; private set; }
        public Guid? RepartidorId { get; private set; }
        public string RepartidorNombre { get; private set; } = string.Empty;
        public string Origen { get; private set; } = "repartidor";
        public string Tipo { get; private set; } = "otro";
        public string TipoLabel { get; private set; } = "Otro";
        public string Descripcion { get; private set; } = string.Empty;
        public string Estado { get; private set; } = "Abierta";
        public DateTime FechaReporte { get; private set; } = DateTime.UtcNow;
        public string Severidad { get; private set; } = "Media";
        public DateTime? SlaVenceEn { get; private set; }
        public DateTime? ResueltaEn { get; private set; }
        public string? EmailContacto { get; private set; }
        public bool ChatFinalizado { get; private set; }
        public string ParadasAfectadasJson { get; private set; } = "[]";
        public string ObservacionesJson { get; private set; } = "[]";
        public string HistorialEstadosJson { get; private set; } = "[]";

        private Incidencia() { }

        public Incidencia(
            Guid? paqueteId,
            string? codigoSeguimiento,
            Guid? sucursalId,
            Guid? repartidorId,
            string repartidorNombre,
            string origen,
            string tipo,
            string tipoLabel,
            string descripcion,
            string? emailContacto,
            IEnumerable<Guid>? paradasAfectadas,
            string? severidad = null)
        {
            PaqueteId = paqueteId;
            CodigoSeguimiento = codigoSeguimiento;
            SucursalId = sucursalId;
            RepartidorId = repartidorId;
            RepartidorNombre = repartidorNombre;
            Origen = origen;
            Tipo = tipo;
            TipoLabel = tipoLabel;
            Descripcion = descripcion;
            Severidad = NormalizarSeveridad(severidad);
            SlaVenceEn = FechaReporte.Add(ResolverSla(Severidad));
            EmailContacto = emailContacto;
            ParadasAfectadasJson = JsonSerializer.Serialize(paradasAfectadas ?? Enumerable.Empty<Guid>());
            SetHistorial(new[]
            {
                new HistorialEstadoIncidencia
                {
                    EstadoAnterior = "Abierta",
                    EstadoNuevo = "Abierta",
                    PorNombre = repartidorNombre,
                    PorId = repartidorId,
                    Fecha = FechaReporte,
                },
            });
        }

        public List<Guid> GetParadasAfectadas() =>
            JsonSerializer.Deserialize<List<Guid>>(ParadasAfectadasJson) ?? new List<Guid>();

        public List<ObservacionIncidencia> GetObservaciones() =>
            JsonSerializer.Deserialize<List<ObservacionIncidencia>>(ObservacionesJson) ?? new List<ObservacionIncidencia>();

        public List<HistorialEstadoIncidencia> GetHistorial() =>
            JsonSerializer.Deserialize<List<HistorialEstadoIncidencia>>(HistorialEstadosJson) ?? new List<HistorialEstadoIncidencia>();

        public void CambiarEstado(string nuevoEstado, Guid supervisorId, string supervisorNombre)
        {
            if (string.IsNullOrWhiteSpace(nuevoEstado)) throw new InvalidOperationException("El estado es obligatorio.");
            var anterior = Estado;
            Estado = nuevoEstado.Trim();
            if (string.Equals(Estado, "Resuelta", StringComparison.OrdinalIgnoreCase))
            {
                ChatFinalizado = true;
                ResueltaEn ??= DateTime.UtcNow;
            }
            else
            {
                ResueltaEn = null;
            }
            var historial = GetHistorial();
            historial.Add(new HistorialEstadoIncidencia
            {
                EstadoAnterior = anterior,
                EstadoNuevo = Estado,
                PorNombre = supervisorNombre,
                PorId = supervisorId,
                Fecha = DateTime.UtcNow,
            });
            SetHistorial(historial);
        }

        public void AgregarObservacion(string texto, Guid supervisorId, string supervisorNombre)
        {
            if (string.IsNullOrWhiteSpace(texto)) throw new InvalidOperationException("La observacion es obligatoria.");
            var observaciones = GetObservaciones();
            observaciones.Add(new ObservacionIncidencia
            {
                Texto = texto.Trim(),
                SupervisorId = supervisorId,
                SupervisorNombre = supervisorNombre,
                Fecha = DateTime.UtcNow,
            });
            ObservacionesJson = JsonSerializer.Serialize(observaciones);
        }

        public void FinalizarChat() => ChatFinalizado = true;

        public void CambiarSeveridad(string severidad)
        {
            Severidad = NormalizarSeveridad(severidad);
            SlaVenceEn = FechaReporte.Add(ResolverSla(Severidad));
        }

        private void SetHistorial(IEnumerable<HistorialEstadoIncidencia> historial)
        {
            HistorialEstadosJson = JsonSerializer.Serialize(historial);
        }

        private static string NormalizarSeveridad(string? severidad)
        {
            var value = (severidad ?? "Media").Trim();
            return value.ToLowerInvariant() switch
            {
                "alta" => "Alta",
                "baja" => "Baja",
                _ => "Media",
            };
        }

        private static TimeSpan ResolverSla(string severidad) => severidad switch
        {
            "Alta" => TimeSpan.FromHours(4),
            "Baja" => TimeSpan.FromHours(24),
            _ => TimeSpan.FromHours(12),
        };
    }
}
