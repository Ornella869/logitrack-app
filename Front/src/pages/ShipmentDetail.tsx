import { useEffect, useRef, useState } from 'react'
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
  useTheme,
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
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import { Tab, Tabs } from '@mui/material'
import { shipmentService, type HistorialEstadoEnvio } from '../services/shipmentService'
import { notificationService } from '../services/notificationService'
import type { Shipment, User } from '../types'
import ShipmentForm from '../components/ShipmentForm'
import ShipmentTimeline from '../components/ShipmentTimeline'
import QrCameraScanner from '../components/QrCameraScanner'
import PrecalendarizarDialog from '../components/PrecalendarizarDialog'
import PruebaAcusticaDialog from '../components/PruebaAcusticaDialog'
import { ojoPatronService } from '../services/ojoPatronService'

// Motivos predefinidos de cancelación según G1L-13 AC3
const CANCEL_REASONS = [
  'Solicitud del cliente',
  'Datos incorrectos',
  'Imprevisto operativo',
  'Otro',
]

// G1L-82: motivos predefinidos para marcar un envío como Demorado.
const DEMORA_REASONS = [
  'Problema mecánico',
  'Corte de ruta',
  'Condiciones climáticas',
  'Otro',
]

type CancelMode = 'Definitivo' | 'Reagendar'

// Código de confirmación de entrega — temporal hardcodeado.
// En el próximo sprint se va a generar uno por envío y se enviará al destinatario
// por email cuando el paquete pasa a En Tránsito. Mientras tanto, todos los envíos
// usan este mismo valor para que el equipo pueda probar el flujo end-to-end.
const ENTREGA_CONFIRMATION_CODE = '123456'

function ShipmentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useOutletContext<User>()
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openCancelDialog, setOpenCancelDialog] = useState(false)
  const [openEditDialog, setOpenEditDialog] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  // Confirmación de entrega con código (Repartidor sobre envíos En Tránsito).
  const [openEntregaDialog, setOpenEntregaDialog] = useState(false)
  const [entregaCodigo, setEntregaCodigo] = useState('')
  const [entregaError, setEntregaError] = useState('')
  const [confirmandoEntrega, setConfirmandoEntrega] = useState(false)
  // Fase B: prueba de voz a mitad de recorrido (gate antes de seguir entregando).
  const [openPruebaMitad, setOpenPruebaMitad] = useState(false)
  const [umbralMitad, setUmbralMitad] = useState(0.4)
  // Cancelación
  const [cancelReason, setCancelReason] = useState('')
  const [cancelDetail, setCancelDetail] = useState('')
  const [cancelMode, setCancelMode] = useState<CancelMode>('Definitivo')
  // G1L-82: marcar como demorado (motivo obligatorio)
  const [openDemoraDialog, setOpenDemoraDialog] = useState(false)
  const [demoraMotivo, setDemoraMotivo] = useState('')
  const [demoraDetalle, setDemoraDetalle] = useState('')
  const [demorando, setDemorando] = useState(false)
  const [continuando, setContinuando] = useState(false)
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
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const isRepartidor = user?.role === 'repartidor'

  // G1L-42: repartidor asignado al envío (Supervisor / Admin)
  const [repartidorAsignado, setRepartidorAsignado] = useState<{
    id: string; nombre: string; apellido: string; email: string; estado: string
  } | null>(null)

  // G1L-81: para "Cargado en Vehículo" mostramos quién hizo el escaneo y cuándo.
  // Lo sacamos del historial (último cambio a CargadoEnVehiculo).
  const [ultimoEscaneoCarga, setUltimoEscaneoCarga] = useState<HistorialEstadoEnvio | null>(null)

  // G1L-43: Pasar de estado vía QR (cámara + entrada manual del código)
  const [openQrDialog, setOpenQrDialog] = useState(false)
  const [qrMode, setQrMode] = useState<'camera' | 'manual'>('camera')
  const [qrCode, setQrCode] = useState('')
  const [qrSubmitting, setQrSubmitting] = useState(false)
  const [qrFeedback, setQrFeedback] = useState<{ severity: 'success' | 'info' | 'error'; message: string } | null>(null)
  const lastScannedRef = useRef<{ code: string; at: number } | null>(null)

  // G1L-13 / G1L-68: Operador/Supervisor cancelan Pendiente o cualquier estado
  // calendarizado (Asignado/Cargado/Listo para Salir) — en estos últimos podrán
  // elegir entre cancelar definitivo o volver a calendarizar.
  // G1L-9: Repartidor cancela solo En Tránsito (Entrega Fallida).
  // La transición Tránsito→Entregado va por el botón "Confirmar entrega" con código.
  const status = shipment?.status
  const canCancel =
    ((isOperador || isSupervisor) &&
      (status === 'Pendiente de calendarización' ||
        status === 'Asignado a vehículo' ||
        status === 'Cargado en vehículo' ||
        status === 'Listo para salir')) ||
    // G1L-82: el repartidor cancela desde "En tránsito" o "Demorado" (entrega fallida).
    (isRepartidor && (status === 'En tránsito' || status === 'Demorado'))
  // G1L-12, G1L-41: Editar solo si está pendiente de calendarización (paquete.isEditable)
  const canEdit = isOperador && shipment?.isEditable === true
  // G1L-82: marcar como Demorado lo pueden hacer Repartidor o Supervisor sobre un envío En Tránsito.
  const canMarcarDemorado = (isRepartidor || isSupervisor) && status === 'En tránsito'
  // G1L-82: continuar ruta tras la demora — solo el repartidor.
  const canContinuarRuta = isRepartidor && status === 'Demorado'
  // G1L-83: el Supervisor asigna manualmente un envío pendiente de calendarización.
  const canPrecalendarizar = isSupervisor && status === 'Pendiente de calendarización'
  const [openPrecalendarizar, setOpenPrecalendarizar] = useState(false)

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
        // G1L-42: cargar repartidor asignado para Supervisor / Admin
        if ((isSupervisor || isAdmin) && data.id) {
          const rep = await shipmentService.getRepartidorDePaquete(data.id)
          setRepartidorAsignado(rep)
        }
        // G1L-81: si el envío está "Cargado en Vehículo" o "Listo para Salir",
        // buscamos en el historial el último escaneo que lo marcó como cargado.
        if (
          (isOperador || isSupervisor || isAdmin) &&
          (data.status === 'Cargado en vehículo' || data.status === 'Listo para salir')
        ) {
          try {
            const historial = await shipmentService.getHistorial(data.id)
            const escaneo = historial.find((h) => h.estadoNuevo === 'CargadoEnVehiculo') ?? null
            setUltimoEscaneoCarga(escaneo)
          } catch {
            setUltimoEscaneoCarga(null)
          }
        } else {
          setUltimoEscaneoCarga(null)
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

  // G1L-68: estados calendarizados en los que ofrecemos elegir entre cancelar definitivo
  // y volver a calendarizar. El backend ya soporta los 3 (EnviosService.CancelarPaquete).
  const isCalendarizadoCancelable =
    shipment?.status === 'Asignado a vehículo' ||
    shipment?.status === 'Cargado en vehículo' ||
    shipment?.status === 'Listo para salir'

  useEffect(() => {
    if (openCancelDialog) {
      setCancelReason('')
      setCancelDetail('')
      setCancelMode(isCalendarizadoCancelable ? 'Reagendar' : 'Definitivo')
    }
  }, [openCancelDialog, shipment, isCalendarizadoCancelable])

  // Confirma la entrega validando el código que el destinatario tiene que dar.
  // Por ahora el código está hardcodeado (ENTREGA_CONFIRMATION_CODE). En el próximo
  // sprint se reemplaza por uno generado por envío y enviado por mail al destinatario
  // cuando el paquete pasa a En Tránsito.
  const handleConfirmarEntrega = async () => {
    if (!id || !shipment) return
    const codigo = entregaCodigo.trim()
    if (codigo.length !== 6) {
      setEntregaError('El código debe tener 6 dígitos.')
      return
    }
    if (codigo !== ENTREGA_CONFIRMATION_CODE) {
      setEntregaError('Código incorrecto. Verificá con el destinatario.')
      return
    }
    setEntregaError('')
    // Fase B: si al entregar este envío se cruza la mitad del recorrido, primero la prueba de voz.
    if (isRepartidor) {
      const requiere = await ojoPatronService.requierePruebaMitad(id)
      if (requiere) {
        const estado = await ojoPatronService.getEstadoPrueba()
        if (estado?.umbralAlertness != null) setUmbralMitad(estado.umbralAlertness)
        setOpenPruebaMitad(true)
        return
      }
    }
    await ejecutarEntrega()
  }

  // Entrega efectiva (tras pasar el gate de la prueba de mitad si correspondía).
  const ejecutarEntrega = async () => {
    if (!id || !shipment) return
    setConfirmandoEntrega(true)
    const result = await shipmentService.changeShipmentStatus(id, 'Entregado')
    setConfirmandoEntrega(false)
    if (result.success) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
      setOpenEntregaDialog(false)
      setEntregaCodigo('')
      showActionToast('Entrega confirmada. ¡Gracias!', 'success')
      // Notificación al Supervisor (rol).
      notificationService.add({
        type: 'otro',
        title: 'Entrega completada',
        message: `Envío ${shipment.trackingId} entregado a ${shipment.receiver.name}`,
        recipientId: 'supervisor',
        navigateTo: `/shipment/${id}`,
      })
      // Fase C: notificación al propio repartidor por cada parada entregada.
      if (isRepartidor) {
        notificationService.add({
          type: 'otro',
          title: 'Parada entregada',
          message: `Entregaste el envío ${shipment.trackingId} a ${shipment.receiver.name}.`,
          recipientId: user.id,
          navigateTo: '/repartidor',
        })
      }
    } else {
      setEntregaError(result.error || 'No se pudo confirmar la entrega')
    }
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

  // G1L-82: el repartidor o supervisor marca el envío como Demorado con motivo obligatorio.
  const handleMarcarDemorado = async () => {
    if (!id || !shipment) return
    const finalMotivo = demoraMotivo === 'Otro' ? demoraDetalle.trim() : demoraMotivo
    if (!finalMotivo) {
      showActionToast('El motivo de la demora es obligatorio', 'warning')
      return
    }
    setDemorando(true)
    const result = await shipmentService.marcarDemorado(id, finalMotivo)
    setDemorando(false)
    if (result.success) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
      setOpenDemoraDialog(false)
      setDemoraMotivo('')
      setDemoraDetalle('')
      showActionToast('Envío marcado como Demorado', 'success')
    } else {
      showActionToast(result.error || 'No se pudo marcar como demorado', 'error')
    }
  }

  // G1L-82: el repartidor retoma el recorrido tras resolver el imprevisto.
  const handleContinuarRuta = async () => {
    if (!id) return
    setContinuando(true)
    const result = await shipmentService.continuarTransito(id)
    setContinuando(false)
    if (result.success) {
      const updated = await shipmentService.getShipmentTracking(id)
      if (updated) setShipment(updated)
      showActionToast('Ruta retomada. El envío vuelve a estar En Tránsito.', 'success')
    } else {
      showActionToast(result.error || 'No se pudo continuar la ruta', 'error')
    }
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
      case 'Demorado':
        return 'warning'
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
          {/* G1L-9 / G1L-82: confirmación de entrega habilitada para "En Tránsito" y "Demorado". */}
          {isRepartidor && (status === 'En tránsito' || status === 'Demorado') && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<CheckCircleIcon />}
              onClick={() => {
                setEntregaCodigo('')
                setEntregaError('')
                setOpenEntregaDialog(true)
              }}
            >
              Confirmar entrega
            </Button>
          )}
          {/* G1L-82: marcar como demorado (Repartidor o Supervisor) desde En Tránsito. */}
          {canMarcarDemorado && (
            <Button
              variant="outlined"
              size="small"
              sx={{ color: '#BF360C', borderColor: '#BF360C', '&:hover': { borderColor: '#BF360C', bgcolor: '#FFE0B2' } }}
              startIcon={<ReportProblemIcon />}
              onClick={() => {
                setDemoraMotivo('')
                setDemoraDetalle('')
                setOpenDemoraDialog(true)
              }}
            >
              Marcar demorado
            </Button>
          )}
          {/* G1L-82: continuar ruta (Repartidor) desde Demorado. */}
          {canContinuarRuta && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={continuando ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleContinuarRuta}
              disabled={continuando}
            >
              {continuando ? 'Retomando…' : 'Continuar ruta'}
            </Button>
          )}
          {/* G1L-83: asignar manualmente (Supervisor) un envío pendiente de calendarización. */}
          {canPrecalendarizar && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={<EventAvailableIcon />}
              onClick={() => setOpenPrecalendarizar(true)}
            >
              Asignar manualmente
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

      {/* G1L-82: Banner naranja destacado cuando el envío está Demorado.
          Visible para todos los roles que ven el detalle (Supervisor, Operador, Repartidor). */}
      {shipment.status === 'Demorado' && (
        <Card sx={{ mb: 3, bgcolor: isDark ? 'rgba(191,54,12,0.18)' : '#FFE0B2', borderLeft: '4px solid #BF360C' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <ReportProblemIcon sx={{ color: isDark ? '#FFB74D' : '#BF360C' }} />
              <Typography variant="h6" sx={{ color: isDark ? '#FFB74D' : '#BF360C' }}>
                Envío demorado
              </Typography>
            </Stack>
            {shipment.razonDemora && (
              <Typography variant="body2" sx={{ color: isDark ? 'rgba(255,255,255,0.85)' : 'text.primary' }}>
                Motivo: {shipment.razonDemora}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              El repartidor puede continuar la ruta cuando el imprevisto se resuelva.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Banner especial para envíos cancelados — con motivo y reenvío */}
      {shipment.status === 'Cancelado' && (
        <Card sx={{ mb: 3, bgcolor: isDark ? 'rgba(211,47,47,0.18)' : '#ffebee', borderLeft: '4px solid #d32f2f' }}>
          <CardContent>
            <Typography variant="h6" sx={{ color: isDark ? '#ef9a9a' : '#d32f2f' }}>
              Envío cancelado
            </Typography>
            {shipment.cancellationReason && (
              <Typography variant="body2" sx={{ mt: 1, color: isDark ? 'rgba(255,255,255,0.8)' : 'text.primary' }}>
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
        <Grid item xs={12} md={6} sx={{ order: isSupervisor ? 3 : undefined }}>
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
                {/* G1L-81: fecha de despacho prevista cuando el envío ya está calendarizado. */}
                {shipment.fechaCalendarizada &&
                  (shipment.status === 'Asignado a vehículo' ||
                    shipment.status === 'Cargado en vehículo' ||
                    shipment.status === 'Listo para salir') && (
                    <TextField
                      label="Fecha de despacho prevista"
                      value={new Date(shipment.fechaCalendarizada).toLocaleDateString('es-AR')}
                      fullWidth
                      disabled
                    />
                  )}
                {/* G1L-81: registro del escaneo que dejó el paquete en "Cargado en Vehículo". */}
                {ultimoEscaneoCarga && (
                  <TextField
                    label="Cargado por"
                    value={`${ultimoEscaneoCarga.usuarioNombre ?? 'Repartidor'} · ${new Date(ultimoEscaneoCarga.fechaHora).toLocaleString('es-AR')}`}
                    fullWidth
                    disabled
                  />
                )}
                <TextField label="Peso (kg)" value={shipment.weight} fullWidth disabled />
                {/* G1L-88: costo del envío cotizado al alta. */}
                {shipment.costoEnvio != null && shipment.costoEnvio > 0 && (
                  <Box>
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Costo del envío
                    </Typography>
                    <Typography variant="h6" fontWeight={700}>
                      ${shipment.costoEnvio.toLocaleString('es-AR')}
                    </Typography>
                    {shipment.esZonaPeligrosa && (shipment.costoRecargoSeguridad ?? 0) > 0 && (
                      <Chip
                        size="small"
                        label={`Incluye $${(shipment.costoRecargoSeguridad ?? 0).toLocaleString('es-AR')} por zona peligrosa`}
                        sx={{ mt: 0.5, bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600 }}
                      />
                    )}
                  </Box>
                )}
                <TextField label="Tipo de envío" value={shipment.tipoEnvio ?? '-'} fullWidth disabled />
                <TextField label="Tipo de paquete" value={shipment.tipoPaquete ?? '-'} fullWidth disabled />
                <TextField label="Descripción" value={shipment.description} fullWidth disabled multiline />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Remitente */}
        <Grid item xs={12} md={6} sx={{ order: isSupervisor ? 5 : undefined }}>
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
        <Grid item xs={12} md={6} sx={{ order: isSupervisor ? 4 : undefined }}>
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
          <Grid item xs={12} md={6} sx={{ order: isSupervisor ? 2 : undefined }}>
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
          <Grid item xs={12} md={6} sx={{ order: isSupervisor ? 1 : undefined }}>
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

       
      </Grid>

      {/* Dialog: confirmar entrega — el repartidor pide el código al destinatario.
          Hoy el código es hardcodeado; próximamente se enviará por email al destinatario. */}
      <Dialog
        open={openEntregaDialog}
        onClose={() => !confirmandoEntrega && setOpenEntregaDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <CheckCircleIcon color="success" /> <span>Confirmar entrega</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Pedile al destinatario el código de 6 dígitos que recibió por email.
          </DialogContentText>
          <Alert severity="info" sx={{ mb: 2 }}>
            Mientras el envío por email no esté integrado, usá el código <strong>{ENTREGA_CONFIRMATION_CODE}</strong> para todos los envíos. Próximamente se generará uno único por envío.
          </Alert>
          <TextField
            autoFocus
            fullWidth
            label="Código de entrega"
            placeholder="123456"
            value={entregaCodigo}
            onChange={(e) => {
              const onlyDigits = e.target.value.replace(/\D/g, '').slice(0, 6)
              setEntregaCodigo(onlyDigits)
              setEntregaError('')
            }}
            disabled={confirmandoEntrega}
            inputProps={{
              maxLength: 6,
              inputMode: 'numeric',
              style: { fontFamily: 'monospace', letterSpacing: 6, textAlign: 'center', fontSize: 22 },
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && entregaCodigo.length === 6) void handleConfirmarEntrega()
            }}
          />
          {entregaError && (
            <Alert severity="error" sx={{ mt: 2 }}>{entregaError}</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEntregaDialog(false)} disabled={confirmandoEntrega}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={confirmandoEntrega ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />}
            onClick={handleConfirmarEntrega}
            disabled={confirmandoEntrega || entregaCodigo.length !== 6}
          >
            {confirmandoEntrega ? 'Confirmando...' : 'Confirmar entrega'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Fase B: prueba de voz de mitad de recorrido (gate antes de entregar). */}
      <PruebaAcusticaDialog
        open={openPruebaMitad}
        umbral={umbralMitad}
        momento={1}
        onClose={() => setOpenPruebaMitad(false)}
        onCompletado={(aprobada) => {
          setOpenPruebaMitad(false)
          // Gate estricto: solo si aprobó se concreta la entrega.
          if (aprobada) void ejecutarEntrega()
        }}
      />

      {/* G1L-83: Dialog de asignación manual (Supervisor sobre envío pendiente). */}
      {canPrecalendarizar && (
        <PrecalendarizarDialog
          open={openPrecalendarizar}
          shipment={shipment}
          onClose={() => setOpenPrecalendarizar(false)}
          onSuccess={async (mensaje) => {
            setOpenPrecalendarizar(false)
            const updated = await shipmentService.getShipmentTracking(shipment.id)
            if (updated) setShipment(updated)
            showActionToast(mensaje, 'success')
          }}
        />
      )}

      {/* G1L-82: Dialog para marcar como Demorado con motivo obligatorio. */}
      <Dialog
        open={openDemoraDialog}
        onClose={() => !demorando && setOpenDemoraDialog(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ReportProblemIcon sx={{ color: '#BF360C' }} /> <span>Marcar envío como demorado</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Indicá el motivo del imprevisto. El envío queda en estado "Demorado" hasta que retomes la ruta.
          </DialogContentText>
          <FormControl fullWidth size="small">
            <InputLabel>Motivo</InputLabel>
            <Select
              value={demoraMotivo}
              label="Motivo"
              onChange={(e) => setDemoraMotivo(e.target.value)}
              disabled={demorando}
            >
              {DEMORA_REASONS.map((r) => (
                <MenuItem key={r} value={r}>{r}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {demoraMotivo === 'Otro' && (
            <TextField
              label="Detalle del motivo"
              value={demoraDetalle}
              onChange={(e) => setDemoraDetalle(e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={{ mt: 2 }}
              disabled={demorando}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDemoraDialog(false)} disabled={demorando}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            sx={{ bgcolor: '#BF360C', '&:hover': { bgcolor: '#8C2A06' } }}
            onClick={handleMarcarDemorado}
            disabled={demorando || !demoraMotivo || (demoraMotivo === 'Otro' && !demoraDetalle.trim())}
          >
            {demorando ? <CircularProgress size={20} color="inherit" /> : 'Confirmar'}
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
          {/* G1L-68: en estados calendarizados (Asignado/Cargado/Listo para Salir) ofrecemos
              elegir entre cancelar definitivo o volver a calendarizar. */}
          {isCalendarizadoCancelable && (
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
