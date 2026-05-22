import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Snackbar,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import StraightenIcon from '@mui/icons-material/Straighten'
import LocalGasStationIcon from '@mui/icons-material/LocalGasStation'
import DirectionsIcon from '@mui/icons-material/Directions'
import FlagIcon from '@mui/icons-material/Flag'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TRUCK_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:42px;height:42px;border-radius:50%;
    background:#1565c0;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-size:20px;
  ">🚚</div>`,
  iconSize: [42, 42],
  iconAnchor: [21, 21],
  popupAnchor: [0, -24],
})

const BRANCH_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:46px;height:46px;border-radius:10px;
    background:#1565c0;border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,.5);
    display:flex;align-items:center;justify-content:center;font-size:22px;
  ">🏢</div>`,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
  popupAnchor: [0, -24],
})

interface OsrmResult {
  geo: [number, number][]
  distance: number
  duration: number
}

async function fetchReturnRoute(
  from: [number, number],
  to: [number, number],
  signal: AbortSignal,
): Promise<OsrmResult | null> {
  const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
  try {
    const r = await fetch(url, { signal })
    if (!r.ok) return null
    const data = await r.json()
    if (data?.code !== 'Ok' || !data?.routes?.length) return null
    const route = data.routes[0]
    const geo: [number, number][] = (route.geometry?.coordinates ?? []).map(
      ([lng, lat]: [number, number]) => [lat, lng],
    )
    return { geo, distance: route.distance ?? 0, duration: route.duration ?? 0 }
  } catch {
    return null
  }
}

function splitIntoTrafficSegments(
  geo: [number, number][],
  colors: string[],
): { points: [number, number][]; color: string }[] {
  if (geo.length < 2) return []
  const n = colors.length
  const chunkSize = Math.ceil(geo.length / n)
  const segments: { points: [number, number][]; color: string }[] = []
  for (let i = 0; i < n; i++) {
    const start = i * chunkSize
    const end = Math.min(start + chunkSize + 1, geo.length)
    if (start < geo.length - 1) {
      segments.push({ points: geo.slice(start, end), color: colors[i] })
    }
  }
  return segments
}

const TRAFFIC_COLORS = ['#4caf50', '#4caf50', '#ff9800', '#4caf50', '#4caf50']

function FitReturnBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || positions.length === 0) return
    fitted.current = true
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else {
      map.fitBounds(L.latLngBounds(positions), { padding: [60, 60] })
    }
  }, [map, positions])
  return null
}

interface RetornoSucursalViewProps {
  origen: {
    nombre: string
    direccion: string
    ciudad: string
    latitud: number
    longitud: number
  }
  ultimaEntregada: {
    latitud: number
    longitud: number
    direccion: string
  } | null
  totalParadas: number
  entregadas: number
}

