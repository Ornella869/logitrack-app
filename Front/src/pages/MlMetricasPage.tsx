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
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ModelTrainingIcon from '@mui/icons-material/ModelTraining'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { mlService, type AlertaRiesgo, type MlMetricas } from '../services/mlService'

export default function MlMetricasPage() {
  const [metricas, setMetricas] = useState<MlMetricas | null>(null)
  const [alertas, setAlertas] = useState<AlertaRiesgo[]>([])
  const [loading, setLoading] = useState(true)
  const [reentrenando, setReentrenando] = useState(false)
  const [snackbar, setSnackbar] = useState('')
  const [snackbarError, setSnackbarError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const [m, a] = await Promise.all([
        mlService.getMetricas(),
        mlService.getAlertas(true),
      ])
      setMetricas(m)
      setAlertas(a)
    } catch {
      setSnackbarError('No se pudieron cargar las métricas ML.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void cargar() }, [])

  const handleReentrenar = async () => {
    setReentrenando(true)
    try {
      const msg = await mlService.reentrenar()
      setSnackbar(msg)
      await cargar()
    } catch (e: any) {
      setSnackbarError(e?.response?.data ?? 'No se pudo iniciar el reentrenamiento.')
    } finally {
      setReentrenando(false)
    }
  }

  const handleGestionar = async (id: string) => {
    try {
      await mlService.gestionarAlerta(id, null)
      setAlerta(id)
      setSnackbar('Alerta marcada como gestionada.')
    } catch {
      setSnackbarError('No se pudo gestionar la alerta.')
    }
  }

  const setAlerta = (id: string) => {
    setAlertas((prev) => prev.filter((a) => a.id !== id))
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    )
  }

  const dist = metricas?.distribucionErrores

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <ModelTrainingIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Panel de Métricas ML</Typography>
          <Typography variant="body2" color="text.secondary">
            Estimación de entregas · {metricas?.version}
          </Typography>
        </Box>
      </Stack>

      {/* Tarjetas de resumen */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <SummaryCard
          label="Registros totales"
          value={metricas?.totalRegistros ?? 0}
          sub="histórico completo"
          color="#1976d2"
        />
        <SummaryCard
          label="MAE del modelo"
          value={`${metricas?.maeModelo ?? 0} h`}
          sub="error medio absoluto"
          color="#7b1fa2"
        />
        <SummaryCard
          label="Nuevos (30 días)"
          value={metricas?.nuevosRegistros30Dias ?? 0}
          sub="registros recientes"
          color="#2e7d32"
        />
        <SummaryCard
          label="Alertas activas"
          value={alertas.length}
          sub="riesgo de demora"
          color={alertas.length > 0 ? '#e65100' : '#2e7d32'}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Distribución de errores */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              Distribución de errores de estimación
            </Typography>
            {dist ? (
              <Stack spacing={1.5}>
                <ErrorBar label="Menos de 4 h" value={dist.menosDe4h} color="#2e7d32" />
                <ErrorBar label="4 – 8 h" value={dist.de4a8h} color="#f9a825" />
                <ErrorBar label="8 – 24 h" value={dist.de8a24h} color="#e65100" />
                <ErrorBar label="Más de 24 h" value={dist.masDe24h} color="#c62828" />
              </Stack>
            ) : (
              <Typography color="text.secondary">Sin datos aún.</Typography>
            )}
          </CardContent>
        </Card>

        {/* MAE histórico */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              Evolución del MAE (últimos 6 meses)
            </Typography>
            {metricas && metricas.maeHistorico.length > 0 ? (
              <Stack spacing={1.5}>
                {metricas.maeHistorico.map((p) => (
                  <Box key={p.mes}>
                    <Stack direction="row" justifyContent="space-between" mb={0.3}>
                      <Typography variant="caption">{p.mes}</Typography>
                      <Typography variant="caption" fontWeight={700}>
                        {p.mae} h · {p.registros} reg.
                      </Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min((p.mae / 48) * 100, 100)}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </Stack>
            ) : (
              <Typography color="text.secondary">Sin datos históricos aún.</Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Tramos con mayor error */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            Top 5 tramos con mayor error de estimación
          </Typography>
          {metricas && metricas.tramosConMayorError.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Origen</TableCell>
                    <TableCell>Destino</TableCell>
                    <TableCell align="right">MAE (horas)</TableCell>
                    <TableCell align="right">Viajes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metricas.tramosConMayorError.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{t.origen}</TableCell>
                      <TableCell>{t.destino}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${t.maeHoras} h`}
                          size="small"
                          color={t.maeHoras > 12 ? 'error' : t.maeHoras > 6 ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="right">{t.cantidadViajes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">Sin datos suficientes aún.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Alertas de riesgo */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Alertas de riesgo de demora activas
            </Typography>
            {alertas.length > 0 && (
              <Chip label={alertas.length} color="error" size="small" />
            )}
          </Stack>
          {alertas.length === 0 ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'success.main' }}>
              <CheckCircleIcon fontSize="small" />
              <Typography variant="body2">Sin alertas activas en este momento.</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {alertas.map((a) => (
                <Paper
                  key={a.id}
                  variant="outlined"
                  sx={{ p: 2, borderLeft: '4px solid #e65100', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                      <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                      <Typography variant="body2" fontWeight={700}>
                        {a.codigoSeguimiento}
                      </Typography>
                      <Chip
                        label={`${Math.round(a.probabilidadDemora * 100)}% riesgo`}
                        size="small"
                        color="warning"
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {a.causaPrincipal}
                    </Typography>
                  </Box>
                  <Tooltip title="Marcar como gestionada">
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      onClick={() => handleGestionar(a.id)}
                    >
                      Gestionar
                    </Button>
                  </Tooltip>
                </Paper>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Reentrenamiento */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Reentrenamiento del modelo</Typography>
              <Typography variant="body2" color="text.secondary">
                {metricas?.puedeReentrenar
                  ? `Hay ${metricas.nuevosRegistros30Dias} nuevos registros disponibles. El modelo puede actualizarse.`
                  : `Se necesitan al menos 50 registros en los últimos 30 días. Actualmente hay ${metricas?.nuevosRegistros30Dias ?? 0}.`}
              </Typography>
            </Box>
            <Tooltip title={metricas?.puedeReentrenar ? 'Iniciar reentrenamiento' : 'Datos insuficientes'}>
              <span>
                <Button
                  variant="contained"
                  startIcon={reentrenando ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
                  onClick={handleReentrenar}
                  disabled={!metricas?.puedeReentrenar || reentrenando}
                >
                  {reentrenando ? 'Reentrenando...' : 'Reentrenar modelo'}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackbar('')} icon={<CheckCircleIcon />}>
          {snackbar}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!snackbarError}
        autoHideDuration={5000}
        onClose={() => setSnackbarError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarError('')} icon={<ErrorOutlineIcon />}>
          {snackbarError}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="h4" fontWeight={800} sx={{ color }}>
          {value}
        </Typography>
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </CardContent>
    </Card>
  )
}

function ErrorBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.3}>
        <Typography variant="caption">{label}</Typography>
        <Typography variant="caption" fontWeight={700}>{value}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{ height: 8, borderRadius: 4, bgcolor: `${color}22`, '& .MuiLinearProgress-bar': { bgcolor: color } }}
      />
    </Box>
  )
}
