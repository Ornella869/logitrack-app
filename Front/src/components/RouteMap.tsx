import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Box, Typography } from '@mui/material'
import LocationOffIcon from '@mui/icons-material/LocationOff'

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

function makeSvgIcon({
  size,
  background,
  borderRadius,
  svg,
}: {
  size: number
  background: string
  borderRadius: string
  svg: string
}) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:${borderRadius};background:${background};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;">${svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -Math.round(size * 0.55)],
  })
}

const TRUCK_ICON = makeSvgIcon({
  size: 36,
  background: '#1976d2',
  borderRadius: '50%',
  svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M3 7.75A1.75 1.75 0 0 1 4.75 6h8.5C14.22 6 15 6.78 15 7.75V9h2.63c.54 0 1.05.25 1.38.68l1.96 2.54c.2.26.31.58.31.91v2.12A1.75 1.75 0 0 1 19.53 17H19a2.5 2.5 0 0 1-5 0H9a2.5 2.5 0 0 1-5 0h-.25A1.75 1.75 0 0 1 2 15.25V14h1V7.75Z" fill="white"/><circle cx="6.5" cy="17.5" r="1.5" fill="#1976d2" stroke="white" stroke-width="1.5"/><circle cx="16.5" cy="17.5" r="1.5" fill="#1976d2" stroke="white" stroke-width="1.5"/></svg>',
})

const PENDING_ICON = makeSvgIcon({
  size: 32,
  background: '#E65100',
  borderRadius: '50%',
  svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 21s6-5.686 6-11a6 6 0 1 0-12 0c0 5.314 6 11 6 11Z" fill="white"/><circle cx="12" cy="10" r="2.5" fill="#E65100"/></svg>',
})

const BRANCH_ICON = makeSvgIcon({
  size: 38,
  background: '#5e35b1',
  borderRadius: '8px',
  svg: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 20V9.5L12 4l8 5.5V20h-2v-2H6v2H4Zm4-4h2v-2H8v2Zm0-4h2v-2H8v2Zm6 4h2v-2h-2v2Zm0-4h2v-2h-2v2ZM11 20h2v-4h-2v4Zm0-8h2v-2h-2v2Z" fill="white"/></svg>',
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
  ubicacionActual?: { latitud: number; longitud: number } | null
  height?: number | string
  showReturnRoute?: boolean
  animateReturnRoute?: boolean
  onMapClick?: (lat: number, lng: number) => void
  pendingMarker?: { latitud: number; longitud: number } | null
}

function isValidPosition(position?: { latitud: number; longitud: number } | null) {
  if (!position) return false
  return Number.isFinite(position.latitud)
    && Number.isFinite(position.longitud)
    && position.latitud >= -56
    && position.latitud <= -21
    && position.longitud >= -75
    && position.longitud <= -52
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng.lat, e.latlng.lng) })
  return null
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
export async function fetchOsrmRoute(
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

// Devuelve el punto exacto sobre la geometría OSRM al progreso t (0=inicio, 1=fin).
export function positionAlongRoute(geo: [number, number][], t: number): [number, number] {
  if (geo.length === 1) return geo[0]
  let total = 0
  const cum: number[] = [0]
  for (let i = 1; i < geo.length; i++) {
    total += haversineMeters(geo[i - 1], geo[i])
    cum.push(total)
  }
  if (total === 0) return geo[0]
  const target = Math.min(t, 1) * total
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] >= target) {
      const a = geo[i - 1], b = geo[i]
      const segLen = cum[i] - cum[i - 1]
      const ratio = segLen === 0 ? 0 : (target - cum[i - 1]) / segLen
      return [a[0] + ratio * (b[0] - a[0]), a[1] + ratio * (b[1] - a[1])]
    }
  }
  return geo[geo.length - 1]
}

function compactCloseRoutePoints(points: [number, number][], minMeters = 25) {
  return points.reduce<[number, number][]>((acc, point) => {
    const last = acc[acc.length - 1]
    if (!last || haversineMeters(last, point) >= minMeters) acc.push(point)
    return acc
  }, [])
}

