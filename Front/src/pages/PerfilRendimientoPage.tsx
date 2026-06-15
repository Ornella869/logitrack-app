import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import HistoryIcon from '@mui/icons-material/History'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonIcon from '@mui/icons-material/Person'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import api from '../services/api'
import { authService, type HistorialJornadaItem } from '../services/authService'
import { branchService } from '../services/branchService'
import type { Branch, User } from '../types'
import { addArgentinaDays, dateOnlyForDisplay, formatArgentinaDateInput, formatDateOnlyEs, formatInstantArgentinaDate, formatInstantArgentinaTime } from '../utils/argentinaDate'

type Rendimiento = {
  repartidorId: string
  nombre: string
  email: string
  from: string
  to: string
  totalEntregas: number
  totalCancelaciones: number
  totalAsignados: number
  efectividadOnTimePct: number
  tasaIncidenciasPct: number
  tieneActividad: boolean
  horasTrabajo: number
  tipoJornada: string
  capacidadCargaKg: number
  fotoPerfil?: string | null
  vencimientoLicencia?: string | null
  licenciaVencida?: boolean
  licenciaProximaAVencer?: boolean
  sucursalId?: string | null
}

type JornadaLaboralHistorial = {
  id: string
  timestamp: string
  usuarioNombre: string
  usuarioRol: string
  valorAnterior: number | null
  valorNuevo: number | null
  motivo: string
}

const today = () => formatArgentinaDateInput()
const daysAgo = (n: number) => addArgentinaDays(-n)
const startOfMonth = () => {
  const d = dateOnlyForDisplay(today())
  d.setDate(1)
  return formatArgentinaDateInput(d)
}

const PRESETS = [
  { label: 'Última semana', from: () => daysAgo(7), to: today },
  { label: 'Mes actual', from: startOfMonth, to: today },
  { label: 'Últimos 30 días', from: () => daysAgo(30), to: today },
] as const

/** Devuelve el período anterior de igual duración */
function prevPeriod(from: string, to: string) {
  const msFrom = dateOnlyForDisplay(from).getTime()
  const msTo = dateOnlyForDisplay(to).getTime()
  const duration = msTo - msFrom
  const prevTo = formatArgentinaDateInput(new Date(msFrom - 86400000))
  const prevFrom = formatArgentinaDateInput(new Date(msFrom - 86400000 - duration))
  return { from: prevFrom, to: prevTo }
}

const isValidDateInput = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

const validateDateRangeForRender = (from: string, to: string) => (
  isValidDateInput(from)
  && isValidDateInput(to)
  && to >= from
  && to <= today()
)

