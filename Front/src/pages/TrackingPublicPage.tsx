import { useEffect, useMemo, useState } from 'react'
import { useParams, Link as RouterLink } from 'react-router-dom'
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
  Typography,
} from '@mui/material'
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined'
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined'
import { shipmentService } from '../services/shipmentService'
import type { Shipment } from '../types'

type TimelineStep = {
  key: string
  label: string
  done: boolean
  active: boolean
}

type PublicStatusCopy = {
  badge: string
  title: string
  description: string
  badgeColor: string
  badgeBg: string
}

const getPublicStatusCopy = (status: Shipment['status']): PublicStatusCopy => {
  switch (status) {
    case 'Pendiente de calendarización':
      return {
        badge: 'Preparando envio',
        title: 'Estamos preparando tu envio',
        description: 'Recibimos tu solicitud y el paquete esta esperando la planificacion de despacho.',
        badgeColor: '#7B5E00',
        badgeBg: '#FFF3CD',
      }
    case 'Listo para salir':
      return {
        badge: 'Listo para despacho',
        title: 'Tu paquete esta listo para despacho',
        description: 'El envio ya fue preparado y sera asignado a la salida correspondiente.',
        badgeColor: '#E65100',
        badgeBg: '#FFF3E0',
      }
    case 'En tránsito':
      return {
        badge: 'En camino',
        title: 'Tu paquete esta en camino',
        description: 'El envio ya salio y se encuentra en traslado hacia su destino.',
        badgeColor: '#0D47A1',
        badgeBg: '#E3F2FD',
      }
    case 'Entregado':
      return {
        badge: 'Entregado',
        title: 'Tu paquete fue entregado',
        description: 'La entrega fue registrada correctamente en el destino informado.',
        badgeColor: '#1B5E20',
        badgeBg: '#E8F5E9',
      }
    case 'Cancelado':
      return {
        badge: 'Cancelado',
        title: 'Tu envio fue cancelado',
        description: 'El proceso de entrega fue interrumpido. Revisa el detalle informado por LogiTrack.',
        badgeColor: '#7F0000',
        badgeBg: '#FFEBEE',
      }
  }
}

const buildTimeline = (status: Shipment['status']): TimelineStep[] => {
  const currentIndexByStatus: Record<Shipment['status'], number> = {
    'Pendiente de calendarización': 0,
    'Listo para salir': 1,
    'En tránsito': 2,
    Entregado: 3,
    Cancelado: 2,
  }

  const currentIndex = currentIndexByStatus[status] ?? 0

  return [
    { key: 'created', label: 'Pedido registrado', done: currentIndex >= 0, active: currentIndex === 0 },
    { key: 'ready', label: 'Preparado para despacho', done: currentIndex >= 1, active: currentIndex === 1 },
    { key: 'transit', label: status === 'Cancelado' ? 'Proceso interrumpido' : 'En tránsito', done: currentIndex >= 2, active: currentIndex === 2 },
    { key: 'final', label: status === 'Cancelado' ? 'Envío cancelado' : 'Entregado', done: status === 'Entregado' || status === 'Cancelado', active: currentIndex === 3 },
  ]
}

const formatDate = (date: string) => {
  if (!date) return 'No disponible'
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))
}

