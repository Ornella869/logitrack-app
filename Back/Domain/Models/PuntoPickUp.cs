namespace Back.Domain.Models
{
    public class PuntoPickUp
    {
        public Guid Id { get; private set; } = Guid.NewGuid();
        public string Nombre { get; private set; } = string.Empty;
        public string Direccion { get; private set; } = string.Empty;
        public string Localidad { get; private set; } = string.Empty;
        public string CodigoPostal { get; private set; } = string.Empty;
        public string Provincia { get; private set; } = string.Empty;
        public string Horarios { get; private set; } = string.Empty;
        public int CapacidadDiaria { get; private set; } = 100;
        public string? Telefono { get; private set; }
        public bool Activo { get; private set; } = true;
        public DateTime CreadoEn { get; private set; } = DateTime.UtcNow;

        private PuntoPickUp() { }

        public PuntoPickUp(string nombre, string direccion, string localidad, string codigoPostal, string provincia, string horarios, string? telefono, int capacidadDiaria = 100)
        {
            Actualizar(nombre, direccion, localidad, codigoPostal, provincia, horarios, telefono, capacidadDiaria);
        }

        public void Actualizar(string nombre, string direccion, string localidad, string codigoPostal, string provincia, string horarios, string? telefono, int capacidadDiaria = 100)
        {
            if (string.IsNullOrWhiteSpace(nombre)) throw new InvalidOperationException("El nombre es obligatorio.");
            if (string.IsNullOrWhiteSpace(direccion)) throw new InvalidOperationException("La direccion es obligatoria.");
            if (string.IsNullOrWhiteSpace(localidad)) throw new InvalidOperationException("La localidad es obligatoria.");
            if (string.IsNullOrWhiteSpace(codigoPostal)) throw new InvalidOperationException("El codigo postal es obligatorio.");
            if (string.IsNullOrWhiteSpace(provincia)) throw new InvalidOperationException("La provincia es obligatoria.");
            if (string.IsNullOrWhiteSpace(horarios)) throw new InvalidOperationException("Los horarios son obligatorios.");
            if (capacidadDiaria <= 0) throw new InvalidOperationException("La capacidad diaria debe ser mayor a 0.");

            Nombre = nombre.Trim();
            Direccion = direccion.Trim();
            Localidad = localidad.Trim();
            CodigoPostal = codigoPostal.Trim();
            Provincia = provincia.Trim();
            Horarios = horarios.Trim();
            CapacidadDiaria = capacidadDiaria;
            Telefono = string.IsNullOrWhiteSpace(telefono) ? null : telefono.Trim();
        }

        public void ActualizarHorariosYCapacidad(string horarios, int capacidadDiaria)
        {
            if (string.IsNullOrWhiteSpace(horarios)) throw new InvalidOperationException("Los horarios son obligatorios.");
            var h = horarios.Trim();
            if (h.Length < 5) throw new InvalidOperationException("Los horarios deben ser más descriptivos (ej: \"Lun–Vie 09:00 a 18:00\").");
            if (h.Length > 150) throw new InvalidOperationException("Los horarios no pueden superar los 150 caracteres.");
            if (!h.Any(char.IsDigit)) throw new InvalidOperationException("Los horarios deben incluir al menos una hora (ej: \"Lun–Vie 09:00 a 18:00\").");
            // Validar que cada patrón HH:MM sea una hora real (00:00 – 23:59)
            var timeMatches = System.Text.RegularExpressions.Regex.Matches(h, @"\b(\d{1,2}):(\d{2})\b");
            foreach (System.Text.RegularExpressions.Match m in timeMatches)
            {
                int hora = int.Parse(m.Groups[1].Value);
                int min = int.Parse(m.Groups[2].Value);
                if (hora > 23 || min > 59)
                    throw new InvalidOperationException($"\"{m.Value}\" no es una hora válida. Usá el formato 00:00 a 23:59.");
            }
            if (System.Text.RegularExpressions.Regex.IsMatch(h, @"(\ba\b|de|desde|hasta|:)\s*$", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
                throw new InvalidOperationException("Los horarios parecen incompletos. Especificá el horario de cierre.");
            if (capacidadDiaria <= 0) throw new InvalidOperationException("La capacidad debe ser mayor a 0.");
            if (capacidadDiaria > 500) throw new InvalidOperationException("La capacidad diaria no puede superar los 500 envíos.");
            Horarios = h;
            CapacidadDiaria = capacidadDiaria;
        }

        public void Desactivar() => Activo = false;
        public void Activar() => Activo = true;
    }
}