export default function PerfilRendimientoPage({ permissions }: { permissions: Set<string> }) {
  const navigate = useNavigate()
  const user = useOutletContext<User>()
  const { repartidorId } = useParams<{ repartidorId: string }>()
  const [from, setFrom] = useState<string>(daysAgo(30))
  const [to, setTo] = useState<string>(today())
  const [dateError, setDateError] = useState('')
  const [data, setData] = useState<Rendimiento | null>(null)
  const [prevData, setPrevData] = useState<Rendimiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [horasInput, setHorasInput] = useState<string>('')
  const [savingHoras, setSavingHoras] = useState(false)
  const [horasError, setHorasError] = useState('')
  const [horasSuccess, setHorasSuccess] = useState('')
  const [jornadaHistorial, setJornadaHistorial] = useState<JornadaLaboralHistorial[]>([])
  const [jornadaHistorialError, setJornadaHistorialError] = useState('')
  const [showJornadaHistorial, setShowJornadaHistorial] = useState(false)
  const [capacidadInput, setCapacidadInput] = useState<string>('')
  const [savingCapacidad, setSavingCapacidad] = useState(false)
  const [capacidadError, setCapacidadError] = useState('')
  const [capacidadSuccess, setCapacidadSuccess] = useState('')
  const [historialJornada, setHistorialJornada] = useState<HistorialJornadaItem[]>([])
  const [historialExpanded, setHistorialExpanded] = useState(false)
  const [vencimientoInput, setVencimientoInput] = useState<string>('')
  const [savingVencimiento, setSavingVencimiento] = useState(false)
  const [vencimientoError, setVencimientoError] = useState('')
  const [vencimientoSuccess, setVencimientoSuccess] = useState('')
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [sucursales, setSucursales] = useState<Branch[]>([])
  const [selectedSucursal, setSelectedSucursal] = useState<string>('')
  const [transferring, setTransferring] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [transferSuccess, setTransferSuccess] = useState('')

  useEffect(() => {
    if (!repartidorId) return
    void load()
    authService.getHistorialJornada(repartidorId).then(setHistorialJornada)
  }, [repartidorId, user.role])

  const validate = (f: string, t: string): boolean => {
    if (!f || !t) { setDateError('Completá ambas fechas para aplicar el rango.'); return false }
    if (!isValidDateInput(f) || !isValidDateInput(t)) { setDateError('Ingresá fechas válidas.'); return false }
    if (t < f) { setDateError('La fecha fin no puede ser anterior a la fecha inicio.'); return false }
    if (t > today()) { setDateError('La fecha fin no puede ser una fecha futura.'); return false }
    setDateError('')
    return true
  }

  const hasValidComparisonRange = validateDateRangeForRender(from, to)

  const restoreScroll = (scrollY?: number) => {
    if (scrollY === undefined) return
    requestAnimationFrame(() => {
      requestAnimationFrame(() => window.scrollTo({ top: scrollY }))
    })
  }

  const load = async (overrideFrom?: string, overrideTo?: string, preserveScroll = false) => {
    const f = overrideFrom ?? from
    const t = overrideTo ?? to
    if (!validate(f, t)) return
    if (!repartidorId) return
    const scrollY = preserveScroll ? window.scrollY : undefined
    if (!data) setLoading(true)
    setError('')
    try {
      const prev = prevPeriod(f, t)
      const [res, prevRes, jornadaHistorialRes] = await Promise.all([
        api.get(`/repartidores/${repartidorId}/rendimiento`, { params: { from: f, to: t } }),
        api.get(`/repartidores/${repartidorId}/rendimiento`, { params: { from: prev.from, to: prev.to } }).catch(() => null),
        api.get<JornadaLaboralHistorial[]>(`/repartidores/${repartidorId}/jornada-historial`).catch(() => null),
      ])
      setData(res.data)
      setPrevData(prevRes?.data ?? null)
      setJornadaHistorial(jornadaHistorialRes?.data ?? [])
      setJornadaHistorialError(jornadaHistorialRes ? '' : 'No se pudo cargar el historial de jornada laboral.')
      if (horasInput === '') setHorasInput(String(res.data?.horasTrabajo ?? 8))
      if (capacidadInput === '') setCapacidadInput(String(res.data?.capacidadCargaKg ?? 500))
      if (vencimientoInput === '' && res.data?.vencimientoLicencia) {
        setVencimientoInput(res.data.vencimientoLicencia.slice(0, 10))
      }
    } catch (e: any) {
      setError(e.response?.data ?? 'No se pudo cargar el rendimiento')
    } finally {
      setLoading(false)
      restoreScroll(scrollY)
    }
  }

  const handleSaveHoras = async () => {
    const horas = parseInt(horasInput, 10)
    if (isNaN(horas) || horas < 1 || horas > 24) {
      setHorasError('Ingresá un valor entre 1 y 24.')
      return
    }
    if (!repartidorId) return
    setSavingHoras(true)
    setHorasError('')
    setHorasSuccess('')
    const result = await authService.updateRepartidorHorasTrabajo(repartidorId, horas)
    setSavingHoras(false)
    if (!result) {
      setHorasError('No se pudo actualizar. Intentá de nuevo.')
    } else {
      setData((prev) => prev ? { ...prev, horasTrabajo: result.horasTrabajo ?? horas, tipoJornada: result.tipoJornada ?? (horas <= 6 ? 'Part Time' : 'Full Time') } : prev)
      setHorasSuccess('Jornada actualizada correctamente.')
      void loadJornadaHistorial()
      if (repartidorId) authService.getHistorialJornada(repartidorId).then(setHistorialJornada)
    }
  }

  const loadJornadaHistorial = async () => {
    if (!repartidorId) return
    setJornadaHistorialError('')
    try {
      const res = await api.get<JornadaLaboralHistorial[]>(`/repartidores/${repartidorId}/jornada-historial`)
      setJornadaHistorial(res.data ?? [])
    } catch {
      setJornadaHistorialError('No se pudo cargar el historial de jornada laboral.')
    }
  }

  const handleSaveCapacidad = async () => {
    const capacidad = parseFloat(capacidadInput)
    if (isNaN(capacidad) || capacidad < 1 || capacidad > 5000) {
      setCapacidadError('Ingresá un valor entre 1 y 5000 kg.')
      return
    }
    if (!repartidorId) return
    setSavingCapacidad(true)
    setCapacidadError('')
    setCapacidadSuccess('')
    const result = await authService.updateRepartidorCapacidadCarga(repartidorId, capacidad)
    setSavingCapacidad(false)
    if (!result) {
      setCapacidadError('No se pudo actualizar. Intentá de nuevo.')
    } else {
      setData((prev) => prev ? { ...prev, capacidadCargaKg: result.capacidadCargaKg ?? capacidad } : prev)
      setCapacidadSuccess('Capacidad actualizada correctamente.')
    }
  }

  const handleTransfer = async () => {
    if (!repartidorId || !selectedSucursal) return
    setTransferring(true)
    setTransferError('')
    const result = await authService.cambiarSucursalRepartidor(repartidorId, selectedSucursal || null)
    setTransferring(false)
    if ('error' in result) {
      setTransferError(result.error)
    } else {
      const liberados = result.paquetesLiberados
      const extra = liberados > 0 ? ` Se liberaron ${liberados} envío${liberados === 1 ? '' : 's'} a la cola de calendarización.` : ''
      setTransferSuccess(`Repartidor transferido correctamente.${extra}`)
      setTransferDialogOpen(false)
      setData((prev) => prev ? { ...prev, sucursalId: result.user.sucursalId } : prev)
    }
  }

  const handleSaveVencimiento = async () => {
    if (!repartidorId) return
    setSavingVencimiento(true)
    setVencimientoError('')
    setVencimientoSuccess('')
    const isoValue = vencimientoInput ? `${vencimientoInput}T00:00:00.000Z` : null
    const result = await authService.updateVencimientoLicencia(repartidorId, isoValue)
    setSavingVencimiento(false)
    if (!result) {
      setVencimientoError('No se pudo actualizar. Intentá de nuevo.')
    } else {
      setData((prev) => prev ? { ...prev, vencimientoLicencia: result.vencimientoLicencia, licenciaVencida: result.licenciaVencida, licenciaProximaAVencer: result.licenciaProximaAVencer } : prev)
      setVencimientoSuccess('Vencimiento actualizado correctamente.')
    }
  }

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const f = preset.from()
    const t = preset.to()
    setFrom(f)
    setTo(t)
    void load(f, t, true)
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small">Volver</Button>
      </Stack>

      {data && (
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ position: 'relative' }}>
              {data.fotoPerfil ? (
                <Box
                  component="img"
                  src={data.fotoPerfil}
                  sx={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
                />
              ) : (
                <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
              )}
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={700}>{data.nombre}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{data.email}</Typography>
            </Box>
          </Stack>

          {permissions.has('repartidores') && (
            <Card variant="outlined">
              <CardContent sx={{ pb: '14px !important' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>Configuración operativa</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Ajustes que definen disponibilidad diaria y capacidad del repartidor.
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      label={`${data.horasTrabajo ?? 8} h/día`}
                      size="small"
                      sx={{ fontWeight: 700 }}
                    />
                    <Chip
                      label={data.tipoJornada ?? 'Full Time'}
                      size="small"
                      sx={{
                        bgcolor: data.tipoJornada === 'Part Time' ? '#fff3e0' : '#e3f2fd',
                        color: data.tipoJornada === 'Part Time' ? '#e65100' : '#1565c0',
                        fontWeight: 700,
                      }}
                    />
                    <Chip label={`${data.capacidadCargaKg ?? 500} kg`} size="small" color="primary" variant="outlined" />
                  </Stack>
                </Stack>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight={700}>Jornada laboral</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Part Time: hasta 6 h/día. Full Time: 7 h o más.
                      </Typography>
                      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                        <TextField
                          size="small"
                          label="Horas por día"
                          type="number"
                          value={horasInput}
                          onChange={(e) => { setHorasInput(e.target.value); setHorasError(''); setHorasSuccess('') }}
                          inputProps={{ min: 1, max: 24, style: { width: 70 } }}
                          sx={{ maxWidth: 150 }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => void handleSaveHoras()}
                          disabled={savingHoras}
                        >
                          {savingHoras ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
                        </Button>
                      </Stack>
                      {horasError && <Alert severity="error" sx={{ mt: 1.5, py: 0 }}>{horasError}</Alert>}
                      {horasSuccess && <Alert severity="success" sx={{ mt: 1.5, py: 0 }}>{horasSuccess}</Alert>}
                    </Box>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2, height: '100%' }}>
                      <Typography variant="subtitle2" fontWeight={700}>Capacidad de carga</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                        Actualizala cuando cambie el vehículo o la capacidad disponible.
                      </Typography>
                      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                        <TextField
                          size="small"
                          label="Kg disponibles"
                          type="number"
                          value={capacidadInput}
                          onChange={(e) => { setCapacidadInput(e.target.value); setCapacidadError(''); setCapacidadSuccess('') }}
                          inputProps={{ min: 1, max: 5000, step: 1, style: { width: 90 } }}
                          sx={{ maxWidth: 165 }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => void handleSaveCapacidad()}
                          disabled={savingCapacidad}
                        >
                          {savingCapacidad ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
                        </Button>
                      </Stack>
                      {capacidadError && <Alert severity="error" sx={{ mt: 1.5, py: 0 }}>{capacidadError}</Alert>}
                      {capacidadSuccess && <Alert severity="success" sx={{ mt: 1.5, py: 0 }}>{capacidadSuccess}</Alert>}
                    </Box>
                  </Grid>
                </Grid>

                <Divider sx={{ my: 2 }} />
                <Button
                  size="small"
                  variant="text"
                  endIcon={showJornadaHistorial ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={() => setShowJornadaHistorial((value) => !value)}
                  sx={{ textTransform: 'none', px: 0 }}
                >
                  {showJornadaHistorial ? 'Ocultar historial de jornada' : `Ver historial de jornada (${jornadaHistorial.length})`}
                </Button>
                <Collapse in={showJornadaHistorial} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 1.5 }}>
                    {jornadaHistorialError && <Alert severity="warning" sx={{ mb: 1, py: 0 }}>{jornadaHistorialError}</Alert>}
                    {jornadaHistorial.length === 0 ? (
                      <Alert severity="info" sx={{ py: 0 }}>Todavía no hay cambios registrados para la jornada laboral.</Alert>
                    ) : (
                      <Stack spacing={1}>
                        {jornadaHistorial.map((item) => (
                          <Box key={item.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                              <Typography variant="body2">
                                <strong>{item.usuarioNombre}</strong> cambió {item.valorAnterior == null ? 'sin valor previo' : `${item.valorAnterior} h`} → {item.valorNuevo == null ? '-' : `${item.valorNuevo} h`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                {formatInstantArgentinaDate(item.timestamp)} · {formatInstantArgentinaTime(item.timestamp, { hour: '2-digit', minute: '2-digit', hour12: false })}
                              </Typography>
                            </Stack>
                            <Typography variant="caption" color="text.secondary">{item.motivo}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          )}

          {(user.role === 'supervisor' || user.role === 'administrador') && (
            <Card variant="outlined" sx={{ borderLeft: data?.licenciaVencida ? '4px solid #c62828' : data?.licenciaProximaAVencer ? '4px solid #e65100' : '4px solid #bdbdbd' }}>
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography variant="subtitle2" gutterBottom>Vencimiento de licencia</Typography>
                {data?.licenciaVencida && <Alert severity="error" sx={{ mb: 1, py: 0 }}>Licencia vencida — el repartidor no puede operar.</Alert>}
                {data?.licenciaProximaAVencer && !data?.licenciaVencida && <Alert severity="warning" sx={{ mb: 1, py: 0 }}>Licencia próxima a vencer (dentro de 30 días).</Alert>}
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <TextField
                    size="small"
                    label="Fecha de vencimiento"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={vencimientoInput}
                    onChange={(e) => { setVencimientoInput(e.target.value); setVencimientoError(''); setVencimientoSuccess('') }}
                    inputProps={{ min: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })() }}
                    sx={{ maxWidth: 200 }}
                    helperText="Mínimo mañana"
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleSaveVencimiento()}
                    disabled={savingVencimiento}
                  >
                    {savingVencimiento ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
                  </Button>
                  {vencimientoInput && (
                    <Button size="small" variant="text" color="error" onClick={() => { setVencimientoInput(''); void handleSaveVencimiento() }}>
                      Borrar
                    </Button>
                  )}
                </Stack>
                {vencimientoError && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{vencimientoError}</Alert>}
                {vencimientoSuccess && <Alert severity="success" sx={{ mt: 1, py: 0 }}>{vencimientoSuccess}</Alert>}
              </CardContent>
            </Card>
          )}

          {user.role === 'administrador' && (
            <Card variant="outlined">
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography variant="subtitle2" gutterBottom>Transferir a otra sucursal</Typography>
                {transferSuccess && <Alert severity="success" sx={{ mb: 1, py: 0 }}>{transferSuccess}</Alert>}
                {transferError && <Alert severity="error" sx={{ mb: 1, py: 0 }}>{transferError}</Alert>}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TransferWithinAStationIcon />}
                  onClick={async () => {
                    const branches = await branchService.getAllBranches()
                    setSucursales(branches)
                    setSelectedSucursal(data?.sucursalId ?? '')
                    setTransferDialogOpen(true)
                  }}
                  sx={{ textTransform: 'none' }}
                >
                  Cambiar sucursal
                </Button>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Los envíos pendientes de asignación se liberarán automáticamente.
                </Typography>
              </CardContent>
            </Card>
          )}

          {historialJornada.length > 0 && (
            <Card variant="outlined">
              <CardContent sx={{ pb: '12px !important' }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <HistoryIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2">Historial de cambios de jornada</Typography>
                    <Chip label={historialJornada.length} size="small" />
                  </Stack>
                  <Button
                    size="small"
                    onClick={() => setHistorialExpanded((v) => !v)}
                    endIcon={historialExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ textTransform: 'none', fontSize: 12 }}
                  >
                    {historialExpanded ? 'Ocultar' : 'Ver historial'}
                  </Button>
                </Stack>
                <Collapse in={historialExpanded}>
                  <Table size="small" sx={{ mt: 1.5 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Fecha</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Descripción</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Realizado por</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {historialJornada.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                            {new Date(item.timestamp).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                          </TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{item.descripcion}</TableCell>
                          <TableCell sx={{ fontSize: 12 }}>{item.usuarioNombre}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Collapse>
              </CardContent>
            </Card>
          )}
        </Stack>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent sx={{ pb: '18px !important' }}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Período de análisis</Typography>
              <Typography variant="body2" color="text.secondary">
                Elegí un rango para calcular métricas y compararlas contra el período anterior.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'center' }}>
              <Box sx={{ minWidth: { lg: 330 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, mb: 0.75 }}>
                  Accesos rápidos
                </Typography>
                <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: 'wrap' }}>
                {PRESETS.map((p) => (
                  <Button key={p.label} onClick={() => applyPreset(p)} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                    {p.label}
                  </Button>
                ))}
                </ButtonGroup>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, mb: 0.75 }}>
                  Rango personalizado
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                  <TextField
                    type="date"
                    size="small"
                    label="Desde"
                    InputLabelProps={{ shrink: true }}
                    value={from}
                    inputProps={{ max: today() }}
                    onChange={(e) => { setFrom(e.target.value); setDateError('') }}
                    sx={{ width: 165 }}
                  />
                  <TextField
                    type="date"
                    size="small"
                    label="Hasta"
                    InputLabelProps={{ shrink: true }}
                    value={to}
                    inputProps={{ max: today() }}
                    onChange={(e) => { setTo(e.target.value); setDateError('') }}
                    sx={{ width: 165 }}
                  />
                  <Button size="small" variant="contained" onClick={() => void load(undefined, undefined, true)} sx={{ minHeight: 40, px: 2 }}>
                    Aplicar
                  </Button>
                </Stack>
              </Box>
            </Stack>

            {dateError && <Alert severity="error" sx={{ py: 0 }}>{dateError}</Alert>}

            {prevData && hasValidComparisonRange && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', px: 1.25, py: 0.5, borderRadius: 999, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">
                  Comparando contra <strong>{formatDateOnlyEs(prevData.from, { day: '2-digit', month: 'short', year: 'numeric' })}</strong> - <strong>{formatDateOnlyEs(prevData.to, { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                </Typography>
              </Box>
            )}
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : !data ? null : !data.tieneActividad ? (
        <Alert severity="info">No hay datos operativos registrados para el período seleccionado.</Alert>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Kpi
              label="Total de Entregas"
              value={data.totalEntregas}
              sub={`de ${data.totalAsignados} asignados`}
              color="#2e7d32"
              icon={<CheckCircleIcon />}
              compareValue={data.totalEntregas}
              comparePrev={prevData ? prevData.totalEntregas : undefined}
              higherIsBetter
            />
            <Kpi
              label="Efectividad On-Time"
              value={`${data.efectividadOnTimePct.toFixed(1)}%`}
              sub="entregadas en fecha"
              color="#1976d2"
              icon={<AccessTimeIcon />}
              progress={data.efectividadOnTimePct}
              progressColor={data.efectividadOnTimePct >= 80 ? '#2e7d32' : data.efectividadOnTimePct >= 60 ? '#ed6c02' : '#c62828'}
              compareValue={data.efectividadOnTimePct}
              comparePrev={prevData ? prevData.efectividadOnTimePct : undefined}
              compareAsPercentPoints
              higherIsBetter
            />
            <Kpi
              label="Tasa de Incidencias"
              value={`${data.tasaIncidenciasPct.toFixed(1)}%`}
              sub={`${data.totalCancelaciones} canceladas`}
              color="#c62828"
              icon={<WarningAmberIcon />}
              progress={data.tasaIncidenciasPct}
              progressColor={data.tasaIncidenciasPct <= 10 ? '#2e7d32' : data.tasaIncidenciasPct <= 25 ? '#ed6c02' : '#c62828'}
              compareValue={data.tasaIncidenciasPct}
              comparePrev={prevData ? prevData.tasaIncidenciasPct : undefined}
              compareAsPercentPoints
              higherIsBetter={false}
            />
            <Kpi
              label="Total Asignados"
              value={data.totalAsignados}
              sub="en el período"
              color="#5e35b1"
              icon={<PersonIcon />}
              compareValue={data.totalAsignados}
              comparePrev={prevData ? prevData.totalAsignados : undefined}
              higherIsBetter
            />
          </Grid>

          {prevData && hasValidComparisonRange && (
            <ComparisonChart data={data} prevData={prevData} from={from} to={to} />
          )}
        </>
      )}

      {/* Transfer dialog */}
      <Dialog open={transferDialogOpen} onClose={() => setTransferDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Transferir repartidor a otra sucursal</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Los envíos pendientes de salida se liberarán y vuelven a la cola de calendarización.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Sucursal destino</InputLabel>
            <Select
              value={selectedSucursal}
              label="Sucursal destino"
              onChange={(e) => setSelectedSucursal(e.target.value)}
            >
              {sucursales.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {transferError && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{transferError}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => void handleTransfer()} disabled={transferring || !selectedSucursal}>
            {transferring ? <CircularProgress size={18} color="inherit" /> : 'Transferir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ─── Comparison bar chart ────────────────────────────────────────────────────

interface ComparisonChartProps {
  data: Rendimiento
  prevData: Rendimiento
  from: string
  to: string
}

function formatMetricValue(value: number, isPercent = false) {
  return isPercent ? `${value.toFixed(1)}%` : String(value)
}

function getTrend(current: number, prev: number, higherIsBetter: boolean) {
  const diff = current - prev
  const isNeutral = Math.abs(diff) < 0.05
  const improved = higherIsBetter ? diff > 0 : diff < 0
  return {
    diff,
    label: isNeutral ? 'Sin cambios' : improved ? 'Mejoró' : 'Empeoró',
    color: isNeutral ? '#616161' : improved ? '#2e7d32' : '#c62828',
    bg: isNeutral ? '#f5f5f5' : improved ? '#e8f5e9' : '#ffebee',
  }
}

function ComparisonRow({
  label,
  current,
  prev,
  color,
  isPercent = false,
  higherIsBetter = true,
}: {
  label: string
  current: number
  prev: number
  color: string
  isPercent?: boolean
  higherIsBetter?: boolean
}) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const maxVal = Math.max(current, prev, isPercent ? 100 : 1)
  const currentWidth = Math.max(4, (current / maxVal) * 100)
  const prevWidth = Math.max(prev === 0 ? 0 : 4, (prev / maxVal) * 100)
  const trend = getTrend(current, prev, higherIsBetter)
  const diffLabel = `${trend.diff > 0 ? '+' : ''}${isPercent ? `${trend.diff.toFixed(1)} pp` : trend.diff.toFixed(0)}`
  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : '#eef2f6'

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Box sx={{ width: { xs: '100%', sm: 180 }, flexShrink: 0 }}>
          <Typography variant="body2" fontWeight={700}>{label}</Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
            <Chip size="small" label={trend.label} sx={{ height: 20, fontSize: 11, bgcolor: trend.bg, color: trend.color, fontWeight: 700 }} />
            <Typography variant="caption" color="text.secondary">{diffLabel}</Typography>
          </Stack>
        </Box>

        <Stack spacing={0.8} sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ width: 54, flexShrink: 0 }}>Actual</Typography>
            <Box sx={{ flex: 1, height: 10, bgcolor: trackBg, borderRadius: 999, overflow: 'hidden' }}>
              <Box sx={{ width: `${currentWidth}%`, height: '100%', bgcolor: color, borderRadius: 999, transition: 'width .25s ease' }} />
            </Box>
            <Typography variant="caption" fontWeight={700} sx={{ width: 58, textAlign: 'right', flexShrink: 0 }}>{formatMetricValue(current, isPercent)}</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary" sx={{ width: 54, flexShrink: 0 }}>Anterior</Typography>
            <Box sx={{ flex: 1, height: 10, bgcolor: trackBg, borderRadius: 999, overflow: 'hidden' }}>
              <Box sx={{ width: `${prevWidth}%`, height: '100%', bgcolor: isDark ? 'rgba(255,255,255,0.28)' : '#b0bec5', borderRadius: 999 }} />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ width: 58, textAlign: 'right', flexShrink: 0 }}>{formatMetricValue(prev, isPercent)}</Typography>
          </Stack>
        </Stack>
      </Stack>
    </Box>
  )
}

function ComparisonChart({ data, prevData, from, to }: ComparisonChartProps) {
  const { from: prevFrom, to: prevTo } = prevPeriod(from, to)

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Comparativa con Período anterior
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Anterior: {formatDateOnlyEs(prevFrom, { day: '2-digit', month: 'short' })} — {formatDateOnlyEs(prevTo, { day: '2-digit', month: 'short' })}
          </Typography>
        </Stack>
        <Stack spacing={1.25}>
          <ComparisonRow
            label="Entregas totales"
            current={data.totalEntregas}
            prev={prevData.totalEntregas}
            color="#2e7d32"
            higherIsBetter
          />
          <ComparisonRow
            label="On-Time %"
            current={data.efectividadOnTimePct}
            prev={prevData.efectividadOnTimePct}
            color="#1976d2"
            isPercent
            higherIsBetter
          />
          <ComparisonRow
            label="Incidencias %"
            current={data.tasaIncidenciasPct}
            prev={prevData.tasaIncidenciasPct}
            color="#c62828"
            isPercent
            higherIsBetter={false}
          />
          <ComparisonRow
            label="Asignados"
            current={data.totalAsignados}
            prev={prevData.totalAsignados}
            color="#5e35b1"
            higherIsBetter
          />
        </Stack>
      </CardContent>
    </Card>
  )
}

interface KpiProps {
  label: string
  value: number | string
  sub: string
  color: string
  icon: React.ReactNode
  progress?: number
  progressColor?: string
  compareValue?: number
  comparePrev?: number
  higherIsBetter?: boolean
  compareAsPercentPoints?: boolean
}

function Kpi({ label, value, sub, color, icon, progress, progressColor, compareValue, comparePrev, higherIsBetter = true, compareAsPercentPoints = false }: KpiProps) {
  const showCompare = compareValue !== undefined && comparePrev !== undefined
  let trend = getTrend(0, 0, higherIsBetter)
  let diffLabel = ''
  if (showCompare) {
    trend = getTrend(compareValue!, comparePrev!, higherIsBetter)
    const diff = compareValue! - comparePrev!
    diffLabel = compareAsPercentPoints
      ? `${diff > 0 ? '+' : ''}${diff.toFixed(1)} pp vs anterior`
      : `${diff > 0 ? '+' : ''}${diff.toFixed(0)} vs anterior`
  }

  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color, mb: 0.5 }}>
            {icon}
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{label}</Typography>
          </Stack>
          <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.1 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{sub}</Typography>
          {progress !== undefined && (
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, progress))}
              sx={{ mt: 1, height: 6, borderRadius: 1, '& .MuiLinearProgress-bar': { bgcolor: progressColor ?? color } }}
            />
          )}
          {showCompare && (
            <Tooltip title={`Período anterior: ${comparePrev!.toFixed(comparePrev! % 1 !== 0 ? 1 : 0)}`}>
              <Chip
                size="small"
                icon={trend.diff >= 0 ? <TrendingUpIcon sx={{ fontSize: '14px !important' }} /> : <TrendingDownIcon sx={{ fontSize: '14px !important' }} />}
                label={`${trend.label}: ${diffLabel}`}
                sx={{
                  mt: 1,
                  fontSize: '0.68rem',
                  height: 20,
                  bgcolor: trend.bg,
                  color: trend.color,
                  '& .MuiChip-icon': { color: trend.color },
                }}
              />
            </Tooltip>
          )}
        </CardContent>
      </Card>
    </Grid>
  )
}
