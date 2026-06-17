import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SearchIcon from '@mui/icons-material/Search'
import StorefrontIcon from '@mui/icons-material/Storefront'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import EditIcon from '@mui/icons-material/Edit'
import { pickupOperacionService, type PickUpInventario, type PickUpPaquete } from '../services/pickupOperacionService'
import { pickupService, type ResumenCalificaciones, type HorarioPickUpItem } from '../services/pickupService'
import StarIcon from '@mui/icons-material/Star'
import StarHalfIcon from '@mui/icons-material/StarHalf'
import StarBorderIcon from '@mui/icons-material/StarBorder'

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    opts.push(`${String(h).padStart(2, '0')}:00`)
    opts.push(`${String(h).padStart(2, '0')}:30`)
  }
  return opts
})()

function buildHorariosStr(dias: string[], desde: string, hasta: string): string {
  const ordered = DIAS_SEMANA.filter(d => dias.includes(d))
  if (ordered.length === 0) return ''
  const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
  let diasStr: string
  if (ordered.length === 7) {
    diasStr = 'Todos los días'
  } else if (weekdays.every(d => ordered.includes(d)) && ordered.length === 5) {
    diasStr = 'Lun a Vie'
  } else if (ordered.length === 2 && ordered[0] === 'Sáb' && ordered[1] === 'Dom') {
    diasStr = 'Sáb y Dom'
  } else {
    diasStr = ordered.join(', ')
  }
  return `${diasStr} de ${desde} a ${hasta}`
}

function parseHorariosStr(horarios: string): { dias: string[]; desde: string; hasta: string } {
  const times = horarios.match(/\b(\d{1,2}:\d{2})\b/g)
  const desde = times?.[0] ?? '09:00'
  const hasta = times?.[1] ?? '18:00'
  let dias: string[] = []
  if (/todos/i.test(horarios)) {
    dias = [...DIAS_SEMANA]
  } else if (/lun.*vie|lunes.*viernes/i.test(horarios)) {
    dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
  } else {
    if (/\blun/i.test(horarios)) dias.push('Lun')
    if (/\bmar/i.test(horarios)) dias.push('Mar')
    if (/\bmi[eé]/i.test(horarios)) dias.push('Mié')
    if (/\bjue/i.test(horarios)) dias.push('Jue')
    if (/\bvi[eé]/i.test(horarios)) dias.push('Vie')
    if (/\bs[aá]b/i.test(horarios)) dias.push('Sáb')
    if (/\bdom/i.test(horarios)) dias.push('Dom')
  }
  if (dias.length === 0) dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie']
  return { dias, desde, hasta }
}

