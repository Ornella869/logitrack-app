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
  Container,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import HistoryIcon from '@mui/icons-material/History'
import { shipmentService } from '../services/shipmentService'
import { incidenciaService, type Incidencia } from '../services/incidenciaService'
import ReportarIncidenteClienteDialog from '../components/ReportarIncidenteClienteDialog'
import type { Shipment, User } from '../types'
import { formatDateOnlyEs } from '../utils/argentinaDate'

const STATUS_CONFIG: Record<Shipment['status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  'Pendiente de calendarización': { label: 'En preparación', color: '#7B5E00', bg: '#FFF3CD', icon: <LocalShippingOutlinedIcon /> },
  'Asignado a vehículo': { label: 'Programado', color: '#4527A0', bg: '#EDE7F6', icon: <LocalShippingOutlinedIcon /> },
  'Cargado en vehículo': { label: 'Cargado', color: '#311B92', bg: '#D1C4E9', icon: <LocalShippingOutlinedIcon /> },
  'Listo para salir': { label: 'Listo para despacho', color: '#E65100', bg: '#FFF3E0', icon: <LocalShippingOutlinedIcon /> },
  'En tránsito': { label: 'En camino', color: '#0D47A1', bg: '#E3F2FD', icon: <LocalShippingOutlinedIcon /> },
  'Demorado': { label: 'Demorado', color: '#BF360C', bg: '#FFE0B2', icon: <LocalShippingOutlinedIcon /> },
  'Entregado': { label: 'Entregado', color: '#1B5E20', bg: '#E8F5E9', icon: <CheckCircleOutlineIcon /> },
  'Cancelado': { label: 'Cancelado', color: '#7F0000', bg: '#FFEBEE', icon: <CancelOutlinedIcon /> },
}

const ESTADOS_BLOQUEADOS: Shipment['status'][] = [
  'Pendiente de calendarización',
  'Asignado a vehículo',
  'Cargado en vehículo',
  'Listo para salir',
]

const TIPO_LABEL: Record<string, string> = {
  no_llego: 'No llegó',
  llego_danado: 'Llegó dañado',
  llego_tarde: 'Llegó tarde',
  otro: 'Otro',
  accident: 'Accidente',
  mechanical: 'Problema mecánico',
  danger: 'Zona de riesgo',
  health: 'Problema de salud',
  delivery: 'Problema de entrega',
}

const ESTADO_INCIDENCIA_COLOR: Record<string, { color: string; bg: string }> = {
  Abierta: { color: '#c62828', bg: '#fdecea' },
  'En Revisión': { color: '#e65100', bg: '#fff3e0' },
  Resuelta: { color: '#2e7d32', bg: '#e8f5e9' },
}

