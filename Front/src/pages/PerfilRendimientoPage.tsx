import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PersonIcon from '@mui/icons-material/Person'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import api from '../services/api'
import { authService } from '../services/authService'
import type { User } from '../types'
import { addArgentinaDays, dateOnlyForDisplay, formatArgentinaDateInput, formatDateOnlyEs } from '../utils/argentinaDate'

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
  horasTrabajo: number
  tipoJornada: string
  fotoPerfil?: string | null
}

const today = () => formatArgentinaDateInput()
const daysAgo = (n: number) => addArgentinaDays(-n)
const startOfMonth = () => {
  const d = dateOnlyForDisplay(today())
  d.setDate(1)
  return formatArgentinaDateInput(d)
}

const PRESETS = [
  { label: 'Última semana', from: () => daysAgo(7), to: today },
  { label: 'Mes actual', from: startOfMonth, to: today },
  { label: 'Últimos 30 días', from: () => daysAgo(30), to: today },
] as const

/** Devuelve el período anterior de igual duración */
function prevPeriod(from: string, to: string) {
  const msFrom = dateOnlyForDisplay(from).getTime()
  const msTo = dateOnlyForDisplay(to).getTime()
  const duration = msTo - msFrom
  const prevTo = formatArgentinaDateInput(new Date(msFrom - 86400000))
  const prevFrom = formatArgentinaDateInput(new Date(msFrom - 86400000 - duration))
  return { from: prevFrom, to: prevTo }
}

