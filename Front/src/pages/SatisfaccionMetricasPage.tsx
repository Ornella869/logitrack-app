import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Rating,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import StarIcon from '@mui/icons-material/Star'
import ThumbUpIcon from '@mui/icons-material/ThumbUp'
import ThumbDownIcon from '@mui/icons-material/ThumbDown'
import RemoveIcon from '@mui/icons-material/Remove'
import { satisfaccionMetricasService, type ResumenSatisfaccion, type RespuestaEncuesta } from '../services/satisfaccionService'
import { formatInstantArgentina } from '../utils/argentinaDate'

export default function SatisfaccionMetricasPage() {
  const [resumen, setResumen] = useState<ResumenSatisfaccion | null>(null)
  const [respuestas, setRespuestas] = useState<RespuestaEncuesta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const load = async (d?: string, h?: string) => {
    setLoading(true)
    setError('')
    try {
      const [resumenData, respuestasData] = await Promise.all([
        satisfaccionMetricasService.getMetricas(d, h),
        satisfaccionMetricasService.getRespuestas(d, h),
      ])
      setResumen(resumenData)
      setRespuestas(respuestasData)
    } catch {
      setError('No se pudo cargar la información de satisfacción.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    void load(desde || undefined, hasta || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta])

  const npsColor = (nps: number) => {
    if (nps >= 50) return 'success.main'
    if (nps >= 0) return 'warning.main'
    return 'error.main'
  }

  const npsLabel = (nps: number) => {
    if (nps >= 50) return 'Excelente'
    if (nps >= 0) return 'Aceptable'
    return 'Negativo'
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 3 }} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Satisfacción del cliente</Typography>
          <Typography variant="body2" color="text.secondary">
            Métricas de encuestas respondidas por los destinatarios de tu sucursal.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Desde"
            type="date"
            size="small"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <TextField
            label="Hasta"
            type="date"
            size="small"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 150 }}
          />
          <Button startIcon={<RefreshIcon />} onClick={() => load(desde || undefined, hasta || undefined)} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : resumen && resumen.totalRespuestas === 0 ? (
        <Alert severity="info">
          {desde || hasta ? 'No hay respuestas en el período seleccionado.' : 'Todavía no hay encuestas respondidas.'}
        </Alert>
      ) : resumen ? (
        <Grid container spacing={2}>
          {/* KPI cards */}
          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h3" fontWeight={700}>{resumen.totalRespuestas}</Typography>
                <Typography variant="body2" color="text.secondary">Respuestas</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.5}>
                  <Typography variant="h3" fontWeight={700}>{resumen.promedioCalificacion.toFixed(1)}</Typography>
                  <StarIcon sx={{ color: '#f59e0b', fontSize: 28, mb: 0.5 }} />
                </Stack>
                <Typography variant="body2" color="text.secondary">Promedio</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h3" fontWeight={700} color={npsColor(resumen.nps)}>
                  {resumen.nps > 0 ? '+' : ''}{resumen.nps}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  NPS · <Chip label={npsLabel(resumen.nps)} size="small" color={resumen.nps >= 50 ? 'success' : resumen.nps >= 0 ? 'warning' : 'error'} variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={6} sm={3}>
            <Card variant="outlined">
              <CardContent sx={{ py: 2 }}>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <ThumbUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
                      <Typography variant="caption" color="text.secondary">Promotores (5★)</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="success.main">{resumen.promotores}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <RemoveIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                      <Typography variant="caption" color="text.secondary">Pasivos (4★)</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="warning.main">{resumen.pasivos}</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <ThumbDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
                      <Typography variant="caption" color="text.secondary">Detractores (1-3★)</Typography>
                    </Stack>
                    <Typography variant="body2" fontWeight={700} color="error.main">{resumen.detractores}</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Per-repartidor table */}
          {resumen.porRepartidor.length > 0 && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>Por repartidor</Typography>
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Repartidor</TableCell>
                          <TableCell align="right">Respuestas</TableCell>
                          <TableCell align="right">Promedio</TableCell>
                          <TableCell align="right">NPS</TableCell>
                          <TableCell align="right">Promotores</TableCell>
                          <TableCell align="right">Pasivos</TableCell>
                          <TableCell align="right">Detractores</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {resumen.porRepartidor.map((m) => (
                          <TableRow key={m.repartidorId}>
                            <TableCell>{m.repartidorNombre}</TableCell>
                            <TableCell align="right">{m.totalRespuestas}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={0.5}>
                                <span>{m.promedioCalificacion.toFixed(1)}</span>
                                <StarIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                              </Stack>
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight={600} color={npsColor(m.nps)} variant="body2">
                                {m.nps > 0 ? '+' : ''}{m.nps}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{m.promotores}</TableCell>
                            <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>{m.pasivos}</TableCell>
                            <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>{m.detractores}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Recent responses */}
          {respuestas.length > 0 && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>Respuestas recientes</Typography>
                  <Stack spacing={1} divider={<Divider />}>
                    {respuestas.map((r) => (
                      <Box key={r.id} sx={{ py: 1 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                          <Box>
                            <Typography variant="subtitle2">{r.destinatarioNombre}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Paquete: {r.paqueteCodigo}
                              {r.repartidorNombre && ` · Repartidor: ${r.repartidorNombre}`}
                            </Typography>
                          </Box>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Rating
                              value={r.calificacion}
                              readOnly
                              size="small"
                              icon={<StarIcon fontSize="inherit" sx={{ color: '#f59e0b' }} />}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {formatInstantArgentina(r.respondidaEn)}
                            </Typography>
                          </Stack>
                        </Stack>
                        {r.comentario && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                            "{r.comentario}"
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      ) : null}
    </Box>
  )
}
