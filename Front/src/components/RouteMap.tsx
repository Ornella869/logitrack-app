import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Box, Typography } from '@mui/material'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeNumberedIcon(num: number, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
      background:${color};border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.4);
      display:flex;align-items:center;justify-content:center;
    "><span style="transform:rotate(45deg);color:white;font-weight:700;font-size:13px;display:block;text-align:center;line-height:28px;">${num}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  })
}

const TRUCK_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;border-radius:50%;
    background:#1976d2;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-size:18px;
  ">🚚</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
})

const BRANCH_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:38px;height:38px;border-radius:8px;
    background:#5e35b1;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-size:18px;color:white;
  ">🏢</div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -20],
})

type Parada = {
  paqueteId: string
  codigoSeguimiento: string
  orden: number
  direccion: string
  localidad: string
  destinatario: string
  status: string
  latitud?: number | null
  longitud?: number | null
}

type Origen = {
  nombre: string
  direccion: string
  ciudad: string
  latitud: number
  longitud: number
}

interface RouteMapProps {
  paradas: Parada[]
  proximaIdx: number
  origen?: Origen | null
  height?: number | string
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || positions.length === 0) return
    fitted.current = true
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] })
    }
  }, [map, positions])
  return null
}

// OSRM público de OpenStreetMap. Sin API key, rate-limited.
// Devuelve la geometría real por calles entre los puntos en orden.
// Si falla (red caída, demasiados puntos), retornamos null para que
// el caller decida el fallback (línea recta o midpoint geométrico).
async function fetchOsrmRoute(
  points: [number, number][],
  signal: AbortSignal,
): Promise<[number, number][] | null> {
  if (points.length < 2) return null
  const coords = points.map(([lat, lng]) => `${lng},${lat}`).join(';')
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  try {
    const r = await fetch(url, { signal })
    if (!r.ok) return null
    const data = await r.json()
    if (data?.code !== 'Ok' || !data?.routes?.length) return null
    const geo = data.routes[0].geometry?.coordinates as [number, number][] | undefined
    if (!geo) return null
    return geo.map(([lng, lat]) => [lat, lng])
  } catch {
    return null
  }
}

function useOsrmRoute(positions: [number, number][]) {
  const [routeGeo, setRouteGeo] = useState<[number, number][] | null>(null)
  useEffect(() => {
    if (positions.length < 2) {
      setRouteGeo(null)
      return
    }
    const ctrl = new AbortController()
    fetchOsrmRoute(positions, ctrl.signal).then((geo) => setRouteGeo(geo))
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(positions)])
  return routeGeo
}

// Distancia haversine en metros entre dos coords [lat,lng].
function haversineMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000
  const lat1 = (a[0] * Math.PI) / 180
  const lat2 = (b[0] * Math.PI) / 180
  const dLat = ((b[0] - a[0]) * Math.PI) / 180
  const dLng = ((b[1] - a[1]) * Math.PI) / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// Camina la geometría OSRM hasta el punto a la mitad de la distancia recorrida.
// Devuelve coords interpoladas para que el camión caiga EXACTAMENTE sobre la calle.
function midpointAlongRoute(geo: [number, number][]): [number, number] | null {
  if (!geo || geo.length === 0) return null
  if (geo.length === 1) return geo[0]
  let total = 0
  const cum: number[] = [0]
  for (let i = 1; i < geo.length; i++) {
    total += haversineMeters(geo[i - 1], geo[i])
    cum.push(total)
  }
  if (total === 0) return geo[0]
  const half = total / 2
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= half) {
      const a = geo[i - 1]
      const b = geo[i]
      const segLen = cum[i] - cum[i - 1]
      const ratio = segLen === 0 ? 0 : (half - cum[i - 1]) / segLen
      return [a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])]
    }
  }
  return geo[geo.length - 1]
}

