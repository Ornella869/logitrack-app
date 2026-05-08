import { useEffect, useMemo, useState } from 'react'
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import BoltIcon from '@mui/icons-material/Bolt'
import HourglassTopIcon from '@mui/icons-material/HourglassTop'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import { shipmentService } from '../services/shipmentService'
import type { Shipment, User } from '../types'
import ShipmentCard from '../components/ShipmentCard'
import ShipmentForm from '../components/ShipmentForm'
import UsersManagement from '../components/UsersManagement'
import SearchBar from '../components/SearchBar'
import ShipmentFilters, { type ShipmentFiltersValue } from '../components/ShipmentFilters'

const EMPTY_FILTERS: ShipmentFiltersValue = { status: [], from: '', to: '' }

type Severity = 'success' | 'info' | 'warning' | 'error'

function getGreeting(name: string) {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return `Buenos días, ${name}!`
  if (h >= 12 && h < 20) return `Buenas tardes, ${name}!`
  return `Buenas noches, ${name}!`
}

function Dashboard() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const location = useLocation()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openShipmentForm, setOpenShipmentForm] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ShipmentFiltersValue>(EMPTY_FILTERS)
  const [hasQuery, setHasQuery] = useState(false)
  const [actionToast, setActionToast] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const showActionToast = (message: string, severity: Severity = 'success') => {
    setActionToast({ open: true, message, severity })
  }
  const closeActionToast = () => setActionToast((prev) => ({ ...prev, open: false, message: '' }))

  if (!user) {
    return <CircularProgress />
  }

  const isOperador = user.role === 'operador'
  const isSupervisor = user.role === 'supervisor'
  const isAdmin = user.role === 'administrador'
  const canSeeShipmentList = isOperador || isSupervisor || isAdmin

  useEffect(() => {
    if (canSeeShipmentList) loadShipments(search, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters.status.join(','), filters.from, filters.to])

  useEffect(() => {
    if (location.pathname === '/app' && location.state?.forceReload && canSeeShipmentList) {
      loadShipments(search, filters)
      navigate('/app', { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.state])

  const loadShipments = async (q: string, f: ShipmentFiltersValue) => {
    setLoading(true)
    setError('')
    try {
      const data = await shipmentService.getAllShipments(
        q || undefined,
        f.status.length ? f.status : undefined,
        f.from || undefined,
        f.to || undefined,
      )
      setShipments(data)
      setHasQuery(Boolean(q || f.status.length || f.from || f.to))
    } catch {
      setError('Error al cargar los envíos')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => setSearch(query.trim())

  const handleCreateShipment = async (
    shipment: Omit<Shipment, 'id' | 'lastUpdate' | 'trackingId'>,
  ) => {
    try {
      const newShipment = await shipmentService.registerShipment(shipment)
      if (newShipment) {
        setShipments((prev) => [newShipment, ...prev])
        showActionToast(`Envío creado. Tracking ID: ${newShipment.trackingId}`, 'success')
        setOpenShipmentForm(false)
        return
      }
      throw new Error('No se pudo crear el envío')
    } catch {
      showActionToast('Error al crear el envío', 'error')
      throw new Error('No se pudo crear el envío')
    }
  }

  const handleDownloadShipments = () => {
    if (shipments.length === 0) {
      showActionToast('No hay envíos para descargar', 'warning')
      return
    }
    const headers = ['ID', 'Tracking ID', 'Estado', 'Origen', 'Destino', 'Remitente', 'Destinatario', 'Peso (kg)', 'Descripción', 'Fecha Creación']
    const rows = shipments.map((s) => [s.id, s.trackingId, s.status, s.origin, s.destination, s.sender.name, s.receiver.name, s.weight, s.description, s.createdDate])
    const csvContent = '﻿' + [headers.join(';'), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';'))].join('\n')
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent))
    element.setAttribute('download', `envios_${new Date().toISOString().split('T')[0]}.csv`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    showActionToast('CSV descargado correctamente', 'info')
  }

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS)
    setSearch('')
  }

  // ============ SUPERVISOR view (G1L-54 + KPIs) ============
  const supervisorMetrics = useMemo(() => {
    const pendientes = shipments.filter((s) => s.status === 'Pendiente de calendarización')
    const asignados = shipments.filter(
      (s) => s.status === 'Asignado a vehículo' || s.status === 'Cargado en vehículo' || s.status === 'Listo para salir',
    )
    const enTransito = shipments.filter((s) => s.status === 'En tránsito')
    const hoyStr = new Date().toISOString().split('T')[0]
    const entregadosHoy = shipments.filter((s) => s.status === 'Entregado' && s.lastUpdate === hoyStr)
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
          <Button
            size="large"
            variant="contained"
            color="primary"
            startIcon={<BoltIcon />}
            onClick={() => navigate('/calendarizar')}
          >
            Calendarizar envíos pendientes
          </Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleDownloadShipments}>
            Exportar CSV
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

      <SearchBar onSearch={handleSearch} loading={loading} />
      <ShipmentFilters value={filters} onChange={setFilters} onClear={handleClearFilters} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : hasQuery ? (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Resultados de búsqueda ({shipments.length})
          </Typography>
          {shipments.length === 0 ? (
            <Alert severity="info">No se encontraron envíos para los filtros aplicados.</Alert>
          ) : (
            <Grid container spacing={2}>
              {shipments.map((s) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                  <ShipmentCard shipment={s} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      ) : (
        <>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Envíos Pendientes de Calendarización
          </Typography>
          {supervisorMetrics.pendientes.length === 0 ? (
            <Alert severity="success">No hay envíos pendientes. Todo calendarizado.</Alert>
          ) : (
            <Grid container spacing={2}>
              {supervisorMetrics.pendientes.map((s) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                  <PendienteCard shipment={s} onClick={() => navigate(`/shipment/${s.id}`)} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Box>
  )

  // ============ OPERADOR / ADMIN ============
  const renderOperador = () => (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Dashboard - {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {getGreeting(user.name)}
        </Typography>
      </Box>

      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6">Envíos</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenShipmentForm(true)} size="small">
              Nuevo envío
            </Button>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleDownloadShipments} size="small">
              Descargar CSV
            </Button>
          </Box>
        </Box>

        <SearchBar onSearch={handleSearch} loading={loading} />
        <ShipmentFilters value={filters} onChange={setFilters} onClear={handleClearFilters} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
        ) : shipments.length === 0 ? (
          <Alert severity="info">
            {hasQuery ? 'No se encontraron envíos para los filtros aplicados' : 'No hay envíos disponibles'}
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {shipments.map((s) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={s.id}>
                <ShipmentCard shipment={s} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    </Box>
  )

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      {isAdmin && (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h4" gutterBottom>Dashboard - Administrador</Typography>
            <Typography variant="body2" color="textSecondary">{getGreeting(user.name)}</Typography>
          </Box>
          <UsersManagement currentUserId={user.id} />
        </>
      )}

      {isSupervisor && renderSupervisor()}
      {isOperador && renderOperador()}

      {user.role === 'repartidor' && (
        <Alert severity="info">
          Esta vista no está disponible para tu rol. Volvé a tu panel de repartidor.
        </Alert>
      )}

      <ShipmentForm open={openShipmentForm} onClose={() => setOpenShipmentForm(false)} onSubmit={handleCreateShipment} />

      <Snackbar
        open={actionToast.open}
        autoHideDuration={3500}
        onClose={closeActionToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={actionToast.severity} variant="filled" onClose={closeActionToast} sx={{ width: '100%' }}>
          {actionToast.message}
        </Alert>
      </Snackbar>
    </Box>
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

function PendienteCard({ shipment, onClick }: { shipment: Shipment; onClick: () => void }) {
  const isPrioritario = shipment.tipoEnvio === 'Prioritario'
  return (
    <Card
      variant="outlined"
      sx={{ cursor: 'pointer', height: '100%', transition: 'all .15s', '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' } }}
      onClick={onClick}
    >
      <CardContent>
        {isPrioritario && (
          <Chip
            size="small"
            label="⚡ Prioritario"
            sx={{ bgcolor: '#fdecea', color: '#c62828', border: '1px solid #c62828', fontWeight: 600, mb: 1 }}
          />
        )}
        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mb: 1 }}>
          {shipment.trackingId}
        </Typography>
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>{shipment.origin || '—'}</strong> → <strong>{shipment.destination || '—'}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          CP destino: <strong>{shipment.receiver.postalCode}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Peso: <strong>{shipment.weight} kg</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Destinatario: <strong>{shipment.receiver.name}</strong>
        </Typography>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #eee' }}>
          <Chip size="small" label="Pend. Calendarización" sx={{ bgcolor: '#f0f0f0', color: '#555', fontSize: 10, height: 20 }} />
          <Typography variant="caption" color="text.secondary">
            {shipment.createdDate}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default Dashboard
