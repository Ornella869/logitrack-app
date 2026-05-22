import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
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
  Grid,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import RouteIcon from '@mui/icons-material/Route'
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
import { shipmentService } from '../../services/shipmentService'
import { branchService, type BranchOrigin } from '../../services/branchService'
import { ojoPatronService } from '../../services/ojoPatronService'
import StatusBadge from '../../components/StatusBadge'
import RouteMap from '../../components/RouteMap'
import QrCameraScanner from '../../components/QrCameraScanner'
import ConsentimientoOjoPatronDialog from '../../components/ConsentimientoOjoPatronDialog'
import PruebaAcusticaDialog from '../../components/PruebaAcusticaDialog'
import { buildMapsUrl } from '../../utils/mapsUrl'
import type { Shipment, User } from '../../types'

// G1L-23: Mi ruta del día. Trae paquetes asignados al repartidor logueado para hoy,
// ordenados por CP. El mapa pinta la sucursal de origen y las paradas en orden.

// Clave para recordar el día seleccionado al navegar entre pantallas.
const FECHA_STORAGE_KEY = 'repartidor_fecha_ruta'

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

export default function RepartidorDashboard() {
  const navigate = useNavigate()
  const user = useOutletContext<User>()
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [paradas, setParadas] = useState<Shipment[]>([])
  const [fechaRuta, setFechaRuta] = useState<string | null>(null)
  const [fechasDisponibles, setFechasDisponibles] = useState<string[]>([])
  const [origen, setOrigen] = useState<BranchOrigin | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState(0)
  // Fase A: estado de jornada (Disponible / EnRuta / Retornando)
  const [estadoJornada, setEstadoJornada] = useState('Disponible')
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

  const load = async (fecha?: string) => {
    setLoading(true)
    setError('')
    try {
      const [data, fechas, sucursal, jornada] = await Promise.all([
        shipmentService.getMiRutaDelDia(fecha),
        shipmentService.getMisFechasDeRuta(),
        // origen sólo se pide en la primera carga; cacheamos.
        origen ? Promise.resolve(origen) : branchService.getSucursalOrigen(),
        shipmentService.getEstadoJornada(),
      ])
      setParadas(data.paradas)
      setFechaRuta(data.fecha)
      setFechasDisponibles(fechas)
      setEstadoJornada(jornada)
      // Persistimos el día elegido para que sobreviva al salir/entrar de la vista.
      if (data.fecha) sessionStorage.setItem(FECHA_STORAGE_KEY, data.fecha)
      if (!origen) setOrigen(sucursal)
    } catch {
      setError('No se pudo cargar tu ruta del día')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Si veníamos de otra pantalla, restauramos el día que estaba seleccionado.
    // Pero si ese día ya pasó (sesión vieja), lo descartamos para mostrar hoy/próximo.
    const guardada = sessionStorage.getItem(FECHA_STORAGE_KEY)
    let fechaInicial = guardada ?? undefined
    if (guardada) {
      const inicioHoy = new Date(new Date().toDateString()).getTime()
      if (new Date(guardada).getTime() < inicioHoy) {
        fechaInicial = undefined
        sessionStorage.removeItem(FECHA_STORAGE_KEY)
      }
    }
    load(fechaInicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const fechaActual = fechaRuta ? new Date(fechaRuta) : new Date()
  const fechaHoy = fechaActual.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
  const esHoy = fechaRuta ? new Date(fechaRuta).toDateString() === new Date().toDateString() : false
  const esFutura = fechaRuta ? new Date(fechaRuta).getTime() > new Date(new Date().toDateString()).getTime() : false

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

  // Fase A: el repartidor confirma que volvió a la sucursal → vuelve a estar disponible.
  const handleCerrarJornada = async () => {
    setCerrandoJornada(true)
    const res = await shipmentService.cerrarJornada()
    setCerrandoJornada(false)
    if (res.success) {
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
            {esHoy ? 'Mi Ruta del Día' : esFutura ? 'Mi Próxima Ruta' : 'Mi Ruta'}
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
          {fechasDisponibles.length > 1 && (
            <Select
              size="small"
              value={fechaRuta ?? ''}
              onChange={(e) => load(String(e.target.value))}
            >
              {fechasDisponibles.map((f) => (
                <MenuItem key={f} value={f}>
                  {new Date(f).toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })}
                </MenuItem>
              ))}
            </Select>
          )}
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
          {showRetorno && (
            <Button
              variant="contained"
              startIcon={<DirectionsIcon />}
              onClick={() => {
                const url = buildReturnUrl()
                if (url) window.open(url, '_blank', 'noopener,noreferrer')
              }}
              sx={{ bgcolor: '#5e35b1', '&:hover': { bgcolor: '#4527a0' } }}
            >
              Retorno a Sucursal
            </Button>
          )}
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

      {esFutura && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Tu próxima ruta está programada para el <strong>{fechaHoy}</strong>. Hoy no tenés paradas asignadas.
        </Alert>
      )}

      {origen && (origen.latitud == null || origen.longitud == null) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No se pudo ubicar la sucursal <strong>{origen.name}</strong> en el mapa
          ({origen.address}, {origen.city}). Verificá la dirección en el panel del administrador.
        </Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="🗺️ Mapa" />
              <Tab label="📋 Mis paradas" />
            </Tabs>
          </Box>

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
                        : `Orden automático por código postal y FIFO · ${paradas.length} paradas`}
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
                    onClick={() => proxima && navigate(`/shipment/${proxima.id}`)}
                  >
                    Navegar a próxima parada
                  </Button>
                  {showRetorno && (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<DirectionsIcon />}
                      onClick={() => {
                        const url = buildReturnUrl()
                        if (url) window.open(url, '_blank', 'noopener,noreferrer')
                      }}
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
                showReturnRoute={showRetorno}
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
            </Card>
          )}

          {tab === 1 && (
          <Stack spacing={1.5}>
            {paradas.map((p, idx) => {
              const isCompleted = p.status === 'Entregado' || p.status === 'Cancelado'
              const isCurrent = idx === metrics.proximaIdx
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
                        {idx + 1}
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