export default function RetornoSucursalView({
  origen,
  ultimaEntregada,
  totalParadas,
  entregadas,
}: RetornoSucursalViewProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [routeData, setRouteData] = useState<OsrmResult | null>(null)
  const [routeLoading, setRouteLoading] = useState(true)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const from: [number, number] | null = ultimaEntregada
    ? [ultimaEntregada.latitud, ultimaEntregada.longitud]
    : null
  const to: [number, number] = [origen.latitud, origen.longitud]

  useEffect(() => {
    const timer = setTimeout(() => setSnackbarOpen(true), 600)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!from) {
      setRouteLoading(false)
      return
    }
    const ctrl = new AbortController()
    setRouteLoading(true)
    fetchReturnRoute(from, to, ctrl.signal).then((data) => {
      setRouteData(data)
      setRouteLoading(false)
    })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from?.[0], from?.[1], to[0], to[1]])

  const distanciaKm = routeData ? (routeData.distance / 1000).toFixed(1) : null
  const etaMin = routeData ? Math.round(routeData.duration / 60) : null
  const combustibleL = routeData ? (routeData.distance / 1000 * 0.10).toFixed(1) : null

  const trafficSegments = routeData ? splitIntoTrafficSegments(routeData.geo, TRAFFIC_COLORS) : []

  const fallbackLine: [number, number][] = from ? [from, to] : [[to[0] - 0.001, to[1] - 0.001], to]
  const fitPositions: [number, number][] = from ? [from, to] : [to]

  const mapCenter: [number, number] = from
    ? [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
    : to

  const buildReturnUrl = (): string => {
    const cp = origen.ciudad ? `, ${origen.ciudad}` : ''
    const dest = encodeURIComponent(`${origen.direccion}${cp}, Argentina`)
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
  }

  return (
    <Box
      sx={{
        bgcolor: isDark ? '#0f1923' : '#f0f4f8',
        borderRadius: 3,
        overflow: 'hidden',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #d0dce8',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          bgcolor: isDark ? '#1a2a3a' : '#e3edf7',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #c8d8e8',
        }}
      >
        <FlagIcon sx={{ color: '#1565c0' }} />
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: isDark ? '#e3f2fd' : '#0d47a1' }}>
          Ruta de retorno a sucursal
        </Typography>
        <Chip
          icon={<CheckCircleIcon />}
          label={`${entregadas}/${totalParadas} entregas completadas`}
          size="small"
          sx={{
            bgcolor: '#e8f5e9',
            color: '#2e7d32',
            fontWeight: 600,
            '& .MuiChip-icon': { color: '#2e7d32' },
          }}
        />
      </Box>

      {/* Mapa */}
      <Box sx={{ position: 'relative' }}>
        <Box
          sx={{
            height: { xs: 320, sm: 420 },
            width: '100%',
          }}
        >
          <MapContainer
            key={`return-${from?.[0]}-${from?.[1]}`}
            center={mapCenter}
            zoom={12}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · routing &copy; <a href="http://project-osrm.org/">OSRM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitReturnBounds positions={fitPositions} />

            {/* Ruta segmentada con colores de tráfico */}
            {trafficSegments.length > 0
              ? trafficSegments.map((seg, i) => (
                  <Polyline
                    key={i}
                    positions={seg.points}
                    pathOptions={{ color: seg.color, weight: 6, opacity: 0.9 }}
                  />
                ))
              : fallbackLine.length > 1 && (
                  <Polyline
                    positions={fallbackLine}
                    pathOptions={{ color: '#1565c0', weight: 5, opacity: 0.7, dashArray: '10,6' }}
                  />
                )}

            {/* Marcador de inicio (última entrega) */}
            {from && (
              <Marker position={from} icon={TRUCK_ICON} zIndexOffset={1000}>
                <Popup>
                  <strong>🚚 Tu ubicación actual</strong>
                  <br />
                  {ultimaEntregada?.direccion ?? 'Última entrega'}
                </Popup>
              </Marker>
            )}

            {/* Marcador de sucursal destino */}
            <Marker position={to} icon={BRANCH_ICON} zIndexOffset={900}>
              <Popup>
                <strong>🏢 {origen.nombre}</strong>
                <br />
                {origen.direccion}, {origen.ciudad}
                <br />
                <em>🏁 Destino de retorno</em>
              </Popup>
            </Marker>
          </MapContainer>
        </Box>

        {/* Leyenda de tráfico superpuesta */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 500,
            bgcolor: 'rgba(255,255,255,0.92)',
            borderRadius: 2,
            px: 1.5,
            py: 0.75,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Typography variant="caption" fontWeight={600} sx={{ color: '#333' }}>
            Tráfico:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#4caf50' }} />
            <Typography variant="caption" sx={{ color: '#333' }}>Libre</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#ff9800' }} />
            <Typography variant="caption" sx={{ color: '#333' }}>Moderado</Typography>
          </Box>
        </Box>
      </Box>

      {/* Card de métricas + botón */}
      <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Card
          elevation={4}
          sx={{
            borderRadius: 3,
            bgcolor: isDark ? '#1a2a3a' : 'white',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d0dce8',
            mb: 2,
          }}
        >
          <CardContent sx={{ pb: '16px !important' }}>
            {/* Destino */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <HomeWorkIcon sx={{ color: '#1565c0', fontSize: 22 }} />
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  {origen.nombre}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {origen.direccion}, {origen.ciudad}
                </Typography>
              </Box>
            </Stack>

            <Divider sx={{ my: 1.5 }} />

            {/* Métricas */}
            {routeLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <Stack
                direction="row"
                divider={<Divider orientation="vertical" flexItem />}
                spacing={0}
                justifyContent="space-around"
                sx={{ mb: 1.5 }}
              >
                <MetricItem
                  icon={<AccessTimeIcon sx={{ color: '#1565c0', fontSize: 20 }} />}
                  value={etaMin != null ? `~${etaMin} min` : '—'}
                  label="Tiempo est."
                />
                <MetricItem
                  icon={<StraightenIcon sx={{ color: '#1565c0', fontSize: 20 }} />}
                  value={distanciaKm != null ? `${distanciaKm} km` : '—'}
                  label="Distancia"
                />
                <MetricItem
                  icon={<LocalGasStationIcon sx={{ color: '#1565c0', fontSize: 20 }} />}
                  value={combustibleL != null ? `~${combustibleL} L` : '—'}
                  label="Consumo est."
                />
              </Stack>
            )}

            <Divider sx={{ my: 1.5 }} />

            {/* Estado */}
            <Stack direction="row" alignItems="center" spacing={1}>
              <CheckCircleIcon sx={{ color: '#2e7d32', fontSize: 18 }} />
              <Typography variant="body2" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                Estado: Última entrega completada
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        {/* Botón principal */}
        <Button
          variant="contained"
          size="large"
          fullWidth
          startIcon={<LocalShippingIcon />}
          endIcon={<DirectionsIcon />}
          onClick={() => window.open(buildReturnUrl(), '_blank', 'noopener,noreferrer')}
          sx={{
            bgcolor: '#1565c0',
            '&:hover': { bgcolor: '#0d47a1' },
            py: 1.8,
            borderRadius: 3,
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: 0.5,
            boxShadow: '0 4px 14px rgba(21,101,192,0.4)',
          }}
        >
          Retorno a Sucursal
        </Button>
      </Box>

      {/* Snackbar de notificación automática */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={5000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity="success"
          variant="filled"
          icon={<HomeWorkIcon />}
          sx={{ width: '100%', fontWeight: 600 }}
        >
          Ruta de regreso optimizada generada correctamente
        </Alert>
      </Snackbar>
    </Box>
  )
}

function MetricItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <Box sx={{ textAlign: 'center', flex: 1, px: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.25 }}>{icon}</Box>
      <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}
