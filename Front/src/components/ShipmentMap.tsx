import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Box } from '@mui/material'

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
  const center: [number, number] = position
    ? [position.latitud, position.longitud]
    : DEFAULT_CENTER

  return (
    <Box sx={{ height, width: '100%', borderRadius: 1, overflow: 'hidden', border: '1px solid #ddd' }}>
      <MapContainer center={center} zoom={position ? 14 : 11} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{y}/{x}.png"
        />
        {position && <Marker position={[position.latitud, position.longitud]} />}
        {editable && <ClickHandler onClick={onChange} />}
        <Recenter position={position} />
      </MapContainer>
    </Box>
  )
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
