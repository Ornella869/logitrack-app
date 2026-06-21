import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import TodayIcon from '@mui/icons-material/Today'
import HistoryIcon from '@mui/icons-material/History'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import SearchIcon from '@mui/icons-material/Search'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { pickupOperacionService, type PickUpAgenda, type PickUpHistorialPaquete, type PickUpPaqueteStatus } from '../services/pickupOperacionService'
import type { User } from '../types'
import { formatDateOnlyEs } from '../utils/argentinaDate'

const statusLabel: Record<PickUpPaqueteStatus, string> = {
  PendienteDeCalendarizacion: 'Pendiente de calendarización',
  AsignadoAVehiculo: 'Asignado a vehículo',
  CargadoEnVehiculo: 'Cargado en vehículo',
  ListoParaSalir: 'Listo para salir',
  EnTransito: 'En tránsito',
  EnTransitoDescanso: 'En descanso',
  Demorado: 'Demorado',
  EntregadoEnPunto: 'Depositado en punto',
  ListoParaRetirar: 'Listo para retirar',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
}

const statusColor = (status: PickUpPaqueteStatus): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
  if (status === 'Entregado') return 'success'
  if (status === 'Cancelado') return 'error'
  if (status === 'Demorado') return 'warning'
  if (status === 'EntregadoEnPunto') return 'secondary'
  if (status === 'ListoParaRetirar') return 'primary'
  return 'default'
}

const formatDateTime = (value?: string | null) => value
  ? new Date(value).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  : '-'

const formatDate = (value?: string | null) => value
  ? formatDateOnlyEs(value, { weekday: 'long', day: '2-digit', month: 'long' })
  : 'Hoy'

const formatRouteDate = (value?: string | null) => value
  ? formatDateOnlyEs(value, { day: '2-digit', month: 'short' })
  : '-'

