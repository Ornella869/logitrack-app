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
  repartidorId: string
  shipmentIds: string[]
}

const initialForm: RouteFormState = {
  origin: '',
  destination: '',
  vehicleId: '',
  repartidorId: '',
  shipmentIds: [],
}

function RoutesList({ userRole }: RoutesListProps) {
  const isSupervisor = userRole === 'supervisor'
  const [routes, setRoutes] = useState<Route[]>([])
  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([])
   const [repartidores, setRepartidores] = useState<User[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [assignableShipments, setAssignableShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<Route['status'] | 'Todas'>('Todas')
  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [assignDialogRoute, setAssignDialogRoute] = useState<Route | null>(null)
  const [selectedRepartidorId, setSelectedRepartidorId] = useState<string>('')
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

  const activeRepartidores = useMemo(
    () => repartidores.filter((r) => (r.estado ?? 'Activo') === 'Activo'),
    [repartidores],
  )

  useEffect(() => {
    loadRoutes()
  }, [])

    const repartidorMap = useMemo(
    () => new Map(repartidores.map((r) => [r.id, r])),
    [repartidores],
  )


  const loadRoutes = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await routeService.getAllRoutes()
      setRoutes(data)
      setFilteredRoutes(selectedStatus === 'Todas' ? data : data.filter((route) => route.status === selectedStatus))

      if (isSupervisor) {
        const [repartidoresData, vehiclesData, shipmentsData] = await Promise.all([
          authService.getRepartidores(),
          vehicleService.getAssignableVehicles(),
          shipmentService.getAssignableShipments(),
        ])
        setRepartidores(repartidoresData)
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
    if (!form.origin.trim() || !form.destination.trim() || !form.vehicleId || !form.repartidorId || form.shipmentIds.length === 0) {
      setFormError('Completá origen, destino, vehículo, repartidor y al menos un envío.')
      return
    }

    setSubmitting(true)
    setFormError('')

    try {
      await routeService.createRoute({
        origin: form.origin.trim(),
        destination: form.destination.trim(),
        vehicleId: form.vehicleId,
        repartidorId: form.repartidorId,
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
    setSelectedRepartidorId(route.repartidorId)
    setFormError('')
  }

  const handleCloseAssignDialog = () => {
    if (!submitting) {
      setAssignDialogRoute(null)
      setSelectedRepartidorId('')
      setFormError('')
    }
  }

  const handleAssignTransportist = async () => {
    if (!assignDialogRoute || !selectedRepartidorId) return

    setSubmitting(true)
    setFormError('')
    try {
      await routeService.assignTransportist(assignDialogRoute.id, selectedRepartidorId)
      const updatedRoutes = await routeService.getAllRoutes()
      setRoutes(updatedRoutes)
      applyStatusFilter(updatedRoutes, selectedStatus)
      setAssignDialogRoute(null)
      setSelectedRepartidorId('')
      showToast('Repartidor reasignado correctamente', 'info')
    } catch {
      setFormError('No se pudo asignar el repartidor.')
      showToast('No se pudo asignar el repartidor.', 'error')
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

  const getRepartidorName = (repartidorId: string) => {
    const repartidor = repartidorMap.get(repartidorId)
    return repartidor ? `${repartidor.name} ${repartidor.lastname}` : `Repartidor ${repartidorId}`
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
                  <TableCell sx={{ fontWeight: 'bold' }}>Repartidor</TableCell>
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
                    <TableCell>{getRepartidorName(route.repartidorId)}</TableCell>
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
              <InputLabel>Repartidor</InputLabel>
              <Select
                value={form.repartidorId}
                label="Repartidor"
                onChange={(e) => setForm((current) => ({ ...current, repartidorId: e.target.value }))}
              >
                {activeRepartidores.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name} {r.lastname} · DNI {r.dni}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {activeRepartidores.length === 0 && (
              <Alert severity="warning">No hay repartidores activos disponibles para asignar.</Alert>
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
        <DialogTitle>Reasignar repartidor</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Seleccioná el nuevo repartidor responsable de la ruta {assignDialogRoute?.routeId}.
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Repartidor</InputLabel>
              <Select
                value={selectedRepartidorId}
                label="Repartidor"
                onChange={(e) => setSelectedRepartidorId(e.target.value)}
                disabled={submitting}
              >
                {activeRepartidores.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {r.name} {r.lastname}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {activeRepartidores.length === 0 && (
              <Alert severity="warning">No hay repartidores activos disponibles para reasignar.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAssignDialog} disabled={submitting}>Cancelar</Button>
          <Button
            onClick={handleAssignTransportist}
            variant="contained"
            disabled={submitting || selectedRepartidorId === assignDialogRoute?.repartidorId}
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
