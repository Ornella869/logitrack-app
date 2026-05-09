import { useEffect, useState } from 'react'
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
  useTheme,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import RouteIcon from '@mui/icons-material/Route'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import RefreshIcon from '@mui/icons-material/Refresh'
import api from '../services/api'
import type { PagedResult, User } from '../types'

const AVATAR_COLORS = ['#1976d2', '#388e3c', '#7b1fa2', '#f57c00', '#c2185b', '#5e35b1', '#00838f']

type RutaActiva = {
  repartidorId: string
  repartidorNombre: string
  repartidorEmail: string
  fecha: string
  cpZona: string
  totalParadas: number
  entregadas: number
  canceladas: number
  pesoTotal: number
  estado: string
  esDemorada: boolean
}

type RutasActivasKpis = {
  enCurso: number
  completadas: number
  demoradas: number
  totalEntregadas: number
  totalParadas: number
  avancePct: number
  totalRutas: number
}

type RutasActivasResponse = PagedResult<RutaActiva> & {
  kpis: RutasActivasKpis
}

export default function RutasActivasPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [rutas, setRutas] = useState<RutaActiva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [totalItems, setTotalItems] = useState(0)
  const [kpis, setKpis] = useState<RutasActivasKpis>({
    enCurso: 0,
    completadas: 0,
    demoradas: 0,
    totalEntregadas: 0,
    totalParadas: 0,
    avancePct: 0,
    totalRutas: 0,
  })

  useEffect(() => {
    if (user.role !== 'supervisor' && user.role !== 'administrador') return
    void load()
  }, [user.role, page, rowsPerPage, search])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<RutasActivasResponse>('/rutas-activas', {
        params: {
          page: page + 1,
          pageSize: rowsPerPage,
          search: search.trim() || undefined,
        },
      })
      setRutas(response.data?.items ?? [])
      setTotalItems(response.data?.totalItems ?? 0)
      setKpis(response.data?.kpis ?? {
        enCurso: 0,
        completadas: 0,
        demoradas: 0,
        totalEntregadas: 0,
        totalParadas: 0,
        avancePct: 0,
        totalRutas: 0,
      })
    } catch {
      setError('No se pudieron cargar las rutas activas')
    } finally {
      setLoading(false)
    }
  }

  if (user.role !== 'supervisor' && user.role !== 'administrador') {
    return <Alert severity="warning">Solo Supervisor o Administrador pueden ver rutas activas.</Alert>
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <RouteIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Rutas Activas
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Rutas calendarizadas para hoy y los próximos días — monitoreo en tiempo real.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Buscar repartidor o CP..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(0)
            }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ width: 220 }}
            />
          <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Kpi label="Rutas en curso" value={kpis.enCurso} sub={`de ${kpis.totalRutas} asignadas`} color="#2e7d32" icon={<LocalShippingIcon />} />
        <Kpi label="Paradas completadas" value={kpis.totalEntregadas} sub={`de ${kpis.totalParadas} totales`} color="#1976d2" icon={<CheckCircleIcon />} />
        <Kpi label="Rutas demoradas" value={kpis.demoradas} sub="< 50% pasado mediodía" color="#ed6c02" icon={<WarningAmberIcon />} />
        <Kpi label="Avance global" value={`${kpis.avancePct}%`} sub={`${kpis.totalEntregadas}/${kpis.totalParadas} paradas`} color="#5e35b1" icon={<CheckCircleIcon />} />
      </Grid>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : totalItems === 0 ? (
        <Alert severity="info">
          {search.trim()
            ? `No hay rutas que coincidan con "${search}".`
            : 'No hay rutas asignadas para hoy. Probá ejecutar la calendarización si hay envíos pendientes.'}
        </Alert>
      ) : (
        <Card variant="outlined">
          <Box sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? '#1B2D42' : '#e3f2fd' }}>
                <TableCell>Fecha</TableCell>
                <TableCell>Repartidor</TableCell>
                <TableCell>CP / Zona</TableCell>
                <TableCell>Capacidad</TableCell>
                <TableCell>Progreso</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rutas.map((r, idx) => {
                const initials = r.repartidorNombre.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                const color = AVATAR_COLORS[idx % AVATAR_COLORS.length]
                const completas = r.entregadas + r.canceladas
                const pct = r.totalParadas > 0 ? Math.round((completas / r.totalParadas) * 100) : 0
                const fecha = new Date(r.fecha)
                const hoyStr = new Date().toDateString()
                const esHoy = fecha.toDateString() === hoyStr
                const fechaIso = fecha.toISOString().split('T')[0]
                return (
                  <TableRow key={`${r.repartidorId}-${fechaIso}`} sx={r.esDemorada ? { bgcolor: isDark ? 'rgba(237,108,2,0.1)' : '#fff8f0' } : {}}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ textTransform: 'capitalize' }}>
                        {esHoy ? 'Hoy' : fecha.toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      </Typography>
                      {!esHoy && (
                        <Typography variant="caption" color="text.secondary">
                          {fecha.toLocaleDateString('es-AR')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ bgcolor: color, width: 32, height: 32, fontSize: 12 }}>{initials}</Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{r.repartidorNombre}</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 10 }}>{r.repartidorEmail}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.cpZona}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.pesoTotal.toFixed(0)} / 500 kg</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            width: 120, height: 8, borderRadius: 1,
                            '& .MuiLinearProgress-bar': { bgcolor: r.esDemorada ? '#ed6c02' : '#2e7d32' },
                          }}
                        />
                        <Typography variant="body2" fontWeight={600} sx={{ color: r.esDemorada ? '#ed6c02' : 'inherit' }}>
                          {completas}/{r.totalParadas}{r.esDemorada ? ' ⚠️' : ''}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {r.esDemorada ? (
                        <Chip size="small" label="⚠️ Demorada" sx={{ bgcolor: isDark ? 'rgba(237,108,2,0.2)' : '#fff3e0', color: '#ed6c02', border: '1px solid #ed6c02' }} />
                      ) : r.estado === 'Completada' ? (
                        <Chip size="small" label="Completada" sx={{ bgcolor: isDark ? 'rgba(46,125,50,0.2)' : '#e8f5e9', color: isDark ? '#81c784' : '#2e7d32' }} />
                      ) : r.estado === 'EnTransito' ? (
                        <Chip size="small" label="En Tránsito" sx={{ bgcolor: isDark ? 'rgba(237,108,2,0.2)' : '#fff3e0', color: '#ed6c02' }} />
                      ) : r.estado === 'Programada' ? (
                        <Chip size="small" label="Programada" sx={{ bgcolor: isDark ? 'rgba(94,53,177,0.2)' : '#ede7f6', color: isDark ? '#ce93d8' : '#5e35b1' }} />
                      ) : (
                        <Chip size="small" label="Listo para Salir" sx={{ bgcolor: isDark ? 'rgba(2,136,209,0.2)' : '#e1f5fe', color: isDark ? '#81d4fa' : '#0288d1' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate(`/rutas-activas/${r.repartidorId}?fecha=${fechaIso}`)}
                      >
                        Ver detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </Box>
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value))
              setPage(0)
            }}
            rowsPerPageOptions={[5, 10, 20]}
            labelRowsPerPage="Rutas por página"
          />
        </Card>
      )}

      {kpis.demoradas > 0 && (
        <Alert severity="warning" sx={{ mt: 3 }}>
          Hay {kpis.demoradas} ruta{kpis.demoradas > 1 ? 's' : ''} marcada{kpis.demoradas > 1 ? 's' : ''} como demorada{kpis.demoradas > 1 ? 's' : ''} (menos del 50% completado pasado el mediodía).
        </Alert>
      )}
    </Box>
  )
}

function Kpi({
  label, value, sub, color, icon,
}: { label: string; value: number | string; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color, mb: 0.5 }}>
            {icon}
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              {label}
            </Typography>
          </Stack>
          <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.1 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary">{sub}</Typography>
        </CardContent>
      </Card>
    </Grid>
  )
}
