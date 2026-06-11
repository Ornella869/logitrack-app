import { useEffect, useRef, useState, type ElementType } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Alert,
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CancelIcon from '@mui/icons-material/Cancel'
import ChatIcon from '@mui/icons-material/Chat'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CommentIcon from '@mui/icons-material/Comment'
import EmailIcon from '@mui/icons-material/Email'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import HistoryIcon from '@mui/icons-material/History'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import PersonIcon from '@mui/icons-material/Person'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import RepeatIcon from '@mui/icons-material/Repeat'
import SendIcon from '@mui/icons-material/Send'
import CarCrashIcon from '@mui/icons-material/CarCrash'
import BuildIcon from '@mui/icons-material/Build'
import MedicalServicesIcon from '@mui/icons-material/MedicalServices'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import ListAltIcon from '@mui/icons-material/ListAlt'
import HighlightOffIcon from '@mui/icons-material/HighlightOff'
import BrokenImageIcon from '@mui/icons-material/BrokenImage'
import {
  incidenciaService,
  type EstadoIncidencia,
  type Incidencia,
  type SeveridadIncidencia,
} from '../services/incidenciaService'
import { mensajeIncidenciaService, type MensajeIncidencia } from '../services/mensajeIncidenciaService'
import { shipmentService } from '../services/shipmentService'
import ConfirmDialog from '../components/ConfirmDialog'
import type { Shipment, User } from '../types'
import { formatInstantArgentina, formatInstantArgentinaTime } from '../utils/argentinaDate'

