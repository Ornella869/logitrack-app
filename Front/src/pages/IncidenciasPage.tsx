import { useEffect, useRef, useState, type ElementType } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import SearchIcon from '@mui/icons-material/Search'
import PersonIcon from '@mui/icons-material/Person'
import HistoryIcon from '@mui/icons-material/History'
import CommentIcon from '@mui/icons-material/Comment'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CancelIcon from '@mui/icons-material/Cancel'
import RepeatIcon from '@mui/icons-material/Repeat'
import ChatIcon from '@mui/icons-material/Chat'
import SendIcon from '@mui/icons-material/Send'
import EmailIcon from '@mui/icons-material/Email'
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import CarCrashIcon from '@mui/icons-material/CarCrash'
import BuildIcon from '@mui/icons-material/Build'
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import ListAltIcon from '@mui/icons-material/ListAlt'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import BrokenImageIcon from '@mui/icons-material/BrokenImage'
import MarkUnreadChatAltIcon from '@mui/icons-material/MarkUnreadChatAlt'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import GridOnIcon from '@mui/icons-material/GridOn'
import {
  incidenciaService,
  type EstadoIncidencia,
  type Incidencia,
  type SeveridadIncidencia,
} from '../services/incidenciaService'
import { mensajeIncidenciaService, type MensajeIncidencia } from '../services/mensajeIncidenciaService'
import { shipmentService } from '../services/shipmentService'
import type { Shipment, User } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'
import { formatInstantArgentina, formatInstantArgentinaTime } from '../utils/argentinaDate'

const TIPO_INFO: Record<string, { label: string; Icon: ElementType; color: string }> = {
  accident: { label: 'Accidente de tráfico', Icon: CarCrashIcon, color: '#c62828' },
  mechanical: { label: 'Problema mecánico', Icon: BuildIcon, color: '#e65100' },
  danger: { label: 'Zona de riesgo', Icon: ReportProblemIcon, color: '#f57f17' },
  health: { label: 'Problema de salud', Icon: MedicalServicesIcon, color: '#6a1b9a' },
  delivery: { label: 'Problema de entrega', Icon: Inventory2Icon, color: '#1565c0' },
  otro: { label: 'Otro', Icon: ListAltIcon, color: '#37474f' },
  no_llego: { label: 'No llegó', Icon: HighlightOffIcon, color: '#b71c1c' },
  llego_danado: { label: 'Llegó dañado', Icon: BrokenImageIcon, color: '#e65100' },
  llego_tarde: { label: 'Llegó tarde', Icon: AccessTimeIcon, color: '#f57f17' },
}

const ESTADO_INFO: Record<EstadoIncidencia, { color: string; bg: string; label: string }> = {
  Abierta: { color: '#c62828', bg: '#fdecea', label: 'Abierta' },
  'En Revisión': { color: '#e65100', bg: '#fff3e0', label: 'En Revisión' },
  Resuelta: { color: '#2e7d32', bg: '#e8f5e9', label: 'Resuelta' },
}

function EstadoChip({ estado }: { estado: EstadoIncidencia }) {
  const info = ESTADO_INFO[estado]
  return (
    <Chip
      label={info.label}
      size="small"
      sx={{
        bgcolor: info.bg,
        color: info.color,
        fontWeight: 700,
        border: `1px solid ${info.color}`,
        fontSize: 11,
      }}
    />
  )
}

function SeveridadChip({ severidad, vencido }: { severidad?: string; vencido?: boolean }) {
  const parsed = severidad?.trim()
  const value = parsed === 'Baja' || parsed === 'Media' || parsed === 'Alta' ? parsed : 'Media'
  const color = vencido ? '#b71c1c' : value === 'Alta' ? '#c62828' : value === 'Media' ? '#e65100' : '#2e7d32'
  const bg = vencido ? '#ffebee' : value === 'Alta' ? '#fdecea' : value === 'Media' ? '#fff3e0' : '#e8f5e9'
  return (
    <Chip
      label={vencido ? `SLA vencido · ${value}` : value}
      size="small"
      sx={{ bgcolor: bg, color, fontWeight: 700, border: `1px solid ${color}`, fontSize: 11 }}
    />
  )
}

