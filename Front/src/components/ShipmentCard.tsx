import { Card, CardContent, CardActions, Typography, Chip, Button, Box, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import type { Shipment } from '../types'

interface ShipmentCardProps {
  shipment: Shipment
}

function ShipmentCard({ shipment }: ShipmentCardProps) {
  const navigate = useNavigate()

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendiente de calendarización':
      case 'Listo para salir':
        return 'default'
      case 'En tránsito':
        return 'info'
      case 'Entregado':
        return 'success'
      case 'Cancelado':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PendienteDeCalendarizacion':
        return 'Pendiente de calendarización'
      case 'ListoParaSalir':
        return 'Listo para salir'
      case 'EnTransito':
        return 'En tránsito'
      case 'Entregado':
        return 'Entregado'
      case 'Cancelado':
        return 'Cancelado'
      default:
        return status
    }
  }

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
              label={getStatusLabel(shipment.status)}
              color={getStatusColor(shipment.status) as any}
              size="small"
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
