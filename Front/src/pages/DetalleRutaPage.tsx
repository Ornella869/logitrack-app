import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom'
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
import MapIcon from '@mui/icons-material/Map'
import NavigationIcon from '@mui/icons-material/Navigation'
import api from '../services/api'
import StatusBadge from '../components/StatusBadge'
import RouteMap from '../components/RouteMap'
import { branchService, type BranchOrigin } from '../services/branchService'
import { buildMapsUrl } from '../utils/mapsUrl'
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
  const [searchParams] = useSearchParams()
  const fecha = searchParams.get('fecha') ?? undefined
  const [detalle, setDetalle] = useState<DetalleRuta | null>(null)
  const [origen, setOrigen] = useState<BranchOrigin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!repartidorId) return
    if (user.role !== 'supervisor' && user.role !== 'administrador') return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repartidorId, user.role, fecha])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      // Cargamos detalle y sucursal de origen en paralelo. El origen sirve
      // tanto para pintar el marker en el mapa como para construir la URL
      // de Google Maps con el mismo punto de salida que el repartidor.
      const [detalleResp, sucursal] = await Promise.all([
        api.get(`/rutas-activas/${repartidorId}`, { params: fecha ? { fecha } : undefined }),
        origen ? Promise.resolve(origen) : branchService.getSucursalOrigen(),
      ])
      setDetalle(detalleResp.data)
      if (!origen) setOrigen(sucursal)
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
  const proxima = proximaIdx >= 0 ? detalle.paradas[proximaIdx] : null
  const pesoTotal = detalle.paradas.reduce((acc, p) => acc + p.peso, 0)
  const initials = detalle.repartidorNombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
  const cpZona = detalle.paradas[0]?.codigoPostal

  // Las paradas vienen del back con status PascalCase ("EnTransito"). El RouteMap
  // y el helper de Maps comparan contra el formato display ("En tránsito"), así
  // que normalizamos antes de pasarlas.
  const paradasNormalizadas = detalle.paradas.map((p) => ({
    ...p,
    status: statusToShipmentStatus(p.status),
  }))

  const stopsForMaps = paradasNormalizadas.map((p) => ({
    direccion: p.direccion,
    localidad: p.localidad,
    codigoPostal: p.codigoPostal,
    status: p.status,
  }))

  const originForMaps = origen
    ? { direccion: origen.address, ciudad: origen.city, codigoPostal: origen.postalCode }
    : null

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
          {/* Mismo card del mapa que ve el repartidor en su panel: header con
              info y acciones, mapa con sucursal de origen + paradas, footer con
              próxima parada. Mantiene la consistencia entre roles. */}
          <Card variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, bgcolor: '#fafafa', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  Ruta optimizada{cpZona ? ` · CP ${cpZona}` : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {origen
                    ? `Salida desde ${origen.name} · ${detalle.paradas.length} paradas en orden`
                    : `Orden automático por código postal y FIFO · ${detalle.paradas.length} paradas`}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<MapIcon />}
                  disabled={detalle.paradas.length === 0}
                  onClick={() => {
                    const url = buildMapsUrl(stopsForMaps, originForMaps)
                    if (url) window.open(url, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Abrir ruta en Maps
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<NavigationIcon />}
                  disabled={!proxima}
                  onClick={() => proxima && navigate(`/shipment/${proxima.paqueteId}`)}
                >
                  Ver próxima parada
                </Button>
              </Stack>
            </Box>
            <RouteMap
              paradas={paradasNormalizadas}
              proximaIdx={proximaIdx}
              origen={
                origen?.latitud != null && origen?.longitud != null
                  ? {
                      nombre: origen.name,
                      direccion: origen.address,
                      ciudad: origen.city,
                      latitud: origen.latitud,
                      longitud: origen.longitud,
                    }
                  : null
              }
              height={380}
            />
            {proxima && (
              <Box sx={{ p: 2, bgcolor: '#f8fdf8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Próxima parada:</strong> {proxima.direccion}, {proxima.localidad} · {proxima.destinatario} · {proxima.peso} kg
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  CP {proxima.codigoPostal}
                </Typography>
              </Box>
            )}
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

