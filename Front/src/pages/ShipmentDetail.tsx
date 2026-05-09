import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  FormControlLabel,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import CancelIcon from '@mui/icons-material/Cancel'
import HistoryIcon from '@mui/icons-material/History'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import PersonIcon from '@mui/icons-material/Person'
import MapIcon from '@mui/icons-material/Map'
import { Tab, Tabs } from '@mui/material'
import { shipmentService } from '../services/shipmentService'
import type { Shipment, User } from '../types'
import ShipmentForm from '../components/ShipmentForm'
import ShipmentTimeline from '../components/ShipmentTimeline'
import ShipmentMap from '../components/ShipmentMap'
import QrCameraScanner from '../components/QrCameraScanner'

// Motivos predefinidos de cancelación según G1L-13 AC3
const CANCEL_REASONS = [
  'Solicitud del cliente',
  'Datos incorrectos',
  'Imprevisto operativo',
  'Otro',
]

type CancelMode = 'Definitivo' | 'Reagendar'

function ShipmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useOutletContext<User>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openStatusDialog, setOpenStatusDialog] = useState(false)
  const [openCancelDialog, setOpenCancelDialog] = useState(false)
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [newStatus, setNewStatus] = useState<Shipment['status']>('En tránsito')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  // Cancelación
  const [cancelReason, setCancelReason] = useState('')
  const [cancelDetail, setCancelDetail] = useState('')
  const [cancelMode, setCancelMode] = useState<CancelMode>('Definitivo')
  const [actionToast, setActionToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'info' | 'warning' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const showActionToast = (message: string, severity: 'success' | 'info' | 'warning' | 'error' = 'success') => {
    setActionToast({ open: true, message, severity })
  }
  const closeActionToast = () => setActionToast((p) => ({ ...p, open: false, message: '' }))

  // Permisos por rol según UH del Sprint 1
  const isOperador = user?.role === 'operador'
  const isSupervisor = user?.role === 'supervisor'
  const isAdmin = user?.role === 'administrador'
  const isRepartidor = user?.role === 'repartidor'

  // G1L-42: repartidor asignado al envío (Supervisor / Admin)
  const [repartidorAsignado, setRepartidorAsignado] = useState<{
    id: string; nombre: string; apellido: string; email: string; estado: string
  } | null>(null)
  // Posición en mapa para edición pendiente
  const [draftPos, setDraftPos] = useState<{ latitud: number; longitud: number } | null>(null)
  const [savingUbicacion, setSavingUbicacion] = useState(false)

  // G1L-43: Pasar de estado vía QR (cámara + entrada manual del código)
  const [openQrDialog, setOpenQrDialog] = useState(false)
  const [qrMode, setQrMode] = useState<'camera' | 'manual'>('camera')
  const [qrCode, setQrCode] = useState('')
  const [qrSubmitting, setQrSubmitting] = useState(false)
  const [qrFeedback, setQrFeedback] = useState<{ severity: 'success' | 'info' | 'error'; message: string } | null>(null)
  const lastScannedRef = useRef<{ code: string; at: number } | null>(null)

  // G1L-9: Repartidor cambia estados (Listo→Tránsito, Tránsito→Entregado/Cancelado)
  // G1L-13: Operador/Supervisor cancelan Pendiente o Listo para Salir.
  // G1L-9: Repartidor cancela solo En Tránsito (Entrega Fallida).
  const canChangeStatus = isRepartidor
  const status = shipment?.status
  const canCancel =
    ((isOperador || isSupervisor) &&
      (status === 'Pendiente de calendarización' || status === 'Listo para salir')) ||
    (isRepartidor && status === 'En tránsito')
  // G1L-12, G1L-41: Editar solo si está pendiente de calendarización (paquete.isEditable)
  const canEdit = isOperador && shipment?.isEditable === true

  useEffect(() => {
    loadShipment()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadShipment = async () => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const data = await shipmentService.getShipmentTracking(id)
      if (data) {
        setShipment(data)
        setNewStatus(data.status)
        // G1L-42: cargar repartidor asignado para Supervisor / Admin
        if ((isSupervisor || isAdmin) && data.id) {
          const rep = await shipmentService.getRepartidorDePaquete(data.id)
          setRepartidorAsignado(rep)
        }
      } else {
        setError('Envío no encontrado')
      }
    } catch {
      setError('Error al cargar el envío')
    } finally {
      setLoading(false)
    }
  }

  const confirmarUbicacion = async () => {
    if (!shipment || !draftPos) return
    setSavingUbicacion(true)
    const r = await shipmentService.actualizarUbicacion(shipment.id, draftPos.latitud, draftPos.longitud)
    setSavingUbicacion(false)
    if (r.success) {
      showActionToast('Ubicación actualizada', 'success')
      setDraftPos(null)
      void loadShipment()
    } else {
      showActionToast(r.error ?? 'Error', 'error')
    }
  }

  // Transiciones permitidas según estado actual (G1L-9)
  const allowedStatusTransitions = useMemo<Shipment['status'][]>(() => {
    if (!shipment) return []
    switch (shipment.status) {
      case 'Listo para salir':
        return ['En tránsito']
      case 'En tránsito':
        return ['Entregado']
      default:
        return []
    }
  }, [shipment])

  useEffect(() => {
    if (openStatusDialog && allowedStatusTransitions.length > 0) {
      setNewStatus(allowedStatusTransitions[0])
    }
  }, [openStatusDialog, allowedStatusTransitions])

  useEffect(() => {
    if (openCancelDialog) {
      setCancelReason('')
      setCancelDetail('')
      setCancelMode(shipment?.status === 'Listo para salir' ? 'Reagendar' : 'Definitivo')
    }
  }, [openCancelDialog, shipment])

  const handleUpdateStatus = async () => {
    if (!id || !shipment) return
    if (!allowedStatusTransitions.includes(newStatus)) return
    setUpdatingStatus(true)
    const result = await shipmentService.changeShipmentStatus(id, newStatus)
    if (result.success) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
      setOpenStatusDialog(false)
      showActionToast(`Estado actualizado a ${newStatus}`, 'success')
    } else {
      showActionToast(result.error || 'Error al actualizar el estado', 'error')
    }
    setUpdatingStatus(false)
  }

  // G1L-13: Cancelar con motivo obligatorio + opción reagendar si está Listo para Salir
  const handleCancel = async () => {
    if (!id || !shipment) return
    const finalReason =
      cancelReason === 'Otro' ? cancelDetail.trim() : cancelReason
    if (!finalReason) {
      showActionToast('El motivo de cancelación es obligatorio', 'warning')
      return
    }
    setUpdatingStatus(true)
    const result = await shipmentService.cancelShipment(id, finalReason, cancelMode)
    if (result.success) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
      setOpenCancelDialog(false)
      showActionToast(
        cancelMode === 'Reagendar'
          ? 'Envío devuelto a Pendiente de Calendarización'
          : 'Envío cancelado correctamente',
        'success',
      )
    } else {
      showActionToast(result.error || 'Error al cancelar el envío', 'error')
    }
    setUpdatingStatus(false)
  }

  const handleResend = async () => {
    if (!id) return
    setUpdatingStatus(true)
    const result = await shipmentService.resendCancelledShipment(id)
    if (result.success) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
      showActionToast('Envío reenviado. Estado: Pendiente de calendarización', 'success')
    } else {
      showActionToast(result.error || 'Error al reenviar el envío', 'error')
    }
    setUpdatingStatus(false)
  }

  // Avanza el estado del paquete según el flujo QR del backend.
  // Sirve para Asignado→Cargado, Listo→Tránsito y Tránsito→ficha de entrega.
  // codeArg permite usar directamente la lectura de la cámara sin esperar al setState.
  const handleScanQr = async (codeArg?: string) => {
    const code = (codeArg ?? qrCode).trim()
    if (!code) return
    setQrSubmitting(true)
    setQrFeedback(null)
    const result = await shipmentService.escanearQr(code)
    setQrSubmitting(false)
    if (!result.success) {
      setQrFeedback({ severity: 'error', message: result.error ?? 'No se pudo procesar el QR' })
      return
    }
    const accion = result.data?.accion
    if (accion === 'AbrirFichaEntrega') {
      setQrFeedback({
        severity: 'info',
        message: 'El envío ya está En Tránsito. Confirmá la entrega o cancelala desde esta misma pantalla.',
      })
    } else {
      setQrFeedback({
        severity: 'success',
        message:
          accion === 'TransitoIniciado'
            ? 'Tránsito iniciado. ¡Buena ruta!'
            : accion === 'Cargado'
              ? 'Paquete marcado como Cargado en Vehículo.'
              : 'Estado actualizado correctamente.',
      })
    }
    // Refrescamos el detalle para reflejar el nuevo estado.
    if (id) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
    }
  }

  const openQrFlow = () => {
    setQrFeedback(null)
    setQrMode('camera')
    // Pre-cargamos con el tracking de este envío. El repartidor lo puede borrar
    // y pegar otro código si está escaneando varios paquetes en serie.
    setQrCode(shipment?.trackingId ?? '')
    setOpenQrDialog(true)
  }

  // Anti-rebote para la cámara (la lectura se dispara N veces por segundo).
  const handleCameraDetect = (code: string) => {
    if (qrSubmitting) return
    const now = Date.now()
    const last = lastScannedRef.current
    if (last && last.code === code && now - last.at < 3000) return
    lastScannedRef.current = { code, at: now }
    setQrCode(code)
    void handleScanQr(code)
  }

  const handleEditSubmit = async (data: Omit<Shipment, 'id' | 'lastUpdate' | 'trackingId'>) => {
    if (!id) return
    const result = await shipmentService.editShipment(id, data)
    if (result.success) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
      setOpenEditDialog(false)
      showActionToast('Envío actualizado correctamente', 'success')
    } else {
      showActionToast(result.error || 'Error al editar el envío', 'error')
      throw new Error(result.error || 'Error al editar el envío')
    }
  }

  const handleBack = () => {
    if (isRepartidor) {
      navigate('/repartidor')
    } else {
      navigate('/envios', { state: { forceReload: Date.now() } })
    }
  }

  const statusColor = (status: string) => {
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!shipment) {
    return (
      <Box>
        <Alert severity="error">{error || 'Envío no encontrado'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ mb: 2, justifyContent: 'space-between' }}
      >
        <Button startIcon={<ArrowBackIcon />} onClick={handleBack}>
          Volver
        </Button>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {/* G1L-28 + G1L-32: Etiqueta con QR (Operador, Supervisor, Admin — no Repartidor) */}
          {!isRepartidor && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<QrCode2Icon />}
              onClick={() => navigate(`/shipment/${shipment.id}/etiqueta`)}
            >
              Etiqueta / QR
            </Button>
          )}
          {/* G1L-12, G1L-41: Editar (solo si isEditable y rol Operador) */}
          {canEdit && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={() => setOpenEditDialog(true)}
            >
              Editar
            </Button>
          )}
          {/* G1L-43: Pasar de estado vía QR (escaneo o tipeo manual del código).
              Disponible cuando el paquete está en algún estado intermedio del flujo. */}
          {isRepartidor &&
            (status === 'Asignado a vehículo' ||
              status === 'Cargado en vehículo' ||
              status === 'Listo para salir' ||
              status === 'En tránsito') && (
              <Button
                variant="contained"
                size="small"
                color="primary"
                startIcon={<QrCodeScannerIcon />}
                onClick={openQrFlow}
              >
                Pasar de estado (QR)
              </Button>
            )}
          {/* G1L-9: cambiar estado manual (solo Repartidor con transiciones permitidas) */}
          {canChangeStatus && allowedStatusTransitions.length > 0 && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setOpenStatusDialog(true)}
            >
              Cambiar estado manual
            </Button>
          )}
          {/* G1L-13: cancelar (operador, supervisor o repartidor) */}
          {canCancel &&
            shipment.status !== 'Cancelado' &&
            shipment.status !== 'Entregado' && (
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<CancelIcon />}
                onClick={() => setOpenCancelDialog(true)}
              >
                Cancelar envío
              </Button>
            )}
        </Stack>
      </Stack>

      {/* Banner especial para envíos cancelados — con motivo y reenvío */}
      {shipment.status === 'Cancelado' && (
        <Card sx={{ mb: 3, bgcolor: '#ffebee', borderLeft: '4px solid #d32f2f' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: '#d32f2f' }}>
              Envío cancelado
            </Typography>
            {shipment.cancellationReason && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Motivo: {shipment.cancellationReason}
              </Typography>
            )}
            {(isOperador || isSupervisor) && (
              <Button
                variant="contained"
                size="small"
                onClick={handleResend}
                disabled={updatingStatus}
                sx={{ mt: 2 }}
              >
                {updatingStatus ? <CircularProgress size={16} /> : 'Reenviar envío'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Grid container spacing={3}>
        {/* Información general */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información general
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Tracking ID"
                  value={shipment.trackingId}
                  fullWidth
                  disabled
                />
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Estado
                  </Typography>
                  <Chip label={shipment.status} color={statusColor(shipment.status) as any} />
                </Box>
                <TextField label="Peso (kg)" value={shipment.weight} fullWidth disabled />
                <TextField label="Tipo de envío" value={shipment.tipoEnvio ?? '-'} fullWidth disabled />
                <TextField label="Tipo de paquete" value={shipment.tipoPaquete ?? '-'} fullWidth disabled />
                <TextField label="Descripción" value={shipment.description} fullWidth disabled multiline />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Remitente */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Remitente
              </Typography>
              <Stack spacing={1}>
                <TextField label="Nombre" value={shipment.sender.name} fullWidth disabled size="small" />
                <TextField label="Dirección" value={shipment.sender.address} fullWidth disabled size="small" />
                <TextField label="Ciudad" value={shipment.sender.city} fullWidth disabled size="small" />
                <TextField label="Código Postal" value={shipment.sender.postalCode} fullWidth disabled size="small" />
                <TextField label="Teléfono" value={shipment.sender.phone ?? ''} fullWidth disabled size="small" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Destinatario */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Destinatario
              </Typography>
              <Stack spacing={1}>
                <TextField label="Nombre" value={shipment.receiver.name} fullWidth disabled size="small" />
                <TextField label="Dirección" value={shipment.receiver.address} fullWidth disabled size="small" />
                <TextField label="Ciudad" value={shipment.receiver.city} fullWidth disabled size="small" />
                <TextField label="Código Postal" value={shipment.receiver.postalCode} fullWidth disabled size="small" />
                <TextField label="Teléfono" value={shipment.receiver.phone ?? ''} fullWidth disabled size="small" />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* G1L-15: Línea de tiempo del historial — solo Operador y Supervisor */}
        {(isOperador || isSupervisor) && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <HistoryIcon color="primary" />
                  <Typography variant="h6">Historial de estados</Typography>
                </Stack>
                <ShipmentTimeline paqueteId={shipment.id} />
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* G1L-42: Repartidor asignado (Supervisor / Admin, solo lectura) */}
        {(isSupervisor || isAdmin) && repartidorAsignado && (
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <PersonIcon color="primary" />
                  <Typography variant="h6">Repartidor asignado</Typography>
                </Stack>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ width: 48, height: 48, borderRadius: '50%', bgcolor: '#1976d2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                    {(repartidorAsignado.nombre[0] ?? '').toUpperCase()}{(repartidorAsignado.apellido[0] ?? '').toUpperCase()}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body1"
                      fontWeight={600}
                      sx={{ color: '#1976d2', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => navigate(`/repartidor/${repartidorAsignado.id}/rendimiento`)}
                    >
                      {repartidorAsignado.nombre} {repartidorAsignado.apellido}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {repartidorAsignado.email}
                    </Typography>
                  </Box>
                  <Chip size="small" label={repartidorAsignado.estado} color={repartidorAsignado.estado === 'Activo' ? 'success' : 'warning'} />
                </Stack>
                <Button
                  size="small"
                  sx={{ mt: 2 }}
                  onClick={() => navigate(`/repartidor/${repartidorAsignado.id}/rendimiento`)}
                >
                  Ver perfil de rendimiento
                </Button>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* G1L-18 + G1L-17 GPS: Mapa con ubicación actual.
            Admin puede actualizar haciendo click; resto solo lectura. */}
        {(shipment.status === 'En tránsito' || shipment.ubicacionActual) && (isAdmin || isSupervisor) && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                  <MapIcon color="primary" />
                  <Typography variant="h6">Ubicación del envío</Typography>
                  {isAdmin && shipment.status === 'En tránsito' && (
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (Hacé click en el mapa para actualizar la ubicación)
                    </Typography>
                  )}
                </Stack>
                <ShipmentMap
                  position={draftPos ?? shipment.ubicacionActual}
                  editable={isAdmin && shipment.status === 'En tránsito'}
                  onChange={(lat, lng) => setDraftPos({ latitud: lat, longitud: lng })}
                />
                {isAdmin && draftPos && (
                  <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                    <Button variant="contained" onClick={confirmarUbicacion} disabled={savingUbicacion}>
                      {savingUbicacion ? 'Guardando...' : `Confirmar nueva ubicación (${draftPos.latitud.toFixed(5)}, ${draftPos.longitud.toFixed(5)})`}
                    </Button>
                    <Button onClick={() => setDraftPos(null)} disabled={savingUbicacion}>Cancelar</Button>
                  </Stack>
                )}
                {isAdmin && shipment.status !== 'En tránsito' && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    La simulación de movimiento solo está disponible para envíos en tránsito.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Dialog: cambiar estado (G1L-9) */}
      <Dialog
        open={openStatusDialog}
        onClose={() => !updatingStatus && setOpenStatusDialog(false)}
      >
        <DialogTitle>Cambiar estado del envío</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Nuevo estado</InputLabel>
            <Select
              value={newStatus}
              label="Nuevo estado"
              onChange={(e) => setNewStatus(e.target.value as Shipment['status'])}
              disabled={updatingStatus}
            >
              {allowedStatusTransitions.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {newStatus === 'Entregado' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              Una vez marcado como Entregado, no se podrá modificar el estado.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStatusDialog(false)} disabled={updatingStatus}>
            Cerrar
          </Button>
          <Button onClick={handleUpdateStatus} variant="contained" disabled={updatingStatus}>
            {updatingStatus ? <CircularProgress size={20} /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: cancelar envío (G1L-13) */}
      <Dialog
        open={openCancelDialog}
        onClose={() => !updatingStatus && setOpenCancelDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Cancelar envío</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {/* Modo: solo si está en Listo para Salir */}
          {shipment.status === 'Listo para salir' && (
            <FormControl sx={{ mt: 1, mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                ¿Qué querés hacer con el envío?
              </Typography>
              <RadioGroup
                value={cancelMode}
                onChange={(e) => setCancelMode(e.target.value as CancelMode)}
              >
                <FormControlLabel
                  value="Reagendar"
                  control={<Radio />}
                  label="Volver a calendarizar (estado Pendiente)"
                />
                <FormControlLabel
                  value="Definitivo"
                  control={<Radio />}
                  label="Cancelación definitiva"
                />
              </RadioGroup>
            </FormControl>
          )}

          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Motivo</InputLabel>
            <Select
              value={cancelReason}
              label="Motivo"
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={updatingStatus}
            >
              {CANCEL_REASONS.map((r) => (
                <MenuItem key={r} value={r}>
                  {r}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {cancelReason === 'Otro' && (
            <TextField
              label="Detalle del motivo"
              value={cancelDetail}
              onChange={(e) => setCancelDetail(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ mt: 2 }}
              disabled={updatingStatus}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCancelDialog(false)} disabled={updatingStatus}>
            Volver
          </Button>
          <Button
            onClick={handleCancel}
            variant="contained"
            color="error"
            disabled={
              updatingStatus ||
              !cancelReason ||
              (cancelReason === 'Otro' && !cancelDetail.trim())
            }
          >
            {updatingStatus ? <CircularProgress size={20} /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: pasar de estado vía QR (G1L-43) — cámara o manual. */}
      <Dialog
        open={openQrDialog}
        onClose={() => !qrSubmitting && setOpenQrDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <QrCodeScannerIcon color="primary" /> <span>Pasar de estado (QR)</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Tabs
            value={qrMode}
            onChange={(_, v) => {
              setQrMode(v)
              setQrFeedback(null)
            }}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab value="camera" icon={<CameraAltIcon />} iconPosition="start" label="Cámara" />
            <Tab value="manual" icon={<KeyboardIcon />} iconPosition="start" label="Manual" />
          </Tabs>

          {qrMode === 'camera' ? (
            <>
              <DialogContentText sx={{ mb: 1 }}>
                Apuntá la cámara al QR del paquete. Al detectarlo, el sistema avanza el estado solo.
              </DialogContentText>
              <QrCameraScanner onDetect={handleCameraDetect} />
            </>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Ingresá el código de seguimiento. El sistema avanza el estado según el flujo
                (cargado → listo → en tránsito).
              </DialogContentText>
              <TextField
                autoFocus
                fullWidth
                label="Código de seguimiento"
                placeholder="Ej: TRK-AB12-CD34"
                value={qrCode}
                onChange={(e) => {
                  const v = e.target.value.trim()
                  const match = v.match(/seguimiento\/([^/?#]+)/i)
                  setQrCode(match ? match[1] : v)
                }}
                disabled={qrSubmitting}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && qrCode.trim()) void handleScanQr()
                }}
              />
            </>
          )}

          {qrFeedback && (
            <Alert severity={qrFeedback.severity} sx={{ mt: 2 }}>
              {qrFeedback.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenQrDialog(false)} disabled={qrSubmitting}>
            Cerrar
          </Button>
          {qrMode === 'manual' && (
            <Button
              variant="contained"
              onClick={() => void handleScanQr()}
              disabled={qrSubmitting || !qrCode.trim()}
            >
              {qrSubmitting ? <CircularProgress size={20} /> : 'Procesar'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Dialog: editar envío (G1L-12) */}
      <ShipmentForm
        open={openEditDialog}
        mode="edit"
        initialData={shipment}
        onClose={() => setOpenEditDialog(false)}
        onSubmit={handleEditSubmit}
      />

      <Snackbar
        open={actionToast.open}
        autoHideDuration={3500}
        onClose={closeActionToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={actionToast.severity}
          variant="filled"
          onClose={closeActionToast}
          sx={{ width: '100%' }}
        >
          {actionToast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ShipmentDetail
