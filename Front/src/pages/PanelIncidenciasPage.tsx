import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
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
import GridOnIcon from '@mui/icons-material/GridOn'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import api from '../services/api'

// Mapeo de tipos a labels y colores (alineado con IncidenciasPage)
const TIPO_INFO: Record<string, { label: string; color: string }> = {
  accident:    { label: 'Accidente',       color: '#c62828' },
  mechanical:  { label: 'Mecánico',        color: '#e65100' },
  danger:      { label: 'Zona riesgo',     color: '#f57f17' },
  health:      { label: 'Salud',           color: '#6a1b9a' },
  delivery:    { label: 'Entrega',         color: '#1565c0' },
  no_llego:    { label: 'No llegó',        color: '#b71c1c' },
  llego_danado:{ label: 'Llegó dañado',    color: '#e65100' },
  llego_tarde: { label: 'Llegó tarde',     color: '#f57f17' },
  otro:        { label: 'Otro',            color: '#37474f' },
}

interface PanelRepartidor {
  repartidorId: string
  repartidorNombre: string
  total: number
  porTipo: Record<string, number>
}

interface PanelData {
  tipos: string[]
  repartidores: PanelRepartidor[]
  promedios: Record<string, number>
}

interface DetalleIncidencia {
  id: string
  tipo: string
  tipoLabel: string
  descripcion: string
  estado: string
  fechaReporte: string
  severidad: string
  repartidorNombre: string
  codigoSeguimiento: string
}

const ESTADO_COLOR: Record<string, string> = {
  Abierta: '#c62828',
  'En Revisión': '#e65100',
  Resuelta: '#2e7d32',
}

