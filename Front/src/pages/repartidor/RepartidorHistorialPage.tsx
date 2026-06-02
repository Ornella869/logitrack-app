import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import HistoryIcon from '@mui/icons-material/History'
import StatusBadge from '../../components/StatusBadge'
import { shipmentService } from '../../services/shipmentService'
import type { Shipment } from '../../types'
import { dateOnly, formatArgentinaDateInput, formatDateOnlyEs } from '../../utils/argentinaDate'

const isFinal = (shipment: Shipment) => shipment.status === 'Entregado' || shipment.status === 'Cancelado'

const scheduledDate = (shipment: Shipment) =>
  shipment.fechaCalendarizada ? dateOnly(shipment.fechaCalendarizada) : null

export default function RepartidorHistorialPage() {
  const navigate = useNavigate()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setShipments(await shipmentService.getAllShipments())
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

  const hoyFinalizados = historial.filter((shipment) => scheduledDate(shipment) === formatArgentinaDateInput() && isFinal(shipment)).length
  const diasAnteriores = historial.filter((shipment) => {
    const fecha = scheduledDate(shipment)
    return Boolean(fecha && fecha < formatArgentinaDateInput())
  }).length

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2, gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Envios pasados
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Historial de paradas finalizadas hoy y envios asignados de dias anteriores.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/repartidor')}>
            Mi ruta
          </Button>
          <Button variant="outlined" onClick={load} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
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
                    <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/shipment/${shipment.id}`)}>
                      Ver detalle
                    </Button>
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
