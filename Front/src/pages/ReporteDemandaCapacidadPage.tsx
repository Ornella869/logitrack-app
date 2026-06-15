import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
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
  useTheme,
} from '@mui/material'
import AssessmentIcon from '@mui/icons-material/Assessment'
import DownloadIcon from '@mui/icons-material/Download'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import api from '../services/api'

interface SemanaCapacidad {
  semana: number
  fechaDesde: string
  fechaHasta: string
  totalEnvios: number
  horasRutaRequeridas: number
  horasDisponibles: number
  brechaHoras: number
  esDeficit: boolean
  esDeficitConsecutivo: boolean
  horasFaltantesFullTime: number
  horasFaltantesPartTime: number
  repartidoresEquivalentes: number
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

async function exportarExcel(semanas: SemanaCapacidad[]) {
  const { utils, writeFile } = await import('xlsx')
  const rows: (string | number)[][] = [
    ['LogiTrack — Reporte Demanda vs Capacidad Semanal'],
    [`Generado: ${new Date().toLocaleString('es-AR')}`],
    [],
    ['Semana', 'Desde', 'Hasta', 'Envíos', 'Hs. requeridas', 'Hs. disponibles', 'Brecha (h)', 'Déficit FT (h)', 'Déficit PT (h)', 'Repartidores equiv.'],
    ...semanas.map(s => [
      `Semana ${s.semana}`,
      fmtDate(s.fechaDesde),
      fmtDate(s.fechaHasta),
      s.totalEnvios,
      s.horasRutaRequeridas,
      s.horasDisponibles,
      s.brechaHoras,
      s.horasFaltantesFullTime,
      s.horasFaltantesPartTime,
      s.repartidoresEquivalentes,
    ]),
  ]
  const ws = utils.aoa_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Reporte')
  writeFile(wb, `logitrack-demanda-capacidad-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function ReporteDemandaCapacidadPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const default8Weeks = () => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 56)
    return {
      desde: from.toISOString().slice(0, 10),
      hasta: to.toISOString().slice(0, 10),
    }
  }

  const [semanas, setSemanas] = useState<SemanaCapacidad[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [fechas, setFechas] = useState(default8Weeks)

  const cargar = async (d = fechas.desde, h = fechas.hasta) => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/repartidores/reporte-demanda-capacidad', {
        params: { desde: d, hasta: h },
      })
      setSemanas(res.data)
    } catch {
      setError('No se pudo cargar el reporte.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void cargar() }, [])

  const semanasConDatos = semanas.filter(s => s.totalEnvios > 0)
  const totalDeficit = semanas.filter(s => s.esDeficit).length
  const totalSuperavit = semanas.filter(s => !s.esDeficit && s.totalEnvios > 0).length

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <AssessmentIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Reporte Demanda vs Capacidad
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Demanda de horas de ruta contra capacidad disponible de repartidores, por semana.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
          disabled={exporting || semanas.length === 0}
          onClick={async () => {
            setExporting(true)
            await exportarExcel(semanas)
            setExporting(false)
          }}
        >
          Exportar a Excel
        </Button>
      </Stack>

      {/* Filtro de período */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
            <TextField
              size="small"
              label="Desde"
              type="date"
              value={fechas.desde}
              onChange={e => setFechas(f => ({ ...f, desde: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              size="small"
              label="Hasta"
              type="date"
              value={fechas.hasta}
              onChange={e => setFechas(f => ({ ...f, hasta: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: fechas.desde }}
            />
            <Button
              variant="contained"
              onClick={() => cargar()}
              disabled={loading || !fechas.desde || !fechas.hasta}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : 'Aplicar'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (
        <>
          {/* Resumen */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            <ResumenCard label="Semanas analizadas" value={semanasConDatos.length} color="primary.main" />
            <ResumenCard label="Semanas en déficit" value={totalDeficit} color={totalDeficit > 0 ? 'error.main' : 'text.secondary'} />
            <ResumenCard label="Semanas en superávit" value={totalSuperavit} color={totalSuperavit > 0 ? 'success.main' : 'text.secondary'} />
            <ResumenCard
              label="Total envíos período"
              value={semanas.reduce((a, s) => a + s.totalEnvios, 0)}
              color="primary.main"
            />
          </Box>

          {/* Tabla */}
          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 700 }}>Semana</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Período</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Envíos</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Hs. requeridas</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Hs. disponibles</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>Brecha</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Cobertura</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Desglose faltante</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {semanas.map(s => {
                      const bg = s.esDeficitConsecutivo
                        ? (isDark ? 'rgba(211,47,47,0.15)' : '#fff3e0')
                        : s.esDeficit
                          ? (isDark ? 'rgba(198,40,40,0.08)' : '#fff8f6')
                          : 'inherit'
                      const pct = s.horasDisponibles > 0
                        ? Math.min(100, (s.horasDisponibles / Math.max(s.horasRutaRequeridas, 0.1)) * 100)
                        : 100
                      const barColor = pct >= 100 ? '#2e7d32' : pct >= 80 ? '#ed6c02' : '#c62828'

                      return (
                        <TableRow key={s.semana} sx={{ bgcolor: bg }}>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              {s.esDeficitConsecutivo
                                ? <WarningAmberIcon sx={{ fontSize: 16, color: 'error.main' }} />
                                : s.esDeficit
                                  ? <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                                  : s.totalEnvios > 0
                                    ? <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                    : null}
                              <Typography variant="body2" fontWeight={s.esDeficitConsecutivo ? 700 : 400}>
                                Sem. {s.semana}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption" color="text.secondary">
                              {fmtDate(s.fechaDesde)} – {fmtDate(s.fechaHasta)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{s.totalEnvios === 0 ? '—' : s.totalEnvios}</TableCell>
                          <TableCell align="right">{s.horasRutaRequeridas} h</TableCell>
                          <TableCell align="right">{s.horasDisponibles} h</TableCell>
                          <TableCell align="right">
                            {s.totalEnvios === 0 ? (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            ) : s.esDeficit ? (
                              <Tooltip title={`Déficit de ${s.brechaHoras} h — equivalente a ${s.repartidoresEquivalentes} repartidores Full Time adicionales`}>
                                <Stack alignItems="flex-end">
                                  <Typography variant="body2" fontWeight={700} color={s.esDeficitConsecutivo ? 'error.main' : 'warning.main'}>
                                    +{s.brechaHoras} h
                                  </Typography>
                                  {s.esDeficitConsecutivo && (
                                    <Typography variant="caption" color="error.main" sx={{ lineHeight: 1.2, maxWidth: 180, textAlign: 'right' }}>
                                      Déficit de {s.brechaHoras} h — equiv. a {s.repartidoresEquivalentes} FT adicionales
                                    </Typography>
                                  )}
                                </Stack>
                              </Tooltip>
                            ) : (
                              <Typography variant="body2" color="success.main">
                                -{Math.abs(s.brechaHoras)} h
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ minWidth: 120 }}>
                            {s.totalEnvios > 0 && (
                              <>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(100, pct)}
                                  sx={{ height: 6, borderRadius: 2, bgcolor: `${barColor}22`, '& .MuiLinearProgress-bar': { bgcolor: barColor } }}
                                />
                                <Typography variant="caption" sx={{ color: barColor }}>
                                  {pct.toFixed(0)}%
                                </Typography>
                              </>
                            )}
                          </TableCell>
                          <TableCell>
                            {(s.horasFaltantesFullTime > 0 || s.horasFaltantesPartTime > 0) ? (
                              <Stack spacing={0.2}>
                                {s.horasFaltantesFullTime > 0 && (
                                  <Chip
                                    size="small"
                                    label={`FT: ${s.horasFaltantesFullTime} h`}
                                    sx={{ fontSize: 10, height: 18, bgcolor: isDark ? 'rgba(198,40,40,0.2)' : '#fdecea', color: '#c62828' }}
                                  />
                                )}
                                {s.horasFaltantesPartTime > 0 && (
                                  <Chip
                                    size="small"
                                    label={`PT: ${s.horasFaltantesPartTime} h`}
                                    sx={{ fontSize: 10, height: 18, bgcolor: isDark ? 'rgba(230,81,0,0.2)' : '#fff3e0', color: '#e65100' }}
                                  />
                                )}
                              </Stack>
                            ) : s.totalEnvios > 0 ? (
                              <Typography variant="caption" color="success.main">Sin faltante</Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {semanas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">Sin datos para el período seleccionado.</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Leyenda */}
          {semanas.some(s => s.esDeficitConsecutivo) && (
            <Alert severity="error" sx={{ mt: 2 }} icon={<WarningAmberIcon />}>
              <strong>Déficit recurrente detectado:</strong> Las semanas resaltadas en naranja tienen déficit consecutivo de horas de ruta.
              Considerá contratar personal adicional para esos períodos.
            </Alert>
          )}

          {semanas.length > 0 && (
            <Stack direction="row" spacing={2} sx={{ mt: 2 }} flexWrap="wrap">
              <LegendaItem color="#c62828" label="Déficit consecutivo (≥2 sem.)" />
              <LegendaItem color="#e65100" label="Déficit simple" />
              <LegendaItem color="#2e7d32" label="Superávit" />
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}

function ResumenCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="h4" fontWeight={800} sx={{ color }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  )
}

function LegendaItem({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  )
}
