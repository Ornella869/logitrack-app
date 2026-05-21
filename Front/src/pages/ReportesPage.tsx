import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import PrintIcon from '@mui/icons-material/Print'
import InventoryIcon from '@mui/icons-material/Inventory2'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import PercentIcon from '@mui/icons-material/Percent'
import { reportService, type ReporteVolumen } from '../services/reportService'
import type { User } from '../types'

const fmt = (d: Date) => d.toISOString().split('T')[0]
const today = () => fmt(new Date())
const daysAgo = (n: number) => fmt(new Date(Date.now() - n * 86400000))

export default function ReportesPage() {
  const user = useOutletContext<User>()
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())
  const [dateError, setDateError] = useState('')
  const [data, setData] = useState<ReporteVolumen | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const canAccess = user.role === 'supervisor' || user.role === 'administrador'

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
      const result = await reportService.getVolumen(from, to)
      if (result) setData(result)
      else setError('No se pudo cargar el reporte')
    } finally {
      setLoading(false)
    }
  }

  const handleExportCsv = () => {
    if (!data) return
    const headers = ['Desde', 'Hasta', 'Total de envíos', 'Entregados', 'Cancelados', 'En proceso', 'Efectividad (%)']
    const row = [from, to, data.totalEnvios, data.entregados, data.cancelados, data.enProceso, data.efectividadPct]
    const csv = '﻿' + [headers.join(';'), row.map((c) => `"${c}"`).join(';')].join('\n')
    const el = document.createElement('a')
    el.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv))
    el.setAttribute('download', `reporte_volumen_${from}_${to}.csv`)
    el.style.display = 'none'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el)
  }

  if (!canAccess) {
    return <Alert severity="warning">Solo Supervisor o Administrador.</Alert>
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
          </Grid>

          {data.totalEnvios === 0 ? (
            <Alert severity="info">No hay envíos registrados en el período seleccionado.</Alert>
          ) : (
            <VolumeChart data={data} />
          )}
        </>
      )}
    </Box>
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
          {bars.map((b) => {
            const pct = data.totalEnvios > 0 ? Math.round((b.value / data.totalEnvios) * 100) : 0
            return (
              <Box key={b.label} sx={{ flex: 1, maxWidth: 140, textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: b.color }}>{b.value}</Typography>
                <Box
                  sx={{
                    height: `${Math.max(6, (b.value / max) * 160)}px`,
                    bgcolor: b.color,
                    borderRadius: '6px 6px 0 0',
                    transition: 'height .3s',
                    // Sin esto, al imprimir/PDF el navegador omite el color de fondo de las barras.
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