function canReportIncidencia(shipment: Shipment): boolean {
  return !ESTADOS_BLOQUEADOS.includes(shipment.status)
}

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  return formatDateOnlyEs(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function ClienteDashboard() {
  const user = useOutletContext<User>()
  const [query, setQuery] = useState('')
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [misIncidencias, setMisIncidencias] = useState<Incidencia[]>([])

  useEffect(() => {
    if (!shipment) {
      setMisIncidencias([])
      return
    }
    void incidenciaService.getAll()
      .then((items) => setMisIncidencias(items.filter((i) => i.origen === 'cliente' && i.repartidorId === `cliente_${shipment.trackingId}`)))
      .catch(() => setMisIncidencias([]))
  }, [shipment])

  const handleSearch = async () => {
    const trackingId = query.trim()
    if (!trackingId) return
    setSearching(true)
    setNotFound(false)
    setShipment(null)
    const found = await shipmentService.getShipmentByTrackingCode(trackingId)
    if (found) {
      setShipment(found)
    } else {
      setNotFound(true)
    }
    setSearching(false)
  }

  const statusCfg = shipment ? STATUS_CONFIG[shipment.status] : null
  const canReport = shipment ? canReportIncidencia(shipment) : false

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={4}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Bienvenido, {user.name}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Consultá el estado de tu envío e informá cualquier problema.
          </Typography>
        </Box>

        {/* Búsqueda */}
        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              Rastrear mi envío
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ingresá tu código de seguimiento (ej: LOG-2024-003)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
                disabled={searching}
              />
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={() => void handleSearch()}
                disabled={searching || !query.trim()}
                sx={{ minWidth: 120, fontWeight: 600 }}
              >
                {searching ? <CircularProgress size={18} color="inherit" /> : 'Buscar'}
              </Button>
            </Stack>

            {notFound && (
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                No encontramos ningún envío con ese código. Verificá que sea correcto.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Resultado */}
        {shipment && statusCfg && (
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Tracking ID</Typography>
                  <Typography variant="h6" fontWeight={800}>{shipment.trackingId}</Typography>
                </Box>
                <Chip
                  label={statusCfg.label}
                  sx={{ fontWeight: 700, color: statusCfg.color, bgcolor: statusCfg.bg, border: `1px solid ${statusCfg.color}33` }}
                />
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                  <Typography variant="caption" color="text.secondary">Origen</Typography>
                  <Typography fontWeight={600}>{shipment.origin}</Typography>
                </Box>
                <Box sx={{ flex: 1, p: 2, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                  <Typography variant="caption" color="text.secondary">Destino</Typography>
                  <Typography fontWeight={600}>{shipment.destination}</Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: canReport ? 2 : 0 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Fecha de alta</Typography>
                  <Typography fontWeight={600}>{formatFecha(shipment.createdDate)}</Typography>
                </Box>
                {(shipment.fechaEstimadaEntrega || shipment.fechaCalendarizada) && (
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">Entrega estimada</Typography>
                    <Typography fontWeight={600}>{formatFecha(shipment.fechaEstimadaEntrega ?? shipment.fechaCalendarizada)}</Typography>
                  </Box>
                )}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Tipo de envío</Typography>
                  <Typography fontWeight={600}>{shipment.tipoEnvio ?? '—'}</Typography>
                </Box>
              </Stack>

              {canReport && (
                <Box sx={{ pt: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ReportProblemOutlinedIcon />}
                    onClick={() => setDialogOpen(true)}
                    sx={{
                      color: '#c62828',
                      borderColor: '#c62828',
                      fontWeight: 600,
                      borderRadius: 2,
                      '&:hover': { bgcolor: 'rgba(198,40,40,0.06)', borderColor: '#b71c1c' },
                    }}
                  >
                    Reportar una incidencia
                  </Button>
                </Box>
              )}

              {!canReport && shipment && (
                <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
                  Solo se pueden reportar incidencias sobre envíos entregados, cancelados o con SLA vencido.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mis incidencias sobre este envío */}
        {shipment && misIncidencias.length > 0 && (
          <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <HistoryIcon color="action" />
                <Typography variant="subtitle1" fontWeight={700}>
                  Incidencias reportadas para este envío
                </Typography>
              </Stack>
              <Stack spacing={1.5}>
                {misIncidencias.map((inc) => {
                  const estadoCfg = ESTADO_INCIDENCIA_COLOR[inc.estado] ?? ESTADO_INCIDENCIA_COLOR['Abierta']
                  return (
                    <Box key={inc.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FAFAFA' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {TIPO_LABEL[inc.tipo] ?? inc.tipoLabel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFecha(inc.fechaReporte)} · ID: {inc.id}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>{inc.descripcion}</Typography>
                        </Box>
                        <Chip
                          label={inc.estado}
                          size="small"
                          sx={{ fontWeight: 700, color: estadoCfg.color, bgcolor: estadoCfg.bg, border: `1px solid ${estadoCfg.color}`, flexShrink: 0, ml: 1 }}
                        />
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>

      {shipment && (
        <ReportarIncidenteClienteDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          shipment={shipment}
        />
      )}
    </Container>
  )
}
