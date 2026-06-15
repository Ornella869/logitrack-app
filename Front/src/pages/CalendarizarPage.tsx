import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
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
  IconButton,
  InputAdornment,
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
import BoltIcon from '@mui/icons-material/Bolt'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import PreviewIcon from '@mui/icons-material/Visibility'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import SearchIcon from '@mui/icons-material/Search'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { shipmentService, calendarizacionService, type CalendarizacionResultado, type DiaResumen, type CalendarioOperativo, type PaquetePendienteReagendamiento, type PaquetePreview } from '../services/shipmentService'
import { authService } from '../services/authService'
import { notificationService } from '../services/notificationService'
import type { Shipment, User } from '../types'
import { formatDateOnlyEs } from '../utils/argentinaDate'

const AVATAR_COLORS = ['#1976d2', '#388e3c', '#7b1fa2', '#f57c00', '#c2185b', '#5e35b1', '#00838f']

const PROCESS_STEPS = [
  { id: 1, title: 'Recolectar envíos pendientes', detail: 'Buscando envíos en estado "Pendiente de Calendarización"' },
  { id: 2, title: 'Ordenar por prioridad', detail: 'Prioritarios primero, luego Comunes (FIFO dentro de cada grupo)' },
  { id: 3, title: 'Agrupar por código postal', detail: 'Detectando zonas de destino' },
  { id: 4, title: 'Asignar a repartidores', detail: 'Buscando repartidores con capacidad disponible' },
  { id: 5, title: 'Persistir y registrar', detail: 'Guardando asignaciones y registrando historial' },
] as const

type Repartidor = { id: string; nombre: string; apellido: string; email: string; activo: boolean; estado?: string; capacidadCargaKg: number }

