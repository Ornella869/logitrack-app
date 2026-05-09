import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import BoltIcon from '@mui/icons-material/Bolt'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import GroupIcon from '@mui/icons-material/Group'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import RouteIcon from '@mui/icons-material/Route'
import { shipmentService } from '../services/shipmentService'
import type { Shipment, User } from '../types'
import UsersManagement from '../components/UsersManagement'

function getGreeting(name: string) {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return `Buenos días, ${name}!`
  if (h >= 12 && h < 20) return `Buenas tardes, ${name}!`
  return `Buenas noches, ${name}!`
}

function Dashboard() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(user.role === 'supervisor')
  const [error, setError] = useState('')

  const isOperador = user.role === 'operador'
  const isSupervisor = user.role === 'supervisor'
  const isAdmin = user.role === 'administrador'

  useEffect(() => {
    if (!isSupervisor) {
      return
    }

    const loadShipments = async () => {
      setLoading(true)
      setError('')
      try {
        const data = await shipmentService.getAllShipments()
        setShipments(data)
      } catch {
        setError('Error al cargar los indicadores del dashboard')
      } finally {
        setLoading(false)
      }
    }

    void loadShipments()
  }, [isSupervisor])

  const supervisorMetrics = useMemo(() => {
    const pendientes = shipments.filter((shipment) => shipment.status === 'Pendiente de calendarización')
    const asignados = shipments.filter(
      (shipment) => shipment.status === 'Asignado a vehículo' || shipment.status === 'Cargado en vehículo' || shipment.status === 'Listo para salir',
    )
    const enTransito = shipments.filter((shipment) => shipment.status === 'En tránsito')
    const hoyStr = new Date().toISOString().split('T')[0]
    const entregadosHoy = shipments.filter((shipment) => shipment.status === 'Entregado' && shipment.lastUpdate === hoyStr)
    const oldestPending = pendientes.length
      ? pendientes.reduce((a, b) => (a.createdDate < b.createdDate ? a : b))
      : null

    return { pendientes, asignados, enTransito, entregadosHoy, oldestPending }
  }, [shipments])

  const renderSupervisor = () => (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        sx={{ mb: 3, gap: 2 }}
      >
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Dashboard - Supervisor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {getGreeting(user.name)}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button size="large" variant="contained" startIcon={<Inventory2Icon />} onClick={() => navigate('/envios')}>
            Ir a envíos
          </Button>
          <Button variant="outlined" startIcon={<BoltIcon />} onClick={() => navigate('/calendarizar')}>
            Calendarizar pendientes
          </Button>
        </Stack>
      </Stack>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <KpiCard label="Pendientes de Calendarización" value={supervisorMetrics.pendientes.length} sub="Esperando proceso" color="#ed6c02" icon={<HourglassTopIcon />} />
        <KpiCard label="Asignados" value={supervisorMetrics.asignados.length} sub="Calendarizados" color="#1976d2" icon={<Inventory2Icon />} />
        <KpiCard label="En Tránsito" value={supervisorMetrics.enTransito.length} sub="Rutas activas" color="#2e7d32" icon={<LocalShippingIcon />} />
        <KpiCard label="Entregados (hoy)" value={supervisorMetrics.entregadosHoy.length} sub="Finalizados" color="#1565c0" icon={<CheckCircleIcon />} />
      </Grid>

      {supervisorMetrics.pendientes.length > 0 && (
        <Alert severity="warning" sx={{ mb: 3, borderLeft: '4px solid #ed6c02' }} icon={<HourglassTopIcon />}>
          <Typography variant="subtitle2" fontWeight={700}>
            Tenés {supervisorMetrics.pendientes.length} envíos pendientes de calendarización
          </Typography>
          {supervisorMetrics.oldestPending && (
            <Typography variant="body2">
              El más antiguo fue cargado el {new Date(supervisorMetrics.oldestPending.createdDate).toLocaleDateString('es-AR')}.
              Ejecutá la calendarización automática para asignarlos a repartidores.
            </Typography>
          )}
        </Alert>
      )}

      <Grid container spacing={2}>
        <QuickAccessCard
          title="Envíos"
          description="Revisá el listado completo, aplicá filtros y descargá exportaciones."
          icon={<Inventory2Icon color="primary" />}
          actionLabel="Abrir envíos"
          onClick={() => navigate('/envios')}
        />
        <QuickAccessCard
          title="Calendarización"
          description="Asigná automáticamente los envíos pendientes a repartidores disponibles."
          icon={<BoltIcon color="primary" />}
          actionLabel="Calendarizar"
          onClick={() => navigate('/calendarizar')}
        />
        <QuickAccessCard
          title="Repartidores"
          description="Consultá rendimiento, disponibilidad y estado operativo del equipo."
          icon={<GroupIcon color="primary" />}
          actionLabel="Ver repartidores"
          onClick={() => navigate('/repartidores')}
        />
        <QuickAccessCard
          title="Operación diaria"
          description="Accedé al calendario operativo y al monitoreo de rutas activas."
          icon={<CalendarMonthIcon color="primary" />}
          actionLabel="Ver calendario"
          onClick={() => navigate('/calendario')}
          secondaryActionLabel="Ver rutas"
          onSecondaryClick={() => navigate('/rutas-activas')}
          secondaryIcon={<RouteIcon color="primary" />}
        />
      </Grid>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && supervisorMetrics.pendientes.length === 0 && (
        <Alert severity="success" sx={{ mt: 3 }}>
          No hay envíos pendientes de calendarización.
        </Alert>
      )}
    </Box>
  )

  const renderOperador = () => (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard - Operador
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {getGreeting(user.name)}
        </Typography>
      </Box>

      <Grid container spacing={2}>
        <QuickAccessCard
          title="Gestión de envíos"
          description="Cargá nuevos envíos, aplicá filtros operativos y seguí el estado de cada paquete."
          icon={<Inventory2Icon color="primary" />}
          actionLabel="Ir a envíos"
          onClick={() => navigate('/envios')}
        />
        <QuickAccessCard
          title="Seguimiento"
          description="Entrá al detalle de cada envío para editarlo o consultar su historial."
          icon={<LocalShippingIcon color="primary" />}
          actionLabel="Ver envíos"
          onClick={() => navigate('/envios')}
        />
      </Grid>
    </Box>
  )

  const renderAdmin = () => (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>Dashboard - Administrador</Typography>
        <Typography variant="body2" color="text.secondary">
          {getGreeting(user.name)} Gestioná usuarios y accesos desde este panel.
        </Typography>
      </Box>

      <UsersManagement currentUserId={user.id} />
    </Box>
  )

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {isAdmin && renderAdmin()}
      {isSupervisor && renderSupervisor()}
      {isOperador && renderOperador()}

      {user.role === 'repartidor' && (
        <Alert severity="info">
          Esta vista no está disponible para tu rol. Volvé a tu panel de repartidor.
        </Alert>
      )}
    </Box>
  )
}

