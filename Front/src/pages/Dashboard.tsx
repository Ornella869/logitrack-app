import { useEffect, useState } from 'react'
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Typography,
  Alert,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  Stack,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Snackbar,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb'
import BlockIcon from '@mui/icons-material/Block'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import { shipmentService } from '../services/shipmentService'
import { vehicleService } from '../services/vehicleService'
import { branchService } from '../services/branchService'
import type { Shipment, User, Vehicle, Branch, BranchStatus } from '../types'
import ShipmentCard from '../components/ShipmentCard'
import ShipmentForm from '../components/ShipmentForm'
import VehicleForm from '../components/VehicleForm'
import BranchForm from '../components/BranchForm'
import RoutesList from '../components/RoutesList'
import TransportistasList from '../components/TransportistasList'
import UsersManagement from '../components/UsersManagement'
import SearchBar from '../components/SearchBar'

// ─── Vehicle status chip (inline) ────────────────────────────────────────────

type VehicleEstado = Vehicle['estado']

const vehicleEstadoConfig: Record<VehicleEstado, { label: string; color: string; bg: string }> = {
  Disponible: { label: 'Disponible', color: '#1B5E20', bg: '#E8F5E9' },
  'En uso': { label: 'En uso', color: '#0D47A1', bg: '#E3F2FD' },
  Mantenimiento: { label: 'Mantenimiento', color: '#E65100', bg: '#FFF3E0' },
  Suspendido: { label: 'Suspendido', color: '#B71C1C', bg: '#FFEBEE' },
}

