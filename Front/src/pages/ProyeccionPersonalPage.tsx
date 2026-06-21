import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
  useTheme,
} from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import PeopleIcon from '@mui/icons-material/People'
import api from '../services/api'

interface SemanaEnvios { semana: number; envios: number }

interface ProyeccionPersonal {
  enviosUltimas4Semanas: number
  promedioPorSemana: number
  crecimientoSemanal: number
  enviosProyectados30Dias: number
  horasNecesarias: number
  horasDisponibles: number
  brechaHoras: number
  horasFullTimeNecesarias: number
  horasPartTimeNecesarias: number
  horasFullTimeDisponibles: number
  horasPartTimeDisponibles: number
  brechaFullTime: number
  brechaPartTime: number
  promedioHorasPorEnvio: number
  repartidoresActivos: number
  repartidoresEquivalentes: number
  repartidoresFullTimeNecesarios: number
  repartidoresPartTimeNecesarios: number
  capacidadActualPct: number
  porSemana: SemanaEnvios[]
}

export default function ProyeccionPersonalPage() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [data, setData] = useState<ProyeccionPersonal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [volumenManual, setVolumenManual] = useState<number | null>(null)
  const [inputVolumen, setInputVolumen] = useState('')

  const load = async (volumen?: number) => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, unknown> = {}
      if (volumen != null && volumen > 0) params.volumenManual = volumen
      const res = await api.get('/repartidores/proyeccion-personal', { params })
      setData(res.data)
    } catch {
      setError('No se pudo calcular la proyección.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleVolumenSimular = () => {
    const v = parseFloat(inputVolumen)
    if (!isNaN(v) && v > 0) {
      setVolumenManual(v)
      void load(v)
    }
  }

  const handleReset = () => {
    setVolumenManual(null)
    setInputVolumen('')
    void load()
  }

  const superavit = data ? data.brechaHoras <= 0 : null

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
        <TrendingUpIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Proyección de Personal — 30 días
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Estimación de cuántos repartidores necesitarías para cubrir la demanda proyectada de los próximos 30 días.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Simulación manual */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
            Simular volumen personalizado
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Ingresá un volumen esperado de envíos (ej: si anticipás una campaña de alto tráfico) y la proyección se recalcula en tiempo real.
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              size="small"
              label="Envíos esperados (30 días)"
              type="number"
              value={inputVolumen}
              onChange={(e) => setInputVolumen(e.target.value)}
              sx={{ width: 240 }}
              inputProps={{ min: 1 }}
            />
            <Button variant="contained" onClick={handleVolumenSimular} disabled={loading}>
              Simular
            </Button>
            {volumenManual != null && (
              <Button variant="outlined" onClick={handleReset} disabled={loading}>
                Usar histórico
              </Button>
            )}
            {volumenManual != null && (
              <Typography variant="caption" color="primary">
                Usando volumen manual: <strong>{volumenManual} envíos</strong>
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
      ) : data && (
        <>
          {/* Conclusión accionable */}
          <Alert
            severity={superavit ? 'success' : 'warning'}
            sx={{ mb: 3, fontSize: 15 }}
          >
            {superavit
              ? `Con el personal actual cubrís el ${data.capacidadActualPct.toFixed(0)}% de la demanda proyectada. Tenés un superávit de ${Math.abs(data.brechaHoras).toFixed(0)} horas.`
              : `Con el personal actual cubrís el ${data.capacidadActualPct.toFixed(0)}% de la demanda proyectada. Para llegar al 100% se estiman ${data.repartidoresEquivalentes.toFixed(1)} repartidores adicionales (${data.repartidoresFullTimeNecesarios} Full Time, ${data.repartidoresPartTimeNecesarios} Part Time).`}
          </Alert>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderLeft: '5px solid #1976d2' }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>DEMANDA PROYECTADA</Typography>
                  <Typography variant="h4" fontWeight={800}>{data.enviosProyectados30Dias.toFixed(0)}</Typography>
                  <Typography variant="caption" color="text.secondary">envíos en 30 días · {data.horasNecesarias.toFixed(0)} horas de ruta estimadas</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Promedio real: {data.promedioHorasPorEnvio.toFixed(2)} h/envío
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderLeft: `5px solid ${superavit ? '#2e7d32' : '#ed6c02'}` }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>CAPACIDAD ACTUAL</Typography>
                  <Typography variant="h4" fontWeight={800} color={superavit ? 'success.main' : 'warning.main'}>
                    {data.capacidadActualPct.toFixed(0)}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.repartidoresActivos} repartidores · {data.horasDisponibles.toFixed(0)} h disponibles
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={4}>
              <Card variant="outlined" sx={{ borderLeft: `5px solid ${superavit ? '#2e7d32' : '#d32f2f'}` }}>
                <CardContent>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    {superavit ? 'SUPERÁVIT' : 'DÉFICIT ESTIMADO'}
                  </Typography>
                  <Typography variant="h4" fontWeight={800} color={superavit ? 'success.main' : 'error.main'}>
                    {superavit ? '+' : ''}{Math.abs(data.brechaHoras).toFixed(0)} h
                  </Typography>
                  {!superavit && (
                    <Typography variant="caption" color="text.secondary">
                      ≈ {data.repartidoresEquivalentes.toFixed(1)} repartidores equivalentes
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            {/* Histórico por semana */}
            <Grid item xs={12} md={5}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 1 }}>Histórico últimas 4 semanas</Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Semana</TableCell>
                        <TableCell align="right">Envíos</TableCell>
                        <TableCell align="right">Variación</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.porSemana.map((s, idx) => {
                        const prev = idx > 0 ? data.porSemana[idx - 1].envios : null
                        const delta = prev != null ? s.envios - prev : null
                        return (
                          <TableRow key={s.semana}>
                            <TableCell>Semana -{4 - s.semana + 1}</TableCell>
                            <TableCell align="right"><strong>{s.envios}</strong></TableCell>
                            <TableCell align="right" sx={{ color: delta == null ? 'inherit' : delta > 0 ? 'success.main' : delta < 0 ? 'error.main' : 'inherit' }}>
                              {delta != null ? (delta > 0 ? `+${delta}` : delta) : '—'}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                      <TableRow sx={{ bgcolor: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5' }}>
                        <TableCell><strong>Promedio</strong></TableCell>
                        <TableCell align="right"><strong>{data.promedioPorSemana}</strong></TableCell>
                        <TableCell align="right">
                          <Typography variant="caption" color={data.crecimientoSemanal >= 0 ? 'success.main' : 'error.main'}>
                            {data.crecimientoSemanal >= 0 ? '+' : ''}{data.crecimientoSemanal}/sem
                          </Typography>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>

            {/* Resumen de necesidad */}
            {!superavit && (
              <Grid item xs={12} md={7}>
                <Card variant="outlined" sx={{ borderColor: 'warning.main' }}>
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <PeopleIcon color="warning" />
                      <Typography variant="h6">Personal adicional estimado</Typography>
                    </Stack>
                    <Table size="small">
                      <TableBody>
                        <TableRow>
                          <TableCell>Repartidores Full Time (8 h/día)</TableCell>
                          <TableCell align="right">
                            <strong>{data.repartidoresFullTimeNecesarios}</strong>
                            <Typography variant="caption" display="block" color="text.secondary">
                              Déficit: {data.brechaFullTime.toFixed(0)} h
                            </Typography>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Repartidores Part Time (≤6 h/día)</TableCell>
                          <TableCell align="right">
                            <strong>{data.repartidoresPartTimeNecesarios}</strong>
                            <Typography variant="caption" display="block" color="text.secondary">
                              Déficit: {data.brechaPartTime.toFixed(0)} h
                            </Typography>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Total repartidores equivalentes</TableCell>
                          <TableCell align="right"><strong>{data.repartidoresEquivalentes.toFixed(1)}</strong></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    <Alert severity="warning" sx={{ mt: 2, fontSize: 12 }}>
                      Demanda estimada: {data.horasFullTimeNecesarias.toFixed(0)} h Full Time y {data.horasPartTimeNecesarias.toFixed(0)} h compatibles con Part Time. Capacidad actual: {data.horasFullTimeDisponibles.toFixed(0)} h Full Time y {data.horasPartTimeDisponibles.toFixed(0)} h Part Time.
                    </Alert>
                    <Alert severity="info" sx={{ mt: 2, fontSize: 12 }}>
                      Cálculo basado en promedio de horas de ruta históricas y tendencia de crecimiento de {data.crecimientoSemanal >= 0 ? '+' : ''}{data.crecimientoSemanal} envíos/semana.
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>
            )}
          </Grid>
        </>
      )}
    </Box>
  )
}
