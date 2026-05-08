import { Card, CardContent, CardActions, Typography, Chip, Button, Box, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import type { Shipment } from '../types'

interface ShipmentCardProps {
  shipment: Shipment
}

const STATUS_STYLES: Record<string, { color: string; bg: string }> = {
  'Pendiente de calendarización': { color: '#e65100', bg: '#fff3e0' },
  'Asignado a vehículo': { color: '#1565c0', bg: '#e3f2fd' },
  'Cargado en vehículo': { color: '#1976d2', bg: '#e8f0fe' },
  'Listo para salir': { color: '#00695c', bg: '#e0f2f1' },
  'En tránsito': { color: '#2e7d32', bg: '#e8f5e9' },
  Entregado: { color: '#1b5e20', bg: '#c8e6c9' },
  Cancelado: { color: '#b71c1c', bg: '#fce4ec' },
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'PendienteDeCalendarizacion': return 'Pendiente de calendarización'
    case 'AsignadoAVehiculo': return 'Asignado a vehículo'
    case 'CargadoEnVehiculo': return 'Cargado en vehículo'
    case 'ListoParaSalir': return 'Listo para salir'
    case 'EnTransito': return 'En tránsito'
    case 'Entregado': return 'Entregado'
    case 'Cancelado': return 'Cancelado'
    default: return status
  }
}

function ShipmentCard({ shipment }: ShipmentCardProps) {
  const navigate = useNavigate()
  const statusLabel = getStatusLabel(shipment.status)
  const statusStyle = STATUS_STYLES[statusLabel] ?? { color: '#555', bg: '#eee' }

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography color="textSecondary" gutterBottom>
          {shipment.trackingId}
        </Typography>
        <Typography variant="h6" gutterBottom>
          {shipment.description}
        </Typography>
        <Stack spacing={1}>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Origen → Destino
            </Typography>
            <Typography variant="body1">
              {shipment.origin} → {shipment.destination}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Remitente
            </Typography>
            <Typography variant="body1">{shipment.sender.name}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Destinatario
            </Typography>
            <Typography variant="body1">{shipment.receiver.name}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Estado
            </Typography>
            <Chip
              label={statusLabel}
              size="small"
              sx={{ color: statusStyle.color, bgcolor: statusStyle.bg, border: `1px solid ${statusStyle.color}33`, fontWeight: 600, borderRadius: 1 }}
            />
          </Box>
          {shipment.createdDate && (
            <Box>
              <Typography variant="body2" color="textSecondary">
                Creado
              </Typography>
              <Typography variant="caption">{shipment.createdDate}</Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
      <CardActions>
        <Button size="small" onClick={() => navigate(`/shipment/${shipment.id}`)}>
          Ver detalles
        </Button>
      </CardActions>
    </Card>
  )
}

export default ShipmentCard
