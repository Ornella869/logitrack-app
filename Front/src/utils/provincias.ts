// Listado oficial de provincias argentinas (incluye CABA).
// Los nombres usados acá son los que reconocen Georef y Nominatim para
// el parámetro `state` / `provincia`, así que el back puede pasarlos tal cual
// al GeocodingService sin transformaciones.
export const AR_PROVINCIAS = [
  'Buenos Aires',
  'Ciudad Autónoma de Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
] as const

export type Provincia = (typeof AR_PROVINCIAS)[number]

// Normaliza un nombre devuelto por Nominatim/Georef a una provincia conocida.
// Maneja casos comunes: "Tierra del Fuego, Antártida e Islas..." → "Tierra del Fuego",
// "CABA"/"Capital Federal" → "Ciudad Autónoma de Buenos Aires".
export function normalizeProvincia(raw?: string | null): Provincia | null {
  if (!raw) return null
  const value = raw.trim()
  if (!value) return null

  // Match exacto primero.
  const exact = AR_PROVINCIAS.find((p) => p.toLowerCase() === value.toLowerCase())
  if (exact) return exact

  // Mapeos conocidos.
  const lower = value.toLowerCase()
  if (lower.startsWith('tierra del fuego')) return 'Tierra del Fuego'
  if (lower === 'caba' || lower === 'capital federal' || lower.startsWith('buenos aires f.d.')) {
    return 'Ciudad Autónoma de Buenos Aires'
  }
  if (lower === 'provincia de buenos aires') return 'Buenos Aires'

  // Match parcial: la provincia conocida está contenida en el valor.
  const partial = AR_PROVINCIAS.find((p) => lower.includes(p.toLowerCase()))
  return partial ?? null
}
