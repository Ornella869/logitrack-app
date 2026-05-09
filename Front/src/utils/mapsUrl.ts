// Helper para construir la URL de Google Maps con direcciones textuales reales.
// Usamos texto (calle + número + ciudad + CP + país) y NO coordenadas porque
// cuando el geocoding del back fue aproximado las coords caen en otra cuadra
// y Maps las muestra tal cual. Pasando texto, Maps geocodifica internamente
// y respeta la altura exacta.
export interface MapsStop {
  direccion: string
  localidad: string
  codigoPostal?: string | null
  status: string
}

export interface MapsOrigen {
  direccion: string
  ciudad: string
  codigoPostal?: string | null
}

const formatStop = (s: MapsStop): string => {
  const cp = s.codigoPostal && s.codigoPostal !== 'No disponible' ? ` ${s.codigoPostal}` : ''
  return `${s.direccion}, ${s.localidad}${cp}, Argentina`
}

const formatOrigen = (o: MapsOrigen): string => {
  const cp = o.codigoPostal ? ` ${o.codigoPostal}` : ''
  return `${o.direccion}, ${o.ciudad}${cp}, Argentina`
}

export function buildMapsUrl(stops: MapsStop[], origen: MapsOrigen | null): string | null {
  if (stops.length === 0) return null
  const pending = stops.filter((s) => s.status !== 'Entregado' && s.status !== 'Cancelado')
  const active = pending.length > 0 ? pending : stops

  const origin = origen ? formatOrigen(origen) : formatStop(active[0])

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination: formatStop(active[active.length - 1]),
  })
  const waypoints = active.length > 1 ? active.slice(0, -1) : []
  if (waypoints.length > 0) params.set('waypoints', waypoints.map(formatStop).join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}
