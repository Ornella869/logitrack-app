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
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import StarIcon from '@mui/icons-material/Star'
import { shipmentService } from '../services/shipmentService'
import { pickupService } from '../services/pickupService'
import ReportarIncidenteClienteDialog from '../components/ReportarIncidenteClienteDialog'
import CalificacionPickUpDialog from '../components/CalificacionPickUpDialog'
import type { Shipment } from '../types'
import { formatDateOnlyEs } from '../utils/argentinaDate'

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
    case 'Asignado a vehículo':
      return {
        badge: 'Programado',
        title: 'Tu envio fue programado',
        description: 'Asignamos tu paquete a un repartidor y a una fecha de salida.',
        badgeColor: '#4527A0',
        badgeBg: '#EDE7F6',
      }
    case 'Cargado en vehículo':
      return {
        badge: 'Cargado',
        title: 'Tu paquete fue cargado al vehículo',
        description: 'El repartidor ya tiene tu paquete a bordo, listo para iniciar la ruta.',
        badgeColor: '#311B92',
        badgeBg: '#D1C4E9',
      }
    case 'Listo para salir':
      return {
        badge: 'Listo para despacho',
        title: 'Tu paquete esta listo para despacho',
        description: 'El envio ya fue preparado y sera asignado a la salida correspondiente.',
        badgeColor: '#E65100',
        badgeBg: '#FFF3E0',
      }
    case 'Listo para retirar':
      return {
        badge: 'Listo para retirar',
        title: 'Tu paquete ya esta en el punto Pick Up',
        description: 'Acercate al punto Pick Up con el codigo de entrega para retirarlo.',
        badgeColor: '#00695C',
        badgeBg: '#E0F2F1',
      }
    case 'En tránsito':
      return {
        badge: 'En camino',
        title: 'Tu paquete esta en camino',
        description: 'El envio ya salio y se encuentra en traslado hacia su destino.',
        badgeColor: '#0D47A1',
        badgeBg: '#E3F2FD',
      }
    case 'En tránsito - Descanso':
      return {
        badge: 'En ruta — pausa nocturna',
        title: 'Tu paquete está en ruta (pausa nocturna)',
        description: 'El repartidor está descansando y retomará la entrega al día siguiente. No hay demoras en tu plazo de entrega.',
        badgeColor: '#37474F',
        badgeBg: '#ECEFF1',
      }
    case 'Demorado':
      return {
        badge: 'Demorado',
        title: 'Tu envio esta demorado',
        description: 'Se presento un imprevisto durante el recorrido. El repartidor retomara la ruta en cuanto se resuelva.',
        badgeColor: '#BF360C',
        badgeBg: '#FFE0B2',
      }
    case 'Entregado en punto':
      return {
        badge: 'En el local',
        title: 'Tu paquete llegó al Punto Pick Up',
        description: 'El repartidor depositó tu paquete en el local. Podés pasar a retirarlo cuando quieras dentro del horario de atención.',
        badgeColor: '#1565C0',
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
    'Asignado a vehículo': 1,
    'Cargado en vehículo': 1,
    'Listo para salir': 1,
    'En tránsito': 2,
    'Listo para retirar': 2,
    Demorado: 2,
    // G1L-119: descanso nocturno sigue siendo etapa de tránsito.
    'En tránsito - Descanso': 2,
    // G1L-132: depositado en el local, equivale a "en camino" visualmente.
    'Entregado en punto': 2,
    Entregado: 3,
    Cancelado: 2,
  }

  const currentIndex = currentIndexByStatus[status] ?? 0

  return [
    { key: 'created', label: 'Pedido registrado', done: currentIndex >= 0, active: currentIndex === 0 },
    { key: 'ready', label: 'Preparado para despacho', done: currentIndex >= 1, active: currentIndex === 1 },
    { key: 'transit', label: status === 'Cancelado' ? 'Proceso interrumpido' : status === 'Demorado' ? 'Demorado' : 'En tránsito', done: currentIndex >= 2, active: currentIndex === 2 },
    { key: 'final', label: status === 'Cancelado' ? 'Envío cancelado' : 'Entregado', done: status === 'Entregado' || status === 'Cancelado', active: currentIndex === 3 },
  ]
}