export default function PerfilRendimientoPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const { repartidorId } = useParams<{ repartidorId: string }>()
  const [from, setFrom] = useState<string>(daysAgo(30))
  const [to, setTo] = useState<string>(today())
  const [dateError, setDateError] = useState('')
  const [data, setData] = useState<Rendimiento | null>(null)
  const [prevData, setPrevData] = useState<Rendimiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [horasInput, setHorasInput] = useState<string>('')
  const [savingHoras, setSavingHoras] = useState(false)
  const [horasError, setHorasError] = useState('')
  const [horasSuccess, setHorasSuccess] = useState('')

  useEffect(() => {
    if (!repartidorId) return
    if (user.role !== 'supervisor' && user.role !== 'administrador') return
    void load()
  }, [repartidorId, user.role])

  const validate = (f: string, t: string): boolean => {
    if (t < f) { setDateError('La fecha fin no puede ser anterior a la fecha inicio.'); return false }
    if (t > today()) { setDateError('La fecha fin no puede ser una fecha futura.'); return false }
    setDateError('')
    return true
  }

  const load = async (overrideFrom?: string, overrideTo?: string) => {
    const f = overrideFrom ?? from
    const t = overrideTo ?? to
    if (!validate(f, t)) return
    if (!repartidorId) return
    setLoading(true)
    setError('')
    try {
      const prev = prevPeriod(f, t)
      const [res, prevRes] = await Promise.all([
        api.get(`/repartidores/${repartidorId}/rendimiento`, { params: { from: f, to: t } }),
        api.get(`/repartidores/${repartidorId}/rendimiento`, { params: { from: prev.from, to: prev.to } }).catch(() => null),
      ])
      setData(res.data)
      setPrevData(prevRes?.data ?? null)
      if (horasInput === '') setHorasInput(String(res.data?.horasTrabajo ?? 8))
    } catch (e: any) {
      setError(e.response?.data ?? 'No se pudo cargar el rendimiento')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHoras = async () => {
    const horas = parseInt(horasInput, 10)
    if (isNaN(horas) || horas < 1 || horas > 24) {
      setHorasError('Ingresá un valor entre 1 y 24.')
      return
    }
    if (!repartidorId) return
    setSavingHoras(true)
    setHorasError('')
    setHorasSuccess('')
    const result = await authService.updateRepartidorHorasTrabajo(repartidorId, horas)
    setSavingHoras(false)
    if (!result) {
      setHorasError('No se pudo actualizar. Intentá de nuevo.')
    } else {
      setData((prev) => prev ? { ...prev, horasTrabajo: result.horasTrabajo ?? horas, tipoJornada: result.tipoJornada ?? (horas <= 6 ? 'Part Time' : 'Full Time') } : prev)
      setHorasSuccess('Jornada actualizada correctamente.')
    }
  }

  const applyPreset = (preset: typeof PRESETS[number]) => {
    const f = preset.from()
    const t = preset.to()
    setFrom(f)
    setTo(t)
    void load(f, t)
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
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ position: 'relative' }}>
              {data.fotoPerfil ? (
                <Box
                  component="img"
                  src={data.fotoPerfil}
                  sx={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
                />
              ) : (
                <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
              )}
            </Box>
            <Box>
              <Typography variant="h4" fontWeight={700}>{data.nombre}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{data.email}</Typography>
            </Box>
          </Stack>

          {/* Jornada editable por Supervisor */}
          {(user.role === 'supervisor' || user.role === 'administrador') && (
            <Card variant="outlined">
              <CardContent sx={{ pb: '12px !important' }}>
                <Typography variant="subtitle2" gutterBottom>Jornada laboral</Typography>
                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Chip
                    label={data.tipoJornada ?? 'Full Time'}
                    size="small"
                    sx={{
                      bgcolor: data.tipoJornada === 'Part Time' ? '#fff3e0' : '#e3f2fd',
                      color: data.tipoJornada === 'Part Time' ? '#e65100' : '#1565c0',
                      fontWeight: 700,
                    }}
                  />
                  <TextField
                    size="small"
                    label="Horas de trabajo / día"
                    type="number"
                    value={horasInput}
                    onChange={(e) => { setHorasInput(e.target.value); setHorasError(''); setHorasSuccess('') }}
                    inputProps={{ min: 1, max: 24, style: { width: 70 } }}
                    sx={{ maxWidth: 160 }}
                  />
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void handleSaveHoras()}
                    disabled={savingHoras}
                  >
                    {savingHoras ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  ≤ 6 h = Part Time · ≥ 7 h = Full Time. Los Part Time solo reciben envíos de hasta 6 h de ruta.
                </Typography>
                {horasError && <Alert severity="error" sx={{ mt: 1, py: 0 }}>{horasError}</Alert>}
                {horasSuccess && <Alert severity="success" sx={{ mt: 1, py: 0 }}>{horasSuccess}</Alert>}
              </CardContent>
            </Card>
          )}
        </Stack>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            {/* Presets */}
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, mr: 0.5 }}>Período rápido:</Typography>
              <ButtonGroup size="small" variant="outlined">
                {PRESETS.map((p) => (
                  <Button key={p.label} onClick={() => applyPreset(p)} sx={{ textTransform: 'none', fontSize: '0.75rem' }}>
                    {p.label}
                  </Button>
                ))}
              </ButtonGroup>
            </Stack>

            {/* Custom range */}
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Typography variant="subtitle2">Rango personalizado</Typography>
              <TextField
                type="date"
                size="small"
                label="Desde"
                InputLabelProps={{ shrink: true }}
                value={from}
                inputProps={{ max: today() }}
                onChange={(e) => { setFrom(e.target.value); setDateError('') }}
              />
              <TextField
                type="date"
                size="small"
                label="Hasta"
                InputLabelProps={{ shrink: true }}
                value={to}
                inputProps={{ max: today() }}
                onChange={(e) => { setTo(e.target.value); setDateError('') }}
              />
              <Button size="small" variant="contained" onClick={() => void load()}>Aplicar</Button>
            </Stack>

            {dateError && <Alert severity="error" sx={{ py: 0 }}>{dateError}</Alert>}

            {prevData && (
              <Typography variant="caption" color="text.secondary">
                Comparando con período anterior: {prevData.from} → {prevData.to}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : !data ? null : !data.tieneActividad ? (
        <Alert severity="info">No hay datos operativos registrados para el período seleccionado.</Alert>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Kpi
              label="Total de Entregas"
              value={data.totalEntregas}
              sub={`de ${data.totalAsignados} asignados`}
              color="#2e7d32"
              icon={<CheckCircleIcon />}
              compareValue={data.totalEntregas}
              comparePrev={prevData ? prevData.totalEntregas : undefined}
              higherIsBetter
            />
            <Kpi
              label="Efectividad On-Time"
              value={`${data.efectividadOnTimePct.toFixed(1)}%`}
              sub="entregadas en fecha"
              color="#1976d2"
              icon={<AccessTimeIcon />}
              progress={data.efectividadOnTimePct}
              progressColor={data.efectividadOnTimePct >= 80 ? '#2e7d32' : data.efectividadOnTimePct >= 60 ? '#ed6c02' : '#c62828'}
              compareValue={data.efectividadOnTimePct}
              comparePrev={prevData ? prevData.efectividadOnTimePct : undefined}
              higherIsBetter
            />
            <Kpi
              label="Tasa de Incidencias"
              value={`${data.tasaIncidenciasPct.toFixed(1)}%`}
              sub={`${data.totalCancelaciones} canceladas`}
              color="#c62828"
              icon={<WarningAmberIcon />}
              progress={data.tasaIncidenciasPct}
              progressColor={data.tasaIncidenciasPct <= 10 ? '#2e7d32' : data.tasaIncidenciasPct <= 25 ? '#ed6c02' : '#c62828'}
              compareValue={data.tasaIncidenciasPct}
              comparePrev={prevData ? prevData.tasaIncidenciasPct : undefined}
              higherIsBetter={false}
            />
            <Kpi
              label="Total Asignados"
              value={data.totalAsignados}
              sub="en el período"
              color="#5e35b1"
              icon={<PersonIcon />}
              compareValue={data.totalAsignados}
              comparePrev={prevData ? prevData.totalAsignados : undefined}
              higherIsBetter
            />
          </Grid>

          {prevData && (
            <ComparisonChart data={data} prevData={prevData} from={from} to={to} />
          )}
        </>
      )}
    </Box>
  )
}