// Dado "desde" y "hasta", pide a OSRM la ruta real y devuelve el punto a la mitad
// de la distancia. Si OSRM falla, fallback al midpoint geométrico.
function useTruckOnRoute(
  desde: [number, number] | null,
  hasta: [number, number] | null,
): [number, number] | null {
  const [pos, setPos] = useState<[number, number] | null>(null)
  useEffect(() => {
    if (!desde || !hasta) {
      setPos(null)
      return
    }
    // Fallback inmediato (geométrico) para que algo se vea mientras OSRM responde.
    setPos([(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2])
    const ctrl = new AbortController()
    fetchOsrmRoute([desde, hasta], ctrl.signal).then((geo) => {
      if (!geo) return
      const mid = midpointAlongRoute(geo)
      if (mid) setPos(mid)
    })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde?.[0], desde?.[1], hasta?.[0], hasta?.[1]])
  return pos
}

// Si dos o más paradas tienen coordenadas casi idénticas (mismo edificio o calle),
// las separamos visualmente en un círculo chico (~25 m) para que se vean ambas.
// No tocamos las coords originales — sólo las "presentadas" en el mapa.
function spreadOverlappingMarkers<T extends { latitud: number; longitud: number }>(items: T[]): T[] {
  const SAME_POINT_PRECISION = 4 // ~11 m de tolerancia
  const groups = new Map<string, T[]>()
  items.forEach((p) => {
    const key = `${p.latitud.toFixed(SAME_POINT_PRECISION)},${p.longitud.toFixed(SAME_POINT_PRECISION)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(p)
  })
  const out: T[] = []
  groups.forEach((group) => {
    if (group.length === 1) {
      out.push(group[0])
      return
    }
    // Distribuir en círculo de ~25 m
    const radius = 0.00022 // ~25 m
    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / group.length
      out.push({
        ...p,
        latitud: p.latitud + radius * Math.cos(angle),
        longitud: p.longitud + radius * Math.sin(angle),
      })
    })
  })
  return out
}

export default function RouteMap({ paradas, proximaIdx, origen, height = 340 }: RouteMapProps) {
  const paradasConCoords = paradas.filter(
    (p): p is Parada & { latitud: number; longitud: number } =>
      p.latitud != null && p.longitud != null,
  )
  // Markers a renderizar — separados si están solapados, pero conservando
  // las coords originales para los cálculos de ruta.
  const paradasParaMostrar = spreadOverlappingMarkers(paradasConCoords)

  const tieneOrigen = origen?.latitud != null && origen?.longitud != null

  if (paradasConCoords.length === 0 && !tieneOrigen) {
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#f5f5f5',
          border: '1px solid #ddd',
          borderRadius: 1,
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          📍 Sin coordenadas disponibles
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Las paradas registradas antes de la integración con el mapa no tienen ubicación guardada.
        </Typography>
      </Box>
    )
  }

  // Línea conectada: sucursal → todas las paradas en orden (originales).
  const positions: [number, number][] = []
  if (tieneOrigen) positions.push([origen!.latitud, origen!.longitud])
  paradasConCoords.forEach((p) => positions.push([p.latitud, p.longitud]))

  const DEFAULT_CENTER: [number, number] = positions[0] ??
    (paradasConCoords[0] ? [paradasConCoords[0].latitud, paradasConCoords[0].longitud] : [-34.6037, -58.3816])

  // Detectar paquete en tránsito y última parada entregada.
  const enTransito = paradas.find(
    (p): p is Parada & { latitud: number; longitud: number } =>
      p.status === 'En tránsito' && p.latitud != null && p.longitud != null,
  )
  const entregadasConCoords = paradas.filter(
    (p): p is Parada & { latitud: number; longitud: number } =>
      p.status === 'Entregado' && p.latitud != null && p.longitud != null,
  )
  const ultimaEntregada = entregadasConCoords[entregadasConCoords.length - 1]

  // Para el camión sólo cuando está en tránsito: pedimos la ruta OSRM real
  // entre el punto de origen del trayecto actual y la parada en tránsito,
  // y ubicamos el camión a la mitad de la DISTANCIA recorrida (sobre calles).
  const desde: [number, number] | null = enTransito
    ? ultimaEntregada
      ? [ultimaEntregada.latitud, ultimaEntregada.longitud]
      : tieneOrigen
        ? [origen!.latitud, origen!.longitud]
        : null
    : null
  const hasta: [number, number] | null = enTransito
    ? [enTransito.latitud, enTransito.longitud]
    : null
  const truckPosOnRoute = useTruckOnRoute(desde, hasta)

  let truckPos: [number, number] | null = null
  let truckLabel = ''
  if (enTransito) {
    truckPos = truckPosOnRoute
    truckLabel = `Camino a parada ${enTransito.orden} — ${enTransito.direccion}`
  } else if (ultimaEntregada) {
    truckPos = [ultimaEntregada.latitud, ultimaEntregada.longitud]
    truckLabel = `Última entrega: parada ${ultimaEntregada.orden}`
  } else if (tieneOrigen) {
    truckPos = [origen!.latitud, origen!.longitud]
    truckLabel = `En sucursal — listo para salir`
  }

  const routeGeo = useOsrmRoute(positions)
  const trazo = routeGeo ?? positions

  // FitBounds debe usar los puntos de paradas + origen.
  const fitPositions: [number, number][] = []
  if (tieneOrigen) fitPositions.push([origen!.latitud, origen!.longitud])
  paradasConCoords.forEach((p) => fitPositions.push([p.latitud, p.longitud]))

  return (
    <Box sx={{ height, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · routing &copy; <a href="http://project-osrm.org/">OSRM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={fitPositions} />

        {/* Trazo real por calles (OSRM). Si OSRM no responde, queda la línea recta. */}
        {trazo.length > 1 && (
          <Polyline positions={trazo} pathOptions={{ color: '#1976d2', weight: 4, opacity: 0.8 }} />
        )}

        {/* Marker especial para la sucursal de origen */}
        {tieneOrigen && (
          <Marker position={[origen!.latitud, origen!.longitud]} icon={BRANCH_ICON}>
            <Popup>
              <strong>🏢 {origen!.nombre}</strong>
              <br />
              {origen!.direccion}, {origen!.ciudad}
              <br />
              <em>Punto de salida</em>
            </Popup>
          </Marker>
        )}

        {/* Markers numerados de las paradas — con z-index decreciente para que
            la parada 1 quede arriba si hay solapamiento residual y se separan
            visualmente las que tienen coords casi idénticas. */}
        {paradasParaMostrar.map((p) => {
          const isCompleted = p.status === 'Entregado' || p.status === 'Cancelado'
          const isCurrent = paradas.findIndex((x) => x.paqueteId === p.paqueteId) === proximaIdx
          const color = isCompleted ? '#2e7d32' : isCurrent ? '#ed6c02' : '#9e9e9e'
          return (
            <Marker
              key={p.paqueteId}
              position={[p.latitud, p.longitud]}
              icon={makeNumberedIcon(p.orden, color)}
              zIndexOffset={500 - p.orden}
            >
              <Popup>
                <strong>Parada {p.orden}</strong>
                <br />
                {p.direccion}, {p.localidad}
                <br />
                👤 {p.destinatario}
                <br />
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.codigoSeguimiento}</span>
              </Popup>
            </Marker>
          )
        })}

        {/* Ubicación simulada del repartidor — sucursal, mitad de ruta o última entrega */}
        {truckPos && (
          <Marker position={truckPos} icon={TRUCK_ICON} zIndexOffset={1000}>
            <Popup>
              🚚 Ubicación simulada del repartidor
              <br />
              {truckLabel}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </Box>
  )
}
