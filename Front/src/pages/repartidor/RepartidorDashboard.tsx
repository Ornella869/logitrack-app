import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Alert,
  Badge,
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
  Grid,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import RouteIcon from '@mui/icons-material/Route'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import MapIcon from '@mui/icons-material/Map'
import NavigationIcon from '@mui/icons-material/Navigation'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import DirectionsIcon from '@mui/icons-material/Directions'
import GavelIcon from '@mui/icons-material/Gavel'
import ChatIcon from '@mui/icons-material/Chat'
import SendIcon from '@mui/icons-material/Send'
import MyLocationIcon from '@mui/icons-material/MyLocation'
import LocationDisabledIcon from '@mui/icons-material/LocationDisabled'
import GpsFixedIcon from '@mui/icons-material/GpsFixed'
import { useGpsTracking } from '../../hooks/useGpsTracking'
import { shipmentService } from '../../services/shipmentService'
import { notificationService } from '../../services/notificationService'
import { branchService, type BranchOrigin } from '../../services/branchService'
import { ojoPatronService } from '../../services/ojoPatronService'
import StatusBadge from '../../components/StatusBadge'
import RouteMap, { fetchOsrmRoute, positionAlongRoute } from '../../components/RouteMap'
import QrCameraScanner from '../../components/QrCameraScanner'
import ConsentimientoOjoPatronDialog from '../../components/ConsentimientoOjoPatronDialog'
import PruebaAcusticaDialog from '../../components/PruebaAcusticaDialog'
import ReportarIncidenteDialog from '../../components/ReportarIncidenteDialog'
import ParadaAccionDialog from '../../components/ParadaAccionDialog'
import { incidenciaService, type Incidencia } from '../../services/incidenciaService'
import { mensajeIncidenciaService, type MensajeIncidencia } from '../../services/mensajeIncidenciaService'
import { dateOnly, dateOnlyForDisplay, formatArgentinaDateInput, formatInstantArgentinaTime } from '../../utils/argentinaDate'
import { buildMapsUrl } from '../../utils/mapsUrl'
import type { Shipment, User } from '../../types'

// G1L-23: Mi ruta del día. Trae paquetes asignados al repartidor logueado para hoy.
// El backend devuelve las paradas ordenadas desde la sucursal por cercanía.

function getGreeting(name: string) {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return `Buenos días, ${name}!`
  if (h >= 12 && h < 20) return `Buenas tardes, ${name}!`
  return `Buenas noches, ${name}!`
}

// Convierte las paradas (Shipment) y la sucursal origen (BranchOrigin) al
// formato genérico que entiende `buildMapsUrl` (utils/mapsUrl).
const stopsForMaps = (paradas: Shipment[]) =>
  paradas.map((p) => ({
    direccion: p.receiver.address,
    localidad: p.receiver.city,
    codigoPostal: p.receiver.postalCode,
    status: p.status,
  }))

const originForMaps = (origen: BranchOrigin | null) =>
  origen ? { direccion: origen.address, ciudad: origen.city, codigoPostal: origen.postalCode } : null

const routeDateForDisplay = dateOnlyForDisplay

