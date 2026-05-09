import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
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
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import SearchIcon from '@mui/icons-material/Search'
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
type AsignacionActualRow = {
  key: string
  repartidorId: string
  nombre: string
  email: string
  fecha: string
  cantidad: number
  pesoTotal: number
}

export default function CalendarizarPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const [pendientes, setPendientes] = useState<Shipment[]>([])
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [repartidorSearch, setRepartidorSearch] = useState('')
  const [visibleRepartidores, setVisibleRepartidores] = useState(8)
  const [asignacionesPage, setAsignacionesPage] = useState(0)
  const [asignacionesRowsPerPage, setAsignacionesRowsPerPage] = useState(10)

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

  const asignacionesActuales = useMemo<AsignacionActualRow[]>(() => {
    return estadoActual.flatMap((dia) =>
      dia.repartidores.map((repartidor) => ({
        key: `${dia.fecha}-${repartidor.repartidorId}`,
        repartidorId: repartidor.repartidorId,
        nombre: repartidor.nombre,
        email: repartidor.email,
        fecha: dia.fecha,
        cantidad: repartidor.cantidad,
        pesoTotal: repartidor.pesoTotal,
      })),
    )
  }, [estadoActual])

  const asignacionesActualesPaginadas = useMemo(() => {
    const from = asignacionesPage * asignacionesRowsPerPage
    return asignacionesActuales.slice(from, from + asignacionesRowsPerPage)
  }, [asignacionesActuales, asignacionesPage, asignacionesRowsPerPage])

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

  const handleRepartidorSearchChange = (value: string) => {
    setRepartidorSearch(value)
    setVisibleRepartidores(8)
  }

  const handleAsignacionesPageChange = (_event: unknown, nextPage: number) => {
    setAsignacionesPage(nextPage)
  }

  const handleAsignacionesRowsPerPageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setAsignacionesRowsPerPage(Number(event.target.value))
    setAsignacionesPage(0)
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
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 2, gap: 1.5 }}>
                  <Box>
                    <Typography variant="h6">Repartidores disponibles</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ordenados por menor carga asignada.
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    placeholder="Buscar nombre o email..."
                    value={repartidorSearch}
                    onChange={(e) => handleRepartidorSearchChange(e.target.value)}
                    sx={{ minWidth: { xs: '100%', sm: 220 } }}
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
                      const carga = cargaActualPorRepartidor[r.id] ?? { cantidad: 0, pesoTotal: 0 }
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
                            {carga.pesoTotal.toFixed(0)} / 500 kg
                          </Typography>
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

      {/* SECCIÓN: Asignaciones actuales (para monitoreo y testing) */}
      {!loading && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Asignaciones actuales
          </Typography>
          {asignacionesActuales.length === 0 ? (
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
                    {asignacionesActualesPaginadas.map((asignacion, idx) => {
                        const initials = asignacion.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                        const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                        const pesoPct = Math.min(100, (asignacion.pesoTotal / 500) * 100)
                        const pesoColor = pesoPct >= 90 ? '#c62828' : pesoPct >= 70 ? '#ed6c02' : '#2e7d32'
                        return (
                          <TableRow key={asignacion.key}>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Avatar sx={{ bgcolor: color, width: 28, height: 28, fontSize: 11 }}>{initials}</Avatar>
                                <Typography variant="body2" fontWeight={600}>{asignacion.nombre}</Typography>
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{asignacion.email}</TableCell>
                            <TableCell>
                              {new Date(asignacion.fecha).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </TableCell>
                            <TableCell align="right"><strong>{asignacion.cantidad}</strong></TableCell>
                            <TableCell align="right">
                              <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 120 }}>
                                <Typography variant="caption" sx={{ color: pesoColor, fontWeight: 600 }}>
                                  {asignacion.pesoTotal.toFixed(0)} / 500 kg
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
                      })}
                  </TableBody>
                </Table>
              </CardContent>
              <TablePagination
                component="div"
                count={asignacionesActuales.length}
                page={asignacionesPage}
                onPageChange={handleAsignacionesPageChange}
                rowsPerPage={asignacionesRowsPerPage}
                onRowsPerPageChange={handleAsignacionesRowsPerPageChange}
                rowsPerPageOptions={[5, 10, 20]}
                labelRowsPerPage="Filas por página"
              />
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
