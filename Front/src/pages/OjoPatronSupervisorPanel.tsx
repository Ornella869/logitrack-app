import { useEffect, useState } from 'react'
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
  Typography,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import RefreshIcon from '@mui/icons-material/Refresh'
import { ojoPatronService, type MetricaOjoPatron, type OverrideOjoPatron } from '../services/ojoPatronService'
import { formatInstantArgentina } from '../utils/argentinaDate'

export default function OjoPatronSupervisorPanel() {
  const [overrides, setOverrides] = useState<OverrideOjoPatron[]>([])
  const [metricas, setMetricas] = useState<MetricaOjoPatron[]>([])
  const [loading, setLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [solicitudes, historicas] = await Promise.all([
        ojoPatronService.getOverrides(),
        ojoPatronService.getMetricasHistoricas(),
      ])
      setOverrides(solicitudes)
      setMetricas(historicas)
    } catch {
      setError('No se pudo cargar la información del Ojo del Patrón.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const resolver = async (item: OverrideOjoPatron, aprobado: boolean) => {
    setResolvingId(item.id)
    setError('')
    try {
      const actualizado = await ojoPatronService.resolverOverride(
        item.id,
        aprobado,
        aprobado ? 'Autorizado por supervisor.' : 'Rechazado por supervisor.',
      )
      setOverrides((prev) => prev.map((o) => (o.id === item.id ? actualizado : o)))
    } catch {
      setError('No se pudo resolver la solicitud.')
    } finally {
      setResolvingId(null)
    }
  }

  const pendientes = overrides.filter((o) => o.estado === 'Pendiente')

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 3 }} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Ojo del Patrón</Typography>
          <Typography variant="body2" color="text.secondary">
            Autorizaciones manuales y métricas históricas de repartidores de tu sucursal.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Actualizar</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} md={5}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Solicitudes de autorización</Typography>
                {pendientes.length === 0 ? (
                  <Alert severity="info">No hay solicitudes pendientes.</Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {pendientes.map((item) => (
                      <Card variant="outlined" key={item.id}>
                        <CardContent>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Typography variant="subtitle2">Prueba: {item.momento}</Typography>
                            <Chip size="small" label={item.estado} color="warning" />
                          </Stack>
                          <Typography variant="body2" sx={{ mt: 1 }}>{item.motivo}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatInstantArgentina(item.solicitadoEn)}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                            <Button
                              size="small"
                              color="success"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => resolver(item, true)}
                              disabled={resolvingId === item.id}
                            >
                              Aprobar
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              startIcon={<CancelIcon />}
                              onClick={() => resolver(item, false)}
                              disabled={resolvingId === item.id}
                            >
                              Rechazar
                            </Button>
                          </Stack>
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={7}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Métricas históricas</Typography>
                {metricas.length === 0 ? (
                  <Alert severity="info">Todavía no hay pruebas registradas.</Alert>
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Repartidor</TableCell>
                          <TableCell>Aprobadas</TableCell>
                          <TableCell>Fallidas</TableCell>
                          <TableCell>Overrides</TableCell>
                          <TableCell>Promedio</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {metricas.map((m) => (
                          <TableRow key={m.repartidorId}>
                            <TableCell>{m.repartidorNombre}</TableCell>
                            <TableCell>{m.aprobadas}</TableCell>
                            <TableCell>{m.fallidas}</TableCell>
                            <TableCell>{m.overridesAprobados}</TableCell>
                            <TableCell>{Math.round(m.promedioAlertness * 100)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
