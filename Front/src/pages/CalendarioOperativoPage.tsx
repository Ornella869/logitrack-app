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
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import BoltIcon from '@mui/icons-material/Bolt'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import api from '../services/api'
import type { User } from '../types'

const AVATAR_COLORS = ['#1976d2', '#388e3c', '#7b1fa2', '#f57c00', '#c2185b', '#5e35b1', '#00838f']

type CalendarioPaquete = {
  paqueteId: string
  codigoSeguimiento: string
  cpDestino: string
  peso: number
  esPrioritario: boolean
  status: string
}

type CalendarioCelda = {
  repartidorId: string
  repartidorNombre: string
  fecha: string
  paquetes: CalendarioPaquete[]
  pesoTotal: number
}

type CalendarioRepartidor = {
  repartidorId: string
  nombre: string
  email: string
  celdas: CalendarioCelda[]
}

type CalendarioOperativo = {
  dias: string[]
  repartidores: CalendarioRepartidor[]
}

const DIAS_VISIBLES = 7

export default function CalendarioOperativoPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const [data, setData] = useState<CalendarioOperativo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageOffset, setPageOffset] = useState(0) // 0 = días 0-6, 1 = 7-13
  const [detalleCelda, setDetalleCelda] = useState<CalendarioCelda | null>(null)

  useEffect(() => {
    if (user.role !== 'supervisor' && user.role !== 'administrador') return
    void load()
  }, [user.role])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/calendarizacion/calendario', { params: { dias: 14 } })
      setData(response.data)
    } catch {
      setError('No se pudo cargar el calendario operativo')
    } finally {
      setLoading(false)
    }
  }

  const visible = useMemo(() => {
    if (!data) return null
    const start = pageOffset * DIAS_VISIBLES
    const end = start + DIAS_VISIBLES
    return {
      dias: data.dias.slice(start, end),
      repartidores: data.repartidores.map((r) => ({
        ...r,
        celdas: r.celdas.slice(start, end),
      })),
    }
  }, [data, pageOffset])

  if (user.role !== 'supervisor' && user.role !== 'administrador') {
    return <Alert severity="warning">Solo Supervisor o Administrador pueden ver el calendario operativo.</Alert>
  }

  const canCreateCalendarizacion = user.role === 'supervisor'

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <CalendarMonthIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Calendario Operativo
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vista de solo lectura — Envíos asignados por día y repartidor.
          </Typography>
        </Box>
        {canCreateCalendarizacion && (
          <Button variant="outlined" startIcon={<BoltIcon />} onClick={() => navigate('/calendarizar')}>
            Nueva Calendarización
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading || !visible ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : visible.repartidores.length === 0 ? (
        <Alert severity="info">No hay repartidores activos.</Alert>
      ) : (
        <Card variant="outlined" sx={{ overflow: 'hidden' }}>
          {/* Toolbar */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ p: 2, bgcolor: '#e3f2fd', borderBottom: '1px solid #ddd' }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" onClick={() => setPageOffset(0)} disabled={pageOffset === 0}>
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 240, textAlign: 'center' }}>
                {visible.dias.length > 0 && (
                  <>
                    {new Date(visible.dias[0]).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    {' — '}
                    {new Date(visible.dias[visible.dias.length - 1]).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </>
                )}
              </Typography>
              <IconButton size="small" onClick={() => setPageOffset(1)} disabled={pageOffset === 1}>
                <ChevronRightIcon />
              </IconButton>
            </Stack>
            <Button size="small" onClick={() => setPageOffset(0)}>Hoy</Button>
          </Stack>

          {/* Grilla */}
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: `200px repeat(${visible.dias.length}, minmax(140px, 1fr))`, minWidth: 900 }}>
              {/* Header de días */}
              <Box sx={{ p: 1.5, bgcolor: '#fafafa', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: 'text.secondary', borderBottom: '1px solid #ddd', borderRight: '1px solid #ddd' }}>
                Repartidor
              </Box>
              {visible.dias.map((d) => {
                const date = new Date(d)
                const isHoy = date.toDateString() === new Date().toDateString()
                return (
                  <Box
                    key={d}
                    sx={{
                      p: 1.5, bgcolor: isHoy ? '#e3f2fd' : '#fafafa',
                      fontWeight: 700, fontSize: 12, textTransform: 'capitalize',
                      color: isHoy ? '#1565c0' : 'text.secondary',
                      textAlign: 'center', borderBottom: '1px solid #ddd', borderRight: '1px solid #eee',
                    }}
                  >
                    {date.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit' })}
                  </Box>
                )
              })}

              {/* Filas por repartidor */}
              {visible.repartidores.map((rep, repIdx) => {
                const initials = rep.nombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                const color = AVATAR_COLORS[repIdx % AVATAR_COLORS.length]
                return (
                  <Box key={rep.repartidorId} sx={{ display: 'contents' }}>
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="center"
                      sx={{ p: 1.5, bgcolor: '#fafafa', borderRight: '1px solid #ddd', borderBottom: '1px solid #eee', minHeight: 90 }}
                    >
                      <Avatar sx={{ bgcolor: color, width: 32, height: 32, fontSize: 12 }}>{initials}</Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {rep.nombre}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 10 }}>
                          {rep.email}
                        </Typography>
                      </Box>
                    </Stack>

                    {rep.celdas.map((celda) => {
                      const pct = Math.min(100, (celda.pesoTotal / 500) * 100)
                      const colorBar = pct >= 90 ? '#c62828' : pct >= 70 ? '#ed6c02' : '#2e7d32'
                      const cps = Array.from(new Set(celda.paquetes.map((p) => p.cpDestino).filter(Boolean)))
                      return (
                        <Box
                          key={celda.fecha}
                          sx={{
                            p: 1, borderRight: '1px solid #eee', borderBottom: '1px solid #eee',
                            cursor: celda.paquetes.length ? 'pointer' : 'default',
                            '&:hover': celda.paquetes.length ? { bgcolor: '#f5f5f5' } : {},
                          }}
                          onClick={() => celda.paquetes.length && setDetalleCelda(celda)}
                        >
                          {celda.paquetes.length === 0 ? (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>—</Typography>
                          ) : (
                            <>
                              {cps.length > 0 && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, display: 'block' }}>
                                  CP {cps.slice(0, 3).join(', ')}
                                </Typography>
                              )}
                              <Stack spacing={0.4} sx={{ mt: 0.5 }}>
                                {celda.paquetes.slice(0, 3).map((p) => (
                                  <Tooltip key={p.paqueteId} title={`${p.codigoSeguimiento} · ${p.peso} kg · ${p.status}`}>
                                    <Box
                                      sx={{
                                        bgcolor: p.esPrioritario ? '#fdecea' : '#e1f5fe',
                                        borderLeft: `3px solid ${p.esPrioritario ? '#c62828' : '#0288d1'}`,
                                        borderRadius: 0.5, px: 0.5, py: 0.3,
                                        fontSize: 10, fontFamily: 'monospace',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {p.esPrioritario && '⚡ '}
                                      {p.codigoSeguimiento}
                                    </Box>
                                  </Tooltip>
                                ))}
                                {celda.paquetes.length > 3 && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontStyle: 'italic' }}>
                                    +{celda.paquetes.length - 3} más
                                  </Typography>
                                )}
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={pct}
                                sx={{ height: 4, borderRadius: 1, mt: 0.8, '& .MuiLinearProgress-bar': { bgcolor: colorBar } }}
                              />
                              <Typography variant="caption" sx={{ fontSize: 9, color: colorBar, fontWeight: 600, display: 'block', mt: 0.3 }}>
                                {celda.pesoTotal.toFixed(0)} / 500 kg
                              </Typography>
                            </>
                          )}
                        </Box>
                      )
                    })}
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Card>
      )}

      {/* Modal detalle de celda */}
      <Dialog open={Boolean(detalleCelda)} onClose={() => setDetalleCelda(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {detalleCelda && (
            <>
              {detalleCelda.repartidorNombre}
              <Typography variant="caption" display="block" color="text.secondary">
                {new Date(detalleCelda.fecha).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' })}
                {' · '}
                {detalleCelda.pesoTotal.toFixed(0)} / 500 kg
              </Typography>
            </>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {detalleCelda && (
            <Stack spacing={1}>
              {detalleCelda.paquetes.map((p) => (
                <Card
                  key={p.paqueteId}
                  variant="outlined"
                  sx={{ cursor: 'pointer' }}
                  onClick={() => { navigate(`/shipment/${p.paqueteId}`); setDetalleCelda(null) }}
                >
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                          {p.esPrioritario && (
                            <Chip
                              size="small"
                              label="⚡"
                              sx={{ bgcolor: '#fdecea', color: '#c62828', mr: 1, height: 18 }}
                            />
                          )}
                          {p.codigoSeguimiento}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          CP {p.cpDestino} · {p.peso} kg · {p.status}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}
