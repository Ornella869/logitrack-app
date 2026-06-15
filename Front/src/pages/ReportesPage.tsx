import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import PrintIcon from '@mui/icons-material/Print'
import InventoryIcon from '@mui/icons-material/Inventory2'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PercentIcon from '@mui/icons-material/Percent'
import HomeWorkIcon from '@mui/icons-material/HomeWork'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { reportService, type ReporteVolumen } from '../services/reportService'
import { incidenciaService, type RankingZonaIncidencia } from '../services/incidenciaService'
import api from '../services/api'
import type { User } from '../types'
import { addArgentinaDays, formatArgentinaDateInput } from '../utils/argentinaDate'

interface ComparativoSucursal {
  sucursalId: string
  nombre: string
  provincia: string
  total: number
  entregados: number
  cancelados: number
  demorados: number
  pesoTotal: number
}

const today = () => formatArgentinaDateInput()
const daysAgo = (n: number) => addArgentinaDays(-n)

export default function ReportesPage() {
  const user = useOutletContext<User>()
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())
  const [dateError, setDateError] = useState('')
  const [data, setData] = useState<ReporteVolumen | null>(null)
  const [rankingZonas, setRankingZonas] = useState<RankingZonaIncidencia[]>([])
  const [comparativo, setComparativo] = useState<ComparativoSucursal[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canAccess = user.role === 'supervisor' || user.role === 'gerente'

  useEffect(() => {
    if (canAccess) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validate = (f: string, t: string): boolean => {
    if (t < f) { setDateError('La fecha fin no puede ser anterior a la fecha inicio.'); return false }
    if (t > today()) { setDateError('La fecha fin no puede ser una fecha futura.'); return false }
    setDateError('')
    return true
  }

  const load = async () => {
    if (!validate(from, to)) return
    setLoading(true)
    setError('')
    try {
      const [result, ranking, comp] = await Promise.all([
        reportService.getVolumen(from, to),
        incidenciaService.rankingZonas(from, to).catch(() => []),
        user.role === 'gerente' || user.role === 'administrador'
          ? api.get('/reportes/comparativo-sucursales', { params: { desde: from, hasta: to } }).then(r => r.data as ComparativoSucursal[]).catch(() => null)
          : Promise.resolve(null),
      ])
      if (result) setData(result)
      else setError('No se pudo cargar el reporte')
      setRankingZonas(ranking)
      setComparativo(comp)
    } finally {
      setLoading(false)
    }
  }

  const handleExportCsv = () => {
    if (!data) return
    const headers = ['Desde', 'Hasta', 'Total de envios', 'Entregados', 'Cancelados', 'En proceso', 'Efectividad (%)', 'Envios a domicilio']
    const row = [from, to, data.totalEnvios, data.entregados, data.cancelados, data.enProceso, data.efectividadPct, data.totalEnviosADomicilio]
    const domicilioRows = data.enviosADomicilioPorProvincia.map((item) => ['', '', `A domicilio ${item.provinciaDestino}`, item.cantidad, '', '', '', ''])
    const csv = '\uFEFF' + [headers.join(';'), row.map((c) => `"${c}"`).join(';'), ...domicilioRows.map((r) => r.map((c) => `"${c}"`).join(';'))].join('\n')
    const el = document.createElement('a')
    el.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv))
    el.setAttribute('download', `reporte_volumen_${from}_${to}.csv`)
    el.style.display = 'none'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
  }

  if (!canAccess) {
    return <Alert severity="warning">Solo Supervisor o Gerente.</Alert>
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 3, gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Reportes de volumen</Typography>
          <Typography variant="body2" color="text.secondary">
            Analizá la carga operativa por período y la efectividad de las entregas.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCsv} disabled={!data}>
            Exportar CSV
          </Button>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!data}>
            Exportar PDF
          </Button>
        </Stack>
      </Stack>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle2">Período</Typography>
            <TextField
              type="date" size="small" label="Fecha inicio" InputLabelProps={{ shrink: true }}
              value={from} inputProps={{ max: today() }}
              onChange={(e) => { setFrom(e.target.value); setDateError('') }}
            />
            <TextField
              type="date" size="small" label="Fecha fin" InputLabelProps={{ shrink: true }}
              value={to} inputProps={{ max: today() }}
              onChange={(e) => { setTo(e.target.value); setDateError('') }}
            />
            <Button variant="contained" size="small" onClick={() => void load()}>Aplicar</Button>
          </Stack>
          {dateError && <Alert severity="error" sx={{ mt: 2, py: 0 }}>{dateError}</Alert>}
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : !data ? null : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Metric label="Total de envíos" value={data.totalEnvios} sub="ingresados en el período" color="#5e35b1" icon={<InventoryIcon />} />
            <Metric label="Entregados" value={data.entregados} sub="estado final entregado" color="#2e7d32" icon={<CheckCircleIcon />} />
            <Metric label="Incidencias / Cancelados" value={data.cancelados} sub="estado final cancelado" color="#c62828" icon={<CancelIcon />} />
            <Metric label="Efectividad" value={`${data.efectividadPct.toFixed(1)}%`} sub="entregados / total" color="#1976d2" icon={<PercentIcon />} />
            <Metric label="A domicilio" value={data.totalEnviosADomicilio} sub="destinos sin sucursal propia" color="#6d4c41" icon={<HomeWorkIcon />} />
          </Grid>

          {data.totalEnvios === 0 ? (
            <Alert severity="info">No hay envíos registrados en el período seleccionado.</Alert>
          ) : (
            <Stack spacing={2}>
              <VolumeChart data={data} />
              <HomeDeliveryReport data={data} />
              {(user.role === 'gerente' || user.role === 'administrador') && (
                <RankingIncidenciasGerente data={rankingZonas} />
              )}
              {comparativo && comparativo.length > 0 && (
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                      <CompareArrowsIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight={700}>Comparativo por sucursal</Typography>
                    </Stack>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700 }}>Sucursal</TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>Provincia</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Total</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Entregados</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Cancelados</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Demorados</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Efectividad</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>Peso (kg)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {comparativo.map((suc) => {
                          const efectividad = suc.total > 0 ? ((suc.entregados / suc.total) * 100).toFixed(1) : '0.0'
                          const color = parseFloat(efectividad) >= 80 ? '#2e7d32' : parseFloat(efectividad) >= 60 ? '#e65100' : '#c62828'
                          return (
                            <TableRow key={suc.sucursalId}>
                              <TableCell sx={{ fontWeight: 600 }}>{suc.nombre}</TableCell>
                              <TableCell>
                                <Chip size="small" label={suc.provincia} sx={{ fontSize: 11, height: 20 }} />
                              </TableCell>
                              <TableCell align="right">{suc.total}</TableCell>
                              <TableCell align="right" sx={{ color: '#2e7d32', fontWeight: 600 }}>{suc.entregados}</TableCell>
                              <TableCell align="right" sx={{ color: '#c62828' }}>{suc.cancelados}</TableCell>
                              <TableCell align="right" sx={{ color: '#e65100' }}>{suc.demorados}</TableCell>
                              <TableCell align="right" sx={{ color, fontWeight: 700 }}>{efectividad}%</TableCell>
                              <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: 12 }}>{suc.pesoTotal.toFixed(0)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}

function RankingIncidenciasGerente({ data }: { data: RankingZonaIncidencia[] }) {
  if (data.length === 0) {
    return (
      <Alert severity="info">
        No hay incidencias asociadas a envios para el periodo seleccionado.
      </Alert>
    )
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <WarningAmberIcon color="warning" />
          <Typography variant="subtitle1" fontWeight={700}>
            Ranking de zonas con mas incidencias
          </Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Para Gerencia: agrupa incidencias de todas las sucursales dentro de tus provincias asignadas.
        </Typography>
        <Grid container spacing={1.5}>
          {data.map((item, index) => (
            <Grid item xs={12} md={6} key={`${item.provincia}-${item.localidad}`}>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={700}>
                    {index + 1}. {item.localidad}
                  </Typography>
                  <Typography variant="h6" color="error.main" fontWeight={700}>
                    {item.total}
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary" display="block">
                  {item.provincia}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Altas: {item.altas} · SLA vencido: {item.vencidas}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Predomina: {item.tipoPredominante} · {item.severidadPredominante}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  )
}

// Gráfico de barras simple, sin dependencias externas.
function VolumeChart({ data }: { data: ReporteVolumen }) {
  const bars = [
    { label: 'Entregados', value: data.entregados, color: '#2e7d32' },
    { label: 'Cancelados', value: data.cancelados, color: '#c62828' },
    { label: 'En proceso', value: data.enProceso, color: '#ed6c02' },
  ]
  const max = Math.max(...bars.map((b) => b.value), 1)

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Éxito de entregas vs incidencias
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
          Sobre un total de {data.totalEnvios} envíos en el período.
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 220, gap: 2 }}>
          {bars.map((b, i) => {
            const pct = data.totalEnvios > 0 ? Math.round((b.value / data.totalEnvios) * 100) : 0
            return (
              <Box key={b.label} sx={{ flex: 1, maxWidth: 140, textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: b.color }}>{b.value}</Typography>
                <Box
                  sx={{
                    height: `${Math.max(6, (b.value / max) * 160)}px`,
                    bgcolor: b.color,
                    borderRadius: '6px 6px 0 0',
                    transformOrigin: 'bottom center',
                    animation: 'barRise 0.7s ease both',
                    animationDelay: `${i * 0.15}s`,
                    '@keyframes barRise': {
                      from: { transform: 'scaleY(0)', opacity: 0 },
                      to: { transform: 'scaleY(1)', opacity: 1 },
                    },
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  }}
                />
                <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>{b.label}</Typography>
                <Typography variant="caption" color="text.secondary">{pct}% del total</Typography>
              </Box>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
}

function HomeDeliveryReport({ data }: { data: ReporteVolumen }) {
  if (data.enviosADomicilioPorProvincia.length === 0) {
    return (
      <Alert severity="info">
        No hay envios a domicilio hacia provincias sin sucursal propia en este periodo.
      </Alert>
    )
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
          Envios a domicilio por provincia destino
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          Indica demanda en provincias donde todavia no hay sucursal propia.
        </Typography>
        <Stack spacing={1}>
          {data.enviosADomicilioPorProvincia.map((item) => (
            <Stack key={item.provinciaDestino} direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="body2" fontWeight={600}>{item.provinciaDestino}</Typography>
              <Typography variant="body2">{item.cantidad}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
    </Card>
  )
}

interface MetricProps {
  label: string
  value: number | string
  sub: string
  color: string
  icon: React.ReactNode
}

function Metric({ label, value, sub, color, icon }: MetricProps) {
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
        </CardContent>
      </Card>
    </Grid>
  )
}