// Anima el camión a lo largo del segmento desde→hasta usando la geometría real de OSRM.
// Dura TRUCK_ANIM_DURATION_MS ms y se detiene al llegar (no hace loop).
export const TRUCK_ANIM_DURATION_MS = 40000

function useAnimatedTruck(
  desde: [number, number] | null,
  hasta: [number, number] | null,
): [number, number] | null {
  const [geo, setGeo] = useState<[number, number][] | null>(null)
  const [progress, setProgress] = useState(0)

  // Obtener la geometría real del segmento actual.
  useEffect(() => {
    if (!desde || !hasta) { setGeo(null); setProgress(0); return }
    setGeo([desde, hasta]) // fallback inmediato
    const ctrl = new AbortController()
    fetchOsrmRoute([desde, hasta], ctrl.signal).then((r) => { if (r) setGeo(r) })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde?.[0], desde?.[1], hasta?.[0], hasta?.[1]])

  // Animar el progreso 0→1 en TRUCK_ANIM_DURATION_MS ms; se detiene al llegar.
  // Cuando desde/hasta cambian (nueva parada), el efecto se limpia y reinicia desde 0.
  useEffect(() => {
    if (!desde || !hasta) { setProgress(0); return }
    setProgress(0)
    const startTime = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime
      if (elapsed >= TRUCK_ANIM_DURATION_MS) {
        setProgress(1)
        clearInterval(timer)
      } else {
        setProgress(elapsed / TRUCK_ANIM_DURATION_MS)
      }
    }, 150)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde?.[0], desde?.[1], hasta?.[0], hasta?.[1]])

  if (!geo || !desde || !hasta) return null
  return positionAlongRoute(geo, progress)
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