export default function TrackingPublicPage() {
  const { trackingId } = useParams<{ trackingId: string }>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadShipment = async () => {
      if (!trackingId) {
        setError('No se recibió un código de seguimiento válido.')
        setLoading(false)
        return
      }

      const data = await shipmentService.getShipmentByTrackingCode(trackingId)

      if (!data) {
        setError('No encontramos un envío asociado a ese código de seguimiento.')
      } else {
        setShipment(data)
      }

      setLoading(false)
    }

    loadShipment()
  }, [trackingId])

  const timeline = useMemo(() => buildTimeline(shipment?.status ?? 'Pendiente de calendarización'), [shipment?.status])
  const publicStatus = useMemo(
    () => getPublicStatusCopy(shipment?.status ?? 'Pendiente de calendarización'),
    [shipment?.status],
  )

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 4, md: 8 },
        background: 'linear-gradient(180deg, #F4F7FB 0%, #FFFFFF 100%)',
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="overline" sx={{ letterSpacing: 3, fontWeight: 800, color: '#0D47A1' }}>
              LOGITRACK
            </Typography>
            <Typography variant="h3" sx={{ mt: 1, fontWeight: 800, fontSize: { xs: '2rem', md: '2.75rem' } }}>
              Seguimiento de envío
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Consultá el estado actualizado de tu paquete con tu código de seguimiento.
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : error || !shipment ? (
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Stack spacing={2} alignItems="flex-start">
                  <Alert severity="warning" sx={{ width: '100%' }}>{error || 'No pudimos cargar el seguimiento.'}</Alert>
                  <Button component={RouterLink} to="/" variant="contained">Ir al inicio</Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card sx={{ borderRadius: 4, boxShadow: '0 20px 45px rgba(15, 23, 42, 0.08)' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Stack spacing={3}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary">Tracking ID</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800 }}>{shipment.trackingId}</Typography>
                      </Box>
                      <Chip
                        label={publicStatus.badge}
                        sx={{
                          fontWeight: 700,
                          color: publicStatus.badgeColor,
                          backgroundColor: publicStatus.badgeBg,
                          border: `1px solid ${publicStatus.badgeColor}33`,
                          borderRadius: 1,
                        }}
                      />
                    </Stack>

                    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#0F172A' }}>
                        {publicStatus.title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.75, color: '#334155' }}>
                        {publicStatus.description}
                      </Typography>
                    </Box>

                    <Divider />

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1, p: 2.5, borderRadius: 3, bgcolor: '#F8FAFC' }}>
                        <Typography variant="body2" color="text.secondary">Origen</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{shipment.origin}</Typography>
                        <Typography variant="body2" color="text.secondary">CP {shipment.sender.postalCode}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 2.5, borderRadius: 3, bgcolor: '#F8FAFC' }}>
                        <Typography variant="body2" color="text.secondary">Destino</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{shipment.destination}</Typography>
                        <Typography variant="body2" color="text.secondary">CP {shipment.receiver.postalCode}</Typography>
                      </Box>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">Fecha de alta</Typography>
                        <Typography sx={{ fontWeight: 600 }}>{formatDate(shipment.createdDate)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">Tipo de envío</Typography>
                        <Typography sx={{ fontWeight: 600 }}>{shipment.tipoEnvio ?? 'No disponible'}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" color="text.secondary">Tipo de paquete</Typography>
                        <Typography sx={{ fontWeight: 600 }}>{shipment.tipoPaquete ?? 'No disponible'}</Typography>
                      </Box>
                    </Stack>

                    {shipment.cancellationReason && (
                      <Alert severity="error">Motivo de cancelación: {shipment.cancellationReason}</Alert>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4, boxShadow: '0 20px 45px rgba(15, 23, 42, 0.06)' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 800 }}>
                    Estado del envío
                  </Typography>
                  <Stack spacing={2.5}>
                    {timeline.map((step, index) => {
                      const isCancelledFinal = shipment.status === 'Cancelado' && index === timeline.length - 1
                      const isDeliveredFinal = shipment.status === 'Entregado' && index === timeline.length - 1
                      const iconColor = isCancelledFinal
                        ? '#B71C1C'
                        : isDeliveredFinal
                          ? '#1B5E20'
                          : step.done
                            ? '#1565C0'
                            : '#94A3B8'
                      const icon = isCancelledFinal
                        ? <CancelOutlinedIcon sx={{ color: iconColor }} />
                        : index === timeline.length - 1
                          ? <CheckCircleOutlineOutlinedIcon sx={{ color: iconColor }} />
                          : index === 2
                            ? <LocalShippingOutlinedIcon sx={{ color: iconColor }} />
                            : <Inventory2OutlinedIcon sx={{ color: iconColor }} />

                      return (
                        <Stack key={step.key} direction="row" spacing={2} alignItems="flex-start">
                          <Box
                            sx={{
                              width: 42,
                              height: 42,
                              borderRadius: '50%',
                              bgcolor: step.done ? `${iconColor}18` : '#E2E8F0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {icon}
                          </Box>
                          <Box sx={{ pt: 0.5 }}>
                            <Typography sx={{ fontWeight: step.active || step.done ? 700 : 500 }}>
                              {step.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {step.active
                                ? 'Este es el estado actual informado por LogiTrack.'
                                : step.done
                                  ? 'Hito completado.'
                                  : 'Pendiente de actualización.'}
                            </Typography>
                          </Box>
                        </Stack>
                      )
                    })}
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