export default function PanelIncidenciasPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const defaultDesde = () => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10)
  }

  const [data, setData] = useState<PanelData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [desde, setDesde] = useState(defaultDesde)
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10))
  const [sucursalId] = useState<string>('')

  // Drill-down dialog
  const [drillCell, setDrillCell] = useState<{ repartidorId: string; repartidorNombre: string; tipo: string } | null>(null)
  const [drillItems, setDrillItems] = useState<DetalleIncidencia[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  const cargar = async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = { desde, hasta }
      if (sucursalId) params.sucursalId = sucursalId
      const res = await api.get('/incidencias/panel-cruzado', { params })
      setData(res.data)
    } catch {
      setError('No se pudo cargar el panel de incidencias.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void cargar() }, [])

  const openDrill = async (rep: PanelRepartidor, tipo: string) => {
    const count = rep.porTipo[tipo] ?? 0
    if (count === 0) return
    setDrillCell({ repartidorId: rep.repartidorId ?? '', repartidorNombre: rep.repartidorNombre, tipo })
    setDrillLoading(true)
    setDrillItems([])
    try {
      const res = await api.get('/incidencias/panel-detalle', {
        params: { repartidorId: rep.repartidorId, tipo, desde, hasta },
      })
      setDrillItems(res.data)
    } finally {
      setDrillLoading(false)
    }
  }

  const isAtipico = (tipo: string, value: number) => {
    const avg = data?.promedios[tipo] ?? 0
    return avg > 0 && value > avg * 2
  }

  const tipoLabel = (t: string) => TIPO_INFO[t]?.label ?? t
  const tipoColor = (t: string) => TIPO_INFO[t]?.color ?? '#555'

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
        <GridOnIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Panel de Incidencias por Repartidor
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Tabla cruzada: filas = repartidores, columnas = tipos de incidencia. Celdas en rojo indican valores atípicos (&gt;2× promedio del equipo).
      </Typography>

      {/* Filtros */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end" flexWrap="wrap">
            <TextField
              size="small"
              label="Desde"
              type="date"
              value={desde}
              onChange={e => setDesde(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              size="small"
              label="Hasta"
              type="date"
              value={hasta}
              onChange={e => setHasta(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: desde }}
              sx={{ minWidth: 150 }}
            />
            <Button
              variant="contained"
              onClick={cargar}
              disabled={loading}
              sx={{ minWidth: 100 }}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : 'Filtrar'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : !data || data.repartidores.length === 0 ? (
        <Alert severity="info">No hay incidencias con repartidor asignado en el período seleccionado.</Alert>
      ) : (
        <>
          {/* Info promedio atípico */}
          {data.repartidores.some(r => data.tipos.some(t => isAtipico(t, r.porTipo[t] ?? 0))) && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
              Algunas celdas resaltadas en rojo tienen más del doble del promedio del equipo. Revisá esos repartidores para identificar causas recurrentes.
            </Alert>
          )}

          <Card variant="outlined">
            <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
              <TableContainer>
                <Table size="small" sx={{ minWidth: 600 }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 700, minWidth: 180, position: 'sticky', left: 0, bgcolor: isDark ? '#1e1e1e' : '#f5f5f5', zIndex: 1 }}>
                        Repartidor
                      </TableCell>
                      {data.tipos.map(t => (
                        <TableCell key={t} align="center" sx={{ fontWeight: 700, minWidth: 90 }}>
                          <Tooltip title={`Promedio equipo: ${data.promedios[t]}`}>
                            <Box>
                              <Typography variant="caption" fontWeight={700} sx={{ color: tipoColor(t), display: 'block' }}>
                                {tipoLabel(t)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9 }}>
                                prom. {data.promedios[t]}
                              </Typography>
                            </Box>
                          </Tooltip>
                        </TableCell>
                      ))}
                      <TableCell align="center" sx={{ fontWeight: 700, minWidth: 70 }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.repartidores.map(rep => (
                      <TableRow key={rep.repartidorId} hover>
                        <TableCell
                          sx={{
                            fontWeight: 600,
                            position: 'sticky',
                            left: 0,
                            bgcolor: isDark ? '#1e1e1e' : '#fff',
                            zIndex: 1,
                            borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`,
                          }}
                        >
                          {rep.repartidorNombre}
                        </TableCell>
                        {data.tipos.map(t => {
                          const val = rep.porTipo[t] ?? 0
                          const atipico = isAtipico(t, val)
                          return (
                            <TableCell
                              key={t}
                              align="center"
                              onClick={() => openDrill(rep, t)}
                              sx={{
                                cursor: val > 0 ? 'pointer' : 'default',
                                bgcolor: atipico
                                  ? (isDark ? 'rgba(198,40,40,0.25)' : '#fdecea')
                                  : val > 0
                                    ? (isDark ? 'rgba(255,255,255,0.03)' : '#fafafa')
                                    : 'inherit',
                                '&:hover': val > 0 ? { bgcolor: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0' } : {},
                                transition: 'background-color 0.15s',
                                border: atipico ? `1px solid #c62828` : undefined,
                              }}
                            >
                              {val === 0 ? (
                                <Typography variant="caption" color="text.disabled">—</Typography>
                              ) : (
                                <Stack direction="row" spacing={0.4} justifyContent="center" alignItems="center">
                                  {atipico && <WarningAmberIcon sx={{ fontSize: 13, color: 'error.main' }} />}
                                  <Typography
                                    variant="body2"
                                    fontWeight={atipico ? 800 : 600}
                                    sx={{ color: atipico ? 'error.main' : tipoColor(t) }}
                                  >
                                    {val}
                                  </Typography>
                                </Stack>
                              )}
                            </TableCell>
                          )
                        })}
                        <TableCell align="center">
                          <Chip
                            label={rep.total}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              bgcolor: rep.total > 5
                                ? (isDark ? 'rgba(198,40,40,0.2)' : '#fdecea')
                                : isDark ? 'rgba(255,255,255,0.08)' : '#f5f5f5',
                              color: rep.total > 5 ? 'error.main' : 'text.primary',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          {/* Promedio footer */}
          <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap">
            {data.tipos.map(t => (
              <Chip
                key={t}
                size="small"
                label={`${tipoLabel(t)}: prom. ${data!.promedios[t]}`}
                sx={{ fontSize: 11, color: tipoColor(t), borderColor: tipoColor(t) }}
                variant="outlined"
              />
            ))}
          </Stack>
        </>
      )}

      {/* Dialog drill-down */}
      <Dialog
        open={!!drillCell}
        onClose={() => setDrillCell(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="subtitle1" fontWeight={700}>
            {drillCell?.repartidorNombre} · {drillCell ? tipoLabel(drillCell.tipo) : ''}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {desde} – {hasta}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {drillLoading ? (
            <Box display="flex" justifyContent="center" py={3}><CircularProgress /></Box>
          ) : drillItems.length === 0 ? (
            <Alert severity="info">Sin incidencias para esta combinación.</Alert>
          ) : (
            <Stack spacing={1.5}>
              {drillItems.map(inc => (
                <Card key={inc.id} variant="outlined">
                  <CardContent sx={{ py: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                      <Box flex={1}>
                        <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                          <Chip
                            label={inc.estado}
                            size="small"
                            sx={{ fontSize: 10, color: ESTADO_COLOR[inc.estado] ?? '#555', borderColor: ESTADO_COLOR[inc.estado] ?? '#555' }}
                            variant="outlined"
                          />
                          {inc.severidad === 'Alta' && (
                            <Chip label="Alta severidad" size="small" color="error" sx={{ fontSize: 10 }} />
                          )}
                          {inc.codigoSeguimiento && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {inc.codigoSeguimiento}
                            </Typography>
                          )}
                        </Stack>
                        <Typography variant="body2">{inc.descripcion || 'Sin descripción.'}</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" whiteSpace="nowrap">
                        {new Date(inc.fechaReporte).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </Typography>
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