function QrScannerDialog({
  open,
  onClose,
  onDetected,
}: {
  open: boolean
  onClose: () => void
  onDetected: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const stoppedRef = useRef(false)
  const detectedRef = useRef(false)
  const onDetectedRef = useRef(onDetected)
  useEffect(() => { onDetectedRef.current = onDetected }, [onDetected])

  useEffect(() => {
    if (!open) return
    stoppedRef.current = false
    detectedRef.current = false
    setScanError(null)
    setReady(false)

    let stream: MediaStream | null = null
    let raf = 0

    const run = async () => {
      if (!('BarcodeDetector' in window)) {
        setScanError('Tu navegador no soporta el escaneo nativo. Ingresá el código manualmente.')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
        if (stoppedRef.current) { stream.getTracks().forEach((t) => t.stop()); return }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        setReady(true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const scan = async () => {
          if (stoppedRef.current || detectedRef.current || !videoRef.current) return
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const codes: any[] = await detector.detect(videoRef.current)
            if (codes.length > 0) {
              detectedRef.current = true
              onDetectedRef.current(String(codes[0].rawValue))
              return
            }
          } catch { /* ignore frame decode errors */ }
          raf = requestAnimationFrame(() => { void scan() })
        }
        void scan()
      } catch {
        setScanError('No se pudo acceder a la cámara. Verificá los permisos del navegador.')
      }
    }

    void run()

    return () => {
      stoppedRef.current = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
      setReady(false)
    }
  }, [open])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <QrCodeScannerIcon />
        Escanear código QR
      </DialogTitle>
      <DialogContent sx={{ pb: 1 }}>
        {scanError ? (
          <Alert severity="warning" sx={{ mt: 1 }}>{scanError}</Alert>
        ) : (
          <Box sx={{ position: 'relative', textAlign: 'center', bgcolor: '#000', borderRadius: 2, overflow: 'hidden' }}>
            <video
              ref={videoRef}
              style={{ width: '100%', maxHeight: 380, display: 'block' }}
              playsInline
              muted
            />
            {!ready && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
                <CircularProgress sx={{ color: '#fff' }} size={36} />
              </Box>
            )}
            {ready && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <Box sx={{
                  width: 200, height: 200,
                  border: '3px solid rgba(33,150,243,0.9)',
                  borderRadius: 2,
                  boxShadow: '0 0 0 2000px rgba(0,0,0,0.45)',
                  animation: 'qrPulse 1.5s ease-in-out infinite',
                  '@keyframes qrPulse': {
                    '0%,100%': { borderColor: 'rgba(33,150,243,0.9)' },
                    '50%': { borderColor: 'rgba(33,150,243,0.4)' },
                  },
                }} />
              </Box>
            )}
          </Box>
        )}
        {ready && (
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mt: 1.5 }}>
            Apuntá la cámara al código QR del paquete. Se detecta automáticamente.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="outlined">Cancelar</Button>
      </DialogActions>
    </Dialog>
  )
}

