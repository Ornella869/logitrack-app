import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import BoltIcon from '@mui/icons-material/Bolt'
import BedtimeIcon from '@mui/icons-material/Bedtime'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SearchIcon from '@mui/icons-material/Search'
import RepeatIcon from '@mui/icons-material/Repeat'
import DownloadIcon from '@mui/icons-material/Download'
import api from '../services/api'
import { dateOnlyForDisplay, formatDateOnlyEs, isTodayArgentina } from '../utils/argentinaDate'

async function exportToExcel(data: CalendarioOperativo, desde: string, hasta: string) {
  const { utils, writeFile } = await import('xlsx')
  const rows: (string | number)[][] = []
  rows.push(['LogiTrack — Calendario Operativo'])
  rows.push([`Período: ${desde} al ${hasta}`, '', `Generado: ${new Date().toLocaleString('es-AR')}`])
  rows.push([])
  const header = ['Repartidor', 'Email', ...data.dias]
  rows.push(header)
  for (const rep of data.repartidores) {
    const row: (string | number)[] = [rep.nombre, rep.email]
    for (const celda of rep.celdas) {
      row.push(celda.paquetes.length === 0 ? '' : `${celda.paquetes.length} envíos · ${celda.pesoTotal.toFixed(0)} kg`)
    }
    rows.push(row)
  }
  const ws = utils.aoa_to_sheet(rows)
  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, 'Calendario')
  writeFile(wb, `logitrack-calendario-${desde}-${hasta}.xlsx`)
}

async function exportToPdf(data: CalendarioOperativo, desde: string, hasta: string) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // Header con identidad LogiTrack
  doc.setFillColor(21, 101, 192)
  doc.rect(0, 0, 297, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('LogiTrack', 14, 11)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Calendario Operativo', 60, 11)
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(8)
  doc.text(`Período: ${desde} al ${hasta}`, 14, 24)
  doc.text(`Generado: ${new Date().toLocaleString('es-AR')}`, 14, 29)

  const head = [['Repartidor', ...data.dias.map((d) => {
    const date = dateOnlyForDisplay(d)
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  })]]
  const body = data.repartidores.map((rep) => [
    rep.nombre,
    ...rep.celdas.map((c) => c.paquetes.length === 0 ? '—' : `${c.paquetes.length}p · ${c.pesoTotal.toFixed(0)}kg`),
  ])
  autoTable(doc, {
    head,
    body,
    startY: 34,
    styles: { fontSize: 7 },
    headStyles: { fillColor: [21, 101, 192] },
    didDrawPage: (_data: any) => {
      const pageCount = (doc as any).internal.getNumberOfPages()
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(`LogiTrack · Página ${(doc as any).internal.getCurrentPageInfo().pageNumber} de ${pageCount}`, 14, doc.internal.pageSize.height - 5)
      doc.setTextColor(0, 0, 0)
    },
  })
  doc.save(`logitrack-calendario-${desde}-${hasta}.pdf`)
}

function filterCalendarioByRange(data: CalendarioOperativo, desde: string, hasta: string): CalendarioOperativo {
  const dias = data.dias.filter((d) => d >= desde && d <= hasta)
  const repartidores = data.repartidores.map((rep) => ({
    ...rep,
    celdas: rep.celdas.filter((c) => c.fecha >= desde && c.fecha <= hasta),
  }))
  return { dias, repartidores }
}

function semanaActualRange() {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    desde: monday.toISOString().slice(0, 10),
    hasta: sunday.toISOString().slice(0, 10),
  }
}

function proximos7Range() {
  const today = new Date()
  const from = new Date(today)
  const to = new Date(today)
  to.setDate(today.getDate() + 7)
  return {
    desde: from.toISOString().slice(0, 10),
    hasta: to.toISOString().slice(0, 10),
  }
}

const AVATAR_COLORS = ['#1976d2', '#388e3c', '#7b1fa2', '#f57c00', '#c2185b', '#5e35b1', '#00838f']

type CalendarioPaquete = {
  paqueteId: string
  codigoSeguimiento: string
  cpDestino: string
  peso: number
  esPrioritario: boolean
  status: string
  // G1L-119: para mostrar "Día N de M" en rutas multi-día.
  fechaCalendarizada?: string | null
  diasEstimados?: number
}

