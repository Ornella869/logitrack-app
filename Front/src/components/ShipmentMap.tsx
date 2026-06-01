import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Box, Typography } from '@mui/material'

// Fix de iconos default de Leaflet con bundlers tipo Vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816] // Buenos Aires

interface ShipmentMapProps {
  position?: { latitud: number; longitud: number } | null
  editable?: boolean
  onChange?: (lat: number, lng: number) => void
  height?: number | string
}

export default function ShipmentMap({ position, editable = false, onChange, height = 380 }: ShipmentMapProps) {
  const validPosition = isValidArgentinaPosition(position) ? position : null
  if (position && !validPosition) {
    return (
      <Box sx={{ height, width: '100%', borderRadius: 1, border: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f6f8fb', p: 2 }}>
        <Typography variant="body2" color="text.secondary" textAlign="center">
          Ubicacion no disponible. La posicion recibida no corresponde a una coordenada valida de Argentina.
        </Typography>
      </Box>
    )
  }
  const center: [number, number] = validPosition
    ? [validPosition.latitud, validPosition.longitud]
    : DEFAULT_CENTER

  return (
    <Box sx={{ height, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer center={center} zoom={validPosition ? 14 : 11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
        />
        {validPosition && <Marker position={[validPosition.latitud, validPosition.longitud]} />}
        {editable && <ClickHandler onClick={onChange} />}
        <Recenter position={validPosition} />
        <InvalidateOnMount position={validPosition} />
      </MapContainer>
    </Box>
  )
}

function isValidArgentinaPosition(position?: { latitud: number; longitud: number } | null) {
  if (!position) return false
  const { latitud, longitud } = position
  return Number.isFinite(latitud)
    && Number.isFinite(longitud)
    && latitud >= -56
    && latitud <= -21
    && longitud >= -75
    && longitud <= -52
}

function ClickHandler({ onClick }: { onClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick?.(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function Recenter({ position }: { position?: { latitud: number; longitud: number } | null }) {
  const map = useMap()
  const [last, setLast] = useState<string | null>(null)
  useEffect(() => {
    if (!position) return
    const key = `${position.latitud},${position.longitud}`
    if (key === last) return
    setLast(key)
    map.setView([position.latitud, position.longitud], 14)
  }, [position, map, last])
  return null
}

function InvalidateOnMount({ position }: { position?: { latitud: number; longitud: number } | null }) {
  const map = useMap()
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 120)
    return () => window.clearTimeout(t)
  }, [map, position])
  return null
}