export default function PickUpHistorialPage() {
  const user = useOutletContext<User>()
  const [agenda, setAgenda] = useState<PickUpAgenda | null>(null)
  const [historial, setHistorial] = useState<PickUpHistorialPaquete[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sinPunto, setSinPunto] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      // El usuario no tiene un Punto Pick Up asociado: no hay ámbito que trazar.
      if (!user?.puntoPickUpId) {
        setSinPunto(true)
        setLoading(false)
        return
      }
      setSinPunto(false)
      try {
        const [agendaResp, historialResp] = await Promise.all([
          pickupOperacionService.esperadosHoy(),
          pickupOperacionService.historial(),
        ])
        setAgenda(agendaResp)
        setHistorial(historialResp)
      } catch (err: any) {
        const status = err?.response?.status
        // 403/404: el backend no encuentra un punto Pick Up asociado al usuario.
        if (status === 403 || status === 404) {
          setSinPunto(true)
          return
        }
        setError(err?.response?.data || 'No se pudo cargar la trazabilidad del punto PickUp.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [user?.puntoPickUpId])

  const filteredHistorial = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return historial
    return historial.filter(({ paquete }) =>
      paquete.codigoSeguimiento.toLowerCase().includes(term) ||
      paquete.destinatario.toLowerCase().includes(term) ||
      paquete.localidad.toLowerCase().includes(term) ||
      statusLabel[paquete.status].toLowerCase().includes(term))
  }, [historial, search])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  if (sinPunto) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, width: '100%', maxWidth: 'none' }}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight={800}>Historial Pick Up</Typography>
            <Typography color="text.secondary">Trazabilidad de paquetes relacionados con tu punto y agenda de recepciones del día.</Typography>
          </Box>
          <Alert severity="info" icon={<StorefrontIcon />}>
            Tu usuario no tiene un Punto Pick Up asignado para operar.
          </Alert>
        </Stack>
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, width: '100%', maxWidth: 'none' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Historial Pick Up</Typography>
          <Typography color="text.secondary">Trazabilidad de paquetes relacionados con tu punto y agenda de recepciones del día.</Typography>
        </Box>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2, width: '100%' }}>
          <Box>
            <Card variant="outlined" sx={{ height: '100%', borderLeft: '5px solid #1976D2' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>ESPERADOS HOY</Typography>
                    <Typography variant="h4" fontWeight={900}>{agenda?.paquetes.length ?? 0}</Typography>
                    <Typography variant="body2" color="text.secondary">{formatDate(agenda?.fecha)}</Typography>
                  </Box>
                  <TodayIcon color="primary" />
                </Stack>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card variant="outlined" sx={{ height: '100%', borderLeft: '5px solid #2E7D32' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>PAQUETES TRAZADOS</Typography>
                    <Typography variant="h4" fontWeight={900}>{historial.length}</Typography>
                    <Typography variant="body2" color="text.secondary">Últimos 300 registros del punto</Typography>
                  </Box>
                  <HistoryIcon color="success" />
                </Stack>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card variant="outlined" sx={{ height: '100%', borderLeft: '5px solid #ED6C02' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800}>CON REPARTIDOR ASIGNADO</Typography>
                    <Typography variant="h4" fontWeight={900}>{agenda?.paquetes.filter((p) => p.repartidorNombre).length ?? 0}</Typography>
                    <Typography variant="body2" color="text.secondary">Entregas previstas en tu local</Typography>
                  </Box>
                  <LocalShippingIcon color="warning" />
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>

        <Paper
          variant="outlined"
          sx={(theme) => ({
            p: { xs: 2, md: 3 },
            borderRadius: 2,
            borderColor: theme.palette.mode === 'dark' ? 'rgba(66, 165, 245, 0.55)' : '#90CAF9',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(25, 39, 68, 0.92)' : '#F5FAFF',
          })}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
            <LocalShippingIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight={800}>Paquetes que deberías esperar hoy</Typography>
              <Typography variant="body2" color="text.secondary">Envíos calendarizados para que un repartidor los entregue en la dirección de tu PickUp.</Typography>
            </Box>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={(theme) => ({ minWidth: 150, bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 58, 94, 0.85)' : '#EAF6FF' })}>Código</TableCell>
                  <TableCell sx={(theme) => ({ minWidth: 180, bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 58, 94, 0.85)' : '#EAF6FF' })}>Destinatario</TableCell>
                  <TableCell sx={(theme) => ({ minWidth: 180, bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 58, 94, 0.85)' : '#EAF6FF' })}>Repartidor</TableCell>
                  <TableCell sx={(theme) => ({ minWidth: 170, bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 58, 94, 0.85)' : '#EAF6FF' })}>Estado</TableCell>
                  <TableCell sx={(theme) => ({ minWidth: 120, whiteSpace: 'nowrap', bgcolor: theme.palette.mode === 'dark' ? 'rgba(30, 58, 94, 0.85)' : '#EAF6FF' })}>Día de ruta</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(agenda?.paquetes ?? []).map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell><Typography fontWeight={800}>{p.codigoSeguimiento}</Typography></TableCell>
                    <TableCell>{p.destinatario}</TableCell>
                    <TableCell>{p.repartidorNombre || 'Sin asignar'}</TableCell>
                    <TableCell><Chip size="small" label={statusLabel[p.status]} color={statusColor(p.status)} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatRouteDate(p.fechaCalendarizada)}</TableCell>
                  </TableRow>
                ))}
                {(agenda?.paquetes.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Box sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>No hay entregas previstas para hoy en tu punto.</Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Historial y trazabilidad</Typography>
              <Typography variant="body2" color="text.secondary">Registro de paquetes entregados, recibidos, devueltos o todavía en proceso.</Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Buscar por código, cliente, localidad o estado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: { sm: 360 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 1120 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 130 }}>Código</TableCell>
                  <TableCell sx={{ width: 180 }}>Destinatario</TableCell>
                  <TableCell sx={{ width: 160 }}>Estado actual</TableCell>
                  <TableCell sx={{ width: 180, whiteSpace: 'nowrap' }}>Último movimiento</TableCell>
                  <TableCell>Trazabilidad reciente</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredHistorial.map(({ paquete, ultimoMovimiento, eventos }) => (
                  <TableRow key={paquete.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <Inventory2Icon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography fontWeight={800}>{paquete.codigoSeguimiento}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{paquete.destinatario}</Typography>
                      <Typography variant="caption" color="text.secondary">{paquete.localidad} · CP {paquete.codigoPostal}</Typography>
                    </TableCell>
                    <TableCell><Chip size="small" label={statusLabel[paquete.status]} color={statusColor(paquete.status)} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(ultimoMovimiento)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                        {eventos.slice(0, 3).map((ev) => (
                          <Chip
                            key={`${paquete.id}-${ev.estado}-${ev.fechaHora}`}
                            size="small"
                            variant="outlined"
                            label={`${statusLabel[ev.estado]} · ${formatDateTime(ev.fechaHora)}`}
                            sx={{ maxWidth: 260, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
                          />
                        ))}
                        {eventos.length === 0 && <Typography variant="caption" color="text.secondary">Sin eventos registrados</Typography>}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredHistorial.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>No se encontraron paquetes para el filtro ingresado.</Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </Box>
  )
}
