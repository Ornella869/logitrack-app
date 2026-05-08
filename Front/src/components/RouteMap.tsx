import { useEffect, useRef } from 'react'
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

interface RouteMapProps {
  paradas: Parada[]
  proximaIdx: number
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

export default function RouteMap({ paradas, proximaIdx, height = 340 }: RouteMapProps) {
  const paradasConCoords = paradas.filter(
    (p): p is Parada & { latitud: number; longitud: number } =>
      p.latitud != null && p.longitud != null,
  )

  if (paradasConCoords.length === 0) {
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

  const positions: [number, number][] = paradasConCoords.map((p) => [p.latitud, p.longitud])
  const DEFAULT_CENTER: [number, number] = positions[0] ?? [-34.6037, -58.3816]

  const paradaActual = proximaIdx >= 0 ? paradas[proximaIdx] : null
  const paradaActualTieneCoords =
    paradaActual?.latitud != null && paradaActual?.longitud != null

  return (
    <Box sx={{ height, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer center={DEFAULT_CENTER} zoom={12} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds positions={positions} />

        {/* Polyline conectando paradas en orden (solo las que tienen coords) */}
        {positions.length > 1 && (
          <Polyline positions={positions} pathOptions={{ color: '#1976d2', weight: 3, opacity: 0.7 }} />
        )}

        {/* Markers numerados */}
        {paradas.map((p, idx) => {
          if (p.latitud == null || p.longitud == null) return null
          const isCompleted = p.status === 'Entregado' || p.status === 'Cancelado'
          const isCurrent = idx === proximaIdx
          const color = isCompleted ? '#2e7d32' : isCurrent ? '#ed6c02' : '#9e9e9e'
          return (
            <Marker
              key={p.paqueteId}
              position={[p.latitud, p.longitud]}
              icon={makeNumberedIcon(p.orden, color)}
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

        {/* Marker especial en la parada actual (ubicación simulada del repartidor) */}
        {paradaActual && paradaActualTieneCoords && (
          <Marker
            position={[paradaActual.latitud!, paradaActual.longitud!]}
            icon={TRUCK_ICON}
            zIndexOffset={1000}
          >
            <Popup>
              🚚 Ubicación simulada del repartidor
              <br />
              Parada actual: {paradaActual.orden} — {paradaActual.direccion}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </Box>
  )
}
