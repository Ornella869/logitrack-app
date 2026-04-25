import { useState, useEffect,useMemo } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
   Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd'
import type { Route, Shipment, User, Vehicle } from '../types'
import { routeService } from '../services/routeService'
import { shipmentService } from '../services/shipmentService'
import { authService } from '../services/authService'
import { vehicleService } from '../services/vehicleService'
interface RoutesListProps {
  userRole?: string
}

type RouteFormState = {
  origin: string
  destination: string
  vehicleId: string
  transportistId: string
  shipmentIds: string[]
}

const initialForm: RouteFormState = {
  origin: '',
  destination: '',
  vehicleId: '',
  transportistId: '',
  shipmentIds: [],
}

function RoutesList({ userRole }: RoutesListProps) {
  const isSupervisor = userRole === 'supervisor'
  const [routes, setRoutes] = useState<Route[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([])
   const [transportistas, setTransportistas] = useState<User[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [assignableShipments, setAssignableShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<Route['status'] | 'Todas'>('Todas')
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [assignDialogRoute, setAssignDialogRoute] = useState<Route | null>(null)
  const [selectedTransportistId, setSelectedTransportistId] = useState<string>('')
  const [form, setForm] = useState<RouteFormState>(initialForm)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'info' | 'warning' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const showToast = (
    message: string,
    severity: 'success' | 'info' | 'warning' | 'error' = 'success',
  ) => {
    setToast({ open: true, message, severity })
  }

  const closeToast = () => {
    setToast((prev) => ({ ...prev, open: false, message: '' }))
    setFormError('')
  }

  const activeTransportistas = useMemo(
    () => transportistas.filter((transportista) => (transportista.estado ?? 'Activo') === 'Activo'),
    [transportistas],
  )
  
  useEffect(() => {
    loadRoutes()
  }, [])

    const transportistaMap = useMemo(
    () => new Map(transportistas.map((transportista) => [transportista.id, transportista])),
    [transportistas],
  )


  const loadRoutes = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await routeService.getAllRoutes()
      setRoutes(data)
      setFilteredRoutes(selectedStatus === 'Todas' ? data : data.filter((route) => route.status === selectedStatus))

      if (isSupervisor) {
        const [transportistasData, vehiclesData, shipmentsData] = await Promise.all([
          authService.getTransportistas(),
          vehicleService.getAssignableVehicles(),
          shipmentService.getAssignableShipments(),
        ])
        setTransportistas(transportistasData)
        setVehicles(vehiclesData)
        setAssignableShipments(shipmentsData)
      }
    } catch (err) {
      setError('Error al cargar las rutas')
    } finally {
      setLoading(false)
    }
  }
 const applyStatusFilter = (allRoutes: Route[], status: Route['status'] | 'Todas') => {
    setFilteredRoutes(status === 'Todas' ? allRoutes : allRoutes.filter((route) => route.status === status))
  }


  const handleStatusChange = async (status: Route['status'] | 'Todas') => {
    setSelectedStatus(status)
    if (status === 'Todas') {
      setFilteredRoutes(routes)
    } else {
      const filtered = await routeService.getRoutesByStatus(status)
      setFilteredRoutes(filtered)
    }
  }
const handleOpenCreateDialog = () => {
    setForm(initialForm)
    setFormError('')
    setOpenCreateDialog(true)
  }

  const handleCloseCreateDialog = () => {
    setOpenCreateDialog(false)
    setForm(initialForm)
    setFormError('')
  }

  const handleCreateRoute = async () => {
    if (!form.origin.trim() || !form.destination.trim() || !form.vehicleId || !form.transportistId || form.shipmentIds.length === 0) {
      setFormError('Completá origen, destino, vehículo, transportista y al menos un envío.')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      await routeService.createRoute({
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        vehicleId: form.vehicleId,
        transportistId: form.transportistId,
        shipmentIds: form.shipmentIds,
        status: 'Creada',
      })
      await loadRoutes()
      handleCloseCreateDialog()
      showToast('Ruta creada correctamente', 'success')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'No se pudo crear la ruta.')
      showToast(err instanceof Error ? err.message : 'No se pudo crear la ruta.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenAssignDialog = (route: Route) => {
    setAssignDialogRoute(route)
    setSelectedTransportistId(route.transportistId)
    setFormError('')
  }

  const handleCloseAssignDialog = () => {
    if (!submitting) {
      setAssignDialogRoute(null)
      setSelectedTransportistId('')
      setFormError('')
    }
  }

  const handleAssignTransportist = async () => {
    if (!assignDialogRoute || !selectedTransportistId) return

    setSubmitting(true)
    setFormError('')
    try {
      await routeService.assignTransportist(assignDialogRoute.id, selectedTransportistId)
      const updatedRoutes = await routeService.getAllRoutes()
      setRoutes(updatedRoutes)
      applyStatusFilter(updatedRoutes, selectedStatus)
      setAssignDialogRoute(null)
      setSelectedTransportistId('')
      showToast('Transportista reasignado correctamente', 'info')
    } catch {
      setFormError('No se pudo asignar el transportista.')
      showToast('No se pudo asignar el transportista.', 'error')
    } finally {
      setSubmitting(false)
    }
  }
  const getStatusColor = (status: Route['status']) => {
    switch (status) {
      case 'Creada':
        return 'info'
      case 'En Curso':
        return 'warning'
      case 'Finalizada':
        return 'success'
      case 'Cancelada':
        return 'error'
      default:
        return 'default'
    }
  }

  const getTransportistaName = (transportistId: string) => {
    const transportista = transportistaMap.get(transportistId)
    return transportista ? `${transportista.name} ${transportista.lastname}` : `Transportista ${transportistId}`
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Stack spacing={2}>
         <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6">Rutas - Total: {filteredRoutes.length} / {routes.length}</Typography>
          
           <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <FormControl sx={{ minWidth: 170 }}>
              <InputLabel>Filtrar por estado</InputLabel>
              <Select
                value={selectedStatus}
                label="Filtrar por estado"
                onChange={(e) => handleStatusChange(e.target.value as Route['status'] | 'Todas')}
              >
                <MenuItem value="Todas">Todas</MenuItem>
                <MenuItem value="Creada">Creada</MenuItem>
                <MenuItem value="En Curso">En Curso</MenuItem>
                <MenuItem value="Finalizada">Finalizada</MenuItem>
                <MenuItem value="Cancelada">Cancelada</MenuItem>
              </Select>
            </FormControl>

            {isSupervisor && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
                Asignar ruta
              </Button>
            )}
          </Stack>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {filteredRoutes.length === 0 ? (
          <Alert severity="info">
            {routes.length === 0 ? 'No hay rutas registradas' : 'No hay rutas con este estado'}
          </Alert>
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: 1 }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>ID Viaje</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Transportista</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Vehículo</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Origen</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Destino</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }} align="center">
                    Envíos
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Estado</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Fecha Creación</TableCell>
                   {isSupervisor && <TableCell sx={{ fontWeight: 'bold' }} align="right">Acciones</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRoutes.map((route) => (
                  <TableRow key={route.id} sx={{ '&:hover': { bgcolor: '#f9f9f9' } }}>
                    <TableCell sx={{ fontWeight: 500 }}>{route.routeId}</TableCell>
                    <TableCell>{getTransportistaName(route.transportistId)}</TableCell>
                    <TableCell>Vehículo {route.vehicleId}</TableCell>
                    <TableCell>{route.origin}</TableCell>
                    <TableCell>{route.destination}</TableCell>
                    <TableCell align="center">
                      <Chip
                        label={route.shipmentIds.length}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={route.status}
                        size="small"
                         color={getStatusColor(route.status) as never}
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem' }}>{route.createdDate}</TableCell>

  {isSupervisor && (
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<AssignmentIndIcon />}
                          disabled={route.status !== 'Creada'}
                          onClick={() => handleOpenAssignDialog(route)}
                        >
                          Reasignar
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
        <Dialog open={openCreateDialog} onClose={handleCloseCreateDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Asignar una ruta de recorridos</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Origen"
              value={form.origin}
              onChange={(e) => setForm((current) => ({ ...current, origin: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Destino"
              value={form.destination}
              onChange={(e) => setForm((current) => ({ ...current, destination: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Vehículo</InputLabel>
              <Select
                value={form.vehicleId}
                label="Vehículo"
                onChange={(e) => setForm((current) => ({ ...current, vehicleId: e.target.value }))}
              >
                {vehicles.map((vehicle) => (
                  <MenuItem key={vehicle.id} value={vehicle.id}>
                    {vehicle.patente} · {vehicle.marca} · {vehicle.estado}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Transportista</InputLabel>
              <Select
                value={form.transportistId}
                label="Transportista"
                onChange={(e) => setForm((current) => ({ ...current, transportistId: e.target.value }))}
              >
                {activeTransportistas.map((transportista) => (
                  <MenuItem key={transportista.id} value={transportista.id}>
                    {transportista.name} {transportista.lastname} · DNI {transportista.dni}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {activeTransportistas.length === 0 && (
              <Alert severity="warning">No hay transportistas activos disponibles para asignar.</Alert>
            )}
            <FormControl fullWidth>
              <InputLabel>Envíos disponibles</InputLabel>
              <Select
                multiple
                value={form.shipmentIds}
                input={<OutlinedInput label="Envíos disponibles" />}
                renderValue={(selected) => `${selected.length} envío(s) seleccionados`}
                onChange={(e) => setForm((current) => ({ ...current, shipmentIds: e.target.value as string[] }))}
              >
                {assignableShipments.map((shipment) => (
                  <MenuItem key={shipment.id} value={shipment.id}>
                    <Checkbox checked={form.shipmentIds.includes(shipment.id)} />
                    <ListItemText
                      primary={`${shipment.trackingId} · ${shipment.origin} → ${shipment.destination}`}
                      secondary={`Estado: ${shipment.status}`}
                    />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {assignableShipments.length === 0 && (
              <Alert severity="info">
                No hay envíos pendientes sin ruta para asignar en este momento.
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateDialog} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleCreateRoute} variant="contained" disabled={submitting}>
            Guardar asignación
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(assignDialogRoute)} onClose={handleCloseAssignDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Reasignar transportista</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Seleccioná el nuevo transportista responsable de la ruta {assignDialogRoute?.routeId}.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Transportista</InputLabel>
              <Select
                value={selectedTransportistId}
                label="Transportista"
                onChange={(e) => setSelectedTransportistId(e.target.value)}
                disabled={submitting}
              >
                {activeTransportistas.map((transportista) => (
                  <MenuItem key={transportista.id} value={transportista.id}>
                    {transportista.name} {transportista.lastname}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {activeTransportistas.length === 0 && (
              <Alert severity="warning">No hay transportistas activos disponibles para reasignar.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignDialog} disabled={submitting}>Cancelar</Button>
          <Button
            onClick={handleAssignTransportist}
            variant="contained"
            disabled={submitting || selectedTransportistId === assignDialogRoute?.transportistId}
          >
            {submitting ? <CircularProgress size={20} /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={closeToast}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default RoutesList