function QuickAccessCard({
  title,
  description,
  icon,
  actionLabel,
  onClick,
  secondaryActionLabel,
  onSecondaryClick,
  secondaryIcon,
}: {
  title: string
  description: string
  icon: React.ReactNode
  actionLabel: string
  onClick: () => void
  secondaryActionLabel?: string
  onSecondaryClick?: () => void
  secondaryIcon?: React.ReactNode
}) {
  return (
    <Grid item xs={12} md={6}>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
            {icon}
            <Typography variant="h6" fontWeight={700}>{title}</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {description}
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="contained" onClick={onClick}>{actionLabel}</Button>
            {secondaryActionLabel && onSecondaryClick && (
              <Button variant="outlined" startIcon={secondaryIcon} onClick={onSecondaryClick}>
                {secondaryActionLabel}
              </Button>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Grid>
  )
}

function KpiCard({
  label, value, sub, color, icon,
}: { label: string; value: number; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Card variant="outlined" sx={{ borderLeft: `4px solid ${color}`, height: '100%' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ color, mb: 0.5 }}>
            {icon}
            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
              {label}
            </Typography>
          </Stack>
          <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.1 }}>
            {value}
          </Typography>
          <Typography variant="caption" color="text.secondary">{sub}</Typography>
        </CardContent>
      </Card>
    </Grid>
  )
}

export default Dashboard