export default function RepartidorDashboard() {
  const navigate = useNavigate()
  const user = useOutletContext<User>()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [paradas, setParadas] = useState<Shipment[]>([])
  const [fechaRuta, setFechaRuta] = useState<string | null>(null)
  const [origen, setOrigen] = useState<BranchOrigin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  const [filtroEstado, setFiltroEstado] = useState<string | null>(null)
  const [ubicacionActiva, setUbicacionActiva] = useState(false)
  const [modoSimulacion, setModoSimulacion] = useState(false)
  const [ubicacionReal, setUbicacionReal] = useState<{ latitud: number; longitud: number } | null>(null)
  const [ubicacionMsg, setUbicacionMsg] = useState<{ severity: 'success' | 'info' | 'warning' | 'error'; message: string } | null>(null)

  // Fase A: estado de jornada (Disponible / EnRuta / Retornando)
  const [estadoJornada, setEstadoJornada] = useState('Disponible')
  useGpsTracking(estadoJornada === 'EnRuta')
  const [cerrandoJornada, setCerrandoJornada] = useState(false)

  // QR scanner (cámara + entrada manual del código).
  const [openQr, setOpenQr] = useState(false)
  const [qrMode, setQrMode] = useState<'camera' | 'manual'>('camera')
  const [qrCode, setQrCode] = useState('')
  const [qrSubmitting, setQrSubmitting] = useState(false)
  const [qrFeedback, setQrFeedback] = useState<{ severity: 'success' | 'info' | 'error'; message: string } | null>(null)
  // Para no dispararse contra el backend si el scanner devuelve la misma lectura
  // muchas veces seguidas (cosa que el detector hace normalmente).
  const lastScannedRef = useRef<{ code: string; at: number } | null>(null)
  const locationWatchRef = useRef<number | null>(null)
  const simulationTimerRef = useRef<number | null>(null)
  const simulationStepRef = useRef(0)
  const simulationRouteRef = useRef<[number, number][] | null>(null)
  const simulationLegKeyRef = useRef('')

  const load = async (fecha?: string) => {
    setLoading(true)
    setError('')
    try {
      const [data, sucursal, jornada] = await Promise.all([
        shipmentService.getMiRutaDelDia(fecha),
        // origen sólo se pide en la primera carga; cacheamos.
        origen ? Promise.resolve(origen) : branchService.getSucursalOrigen(),
        shipmentService.getEstadoJornada(),
      ])
      setParadas(data.paradas)
      setFechaRuta(data.fecha)
      setUbicacionReal(data.paradas.find((p) => p.ubicacionActual)?.ubicacionActual ?? null)
      setEstadoJornada(jornada)
      if (!origen) setOrigen(sucursal)
    } catch {
      setError('No se pudo cargar tu ruta del día')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hayRutaActiva = useMemo(
    () => estadoJornada === 'EnRuta' && paradas.some((p) => p.status === 'En tránsito' || p.status === 'Demorado'),
    [estadoJornada, paradas],
  )

  const detenerUbicacionReal = () => {
    if (locationWatchRef.current != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchRef.current)
    }
    locationWatchRef.current = null
    setUbicacionActiva(false)
  }

  const detenerSimulacion = () => {
    if (simulationTimerRef.current != null) {
      window.clearInterval(simulationTimerRef.current)
    }
    simulationTimerRef.current = null
    setModoSimulacion(false)
  }

  const calcularSegmentoSimulacion = () => {
    const destino = paradas.find((p) =>
      (p.status === 'En tránsito' || p.status === 'Demorado') &&
      p.receiverUbicacion?.latitud != null &&
      p.receiverUbicacion?.longitud != null,
    ) ?? paradas.find((p) =>
      p.status !== 'Entregado' &&
      p.status !== 'Cancelado' &&
      p.receiverUbicacion?.latitud != null &&
      p.receiverUbicacion?.longitud != null,
    )
    if (!destino?.receiverUbicacion) return null

    const ultimaEntregada = [...paradas]
      .reverse()
      .find((p) => p.status === 'Entregado' && p.receiverUbicacion?.latitud != null && p.receiverUbicacion?.longitud != null)

    const origenLat = ultimaEntregada?.receiverUbicacion?.latitud ?? origen?.latitud
    const origenLng = ultimaEntregada?.receiverUbicacion?.longitud ?? origen?.longitud
    if (origenLat == null || origenLng == null) return null

    return {
      desde: [origenLat, origenLng] as [number, number],
      hasta: [destino.receiverUbicacion.latitud, destino.receiverUbicacion.longitud] as [number, number],
    }
  }

  const calcularUbicacionSimulada = async () => {
    const segmento = calcularSegmentoSimulacion()
    if (!segmento) return null

    const legKey = `${segmento.desde[0]},${segmento.desde[1]}-${segmento.hasta[0]},${segmento.hasta[1]}`
    if (simulationLegKeyRef.current !== legKey) {
      simulationLegKeyRef.current = legKey
      simulationRouteRef.current = null
    }

    if (!simulationRouteRef.current) {
      const ctrl = new AbortController()
      simulationRouteRef.current = await fetchOsrmRoute([segmento.desde, segmento.hasta], ctrl.signal) ?? [segmento.desde, segmento.hasta]
    }

    simulationStepRef.current = (simulationStepRef.current + 1) % 10
    const t = 0.15 + simulationStepRef.current * 0.07
    const [latitud, longitud] = positionAlongRoute(simulationRouteRef.current, t)
    return {
      latitud,
      longitud,
    }
  }

  const activarUbicacionReal = () => {
    if (!navigator.geolocation) {
      setUbicacionMsg({ severity: 'error', message: 'Tu navegador no permite compartir ubicacion.' })
      return
    }
    if (!hayRutaActiva) {
      setUbicacionMsg({ severity: 'warning', message: 'La ubicacion real se comparte solo cuando tenes una ruta en transito.' })
      return
    }
    if (ubicacionActiva) {
      detenerUbicacionReal()
      setUbicacionMsg({ severity: 'info', message: 'Dejaste de compartir tu ubicacion real.' })
      return
    }
    detenerSimulacion()

    const sendPosition = (pos: GeolocationPosition) => {
      setUbicacionReal({ latitud: pos.coords.latitude, longitud: pos.coords.longitude })
      void shipmentService.actualizarMiUbicacion(pos.coords.latitude, pos.coords.longitude)
    }

    locationWatchRef.current = navigator.geolocation.watchPosition(
      sendPosition,
      () => {
        detenerUbicacionReal()
        setUbicacionMsg({ severity: 'error', message: 'No se pudo obtener tu ubicacion. Revisa los permisos del navegador.' })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )
    setUbicacionActiva(true)
    setUbicacionMsg({ severity: 'success', message: 'Ubicacion real compartida con el supervisor.' })
  }

  const activarSimulacion = () => {
    if (modoSimulacion) {
      detenerSimulacion()
      setUbicacionMsg({ severity: 'info', message: 'Simulacion detenida.' })
      return
    }
    if (!hayRutaActiva) {
      setUbicacionMsg({ severity: 'warning', message: 'La simulacion se activa solo con una ruta en transito.' })
      return
    }
    const enviarSimulacion = async () => {
      const ubicacion = await calcularUbicacionSimulada()
      if (!ubicacion) {
        setUbicacionMsg({ severity: 'warning', message: 'No hay coordenadas suficientes para simular la ruta.' })
        detenerSimulacion()
        return
      }
      setUbicacionReal(ubicacion)
      void shipmentService.actualizarMiUbicacion(ubicacion.latitud, ubicacion.longitud)
    }
    detenerUbicacionReal()
    simulationStepRef.current = 0
    simulationRouteRef.current = null
    simulationLegKeyRef.current = ''
    setModoSimulacion(true)
    enviarSimulacion()
    simulationTimerRef.current = window.setInterval(enviarSimulacion, 4000)
    setUbicacionMsg({ severity: 'info', message: 'Simulacion activa para demo. El supervisor vera esta ubicacion.' })
  }

  useEffect(() => {
    if (!hayRutaActiva) {
      if (ubicacionActiva) detenerUbicacionReal()
      if (modoSimulacion) detenerSimulacion()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hayRutaActiva])

  useEffect(() => () => {
    detenerUbicacionReal()
    detenerSimulacion()
  }, [])

  const paradasFiltradas = useMemo(() => {
    if (!filtroEstado) return paradas
    if (filtroEstado === 'Pendientes')
      return paradas.filter((p) => p.status !== 'Entregado' && p.status !== 'Cancelado')
    return paradas.filter((p) => p.status === filtroEstado)
  }, [paradas, filtroEstado])

  const metrics = useMemo(() => {
    const entregadas = paradas.filter((p) => p.status === 'Entregado').length
    const enCamino = paradas.filter((p) => p.status === 'En tránsito').length
    const totalPeso = paradas.reduce((acc, p) => acc + (p.weight ?? 0), 0)
    const proximaIdx = paradas.findIndex(
      (p) => p.status !== 'Entregado' && p.status !== 'Cancelado',
    )
    const cpZona = paradas[0]?.receiver.postalCode
    const listosParaSalir = paradas.filter((p) => p.status === 'Listo para salir').length
    return { entregadas, enCamino, totalPeso, proximaIdx, cpZona, listosParaSalir }
  }, [paradas])

  // G1L-43: Inicializar Ruta — habilita la transición masiva Listo → En Tránsito.
  // Sólo se ofrece cuando hay paradas en "Listo para salir" (todos los paquetes
  // del día ya fueron escaneados por el repartidor en la sucursal).
  const [iniciandoRuta, setIniciandoRuta] = useState(false)
  const [confirmInicioOpen, setConfirmInicioOpen] = useState(false)
  const [inicioFeedback, setInicioFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null)
  const [paradaEnCurso, setParadaEnCurso] = useState<{ id: string; address: string; name: string } | null>(null)

  // Reportar incidente — chatbot Tracky
  const [incidenteOpen, setIncidenteOpen] = useState(false)

  // Controla si el camión ya empezó a animarse hacia la sucursal (se activa al clickear "Retorno a Sucursal").
  const [retornoAnimando, setRetornoAnimando] = useState(false)

  // Parada acción dialog (QR + demora rápida para próxima parada)
  const [paradaAccionOpen, setParadaAccionOpen] = useState(false)

  // Mensajería interna: mensajes del supervisor sobre incidencias
  const [mensajesOpen, setMensajesOpen] = useState(false)
  const [mensajesUnread, setMensajesUnread] = useState(0)
  const [mensajesIncidenciaId, setMensajesIncidenciaId] = useState<string | null>(null)
  const [mensajesData, setMensajesData] = useState<MensajeIncidencia[]>([])
  const [mensajesInput, setMensajesInput] = useState('')
  const mensajesChatEndRef = useRef<HTMLDivElement | null>(null)
  const [misIncidencias, setMisIncidencias] = useState<Incidencia[]>([])

  const hasActiveIncidencias = misIncidencias.some((i) => i.estado !== 'Resuelta')

  useEffect(() => {
    const computeUnread = async () => {
      const incidencias = await incidenciaService.getMisIncidencias()
      setMisIncidencias(incidencias)
      const count = await mensajeIncidenciaService.countMisNoLeidos()
      setMensajesUnread(count)
    }
    void computeUnread()
    const poll = setInterval(() => void computeUnread(), 10000)
    window.addEventListener('logitrack:incidencias', () => void computeUnread())
    return () => {
      clearInterval(poll)
    }
  }, [user.id])

  const openMensajes = async () => {
    const activeInc = misIncidencias.find((i) => i.estado !== 'Resuelta') ?? misIncidencias[0] ?? null
    let incTarget = activeInc
    // Prefer one that already has messages
    for (const inc of misIncidencias) {
      const msgs = await mensajeIncidenciaService.getByIncidencia(inc.id)
      if (msgs.length > 0) { incTarget = inc; break }
    }
    if (incTarget) {
      const msgs = await mensajeIncidenciaService.getByIncidencia(incTarget.id)
      setMensajesIncidenciaId(incTarget.id)
      setMensajesData(msgs)
      void mensajeIncidenciaService.markRead(incTarget.id)
      setMensajesUnread(0)
    } else {
      setMensajesIncidenciaId(null)
      setMensajesData([])
    }
    setMensajesOpen(true)
  }

  const handleSendMensajeRepartidor = async () => {
    const texto = mensajesInput.trim()
    if (!texto || !mensajesIncidenciaId) return
    setMensajesInput('')
    await mensajeIncidenciaService.send(mensajesIncidenciaId, texto)
    const msgs = await mensajeIncidenciaService.getByIncidencia(mensajesIncidenciaId)
    setMensajesData(msgs)
  }

  useEffect(() => {
    if (!mensajesOpen || !mensajesIncidenciaId) return
    const refresh = async () => {
      const msgs = await mensajeIncidenciaService.getByIncidencia(mensajesIncidenciaId)
      setMensajesData(msgs)
      void mensajeIncidenciaService.markRead(mensajesIncidenciaId)
    }
    void refresh()
    const poll = setInterval(() => void refresh(), 2000)
    return () => clearInterval(poll)
  }, [mensajesOpen, mensajesIncidenciaId])

  useEffect(() => {
    mensajesChatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajesData])

  // G1L-59 / G1L-60 / G1L-61: Ojo del Patrón.
  const [consentimientoAceptado, setConsentimientoAceptado] = useState<boolean | null>(null)
  const [consentDialog, setConsentDialog] = useState<null | 'requerido' | 'gestion'>(null)
  const [pruebaRealizadaHoy, setPruebaRealizadaHoy] = useState<boolean | null>(null)
  const [umbralPrueba, setUmbralPrueba] = useState(0.4)
  const [pruebaOpen, setPruebaOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      const [consent, prueba] = await Promise.all([
        ojoPatronService.getConsentimiento(),
        ojoPatronService.getEstadoPrueba(),
      ])
      setConsentimientoAceptado(consent?.aceptado ?? false)
      setPruebaRealizadaHoy(prueba?.realizadaHoy ?? false)
      if (prueba?.umbralAlertness != null) setUmbralPrueba(prueba.umbralAlertness)
    })()
  }, [])

  // Inicio de ruta con gating secuencial: consentimiento → prueba acústica → confirmar.
  const intentarIniciarRuta = () => {
    setInicioFeedback(null)
    if (consentimientoAceptado === false) {
      setConsentDialog('requerido')
      return
    }
    if (pruebaRealizadaHoy === false) {
      setPruebaOpen(true)
      return
    }
    setConfirmInicioOpen(true)
  }

  const handleConfirmarInicio = async () => {
    setIniciandoRuta(true)
    setInicioFeedback(null)
    const firstPending = paradas.find((p) => p.status !== 'Entregado' && p.status !== 'Cancelado')
    const result = await shipmentService.inicializarRuta(fechaRuta ?? undefined)
    setIniciandoRuta(false)
    setConfirmInicioOpen(false)
    if (!result.success) {
      setInicioFeedback({ severity: 'error', message: result.error ?? 'No se pudo iniciar la ruta' })
      return
    }
    setInicioFeedback({
      severity: 'success',
      message: `Ruta iniciada. ${result.cantidad} envío${result.cantidad === 1 ? '' : 's'} pasaron a En Tránsito.`,
    })
    if (firstPending) {
      setParadaEnCurso({ id: firstPending.id, address: firstPending.receiver.address, name: firstPending.receiver.name })
    }
    void load(fechaRuta ?? undefined)
  }

  const fechaActual = fechaRuta ? routeDateForDisplay(fechaRuta) : new Date()
  const fechaHoy = fechaActual.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const esHoy = fechaRuta ? dateOnly(fechaRuta) === formatArgentinaDateInput() : false
  const proxima = metrics.proximaIdx >= 0 ? paradas[metrics.proximaIdx] : null

  const todasEntregadas =
    paradas.length > 0 &&
    paradas.some((p) => p.status === 'Entregado') &&
    paradas.every((p) => p.status === 'Entregado' || p.status === 'Cancelado')

  useEffect(() => {
    if (todasEntregadas) setParadaEnCurso(null)
  }, [todasEntregadas])

  // El retorno se muestra solo si TODO el día que estoy viendo está entregado/cancelado.
  // (Antes arrastraba un flag global que lo dejaba visible al cambiar a otro día con pendientes.)
  const showRetorno = todasEntregadas

  // Resetear animación de retorno si se recarga la ruta y ya no está en retorno.
  useEffect(() => {
    if (!showRetorno) setRetornoAnimando(false)
  }, [showRetorno])

  // Fase A: el repartidor confirma que volvió a la sucursal → vuelve a estar disponible.
  const handleCerrarJornada = async () => {
    setCerrandoJornada(true)
    const res = await shipmentService.cerrarJornada()
    setCerrandoJornada(false)
    if (res.success) {
      setRetornoAnimando(false)
      setEstadoJornada('Disponible')
      void load(fechaRuta ?? undefined)
    }
  }

  const buildReturnUrl = (): string | null => {
    if (!origen) return null
    const cp = origen.postalCode ? ` ${origen.postalCode}` : ''
    const dest = encodeURIComponent(`${origen.address}, ${origen.city}${cp}, Argentina`)
    return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`
  }

  // G1L-43: Escaneo de QR — el repartidor confirma carga / inicia tránsito / abre ficha.
  // Aceptamos un código optional para usar directamente lo decodificado por la cámara
  // sin esperar a que React propague el setState a `qrCode`.
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
    if (accion === 'AbrirFichaEntrega' && result.data?.paqueteId) {
      // En tránsito: vamos directo a la ficha de gestión.
      setOpenQr(false)
      setQrCode('')
      navigate(`/shipment/${result.data.paqueteId}`)
      return
    }
    // UH-96: notificación in-app por parada entregada vía QR
    if (accion === 'Entregado' && result.data?.paqueteId) {
      const paqueteEntregado = paradas.find((p) => p.id === result.data!.paqueteId)
      notificationService.add({
        type: 'otro',
        title: 'Parada entregada',
        message: paqueteEntregado
          ? `Entregaste el envío ${paqueteEntregado.trackingId} a ${paqueteEntregado.receiver.name}.`
          : 'Parada marcada como entregada.',
        recipientId: user.id,
        navigateTo: '/repartidor',
      })
    }
    setQrFeedback({
      severity: 'success',
      message: result.data?.mensaje
        ?? (accion === 'TransitoIniciado'
          ? 'Tránsito iniciado. ¡Buena ruta!'
          : 'Estado actualizado correctamente.'),
    })
    setQrCode('')
    void load(fechaRuta ?? undefined)
  }

  // Llamado por el componente de cámara cuando detecta un QR válido.
  // Anti-rebote: el detector dispara N veces el mismo código por segundo.
  const handleCameraDetect = (code: string) => {
    if (qrSubmitting) return
    const now = Date.now()
    const last = lastScannedRef.current
    if (last && last.code === code && now - last.at < 3000) return
    lastScannedRef.current = { code, at: now }
    setQrCode(code)
    void handleScanQr(code)
  }

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 2, gap: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <RouteIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            {esHoy ? 'Mi Ruta del Día' : 'Mi Ruta'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
            {fechaHoy} · {paradas.length} paradas{metrics.cpZona ? ` · CP ${metrics.cpZona}` : ''}
          </Typography>
          {user && (
            <Typography variant="caption" color="text.secondary">
              {getGreeting(user.name)}
            </Typography>
          )}
          {origen && (
            <Typography variant="caption" color="text.secondary" display="block">
              🏢 Salís desde: <strong>{origen.name}</strong> — {origen.address}, {origen.city}
            </Typography>
          )}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">Avance</Typography>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#2e7d32' }}>
              {metrics.entregadas} / {paradas.length}
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="primary"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => {
              setQrCode('')
              setQrFeedback(null)
              setOpenQr(true)
            }}
          >
            Escanear QR
          </Button>
          <Button
            variant={ubicacionActiva ? 'contained' : 'outlined'}
            color={ubicacionActiva ? 'success' : 'primary'}
            startIcon={ubicacionActiva ? <LocationDisabledIcon /> : <MyLocationIcon />}
            onClick={activarUbicacionReal}
          >
            {ubicacionActiva ? 'Detener ubicacion' : 'Compartir ubicacion'}
          </Button>
          <Button
            variant={modoSimulacion ? 'contained' : 'outlined'}
            color="secondary"
            startIcon={<GpsFixedIcon />}
            onClick={activarSimulacion}
          >
            Simulacion
          </Button>
          {/* Fase A: cerrar jornada al volver. Solo mientras está "Retornando". */}
          {showRetorno && estadoJornada === 'Retornando' && (
            <Button
              variant="outlined"
              color="success"
              startIcon={cerrandoJornada ? <CircularProgress size={16} /> : <CheckCircleIcon />}
              onClick={handleCerrarJornada}
              disabled={cerrandoJornada}
            >
              Llegué a sucursal
            </Button>
          )}
          {/* G1L-59: gestión del consentimiento (equivale a "Mi Perfil"). */}
          <Button
            startIcon={<GavelIcon />}
            color={consentimientoAceptado === false ? 'warning' : 'inherit'}
            onClick={() => setConsentDialog('gestion')}
          >
            Consentimiento
          </Button>
          <Button startIcon={<RefreshIcon />} onClick={() => load(fechaRuta ?? undefined)} disabled={loading}>
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {origen && (origen.latitud == null || origen.longitud == null) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No se pudo ubicar la sucursal <strong>{origen.name}</strong> en el mapa
          ({origen.address}, {origen.city}). Verificá la dirección en el panel del administrador.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {ubicacionMsg && (
        <Alert severity={ubicacionMsg.severity} sx={{ mb: 2 }} onClose={() => setUbicacionMsg(null)}>
          {ubicacionMsg.message}
        </Alert>
      )}

      {inicioFeedback && (
        <Alert severity={inicioFeedback.severity} sx={{ mb: 2 }} onClose={() => setInicioFeedback(null)}>
          {inicioFeedback.message}
        </Alert>
      )}

      {showRetorno && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          icon={<DirectionsIcon />}
          action={
            <Button
              color="inherit"
              size="small"
              startIcon={<DirectionsIcon />}
              onClick={() => {
                const url = buildReturnUrl()
                if (url) window.open(url, '_blank', 'noopener,noreferrer')
              }}
            >
              Ver ruta de regreso
            </Button>
          }
        >
          <strong>¡Todas las entregas completadas!</strong>
          {origen
            ? ` Podés volver a la sucursal ${origen.name}.`
            : ' Podés volver a la sucursal de origen.'}
        </Alert>
      )}

      {paradaEnCurso && !showRetorno && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate(`/shipment/${paradaEnCurso.id}`)}>
              Ir a la entrega
            </Button>
          }
        >
          Ruta en curso · Próxima parada: <strong>{paradaEnCurso.address}</strong> · {paradaEnCurso.name}
        </Alert>
      )}

      {/* Barra de tabs — siempre visible, "Reportar Incidente" abre el chatbot */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v: number) => {
            if (v === 2) { setIncidenteOpen(true); return }
            setTab(v)
          }}
        >
          <Tab label="🗺️ Mapa" />
          <Tab label="📋 Mis paradas" />
          {paradas.length > 0 && (
            <Tab
              label={
                <Stack direction="row" alignItems="center" spacing={0.6}>
                  <WarningAmberIcon sx={{ fontSize: 15 }} />
                  <span>Reportar Incidente</span>
                </Stack>
              }
              sx={{
                ml: 'auto',
                color: '#c62828',
                '&:hover': { color: '#b71c1c', bgcolor: 'rgba(198,40,40,0.06)' },
                '&.Mui-selected': { color: '#c62828' },
              }}
            />
          )}
          {hasActiveIncidencias && (
            <IconButton
              size="small"
              onClick={() => void openMensajes()}
              sx={{ ml: 0.5, color: mensajesUnread > 0 ? '#1565C0' : 'text.secondary' }}
            >
              <Badge badgeContent={mensajesUnread > 0 ? mensajesUnread : undefined} color="error">
                <ChatIcon fontSize="small" />
              </Badge>
            </IconButton>
          )}
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : paradas.length === 0 ? (
        showRetorno ? null : (
          <Alert severity="info">
            No tenés paradas asignadas para hoy. Esperá a que el supervisor calendarice los envíos.
          </Alert>
        )
      ) : (
        <>
          {/* KPIs */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <KpiCard label="Entregadas" value={metrics.entregadas} color="#2e7d32" icon={<CheckCircleIcon />} />
            <KpiCard label="En camino" value={metrics.enCamino} color="#ed6c02" icon={<LocalShippingIcon />} />
            <KpiCard
              label="Capacidad"
              value={Math.round(metrics.totalPeso)}
              suffix=" / 500 kg"
              color="#1976d2"
              icon={<Inventory2Icon />}
            />
            <KpiCard label="Paradas restantes" value={paradas.length - metrics.entregadas} color="#5e35b1" icon={<AccessTimeIcon />} />
          </Grid>

          {tab === 0 && (
            <Card variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
              <Box sx={{ p: 2, bgcolor: isDark ? '#1B2D42' : '#fafafa', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {showRetorno
                      ? '🏁 Ruta de retorno a la sucursal'
                      : `Ruta optimizada${metrics.cpZona ? ` · CP ${metrics.cpZona}` : ''}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {showRetorno
                      ? `Seguí la línea violeta para volver a ${origen?.name ?? 'la sucursal'}`
                      : origen
                        ? `Salida desde ${origen.name} · ${paradas.length} paradas en orden`
                        : `Orden automático por cercanía · ${paradas.length} paradas`}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<MapIcon />}
                    disabled={paradas.length === 0}
                    onClick={() => {
                      const url = buildMapsUrl(stopsForMaps(paradas), originForMaps(origen))
                      if (url) window.open(url, '_blank', 'noopener,noreferrer')
                    }}
                  >
                    Abrir ruta en Maps
                  </Button>
                  {metrics.listosParaSalir > 0 && (
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<PlayArrowIcon />}
                      onClick={intentarIniciarRuta}
                    >
                      Inicializar Ruta ({metrics.listosParaSalir})
                    </Button>
                  )}
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<NavigationIcon />}
                    disabled={!proxima}
                    onClick={() => proxima && setParadaAccionOpen(true)}
                  >
                    Navegar a próxima parada
                  </Button>
                  {showRetorno && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<DirectionsIcon />}
                      onClick={() => setRetornoAnimando(true)}
                      disabled={retornoAnimando}
                      sx={{ bgcolor: '#5e35b1', '&:hover': { bgcolor: '#4527a0' } }}
                    >
                      Retorno a Sucursal
                    </Button>
                  )}
                </Stack>
              </Box>
              <RouteMap
                paradas={paradas.map((p, idx) => ({
                  paqueteId: p.id,
                  codigoSeguimiento: p.trackingId,
                  orden: idx + 1,
                  direccion: p.receiver.address,
                  localidad: p.receiver.city,
                  destinatario: p.receiver.name,
                  status: p.status,
                  latitud: p.receiverUbicacion?.latitud ?? null,
                  longitud: p.receiverUbicacion?.longitud ?? null,
                }))}
                proximaIdx={metrics.proximaIdx}
                origen={
                  origen?.latitud != null && origen?.longitud != null
                    ? {
                        nombre: origen.name,
                        direccion: origen.address,
                        ciudad: origen.city,
                        latitud: origen.latitud,
                        longitud: origen.longitud,
                      }
                    : null
                }
                ubicacionActual={ubicacionReal}
                showReturnRoute={showRetorno}
                animateReturnRoute={retornoAnimando}
                height={380}
              />
              {proxima && (
                <Box sx={{ p: 2, bgcolor: isDark ? '#1B2D42' : '#f8fdf8', borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e8f5e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="body2">
                    <strong>Próxima parada:</strong> {proxima.receiver.address}, {proxima.receiver.city} · {proxima.receiver.name} · {Math.round(proxima.weight)} kg
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    CP {proxima.receiver.postalCode}
                  </Typography>
                </Box>
              )}
              {/* Mini lista de todas las paradas */}
              <Box sx={{ borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #eee' }}>
                <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">
                    TODAS LAS PARADAS ({paradas.length})
                  </Typography>
                </Box>
                <Box sx={{ maxHeight: 180, overflowY: 'auto', px: 1, pb: 1 }}>
                  {paradas.map((p, idx) => {
                    const isProxima = idx === metrics.proximaIdx
                    const statusColor = p.status === 'Entregado' ? '#2e7d32' : p.status === 'En tránsito' ? '#ed6c02' : p.status === 'Cancelado' ? '#c62828' : '#546e7a'
                    const hasCoordsP = p.receiverUbicacion?.latitud != null
                    return (
                      <Box key={p.id} sx={{
                        display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, borderRadius: 1,
                        bgcolor: isProxima ? (isDark ? 'rgba(25,118,210,0.18)' : '#e3f2fd') : 'transparent',
                        mb: 0.3,
                      }}>
                        <Box sx={{
                          minWidth: 24, height: 24, borderRadius: '50%',
                          bgcolor: statusColor, color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, fontWeight: 700, flexShrink: 0,
                        }}>
                          {idx + 1}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography noWrap variant="caption" fontWeight={isProxima ? 700 : 400} sx={{ display: 'block', color: isProxima ? 'primary.main' : 'text.primary' }}>
                            {p.receiver.address}, {p.receiver.city}
                          </Typography>
                          <Typography noWrap variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                            {p.receiver.name}
                          </Typography>
                        </Box>
                        {!hasCoordsP && (
                          <Typography variant="caption" sx={{ fontSize: 10, color: '#90a4ae', flexShrink: 0 }}>sin GPS</Typography>
                        )}
                        <Typography variant="caption" sx={{ fontSize: 10, color: statusColor, fontWeight: 600, flexShrink: 0 }}>
                          {p.status}
                        </Typography>
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            </Card>
          )}

          {tab === 1 && (
          <Stack spacing={1.5}>
            {/* Filtro por estado */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { label: 'Todos', value: null },
                { label: 'Pendientes', value: 'Pendientes' },
                { label: 'En tránsito', value: 'En tránsito' },
                { label: 'Demorado', value: 'Demorado' },
                { label: 'Entregado', value: 'Entregado' },
              ].map(({ label, value }) => {
                const count = value === null
                  ? paradas.length
                  : value === 'Pendientes'
                    ? paradas.filter((p) => p.status !== 'Entregado' && p.status !== 'Cancelado').length
                    : paradas.filter((p) => p.status === value).length
                const selected = filtroEstado === value
                return (
                  <Chip
                    key={label}
                    label={`${label} (${count})`}
                    size="small"
                    onClick={() => setFiltroEstado(value)}
                    color={selected ? 'primary' : 'default'}
                    variant={selected ? 'filled' : 'outlined'}
                    sx={{ fontWeight: selected ? 700 : 400 }}
                  />
                )
              })}
            </Box>

            {paradasFiltradas.length === 0 && (
              <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                No hay paradas con estado "{filtroEstado}".
              </Typography>
            )}

            {paradasFiltradas.map((p) => {
              const isCompleted = p.status === 'Entregado' || p.status === 'Cancelado'
              const isCurrent = p.id === proxima?.id
              const numeroParada = paradas.indexOf(p) + 1
              return (
                <Card
                  key={p.id}
                  variant="outlined"
                  sx={{
                    borderLeft: '4px solid',
                    borderLeftColor: isCompleted ? '#2e7d32' : isCurrent ? '#ed6c02' : '#1976d2',
                    bgcolor: isCompleted
                    ? (isDark ? 'rgba(46,125,50,0.12)' : '#f8fdf8')
                    : isCurrent
                      ? (isDark ? 'rgba(237,108,2,0.12)' : '#fffbf5')
                      : (isDark ? '#162032' : 'white'),
                    opacity: isCompleted ? 0.85 : 1,
                  }}
                >
                  <CardContent>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: isCompleted ? '#2e7d32' : isCurrent ? '#ed6c02' : '#1976d2',
                          color: 'white', fontWeight: 700, fontSize: 16,
                        }}
                      >
                        {numeroParada}
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            {p.receiver.address}, {p.receiver.city}
                          </Typography>
                          <StatusBadge status={p.status} />
                        </Stack>
                        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            📦 {p.trackingId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            👤 {p.receiver.name} · {Math.round(p.weight)} kg
                          </Typography>
                          {p.receiver.phone && (
                            <Typography variant="caption" color="text.secondary">
                              📱 {p.receiver.phone}
                            </Typography>
                          )}
                          {p.tipoEnvio === 'Prioritario' && (
                            <Chip
                              size="small"
                              label="⚡ Prioritario"
                              sx={{ bgcolor: '#fdecea', color: '#c62828', border: '1px solid #c62828', height: 18, fontSize: 10, fontWeight: 600 }}
                            />
                          )}
                        </Stack>
                        {p.description && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
                            Obs: {p.description}
                          </Typography>
                        )}
                        {isCurrent && (
                          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                            <Button
                              variant="contained"
                              color="primary"
                              size="small"
                              onClick={() => navigate(`/shipment/${p.id}`)}
                            >
                              Ver y gestionar
                            </Button>
                          </Stack>
                        )}
                        {!isCurrent && !isCompleted && (
                          <Button
                            size="small"
                            sx={{ mt: 1 }}
                            onClick={() => navigate(`/shipment/${p.id}`)}
                          >
                            Ver detalle
                          </Button>
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              )
            })}
          </Stack>
          )}
        </>
      )}

      {/* Chatbot Tracky — Reportar Incidente */}
      <ReportarIncidenteDialog
        open={incidenteOpen}
        onClose={() => setIncidenteOpen(false)}
        user={user}
      />

      {/* Próxima parada: QR + demora rápida */}
      <ParadaAccionDialog
        open={paradaAccionOpen}
        parada={proxima}
        onClose={() => setParadaAccionOpen(false)}
        onScanSuccess={(feedback) => {
          setQrFeedback(feedback)
          setTimeout(() => setQrFeedback(null), 5000)
        }}
        onReload={() => void load(fechaRuta ?? undefined)}
      />

      {/* Mensajería interna: el repartidor responde al supervisor */}
      <Dialog open={mensajesOpen} onClose={() => setMensajesOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ChatIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>Mensajes del Supervisor</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.5 }}>
          <Box
            sx={{
              minHeight: 160, maxHeight: 300, overflowY: 'auto',
              bgcolor: isDark ? 'rgba(0,0,0,0.2)' : '#fafafa',
              borderRadius: 1.5, p: 1, mb: 1.5,
              border: '1px solid', borderColor: 'divider',
            }}
          >
            {mensajesData.length === 0 ? (
              <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                Sin mensajes aún.
              </Typography>
            ) : (
              <Stack spacing={0.8}>
                {mensajesData.map((m) => {
                  const isMine = m.deRol === 'repartidor'
                  return (
                    <Stack key={m.id} direction={isMine ? 'row-reverse' : 'row'} spacing={0.8} alignItems="flex-end">
                      <Paper
                        elevation={0}
                        sx={{
                          maxWidth: '80%', px: 1.3, py: 0.8,
                          borderRadius: isMine ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
                          bgcolor: isMine ? '#1565C0' : (isDark ? 'rgba(255,255,255,0.07)' : '#e3f2fd'),
                          color: isMine ? '#fff' : 'text.primary',
                        }}
                      >
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{m.texto}</Typography>
                        <Typography variant="caption" sx={{ opacity: 0.6, fontSize: 10, display: 'block', textAlign: isMine ? 'right' : 'left' }}>
                          {m.deNombre} · {formatInstantArgentinaTime(m.fecha, { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      </Paper>
                    </Stack>
                  )
                })}
                <div ref={mensajesChatEndRef} />
              </Stack>
            )}
          </Box>
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder="Responder al supervisor…"
              value={mensajesInput}
              onChange={(e) => setMensajesInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendMensajeRepartidor() } }}
              multiline
              maxRows={3}
            />
            <Button
              variant="contained"
              size="small"
              onClick={() => void handleSendMensajeRepartidor()}
              disabled={!mensajesInput.trim()}
              startIcon={<SendIcon />}
              sx={{ whiteSpace: 'nowrap', minWidth: 'auto', px: 1.5 }}
            >
              Enviar
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMensajesOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* G1L-59: modal de consentimiento del Ojo del Patrón. */}
      <ConsentimientoOjoPatronDialog
        open={consentDialog !== null}
        modo={consentDialog ?? 'gestion'}
        onClose={async () => {
          setConsentDialog(null)
          // Re-chequeamos por si revocó desde la gestión.
          const estado = await ojoPatronService.getConsentimiento()
          setConsentimientoAceptado(estado?.aceptado ?? false)
        }}
        onAceptado={() => {
          setConsentimientoAceptado(true)
          // Si venía del flujo de inicio de ruta, seguimos: prueba acústica o confirmación.
          if (consentDialog === 'requerido') {
            if (pruebaRealizadaHoy === false) setPruebaOpen(true)
            else setConfirmInicioOpen(true)
          }
        }}
      />

      {/* G1L-60: prueba acústica antes de iniciar la ruta. */}
      <PruebaAcusticaDialog
        open={pruebaOpen}
        umbral={umbralPrueba}
        onClose={() => setPruebaOpen(false)}
        onCompletado={() => {
          setPruebaRealizadaHoy(true)
          setPruebaOpen(false)
          setConfirmInicioOpen(true)
        }}
      />

      {/* G1L-43: confirmación de inicio de ruta. Pasa todos los "Listo para Salir" a "En Tránsito". */}
      <Dialog open={confirmInicioOpen} onClose={() => !iniciandoRuta && setConfirmInicioOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <PlayArrowIcon color="success" /> <span>Inicializar ruta del día</span>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vas a iniciar la ruta con <strong>{metrics.listosParaSalir} envío{metrics.listosParaSalir === 1 ? '' : 's'}</strong> en estado "Listo para Salir".
            Todos pasarán a <strong>En Tránsito</strong> y quedarás como responsable.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, fontStyle: 'italic' }}>
            Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmInicioOpen(false)} disabled={iniciandoRuta}>Cancelar</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleConfirmarInicio}
            disabled={iniciandoRuta}
            startIcon={iniciandoRuta ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
          >
            {iniciandoRuta ? 'Iniciando...' : 'Sí, iniciar ruta'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de escaneo de QR — cámara (default) o entrada manual del código. */}
      <Dialog
        open={openQr}
        onClose={() => !qrSubmitting && setOpenQr(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <QrCodeScannerIcon color="primary" /> <span>Escanear QR del paquete</span>
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
                Apuntá la cámara al código QR del paquete. El sistema lo detecta y avanza el estado solo.
              </DialogContentText>
              <QrCameraScanner onDetect={handleCameraDetect} />
            </>
          ) : (
            <>
              <DialogContentText sx={{ mb: 2 }}>
                Ingresá el código de seguimiento manualmente. El sistema avanza el estado del paquete según corresponda.
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
          <Button onClick={() => setOpenQr(false)} disabled={qrSubmitting}>Cerrar</Button>
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
    </Box>
  )
}

// ============ Componentes auxiliares ============

function KpiCard({
  label, value, sub, suffix, color, icon,
}: { label: string; value: number; sub?: string; suffix?: string; color: string; icon: React.ReactNode }) {
  return (
    <Grid item xs={6} md={3}>
      <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color, mb: 0.5 }}>
            {icon}
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              {label}
            </Typography>
          </Stack>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.1 }}>
            {value}
            {suffix && (
              <Typography component="span" variant="caption" color="text.secondary">{suffix}</Typography>
            )}
          </Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </CardContent>
      </Card>
    </Grid>
  )
}
