import { useEffect, useState } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Chip,
  Stack,
  TextField,
  Typography,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  Alert,
  Snackbar,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { shipmentService } from '../services/shipmentService'
import type { Shipment } from '../types'

function ShipmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useOutletContext<any>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openStatusDialog, setOpenStatusDialog] = useState(false)
  const [newStatus, setNewStatus] = useState<Shipment['status']>('En tránsito')
  const [cancellationReason, setCancellationReason] = useState('')
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [actionToast, setActionToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'info' | 'warning' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const showActionToast = (
    message: string,
    severity: 'success' | 'info' | 'warning' | 'error' = 'success',
  ) => {
    setActionToast({ open: true, message, severity })
  }

  const closeActionToast = () => {
    setActionToast((prev) => ({ ...prev, open: false, message: '' }))
  }

  // Solo supervisor y transportista pueden cambiar estados
  const canUserChangeStatus = user?.role === 'supervisor' || user?.role === 'transportista'

  useEffect(() => {
    loadShipment()
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
    } catch (err) {
      setError('Error al cargar el envío')
    } finally {
      setLoading(false)
    }
  }

  // Validar si se puede cambiar a un nuevo estado
  const canChangeStatus = (currentStatus: Shipment['status']): boolean => {
    // Si está entregado, no se puede cambiar a cancelado o en sucursal
    if (currentStatus === 'Entregado') {
      return false
    }
    // Si está cancelado, no se puede cambiar
    if (currentStatus === 'Cancelado') {
      return false
    }
    return true
  }

  const getAllowedTransitions = (currentStatus: Shipment['status']): Shipment['status'][] => {
    switch (currentStatus) {
      case 'En sucursal':
        return ['En tránsito', 'Cancelado']
      case 'En tránsito':
        return ['Entregado', 'Cancelado']
      default:
        return []
    }
  }

  useEffect(() => {
    if (!openStatusDialog || !shipment) return
    const allowed = getAllowedTransitions(shipment.status)
    setNewStatus(allowed[0] ?? shipment.status)
    setCancellationReason('')
  }, [openStatusDialog, shipment])

  // Obtener mensaje de error para cambio de estado no permitido
  const getStatusChangeErrorMessage = (): string => {
    if (shipment?.status === 'Entregado') {
      return 'No se puede cambiar el estado de un envío que ya ha sido entregado'
    }
    if (shipment?.status === 'Cancelado') {
      return 'No se puede cambiar el estado de un envío cancelado'
    }
    return ''
  }

  const handleUpdateStatus = async () => {
    if (!id || !shipment) return

    // Validar que el usuario tenga permisos
    if (!canUserChangeStatus) {
      showActionToast('No tienes permiso para cambiar el estado de este envío', 'error')
      return
    }

    // Validar transición de estado
    if (!canChangeStatus(shipment.status)) {
      showActionToast(getStatusChangeErrorMessage(), 'error')
      return
    }

    const allowedTransitions = getAllowedTransitions(shipment.status)
    if (!allowedTransitions.includes(newStatus)) {
      showActionToast('Transición de estado no válida para el estado actual del envío', 'error')
      return
    }

    // Validar motivo de cancelación
    if (newStatus === 'Cancelado' && !cancellationReason.trim()) {
      showActionToast('El motivo de cancelación es requerido', 'warning')
      return
    }

    setUpdatingStatus(true)
    try {
      let result: { success: boolean; error?: string }

      if (newStatus === 'Cancelado') {
        // Usar endpoint específico para cancelación con motivo
        result = await shipmentService.cancelShipment(id, cancellationReason)
      } else {
        // Usar endpoint general para otros estados
        result = await shipmentService.changeShipmentStatus(id, newStatus)
      }

      if (result.success) {
        // Recargar el envío para obtener el estado actualizado
        const updated = await shipmentService.getShipmentTracking(id)
        if (updated) {
          setShipment(updated)
        }

        setOpenStatusDialog(false)
        setCancellationReason('')

        if (newStatus === 'Entregado') {
          showActionToast('Envío marcado como Entregado. No se puede modificar su estado.', 'success')
        } else if (newStatus === 'Cancelado') {
          showActionToast('Envío cancelado correctamente', 'warning')
        } else {
          showActionToast(`Estado actualizado a ${newStatus}`, 'info')
        }
      } else {
        showActionToast(result.error || 'Error al actualizar el estado', 'error')
      }
    } catch (err) {
      showActionToast('Error de conexión al actualizar el estado', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  // Reenviar envío cancelado usando endpoint específico
  const handleResendShipment = async () => {
    if (!id || !shipment) return

    setUpdatingStatus(true)
    try {
      const result = await shipmentService.resendCancelledShipment(id)
      if (result.success) {
        const updated = await shipmentService.getShipmentTracking(id)
        if (updated) {
          setShipment(updated)
        }
        showActionToast('Envío reenviado correctamente. Estado: En sucursal', 'success')
      } else {
        showActionToast(result.error || 'Error al reenviar el envío', 'error')
      }
    } catch (err) {
      showActionToast('Error de conexión al reenviar el envío', 'error')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendiente':
      case 'En sucursal':
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

  const handleBackToDashboard = () => {
    // Navegar de vuelta y forzar recarga agregando un timestamp
    navigate('/app', {
      replace: false,
      state: { forceReload: Date.now() }
    })
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
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBackToDashboard}
          sx={{ mt: 2 }}
        >
          Volver al dashboard
        </Button>
      </Box>
    )
  }

  const allowedTransitions = getAllowedTransitions(shipment.status)

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleBackToDashboard}
        sx={{ mb: 2 }}
      >
        Volver
      </Button>

      {/* Visualización especial para envíos cancelados */}
      {shipment.status === 'Cancelado' && (
        <Card sx={{ mb: 3, bgcolor: '#ffebee', borderLeft: '4px solid #d32f2f' }}>
          <CardContent>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6" sx={{ color: '#d32f2f' }}>
                  ❌ Envío Cancelado
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Motivo de cancelación:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {shipment.cancellationReason || 'Sin especificar'}
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="primary"
                onClick={handleResendShipment}
                disabled={updatingStatus || !canUserChangeStatus}
                title={!canUserChangeStatus ? 'Solo supervisores y transportistas pueden reenviar' : ''}
              >
                {updatingStatus ? <CircularProgress size={20} /> : 'Reenviar Envío'}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Mensaje de error */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información General
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="ID de Tracking"
                  value={shipment.trackingId}
                  fullWidth
                  disabled
                />
                <TextField
                  label="Descripción"
                  value={shipment.description}
                  fullWidth
                  disabled
                />
                <Box>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Estado
                  </Typography>
                  <Chip label={shipment.status} color={getStatusColor(shipment.status) as any} />
                </Box>
                <Button
                  variant="outlined"
                  onClick={() => setOpenStatusDialog(true)}
                  fullWidth
                  disabled={!canUserChangeStatus}
                  title={!canUserChangeStatus ? 'Solo supervisores y transportistas pueden cambiar el estado' : ''}
                >
                  {!canUserChangeStatus ? '🔒 Sin permiso para cambiar estado' : 'Cambiar estado'}
                </Button>
                <TextField
                  label="Peso (kg)"
                  value={shipment.weight}
                  fullWidth
                  disabled
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Fechas
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Fecha de creación"
                  value={shipment.createdDate}
                  fullWidth
                  disabled
                />
                <TextField
                  label="Último actualización"
                  value={shipment.lastUpdate}
                  fullWidth
                  disabled
                />
                <TextField
                  label="Entrega estimada"
                  value={shipment.estimatedDelivery}
                  fullWidth
                  disabled
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Remitente
              </Typography>
              <Stack spacing={1}>
                <TextField
                  label="Nombre"
                  value={shipment.sender.name}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Dirección"
                  value={shipment.sender.address}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Ciudad"
                  value={shipment.sender.city}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Código Postal"
                  value={shipment.sender.postalCode}
                  fullWidth
                  disabled
                  size="small"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Destinatario
              </Typography>
              <Stack spacing={1}>
                <TextField
                  label="Nombre"
                  value={shipment.receiver.name}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Dirección"
                  value={shipment.receiver.address}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Ciudad"
                  value={shipment.receiver.city}
                  fullWidth
                  disabled
                  size="small"
                />
                <TextField
                  label="Código Postal"
                  value={shipment.receiver.postalCode}
                  fullWidth
                  disabled
                  size="small"
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Ubicación
              </Typography>
              <Stack spacing={2}>
                <TextField
                  label="Origen"
                  value={shipment.origin}
                  fullWidth
                  disabled
                />
                <TextField
                  label="Destino"
                  value={shipment.destination}
                  fullWidth
                  disabled
                />
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog para cambiar estado */}
      <Dialog open={openStatusDialog} onClose={() => {
        if (!updatingStatus) {
          setOpenStatusDialog(false)
          setCancellationReason('')
        }
      }}>
        <DialogTitle>Cambiar estado del envío</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <>
            <Select
              value={newStatus}
              onChange={(e) => {
                setNewStatus(e.target.value as Shipment['status'])
                if (e.target.value !== 'Cancelado') {
                  setCancellationReason('')
                }
              }}
              fullWidth
              disabled={!canChangeStatus(shipment.status) || updatingStatus || allowedTransitions.length === 0}
            >
              {allowedTransitions.map((status) => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>

            {allowedTransitions.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No hay transiciones disponibles para el estado actual.
              </Alert>
            )}

            {newStatus === 'Cancelado' && (
              <TextField
                label="Motivo de cancelación"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                fullWidth
                multiline
                rows={3}
                placeholder="Por favor, especifica el motivo de la cancelación"
                sx={{ mt: 2 }}
                disabled={updatingStatus}
              />
            )}

            {newStatus === 'Entregado' && (
              <Alert severity="info" sx={{ mt: 2 }}>
                ⚠️ <strong>Importante:</strong> Una vez que marques este envío como Entregado,
                no podrás cambiar su estado nuevamente.
              </Alert>
            )}
          </>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setOpenStatusDialog(false)
            setCancellationReason('')
          }} disabled={updatingStatus}>
            Cerrar
          </Button>
          <Button
            onClick={handleUpdateStatus}
            variant="contained"
            disabled={updatingStatus}
          >
            {updatingStatus ? <CircularProgress size={24} /> : 'Actualizar'}
          </Button>
        </DialogActions>
      </Dialog>

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
