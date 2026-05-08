import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import RouteIcon from '@mui/icons-material/Route'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import RouteMap from '../components/RouteMap'
import type { User } from '../types'

type DetalleParada = {
  paqueteId: string
  codigoSeguimiento: string
  orden: number
  direccion: string
  localidad: string
  codigoPostal: string
  destinatario: string
  telefono?: string | null
  peso: number
  tipoEnvio: string
  status: string
  esPrioritario: boolean
  observaciones?: string | null
  latitud?: number | null
  longitud?: number | null
}

type DetalleRuta = {
  repartidorId: string
  repartidorNombre: string
  repartidorEmail: string
  fecha: string
  paradas: DetalleParada[]
}

const statusToShipmentStatus = (s: string): any => {
  switch (s) {
    case 'PendienteDeCalendarizacion': return 'Pendiente de calendarización'
    case 'AsignadoAVehiculo': return 'Asignado a vehículo'
    case 'CargadoEnVehiculo': return 'Cargado en vehículo'
    case 'ListoParaSalir': return 'Listo para salir'
    case 'EnTransito': return 'En tránsito'
    case 'Entregado': return 'Entregado'
    case 'Cancelado': return 'Cancelado'
    default: return s
  }
}

export default function DetalleRutaPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const { repartidorId } = useParams<{ repartidorId: string }>()
  const [detalle, setDetalle] = useState<DetalleRuta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!repartidorId) return
    if (user.role !== 'supervisor' && user.role !== 'administrador') return
    void load()
  }, [repartidorId, user.role])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get(`/rutas-activas/${repartidorId}`)
      setDetalle(response.data)
    } catch {
      setError('No se pudo cargar el detalle de la ruta')
    } finally {
      setLoading(false)
    }
  }

  if (user.role !== 'supervisor' && user.role !== 'administrador') {
    return <Alert severity="warning">Solo Supervisor o Administrador.</Alert>
  }

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  if (error) return <Alert severity="error">{error}</Alert>
  if (!detalle) return <Alert severity="info">Ruta no encontrada</Alert>

  const entregadas = detalle.paradas.filter((p) => p.status === 'Entregado').length
  const canceladas = detalle.paradas.filter((p) => p.status === 'Cancelado').length
  const completas = entregadas + canceladas
  const proximaIdx = detalle.paradas.findIndex((p) => p.status !== 'Entregado' && p.status !== 'Cancelado')
  const pesoTotal = detalle.paradas.reduce((acc, p) => acc + p.peso, 0)
  const initials = detalle.repartidorNombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/rutas-activas')} size="small">
          Volver a Rutas Activas
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <Avatar sx={{ bgcolor: '#1976d2', width: 48, height: 48 }}>{initials}</Avatar>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <RouteIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Ruta de {detalle.repartidorNombre}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {new Date(detalle.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}
            {' · '}{detalle.paradas.length} paradas{' · '}{pesoTotal.toFixed(0)} kg
          </Typography>
        </Box>
      </Stack>

      <Grid container spacing={3}>
        {/* IZQ: Mapa mock + Lista de paradas */}
        <Grid item xs={12} md={8}>
          <Card variant="outlined" sx={{ overflow: 'hidden', mb: 2 }}>
            <Box sx={{ p: 2, bgcolor: '#fafafa', borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight={600}>📍 Mapa de seguimiento</Typography>
            </Box>
            <Box sx={{ p: 0 }}>
              <RouteMap paradas={detalle.paradas} proximaIdx={proximaIdx} height={340} />
            </Box>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>📋 Paradas de la ruta</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Orden automático por código postal y FIFO
              </Typography>
              <Stack spacing={1.5}>
                {detalle.paradas.map((p, idx) => {
                  const isCompleted = p.status === 'Entregado' || p.status === 'Cancelado'
                  const isCurrent = idx === proximaIdx
                  return (
                    <Card
                      key={p.paqueteId}
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
                              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              bgcolor: isCompleted ? '#2e7d32' : isCurrent ? '#ed6c02' : '#1976d2',
                              color: 'white', fontWeight: 700,
                            }}
                          >
                            {p.orden}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                              <Typography variant="subtitle2" fontWeight={600}>
                                {p.direccion}, {p.localidad}
                              </Typography>
                              <StatusBadge status={statusToShipmentStatus(p.status)} />
                            </Stack>
                            <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{p.codigoSeguimiento}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                👤 {p.destinatario} · {p.peso} kg
                              </Typography>
                              {p.telefono && <Typography variant="caption" color="text.secondary">📱 {p.telefono}</Typography>}
                              {p.esPrioritario && (
                                <Chip size="small" label="⚡ Prioritario" sx={{ bgcolor: '#fdecea', color: '#c62828', height: 18, fontSize: 10 }} />
                              )}
                            </Stack>
                            {p.observaciones && (
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                                Obs: {p.observaciones}
                              </Typography>
                            )}
                          </Box>
                          <Button size="small" onClick={() => navigate(`/shipment/${p.paqueteId}`)}>
                            Ver
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* DER: Métricas */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>📊 Métricas</Typography>
              <Stack divider={<Divider flexItem />} spacing={1}>
                <Row label="Total paradas" value={detalle.paradas.length} />
                <Row label="Entregadas" value={entregadas} color="#2e7d32" />
                <Row label="Canceladas" value={canceladas} color="#c62828" />
                <Row label="Pendientes" value={detalle.paradas.length - completas} color="#ed6c02" />
                <Row label="Avance" value={`${detalle.paradas.length ? Math.round((completas / detalle.paradas.length) * 100) : 0}%`} color="#1976d2" />
                <Row label="Capacidad" value={`${pesoTotal.toFixed(0)} / 500 kg`} />
              </Stack>
            </CardContent>
          </Card>
          <Card variant="outlined" sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>👤 Repartidor</Typography>
              <Typography variant="body2" fontWeight={600}>{detalle.repartidorNombre}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {detalle.repartidorEmail}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

function Row({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" sx={{ py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={color ? { color } : {}}>{value}</Typography>
    </Stack>
  )
}

