import { useEffect, useMemo, useState } from 'react'
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
import { shipmentService } from '../services/shipmentService'
import type { Shipment, User } from '../types'
import ShipmentForm from '../components/ShipmentForm'
import ShipmentTimeline from '../components/ShipmentTimeline'

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
  const isRepartidor = user?.role === 'repartidor'

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
      } else {
        setError('Envío no encontrado')
      }
    } catch {
      setError('Error al cargar el envío')
    } finally {
      setLoading(false)
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
      navigate('/app', { state: { forceReload: Date.now() } })
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
          {/* G1L-9: cambiar estado (solo Repartidor con transiciones permitidas) */}
          {canChangeStatus && allowedStatusTransitions.length > 0 && (
            <Button
              variant="contained"
              size="small"
              onClick={() => setOpenStatusDialog(true)}
            >
              Cambiar estado
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
