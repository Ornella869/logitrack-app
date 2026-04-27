import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import RefreshIcon from '@mui/icons-material/Refresh'
import { shipmentService } from '../../services/shipmentService'
import type { Shipment } from '../../types'

// Sprint 1 — Repartidor: listado de envíos accionables.
// G1L-9: el repartidor cambia estado de los paquetes desde el detalle.
// En Sprint 1 todavía no hay calendarización (Sprint 2), por eso muestra TODOS
// los paquetes en estados accionables ("Listo para salir" y "En tránsito").
// Cuando llegue Sprint 2 se filtrará por los asignados al repartidor logueado.

const TAB_LABELS = [
  { value: 'Listo para salir', label: 'Para iniciar', icon: <HourglassTopIcon fontSize="small" /> },
  { value: 'En tránsito', label: 'En tránsito', icon: <LocalShippingIcon fontSize="small" /> },
] as const

export default function RepartidorDashboard() {
  const navigate = useNavigate()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<typeof TAB_LABELS[number]['value']>('Listo para salir')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await shipmentService.getAllShipments()
      setShipments(data)
    } catch {
      setError('No se pudieron cargar los envíos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () => shipments.filter((s) => s.status === tab),
    [shipments, tab],
  )

  const counts = useMemo(
    () => ({
      'Listo para salir': shipments.filter((s) => s.status === 'Listo para salir').length,
      'En tránsito': shipments.filter((s) => s.status === 'En tránsito').length,
    }),
    [shipments],
  )

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Mis envíos
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Gestioná las entregas asignadas — confirmá retiro, marcá como entregado o registrá una incidencia.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>
          Actualizar
        </Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {TAB_LABELS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            iconPosition="start"
            icon={t.icon}
            label={`${t.label} (${counts[t.value]})`}
          />
        ))}
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info">
          {tab === 'Listo para salir'
            ? 'No hay envíos listos para iniciar la entrega en este momento.'
            : 'No hay envíos en tránsito.'}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((s) => (
            <Grid item xs={12} sm={6} md={4} key={s.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                      {s.trackingId}
                    </Typography>
                    <Chip
                      size="small"
                      label={s.status}
                      color={s.status === 'En tránsito' ? 'info' : 'default'}
                    />
                  </Stack>

                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Para:</strong> {s.receiver.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                    {s.receiver.address}, {s.receiver.city} ({s.receiver.postalCode})
                  </Typography>
                  {s.receiver.phone && (
                    <Typography variant="body2" color="textSecondary">
                      Tel: {s.receiver.phone}
                    </Typography>
                  )}
                  <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 1 }}>
                    {s.tipoEnvio ?? '-'} · {s.tipoPaquete ?? '-'} · {s.weight} kg
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(`/shipment/${s.id}`)}
                  >
                    {tab === 'Listo para salir' ? 'Iniciar entrega' : 'Ver y gestionar'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}