const TIPO_INFO: Record<string, { label: string; Icon: ElementType; color: string }> = {
  accident: { label: 'Accidente de tráfico', Icon: CarCrashIcon, color: '#c62828' },
  mechanical: { label: 'Problema mecánico', Icon: BuildIcon, color: '#e65100' },
  danger: { label: 'Zona de riesgo', Icon: HistoryIcon, color: '#f57f17' },
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

function EstadoChip({ estado }: { estado: EstadoIncidencia }) {
  const info = ESTADO_INFO[estado]
  return <Chip label={info.label} size="small" sx={{ bgcolor: info.bg, color: info.color, fontWeight: 700, border: `1px solid ${info.color}` }} />
}

function SeveridadChip({ severidad, vencido }: { severidad?: string; vencido?: boolean }) {
  const parsed = severidad?.trim()
  const value = parsed === 'Baja' || parsed === 'Media' || parsed === 'Alta' ? parsed : 'Media'
  const color = vencido ? '#b71c1c' : value === 'Alta' ? '#c62828' : value === 'Media' ? '#e65100' : '#2e7d32'
  const bg = vencido ? '#ffebee' : value === 'Alta' ? '#fdecea' : value === 'Media' ? '#fff3e0' : '#e8f5e9'
  return <Chip label={vencido ? `SLA vencido · ${value}` : value} size="small" sx={{ bgcolor: bg, color, fontWeight: 700, border: `1px solid ${color}` }} />
}

export default function IncidenciaDetallePage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [inc, setInc] = useState<Incidencia | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nuevoEstado, setNuevoEstado] = useState<EstadoIncidencia>('Abierta')
  const [nuevaSeveridad, setNuevaSeveridad] = useState<SeveridadIncidencia>('Media')
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
  const [mensajes, setMensajes] = useState<MensajeIncidencia[]>([])
  const [chatInput, setChatInput] = useState('')
  const chatContainerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const found = await incidenciaService.getById(id)
        if (!found) {
          setError('No se encontró la incidencia solicitada.')
          setInc(null)
          return
        }
        setInc(found)
        setNuevoEstado(found.estado)
        setNuevaSeveridad((found.severidad ?? 'Media') as SeveridadIncidencia)
      } catch {
        setError('No se pudo cargar la incidencia.')
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [id])

  useEffect(() => {
    if (!inc?.paradasAfectadas?.length) {
      setParadasData([])
      return
    }
    setParadasLoading(true)
    Promise.all(inc.paradasAfectadas.map((shipmentId) => shipmentService.getShipmentTracking(shipmentId)))
      .then((results) => setParadasData(results.filter((s): s is Shipment => s !== null)))
      .catch(() => undefined)
      .finally(() => setParadasLoading(false))
  }, [inc?.paradasAfectadas])

  useEffect(() => {
    if (!inc || inc.origen === 'cliente') return
    const load = async () => {
      const msgs = await mensajeIncidenciaService.getByIncidencia(inc.id)
      setMensajes(msgs)
      void mensajeIncidenciaService.markRead(inc.id)
    }
    void load()
    const poll = setInterval(() => void load(), 2000)
    return () => clearInterval(poll)
  }, [inc])

  useEffect(() => {
    const chat = chatContainerRef.current
    if (!chat) return
    chat.scrollTop = chat.scrollHeight
  }, [mensajes])

  const updateInc = (updated: Incidencia) => {
    setInc(updated)
    setNuevoEstado(updated.estado)
    setNuevaSeveridad((updated.severidad ?? 'Media') as SeveridadIncidencia)
  }

  const handleGuardarEstado = async () => {
    if (!inc) return
    setGuardando(true)
    try {
      const updated = await incidenciaService.cambiarEstado(inc.id, nuevoEstado)
      if (updated) {
        updateInc(updated)
        setFeedback(`Estado actualizado a "${nuevoEstado}" por ${user.name}`)
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleGuardarSeveridad = async () => {
    if (!inc) return
    setGuardando(true)
    try {
      const updated = await incidenciaService.cambiarSeveridad(inc.id, nuevaSeveridad)
      if (updated) {
        updateInc(updated)
        setFeedback(`Severidad actualizada a "${nuevaSeveridad}"`)
      }
    } finally {
      setGuardando(false)
    }
  }

  const handleAgregarObservacion = async () => {
    if (!inc || !observacion.trim()) return
    const updated = await incidenciaService.agregarObservacion(inc.id, observacion.trim())
    if (updated) {
      updateInc(updated)
      setObservacion('')
    }
  }

  const handleSendMensaje = async () => {
    if (!inc) return
    const texto = chatInput.trim()
    if (!texto) return
    setChatInput('')
    await mensajeIncidenciaService.send(inc.id, texto)
    setMensajes(await mensajeIncidenciaService.getByIncidencia(inc.id))
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

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
  }

  if (error || !inc) {
    return (
      <Stack spacing={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/incidencias')} sx={{ alignSelf: 'flex-start' }}>Volver a incidencias</Button>
        <Alert severity="error">{error || 'No se encontró la incidencia solicitada.'}</Alert>
      </Stack>
    )
  }

  const tipoInfo = TIPO_INFO[inc.tipo] ?? TIPO_INFO.otro!
  const esCliente = inc.origen === 'cliente'

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/incidencias')} size="small">Volver a incidencias</Button>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <SeveridadChip severidad={inc.severidad} vencido={inc.slaVencido} />
          <EstadoChip estado={inc.estado} />
        </Stack>
      </Stack>

      <Card variant="outlined" sx={{ mb: 2, borderLeft: `5px solid ${tipoInfo.color}` }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 2, bgcolor: `${tipoInfo.color}18`, color: tipoInfo.color }}>
                <tipoInfo.Icon />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={800}>{tipoInfo.label}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatFecha(inc.fechaReporte)} · ID: {inc.id.slice(-8)}
                </Typography>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {esCliente ? <PersonOutlineIcon sx={{ fontSize: 15, verticalAlign: 'middle', mr: 0.5 }} /> : <PersonIcon sx={{ fontSize: 15, verticalAlign: 'middle', mr: 0.5 }} />}
                    {esCliente ? 'Origen: Cliente' : inc.repartidorNombre}
                  </Typography>
                  {esCliente && inc.emailContacto && (
                    <Typography variant="body2" color="text.secondary">
                      <EmailIcon sx={{ fontSize: 15, verticalAlign: 'middle', mr: 0.5 }} />{inc.emailContacto}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
            {inc.slaVenceEn && (
              <Alert severity={inc.slaVencido || inc.slaResueltoFueraDePlazo ? 'error' : 'info'} sx={{ minWidth: { md: 280 } }}>
                SLA vence {formatFecha(inc.slaVenceEn)}
                {inc.resueltaEn && ` · resuelta ${formatFecha(inc.resueltaEn)} · tiempo ${formatMinutosResolucion(inc.minutosResolucion)}`}
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} lg={8}>
          <Stack spacing={2.5}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="caption" fontWeight={700} color="text.secondary" textTransform="uppercase">Descripción del incidente</Typography>
                <Paper elevation={0} sx={{ mt: 1, p: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f8f9fa', border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#e0e0e0', borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{inc.descripcion}</Typography>
                </Paper>
              </CardContent>
            </Card>

            {(inc.paradasAfectadas?.length ?? 0) > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <LocalShippingIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" fontWeight={700}>Envíos afectados ({inc.paradasAfectadas!.length})</Typography>
                  </Stack>
                  {paradasLoading ? (
                    <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} /><Typography variant="body2">Cargando envíos...</Typography></Stack>
                  ) : (
                    <Stack spacing={1.2}>
                      {paradasData.map((p) => {
                        const accion = paradasAccion[p.id]
                        const isDone = accion === 'done'
                        const isLoading = accion === 'loading'
                        const esEntregado = p.status === 'Entregado'
                        const esCancelado = p.status === 'Cancelado'
                        return (
                          <Paper key={p.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.2}>
                              <Box>
                                <Typography variant="body2" fontWeight={700}>{p.receiver.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{p.receiver.address}, {p.receiver.city}</Typography>
                                <Typography variant="caption" color="text.secondary" display="block">Estado: {p.status}</Typography>
                              </Box>
                              {!isDone && !esEntregado && !esCancelado && (
                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                  <Button size="small" variant="outlined" color="warning" startIcon={isLoading ? <CircularProgress size={12} /> : <RepeatIcon />} disabled={isLoading || p.status === 'Pendiente de calendarización' || p.status === 'Cancelado'} onClick={() => void handleReprogramar(p.id)}>Reprogramar</Button>
                                  <Button size="small" variant="outlined" color="error" startIcon={isLoading ? <CircularProgress size={12} /> : <CancelIcon />} disabled={isLoading || p.status === 'Cancelado'} onClick={() => { setCancelarDialogId(p.id); setCancelarMotivo('') }}>Cancelar</Button>
                                </Stack>
                              )}
                              {esEntregado && <Chip label="Reclamo post-entrega" size="small" color="info" />}
                              {esCancelado && <Chip label="Envío cancelado" size="small" color="default" />}
                              {isDone && <Chip label="Acción aplicada" size="small" color="success" />}
                              {typeof accion === 'string' && accion.startsWith('error') && <Chip label={accion.replace('error: ', '') || 'Error'} size="small" color="error" />}
                            </Stack>
                          </Paper>
                        )
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}

            {!esCliente && (
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <ChatIcon fontSize="small" color="action" />
                    <Typography variant="subtitle2" fontWeight={700}>Chat con repartidor</Typography>
                  </Stack>
                  {inc.chatFinalizado && <Alert severity="info" icon={false} sx={{ mb: 1 }}>Chat finalizado por el supervisor.</Alert>}
                  <Box ref={chatContainerRef} sx={{ border: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0', borderRadius: 2, bgcolor: isDark ? 'rgba(0,0,0,0.2)' : '#fafafa', maxHeight: 420, overflowY: 'auto', p: 1.2, mb: 1 }}>
                    {mensajes.length === 0 ? (
                      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>Sin mensajes aún. Iniciá la conversación.</Typography>
                    ) : (
                      <Stack spacing={0.8}>
                        {mensajes.map((m) => {
                          const isSuper = m.deRol === 'supervisor'
                          return (
                            <Stack key={m.id} direction={isSuper ? 'row-reverse' : 'row'} spacing={0.8} alignItems="flex-end">
                              <Box sx={{ maxWidth: '82%', px: 1.4, py: 0.8, borderRadius: isSuper ? '12px 4px 12px 12px' : '4px 12px 12px 12px', bgcolor: isSuper ? (isDark ? '#0d47a1' : '#1565C0') : (isDark ? 'rgba(255,255,255,0.07)' : '#e8f5e9'), color: isSuper ? '#fff' : 'text.primary' }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.texto}</Typography>
                                <Typography variant="caption" sx={{ opacity: 0.65, fontSize: 10, display: 'block', textAlign: isSuper ? 'right' : 'left' }}>{m.deNombre} · {formatInstantArgentinaTime(m.fecha, { hour: '2-digit', minute: '2-digit' })}</Typography>
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
                        <TextField size="small" fullWidth placeholder={`Escribir a ${inc.repartidorNombre}...`} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendMensaje() } }} multiline maxRows={3} />
                        <Button variant="contained" size="small" onClick={() => void handleSendMensaje()} disabled={!chatInput.trim()} startIcon={<SendIcon />} sx={{ minWidth: 'auto' }}>Enviar</Button>
                      </Stack>
                      <Button variant="outlined" color="error" size="small" fullWidth onClick={() => setFinalizarChatConfirm(true)} sx={{ fontWeight: 600, borderStyle: 'dashed' }}>Finalizar chat</Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            )}
          </Stack>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Stack spacing={2.5}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>Gestión operativa</Typography>
                <Stack spacing={2}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Severidad</InputLabel>
                    <Select value={nuevaSeveridad} label="Severidad" onChange={(e) => setNuevaSeveridad(e.target.value as SeveridadIncidencia)}>
                      <MenuItem value="Baja">Baja</MenuItem>
                      <MenuItem value="Media">Media</MenuItem>
                      <MenuItem value="Alta">Alta</MenuItem>
                    </Select>
                  </FormControl>
                  <Button variant="outlined" size="small" onClick={handleGuardarSeveridad} disabled={guardando || nuevaSeveridad === inc.severidad}>Guardar severidad</Button>
                  <Divider />
                  <FormControl size="small" fullWidth>
                    <InputLabel>Estado</InputLabel>
                    <Select value={nuevoEstado} label="Estado" onChange={(e) => setNuevoEstado(e.target.value as EstadoIncidencia)}>
                      <MenuItem value="Abierta">Abierta</MenuItem>
                      <MenuItem value="En Revisión">En Revisión</MenuItem>
                      <MenuItem value="Resuelta">Resuelta</MenuItem>
                    </Select>
                  </FormControl>
                  <Button variant="contained" size="small" onClick={handleGuardarEstado} disabled={guardando || nuevoEstado === inc.estado}>{guardando ? <CircularProgress size={16} color="inherit" /> : 'Guardar estado'}</Button>
                  {feedback && <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />}>{feedback}</Alert>}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                  <CommentIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2" fontWeight={700}>Observaciones internas ({inc.observaciones.length})</Typography>
                </Stack>
                {inc.observaciones.length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>Sin observaciones aún.</Typography>
                ) : (
                  <Stack spacing={0.8} sx={{ mb: 1.2 }}>
                    {inc.observaciones.map((o, index) => (
                      <Paper key={index} elevation={0} sx={{ p: 1, borderRadius: 1.5, bgcolor: isDark ? 'rgba(25,118,210,0.08)' : '#e3f2fd' }}>
                        <Typography variant="body2">{o.texto}</Typography>
                        <Typography variant="caption" color="text.secondary">{o.supervisorNombre} · {formatFecha(o.fecha)}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
                <Stack spacing={1}>
                  <TextField size="small" fullWidth placeholder="Agregar observación interna..." value={observacion} onChange={(e) => setObservacion(e.target.value)} multiline maxRows={3} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleAgregarObservacion() } }} />
                  <Button variant="outlined" size="small" onClick={() => void handleAgregarObservacion()} disabled={!observacion.trim()}>Agregar observación</Button>
                </Stack>
              </CardContent>
            </Card>

            {esCliente && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>Datos del cliente</Typography>
                  <Stack spacing={0.8}>
                    {inc.envioId && <Typography variant="body2"><LocalShippingIcon sx={{ fontSize: 15, verticalAlign: 'middle', mr: 0.5 }} />Envío: <strong>{inc.envioId}</strong></Typography>}
                    <Typography variant="body2"><EmailIcon sx={{ fontSize: 15, verticalAlign: 'middle', mr: 0.5 }} />{inc.emailContacto || 'Sin email de contacto'}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            )}

            <Accordion disableGutters variant="outlined" sx={{ borderRadius: 1.5, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <HistoryIcon fontSize="small" color="action" />
                  <Typography variant="subtitle2" fontWeight={700}>Historial de estados</Typography>
                  <Chip label={inc.historialEstados.length} size="small" sx={{ height: 20 }} />
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                {inc.historialEstados.length === 0 ? (
                  <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>Sin cambios de estado registrados.</Typography>
                ) : (
                  <Stack spacing={0.8}>
                    {inc.historialEstados.map((h, index) => (
                      <Paper key={index} elevation={0} sx={{ px: 1.5, py: 1, borderRadius: 1.5, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : '#f5f5f5', borderLeft: `3px solid ${ESTADO_INFO[h.estadoNuevo]?.color ?? '#757575'}` }}>
                        <Stack spacing={0.3}>
                          <Typography variant="body2">→ <strong>{h.estadoNuevo}</strong></Typography>
                          <Typography variant="caption" color="text.secondary">{h.porNombre} · {formatFecha(h.fecha)}</Typography>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </AccordionDetails>
            </Accordion>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={!!cancelarDialogId && !cancelarFinalConfirm} onClose={() => setCancelarDialogId(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Motivo de cancelación</DialogTitle>
        <DialogContent>
          <TextField fullWidth autoFocus label="Motivo (obligatorio)" multiline minRows={2} value={cancelarMotivo} onChange={(e) => setCancelarMotivo(e.target.value)} sx={{ mt: 1 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelarDialogId(null)}>Volver</Button>
          <Button variant="contained" color="error" disabled={!cancelarMotivo.trim()} onClick={() => setCancelarFinalConfirm(true)}>Confirmar cancelación</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={cancelarFinalConfirm} title="¿Estás seguro?" message={`Esta acción cancelará el envío de forma definitiva. Motivo: "${cancelarMotivo}". No se puede deshacer.`} confirmLabel="Sí, cancelar envío" cancelLabel="Volver" confirmColor="error" onConfirm={() => { setCancelarFinalConfirm(false); void handleConfirmarCancelar() }} onCancel={() => setCancelarFinalConfirm(false)} />
      <ConfirmDialog open={finalizarChatConfirm} title="¿Finalizar chat?" message={`¿Estás seguro que querés finalizar el chat con ${inc.repartidorNombre.split(' ')[0]}? El historial se conservará pero no se podrán enviar nuevos mensajes.`} confirmLabel="Sí, finalizar chat" cancelLabel="Volver" confirmColor="error" onConfirm={async () => { setFinalizarChatConfirm(false); const updated = await incidenciaService.finalizarChat(inc.id); if (updated) updateInc(updated) }} onCancel={() => setFinalizarChatConfirm(false)} />
    </Box>
  )
}