const formatDate = (date: string) => {
  if (!date) return 'No disponible'
  // El backend envía fechas en UTC o strings YYYY-MM-DD. 
  // Para las fechas estáticas (como fecha de alta o de entrega programada)
  // queremos mostrar el día exacto que es (sin importar que el shift horario lo pase al día anterior).
  return formatDateOnlyEs(date, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

// G1L-17: copy de la fecha estimada según el estado del envío.
// "En Preparación" mostramos "Fecha estimada"; en estados posteriores mostramos
// "Fecha de entrega programada" (ya hay un repartidor y un día asignado).
const fechaEstimadaLabel = (status: Shipment['status']): string => {
  if (status === 'Pendiente de calendarización') return 'Fecha estimada de despacho'
  if (status === 'Entregado' || status === 'Cancelado') return 'Fecha programada original'
  return 'Fecha de entrega programada'
}

const ESTADOS_BLOQUEADOS: Shipment['status'][] = ['Pendiente de calendarización', 'Listo para salir']

export default function TrackingPublicPage() {
  const { trackingId } = useParams<{ trackingId: string }>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [calificacionOpen, setCalificacionOpen] = useState(false)
  const [calificacionExistente, setCalificacionExistente] = useState<{
    estrellas: number; comentario?: string | null; autorNombre?: string | null
  } | null>(null)

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
        if (data.status === 'Entregado' && data.puntoPickUpId) {
          const check = await pickupService.checkCalificacion(trackingId).catch(() => null)
          if (check?.calificado) {
            setCalificacionExistente({ estrellas: check.estrellas!, comentario: check.comentario, autorNombre: check.autorNombre })
          }
        }
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

  const canReportIncidencia = useMemo(() => {
    if (!shipment) return false
    if (shipment.status === 'Entregado' || shipment.status === 'Cancelado') return true
    if (ESTADOS_BLOQUEADOS.includes(shipment.status)) return false
    const slaVencido = shipment.estimatedDelivery && new Date(shipment.estimatedDelivery) < new Date()
    return !!slaVencido
  }, [shipment])

  const enSucursal = shipment && (
    shipment.status === 'Pendiente de calendarización' ||
    shipment.status === 'Asignado a vehículo' ||
    shipment.status === 'Listo para salir'
  )

  return (
    <Box
      sx={{
        minHeight: '100vh',
        py: { xs: 4, md: 8 },
        background: 'linear-gradient(160deg, #060e1f 0%, #0d1f3c 50%, #122447 100%)',
      }}
    >
      <Container maxWidth="md">
        <Stack spacing={3}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="overline" sx={{ letterSpacing: 3, fontWeight: 800, color: '#60a5fa' }}>
              LOGITRACK
            </Typography>
            <Typography variant="h3" sx={{ mt: 1, fontWeight: 800, fontSize: { xs: '2rem', md: '2.75rem' }, color: '#f0f6ff' }}>
              Seguimiento de envío
            </Typography>
            <Typography sx={{ mt: 1, color: '#94a3b8' }}>
              Consultá el estado actualizado de tu paquete con tu código de seguimiento.
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress sx={{ color: '#3b82f6' }} />
            </Box>
          ) : error || !shipment ? (
            <Card sx={{ borderRadius: 3, background: '#1e293b', border: '1px solid #334155' }}>
              <CardContent>
                <Stack spacing={2} alignItems="flex-start">
                  <Alert severity="warning" sx={{ width: '100%' }}>{error || 'No pudimos cargar el seguimiento.'}</Alert>
                  <Button component={RouterLink} to="/" variant="contained">Ir al inicio</Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card sx={{ borderRadius: 4, background: '#1e293b', border: '1px solid #334155', boxShadow: '0 20px 45px rgba(0,0,0,0.4)' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Stack spacing={3}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Tracking ID</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#f0f6ff' }}>{shipment.trackingId}</Typography>
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

                    <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)' }}>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#e2e8f0' }}>
                        {publicStatus.title}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.75, color: '#94a3b8' }}>
                        {publicStatus.description}
                      </Typography>
                    </Box>

                    {/* Mapa: tu paquete está en la sucursal */}
                    {enSucursal && (
                      <Box>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                          <Inventory2OutlinedIcon sx={{ color: '#60a5fa', fontSize: 20 }} />
                          <Typography variant="subtitle2" sx={{ color: '#93c5fd', fontWeight: 700 }}>
                            Tu paquete está en nuestra sucursal de {shipment.origin}
                          </Typography>
                        </Stack>
                        <Box
                          component="iframe"
                          src={`https://maps.google.com/maps?q=${encodeURIComponent(shipment.origin + ', Argentina')}&output=embed&t=m&z=12`}
                          sx={{
                            width: '100%',
                            height: 220,
                            borderRadius: 2,
                            border: '1px solid #334155',
                            display: 'block',
                          }}
                          title="Ubicación de la sucursal"
                          loading="lazy"
                        />
                        <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
                          Aún no salió a reparto. Te notificaremos cuando esté en camino.
                        </Typography>
                      </Box>
                    )}

                    <Divider sx={{ borderColor: '#334155' }} />

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1, p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid #1e3a5f' }}>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Origen</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#e2e8f0' }}>{shipment.origin}</Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>CP {shipment.sender.postalCode}</Typography>
                      </Box>
                      <Box sx={{ flex: 1, p: 2.5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid #1e3a5f' }}>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Destino</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#e2e8f0' }}>{shipment.destination}</Typography>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>CP {shipment.receiver.postalCode}</Typography>
                      </Box>
                    </Stack>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Fecha de alta</Typography>
                        <Typography sx={{ fontWeight: 600, color: '#cbd5e1' }}>{formatDate(shipment.createdDate)}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Tipo de envío</Typography>
                        <Typography sx={{ fontWeight: 600, color: '#cbd5e1' }}>{shipment.tipoEnvio ?? 'No disponible'}</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Tipo de paquete</Typography>
                        <Typography sx={{ fontWeight: 600, color: '#cbd5e1' }}>{shipment.tipoPaquete ?? 'No disponible'}</Typography>
                      </Box>
                    </Stack>

                    {(shipment.fechaEstimadaEntrega || shipment.fechaCalendarizada) && (
                      <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
                        <Typography variant="body2" sx={{ color: '#92400e' }}>
                          {fechaEstimadaLabel(shipment.status)}
                        </Typography>
                        <Typography sx={{ fontWeight: 700, color: '#fbbf24' }}>
                          {formatDate(shipment.fechaEstimadaEntrega ?? shipment.fechaCalendarizada ?? '')}
                        </Typography>
                      </Box>
                    )}

                    {/* G1L-107: datos del punto Pick Up cuando el envío es modalidad retiro */}
                    {shipment.puntoPickUpId && (
                      <Box sx={{ p: 2.5, borderRadius: 3, bgcolor: 'rgba(20,184,166,0.08)', border: '1px solid rgba(20,184,166,0.3)' }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                          <StorefrontOutlinedIcon sx={{ color: '#2dd4bf', fontSize: 20 }} />
                          <Typography variant="subtitle2" sx={{ color: '#2dd4bf', fontWeight: 700 }}>
                            Punto de retiro
                          </Typography>
                        </Stack>
                        {shipment.puntoPickUpNombre && (
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#e2e8f0', mb: 1.5 }}>
                            {shipment.puntoPickUpNombre}
                          </Typography>
                        )}
                        <Stack spacing={1}>
                          {shipment.puntoPickUpDireccion && (
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                              <LocationOnOutlinedIcon sx={{ color: '#94a3b8', fontSize: 18, mt: 0.1, flexShrink: 0 }} />
                              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                                {shipment.puntoPickUpDireccion}{shipment.puntoPickUpLocalidad ? `, ${shipment.puntoPickUpLocalidad}` : ''}
                              </Typography>
                            </Stack>
                          )}
                          {shipment.puntoPickUpHorarios && (
                            <Stack direction="row" spacing={1} alignItems="flex-start">
                              <AccessTimeOutlinedIcon sx={{ color: '#94a3b8', fontSize: 18, mt: 0.1, flexShrink: 0 }} />
                              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                                {shipment.puntoPickUpHorarios}
                              </Typography>
                            </Stack>
                          )}
                          {shipment.puntoPickUpTelefono && (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <PhoneOutlinedIcon sx={{ color: '#94a3b8', fontSize: 18, flexShrink: 0 }} />
                              <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                                {shipment.puntoPickUpTelefono}
                              </Typography>
                            </Stack>
                          )}
                        </Stack>
                      </Box>
                    )}

                    {shipment.cancellationReason && (
                      <Alert severity="error">Motivo de cancelación: {shipment.cancellationReason}</Alert>
                    )}

                    {shipment.status === 'Entregado' && shipment.puntoPickUpId && (
                      <Box sx={{ pt: 1 }}>
                        <Button
                          variant="outlined"
                          startIcon={calificacionExistente ? <StarIcon sx={{ color: '#f59e0b' }} /> : <StarBorderIcon />}
                          onClick={() => setCalificacionOpen(true)}
                          sx={{
                            color: '#fbbf24',
                            borderColor: '#f59e0b',
                            fontWeight: 600,
                            borderRadius: 2,
                            '&:hover': { bgcolor: 'rgba(245,158,11,0.08)', borderColor: '#d97706' },
                          }}
                        >
                          {calificacionExistente ? `Tu calificación: ${'★'.repeat(calificacionExistente.estrellas)}` : 'Calificar Punto Pick Up'}
                        </Button>
                      </Box>
                    )}

                    {canReportIncidencia && (
                      <Box sx={{ pt: 1 }}>
                        <Button
                          variant="outlined"
                          startIcon={<ReportProblemOutlinedIcon />}
                          onClick={() => setReportDialogOpen(true)}
                          sx={{
                            color: '#f87171',
                            borderColor: '#f87171',
                            fontWeight: 600,
                            borderRadius: 2,
                            '&:hover': { bgcolor: 'rgba(248,113,113,0.08)', borderColor: '#ef4444' },
                          }}
                        >
                          Reportar una incidencia
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: 4, background: '#1e293b', border: '1px solid #334155', boxShadow: '0 20px 45px rgba(0,0,0,0.3)' }}>
                <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 800, color: '#f0f6ff' }}>
                    Estado del envío
                  </Typography>
                  <Stack spacing={2.5}>
                    {timeline.map((step, index) => {
                      const isCancelledFinal = shipment.status === 'Cancelado' && index === timeline.length - 1
                      const isDeliveredFinal = shipment.status === 'Entregado' && index === timeline.length - 1
                      const iconColor = isCancelledFinal
                        ? '#f87171'
                        : isDeliveredFinal
                          ? '#4ade80'
                          : step.done
                            ? '#60a5fa'
                            : '#475569'
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
                              bgcolor: step.done ? `${iconColor}22` : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${step.done ? iconColor + '44' : '#334155'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {icon}
                          </Box>
                          <Box sx={{ pt: 0.5 }}>
                            <Typography sx={{ fontWeight: step.active || step.done ? 700 : 500, color: step.done ? '#e2e8f0' : '#64748b' }}>
                              {step.label}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                              {step.active
                                ? 'Este es el estado actual informado por LogiTrack.'
                                : step.done
                                  ? 'Hito completado.'
                                  : 'Pendiente de actualización.'}
                            </Typography>
                            {index === 0 && (shipment.fechaEstimadaEntrega || shipment.fechaCalendarizada) && (
                              <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: '#fbbf24', fontWeight: 600 }}>
                                Entrega estimada: {formatDate(shipment.fechaEstimadaEntrega ?? shipment.fechaCalendarizada ?? '')}
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                      )
                    })}
                  </Stack>
                </CardContent>
              </Card>

              <ReportarIncidenteClienteDialog
                open={reportDialogOpen}
                onClose={() => setReportDialogOpen(false)}
                shipment={shipment}
              />
              {shipment.puntoPickUpId && (
                <CalificacionPickUpDialog
                  open={calificacionOpen}
                  onClose={() => setCalificacionOpen(false)}
                  trackingCode={shipment.trackingId}
                  puntoNombre={shipment.puntoPickUpNombre ?? 'Punto Pick Up'}
                  calificacionExistente={calificacionExistente}
                />
              )}
            </>
          )}
        </Stack>
      </Container>
    </Box>
  )
}
