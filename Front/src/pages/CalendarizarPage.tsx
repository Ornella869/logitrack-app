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
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { shipmentService, calendarizacionService, type CalendarizacionResultado, type DiaResumen } from '../services/shipmentService'
import { authService } from '../services/authService'
import type { Shipment, User } from '../types'

const AVATAR_COLORS = ['#1976d2', '#388e3c', '#7b1fa2', '#f57c00', '#c2185b', '#5e35b1', '#00838f']

const PROCESS_STEPS = [
  { id: 1, title: 'Recolectar envíos pendientes', detail: 'Buscando envíos en estado "Pendiente de Calendarización"' },
  { id: 2, title: 'Ordenar por prioridad', detail: 'Prioritarios primero, luego Comunes (FIFO dentro de cada grupo)' },
  { id: 3, title: 'Agrupar por código postal', detail: 'Detectando zonas de destino' },
  { id: 4, title: 'Asignar a repartidores', detail: 'Buscando repartidores con capacidad disponible (≤500 kg)' },
  { id: 5, title: 'Persistir y registrar', detail: 'Guardando asignaciones y registrando historial' },
] as const

type Repartidor = { id: string; nombre: string; apellido: string; email: string; activo: boolean; estado?: string }

export default function CalendarizarPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const [pendientes, setPendientes] = useState<Shipment[]>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Modal de proceso
  const [modalOpen, setModalOpen] = useState(false)
  const [stepIdx, setStepIdx] = useState(0) // 0..5 (5 = done)
  const [resultado, setResultado] = useState<CalendarizacionResultado | null>(null)
  const [exec, setExec] = useState<{ ok: boolean; error?: string } | null>(null)

  // Estado actual de asignaciones (para testing y monitoreo)
  const [estadoActual, setEstadoActual] = useState<DiaResumen[]>([])

  useEffect(() => {
    if (user.role !== 'supervisor') return
    void loadAll()
  }, [user.role])

  const loadAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [pend, reps, estado] = await Promise.all([
        shipmentService.getPendingShipments(),
        authService.getRepartidores(),
        calendarizacionService.getEstadoActual(),
      ])
      setPendientes(pend)
      setEstadoActual(estado)
      setRepartidores(
        (reps as any[]).map((r) => ({
          id: r.id,
          nombre: r.name ?? r.nombre ?? '',
          apellido: r.lastname ?? r.apellido ?? '',
          email: r.email ?? '',
          activo: r.activo ?? true,
          estado: r.estado,
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

  const summary = useMemo(() => {
    const prio = pendientes.filter((p) => p.tipoEnvio === 'Prioritario').length
    const comm = pendientes.length - prio
    const peso = pendientes.reduce((acc, p) => acc + (p.weight ?? 0), 0)
    const cps = Array.from(new Set(pendientes.map((p) => p.receiver.postalCode).filter(Boolean)))
    const capacidad = repartidoresActivos.length * 500
    return { prio, comm, peso, cps, capacidad }
  }, [pendientes, repartidoresActivos])

  if (user.role !== 'supervisor') {
    return <Alert severity="warning">Solo el Supervisor puede acceder a esta pantalla.</Alert>
  }

  const ejecutar = async () => {
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
    setResultado(res.data ?? null)
    setExec({ ok: true })
    void loadAll()
  }

  const cerrarModal = () => {
    setModalOpen(false)
    setResultado(null)
    setExec(null)
    setStepIdx(0)
  }

  const progressPct = Math.round((stepIdx / PROCESS_STEPS.length) * 100)

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app')} size="small">
          Volver
        </Button>
      </Stack>
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
                          sx={{ bgcolor: '#fdecea', color: '#c62828', border: '1px solid #c62828', fontWeight: 600 }}
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
                      <TableCell>Capacidad total ({repartidoresActivos.length} × 500 kg)</TableCell>
                      <TableCell align="right">{summary.capacidad.toLocaleString('es-AR')} kg</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <Box sx={{ textAlign: 'center', mt: 3, pt: 3, borderTop: '1px solid #eee' }}>
                  <Button
                    size="large"
                    variant="contained"
                    startIcon={<BoltIcon />}
                    onClick={ejecutar}
                    disabled={pendientes.length === 0 || repartidoresActivos.length === 0}
                    sx={{ px: 4, py: 1.5, fontSize: 14 }}
                  >
                    Ejecutar Calendarización Automática
                  </Button>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                    Esta acción asignará repartidor y fecha a los {pendientes.length} envíos
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* DERECHA: Repartidores disponibles */}
          <Grid item xs={12} md={4}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Repartidores disponibles</Typography>
                {repartidoresActivos.length === 0 ? (
                  <Alert severity="warning">No hay repartidores activos en el sistema.</Alert>
                ) : (
                  <Stack divider={<Divider flexItem />}>
                    {repartidoresActivos.map((r, idx) => {
                      const initials = `${r.nombre[0] ?? ''}${r.apellido[0] ?? ''}`.toUpperCase()
                      const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                      return (
                        <Stack
                          key={r.id}
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ py: 1 }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center">
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
                              <Typography variant="caption" color="text.secondary">
                                Capacidad: 500 kg
                              </Typography>
                            </Box>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            0 / 500 kg
                          </Typography>
                        </Stack>
                      )
                    })}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* SECCIÓN: Asignaciones actuales (para monitoreo y testing) */}
      {!loading && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Asignaciones actuales
          </Typography>
          {estadoActual.length === 0 ? (
            <Alert severity="info">
              No hay envíos asignados a repartidores todavía. Ejecutá la calendarización para asignarlos.
            </Alert>
          ) : (
            <Card variant="outlined">
              <CardContent>
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
                    {estadoActual.flatMap((dia, di) =>
                      dia.repartidores.map((r, ri) => {
                        const initials = r.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                        const color = AVATAR_COLORS[(di + ri) % AVATAR_COLORS.length]
                        const pesoPct = Math.min(100, (r.pesoTotal / 500) * 100)
                        const pesoColor = pesoPct >= 90 ? '#c62828' : pesoPct >= 70 ? '#ed6c02' : '#2e7d32'
                        return (
                          <TableRow key={`${dia.fecha}-${r.repartidorId}`}>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Avatar sx={{ bgcolor: color, width: 28, height: 28, fontSize: 11 }}>{initials}</Avatar>
                                <Typography variant="body2" fontWeight={600}>{r.nombre}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{r.email}</TableCell>
                            <TableCell>
                              {new Date(dia.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </TableCell>
                            <TableCell align="right"><strong>{r.cantidad}</strong></TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 120 }}>
                                <Typography variant="caption" sx={{ color: pesoColor, fontWeight: 600 }}>
                                  {r.pesoTotal.toFixed(0)} / 500 kg
                                </Typography>
                                <LinearProgress
                                  variant="determinate"
                                  value={pesoPct}
                                  sx={{
                                    width: 100, height: 6, borderRadius: 1, mt: 0.5,
                                    '& .MuiLinearProgress-bar': { bgcolor: pesoColor },
                                  }}
                                />
                              </Box>
                            </TableCell>
                          </TableRow>
                        )
                      }),
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* MODAL: proceso de calendarización */}
      <Dialog open={modalOpen} onClose={exec ? cerrarModal : undefined} maxWidth="md" fullWidth>
        <DialogTitle>
          {!exec
            ? 'Calendarizando envíos...'
            : exec.ok
              ? '✅ Calendarización Completada'
              : '❌ Error en la calendarización'}
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
                    bgcolor: done ? '#e8f5e9' : active ? '#e3f2fd' : '#fafafa',
                  }}
                >
                  {done ? (
                    <CheckCircleIcon sx={{ color: '#2e7d32' }} />
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
                        <TableCell>{new Date(dia.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}</TableCell>
                        <TableCell align="right">{r.cantidad}</TableCell>
                        <TableCell align="right">{r.pesoTotal.toFixed(0)} / 500 kg</TableCell>
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
