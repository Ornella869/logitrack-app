import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonIcon from '@mui/icons-material/Person'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import api from '../services/api'
import type { User } from '../types'

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
}

const today = () => new Date().toISOString().split('T')[0]
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0]

export default function PerfilRendimientoPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const { repartidorId } = useParams<{ repartidorId: string }>()
  const [from, setFrom] = useState<string>(daysAgo(30))
  const [to, setTo] = useState<string>(today())
  const [data, setData] = useState<Rendimiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!repartidorId) return
    if (user.role !== 'supervisor' && user.role !== 'administrador') return
    void load()
  }, [repartidorId, user.role, from, to])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get(`/repartidores/${repartidorId}/rendimiento`, { params: { from, to } })
      setData(r.data)
    } catch (e: any) {
      setError(e.response?.data ?? 'No se pudo cargar el rendimiento')
    } finally {
      setLoading(false)
    }
  }

  if (user.role !== 'supervisor' && user.role !== 'administrador') {
    return <Alert severity="warning">Solo Supervisor o Administrador.</Alert>
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} size="small">Volver</Button>
      </Stack>

      {data && (
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PersonIcon sx={{ color: 'white' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700}>{data.nombre}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{data.email}</Typography>
          </Box>
        </Stack>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">Período</Typography>
            <TextField type="date" size="small" label="Desde" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <TextField type="date" size="small" label="Hasta" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
            <Button size="small" onClick={load}>Aplicar</Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : !data ? null : !data.tieneActividad ? (
        <Alert severity="info">No hay datos operativos registrados para el período seleccionado.</Alert>
      ) : (
        <Grid container spacing={2}>
          <Kpi label="Total de Entregas" value={data.totalEntregas} sub={`de ${data.totalAsignados} asignados`} color="#2e7d32" icon={<CheckCircleIcon />} />
          <Kpi label="Efectividad On-Time" value={`${data.efectividadOnTimePct.toFixed(1)}%`} sub="entregadas en fecha" color="#1976d2" icon={<AccessTimeIcon />} progress={data.efectividadOnTimePct} progressColor={data.efectividadOnTimePct >= 80 ? '#2e7d32' : data.efectividadOnTimePct >= 60 ? '#ed6c02' : '#c62828'} />
          <Kpi label="Tasa de Incidencias" value={`${data.tasaIncidenciasPct.toFixed(1)}%`} sub={`${data.totalCancelaciones} canceladas`} color="#c62828" icon={<WarningAmberIcon />} progress={data.tasaIncidenciasPct} progressColor={data.tasaIncidenciasPct <= 10 ? '#2e7d32' : data.tasaIncidenciasPct <= 25 ? '#ed6c02' : '#c62828'} />
          <Kpi label="Total Asignados" value={data.totalAsignados} sub="en el período" color="#5e35b1" icon={<PersonIcon />} />
        </Grid>
      )}
    </Box>
  )
}

function Kpi({
  label, value, sub, color, icon, progress, progressColor,
}: { label: string; value: number | string; sub: string; color: string; icon: React.ReactNode; progress?: number; progressColor?: string }) {
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
        </CardContent>
      </Card>
    </Grid>
  )
}