// ─── Comparison bar chart ────────────────────────────────────────────────────

interface ComparisonChartProps {
  data: Rendimiento
  prevData: Rendimiento
  from: string
  to: string
}

const BAR_MAX_H = 100

function ComparisonBar({
  label,
  current,
  prev,
  color,
  maxVal,
  isPercent = false,
  higherIsBetter = true,
}: {
  label: string
  current: number
  prev: number
  color: string
  maxVal: number
  isPercent?: boolean
  higherIsBetter?: boolean
}) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const safe = maxVal > 0 ? maxVal : 1
  const currentH = Math.max(4, (current / safe) * BAR_MAX_H)
  const prevH = Math.max(4, (prev / safe) * BAR_MAX_H)
  const improved = higherIsBetter ? current >= prev : current <= prev
  const fmt = (v: number) => (isPercent ? `${v.toFixed(1)}%` : String(v))

  return (
    <Box sx={{ flex: 1, minWidth: 120, textAlign: 'center' }}>
      <Typography variant="caption" fontWeight={600} color="text.secondary" display="block" sx={{ mb: 1.5, fontSize: '0.7rem', minHeight: 18 }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '8px', minHeight: BAR_MAX_H + 34 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <Typography variant="caption" fontWeight={700} sx={{ color, fontSize: '0.65rem' }}>{fmt(current)}</Typography>
          <Box sx={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end' }}>
            <Box sx={{ width: 26, height: `${currentH}px`, bgcolor: color, borderRadius: '4px 4px 0 0', transformOrigin: 'bottom center', animation: 'barRise 0.6s ease both', '@keyframes barRise': { from: { transform: 'scaleY(0)', opacity: 0 }, to: { transform: 'scaleY(1)', opacity: 1 } } }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>Actual</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{fmt(prev)}</Typography>
          <Box sx={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end' }}>
            <Box sx={{ width: 26, height: `${prevH}px`, bgcolor: isDark ? 'rgba(255,255,255,0.18)' : '#bdbdbd', borderRadius: '4px 4px 0 0', transformOrigin: 'bottom center', animation: 'barRise 0.6s ease 0.1s both', '@keyframes barRise': { from: { transform: 'scaleY(0)', opacity: 0 }, to: { transform: 'scaleY(1)', opacity: 1 } } }} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>Anterior</Typography>
        </Box>
      </Box>
      <Box sx={{ mt: 0.5 }}>
        <Chip
          size="small"
          label={improved ? '↑ Mejor' : '↓ Bajó'}
          sx={{
            height: 18,
            fontSize: '0.62rem',
            bgcolor: improved
              ? (isDark ? 'rgba(46,125,50,0.3)' : '#e8f5e9')
              : (isDark ? 'rgba(198,40,40,0.3)' : '#ffebee'),
            color: improved ? '#2e7d32' : '#c62828',
          }}
        />
      </Box>
    </Box>
  )
}

function ComparisonChart({ data, prevData, from, to }: ComparisonChartProps) {
  const { from: prevFrom, to: prevTo } = prevPeriod(from, to)
  const maxEntregas = Math.max(data.totalEntregas, prevData.totalEntregas) * 1.15 || 1

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            Comparativa con Período anterior
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Anterior: {formatDateOnlyEs(prevFrom, { day: '2-digit', month: 'short' })} — {formatDateOnlyEs(prevTo, { day: '2-digit', month: 'short' })}
          </Typography>
        </Stack>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-around', flexWrap: 'wrap' }}>
          <ComparisonBar
            label="Entregas totales"
            current={data.totalEntregas}
            prev={prevData.totalEntregas}
            color="#2e7d32"
            maxVal={maxEntregas}
            higherIsBetter
          />
          <ComparisonBar
            label="On-Time %"
            current={data.efectividadOnTimePct}
            prev={prevData.efectividadOnTimePct}
            color="#1976d2"
            maxVal={100}
            isPercent
            higherIsBetter
          />
          <ComparisonBar
            label="Incidencias %"
            current={data.tasaIncidenciasPct}
            prev={prevData.tasaIncidenciasPct}
            color="#c62828"
            maxVal={Math.max(data.tasaIncidenciasPct, prevData.tasaIncidenciasPct) * 1.15 || 1}
            isPercent
            higherIsBetter={false}
          />
          <ComparisonBar
            label="Asignados"
            current={data.totalAsignados}
            prev={prevData.totalAsignados}
            color="#5e35b1"
            maxVal={Math.max(data.totalAsignados, prevData.totalAsignados) * 1.15 || 1}
            higherIsBetter
          />
        </Box>
      </CardContent>
    </Card>
  )
}

interface KpiProps {
  label: string
  value: number | string
  sub: string
  color: string
  icon: React.ReactNode
  progress?: number
  progressColor?: string
  compareValue?: number
  comparePrev?: number
  higherIsBetter?: boolean
}

function Kpi({ label, value, sub, color, icon, progress, progressColor, compareValue, comparePrev, higherIsBetter = true }: KpiProps) {
  const showCompare = compareValue !== undefined && comparePrev !== undefined && comparePrev !== 0
  let pct = 0
  let isGood = false
  if (showCompare) {
    pct = ((compareValue! - comparePrev!) / Math.abs(comparePrev!)) * 100
    isGood = higherIsBetter ? pct >= 0 : pct <= 0
  }

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
          {showCompare && (
            <Tooltip title={`Período anterior: ${comparePrev!.toFixed(comparePrev! % 1 !== 0 ? 1 : 0)}`}>
              <Chip
                size="small"
                icon={pct >= 0 ? <TrendingUpIcon sx={{ fontSize: '14px !important' }} /> : <TrendingDownIcon sx={{ fontSize: '14px !important' }} />}
                label={`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs anterior`}
                sx={{
                  mt: 1,
                  fontSize: '0.68rem',
                  height: 20,
                  bgcolor: isGood ? '#e8f5e9' : '#ffebee',
                  color: isGood ? '#2e7d32' : '#c62828',
                  '& .MuiChip-icon': { color: isGood ? '#2e7d32' : '#c62828' },
                }}
              />
            </Tooltip>
          )}
        </CardContent>
      </Card>
    </Grid>
  )
}