function VehicleEstadoChip({ estado }: { estado: VehicleEstado }) {
  const cfg = vehicleEstadoConfig[estado] ?? { label: estado, color: '#555', bg: '#eee' }
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.7rem' }}
    />
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const location = useLocation()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [filteredShipments, setFilteredShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [searchLoading, setSearchLoading] = useState(false)
  const [error, setError] = useState('')
  const [openShipmentForm, setOpenShipmentForm] = useState(false)
  const [openVehicleForm, setOpenVehicleForm] = useState(false)
  const [openBranchForm, setOpenBranchForm] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [tab, setTab] = useState(0)
  const [branchStatusFilter, setBranchStatusFilter] = useState<BranchStatus | 'all'>('all')
  const [actionToast, setActionToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'info' | 'warning' | 'error'
  }>({ open: false, message: '', severity: 'success' })
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<string>('Disponible');
  
  const showActionToast = (
    message: string,
    severity: 'success' | 'info' | 'warning' | 'error' = 'success',
  ) => {
    setActionToast({ open: true, message, severity })
  }

  const closeActionToast = () => {
    setActionToast((prev) => ({ ...prev, open: false, message: '' }))
  }


  useEffect(() => {
  const fetchVehicles = async () => {
    if (tab === 1) { // Asumiendo que la pestaña 1 es la de vehículos
      setLoading(true);
      try {
        // Pasamos el string del estado por query param
        const response = await vehicleService.getAllVehiclesByStatus(vehicleStatusFilter);
        setVehicles(response);
      } catch (err) {
        setError('Error al cargar vehículos');
      } finally {
        setLoading(false);
      }
    }
  };

  fetchVehicles();
}, [tab, vehicleStatusFilter]);
  // Retornar si no hay usuario (evitar errores)
  if (!user) {
    return <CircularProgress />
  }

  // Cargar envíos al montar el componente y cuando el usuario vuelve a la página
  useEffect(() => {
    loadData()
  }, [])

  // Recargar datos cuando el usuario navega de vuelta al Dashboard
  useEffect(() => {
    // Solo recargar si estamos en la página principal del Dashboard
    if (location.pathname === '/app') {
      // Si hay un estado forceReload, recargar los datos
      if (location.state?.forceReload) {
        loadData()
        // Limpiar el estado para evitar refrescos innecesarios
        navigate('/app', { replace: true, state: {} })
      }
    }
  }, [location.pathname, location.state])

  // Refrescar datos cuando el usuario vuelve a la pestaña del navegador o navega de vuelta
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Recargar datos cuando la pestaña vuelve a estar visible
        loadData()
      }
    }

    const handleFocus = () => {
      // Recargar datos cuando la ventana recibe el foco
      loadData()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError('')
    try {
      const [shipmentsData, vehiclesData, branchesData] = await Promise.all([
        shipmentService.getAllShipments(),
        vehicleService.getAllVehiclesByStatus("Disponible"),
        branchService.getAllBranches(),
      ])
      setShipments(shipmentsData)
      setFilteredShipments(shipmentsData)
      setVehicles(vehiclesData)
      setBranches(branchesData)
    } catch (err) {
      setError('Error al cargar los datos')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearchLoading(true)
    setError('')
    try {
      if (!query.trim()) {
        setFilteredShipments(shipments)
        setHasSearched(false)
      } else {
        const normalize = (s: string) =>
          s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const q = normalize(query.trim())
        const localMatches = shipments.filter((shipment) => {
          return (
            normalize(shipment.trackingId).includes(q) ||
            normalize(shipment.sender.name).includes(q) ||
            normalize(shipment.receiver.name).includes(q)
          )
        })

        if (localMatches.length > 0) {
          setFilteredShipments(localMatches)
        } else {
          const byTracking = await shipmentService.searchByTrackingId(query)
          setFilteredShipments(byTracking ? [byTracking] : [])
        }
        setHasSearched(true)
      }
    } catch (err) {
      setError('Error al buscar envíos')
    } finally {
      setSearchLoading(false)
    }
  }

  const handleCreateShipment = async (shipment: Omit<Shipment, 'id' | 'lastUpdate'>) => {
    try {
      const newShipment = await shipmentService.registerShipment(shipment)
      if (newShipment) {
        setShipments((prev) => [newShipment, ...prev])
        setFilteredShipments((prev) => [newShipment, ...prev])
        showActionToast('Envío creado correctamente', 'success')
        setOpenShipmentForm(false)
        return
      }
      throw new Error('No se pudo crear el envío')
    } catch (err) {
      showActionToast('Error al crear el envío', 'error')
      throw err
    }
  }

  const handleCreateVehicle = async (vehicle: Omit<Vehicle, 'id'>) => {
    try {
      const newVehicle = await vehicleService.createVehicle(vehicle)
      setVehicles((prev) => [newVehicle, ...prev])
      showActionToast('Vehículo creado correctamente', 'success')
      setOpenVehicleForm(false)
    } catch (err) {
      showActionToast('Error al crear el vehículo', 'error')
      throw err
    }
  }

  const handleCreateBranch = (branch: Branch) => {
    setBranches((prev) => [branch, ...prev])
    showActionToast('Sucursal creada correctamente', 'success')
    setOpenBranchForm(false)
  }

  // Descargar envíos como CSV
  const handleDownloadShipments = () => {
    if (shipments.length === 0) {
      showActionToast('No hay envíos para descargar', 'warning')
      return
    }

    // Preparar datos para CSV
    const headers = ['ID', 'Tracking ID', 'Estado', 'Origen', 'Destino', 'Remitente', 'Destinatario', 'Peso (kg)', 'Descripción', 'Fecha Creación', 'Fecha Entrega Estimada']
    const rows = shipments.map(s => [
      s.id,
      s.trackingId,
      s.status,
      s.origin,
      s.destination,
      s.sender.name,
      s.receiver.name,
      s.weight,
      s.description,
      s.createdDate,
      s.estimatedDelivery,
    ])

    // Crear contenido CSV
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';')),
    ].join('\n')

    // Descargar archivo
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent))
    element.setAttribute('download', `envios_${new Date().toISOString().split('T')[0]}.csv`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    showActionToast('CSV descargado correctamente', 'info')
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              Dashboard - {user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Usuario'}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Bienvenido, {user?.name || 'Usuario'}
            </Typography>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* SUPERVISOR */}
      {user.role === 'supervisor' && (
        <Box>
          <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} sx={{ mb: 3 }}>
            <Tab label={`Envíos ${filteredShipments.length > 0 ? `(${filteredShipments.length})` : ''}`} />
            <Tab label={`Sucursales ${branches.length > 0 ? `(${branches.length})` : ''}`} />
            <Tab label="Transportistas" />
            <Tab label="Rutas" />
          </Tabs>

          {/* TAB ENVIOS */}
          {tab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Envíos</Typography>
                <Button
                  variant="outlined"
                  startIcon={<FileDownloadIcon />}
                  onClick={handleDownloadShipments}
                  size="small"
                >
                  Descargar CSV
                </Button>
              </Box>
              <SearchBar onSearch={handleSearch} loading={searchLoading} />
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : filteredShipments.length === 0 ? (
            <Alert severity="info">
              {hasSearched ? 'No se encontraron envíos' : 'No hay envíos disponibles'}
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {filteredShipments.map((shipment) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={shipment.id}>
                  <ShipmentCard shipment={shipment} />
                </Grid>
              ))}
            </Grid>
          )}
            </Box>
          )}

          {/* TAB SUCURSALES */}
          {tab === 1 && (
            <BranchesTab
              branches={branches}
              loading={loading}
              statusFilter={branchStatusFilter}
              onStatusFilterChange={setBranchStatusFilter}
              canCreate
              onCreateClick={() => setOpenBranchForm(true)}
            />
          )}

          {/* TAB TRANSPORTISTAS */}
          {tab === 2 && <TransportistasList userRole="supervisor" />}

          {/* TAB RUTAS */}
          {tab === 3 && <RoutesList userRole="supervisor" />}
        </Box>
      )}

      {/* OPERADOR */}
      {user.role === 'operador' && (
        <Box>
          <Tabs value={tab} onChange={(_, newValue) => setTab(newValue)} sx={{ mb: 3 }}>
            <Tab label={`Envíos ${filteredShipments.length > 0 ? `(${filteredShipments.length})` : ''}`} />
            <Tab label={`Vehículos ${vehicles.length > 0 ? `(${vehicles.length})` : ''}`} />
            <Tab label={`Sucursales ${branches.length > 0 ? `(${branches.length})` : ''}`} />
            <Tab label="Transportistas" />
            <Tab label="Rutas" />
          </Tabs>

          {/* TAB ENVIOS */}
          {tab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Nuevos Envíos</Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenShipmentForm(true)}
                >
                  Registrar envío
                </Button>
              </Box>
              <SearchBar onSearch={handleSearch} loading={searchLoading} />
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                  <CircularProgress />
                </Box>
              ) : filteredShipments.length === 0 ? (
                <Alert severity="info">
                  {hasSearched ? 'No se encontraron envíos' : 'No hay envíos disponibles'}
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  {filteredShipments.map((shipment) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={shipment.id}>
                      <ShipmentCard shipment={shipment} />
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* TAB VEHICULOS */}
          {tab === 1 && (
            <Box>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
      <Typography variant="h6">Mis Vehículos</Typography>
      
      {/* Contenedor para los controles de la derecha */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Selector de Estado */}
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="filtro-estado-label">Estado</InputLabel>
          <Select
            labelId="filtro-estado-label"
            id="filtro-estado-select"
            label="Estado"
            value={vehicleStatusFilter}
            onChange={(e) => setVehicleStatusFilter(e.target.value as string)}
          >
            <MenuItem value="Disponible">Disponible</MenuItem>
            <MenuItem value="EnUso">En Uso</MenuItem>
            <MenuItem value="Mantenimiento">Mantenimiento</MenuItem>
            <MenuItem value="Suspendido">Suspendido</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenVehicleForm(true)}
        >
          Registrar vehículo
        </Button>
      </Box>
    </Box>

    {loading ? (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    ) : vehicles.length === 0 ? (
      <Alert severity="info" sx={{ mt: 2 }}>
        {` No se encontraron vehiculos`}
      </Alert>
    ) : (
      <Box>
        <Grid container spacing={3}>
          {vehicles.map((vehicle) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={vehicle.id} sx={{ display: 'flex' }}>
              <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <DirectionsCarIcon color="primary" fontSize="small" />
                      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700 }}>
                        {vehicle.patente}
                      </Typography>
                    </Box>
                    <VehicleEstadoChip estado={vehicle.estado} />
                  </Box>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Marca
                      </Typography>
                      <Typography variant="body2">{vehicle.marca}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Capacidad de carga
                      </Typography>
                      <Typography variant="body2">{vehicle.capacidadCarga} kg</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Rutas asignadas
                      </Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {vehicle.assignedRouteIds?.length ?? 0}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
                <CardActions sx={{ pt: 0, px: 2, pb: 1.5 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    fullWidth
                    onClick={() => navigate(`/vehiculo/${vehicle.id}`)}
                  >
                    Ver detalle
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    )}
  </Box>
          )}

          {/* TAB SUCURSALES */}
          {tab === 2 && (
            <BranchesTab
              branches={branches}
              loading={loading}
              statusFilter={branchStatusFilter}
              onStatusFilterChange={setBranchStatusFilter}
              canCreate={false}
            />
          )}

          {/* TAB TRANSPORTISTAS */}
          {tab === 3 && <TransportistasList userRole="operador" />}

          {/* TAB RUTAS */}
          {tab === 4 && <RoutesList userRole="operador" />}
        </Box>
      )}

      {/* ADMINISTRADOR */}
      {user.role === 'administrador' && <UsersManagement />}

      {/* REPARTIDOR */}
      {user.role === 'repartidor' && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">Mis Rutas</Typography>
          </Box>
          <Alert severity="info">
            Funcionalidad de rutas en desarrollo...
          </Alert>
        </Box>
      )}

      <ShipmentForm
        open={openShipmentForm}
        onClose={() => setOpenShipmentForm(false)}
        onSubmit={handleCreateShipment}
      />
      <VehicleForm
        open={openVehicleForm}
        onClose={() => setOpenVehicleForm(false)}
        onSubmit={handleCreateVehicle}
        operatorId={user.id}
      />
      <BranchForm
        open={openBranchForm}
        onClose={() => setOpenBranchForm(false)}
        onBranchCreated={handleCreateBranch}
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

// ─── BranchStatusChip ─────────────────────────────────────────────────────────

function BranchStatusChip({ status }: { status: BranchStatus }) {
  const config: Record<BranchStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    Activa: {
      label: 'Activa',
      color: '#1B5E20',
      bg: '#E8F5E9',
      icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
    },
    Cerrada: {
      label: 'Cerrada',
      color: '#B71C1C',
      bg: '#FFEBEE',
      icon: <DoNotDisturbIcon sx={{ fontSize: 14 }} />,
    },
    'Inhabilitada': {
      label: 'Inhabilitada',
      color: '#E65100',
      bg: '#FFF3E0',
      icon: <BlockIcon sx={{ fontSize: 14 }} />,
    },
  }
  const { label, color, bg, icon } = config[status]
  return (
    <Chip
      icon={icon as React.ReactElement}
      label={label}
      size="small"
      sx={{
        bgcolor: bg,
        color,
        fontWeight: 700,
        fontSize: '0.7rem',
        '& .MuiChip-icon': { color },
      }}
    />
  )
}