type CalendarioCelda = {
  repartidorId: string
  repartidorNombre: string
  fecha: string
  paquetes: CalendarioPaquete[]
  pesoTotal: number
  capacidadKg?: number
}

type CalendarioRepartidor = {
  repartidorId: string
  nombre: string
  email: string
  capacidadKg?: number
  celdas: CalendarioCelda[]
}

type CalendarioOperativo = {
  dias: string[]
  repartidores: CalendarioRepartidor[]
}

const DIAS_VISIBLES = 7
const DIAS_TOTAL = 30

const dateForDisplay = dateOnlyForDisplay

export default function CalendarioOperativoPage({ permissions }: { permissions: Set<string> }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [data, setData] = useState<CalendarioOperativo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pageOffset, setPageOffset] = useState(0)
  const [detalleCelda, setDetalleCelda] = useState<CalendarioCelda | null>(null)
  const [searchRepartidor, setSearchRepartidor] = useState('')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportRangeType, setExportRangeType] = useState<'semanaActual' | 'proximos7' | 'personalizado'>('semanaActual')
  const [exportFechaDesde, setExportFechaDesde] = useState('')
  const [exportFechaHasta, setExportFechaHasta] = useState('')
  const [exporting, setExporting] = useState(false)

  const getExportRange = () => {
    if (exportRangeType === 'semanaActual') return semanaActualRange()
    if (exportRangeType === 'proximos7') return proximos7Range()
    return { desde: exportFechaDesde, hasta: exportFechaHasta }
  }

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (!data) return
    const { desde, hasta } = getExportRange()
    if (!desde || !hasta || desde > hasta) return
    setExportDialogOpen(false)
    setExporting(true)
    const filtered = filterCalendarioByRange(data, desde, hasta)
    if (format === 'excel') await exportToExcel(filtered, desde, hasta)
    else await exportToPdf(filtered, desde, hasta)
    setExporting(false)
  }

  useEffect(() => {
    void load()
  }, [])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/calendarizacion/calendario', { params: { dias: DIAS_TOTAL } })
      setData(response.data)
    } catch {
      setError('No se pudo cargar el calendario operativo')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = data ? Math.ceil(data.dias.length / DIAS_VISIBLES) : 1
  const canGoPrev = pageOffset > 0
  const canGoNext = pageOffset < totalPages - 1

  const visible = useMemo(() => {
    if (!data) return null
    const start = pageOffset * DIAS_VISIBLES
    const end = start + DIAS_VISIBLES
    const q = searchRepartidor.trim().toLowerCase()
    const repartidoresFiltrados = q
      ? data.repartidores.filter((r) => r.nombre.toLowerCase().includes(q) || r.email.toLowerCase().includes(q))
      : data.repartidores
    return {
      dias: data.dias.slice(start, end),
      repartidores: repartidoresFiltrados.map((r) => ({
        ...r,
        celdas: r.celdas.slice(start, end),
      })),
    }
  }, [data, pageOffset, searchRepartidor])

  const canCreateCalendarizacion = permissions.has('calendarizacion')

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
        <Stack direction="row" spacing={1}>
          {data && (
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
              disabled={exporting}
              onClick={() => {
                setExportRangeType('semanaActual')
                setExportFechaDesde(new Date().toISOString().slice(0, 10))
                setExportFechaHasta(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10))
                setExportDialogOpen(true)
              }}
            >
              {exporting ? 'Exportando...' : 'Exportar'}
            </Button>
          )}
          {canCreateCalendarizacion && (
            <Button variant="outlined" startIcon={<BoltIcon />} onClick={() => navigate('/calendarizar')}>
              Nueva Calendarización
            </Button>
          )}
        </Stack>
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
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            gap={1}
            sx={{ p: 2, bgcolor: isDark ? '#1B2D42' : '#e3f2fd', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}` }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" onClick={() => setPageOffset((p) => p - 1)} disabled={!canGoPrev}>
                <ChevronLeftIcon />
              </IconButton>
              <Typography variant="subtitle1" fontWeight={600} sx={{ minWidth: 260, textAlign: 'center' }}>
                {visible.dias.length > 0 && (
                  <>
                    {dateForDisplay(visible.dias[0]).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                    {' — '}
                    {dateForDisplay(visible.dias[visible.dias.length - 1]).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </>
                )}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  ({pageOffset + 1}/{totalPages})
                </Typography>
              </Typography>
              <IconButton size="small" onClick={() => setPageOffset((p) => p + 1)} disabled={!canGoNext}>
                <ChevronRightIcon />
              </IconButton>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Filtrar repartidor..."
                value={searchRepartidor}
                onChange={(e) => setSearchRepartidor(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                sx={{ width: 200 }}
              />
              <Button size="small" onClick={() => setPageOffset(0)} disabled={!canGoPrev}>Hoy</Button>
            </Stack>
          </Stack>

          {/* Grilla */}
          <Box sx={{ overflowX: 'auto' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: `260px repeat(${visible.dias.length}, minmax(140px, 1fr))`, minWidth: 980 }}>
              {/* Header de días */}
              <Box sx={{ p: 1.5, bgcolor: isDark ? '#1B2D42' : '#fafafa', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', color: 'text.secondary', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}`, borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}` }}>
                Repartidor
              </Box>
              {visible.dias.map((d) => {
                const date = dateForDisplay(d)
                const isHoy = isTodayArgentina(d)
                return (
                  <Box
                    key={d}
                    sx={{
                      p: 1.5,
                      bgcolor: isHoy
                        ? (isDark ? 'rgba(21,101,192,0.3)' : '#e3f2fd')
                        : (isDark ? '#1B2D42' : '#fafafa'),
                      fontWeight: 700, fontSize: 12, textTransform: 'capitalize',
                      color: isHoy ? (isDark ? '#42A5F5' : '#1565c0') : 'text.secondary',
                      textAlign: 'center',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}`,
                      borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#eee'}`,
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
                      sx={{ p: 1.5, bgcolor: isDark ? '#1B2D42' : '#fafafa', borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}`, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#eee'}`, minHeight: 90 }}
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
                      const capacidadKg = rep.capacidadKg ?? 500
                      const pct = Math.min(100, (celda.pesoTotal / capacidadKg) * 100)
                      const colorBar = pct >= 90 ? '#c62828' : pct >= 70 ? '#ed6c02' : '#2e7d32'
                      const cps = Array.from(new Set(celda.paquetes.map((p) => p.cpDestino).filter(Boolean)))
                      return (
                        <Box
                          key={celda.fecha}
                          sx={{
                            p: 1,
                            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#eee'}`,
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#eee'}`,
                            cursor: celda.paquetes.length ? 'pointer' : 'default',
                            '&:hover': celda.paquetes.length ? { bgcolor: isDark ? 'rgba(255,255,255,0.06)' : '#f5f5f5' } : {},
                          }}
                          onClick={() => celda.paquetes.length && setDetalleCelda({ ...celda, capacidadKg })}
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
                                {celda.paquetes.slice(0, 3).map((p) => {
                                  const diasEstimados = p.diasEstimados ?? 1
                                  const isMultiDia = diasEstimados > 1
                                  const diaNum = isMultiDia && p.fechaCalendarizada
                                    ? Math.max(1, Math.round((new Date(celda.fecha).getTime() - new Date(p.fechaCalendarizada).getTime()) / 86400000) + 1)
                                    : 1
                                  const isDescanso = p.status === 'EnTransitoDescanso'
                                  return (
                                  <Tooltip key={p.paqueteId} title={`${p.codigoSeguimiento} · ${p.peso} kg · ${p.status}${isMultiDia ? ` · Día ${diaNum}/${diasEstimados}` : ''}`}>
                                    <Box
                                      sx={{
                                        bgcolor: isDescanso
                                          ? (isDark ? 'rgba(55,71,79,0.5)' : '#ECEFF1')
                                          : p.esPrioritario
                                            ? (isDark ? 'rgba(198,40,40,0.3)' : '#fdecea')
                                            : isMultiDia
                                              ? (isDark ? 'rgba(103,58,183,0.35)' : '#ede7f6')
                                              : (isDark ? 'rgba(2,136,209,0.3)' : '#e1f5fe'),
                                        color: isDescanso
                                          ? (isDark ? '#b0bec5' : '#546e7a')
                                          : p.esPrioritario
                                            ? (isDark ? '#ef9a9a' : 'inherit')
                                            : isMultiDia
                                              ? (isDark ? '#ce93d8' : 'inherit')
                                              : (isDark ? '#81d4fa' : 'inherit'),
                                        borderLeft: `3px solid ${isDescanso ? '#607d8b' : p.esPrioritario ? '#c62828' : isMultiDia ? '#7b1fa2' : '#0288d1'}`,
                                        borderRadius: 0.5, px: 0.5, py: 0.3,
                                        fontSize: 10, fontFamily: 'monospace',
                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {isDescanso ? <BedtimeIcon sx={{ fontSize: 12, verticalAlign: 'text-bottom', mr: 0.4, color: '#607d8b' }} /> : p.esPrioritario ? <BoltIcon sx={{ fontSize: 12, verticalAlign: 'text-bottom', mr: 0.4, color: '#c62828' }} /> : isMultiDia ? <RepeatIcon sx={{ fontSize: 12, verticalAlign: 'text-bottom', mr: 0.4, color: '#7b1fa2' }} /> : null}
                                      {p.codigoSeguimiento}
                                      {isMultiDia && <span style={{ opacity: 0.7, marginLeft: 4 }}>{diaNum}/{diasEstimados}</span>}
                                    </Box>
                                  </Tooltip>
                                  )
                                })}
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
                                {celda.pesoTotal.toFixed(0)} / {capacidadKg.toFixed(0)} kg
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

      {/* Dialog: configuración de exportación */}
      <Dialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" spacing={1} alignItems="center">
            <DownloadIcon color="primary" fontSize="small" />
            <span>Exportar calendario</span>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Seleccioná el período que querés exportar:
          </Typography>
          <RadioGroup
            value={exportRangeType}
            onChange={(e) => setExportRangeType(e.target.value as typeof exportRangeType)}
          >
            <FormControlLabel value="semanaActual" control={<Radio size="small" />} label="Semana actual (lunes a domingo)" />
            <FormControlLabel value="proximos7" control={<Radio size="small" />} label="Próximos 7 días" />
            <FormControlLabel value="personalizado" control={<Radio size="small" />} label="Rango personalizado" />
          </RadioGroup>
          {exportRangeType === 'personalizado' && (
            <Stack spacing={2} sx={{ mt: 2 }}>
              <TextField
                size="small"
                label="Fecha desde"
                type="date"
                value={exportFechaDesde}
                onChange={(e) => setExportFechaDesde(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                size="small"
                label="Fecha hasta"
                type="date"
                value={exportFechaHasta}
                onChange={(e) => setExportFechaHasta(e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ min: exportFechaDesde }}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ gap: 1, px: 2, pb: 2 }}>
          <Button onClick={() => setExportDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="outlined"
            onClick={() => handleExport('excel')}
            disabled={exportRangeType === 'personalizado' && (!exportFechaDesde || !exportFechaHasta || exportFechaDesde > exportFechaHasta)}
          >
            Excel (.xlsx)
          </Button>
          <Button
            variant="contained"
            onClick={() => handleExport('pdf')}
            disabled={exportRangeType === 'personalizado' && (!exportFechaDesde || !exportFechaHasta || exportFechaDesde > exportFechaHasta)}
          >
            PDF (.pdf)
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal detalle de celda */}
      <Dialog open={Boolean(detalleCelda)} onClose={() => setDetalleCelda(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {detalleCelda && (
            <>
              {detalleCelda.repartidorNombre}
              <Typography variant="caption" display="block" color="text.secondary">
                {formatDateOnlyEs(detalleCelda.fecha, { weekday: 'long', day: '2-digit', month: 'long' })}
                {' · '}
                {detalleCelda.pesoTotal.toFixed(0)} / {(detalleCelda.capacidadKg ?? 500).toFixed(0)} kg
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
                              icon={<BoltIcon sx={{ fontSize: '14px !important' }} />}
                              label="Prioritario"
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
