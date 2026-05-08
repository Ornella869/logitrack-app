import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import RouteIcon from '@mui/icons-material/Route'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import MapIcon from '@mui/icons-material/Map'
import NavigationIcon from '@mui/icons-material/Navigation'
import { shipmentService } from '../../services/shipmentService'
import StatusBadge from '../../components/StatusBadge'
import RouteMap from '../../components/RouteMap'
import type { Shipment, User } from '../../types'

// G1L-23: Mi ruta del día. Trae paquetes asignados al repartidor logueado para hoy,
// ordenados por CP. Mapa mock por ahora — Leaflet llega en Fase B (G1L-18).

function getGreeting(name: string) {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return `Buenos días, ${name}!`
  if (h >= 12 && h < 20) return `Buenas tardes, ${name}!`
  return `Buenas noches, ${name}!`
}

function buildMapsUrl(paradas: Shipment[]): string | null {
  if (paradas.length === 0) return null
  const pending = paradas.filter((p) => p.status !== 'Entregado' && p.status !== 'Cancelado')
  const active = pending.length > 0 ? pending : paradas
  const addr = (p: Shipment) =>
    p.receiverUbicacion?.latitud != null
      ? `${p.receiverUbicacion.latitud},${p.receiverUbicacion.longitud}`
      : `${p.receiver.address},${p.receiver.city}`
  const params = new URLSearchParams({ api: '1', destination: addr(active[active.length - 1]) })
  if (active.length > 1) {
    params.set('origin', addr(active[0]))
    const stops = active.slice(1, -1)
    if (stops.length > 0) params.set('waypoints', stops.map(addr).join('|'))
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export default function RepartidorDashboard() {
  const navigate = useNavigate()
  const user = useOutletContext<User>()
  const [paradas, setParadas] = useState<Shipment[]>([])
  const [fechaRuta, setFechaRuta] = useState<string | null>(null)
  const [fechasDisponibles, setFechasDisponibles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)

  const load = async (fecha?: string) => {
    setLoading(true)
    setError('')
    try {
      const [data, fechas] = await Promise.all([
        shipmentService.getMiRutaDelDia(fecha),
        shipmentService.getMisFechasDeRuta(),
      ])
      setParadas(data.paradas)
      setFechaRuta(data.fecha)
      setFechasDisponibles(fechas)
    } catch {
      setError('No se pudo cargar tu ruta del día')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const metrics = useMemo(() => {
    const entregadas = paradas.filter((p) => p.status === 'Entregado').length
    const enCamino = paradas.filter((p) => p.status === 'En tránsito').length
    const totalPeso = paradas.reduce((acc, p) => acc + (p.weight ?? 0), 0)
    const proximaIdx = paradas.findIndex(
      (p) => p.status !== 'Entregado' && p.status !== 'Cancelado',
    )
    const cpZona = paradas[0]?.receiver.postalCode
    return { entregadas, enCamino, totalPeso, proximaIdx, cpZona }
  }, [paradas])

  const fechaActual = fechaRuta ? new Date(fechaRuta) : new Date()
  const fechaHoy = fechaActual.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const esHoy = fechaRuta ? new Date(fechaRuta).toDateString() === new Date().toDateString() : false
  const esFutura = fechaRuta ? new Date(fechaRuta).getTime() > new Date(new Date().toDateString()).getTime() : false

  const proxima = metrics.proximaIdx >= 0 ? paradas[metrics.proximaIdx] : null

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 2, gap: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <RouteIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            {esHoy ? 'Mi Ruta del Día' : esFutura ? 'Mi Próxima Ruta' : 'Mi Ruta'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {fechaHoy} · {paradas.length} paradas{metrics.cpZona ? ` · CP ${metrics.cpZona}` : ''}
          </Typography>
          {user && (
            <Typography variant="caption" color="text.secondary">
              {getGreeting(user.name)}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          {fechasDisponibles.length > 1 && (
            <Select
              size="small"
              value={fechaRuta ?? ''}
              onChange={(e) => load(String(e.target.value))}
            >
              {fechasDisponibles.map((f) => (
                <MenuItem key={f} value={f}>
                  {new Date(f).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </MenuItem>
              ))}
            </Select>
          )}
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">Avance</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#2e7d32' }}>
              {metrics.entregadas} / {paradas.length}
            </Typography>
          </Box>
          <Button startIcon={<RefreshIcon />} onClick={() => load()} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {esFutura && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Tu próxima ruta está programada para el <strong>{fechaHoy}</strong>. Hoy no tenés paradas asignadas.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : paradas.length === 0 ? (
        <Alert severity="info">
          No tenés paradas asignadas para hoy. Esperá a que el supervisor calendarice los envíos.
        </Alert>
      ) : (
        <>
          {/* KPIs */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <KpiCard label="Entregadas" value={metrics.entregadas} color="#2e7d32" icon={<CheckCircleIcon />} />
            <KpiCard label="En camino" value={metrics.enCamino} color="#ed6c02" icon={<LocalShippingIcon />} />
            <KpiCard
              label="Capacidad"
              value={metrics.totalPeso}
              suffix=" / 500 kg"
              color="#1976d2"
              icon={<Inventory2Icon />}
            />
            <KpiCard label="Paradas restantes" value={paradas.length - metrics.entregadas} color="#5e35b1" icon={<AccessTimeIcon />} />
          </Grid>

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="🗺️ Mapa" />
              <Tab label="📋 Mis paradas" />
            </Tabs>
          </Box>

          {tab === 0 && (
            <Card variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: '#fafafa', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Ruta optimizada{metrics.cpZona ? ` · CP ${metrics.cpZona}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Orden automático por código postal y FIFO · {paradas.length} paradas
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<MapIcon />}
                    disabled={paradas.length === 0}
                    onClick={() => {
                      const url = buildMapsUrl(paradas)
                      if (url) window.open(url, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    Abrir en Maps
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<NavigationIcon />}
                    disabled={!proxima}
                    onClick={() => proxima && navigate(`/shipment/${proxima.id}`)}
                  >
                    Navegar a próxima parada
                  </Button>
                </Stack>
              </Box>
              <RouteMap
                paradas={paradas.map((p, idx) => ({
                  paqueteId: p.id,
                  codigoSeguimiento: p.trackingId,
                  orden: idx + 1,
                  direccion: p.receiver.address,
                  localidad: p.receiver.city,
                  destinatario: p.receiver.name,
                  status: p.status,
                  latitud: p.receiverUbicacion?.latitud ?? null,
                  longitud: p.receiverUbicacion?.longitud ?? null,
                }))}
                proximaIdx={metrics.proximaIdx}
                height={380}
              />
              {proxima && (
                <Box sx={{ p: 2, bgcolor: '#f8fdf8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Próxima parada:</strong> {proxima.receiver.address}, {proxima.receiver.city} · {proxima.receiver.name} · {proxima.weight} kg
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    CP {proxima.receiver.postalCode}
                  </Typography>
                </Box>
              )}
            </Card>
          )}

          {tab === 1 && (
          <Stack spacing={1.5}>
            {paradas.map((p, idx) => {
              const isCompleted = p.status === 'Entregado' || p.status === 'Cancelado'
              const isCurrent = idx === metrics.proximaIdx
              return (
                <Card
                  key={p.id}
                  variant="outlined"
                  sx={{
                    borderLeft: '4px solid',
                    borderLeftColor: isCompleted ? '#2e7d32' : isCurrent ? '#ed6c02' : '#1976d2',
                    bgcolor: isCompleted ? '#f8fdf8' : isCurrent ? '#fffbf5' : 'white',
                    opacity: isCompleted ? 0.85 : 1,
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: isCompleted ? '#2e7d32' : isCurrent ? '#ed6c02' : '#1976d2',
                          color: 'white', fontWeight: 700, fontSize: 16,
                        }}
                      >
                        {idx + 1}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {p.receiver.address}, {p.receiver.city}
                          </Typography>
                          <StatusBadge status={p.status} />
                        </Stack>
                        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            📦 {p.trackingId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            👤 {p.receiver.name} · {p.weight} kg
                          </Typography>
                          {p.receiver.phone && (
                            <Typography variant="caption" color="text.secondary">
                              📱 {p.receiver.phone}
                            </Typography>
                          )}
                          {p.tipoEnvio === 'Prioritario' && (
                            <Chip
                              size="small"
                              label="⚡ Prioritario"
                              sx={{ bgcolor: '#fdecea', color: '#c62828', border: '1px solid #c62828', height: 18, fontSize: 10, fontWeight: 600 }}
                            />
                          )}
                        </Stack>
                        {p.description && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                            Obs: {p.description}
                          </Typography>
                        )}
                        {isCurrent && (
                          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={() => navigate(`/shipment/${p.id}`)}
                            >
                              Ver y gestionar
                            </Button>
                          </Stack>
                        )}
                        {!isCurrent && !isCompleted && (
                          <Button
                            size="small"
                            sx={{ mt: 1 }}
                            onClick={() => navigate(`/shipment/${p.id}`)}
                          >
                            Ver detalle
                          </Button>
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
          )}
        </>
      )}
    </Box>
  )
}

// ============ Componentes auxiliares ============

function KpiCard({
  label, value, sub, suffix, color, icon,
}: { label: string; value: number; sub?: string; suffix?: string; color: string; icon: React.ReactNode }) {
  return (
    <Grid item xs={6} md={3}>
      <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color, mb: 0.5 }}>
            {icon}
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              {label}
            </Typography>
          </Stack>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1 }}>
            {value}
            {suffix && (
              <Typography component="span" variant="caption" color="text.secondary">{suffix}</Typography>
            )}
          </Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </CardContent>
      </Card>
    </Grid>
  )
}