// ─── BranchesTab sub-component ────────────────────────────────────────────────

interface BranchesTabProps {
  branches: Branch[]
  loading: boolean
  statusFilter: BranchStatus | 'all'
  onStatusFilterChange: (value: BranchStatus | 'all') => void
  canCreate?: boolean
  onCreateClick?: () => void
}

function BranchesTab({
  branches,
  loading,
  statusFilter,
  onStatusFilterChange,
  canCreate = false,
  onCreateClick,
}: BranchesTabProps) {
  const filtered = statusFilter === 'all' ? branches : branches.filter((b) => b.status === statusFilter)

  const counts = {
    all: branches.length,
    Activa: branches.filter((b) => b.status === 'Activa').length,
    Cerrada: branches.filter((b) => b.status === 'Cerrada').length,
    'Inhabilitada': branches.filter((b) => b.status === 'Inhabilitada').length,
  }

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 2,
        }}
      >
        <Typography variant="h6">Sucursales Registradas</Typography>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateClick} size="small">
            Registrar sucursal
          </Button>
        )}
      </Box>

      {/* Filter bar */}
      <Box sx={{ mb: 3 }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, val) => { if (val !== null) onStatusFilterChange(val) }}
          size="small"
          sx={{ flexWrap: 'wrap', gap: 0.5 }}
        >
          <ToggleButton value="all" sx={{ borderRadius: '8px !important', fontWeight: 600, fontSize: '0.75rem' }}>
            Todas ({counts.all})
          </ToggleButton>
          <ToggleButton
            value="Activa"
            sx={{
              borderRadius: '8px !important',
              fontWeight: 600,
              fontSize: '0.75rem',
              '&.Mui-selected': { bgcolor: '#E8F5E9', color: '#1B5E20', borderColor: '#A5D6A7' },
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 14, mr: 0.5 }} />
            Activa ({counts.Activa})
          </ToggleButton>
          <ToggleButton
            value="Cerrada"
            sx={{
              borderRadius: '8px !important',
              fontWeight: 600,
              fontSize: '0.75rem',
              '&.Mui-selected': { bgcolor: '#FFEBEE', color: '#B71C1C', borderColor: '#EF9A9A' },
            }}
          >
            <DoNotDisturbIcon sx={{ fontSize: 14, mr: 0.5 }} />
            Cerrada ({counts.Cerrada})
          </ToggleButton>
          <ToggleButton
            value="Inhabilitada"
            sx={{
              borderRadius: '8px !important',
              fontWeight: 600,
              fontSize: '0.75rem',
              '&.Mui-selected': { bgcolor: '#FFF3E0', color: '#E65100', borderColor: '#FFCC80' },
            }}
          >
            <BlockIcon sx={{ fontSize: 14, mr: 0.5 }} />
            Inhabilitada ({counts['Inhabilitada']})
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : branches.length === 0 ? (
        <Alert severity="info">No hay sucursales registradas</Alert>
      ) : filtered.length === 0 ? (
        <Alert severity="info">No hay sucursales con estado "{statusFilter}"</Alert>
      ) : (
        <Grid container spacing={3}>
          {filtered.map((branch) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={branch.id} sx={{ display: 'flex' }}>
              <Card sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1.3, flex: 1, mr: 1 }}>
                      {branch.name}
                    </Typography>
                    <BranchStatusChip status={branch.status} />
                  </Box>
                  <Stack spacing={1}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Dirección
                      </Typography>
                      <Typography variant="body2">{branch.address}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Ciudad
                      </Typography>
                      <Typography variant="body2">{branch.city} ({branch.postalCode})</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        Teléfono
                      </Typography>
                      <Typography variant="body2">{branch.phone}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default Dashboard