export default function RouteMap({ paradas, proximaIdx, origen, ubicacionActual, height = 340, showReturnRoute = false, animateReturnRoute = false, onMapClick, pendingMarker }: RouteMapProps) {
  const ubicacionReal = isValidPosition(ubicacionActual) ? ubicacionActual : null
  const paradasConCoords = paradas.filter(
    (p): p is Parada & { latitud: number; longitud: number } =>
      p.latitud != null && p.longitud != null,
  )
  // Markers a renderizar — separados si están solapados, pero conservando
  // las coords originales para los cálculos de ruta.
  const paradasParaMostrar = spreadOverlappingMarkers(paradasConCoords)

  const tieneOrigen = origen?.latitud != null && origen?.longitud != null

  if (paradasConCoords.length === 0 && !tieneOrigen && !ubicacionReal) {
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
        <LocationOffIcon color="disabled" />
        <Typography variant="body2" color="text.secondary">
          Sin coordenadas disponibles
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
  const routingPositions = compactCloseRoutePoints(positions)

  const DEFAULT_CENTER: [number, number] = positions[0] ??
    (ubicacionReal ? [ubicacionReal.latitud, ubicacionReal.longitud] : undefined) ??
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
  const truckPosOnRoute = useAnimatedTruck(desde, hasta)

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

  const routeGeo = useOsrmRoute(routingPositions)
  const trazo = routeGeo ?? routingPositions

  // Return route: from last delivered stop back to the origin branch.
  const ultimaEntregadaParaRetorno = showReturnRoute
    ? ([...paradasConCoords].reverse().find((p) => p.status === 'Entregado') ?? null)
    : null
  const returnPositions: [number, number][] =
    ultimaEntregadaParaRetorno && tieneOrigen
      ? [
          [ultimaEntregadaParaRetorno.latitud, ultimaEntregadaParaRetorno.longitud],
          [origen!.latitud, origen!.longitud],
        ]
      : []
  const returnRouteGeo = useOsrmRoute(returnPositions)
  const returnTrazo = returnRouteGeo ?? returnPositions
  // Animar el retorno solo cuando el repartidor hizo click en "Retorno a Sucursal".
  const returnTruckPos = useAnimatedTruck(
    animateReturnRoute && returnPositions.length === 2 ? returnPositions[0] : null,
    animateReturnRoute && returnPositions.length === 2 ? returnPositions[1] : null,
  )

  // Cuando está en retorno: si ya se clickeó el botón, el camión se mueve hacia la sucursal;
  // si aún no, se queda quieto en la última parada entregada.
  if (showReturnRoute) {
    if (animateReturnRoute && (returnTruckPos || ultimaEntregadaParaRetorno)) {
      truckPos = returnTruckPos ?? (ultimaEntregadaParaRetorno ? [ultimaEntregadaParaRetorno.latitud, ultimaEntregadaParaRetorno.longitud] : truckPos)
      truckLabel = 'Regresando a la sucursal'
    } else if (!animateReturnRoute && ultimaEntregadaParaRetorno) {
      truckPos = [ultimaEntregadaParaRetorno.latitud, ultimaEntregadaParaRetorno.longitud]
      truckLabel = 'Todas las entregas completadas'
    }
  }

  if (ubicacionReal) {
    truckPos = [ubicacionReal.latitud, ubicacionReal.longitud]
    truckLabel = 'Ubicacion compartida por el repartidor'
  }

  // FitBounds debe usar los puntos de paradas + origen.
  const fitPositions: [number, number][] = []
  if (tieneOrigen) fitPositions.push([origen!.latitud, origen!.longitud])
  paradasConCoords.forEach((p) => fitPositions.push([p.latitud, p.longitud]))
  if (ubicacionReal) fitPositions.push([ubicacionReal.latitud, ubicacionReal.longitud])

  return (
    <Box sx={{ height, width: '100%', borderRadius: 1, overflow: 'hidden', border: `1px solid ${onMapClick ? '#E65100' : '#ddd'}`, cursor: onMapClick ? 'crosshair' : 'auto' }}>
      <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%', cursor: 'inherit' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · routing &copy; <a href="http://project-osrm.org/">OSRM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={fitPositions} />
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        {/* Trazo real por calles (OSRM). Si OSRM no responde, queda la línea recta. */}
        {trazo.length > 1 && (
          <Polyline positions={trazo} pathOptions={{ color: '#1976d2', weight: 4, opacity: showReturnRoute ? 0.3 : 0.8 }} />
        )}

        {/* Ruta de retorno a la sucursal — línea punteada violeta */}
        {returnTrazo.length > 1 && (
          <Polyline positions={returnTrazo} pathOptions={{ color: '#5e35b1', weight: 5, opacity: 0.9, dashArray: '12,6' }} />
        )}

        {/* Marker especial para la sucursal de origen */}
        {tieneOrigen && (
          <Marker position={[origen!.latitud, origen!.longitud]} icon={BRANCH_ICON}>
            <Popup>
              <strong>{origen!.nombre}</strong>
              <br />
              {origen!.direccion}, {origen!.ciudad}
              <br />
              <em>{showReturnRoute ? 'Destino de retorno' : 'Punto de salida'}</em>
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
                Destinatario: {p.destinatario}
                <br />
                <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.codigoSeguimiento}</span>
              </Popup>
            </Marker>
          )
        })}

        {/* Ubicacion real si existe; simulada como fallback de demo. */}
        {truckPos && (
          <Marker position={truckPos} icon={TRUCK_ICON} zIndexOffset={1000}>
            <Popup>
              {ubicacionReal ? 'Ubicacion actual del repartidor' : 'Ubicacion simulada del repartidor'}
              <br />
              {truckLabel}
            </Popup>
          </Marker>
        )}

        {/* Marcador pendiente de confirmacion (colocado por el supervisor) */}
        {pendingMarker && (
          <Marker position={[pendingMarker.latitud, pendingMarker.longitud]} icon={PENDING_ICON} zIndexOffset={2000}>
            <Popup>Nueva ubicación - confirmá arriba</Popup>
          </Marker>
        )}
      </MapContainer>
    </Box>
  )
}
