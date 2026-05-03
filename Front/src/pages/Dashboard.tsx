import { useEffect, useState } from 'react'
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import { shipmentService } from '../services/shipmentService'
import type { Shipment, User } from '../types'
import ShipmentCard from '../components/ShipmentCard'
import ShipmentForm from '../components/ShipmentForm'
import UsersManagement from '../components/UsersManagement'
import BranchManagement from '../components/BranchManagement'
import SearchBar from '../components/SearchBar'
import ShipmentFilters, { type ShipmentFiltersValue } from '../components/ShipmentFilters'

const EMPTY_FILTERS: ShipmentFiltersValue = { status: [], from: '', to: '' }

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

  if (!user) {
    return <CircularProgress />
  }

  // Solo Operador y Supervisor pueden ver el listado de envíos (G1L-39)
  const canSeeShipmentList =
    user.role === 'operador' || user.role === 'supervisor' || user.role === 'administrador'

  useEffect(() => {
    if (canSeeShipmentList) loadShipments(search, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters.status.join(','), filters.from, filters.to])

  // Recargar al volver de detalle
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
    } catch (err) {
      setError('Error al cargar los envíos')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async (query: string) => {
    setSearch(query.trim())
  }

  const handleCreateShipment = async (shipment: Omit<Shipment, 'id' | 'lastUpdate' | 'trackingId'>) => {
    try {
      const newShipment = await shipmentService.registerShipment(shipment)
      if (newShipment) {
        setShipments((prev) => [newShipment, ...prev])
        showActionToast(`Envío creado. Tracking ID: ${newShipment.trackingId}`, 'success')
        setOpenShipmentForm(false)
        return
      }
      throw new Error('No se pudo crear el envío')
    } catch (err) {
      showActionToast('Error al crear el envío', 'error')
      throw err
    }
  }

  const handleDownloadShipments = () => {
    if (shipments.length === 0) {
      showActionToast('No hay envíos para descargar', 'warning')
      return
    }
    const headers = ['ID', 'Tracking ID', 'Estado', 'Origen', 'Destino', 'Remitente', 'Destinatario', 'Peso (kg)', 'Descripción', 'Fecha Creación']
    const rows = shipments.map((s) => [
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
    ])
    const csvContent = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';'))].join('\n')
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

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Dashboard - {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Bienvenido, {user.name}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Administrador → Gestión de usuarios (G1L-30) */}
      {user.role === 'administrador' && (
        <>
          <UsersManagement currentUserId={user.id} />
          <BranchManagement />
        </>
      )}

      {/* Operador y Supervisor → Listado de envíos (G1L-39 + G1L-40) */}
      {(user.role === 'operador' || user.role === 'supervisor') && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6">Envíos</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {user.role === 'operador' && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setOpenShipmentForm(true)}
                  size="small"
                >
                  Nuevo envío
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleDownloadShipments}
                size="small"
              >
                Descargar CSV
              </Button>
            </Box>
          </Box>

          <SearchBar onSearch={handleSearch} loading={loading} />
          <ShipmentFilters value={filters} onChange={setFilters} onClear={handleClearFilters} />

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
              <CircularProgress />
            </Box>
          ) : shipments.length === 0 ? (
            <Alert severity="info">
              {hasQuery
                ? 'No se encontraron envíos para los filtros aplicados'
                : 'No hay envíos disponibles'}
            </Alert>
          ) : (
            <Grid container spacing={3}>
              {shipments.map((shipment) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={shipment.id}>
                  <ShipmentCard shipment={shipment} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Repartidor → ya redirigido a /repartidor desde App.tsx (no debería entrar acá) */}
      {user.role === 'repartidor' && (
        <Alert severity="info">
          Esta vista no está disponible para tu rol. Volvé a tu panel de repartidor.
        </Alert>
      )}

      <ShipmentForm
        open={openShipmentForm}
        onClose={() => setOpenShipmentForm(false)}
        onSubmit={handleCreateShipment}
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

export default Dashboard