export default function CalendarizarPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [pendientes, setPendientes] = useState<Shipment[]>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [repartidorSearch, setRepartidorSearch] = useState('')
  const [visibleRepartidores, setVisibleRepartidores] = useState(8)
  // G1L-150: Vista previa
  const [previewing, setPreviewing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewResultado, setPreviewResultado] = useState<CalendarizacionResultado | null>(null)
  const [previewError, setPreviewError] = useState('')

  // Modal de proceso
  const [modalOpen, setModalOpen] = useState(false)
  const [stepIdx, setStepIdx] = useState(0) // 0..5 (5 = done)
  const [resultado, setResultado] = useState<CalendarizacionResultado | null>(null)
  const [exec, setExec] = useState<{ ok: boolean; error?: string } | null>(null)

  const [estadoActual, setEstadoActual] = useState<DiaResumen[]>([])
  const [calendarData, setCalendarData] = useState<CalendarioOperativo | null>(null)
  const [pendientesReagendamiento, setPendientesReagendamiento] = useState<PaquetePendienteReagendamiento[]>([])
  const [reagendandoId, setReagendandoId] = useState<string | null>(null)

  // Ajustes manuales sobre el preview antes de ejecutar
  const [overrides, setOverrides] = useState<Map<string, { repartidorId: string; repartidorNombre: string; fecha: string }>>(new Map())
  const [reassignDialog, setReassignDialog] = useState<{
    paqueteId: string
    codigoSeguimiento: string
    selectedRepartidorId: string
    selectedFecha: string
  } | null>(null)

  useEffect(() => {
    void loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [pend, reps, estado, cal, reagendar] = await Promise.all([
        shipmentService.getPendingShipments(),
        authService.getRepartidores(),
        calendarizacionService.getEstadoActual(),
        calendarizacionService.getCalendario(30),
        calendarizacionService.getPendientesReagendamiento(),
      ])
      setPendientes(pend)
      setEstadoActual(estado)
      setCalendarData(cal)
      setPendientesReagendamiento(reagendar)
      setRepartidores(
        (reps as any[]).map((r) => ({
          id: r.id,
          nombre: r.name ?? r.nombre ?? '',
          apellido: r.lastname ?? r.apellido ?? '',
          email: r.email ?? '',
          activo: r.activo ?? true,
          estado: r.estado,
          capacidadCargaKg: Number(r.capacidadCargaKg ?? 500),
        })),
      )
    } catch {
      setError('No se pudieron cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const repartidoresActivos = useMemo(
    () => repartidores.filter((r) => r.activo && (!r.estado || r.estado === 'Activo')),
    [repartidores],
  )

  const cargaActualPorRepartidor = useMemo(() => {
    return estadoActual.reduce<Record<string, { cantidad: number; pesoTotal: number }>>((acc, dia) => {
      dia.repartidores.forEach((repartidor) => {
        const current = acc[repartidor.repartidorId] ?? { cantidad: 0, pesoTotal: 0 }
        acc[repartidor.repartidorId] = {
          cantidad: current.cantidad + repartidor.cantidad,
          pesoTotal: current.pesoTotal + repartidor.pesoTotal,
        }
      })
      return acc
    }, {})
  }, [estadoActual])

  // Próxima fecha disponible: usa los mismos datos que el Calendario Operativo (30 días).
  // Un día se considera disponible cuando todavía no llegó al 90% de la capacidad real del repartidor.
  const proximaFechaDisponible = useMemo(() => {
    const result: Record<string, { fecha: string; pesoTotal: number } | null> = {}

    repartidoresActivos.forEach((r) => {
      if (!calendarData) { result[r.id] = null; return }

      const repCal = calendarData.repartidores.find((cr) => cr.repartidorId === r.id)
      if (!repCal) { result[r.id] = null; return }

      const hoyStr = new Date().toISOString().substring(0, 10)
      // Solo días futuros (no hoy)
      const celdas = repCal.celdas.filter((c) => c.fecha.substring(0, 10) > hoyStr)

      const capacidad = r.capacidadCargaKg || 500
      const libre = celdas.find((c) => c.pesoTotal < capacidad * 0.9)
      if (libre) {
        result[r.id] = { fecha: libre.fecha, pesoTotal: libre.pesoTotal }
      } else {
        // Fallback: día con menor carga
        const menorCarga = celdas.reduce<typeof celdas[0] | null>(
          (best, c) => (!best || c.pesoTotal < best.pesoTotal ? c : best), null,
        )
        result[r.id] = menorCarga ? { fecha: menorCarga.fecha, pesoTotal: menorCarga.pesoTotal } : null
      }
    })
    return result
  }, [calendarData, repartidoresActivos])

  const repartidoresDisponibles = useMemo(() => {
    const q = repartidorSearch.trim().toLowerCase()
    return repartidoresActivos
      .filter((repartidor) => {
        if (!q) return true
        const fullName = `${repartidor.nombre} ${repartidor.apellido}`.toLowerCase()
        return fullName.includes(q) || repartidor.email.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const cargaA = cargaActualPorRepartidor[a.id]?.pesoTotal ?? 0
        const cargaB = cargaActualPorRepartidor[b.id]?.pesoTotal ?? 0
        if (cargaA !== cargaB) return cargaA - cargaB

        const cantidadA = cargaActualPorRepartidor[a.id]?.cantidad ?? 0
        const cantidadB = cargaActualPorRepartidor[b.id]?.cantidad ?? 0
        if (cantidadA !== cantidadB) return cantidadA - cantidadB

        return `${a.nombre} ${a.apellido}`.localeCompare(`${b.nombre} ${b.apellido}`, 'es')
      })
  }, [cargaActualPorRepartidor, repartidorSearch, repartidoresActivos])

  const repartidoresDisponiblesVisibles = useMemo(
    () => repartidoresDisponibles.slice(0, visibleRepartidores),
    [repartidoresDisponibles, visibleRepartidores],
  )

  const summary = useMemo(() => {
    const prio = pendientes.filter((p) => p.tipoEnvio === 'Prioritario').length
    const comm = pendientes.length - prio
    const peso = pendientes.reduce((acc, p) => acc + (p.weight ?? 0), 0)
    const cps = Array.from(new Set(pendientes.map((p) => p.receiver.postalCode).filter(Boolean)))
    const capacidad = repartidoresActivos.reduce((acc, r) => acc + (r.capacidadCargaKg || 500), 0)
    return { prio, comm, peso, cps, capacidad }
  }, [pendientes, repartidoresActivos])

  if (user.role !== 'supervisor') {
    return <Alert severity="warning">Solo el Supervisor puede acceder a esta pantalla.</Alert>
  }

  const openReassign = (paquete: PaquetePreview, diaFecha: string) => {
    const existing = overrides.get(paquete.paqueteId)
    setReassignDialog({
      paqueteId: paquete.paqueteId,
      codigoSeguimiento: paquete.codigoSeguimiento,
      selectedRepartidorId: existing?.repartidorId ?? '',
      selectedFecha: existing?.fecha ?? diaFecha.slice(0, 10),
    })
  }

  const confirmReassign = () => {
    if (!reassignDialog?.selectedRepartidorId || !reassignDialog?.selectedFecha) return
    const rep = repartidoresActivos.find((r) => r.id === reassignDialog.selectedRepartidorId)
    if (!rep) return
    setOverrides((prev) => {
      const next = new Map(prev)
      next.set(reassignDialog.paqueteId, {
        repartidorId: reassignDialog.selectedRepartidorId,
        repartidorNombre: `${rep.nombre} ${rep.apellido}`,
        fecha: reassignDialog.selectedFecha,
      })
      return next
    })
    setReassignDialog(null)
  }

  const removeOverride = (paqueteId: string) => {
    setOverrides((prev) => { const next = new Map(prev); next.delete(paqueteId); return next })
  }

  const handlePreview = async () => {
    setOverrides(new Map())
    setPreviewing(true)
    setPreviewError('')
    const res = await calendarizacionService.preview()
    setPreviewing(false)
    if (!res.success) {
      setPreviewError(res.error ?? 'No se pudo simular la calendarización')
      return
    }
    setPreviewResultado(res.data ?? null)
    setPreviewOpen(true)
  }


  const ejecutar = async () => {
    setPreviewOpen(false)
    setModalOpen(true)
    setStepIdx(0)
    setResultado(null)
    setExec(null)

    // Animación visual de pasos en paralelo a la llamada real
    const stepInterval = setInterval(() => {
      setStepIdx((i) => (i < PROCESS_STEPS.length ? i + 1 : i))
    }, 600)

    const res = await calendarizacionService.ejecutar()

    clearInterval(stepInterval)
    setStepIdx(PROCESS_STEPS.length) // marca todos como done

    if (!res.success) {
      setExec({ ok: false, error: res.error ?? 'No se pudo ejecutar la calendarización' })
      return
    }

    // Aplicar ajustes manuales del preview
    for (const [paqueteId, ov] of overrides) {
      await calendarizacionService.precalendarizar(paqueteId, ov.repartidorId, ov.fecha)
    }
    setOverrides(new Map())

    const resultado = res.data ?? null
    setResultado(resultado)
    setExec({ ok: true })

    // Generar notificaciones
    if (resultado && resultado.totalCalendarizados > 0) {
      notificationService.add({
        type: 'calendarizacion',
        title: 'Calendarización completada',
        message: `${resultado.totalCalendarizados} envío${resultado.totalCalendarizados > 1 ? 's' : ''} asignado${resultado.totalCalendarizados > 1 ? 's' : ''}${resultado.totalSinAsignar > 0 ? `. ${resultado.totalSinAsignar} sin asignar.` : '.'}`,
        recipientId: user.id,
        navigateTo: '/rutas-activas',
      })

      // Notificar a cada repartidor con su carga asignada
      const porRepartidor = new Map<string, { nombre: string; cantidad: number }>()
      resultado.resumenPorDia.forEach((dia) => {
        dia.repartidores.forEach((rep) => {
          const prev = porRepartidor.get(rep.repartidorId)
          porRepartidor.set(rep.repartidorId, {
            nombre: rep.nombre,
            cantidad: (prev?.cantidad ?? 0) + rep.cantidad,
          })
        })
      })
      porRepartidor.forEach(({ nombre, cantidad }, repartidorId) => {
        notificationService.add({
          type: 'ruta-asignada',
          title: 'Nueva ruta asignada',
          message: `Hola ${nombre}, tenés ${cantidad} envío${cantidad > 1 ? 's' : ''} asignado${cantidad > 1 ? 's' : ''} para entrega.`,
          recipientId: repartidorId,
          navigateTo: '/repartidor',
        })
      })
    }

    void loadAll()
  }

  const cerrarModal = () => {
    setModalOpen(false)
    setResultado(null)
    setExec(null)
    setStepIdx(0)
  }

  const progressPct = Math.round((stepIdx / PROCESS_STEPS.length) * 100)

  const handleRepartidorSearchChange = (value: string) => {
    setRepartidorSearch(value)
    setVisibleRepartidores(8)
  }


  return (
    <Box>
      <Typography variant="h4" fontWeight={700}>
        <BoltIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Calendarización Automática
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Asignación automática de envíos a repartidores por código postal y capacidad.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <Grid container spacing={3}>
          {/* IZQUIERDA: Resumen previo */}
          <Grid item xs={12} md={8}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Resumen previo a la calendarización
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Métrica</TableCell>
                      <TableCell align="right">Valor</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Envíos a calendarizar</TableCell>
                      <TableCell align="right"><strong>{pendientes.length}</strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ pl: 4, color: 'text.secondary' }}>— Prioritarios</TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={summary.prio}
                          sx={{ bgcolor: isDark ? 'rgba(198,40,40,0.2)' : '#fdecea', color: '#c62828', border: '1px solid #c62828', fontWeight: 600 }}
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ pl: 4, color: 'text.secondary' }}>— Comunes</TableCell>
                      <TableCell align="right">{summary.comm}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Peso total a distribuir</TableCell>
                      <TableCell align="right"><strong>{summary.peso.toFixed(0)} kg</strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Códigos postales únicos</TableCell>
                      <TableCell align="right">
                        {summary.cps.length} {summary.cps.length > 0 && `(${summary.cps.slice(0, 6).join(', ')}${summary.cps.length > 6 ? '...' : ''})`}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Repartidores activos</TableCell>
                      <TableCell align="right"><strong>{repartidoresActivos.length}</strong></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Capacidad total configurable</TableCell>
                      <TableCell align="right">{summary.capacidad.toLocaleString('es-AR')} kg</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <Box sx={{ textAlign: 'center', mt: 3, pt: 3, borderTop: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #eee' }}>
                  {previewError && <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{previewError}</Alert>}
                  <Button
                    size="large"
                    variant="contained"
                    startIcon={previewing ? <CircularProgress size={18} color="inherit" /> : <BoltIcon />}
                    onClick={handlePreview}
                    disabled={pendientes.length === 0 || repartidoresActivos.length === 0 || previewing}
                    sx={{ px: 4, py: 1.5, fontSize: 14 }}
                  >
                    {previewing ? 'Calculando vista previa...' : 'Ejecutar calendarización'}
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Se mostrará un resumen para confirmar antes de aplicar los cambios
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* DERECHA: Repartidores disponibles */}
          <Grid item xs={12} md={4}>
              <Card variant="outlined">
              <CardContent>
                <Stack spacing={1.5} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
                      Repartidores disponibles
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                      Ordenados por menor carga asignada.
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Buscar nombre o email..."
                    value={repartidorSearch}
                    onChange={(e) => handleRepartidorSearchChange(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Stack>
                {repartidoresActivos.length === 0 ? (
                  <Alert severity="warning">No hay repartidores activos en el sistema.</Alert>
                ) : repartidoresDisponibles.length === 0 ? (
                  <Alert severity="info">No hay repartidores que coincidan con la búsqueda.</Alert>
                ) : (
                  <Stack divider={<Divider flexItem />}>
                    {repartidoresDisponiblesVisibles.map((r, idx) => {
                      const initials = `${r.nombre[0] ?? ''}${r.apellido[0] ?? ''}`.toUpperCase()
                      const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                      const info = proximaFechaDisponible[r.id]
                      const capacidad = r.capacidadCargaKg || 500
                      const libre = info ? Math.max(0, capacidad - info.pesoTotal) : 0
                      const esCargado = info ? info.pesoTotal >= capacidad * 0.9 : false
                      return (
                        <Stack key={r.id} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1 }}>
                          <Avatar sx={{ bgcolor: color, width: 32, height: 32, fontSize: 12 }}>
                            {initials}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {r.nombre} {r.apellido}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace' }}>
                              {r.email}
                            </Typography>
                            {info ? (
                              <Typography variant="caption" sx={{ color: esCargado ? 'warning.main' : 'success.main' }}>
                                {esCargado ? 'Parcial · ' : 'Disponible · '}
                                {formatDateOnlyEs(info.fecha, { weekday: 'short', day: '2-digit', month: 'short' })}
                                {' · '}{libre.toFixed(0)} kg libres de {capacidad.toFixed(0)} kg
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="error.main">
                                Sin disponibilidad (30 días)
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      )
                    })}
                    {repartidoresDisponibles.length > visibleRepartidores && (
                      <Box sx={{ pt: 2, textAlign: 'center' }}>
                        <Button variant="text" size="small" onClick={() => setVisibleRepartidores((current) => current + 8)}>
                          Ver más
                        </Button>
                      </Box>
                    )}
                    {repartidoresDisponibles.length > 8 && visibleRepartidores >= repartidoresDisponibles.length && (
                      <Box sx={{ pt: 2, textAlign: 'center' }}>
                        <Button variant="text" size="small" onClick={() => setVisibleRepartidores(8)}>
                          Ver menos
                        </Button>
                      </Box>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}


      {/* G1L-147: Reagendamiento de envíos no entregados */}
      {pendientesReagendamiento.length > 0 && (
        <Card variant="outlined" sx={{ mt: 3, borderLeft: '4px solid #e65100' }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1, color: '#e65100' }}>
              Envíos pendientes de reagendamiento ({pendientesReagendamiento.length})
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Estos envíos están en tránsito o demorados. Podés liberarlos para que vuelvan a la cola de calendarización.
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Fecha calendarizada</TableCell>
                  <TableCell align="right">Peso</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {pendientesReagendamiento.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{p.codigoSeguimiento}</TableCell>
                    <TableCell>
                      <Chip size="small" label={p.status} sx={{ fontSize: 11 }} color={p.status === 'Demorado' ? 'warning' : 'default'} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>
                      {p.fechaCalendarizada ? formatDateOnlyEs(p.fechaCalendarizada.slice(0, 10), { day: '2-digit', month: 'short' }) : '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: 12 }}>{p.peso.toFixed(0)} kg</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        disabled={reagendandoId === p.id}
                        onClick={async () => {
                          setReagendandoId(p.id)
                          const result = await calendarizacionService.reagendar(p.id)
                          setReagendandoId(null)
                          if (result.success) {
                            setPendientesReagendamiento((prev) => prev.filter((x) => x.id !== p.id))
                            setPendientes((prev) => [...prev, { id: p.id, codigoSeguimiento: p.codigoSeguimiento } as any])
                          }
                        }}
                        sx={{ textTransform: 'none', fontSize: 12 }}
                      >
                        {reagendandoId === p.id ? <CircularProgress size={16} /> : 'Reagendar'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* G1L-150: Dialog de vista previa */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <PreviewIcon color="primary" />
              <span>Vista Previa — Calendarización estimada</span>
            </Stack>
            {overrides.size > 0 && (
              <Chip
                size="small"
                label={`${overrides.size} ajuste${overrides.size !== 1 ? 's' : ''} manual${overrides.size !== 1 ? 'es' : ''}`}
                color="secondary"
                sx={{ fontWeight: 700 }}
              />
            )}
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {previewResultado && (() => {
            // Agrupar por repartidor (a lo largo de todos los días)
            const porRepartidor = new Map<string, {
              repartidorId: string
              nombre: string
              email: string
              tipoJornada: string
              dias: Array<{ fecha: string; cantidad: number; pesoTotal: number; capacidadKg: number; paquetes: NonNullable<(typeof previewResultado.resumenPorDia)[0]['repartidores'][0]['paquetes']> }>
            }>()
            previewResultado.resumenPorDia.forEach((dia) => {
              dia.repartidores.forEach((rep) => {
                if (!porRepartidor.has(rep.repartidorId)) {
                  porRepartidor.set(rep.repartidorId, {
                    repartidorId: rep.repartidorId,
                    nombre: rep.nombre,
                    email: rep.email,
                    tipoJornada: rep.tipoJornada ?? 'Full Time',
                    dias: [],
                  })
                }
                porRepartidor.get(rep.repartidorId)!.dias.push({
                  fecha: dia.fecha,
                  cantidad: rep.cantidad,
                  pesoTotal: rep.pesoTotal,
                  capacidadKg: rep.capacidadKg ?? 500,
                  paquetes: rep.paquetes ?? [],
                })
              })
            })
            const repsArray = Array.from(porRepartidor.values())
            const diasInvolucrados = previewResultado.resumenPorDia.length

            return (
              <>
                {/* Resumen de 6 métricas */}
                <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
                  {[
                    { label: 'Envíos a asignar', value: previewResultado.totalCalendarizados, color: 'primary.main' },
                    { label: 'Repartidores afectados', value: repsArray.length, color: 'primary.main' },
                    { label: 'Días involucrados', value: diasInvolucrados, color: 'primary.main' },
                    { label: 'Envíos Full Time', value: previewResultado.totalFullTime ?? 0, color: 'success.main' },
                    { label: 'Envíos Part Time', value: previewResultado.totalPartTime ?? 0, color: 'info.main' },
                    {
                      label: 'Sin asignar',
                      value: previewResultado.totalSinAsignar,
                      color: previewResultado.totalSinAsignar > 0 ? 'warning.main' : 'text.secondary',
                    },
                  ].map(({ label, value, color }) => (
                    <Grid item xs={6} sm={4} key={label}>
                      <Box
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          textAlign: 'center',
                          bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5',
                          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0',
                        }}
                      >
                        <Typography variant="h5" fontWeight={800} sx={{ color, lineHeight: 1 }}>{value}</Typography>
                        <Typography variant="caption" color="text.secondary">{label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                {/* Aviso sin asignar */}
                {previewResultado.paquetesSinAsignar && previewResultado.paquetesSinAsignar.length > 0 && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    {previewResultado.totalSinAsignar} envío{previewResultado.totalSinAsignar !== 1 ? 's' : ''} no pueden asignarse
                    {' '}({((previewResultado.totalSinAsignar / previewResultado.totalPendientes) * 100).toFixed(1)}% del total).
                    {' '}Verificá la capacidad de los repartidores o reagendá envíos demorados.
                  </Alert>
                )}

                {/* Secciones expandibles por repartidor */}
                {repsArray.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                      Distribución por repartidor
                    </Typography>
                    {repsArray.map((rep, idx) => {
                      const totalEnvios = rep.dias.reduce((acc, d) => acc + d.cantidad, 0)
                      const totalPeso = rep.dias.reduce((acc, d) => acc + d.pesoTotal, 0)
                      const initials = rep.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                      const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                      return (
                        <Accordion
                          key={rep.repartidorId}
                          disableGutters
                          elevation={0}
                          sx={{
                            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0',
                            borderRadius: '8px !important',
                            mb: 1,
                            '&:before': { display: 'none' },
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2, py: 0.5 }}>
                            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', mr: 1 }}>
                              <Avatar sx={{ bgcolor: color, width: 30, height: 30, fontSize: 11 }}>{initials}</Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={700} noWrap>{rep.nombre}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>{rep.email}</Typography>
                              </Box>
                              <Stack direction="row" spacing={1} alignItems="center" flexShrink={0}>
                                <Chip
                                  size="small"
                                  label={rep.tipoJornada}
                                  color={rep.tipoJornada === 'Part Time' ? 'info' : 'success'}
                                  variant="outlined"
                                  sx={{ fontSize: 10 }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {rep.dias.length} día{rep.dias.length !== 1 ? 's' : ''} · {totalEnvios} envío{totalEnvios !== 1 ? 's' : ''} · {totalPeso.toFixed(0)} kg
                                </Typography>
                              </Stack>
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails sx={{ px: 2, pt: 0, pb: 1.5 }}>
                            {rep.dias.map((dia) => (
                              <Box key={dia.fecha} sx={{ mb: 1.5 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                                  <Typography variant="caption" fontWeight={700} color="primary">
                                    {formatDateOnlyEs(dia.fecha, { weekday: 'long', day: '2-digit', month: 'short' })}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {dia.pesoTotal.toFixed(0)} / {dia.capacidadKg.toFixed(0)} kg
                                  </Typography>
                                </Stack>
                                {dia.paquetes.length > 0 ? (
                                  <Table size="small" sx={{ '& td, & th': { py: 0.4, fontSize: 11 } }}>
                                    <TableHead>
                                      <TableRow>
                                        <TableCell>Código</TableCell>
                                        <TableCell>CP destino</TableCell>
                                        <TableCell align="right">Peso</TableCell>
                                        <TableCell align="right">Tipo</TableCell>
                                        <TableCell align="right" sx={{ width: 90 }}>Ajuste</TableCell>
                                      </TableRow>
                                    </TableHead>
                                    <TableBody>
                                      {dia.paquetes.map((p) => {
                                        const ov = overrides.get(p.paqueteId)
                                        return (
                                          <TableRow key={p.paqueteId} sx={ov ? { bgcolor: isDark ? 'rgba(156,39,176,0.12)' : '#f3e5f5' } : undefined}>
                                            <TableCell sx={{ fontFamily: 'monospace' }}>{p.codigoSeguimiento}</TableCell>
                                            <TableCell>{p.cpDestino}</TableCell>
                                            <TableCell align="right">{p.peso.toFixed(0)} kg</TableCell>
                                            <TableCell align="right">
                                              {p.esPrioritario
                                                ? <Chip size="small" label="Prioritario" color="error" sx={{ fontSize: 9, height: 18 }} />
                                                : <Typography variant="caption" color="text.secondary">Común</Typography>}
                                            </TableCell>
                                            <TableCell align="right">
                                              {ov ? (
                                                <Tooltip title={`→ ${ov.repartidorNombre} · ${ov.fecha} · Click para editar`}>
                                                  <Chip
                                                    size="small"
                                                    label="Ajustado"
                                                    color="secondary"
                                                    variant="outlined"
                                                    onClick={() => openReassign(p, dia.fecha)}
                                                    onDelete={() => removeOverride(p.paqueteId)}
                                                    sx={{ fontSize: 9, height: 18, cursor: 'pointer' }}
                                                  />
                                                </Tooltip>
                                              ) : (
                                                <Tooltip title="Reasignar a otro repartidor">
                                                  <IconButton size="small" onClick={() => openReassign(p, dia.fecha)} sx={{ p: 0.25 }}>
                                                    <SwapHorizIcon sx={{ fontSize: 14 }} />
                                                  </IconButton>
                                                </Tooltip>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                        )
                                      })}
                                    </TableBody>
                                  </Table>
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    {dia.cantidad} envío{dia.cantidad !== 1 ? 's' : ''} asignados
                                  </Typography>
                                )}
                              </Box>
                            ))}
                          </AccordionDetails>
                        </Accordion>
                      )
                    })}
                  </Box>
                )}

                {/* Sin asignar detalle */}
                {previewResultado.paquetesSinAsignar && previewResultado.paquetesSinAsignar.length > 0 && (
                  <Accordion
                    disableGutters
                    elevation={0}
                    sx={{
                      border: '1px solid',
                      borderColor: 'warning.main',
                      borderRadius: '8px !important',
                      mt: 1,
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2 }}>
                      <Typography variant="body2" fontWeight={700} color="warning.main">
                        Sin asignar ({previewResultado.totalSinAsignar})
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ px: 2, pb: 1.5 }}>
                      {Object.entries(
                        previewResultado.paquetesSinAsignar.reduce<Record<string, typeof previewResultado.paquetesSinAsignar>>((acc, p) => {
                          acc[p.motivo] = [...(acc[p.motivo] ?? []), p]
                          return acc
                        }, {})
                      ).map(([motivo, items]) => (
                        <Box key={motivo} sx={{ mb: 1 }}>
                          <Typography variant="caption" fontWeight={700} color="warning.main" display="block">{motivo} ({items.length})</Typography>
                          <Stack spacing={0.3}>
                            {items.map((p) => (
                              <Typography key={p.codigoSeguimiento} variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                · {p.codigoSeguimiento} — {p.peso.toFixed(0)} kg
                              </Typography>
                            ))}
                          </Stack>
                        </Box>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  Esta es una estimación. Los resultados reales pueden variar si cambia el estado de los envíos o repartidores antes de confirmar.
                </Typography>
              </>
            )
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" startIcon={<BoltIcon />} onClick={ejecutar}>
            Confirmar y ejecutar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: reasignación manual de un paquete del preview */}
      <Dialog open={!!reassignDialog} onClose={() => setReassignDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <SwapHorizIcon color="secondary" fontSize="small" />
            <span>Reasignar manualmente</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Envío: <strong style={{ fontFamily: 'monospace' }}>{reassignDialog?.codigoSeguimiento}</strong>
          </Typography>
          <Stack spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Repartidor destino</InputLabel>
              <Select
                value={reassignDialog?.selectedRepartidorId ?? ''}
                label="Repartidor destino"
                onChange={(e) => setReassignDialog((prev) => prev ? { ...prev, selectedRepartidorId: e.target.value } : null)}
              >
                {repartidoresActivos.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.nombre} {r.apellido}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Fecha de entrega"
              type="date"
              value={reassignDialog?.selectedFecha ?? ''}
              onChange={(e) => setReassignDialog((prev) => prev ? { ...prev, selectedFecha: e.target.value } : null)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: new Date().toISOString().slice(0, 10) }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReassignDialog(null)}>Cancelar</Button>
          {reassignDialog && overrides.has(reassignDialog.paqueteId) && (
            <Button color="error" onClick={() => { removeOverride(reassignDialog.paqueteId); setReassignDialog(null) }}>
              Quitar ajuste
            </Button>
          )}
          <Button
            variant="contained"
            color="secondary"
            disabled={!reassignDialog?.selectedRepartidorId || !reassignDialog?.selectedFecha}
            onClick={confirmReassign}
          >
            Confirmar ajuste
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: proceso de calendarización */}
      <Dialog open={modalOpen} onClose={exec ? cerrarModal : undefined} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            {!exec ? (
              <CircularProgress size={18} />
            ) : exec.ok ? (
              <CheckCircleIcon color="success" />
            ) : (
              <ErrorOutlineIcon color="error" />
            )}
            <span>
              {!exec
                ? 'Calendarizando envíos...'
                : exec.ok
                  ? 'Calendarización completada'
                  : 'Error en la calendarización'}
            </span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {!exec ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              El sistema está procesando los {pendientes.length} envíos pendientes
            </Typography>
          ) : exec.ok && resultado ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {resultado.totalCalendarizados} envíos asignados exitosamente — pasaron a "Asignado a vehículo"
              {resultado.totalSinAsignar > 0 && ` · ${resultado.totalSinAsignar} sin asignar`}
            </Typography>
          ) : (
            <Alert severity="error">{exec.error}</Alert>
          )}

          <LinearProgress variant="determinate" value={progressPct} sx={{ height: 8, borderRadius: 1, my: 2 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 2 }}>
            {progressPct}% · {stepIdx === PROCESS_STEPS.length ? 'Calendarización completada' : PROCESS_STEPS[Math.min(stepIdx, PROCESS_STEPS.length - 1)]?.title}
          </Typography>

          <Stack spacing={1}>
            {PROCESS_STEPS.map((s, idx) => {
              const done = idx < stepIdx
              const active = idx === stepIdx && !exec
              return (
                <Stack
                  key={s.id}
                  direction="row"
                  spacing={1.5}
                  alignItems="center"
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: done
                      ? (isDark ? 'rgba(46,125,50,0.25)' : '#e8f5e9')
                      : active
                        ? (isDark ? 'rgba(25,118,210,0.25)' : '#e3f2fd')
                        : (isDark ? 'rgba(255,255,255,0.06)' : '#fafafa'),
                  }}
                >
                  {done ? (
                    <CheckCircleIcon sx={{ color: isDark ? '#81c784' : '#2e7d32' }} />
                  ) : active ? (
                    <CircularProgress size={20} />
                  ) : (
                    <RadioButtonUncheckedIcon sx={{ color: '#bbb' }} />
                  )}
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{s.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.detail}</Typography>
                  </Box>
                </Stack>
              )
            })}
          </Stack>

          {exec?.ok && resultado && resultado.paquetesSinAsignar && resultado.paquetesSinAsignar.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="warning" sx={{ mb: 1 }}>
                {resultado.totalSinAsignar} envío{resultado.totalSinAsignar > 1 ? 's' : ''} sin asignar
                {' '}({((resultado.totalSinAsignar / resultado.totalPendientes) * 100).toFixed(1)}% del total)
              </Alert>
              {Object.entries(
                resultado.paquetesSinAsignar.reduce<Record<string, typeof resultado.paquetesSinAsignar>>((acc, p) => {
                  acc[p.motivo] = [...(acc[p.motivo] ?? []), p]
                  return acc
                }, {})
              ).map(([motivo, items]) => (
                <Box key={motivo} sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={700} color="warning.main" display="block" sx={{ mb: 0.5 }}>
                    {motivo} ({items.length})
                  </Typography>
                  <Stack spacing={0.4}>
                    {items.map((p) => (
                      <Typography key={p.codigoSeguimiento} variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                        · {p.codigoSeguimiento} — {p.peso.toFixed(0)} kg
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Box>
          )}

          {exec?.ok && resultado && resultado.resumenPorDia.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                Calendarización completada · {resultado.totalCalendarizados} envíos asignados a {new Set(resultado.resumenPorDia.flatMap((d) => d.repartidores.map((r) => r.repartidorId))).size} repartidores
              </Alert>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Repartidor</TableCell>
                    <TableCell>Email (login)</TableCell>
                    <TableCell>Día</TableCell>
                    <TableCell align="right">Envíos</TableCell>
                    <TableCell align="right">Capacidad usada</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {resultado.resumenPorDia.flatMap((dia) =>
                    dia.repartidores.map((r) => (
                      <TableRow key={`${dia.fecha}-${r.repartidorId}`}>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ bgcolor: '#1976d2', width: 24, height: 24, fontSize: 11 }}>
                              {r.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                            </Avatar>
                            {r.nombre}
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.email}</TableCell>
                        <TableCell>{formatDateOnlyEs(dia.fecha, { weekday: 'short', day: '2-digit', month: 'short' })}</TableCell>
                        <TableCell align="right">{r.cantidad}</TableCell>
                        <TableCell align="right">{r.pesoTotal.toFixed(0)} / {(r.capacidadKg ?? 500).toFixed(0)} kg</TableCell>
                      </TableRow>
                    )),
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {exec && (
            <>
              <Button onClick={cerrarModal}>Cerrar</Button>
              {exec.ok && (
                <Button variant="contained" onClick={() => { cerrarModal(); navigate('/rutas-activas') }}>
                  Ver rutas activas
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}