function Kpi({ title, value, icon, color }: { title: string; value: number | string; icon: ReactNode; color: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', borderLeft: `5px solid ${color}` }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>{title}</Typography>
            <Typography variant="h4" fontWeight={800}>{value}</Typography>
          </Box>
          <Box sx={{ color }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

function CapacidadCard({ usada, capacidad }: { usada: number; capacidad: number }) {
  const pct = capacidad > 0 ? Math.min(100, Math.round((usada / capacidad) * 100)) : 0
  const color = pct >= 90 ? '#D32F2F' : pct >= 70 ? '#ED6C02' : '#1976D2'
  return (
    <Card variant="outlined" sx={{ height: '100%', borderLeft: `5px solid ${color}` }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>CAPACIDAD ALMACENADA</Typography>
            <Typography variant="h4" fontWeight={800}>{usada}/{capacidad}</Typography>
          </Box>
          <Box sx={{ color }}><Inventory2Icon /></Box>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{ height: 8, borderRadius: 4, bgcolor: '#E0E0E0', '& .MuiLinearProgress-bar': { bgcolor: color } }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{pct}% utilizado</Typography>
      </CardContent>
    </Card>
  )
}

function StarRating({ value }: { value: number }) {
  return (
    <Stack direction="row" spacing={0.25} alignItems="center">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n
        const half = !filled && value >= n - 0.5
        return half
          ? <StarHalfIcon key={n} sx={{ fontSize: 18, color: '#f59e0b' }} />
          : filled
            ? <StarIcon key={n} sx={{ fontSize: 18, color: '#f59e0b' }} />
            : <StarBorderIcon key={n} sx={{ fontSize: 18, color: '#cbd5e1' }} />
      })}
    </Stack>
  )
}

export default function PickUpOperacionPage() {
  const [data, setData] = useState<PickUpInventario | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [codigoRecepcion, setCodigoRecepcion] = useState('')
  const [codigoEntrega, setCodigoEntrega] = useState('')
  const [codigoSegEntrega, setCodigoSegEntrega] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [devolverCodigo, setDevolverCodigo] = useState<string | null>(null)
  const [qrOpen, setQrOpen] = useState(false)
  const [resumenCalificaciones, setResumenCalificaciones] = useState<ResumenCalificaciones | null>(null)
  const [configOpen, setConfigOpen] = useState(false)
  const [editDias, setEditDias] = useState<string[]>([])
  const [editDesde, setEditDesde] = useState('09:00')
  const [editHasta, setEditHasta] = useState('18:00')
  const [editCapacidad, setEditCapacidad] = useState(0)
  const [savingConfig, setSavingConfig] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' })

  // G1L-152: Horarios estructurados por día
  const [horariosOpen, setHorariosOpen] = useState(false)
  const [horariosDia, setHorariosDia] = useState<HorarioPickUpItem[]>([])
  const [savingHorarios, setSavingHorarios] = useState(false)

  const DIA_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

  const openHorarios = async () => {
    if (!data) return
    const saved = await pickupService.getMisHorarios()
    const full: HorarioPickUpItem[] = Array.from({ length: 7 }, (_, i) => {
      const existing = saved.find(h => h.diaSemana === i)
      return existing ?? { diaSemana: i, apertura: '09:00:00', cierre: '18:00:00', cerrado: i === 0 }
    })
    setHorariosDia(full)
    setHorariosOpen(true)
  }

  const updateHorario = (dia: number, field: keyof HorarioPickUpItem, value: unknown) => {
    setHorariosDia(prev => prev.map(h => h.diaSemana === dia ? { ...h, [field]: value } : h))
  }

  const saveHorarios = async () => {
    setSavingHorarios(true)
    try {
      await pickupService.setMisHorarios(horariosDia)
      setHorariosOpen(false)
      setSnackbar({ open: true, msg: 'Horarios guardados correctamente.', severity: 'success' })
    } catch {
      setSnackbar({ open: true, msg: 'No se pudieron guardar los horarios.', severity: 'error' })
    } finally {
      setSavingHorarios(false)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const [inventario, calificaciones] = await Promise.all([
        pickupOperacionService.inventario(),
        pickupService.getMisCalificaciones().catch(() => null),
      ])
      setData(inventario)
      setResumenCalificaciones(calificaciones)
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: string } })?.response?.data
      setMessage({ type: 'error', text: typeof msg === 'string' ? msg : 'No se pudo cargar el inventario Pick Up.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const openConfig = () => {
    if (!data) return
    const parsed = parseHorariosStr(data.punto.horarios)
    setEditDias(parsed.dias)
    setEditDesde(parsed.desde)
    setEditHasta(parsed.hasta)
    setEditCapacidad(data.punto.capacidadDiaria)
    setConfigError(null)
    setConfigOpen(true)
  }

  const onSaveConfig = async () => {
    if (editDias.length === 0) { setConfigError('Seleccioná al menos un día de atención.'); return }
    if (editDesde >= editHasta) { setConfigError('El horario de cierre debe ser posterior al de apertura.'); return }
    if (editCapacidad <= 0) { setConfigError('La capacidad debe ser mayor a 0.'); return }
    if (editCapacidad > 500) { setConfigError('La capacidad diaria no puede superar los 500 envíos.'); return }
    const horarios = buildHorariosStr(editDias, editDesde, editHasta)
    setSavingConfig(true)
    try {
      await pickupService.actualizarConfiguracion(horarios, editCapacidad)
      setConfigOpen(false)
      setSnackbar({ open: true, msg: 'Configuración guardada correctamente.', severity: 'success' })
      await load()
    } catch (error: unknown) {
      const raw = (error as { response?: { data?: unknown } })?.response?.data
      const errorText = (typeof raw === 'string' && raw.trim()) ? raw.trim() : 'No se pudo guardar la configuración. Verificá que el servidor esté corriendo.'
      setConfigError(errorText)
      setSnackbar({ open: true, msg: errorText, severity: 'error' })
    } finally {
      setSavingConfig(false)
    }
  }

  // Paquetes depositados por el repartidor, esperando confirmación del socio
  const pendientesRecepcion = useMemo(
    () => data?.paquetes.filter((p) => p.status === 'EntregadoEnPunto') ?? [],
    [data],
  )

  // Inventario físico: confirmados y listos para que el cliente retire
  const inventarioFisico = useMemo(
    () => data?.paquetes.filter((p) => p.status === 'ListoParaRetirar') ?? [],
    [data],
  )

  const abandonados = useMemo(
    () => inventarioFisico.filter((p) => (p.diasAlmacenado ?? 0) >= 7),
    [inventarioFisico],
  )

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return inventarioFisico
    return inventarioFisico.filter((p) =>
      p.codigoSeguimiento.toLowerCase().includes(term) ||
      p.destinatario.toLowerCase().includes(term) ||
      p.localidad.toLowerCase().includes(term))
  }, [inventarioFisico, search])

  const onRecibir = async () => {
    if (!codigoRecepcion.trim()) {
      setMessage({ type: 'info', text: 'Ingresá o escaneá un código de seguimiento.' })
      return
    }
    setBusy(true)
    try {
      const paquete = await pickupOperacionService.recibir(codigoRecepcion.trim())
      setCodigoRecepcion('')
      setMessage({ type: 'success', text: `Envio ${paquete.codigoSeguimiento} recibido y listo para retirar.` })
      await load()
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data || 'No se pudo recibir el envio.' })
    } finally {
      setBusy(false)
    }
  }

  const onEntregar = async () => {
    if (!codigoSegEntrega.trim() || !codigoEntrega.trim()) {
      setMessage({ type: 'info', text: 'Ingresá el seguimiento y el código de entrega del cliente.' })
      return
    }
    setBusy(true)
    try {
      const paquete = await pickupOperacionService.entregar(codigoSegEntrega.trim(), codigoEntrega.trim())
      setCodigoSegEntrega('')
      setCodigoEntrega('')
      setMessage({ type: 'success', text: `Envio ${paquete.codigoSeguimiento} entregado correctamente.` })
      await load()
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data || 'No se pudo entregar el envio.' })
    } finally {
      setBusy(false)
    }
  }

  const fillDelivery = (paquete: PickUpPaquete) => {
    setCodigoSegEntrega(paquete.codigoSeguimiento)
    setCodigoEntrega('')
  }

  const onDevolver = async () => {
    if (!devolverCodigo) return
    setBusy(true)
    try {
      await pickupOperacionService.devolver(devolverCodigo)
      setDevolverCodigo(null)
      setMessage({ type: 'success', text: `Envío ${devolverCodigo} marcado para devolución al remitente.` })
      await load()
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data || 'No se pudo gestionar la devolución.' })
    } finally {
      setBusy(false)
    }
  }

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1320, mx: 'auto' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Operación Pick Up</Typography>
          <Typography color="text.secondary">Recepción, inventario y entrega con código de seguridad.</Typography>
        </Box>

        {message && <Alert severity={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>}

        {data && (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <StorefrontIcon color="primary" />
                <Box>
                  <Typography variant="h6" fontWeight={800}>{data.punto.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.punto.direccion}, {data.punto.localidad} · {data.punto.provincia}
                  </Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={data.punto.horarios} color="primary" variant="outlined" />
                <Tooltip title="Editar horarios y capacidad">
                  <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={openConfig}>
                    Configurar
                  </Button>
                </Tooltip>
                <Tooltip title="Gestionar horarios por día (G1L-152)">
                  <Button size="small" variant="outlined" color="secondary" onClick={openHorarios}>
                    Horarios detallados
                  </Button>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>
        )}

        {data && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' }, gap: 2, width: '100%' }}>
            <CapacidadCard usada={data.capacidadUsada} capacidad={data.punto.capacidadDiaria} />
            <Kpi title="EN CAMINO AL PUNTO" value={data.enCamino} icon={<LocalShippingIcon />} color="#ED6C02" />
            <Kpi title="PENDIENTES RECEPCIÓN" value={data.pendienteRecepcion} icon={<Inventory2Icon />} color="#7B1FA2" />
            <Kpi title="LISTOS PARA RETIRAR" value={data.listosParaRetirar} icon={<QrCodeScannerIcon />} color="#00897B" />
            <Kpi title="ENTREGADOS HOY" value={data.entregadosHoy} icon={<CheckCircleIcon />} color="#2E7D32" />
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2, width: '100%' }}>
          <Box>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} gutterBottom>Recibir envío</Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Código de seguimiento"
                    value={codigoRecepcion}
                    onChange={(e) => setCodigoRecepcion(e.target.value.toUpperCase())}
                    placeholder="Ej: LT-1234-5678"
                    fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerIcon /></InputAdornment> }}
                  />
                  <Stack direction="row" spacing={1.5}>
                    <Button
                      variant="outlined"
                      startIcon={<QrCodeScannerIcon />}
                      onClick={() => setQrOpen(true)}
                      disabled={busy}
                      sx={{ flexShrink: 0 }}
                    >
                      Escanear QR
                    </Button>
                    <Button variant="contained" onClick={onRecibir} disabled={busy} startIcon={<Inventory2Icon />} fullWidth>
                      Marcar como recibido
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>
          <Box>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} gutterBottom>Entregar al cliente</Typography>
                <Stack spacing={2}>
                  <TextField label="Código de seguimiento" value={codigoSegEntrega} onChange={(e) => setCodigoSegEntrega(e.target.value.toUpperCase())} fullWidth />
                  <TextField label="Código de entrega" value={codigoEntrega} onChange={(e) => setCodigoEntrega(e.target.value.replace(/\D/g, '').slice(0, 6))} fullWidth />
                  <Button variant="contained" color="success" onClick={onEntregar} disabled={busy} startIcon={<CheckCircleIcon />}>
                    Confirmar retiro
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Box>
        </Box>

        {abandonados.length > 0 && (
          <Alert severity="warning" icon={<WarningAmberIcon />}>
            <strong>{abandonados.length} envío{abandonados.length > 1 ? 's' : ''} lleva{abandonados.length === 1 ? '' : 'n'} más de 7 días almacenado{abandonados.length > 1 ? 's' : ''}.</strong>
            {' '}Considerá gestionar la devolución al remitente.
          </Alert>
        )}

        {/* Paquetes que llegaron al local pero el socio aún no confirmó recepción */}
        {pendientesRecepcion.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, borderColor: '#7B1FA2', bgcolor: '#F9F4FC' }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <Inventory2Icon sx={{ color: '#7B1FA2' }} />
              <Box>
                <Typography variant="h6" fontWeight={800} sx={{ color: '#4A148C' }}>
                  Paquetes que llegaron al local
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  El repartidor los depositó. Confirmá la recepción física escaneando el código.
                </Typography>
              </Box>
            </Stack>
            <Stack spacing={1}>
              {pendientesRecepcion.map((p) => (
                <Stack
                  key={p.id}
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  alignItems={{ sm: 'center' }}
                  spacing={1}
                  sx={{ p: 1.5, bgcolor: 'white', borderRadius: 2, border: '1px solid #CE93D8' }}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{p.codigoSeguimiento}</Typography>
                    <Typography variant="caption" color="text.secondary">{p.destinatario} · {p.localidad}</Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    sx={{ bgcolor: '#7B1FA2', '&:hover': { bgcolor: '#6A1B9A' }, fontWeight: 700, flexShrink: 0 }}
                    onClick={() => { setCodigoRecepcion(p.codigoSeguimiento) }}
                  >
                    Recibir
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Inventario físico</Typography>
              <Typography variant="body2" color="text.secondary">Paquetes presentes en el punto — estado Listo para retirar.</Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Buscar por código, cliente o localidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: { sm: 340 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Destino</TableCell>
                  <TableCell>Peso</TableCell>
                  <TableCell align="center">Días almacenado</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((p) => {
                  const vencido = (p.diasAlmacenado ?? 0) >= 7
                  return (
                    <TableRow
                      key={p.id}
                      hover
                      sx={vencido ? { bgcolor: '#FFF8E1' } : undefined}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          {vencido && (
                            <Tooltip title={`${p.diasAlmacenado} días almacenado — supera el límite de 7 días`}>
                              <WarningAmberIcon sx={{ fontSize: 16, color: '#E65100' }} />
                            </Tooltip>
                          )}
                          <Typography fontWeight={700}>{p.codigoSeguimiento}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{p.destinatario}</Typography>
                        <Typography variant="caption" color="text.secondary">{p.email || p.telefono || '-'}</Typography>
                      </TableCell>
                      <TableCell>{p.localidad} · CP {p.codigoPostal}</TableCell>
                      <TableCell>{p.peso} kg</TableCell>
                      <TableCell align="center">
                        {p.diasAlmacenado != null ? (
                          <Typography
                            variant="body2"
                            fontWeight={vencido ? 700 : 400}
                            color={vencido ? '#E65100' : 'text.primary'}
                          >
                            {p.diasAlmacenado} día{p.diasAlmacenado !== 1 ? 's' : ''}
                          </Typography>
                        ) : '-'}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" variant="outlined" onClick={() => fillDelivery(p)}>Entregar</Button>
                          {vencido && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              onClick={() => setDevolverCodigo(p.codigoSeguimiento)}
                            >
                              Devolver
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>No hay envíos físicamente presentes.</Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* AC3: Panel de calificaciones del punto */}
        {resumenCalificaciones && (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
              Calificaciones de clientes
            </Typography>
            {resumenCalificaciones.total === 0 ? (
              <Typography color="text.secondary" variant="body2">
                Aún no recibiste calificaciones. Aparecerán aquí cuando los clientes califiquen su experiencia de retiro.
              </Typography>
            ) : (
              <Stack spacing={2.5}>
                {/* Resumen numérico */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
                  <Box sx={{ textAlign: 'center', minWidth: 100 }}>
                    <Typography variant="h2" fontWeight={900} sx={{ color: '#f59e0b', lineHeight: 1 }}>
                      {resumenCalificaciones.promedio.toFixed(1)}
                    </Typography>
                    <StarRating value={resumenCalificaciones.promedio} />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                      {resumenCalificaciones.total} {resumenCalificaciones.total === 1 ? 'reseña' : 'reseñas'}
                    </Typography>
                  </Box>
                  <Divider orientation="vertical" flexItem />
                  <Stack spacing={0.5} flexGrow={1}>
                    {[5, 4, 3, 2, 1].map((n) => {
                      const count = resumenCalificaciones.porEstrella[n - 1]
                      const pct = resumenCalificaciones.total > 0 ? (count / resumenCalificaciones.total) * 100 : 0
                      return (
                        <Stack key={n} direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" sx={{ minWidth: 12, textAlign: 'right' }}>{n}</Typography>
                          <StarIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{ flexGrow: 1, height: 8, borderRadius: 4, bgcolor: '#E0E0E0', '& .MuiLinearProgress-bar': { bgcolor: '#f59e0b' } }}
                          />
                          <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20 }}>{count}</Typography>
                        </Stack>
                      )
                    })}
                  </Stack>
                </Stack>

                {/* Lista de reseñas */}
                {resumenCalificaciones.ultimas.length > 0 && (
                  <>
                    <Divider />
                    <Stack spacing={1.5}>
                      {resumenCalificaciones.ultimas.map((c) => (
                        <Box key={c.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FAFAFA' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                                <StarRating value={c.estrellas} />
                                <Typography variant="caption" color="text.secondary">
                                  {c.autorNombre ? `— ${c.autorNombre}` : '— Anónimo'}
                                </Typography>
                              </Stack>
                              {c.comentario && (
                                <Typography variant="body2">{c.comentario}</Typography>
                              )}
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography variant="caption" color="text.secondary">
                                {c.trackingCode}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {new Date(c.creadoEn).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  </>
                )}
              </Stack>
            )}
          </Paper>
        )}
      </Stack>

      <QrScannerDialog
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onDetected={(code) => {
          setQrOpen(false)
          setCodigoRecepcion(code.toUpperCase())
        }}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ minWidth: 300 }}
        >
          {snackbar.msg}
        </Alert>
      </Snackbar>

      <Dialog open={configOpen} onClose={() => { if (!savingConfig) setConfigOpen(false) }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Configurar horarios y capacidad</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ pt: 1 }}>
            {configError && <Alert severity="error" onClose={() => setConfigError(null)}>{configError}</Alert>}

            {/* Días */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.08em' }}>
                DÍAS DE ATENCIÓN
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {DIAS_SEMANA.map((dia) => (
                  <Chip
                    key={dia}
                    label={dia}
                    clickable
                    onClick={() => {
                      setEditDias((prev) =>
                        prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
                      )
                      setConfigError(null)
                    }}
                    color={editDias.includes(dia) ? 'primary' : 'default'}
                    variant={editDias.includes(dia) ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 700 }}
                  />
                ))}
              </Box>
            </Box>

            {/* Horario */}
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', letterSpacing: '0.08em' }}>
                HORARIO DE ATENCIÓN
              </Typography>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Apertura</InputLabel>
                  <Select
                    value={editDesde}
                    label="Apertura"
                    onChange={(e) => { setEditDesde(e.target.value); setConfigError(null) }}
                  >
                    {TIME_OPTIONS.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography sx={{ color: 'text.secondary', fontWeight: 600 }}>a</Typography>
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Cierre</InputLabel>
                  <Select
                    value={editHasta}
                    label="Cierre"
                    onChange={(e) => { setEditHasta(e.target.value); setConfigError(null) }}
                  >
                    {TIME_OPTIONS.filter((t) => t > editDesde).map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              {editDias.length > 0 && (
                <Typography variant="caption" sx={{ mt: 1.5, display: 'block', color: 'primary.main', fontWeight: 600 }}>
                  Vista previa: {buildHorariosStr(editDias, editDesde, editHasta)}
                </Typography>
              )}
            </Box>

            {/* Capacidad */}
            <TextField
              label="Capacidad diaria (envíos)"
              type="number"
              value={editCapacidad}
              onChange={(e) => setEditCapacidad(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              fullWidth
              inputProps={{ min: 1, max: 500 }}
              helperText="Entre 1 y 500 envíos por día"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)} disabled={savingConfig}>Cancelar</Button>
          <Button onClick={onSaveConfig} variant="contained" disabled={savingConfig}>
            {savingConfig ? <CircularProgress size={18} /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* G1L-152: Dialog de horarios detallados por día */}
      <Dialog open={horariosOpen} onClose={() => { if (!savingHorarios) setHorariosOpen(false) }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Horarios por día de la semana</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Configurá el horario de apertura y cierre de cada día. Los días marcados como "Cerrado" no recibirán envíos calendarizados automáticamente.
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Día</TableCell>
                <TableCell align="center">Cerrado</TableCell>
                <TableCell>Apertura</TableCell>
                <TableCell>Cierre</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {horariosDia.map((h) => (
                <TableRow key={h.diaSemana} sx={{ opacity: h.cerrado ? 0.5 : 1 }}>
                  <TableCell><Typography variant="body2" fontWeight={600}>{DIA_LABELS[h.diaSemana]}</Typography></TableCell>
                  <TableCell align="center">
                    <input
                      type="checkbox"
                      checked={h.cerrado}
                      onChange={(e) => updateHorario(h.diaSemana, 'cerrado', e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={h.apertura?.slice(0, 5) ?? '09:00'}
                      disabled={h.cerrado}
                      onChange={(e) => updateHorario(h.diaSemana, 'apertura', `${e.target.value}:00`)}
                      inputProps={{ style: { fontSize: 13 } }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={h.cierre?.slice(0, 5) ?? '18:00'}
                      disabled={h.cerrado}
                      onChange={(e) => updateHorario(h.diaSemana, 'cierre', `${e.target.value}:00`)}
                      inputProps={{ style: { fontSize: 13 } }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHorariosOpen(false)} disabled={savingHorarios}>Cancelar</Button>
          <Button onClick={saveHorarios} variant="contained" disabled={savingHorarios}>
            {savingHorarios ? <CircularProgress size={18} /> : 'Guardar horarios'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!devolverCodigo} onClose={() => setDevolverCodigo(null)}>
        <DialogTitle>Confirmar devolución</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Confirmás la devolución del envío <strong>{devolverCodigo}</strong> al remitente?
            El paquete quedará cancelado y no podrá ser retirado por el cliente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDevolverCodigo(null)} disabled={busy}>Cancelar</Button>
          <Button onClick={onDevolver} color="warning" variant="contained" disabled={busy}>
            Confirmar devolución
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