function formatFecha(iso: string): string {
  return formatInstantArgentina(iso, {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatMinutosResolucion(minutos?: number | null): string {
  if (!minutos) return '—'
  if (minutos < 60) return `${minutos} min`
  const horas = Math.floor(minutos / 60)
  const resto = minutos % 60
  return resto ? `${horas} h ${resto} min` : `${horas} h`
}

interface PanelCruzadoRepartidor {
  repartidorId: string
  repartidorNombre: string
  total: number
  porTipo: Record<string, number>
}
interface PanelCruzadoData {
  tipos: string[]
  repartidores: PanelCruzadoRepartidor[]
  promedios: Record<string, number>
}
interface DetalleIncidenciaCruzado {
  id: string
  tipo: string
  tipoLabel: string
  descripcion: string
  estado: string
  fechaReporte: string
  severidad: string
  repartidorNombre: string
  codigoSeguimiento: string
}

const ESTADO_COLOR_CRUZADO: Record<string, string> = {
  Abierta: '#c62828',
  'En Revisión': '#e65100',
  Resuelta: '#2e7d32',
}

interface DetalleDialogProps {
  incidencia: Incidencia
  supervisor: User
  onClose: () => void
  onUpdated: (inc: Incidencia) => void
}

export function DetalleDialog({ incidencia: inc, supervisor, onClose, onUpdated }: DetalleDialogProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [nuevoEstado, setNuevoEstado] = useState<EstadoIncidencia>(inc.estado)
  const [nuevaSeveridad, setNuevaSeveridad] = useState<SeveridadIncidencia>((inc.severidad ?? 'Media') as SeveridadIncidencia)
  const [observacion, setObservacion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [paradasData, setParadasData] = useState<Shipment[]>([])
  const [paradasLoading, setParadasLoading] = useState(false)
  const [paradasAccion, setParadasAccion] = useState<Record<string, 'loading' | 'done' | 'error' | string>>({})
  const [cancelarDialogId, setCancelarDialogId] = useState<string | null>(null)
  const [cancelarMotivo, setCancelarMotivo] = useState('')
  const [cancelarFinalConfirm, setCancelarFinalConfirm] = useState(false)
  const [finalizarChatConfirm, setFinalizarChatConfirm] = useState(false)

  const tipoInfo = TIPO_INFO[inc.tipo] ?? TIPO_INFO.otro!

  useEffect(() => {
    if (!inc.paradasAfectadas?.length) return
    setParadasLoading(true)
    Promise.all(inc.paradasAfectadas.map((id) => shipmentService.getShipmentTracking(id)))
      .then((results) => setParadasData(results.filter((s): s is Shipment => s !== null)))
      .catch(() => undefined)
      .finally(() => setParadasLoading(false))
  }, [inc.paradasAfectadas])

  // Chat supervisor → repartidor
  const [mensajes, setMensajes] = useState<MensajeIncidencia[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const load = async () => {
      const msgs = await mensajeIncidenciaService.getByIncidencia(inc.id)
      setMensajes(msgs)
      void mensajeIncidenciaService.markRead(inc.id)
    }
    void load()
    const poll = setInterval(() => void load(), 2000)
    return () => clearInterval(poll)
  }, [inc.id])

  useEffect(() => {
    const chat = chatContainerRef.current
    if (!chat) return
    chat.scrollTop = chat.scrollHeight
  }, [mensajes])

  const handleSendMensaje = async () => {
    const texto = chatInput.trim()
    if (!texto) return
    setChatInput('')
    await mensajeIncidenciaService.send(inc.id, texto)
    const msgs = await mensajeIncidenciaService.getByIncidencia(inc.id)
    setMensajes(msgs)
  }

  const handleReprogramar = async (shipmentId: string) => {
    setParadasAccion((prev) => ({ ...prev, [shipmentId]: 'loading' }))
    const result = await shipmentService.resolverIncidente(shipmentId, 'Reprogramar', 'Reprogramado por supervisor debido a incidente del repartidor')
    setParadasAccion((prev) => ({ ...prev, [shipmentId]: result.success ? 'done' : `error: ${result.error ?? 'Error'}` }))
    if (result.success) {
      setParadasData((prev) => prev.map((p) => p.id === shipmentId ? { ...p, status: 'Pendiente de calendarización' as const } : p))
    }
  }

  const handleConfirmarCancelar = async () => {
    if (!cancelarDialogId || !cancelarMotivo.trim()) return
    const shipmentId = cancelarDialogId
    setCancelarDialogId(null)
    setParadasAccion((prev) => ({ ...prev, [shipmentId]: 'loading' }))
    const result = await shipmentService.resolverIncidente(shipmentId, 'Cancelar', cancelarMotivo.trim())
    setParadasAccion((prev) => ({ ...prev, [shipmentId]: result.success ? 'done' : `error: ${result.error ?? 'Error'}` }))
    if (result.success) {
      setParadasData((prev) => prev.map((p) => p.id === shipmentId ? { ...p, status: 'Cancelado' as const } : p))
    }
    setCancelarMotivo('')
  }

  const handleGuardarEstado = async () => {
    setGuardando(true)
    try {
      const updated = await incidenciaService.cambiarEstado(inc.id, nuevoEstado)
      if (updated) {
        onUpdated(updated)
        setFeedback(`Estado actualizado a "${nuevoEstado}" por ${supervisor.name}`)
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleGuardarSeveridad = async () => {
    setGuardando(true)
    try {
      const updated = await incidenciaService.cambiarSeveridad(inc.id, nuevaSeveridad)
      if (updated) {
        onUpdated(updated)
        setFeedback(`Severidad actualizada a "${nuevaSeveridad}"`)
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleAgregarObservacion = async () => {
    if (!observacion.trim()) return
    const updated = await incidenciaService.agregarObservacion(inc.id, observacion.trim())
    if (updated) {
      onUpdated(updated)
      setObservacion('')
    }
  }

  return (
    <>
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 2, bgcolor: `${tipoInfo.color}18`, color: tipoInfo.color }}>
            <tipoInfo.Icon fontSize="small" />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {tipoInfo.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatFecha(inc.fechaReporte)} · ID: {inc.id.slice(-8)}
            </Typography>
          </Box>
          <Box sx={{ ml: 'auto', display: 'flex', gap: 0.8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <SeveridadChip severidad={inc.severidad} vencido={inc.slaVencido} />
            <EstadoChip estado={inc.estado} />
          </Box>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5}>
          {/* Datos del origen */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.5 }}>
              {inc.origen === 'cliente' ? <PersonOutlineIcon fontSize="small" color="action" /> : <PersonIcon fontSize="small" color="action" />}
              <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase">
                {inc.origen === 'cliente' ? 'Origen: Cliente' : 'Repartidor'}
              </Typography>
              {inc.origen === 'cliente' && (
                <Chip label="Portal cliente" size="small" sx={{ height: 16, fontSize: 10, fontWeight: 600, bgcolor: '#E0F7FA', color: '#006064', border: '1px solid #80DEEA', '& .MuiChip-label': { px: 0.8 } }} />
              )}
            </Stack>
            {inc.origen !== 'cliente' && (
              <>
                <Typography variant="body2" fontWeight={600}>{inc.repartidorNombre}</Typography>
                <Typography variant="caption" color="text.secondary">ID: {inc.repartidorId}</Typography>
              </>
            )}
          </Box>

          {inc.slaVenceEn && (
            <Alert severity={inc.slaVencido || inc.slaResueltoFueraDePlazo ? 'error' : 'info'} sx={{ py: 0.5 }}>
              SLA: vence {formatFecha(inc.slaVenceEn)}
              {inc.resueltaEn && ` · resuelta ${formatFecha(inc.resueltaEn)} · tiempo ${formatMinutosResolucion(inc.minutosResolucion)}`}
              {inc.slaResueltoFueraDePlazo && ' · fuera de plazo'}
            </Alert>
          )}

          <Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase" sx={{ display: 'block', mb: 1 }}>
              Prioridad operativa
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Severidad</InputLabel>
                <Select
                  value={nuevaSeveridad}
                  label="Severidad"
                  onChange={(e) => setNuevaSeveridad(e.target.value as SeveridadIncidencia)}
                >
                  <MenuItem value="Baja">Baja</MenuItem>
                  <MenuItem value="Media">Media</MenuItem>
                  <MenuItem value="Alta">Alta</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={handleGuardarSeveridad}
                disabled={guardando || nuevaSeveridad === inc.severidad}
              >
                Guardar severidad
              </Button>
            </Stack>
          </Box>

          {/* Descripción */}
          <Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase" sx={{ display: 'block', mb: 0.5 }}>
              Descripción del Incidente
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f8f9fa',
                borderRadius: 2,
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e0e0e0',
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{inc.descripcion}</Typography>
            </Paper>
          </Box>

          {/* Cambio de estado */}
          <Box>
            <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase" sx={{ display: 'block', mb: 1 }}>
              Cambiar Estado
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Nuevo estado</InputLabel>
                <Select
                  value={nuevoEstado}
                  label="Nuevo estado"
                  onChange={(e) => setNuevoEstado(e.target.value as EstadoIncidencia)}
                >
                  <MenuItem value="Abierta">Abierta</MenuItem>
                  <MenuItem value="En Revisión">En Revisión</MenuItem>
                  <MenuItem value="Resuelta">Resuelta</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                size="small"
                onClick={handleGuardarEstado}
                disabled={guardando || nuevoEstado === inc.estado}
              >
                {guardando ? <CircularProgress size={16} color="inherit" /> : 'Guardar'}
              </Button>
            </Stack>
            {feedback && (
              <Alert severity="success" sx={{ mt: 1, py: 0.5 }} icon={<CheckCircleIcon fontSize="small" />}>
                {feedback}
              </Alert>
            )}
          </Box>

          {/* Historial de estados */}
          {inc.historialEstados.length > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                <HistoryIcon fontSize="small" color="action" />
                <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase">
                  Historial de Estados
                </Typography>
              </Stack>
              <Stack spacing={0.8}>
                {inc.historialEstados.map((h, i) => (
                  <Box
                    key={i}
                    sx={{
                      px: 1.5, py: 0.8,
                      borderRadius: 1.5,
                      bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5',
                      borderLeft: `3px solid ${ESTADO_INFO[h.estadoNuevo]?.color ?? '#757575'}`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">
                        → <strong>{h.estadoNuevo}</strong> · {h.porNombre}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFecha(h.fecha)}
                      </Typography>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          )}

          {/* Envíos afectados — G1L-92 */}
          {(inc.paradasAfectadas?.length ?? 0) > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                <LocalShippingIcon fontSize="small" color="action" />
                <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase">
                  Envíos afectados ({inc.paradasAfectadas!.length})
                </Typography>
              </Stack>
              {paradasLoading ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">Cargando envíos…</Typography>
                </Stack>
              ) : (
                <Stack spacing={1}>
                  {paradasData.map((p) => {
                    const accion = paradasAccion[p.id]
                    const isDone = accion === 'done'
                    const isLoading = accion === 'loading'
                    const esEntregado = p.status === 'Entregado'
                    const esCancelado = p.status === 'Cancelado'
                    return (
                      <Box
                        key={p.id}
                        sx={{
                          px: 1.5, py: 1,
                          borderRadius: 1.5,
                          bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f8f9fa',
                          border: '1px solid',
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e0e0e0',
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={0.5}>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{p.receiver.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{p.receiver.address}, {p.receiver.city}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">Estado: {p.status}</Typography>
                          </Box>
                          {!isDone && !esEntregado && !esCancelado && (
                            <Stack direction="row" spacing={0.7} flexWrap="wrap" useFlexGap>
                              <Button
                                size="small"
                                variant="outlined"
                                color="warning"
                                startIcon={isLoading ? <CircularProgress size={12} /> : <RepeatIcon />}
                                disabled={isLoading || p.status === 'Pendiente de calendarización' || p.status === 'Cancelado'}
                                onClick={() => void handleReprogramar(p.id)}
                                sx={{ fontSize: 11 }}
                              >
                                Reprogramar
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                color="error"
                                startIcon={isLoading ? <CircularProgress size={12} /> : <CancelIcon />}
                                disabled={isLoading || p.status === 'Cancelado'}
                                onClick={() => { setCancelarDialogId(p.id); setCancelarMotivo('') }}
                                sx={{ fontSize: 11 }}
                              >
                                Cancelar
                              </Button>
                            </Stack>
                          )}
                          {esEntregado && (
                            <Chip label="Reclamo post-entrega" size="small" color="info" />
                          )}
                          {esCancelado && (
                            <Chip label="Envio cancelado" size="small" color="default" />
                          )}
                          {isDone && (
                            <Chip label="Acción aplicada" size="small" color="success" />
                          )}
                          {typeof accion === 'string' && accion.startsWith('error') && (
                            <Chip
                              label={accion.replace('error: ', '') || 'Error'}
                              size="small"
                              color="error"
                              sx={{ maxWidth: 200, height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }}
                            />
                          )}
                        </Stack>
                      </Box>
                    )
                  })}
                </Stack>
              )}
            </Box>
          )}

          {/* Observaciones */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
              <CommentIcon fontSize="small" color="action" />
              <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase">
                Observaciones Internas ({inc.observaciones.length})
              </Typography>
            </Stack>
            {inc.observaciones.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                Sin observaciones aún.
              </Typography>
            ) : (
              <Stack spacing={0.8}>
                {inc.observaciones.map((o, i) => (
                  <Box
                    key={i}
                    sx={{
                      px: 1.5, py: 0.8,
                      borderRadius: 1.5,
                      bgcolor: isDark ? 'rgba(25,118,210,0.08)' : '#e3f2fd',
                      border: '1px solid',
                      borderColor: isDark ? 'rgba(25,118,210,0.2)' : '#bbdefb',
                    }}
                  >
                    <Typography variant="body2">{o.texto}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {o.supervisorNombre} · {formatFecha(o.fecha)}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Agregar observación interna…"
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAgregarObservacion() } }}
                multiline
                maxRows={3}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => void handleAgregarObservacion()}
                disabled={!observacion.trim()}
                sx={{ whiteSpace: 'nowrap' }}
              >
                Agregar
              </Button>
            </Stack>
          </Box>

          {/* Datos de contacto para incidencias de cliente */}
          {inc.origen === 'cliente' && (
            <Box>
              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
                <PersonOutlineIcon fontSize="small" color="action" />
                <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase">
                  Datos del cliente
                </Typography>
              </Stack>
              <Stack spacing={0.6}>
                {inc.envioId && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <LocalShippingIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">Envío:</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>{inc.envioId}</Typography>
                  </Stack>
                )}
                {inc.emailContacto ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">Email:</Typography>
                    <Typography variant="body2" fontWeight={600}>{inc.emailContacto}</Typography>
                  </Stack>
                ) : (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <EmailIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>Sin email de contacto</Typography>
                  </Stack>
                )}
              </Stack>
            </Box>
          )}

          {/* Mensajería interna supervisor ↔ repartidor (solo para incidencias de repartidor) */}
          {inc.origen !== 'cliente' && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.8} sx={{ mb: 0.8 }}>
              <ChatIcon fontSize="small" color="action" />
              <Typography variant="caption" fontWeight={600} color="text.secondary" textTransform="uppercase">
                Chat con repartidor
              </Typography>
            </Stack>

            {inc.chatFinalizado && (
              <Alert severity="info" icon={false} sx={{ mb: 1, py: 0.5, fontSize: 12, borderRadius: 1.5 }}>
                Chat finalizado por el supervisor. No se pueden enviar más mensajes.
              </Alert>
            )}

            <Box
              ref={chatContainerRef}
              sx={{
                border: '1px solid',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0',
                borderRadius: 2,
                bgcolor: isDark ? 'rgba(0,0,0,0.2)' : '#fafafa',
                maxHeight: 240,
                overflowY: 'auto',
                p: 1.2,
                mb: 1,
              }}
            >
              {mensajes.length === 0 ? (
                <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                  Sin mensajes aún. Iniciá la conversación.
                </Typography>
              ) : (
                <Stack spacing={0.8}>
                  {mensajes.map((m) => {
                    const isSuper = m.deRol === 'supervisor'
                    return (
                      <Stack key={m.id} direction={isSuper ? 'row-reverse' : 'row'} spacing={0.8} alignItems="flex-end">
                        <Box
                          sx={{
                            maxWidth: '78%',
                            px: 1.4,
                            py: 0.8,
                            borderRadius: isSuper ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                            bgcolor: isSuper
                              ? (isDark ? '#0d47a1' : '#1565C0')
                              : (isDark ? 'rgba(255,255,255,0.07)' : '#e8f5e9'),
                            color: isSuper ? '#fff' : 'text.primary',
                          }}
                        >
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                            {m.texto}
                          </Typography>
                          <Typography variant="caption" sx={{ opacity: 0.65, fontSize: 10, display: 'block', textAlign: isSuper ? 'right' : 'left' }}>
                            {m.deNombre} · {formatInstantArgentinaTime(m.fecha, { hour: '2-digit', minute: '2-digit' })}
                          </Typography>
                        </Box>
                      </Stack>
                    )
                  })}
                </Stack>
              )}
            </Box>
            {!inc.chatFinalizado && (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder={`Escribir a ${inc.repartidorNombre}…`}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendMensaje() } }}
                    multiline
                    maxRows={3}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => void handleSendMensaje()}
                    disabled={!chatInput.trim()}
                    startIcon={<SendIcon />}
                    sx={{ whiteSpace: 'nowrap', minWidth: 'auto', px: 1.5 }}
                  >
                    Enviar
                  </Button>
                </Stack>
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  fullWidth
                  onClick={() => setFinalizarChatConfirm(true)}
                  sx={{ fontWeight: 600, borderStyle: 'dashed' }}
                >
                  Finalizar chat con {inc.repartidorNombre.split(' ')[0]}
                </Button>
              </Stack>
            )}
          </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>

    {/* Dialogo de motivo para cancelar envío */}
    <Dialog open={!!cancelarDialogId && !cancelarFinalConfirm} onClose={() => setCancelarDialogId(null)} maxWidth="xs" fullWidth>
      <DialogTitle>Motivo de cancelación</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          autoFocus
          label="Motivo (obligatorio)"
          multiline
          minRows={2}
          value={cancelarMotivo}
          onChange={(e) => setCancelarMotivo(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setCancelarDialogId(null)}>Volver</Button>
        <Button
          variant="contained"
          color="error"
          disabled={!cancelarMotivo.trim()}
          onClick={() => setCancelarFinalConfirm(true)}
        >
          Confirmar cancelación
        </Button>
      </DialogActions>
    </Dialog>

    <ConfirmDialog
      open={cancelarFinalConfirm}
      title="¿Estás seguro?"
      message={`Esta acción cancelará el envío de forma definitiva. Motivo: "${cancelarMotivo}". No se puede deshacer.`}
      confirmLabel="Sí, cancelar envío"
      cancelLabel="Volver"
      confirmColor="error"
      onConfirm={() => { setCancelarFinalConfirm(false); void handleConfirmarCancelar() }}
      onCancel={() => setCancelarFinalConfirm(false)}
    />

    <ConfirmDialog
      open={finalizarChatConfirm}
      title="¿Finalizar chat?"
      message={`¿Estás seguro que querés finalizar el chat con ${inc.repartidorNombre.split(' ')[0]}? El historial se conservará pero no se podrán enviar nuevos mensajes.`}
      confirmLabel="Sí, finalizar chat"
      cancelLabel="Volver"
      confirmColor="error"
      onConfirm={async () => {
        setFinalizarChatConfirm(false)
        const updated = await incidenciaService.finalizarChat(inc.id)
        if (updated) onUpdated(updated)
      }}
      onCancel={() => setFinalizarChatConfirm(false)}
    />
    </>
  )
}

export default function IncidenciasPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [tabVista, setTabVista] = useState<'repartidores' | 'clientes' | 'cruzado'>('repartidores')
  const [filtroEstado, setFiltroEstado] = useState<EstadoIncidencia | 'Todas'>('Todas')
  const [filtroSeveridad, setFiltroSeveridad] = useState<SeveridadIncidencia | 'Todas'>('Todas')
  const [soloSlaVencido, setSoloSlaVencido] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [activeChats, setActiveChats] = useState<Array<{ incidencia: Incidencia; unread: number }>>([])
  const [rankingZonas, setRankingZonas] = useState<Array<{ provincia: string; localidad: string; total: number; altas: number; vencidas: number; severidadPredominante: string; tipoPredominante: string }>>([])
  const [panelCruzado, setPanelCruzado] = useState<PanelCruzadoData | null>(null)
  const [cruzadoLoading, setCruzadoLoading] = useState(false)
  const [cruzadoError, setCruzadoError] = useState('')
  const [cruzadoDesde, setCruzadoDesde] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  })
  const [cruzadoHasta, setCruzadoHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [drillCell, setDrillCell] = useState<{ repartidorId: string; repartidorNombre: string; tipo: string } | null>(null)
  const [drillItems, setDrillItems] = useState<DetalleIncidenciaCruzado[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  const cargar = async () => {
    setIncidencias(await incidenciaService.getAll())
    try {
      setRankingZonas(await incidenciaService.rankingZonas())
    } catch {
      setRankingZonas([])
    }
  }

  const refreshChats = async () => {
    const all = (await incidenciaService.getAll()).filter(
      (inc) => inc.estado !== 'Resuelta' && inc.origen !== 'cliente' && !inc.chatFinalizado,
    )
    const withData = await Promise.all(
      all.map(async (inc) => {
        const msgs = await mensajeIncidenciaService.getByIncidencia(inc.id)
        return { incidencia: inc, unread: mensajeIncidenciaService.countUnreadFromRepartidor(msgs), hasMsgs: msgs.length > 0 }
      }),
    )
    setActiveChats(
      withData
        .filter(({ hasMsgs, unread }) => hasMsgs || unread > 0)
        .sort((a, b) => b.unread - a.unread),
    )
  }

  const cargarCruzado = async (desde = cruzadoDesde, hasta = cruzadoHasta) => {
    setCruzadoLoading(true)
    setCruzadoError('')
    try {
      const apiModule = await import('../services/api')
      const res = await apiModule.default.get('/incidencias/panel-cruzado', { params: { desde, hasta } })
      setPanelCruzado(res.data)
    } catch {
      setCruzadoError('No se pudo cargar el panel cruzado.')
    } finally {
      setCruzadoLoading(false)
    }
  }

  const openDrillCruzado = async (rep: PanelCruzadoRepartidor, tipo: string) => {
    const count = rep.porTipo[tipo] ?? 0
    if (count === 0) return
    setDrillCell({ repartidorId: rep.repartidorId ?? '', repartidorNombre: rep.repartidorNombre, tipo })
    setDrillLoading(true)
    setDrillItems([])
    try {
      const apiModule = await import('../services/api')
      const res = await apiModule.default.get('/incidencias/panel-detalle', {
        params: { repartidorId: rep.repartidorId, tipo, desde: cruzadoDesde, hasta: cruzadoHasta },
      })
      setDrillItems(res.data)
    } finally {
      setDrillLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
    const handler = () => void cargar()
    window.addEventListener('logitrack:incidencias', handler)
    return () => window.removeEventListener('logitrack:incidencias', handler)
  }, [])

  useEffect(() => {
    void refreshChats()
    const poll = setInterval(() => void refreshChats(), 5000)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    if (tabVista === 'cruzado' && !panelCruzado && !cruzadoLoading) {
      void cargarCruzado()
    }
  }, [tabVista])

  const incidenciasDeRepartidor = incidencias.filter((i) => i.origen !== 'cliente')
  const incidenciasDeCliente = incidencias.filter((i) => i.origen === 'cliente')
  const incidenciasBase = tabVista === 'repartidores' ? incidenciasDeRepartidor : incidenciasDeCliente

  const incidenciasFiltradas = incidenciasBase.filter((inc) => {
    const matchEstado = filtroEstado === 'Todas' || inc.estado === filtroEstado
    const matchSeveridad = filtroSeveridad === 'Todas' || inc.severidad === filtroSeveridad
    const matchSla = !soloSlaVencido || inc.slaVencido || inc.slaResueltoFueraDePlazo
    const q = busqueda.toLowerCase()
    const matchBusqueda = !q
      || inc.repartidorNombre.toLowerCase().includes(q)
      || inc.tipoLabel.toLowerCase().includes(q)
      || inc.descripcion.toLowerCase().includes(q)
      || (inc.envioId ?? '').toLowerCase().includes(q)
    return matchEstado && matchSeveridad && matchSla && matchBusqueda
  })

  const counts = {
    total: incidenciasBase.length,
    abiertas: incidenciasBase.filter((i) => i.estado === 'Abierta').length,
    enRevision: incidenciasBase.filter((i) => i.estado === 'En Revisión').length,
    resueltas: incidenciasBase.filter((i) => i.estado === 'Resuelta').length,
    slaVencidas: incidenciasBase.filter((i) => i.slaVencido || i.slaResueltoFueraDePlazo).length,
  }

  return (
    <Box>
      {/* Header */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 3, gap: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <ReportProblemIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#c62828' }} />
            Gestión de Incidencias
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Panel centralizado de incidentes
          </Typography>
        </Box>
      </Stack>

      {/* Solapas Repartidores / Clientes */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs
          value={tabVista}
          onChange={(_, v: 'repartidores' | 'clientes' | 'cruzado') => { setTabVista(v); setFiltroEstado('Todas'); setFiltroSeveridad('Todas'); setSoloSlaVencido(false); setBusqueda('') }}
        >
          <Tab
            value="repartidores"
            label={
              <Stack direction="row" alignItems="center" spacing={0.8}>
                <DirectionsBikeIcon sx={{ fontSize: 17 }} />
                <span>Repartidores</span>
                {incidenciasDeRepartidor.filter(i => i.estado === 'Abierta').length > 0 && (
                  <Chip
                    label={incidenciasDeRepartidor.filter(i => i.estado === 'Abierta').length}
                    size="small"
                    color="error"
                    sx={{ height: 18, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.8 } }}
                  />
                )}
              </Stack>
            }
          />
          <Tab
            value="clientes"
            label={
              <Stack direction="row" alignItems="center" spacing={0.8}>
                <PersonOutlineIcon sx={{ fontSize: 17 }} />
                <span>Clientes</span>
                {incidenciasDeCliente.filter(i => i.estado === 'Abierta').length > 0 && (
                  <Chip
                    label={incidenciasDeCliente.filter(i => i.estado === 'Abierta').length}
                    size="small"
                    color="error"
                    sx={{ height: 18, fontSize: 10, fontWeight: 700, '& .MuiChip-label': { px: 0.8 } }}
                  />
                )}
              </Stack>
            }
          />
          <Tab value="cruzado" label={<Stack direction="row" alignItems="center" spacing={0.6}><GridOnIcon sx={{ fontSize: 16 }} /><span>Panel Cruzado</span></Stack>} />
        </Tabs>
      </Box>

      {tabVista === 'cruzado' && (
        <Box>
          {/* Filtros panel cruzado */}
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end" flexWrap="wrap">
                <TextField
                  size="small" label="Desde" type="date"
                  value={cruzadoDesde}
                  onChange={e => setCruzadoDesde(e.target.value)}
                  InputLabelProps={{ shrink: true }} sx={{ minWidth: 150 }}
                />
                <TextField
                  size="small" label="Hasta" type="date"
                  value={cruzadoHasta}
                  onChange={e => setCruzadoHasta(e.target.value)}
                  InputLabelProps={{ shrink: true }} inputProps={{ min: cruzadoDesde }} sx={{ minWidth: 150 }}
                />
                <Button variant="contained" disabled={cruzadoLoading}
                  onClick={() => cargarCruzado()} sx={{ minWidth: 100 }}>
                  {cruzadoLoading ? <CircularProgress size={18} color="inherit" /> : 'Filtrar'}
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {cruzadoError && <Alert severity="error" sx={{ mb: 2 }}>{cruzadoError}</Alert>}

          {cruzadoLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : !panelCruzado || panelCruzado.repartidores.length === 0 ? (
            <Alert severity="info">No hay incidencias con repartidor asignado en el período seleccionado.</Alert>
          ) : (
            <>
              {panelCruzado.repartidores.some(r => panelCruzado.tipos.some(t => {
                const avg = panelCruzado.promedios[t] ?? 0
                return avg > 0 && (r.porTipo[t] ?? 0) > avg * 2
              })) && (
                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
                  Algunas celdas resaltadas en rojo tienen más del doble del promedio del equipo. Revisá esos repartidores para identificar causas recurrentes.
                </Alert>
              )}

              <Card variant="outlined">
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                  <TableContainer>
                    <Table size="small" sx={{ minWidth: 600 }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }}>
                          <TableCell sx={{ fontWeight: 700, minWidth: 180, position: 'sticky', left: 0, bgcolor: isDark ? '#1e1e1e' : '#f5f5f5', zIndex: 1 }}>
                            Repartidor
                          </TableCell>
                          {panelCruzado.tipos.map(t => (
                            <TableCell key={t} align="center" sx={{ fontWeight: 700, minWidth: 90 }}>
                              <Tooltip title={`Promedio equipo: ${panelCruzado!.promedios[t]}`}>
                                <Box>
                                  <Typography variant="caption" fontWeight={700}
                                    sx={{ color: TIPO_INFO[t]?.color ?? '#555', display: 'block' }}>
                                    {TIPO_INFO[t]?.label ?? t}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                                    prom. {panelCruzado.promedios[t]}
                                  </Typography>
                                </Box>
                              </Tooltip>
                            </TableCell>
                          ))}
                          <TableCell align="center" sx={{ fontWeight: 700, minWidth: 70 }}>Total</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {panelCruzado.repartidores.map(rep => (
                          <TableRow key={rep.repartidorId} hover>
                            <TableCell sx={{
                              fontWeight: 600, position: 'sticky', left: 0,
                              bgcolor: isDark ? '#1e1e1e' : '#fff', zIndex: 1,
                              borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`,
                            }}>
                              {rep.repartidorNombre}
                            </TableCell>
                            {panelCruzado.tipos.map(t => {
                              const val = rep.porTipo[t] ?? 0
                              const avg = panelCruzado!.promedios[t] ?? 0
                              const atipico = avg > 0 && val > avg * 2
                              return (
                                <TableCell key={t} align="center"
                                  onClick={() => openDrillCruzado(rep, t)}
                                  sx={{
                                    cursor: val > 0 ? 'pointer' : 'default',
                                    bgcolor: atipico
                                      ? (isDark ? 'rgba(198,40,40,0.25)' : '#fdecea')
                                      : val > 0 ? (isDark ? 'rgba(255,255,255,0.03)' : '#fafafa') : 'inherit',
                                    '&:hover': val > 0 ? { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0' } : {},
                                    border: atipico ? `1px solid #c62828` : undefined,
                                  }}>
                                  {val === 0 ? (
                                    <Typography variant="caption" color="text.disabled">—</Typography>
                                  ) : (
                                    <Stack direction="row" spacing={0.4} justifyContent="center" alignItems="center">
                                      {atipico && <WarningAmberIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                                      <Typography variant="body2"
                                        fontWeight={atipico ? 800 : 600}
                                        sx={{ color: atipico ? 'error.main' : (TIPO_INFO[t]?.color ?? '#555') }}>
                                        {val}
                                      </Typography>
                                    </Stack>
                                  )}
                                </TableCell>
                              )
                            })}
                            <TableCell align="center">
                              <Chip label={rep.total} size="small" sx={{
                                fontWeight: 700,
                                bgcolor: rep.total > 5
                                  ? (isDark ? 'rgba(198,40,40,0.2)' : '#fdecea')
                                  : isDark ? 'rgba(255,255,255,0.08)' : '#f5f5f5',
                                color: rep.total > 5 ? 'error.main' : 'text.primary',
                              }} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>

              <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
                {panelCruzado.tipos.map(t => (
                  <Chip key={t} size="small"
                    label={`${TIPO_INFO[t]?.label ?? t}: prom. ${panelCruzado!.promedios[t]}`}
                    sx={{ fontSize: 11, color: TIPO_INFO[t]?.color ?? '#555', borderColor: TIPO_INFO[t]?.color ?? '#555' }}
                    variant="outlined" />
                ))}
              </Stack>
            </>
          )}

          {/* Drill-down dialog */}
          <Dialog open={!!drillCell} onClose={() => setDrillCell(null)} maxWidth="sm" fullWidth>
            <DialogTitle>
              <Typography variant="subtitle1" fontWeight={700}>
                {drillCell?.repartidorNombre} · {drillCell ? (TIPO_INFO[drillCell.tipo]?.label ?? drillCell.tipo) : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">{cruzadoDesde} – {cruzadoHasta}</Typography>
            </DialogTitle>
            <DialogContent dividers>
              {drillLoading ? (
                <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>
              ) : drillItems.length === 0 ? (
                <Alert severity="info">Sin incidencias para esta combinación.</Alert>
              ) : (
                <Stack spacing={1.5}>
                  {drillItems.map(inc => (
                    <Card key={inc.id} variant="outlined">
                      <CardContent sx={{ py: 1.5 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                          <Box flex={1}>
                            <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                              <Chip label={inc.estado} size="small" variant="outlined"
                                sx={{ fontSize: 10, color: ESTADO_COLOR_CRUZADO[inc.estado] ?? '#555', borderColor: ESTADO_COLOR_CRUZADO[inc.estado] ?? '#555' }} />
                              {inc.severidad === 'Alta' && (
                                <Chip label="Alta severidad" size="small" color="error" sx={{ fontSize: 10 }} />
                              )}
                              {inc.codigoSeguimiento && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                  {inc.codigoSeguimiento}
                                </Typography>
                              )}
                            </Stack>
                            <Typography variant="body2">{inc.descripcion || 'Sin descripción.'}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                            {new Date(inc.fechaReporte).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </DialogContent>
          </Dialog>
        </Box>
      )}

      {tabVista !== 'cruzado' && <>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ borderLeft: '4px solid #757575' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">Total</Typography>
              <Typography variant="h4" fontWeight={700}>{counts.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ borderLeft: '4px solid #c62828' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">Abiertas</Typography>
              <Typography variant="h4" fontWeight={700} color="#c62828">{counts.abiertas}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ borderLeft: '4px solid #e65100' }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">En Revisión</Typography>
              <Typography variant="h4" fontWeight={700} color="#e65100">{counts.enRevision}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} md={3}>
          <Card variant="outlined" sx={{ borderLeft: `4px solid ${counts.slaVencidas > 0 ? '#b71c1c' : '#2e7d32'}` }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} textTransform="uppercase">SLA vencidas</Typography>
              <Typography variant="h4" fontWeight={700} color={counts.slaVencidas > 0 ? '#b71c1c' : '#2e7d32'}>{counts.slaVencidas}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {rankingZonas.length > 0 && (
        <Card variant="outlined" sx={{ mb: 2.5 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
              Ranking de zonas con más incidencias
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Agrupado por provincia y localidad del envio asociado. La severidad sale del reporte y el SLA vencido de incidencias abiertas fuera de plazo.
            </Typography>
            <Grid container spacing={1}>
              {rankingZonas.slice(0, 5).map((zona) => (
                <Grid item xs={12} md={6} lg={4} key={`${zona.provincia}-${zona.localidad}`}>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={700}>{zona.localidad || 'Sin localidad'}</Typography>
                      <Chip size="small" color="error" label={zona.total} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{zona.provincia}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Altas: {zona.altas} · SLA vencido: {zona.vencidas}
                    </Typography>
                    <Typography variant="caption" display="block" color="text.secondary">
                      Predomina: {zona.tipoPredominante} · {zona.severidadPredominante}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField
              size="small"
              placeholder={tabVista === 'repartidores' ? 'Buscar por repartidor, tipo o descripción…' : 'Buscar por envío, tipo o descripción…'}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} /> }}
              sx={{ flex: 1 }}
            />
            <Stack direction="row" spacing={0.8} flexWrap="wrap">
              {(['Todas', 'Abierta', 'En Revisión', 'Resuelta'] as const).map((f) => (
                <Chip
                  key={f}
                  label={f}
                  size="small"
                  onClick={() => setFiltroEstado(f)}
                  variant={filtroEstado === f ? 'filled' : 'outlined'}
                  color={filtroEstado === f ? 'primary' : 'default'}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
            </Stack>
            <Stack direction="row" spacing={0.8} flexWrap="wrap">
              {(['Todas', 'Alta', 'Media', 'Baja'] as const).map((f) => (
                <Chip
                  key={f}
                  label={f === 'Todas' ? 'Todas las severidades' : f}
                  size="small"
                  onClick={() => setFiltroSeveridad(f)}
                  variant={filtroSeveridad === f ? 'filled' : 'outlined'}
                  color={filtroSeveridad === f ? 'warning' : 'default'}
                  sx={{ cursor: 'pointer' }}
                />
              ))}
              <Chip
                label="Solo SLA vencido"
                size="small"
                onClick={() => setSoloSlaVencido((v) => !v)}
                variant={soloSlaVencido ? 'filled' : 'outlined'}
                color={soloSlaVencido ? 'error' : 'default'}
                sx={{ cursor: 'pointer' }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Lista de incidencias */}
      {incidenciasFiltradas.length === 0 ? (
        <Alert severity="info" icon={<CheckCircleIcon />}>
          {incidenciasBase.length === 0
            ? tabVista === 'repartidores'
              ? 'No hay incidencias de repartidores aún. Aparecerán cuando usen el asistente Tracky.'
              : 'No hay incidencias de clientes aún. Aparecerán cuando reporten desde el portal público.'
            : 'No hay incidencias que coincidan con el filtro actual.'}
        </Alert>
      ) : (
        <Stack spacing={1.5}>
          {incidenciasFiltradas.map((inc) => {
            const tipoInfo = TIPO_INFO[inc.tipo] ?? TIPO_INFO.otro!
            const esCliente = inc.origen === 'cliente'
            return (
              <Card
                key={inc.id}
                variant="outlined"
                sx={{
                  borderLeft: `4px solid ${tipoInfo.color}`,
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s',
                  '&:hover': { boxShadow: 3 },
                  bgcolor: isDark ? (inc.estado === 'Abierta' ? 'rgba(198,40,40,0.06)' : 'transparent') : (inc.estado === 'Abierta' ? '#fff8f8' : 'white'),
                }}
                onClick={() => navigate(`/incidencias/${inc.id}`)}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 2, bgcolor: `${tipoInfo.color}18`, color: tipoInfo.color, flexShrink: 0 }}>
                      <tipoInfo.Icon />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={0.5}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {tipoInfo.label}
                        </Typography>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          {esCliente && (
                            <Chip label="Cliente" size="small" sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: '#E0F7FA', color: '#006064', border: '1px solid #80DEEA', '& .MuiChip-label': { px: 0.8 } }} />
                          )}
                          <SeveridadChip severidad={inc.severidad} vencido={inc.slaVencido} />
                          <EstadoChip estado={inc.estado} />
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.4 }} flexWrap="wrap">
                        <Typography variant="caption" color="text.secondary">
                          {esCliente
                            ? <><LocalShippingIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.3 }} />{inc.envioId ?? inc.repartidorNombre}</>
                            : <><PersonIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.3 }} />{inc.repartidorNombre}</>
                          }
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          <AccessTimeIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.3 }} />
                          {formatFecha(inc.fechaReporte)}
                        </Typography>
                        {esCliente && inc.emailContacto && (
                          <Typography variant="caption" color="text.secondary">
                            <EmailIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.3 }} />
                            {inc.emailContacto}
                          </Typography>
                        )}
                        {!esCliente && inc.observaciones.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            <CommentIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.3 }} />
                            {inc.observaciones.length} obs.
                          </Typography>
                        )}
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mt: 0.4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {inc.descripcion}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            )
          })}
        </Stack>
      )}
      </>}

      {/* Solapas de chat flotantes — una por incidente con mensajes activos */}
      {activeChats.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 0,
            right: 24,
            zIndex: 1300,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 1.5,
          }}
        >
          {activeChats.slice(0, 4).map(({ incidencia, unread }) => {
            const tipoInfo = TIPO_INFO[incidencia.tipo] ?? TIPO_INFO.otro!
            return (
              <Box
                key={incidencia.id}
                onClick={() => navigate(`/incidencias/${incidencia.id}`)}
                sx={{
                  cursor: 'pointer',
                  width: 240,
                  borderRadius: '12px 12px 0 0',
                  overflow: 'hidden',
                  boxShadow: '0 -4px 24px rgba(0,0,0,0.22)',
                  border: '1px solid',
                  borderBottom: 'none',
                  borderColor: unread > 0 ? '#c62828' : (isDark ? 'rgba(25,118,210,0.5)' : '#bbcfe8'),
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 -6px 28px rgba(0,0,0,0.28)',
                  },
                }}
              >
                {/* Header */}
                <Box
                  sx={{
                    px: 2,
                    py: 1.2,
                    background: unread > 0
                      ? 'linear-gradient(135deg, #b71c1c, #c62828)'
                      : (isDark
                        ? 'linear-gradient(135deg, #0d2137, #1a3a58)'
                        : 'linear-gradient(135deg, #1565C0, #1976D2)'),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.16)', color: 'white', flexShrink: 0 }}>
                    <tipoInfo.Icon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: 13, fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
                      {incidencia.repartidorNombre}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', lineHeight: 1.2 }}>
                      {tipoInfo.label}
                    </Typography>
                  </Box>
                  {unread > 0 ? (
                    <Box sx={{
                      bgcolor: 'white',
                      color: '#c62828',
                      borderRadius: '12px',
                      minWidth: 24,
                      height: 24,
                      px: 0.8,
                      fontSize: 12,
                      fontWeight: 800,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {unread > 9 ? '9+' : unread}
                    </Box>
                  ) : (
                    <ChatIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
                  )}
                </Box>

                {/* Preview del último estado */}
                <Box sx={{
                  px: 2,
                  py: 1,
                  bgcolor: isDark ? '#1a2a3a' : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}>
                  {unread > 0 ? (
                    <>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#c62828', flexShrink: 0 }} />
                      <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary', flex: 1 }}>
                        {`${unread} mensaje${unread > 1 ? 's' : ''} sin leer`}
                      </Typography>
                    </>
                  ) : (
                      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flex: 1 }}>
                        <MarkUnreadChatAltIcon sx={{ fontSize: 14, color: isDark ? '#4caf50' : '#1565C0' }} />
                        <Typography noWrap sx={{ fontSize: 12, fontWeight: 700, color: isDark ? '#4caf50' : '#1565C0', flex: 1 }}>
                          Iniciar chat con repartidor
                        </Typography>
                      </Stack>
                  )}
                </Box>
              </Box>
            )
          })}

          {activeChats.length > 4 && (
            <Box
              sx={{
                cursor: 'default',
                width: 60,
                borderRadius: '12px 12px 0 0',
                overflow: 'hidden',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
                border: '1px solid',
                borderBottom: 'none',
                borderColor: isDark ? 'rgba(25,118,210,0.3)' : '#bbdefb',
              }}
            >
              <Box sx={{
                px: 1,
                py: 1.2,
                background: isDark ? '#0d1b2a' : '#e3f2fd',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}>
                <Typography sx={{ fontSize: 13, fontWeight: 800, color: isDark ? '#64B5F6' : '#1565C0', lineHeight: 1 }}>
                  +{activeChats.length - 4}
                </Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary', lineHeight: 1.2, textAlign: 'center', mt: 0.3 }}>
                  más
                </Typography>
              </Box>
              <Box sx={{ px: 1, py: 1, bgcolor: isDark ? '#1a2a3a' : 'white' }} />
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
