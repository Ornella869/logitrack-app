import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import HistoryIcon from '@mui/icons-material/History'
import RefreshIcon from '@mui/icons-material/Refresh'
import StatusBadge from '../../components/StatusBadge'
import { shipmentService } from '../../services/shipmentService'
import type { Shipment } from '../../types'
import { dateOnly, formatArgentinaDateInput, formatDateOnlyEs } from '../../utils/argentinaDate'

const isFinal = (shipment: Shipment) => shipment.status === 'Entregado' || shipment.status === 'Cancelado' || shipment.status === 'Retornando a sucursal' || shipment.status === 'Retornado a sucursal'

const scheduledDate = (shipment: Shipment) =>
  shipment.fechaCalendarizada ? dateOnly(shipment.fechaCalendarizada) : null

export default function RepartidorHistorialPage({ permissions }: { permissions: Set<string> }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setShipments(await shipmentService.getMyShipments())
    } catch {
      setError('No se pudieron cargar los envios anteriores.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const historial = useMemo(() => {
    const today = formatArgentinaDateInput()
    return shipments
      .filter((shipment) => {
        const fecha = scheduledDate(shipment)
        return isFinal(shipment) || Boolean(fecha && fecha < today)
      })
      .sort((a, b) => {
        const fa = scheduledDate(a) ?? a.createdDate
        const fb = scheduledDate(b) ?? b.createdDate
        return fb.localeCompare(fa)
      })
  }, [shipments])
  const canViewDetail = permissions.has('envios_detalle')

  const hoyFinalizados = historial.filter((shipment) => scheduledDate(shipment) === formatArgentinaDateInput() && isFinal(shipment)).length
  const diasAnteriores = historial.filter((shipment) => {
    const fecha = scheduledDate(shipment)
    return Boolean(fecha && fecha < formatArgentinaDateInput())
  }).length

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2, gap: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            width: '100%',
          }}
        >
          <Box sx={{ width: '100%' }}>
            <Typography variant="h4" fontWeight={700}>
              <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Envios pasados
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Historial de paradas finalizadas hoy y envios asignados de dias anteriores.
            </Typography>
          </Box>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Actualizar historial">
            <span>
              <IconButton
                onClick={load}
                disabled={loading}
                sx={{
                  bgcolor: '#eaf4ff',
                  color: '#1976d2',
                  border: '1px solid #cfe3fb',
                  borderRadius: 2,
                  '&:hover': { bgcolor: '#dcecff' },
                  '&.Mui-disabled': {
                    bgcolor: '#eef5fc',
                    color: '#8aa8c7',
                    borderColor: '#d8e5f3',
                  },
                }}
              >
                {loading ? <CircularProgress size={18} /> : <RefreshIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 4, mb: 3 }}>
        <Chip label={`${historial.length} envios`} />
        <Chip label={`${hoyFinalizados} finalizados hoy`} color="success" variant="outlined" />
        <Chip label={`${diasAnteriores} de dias anteriores`} color="warning" variant="outlined" />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : historial.length === 0 ? (
        <Alert severity="info">Todavia no hay envios pasados para mostrar.</Alert>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {historial.map((shipment) => (
            <Card key={shipment.id} variant="outlined" sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Tracking
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        {shipment.trackingId}
                      </Typography>
                    </Box>
                    <StatusBadge status={shipment.status} />
                  </Stack>

                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>{shipment.receiver.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {shipment.receiver.address}, {shipment.receiver.city}
                    </Typography>
                  </Box>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip
                      size="small"
                      label={shipment.fechaCalendarizada
                        ? formatDateOnlyEs(shipment.fechaCalendarizada, { weekday: 'short', day: '2-digit', month: 'short' })
                        : 'Sin fecha'}
                      variant="outlined"
                    />
                    <Chip size="small" label={`${shipment.weight} kg`} variant="outlined" />
                  </Stack>

                  {canViewDetail && (
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => navigate(`/shipment/${shipment.id}`)}
                    >
                      Ver detalle
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tracking</TableCell>
                <TableCell>Fecha</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell>Peso</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Accion</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historial.map((shipment) => (
                <TableRow key={shipment.id} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{shipment.trackingId}</TableCell>
                  <TableCell>
                    {shipment.fechaCalendarizada
                      ? formatDateOnlyEs(shipment.fechaCalendarizada, { weekday: 'short', day: '2-digit', month: 'short' })
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{shipment.receiver.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {shipment.receiver.address}, {shipment.receiver.city}
                    </Typography>
                  </TableCell>
                  <TableCell>{shipment.weight} kg</TableCell>
                  <TableCell><StatusBadge status={shipment.status} /></TableCell>
                  <TableCell align="right">
                    {canViewDetail && (
                      <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/shipment/${shipment.id}`)}>
                        Ver detalle
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
