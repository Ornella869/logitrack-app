import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
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
  Grid,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PreviewIcon from '@mui/icons-material/Visibility'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import SearchIcon from '@mui/icons-material/Search'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { shipmentService, calendarizacionService, type CalendarizacionResultado, type DiaResumen, type CalendarioOperativo, type PaquetePendienteReagendamiento } from '../services/shipmentService'
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

  const handlePreview = async () => {
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
                    variant="outlined"
                    color="primary"
                    startIcon={previewing ? <CircularProgress size={18} /> : <PreviewIcon />}
                    onClick={handlePreview}
                    disabled={pendientes.length === 0 || repartidoresActivos.length === 0 || previewing}
                    sx={{ px: 4, py: 1.5, fontSize: 14, mr: 2 }}
                  >
                    {previewing ? 'Simulando...' : 'Vista Previa'}
                  </Button>
                  <Button
                    size="large"
                    variant="contained"
                    startIcon={<BoltIcon />}
                    onClick={ejecutar}
                    disabled={pendientes.length === 0 || repartidoresActivos.length === 0}
                    sx={{ px: 4, py: 1.5, fontSize: 14 }}
                  >
                    Ejecutar
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Usá "Vista Previa" para ver la distribución estimada antes de confirmar
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
          <Stack direction="row" spacing={1} alignItems="center">
            <PreviewIcon color="primary" /> <span>Vista Previa — Calendarización estimada</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {previewResultado && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Simulación completada · <strong>{previewResultado.totalCalendarizados}</strong> envíos serán asignados a {new Set(previewResultado.resumenPorDia.flatMap((d) => d.repartidores.map((r) => r.repartidorId))).size} repartidores
                {previewResultado.totalSinAsignar > 0 && ` · ${previewResultado.totalSinAsignar} sin asignar`}
              </Alert>

              {previewResultado.paquetesSinAsignar && previewResultado.paquetesSinAsignar.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Alert severity="warning" sx={{ mb: 1 }}>
                    {previewResultado.totalSinAsignar} envío{previewResultado.totalSinAsignar > 1 ? 's' : ''} no podrán asignarse
                    {' '}({((previewResultado.totalSinAsignar / previewResultado.totalPendientes) * 100).toFixed(1)}% del total)
                  </Alert>
                  {Object.entries(
                    previewResultado.paquetesSinAsignar.reduce<Record<string, typeof previewResultado.paquetesSinAsignar>>((acc, p) => {
                      acc[p.motivo] = [...(acc[p.motivo] ?? []), p]
                      return acc
                    }, {})
                  ).map(([motivo, items]) => (
                    <Box key={motivo} sx={{ mb: 1 }}>
                      <Typography variant="caption" fontWeight={700} color="warning.main" display="block">
                        {motivo} ({items.length})
                      </Typography>
                      <Stack spacing={0.3}>
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

              {previewResultado.resumenPorDia.length > 0 && (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Repartidor</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Día estimado</TableCell>
                      <TableCell align="right">Envíos</TableCell>
                      <TableCell align="right">Peso estimado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewResultado.resumenPorDia.flatMap((dia) =>
                      dia.repartidores.map((r) => (
                        <TableRow key={`${dia.fecha}-${r.repartidorId}`}>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar sx={{ bgcolor: '#7b1fa2', width: 24, height: 24, fontSize: 11 }}>
                                {r.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                              </Avatar>
                              {r.nombre}
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.email}</TableCell>
                          <TableCell>{formatDateOnlyEs(dia.fecha, { weekday: 'short', day: '2-digit', month: 'short' })}</TableCell>
                          <TableCell align="right">{r.cantidad}</TableCell>
                          <TableCell align="right">{r.pesoTotal.toFixed(0)} / 500 kg</TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              )}

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                Esta es una estimación. Los resultados reales pueden variar si cambia el estado de los envíos o repartidores antes de ejecutar.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Cancelar</Button>
          <Button variant="contained" color="primary" startIcon={<BoltIcon />} onClick={ejecutar}>
            Confirmar y ejecutar
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
