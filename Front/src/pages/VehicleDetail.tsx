import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Snackbar,
  Alert,
  Stack,
  Typography,
  CircularProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import DeleteIcon from '@mui/icons-material/Delete'
import BlockIcon from '@mui/icons-material/Block'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import AddRoadIcon from '@mui/icons-material/AddRoad'
import type { Vehicle, Route } from '../types'
import { vehicleService } from '../services/vehicleService'
import { routeService } from '../services/routeService'

// ─── Status config ────────────────────────────────────────────────────────────

type VehicleEstado = Vehicle['estado']

const estadoConfig: Record<
  VehicleEstado,
  { label: string; color: string; bg: string }
> = {
  Disponible: { label: 'Disponible', color: '#1B5E20', bg: '#E8F5E9' },
  'En uso': { label: 'En uso', color: '#0D47A1', bg: '#E3F2FD' },
  Mantenimiento: { label: 'Mantenimiento', color: '#E65100', bg: '#FFF3E0' },
  Suspendido: { label: 'Suspendido', color: '#B71C1C', bg: '#FFEBEE' },
}

function VehicleStatusChip({ estado }: { estado: VehicleEstado }) {
  const { label, color, bg } = estadoConfig[estado] ?? {
    label: estado,
    color: '#555',
    bg: '#eee',
  }
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: bg, color, fontWeight: 700, fontSize: '0.75rem' }}
    />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [routes, setRoutes] = useState<Route[]>([]) // all routes for this vehicle
  const [availableRoutes, setAvailableRoutes] = useState<Route[]>([]) // routes with no vehicle assigned
  const [loading, setLoading] = useState(true)

  // Status change
  const [newEstado, setNewEstado] = useState<VehicleEstado | ''>('')
  const [statusDialogOpen, setStatusDialogOpen] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)

  // Delete
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Assign route
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedRouteId, setSelectedRouteId] = useState('')
  const [assignLoading, setAssignLoading] = useState(false)

  // Unassign route
  const [unassignRouteId, setUnassignRouteId] = useState('')
  const [unassignDialogOpen, setUnassignDialogOpen] = useState(false)
  const [unassignLoading, setUnassignLoading] = useState(false)

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'warning' | 'info'
  }>({ open: false, message: '', severity: 'success' })

  const showSnackbar = (
    message: string,
    severity: 'success' | 'error' | 'warning' | 'info' = 'success',
  ) => setSnackbar({ open: true, message, severity })

  const closeSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false, message: '' }))
  }

  useEffect(() => {
    if (id) loadData(id)
  }, [id])

  const loadData = async (vehicleId: string) => {
    setLoading(true)
    try {
      const [v, allRoutes] = await Promise.all([
        vehicleService.getVehiculoById(vehicleId),
        routeService.getAllRoutes(),
      ])
      if (!v) {
        navigate('/dashboard')
        return
      }
      setVehicle(v)
      setNewEstado(v.estado)

      // routes assigned to this vehicle
      const vehicleRoutes = allRoutes.filter((r) => r.vehicleId === vehicleId)
      setRoutes(vehicleRoutes)

      // routes that have no vehicle assigned or are assigned to this vehicle (unassigned = vehicleId empty/missing)
      const unassigned = allRoutes.filter(
        (r) =>
          (!r.vehicleId || r.vehicleId === '') &&
          (r.status === 'Creada' || r.status === 'En Curso'),
      )
      setAvailableRoutes(unassigned)
    } catch {
      showSnackbar('Error al cargar los datos del vehículo', 'error')
    } finally {
      setLoading(false)
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleStatusChange = async () => {
    if (!vehicle || !newEstado || newEstado === vehicle.estado) return
    setStatusLoading(true)
    try {
      const result = await vehicleService.changeVehicleStatus(vehicle.id, newEstado)
      if (result.success) {
        showSnackbar(`Estado cambiado a "${newEstado}" correctamente`, 'info')
        // Recargar datos
        if (id) await loadData(id)
      } else {
        showSnackbar(result.error || 'Error al cambiar el estado', 'error')
      }
    } catch {
      showSnackbar('Error al actualizar el estado', 'error')
    } finally {
      setStatusLoading(false)
      setStatusDialogOpen(false)
    }
  }

  const handleDelete = async () => {
    if (!vehicle) return
    setDeleteLoading(true)
    try {
      const result = await vehicleService.changeVehicleStatus(vehicle.id, 'Suspendido')
      if (result.success) {
        showSnackbar('Vehículo suspendido correctamente', 'warning')
        navigate(-1)
      } else {
        showSnackbar(result.error || 'Error al suspender el vehículo', 'error')
      }
    } catch {
      showSnackbar('Error al suspender el vehículo', 'error')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleAssignRoute = async () => {
    if (!vehicle || !selectedRouteId) return
    setAssignLoading(true)
    try {
      // TODO: Implementar asignación de ruta en backend
      showSnackbar('Funcionalidad no implementada en el backend', 'warning')
    } catch {
      showSnackbar('Error al asignar la ruta', 'error')
    } finally {
      setAssignLoading(false)
      setAssignDialogOpen(false)
    }
  }

  const handleUnassignRoute = async () => {
    if (!vehicle || !unassignRouteId) return
    setUnassignLoading(true)
    try {
      // TODO: Implementar desasignación de ruta en backend
      showSnackbar('Funcionalidad no implementada en el backend', 'warning')
    } catch {
      showSnackbar('Error al desasignar la ruta', 'error')
    } finally {
      setUnassignLoading(false)
      setUnassignDialogOpen(false)
      setUnassignRouteId('')
    }
  }

  const hasAssignedRoutes = (vehicle?.assignedRouteIds?.length ?? 0) > 0

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    )
  }

  if (!vehicle) return null

  const estadoOptions: VehicleEstado[] = ['Disponible', 'En uso', 'Mantenimiento', 'Suspendido']

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <DirectionsCarIcon color="primary" />
        <Typography variant="h5" fontWeight={700}>
          Vehículo {vehicle.patente}
        </Typography>
        <VehicleStatusChip estado={vehicle.estado} />
      </Box>

      <Grid container spacing={3}>
        {/* ─── Info Card ─────────────────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Información del vehículo
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Patente
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {vehicle.patente}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Marca
                  </Typography>
                  <Typography variant="body2">{vehicle.marca}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Capacidad de carga
                  </Typography>
                  <Typography variant="body2">{vehicle.capacidadCarga} kg</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Fecha de registro
                  </Typography>
                  <Typography variant="body2">{vehicle.createdDate}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Estado actual
                  </Typography>
                  <VehicleStatusChip estado={vehicle.estado} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={600}>
                    Rutas asignadas
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {vehicle.assignedRouteIds?.length ?? 0}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ─── Estado Card ───────────────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Modificar estado
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Nuevo estado</InputLabel>
                  <Select
                    value={newEstado}
                    label="Nuevo estado"
                    onChange={(e) => setNewEstado(e.target.value as VehicleEstado)}
                    disabled={vehicle.estado === 'Suspendido'}
                  >
                    {estadoOptions.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: estadoConfig[opt].color,
                            }}
                          />
                          {opt}
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {vehicle.estado === 'Suspendido' && (
                  <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                    Este vehículo está suspendido. Para reactivarlo debe cambiar su estado
                    desde las opciones de administración.
                  </Alert>
                )}

                {newEstado === 'Suspendido' && vehicle.estado !== 'Suspendido' && (
                  <Alert severity="warning" sx={{ fontSize: '0.8rem' }}>
                    Al suspender el vehículo, no podrá ser asignado a nuevas rutas.
                  </Alert>
                )}

                <Button
                  variant="contained"
                  onClick={() => setStatusDialogOpen(true)}
                  disabled={
                    !newEstado ||
                    newEstado === vehicle.estado ||
                    vehicle.estado === 'Suspendido'
                  }
                  fullWidth
                >
                  Guardar cambio de estado
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* ─── Rutas asignadas ───────────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  Rutas asignadas
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddRoadIcon />}
                  onClick={() => setAssignDialogOpen(true)}
                  disabled={
                    vehicle.estado === 'Suspendido' ||
                    availableRoutes.length === 0
                  }
                >
                  Asignar ruta
                </Button>
              </Box>
              <Divider sx={{ mb: 1 }} />

              {routes.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No hay rutas asignadas a este vehículo
                </Typography>
              ) : (
                <List disablePadding>
                  {routes.map((route) => (
                    <ListItem
                      key={route.id}
                      sx={{
                        px: 0,
                        py: 0.75,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight={700}>
                            {route.routeId}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            {route.origin} → {route.destination} ·{' '}
                            <Chip
                              label={route.status}
                              size="small"
                              sx={{ height: 16, fontSize: '0.65rem', fontWeight: 700 }}
                            />
                          </Typography>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Desasignar ruta">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setUnassignRouteId(route.id)
                              setUnassignDialogOpen(true)
                            }}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ─── Danger Zone ───────────────────────────────────────────────── */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2.5,
              border: '1.5px solid',
              borderColor: 'error.light',
              borderRadius: 2,
            }}
          >
            <Typography variant="h6" fontWeight={700} color="error.main" gutterBottom>
              Zona de peligro
            </Typography>
            <Divider sx={{ mb: 2, borderColor: 'error.light' }} />

            <Stack spacing={2}>
              {/* Suspend */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Suspender vehículo
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  El vehículo quedará suspendido y no podrá ser asignado a nuevas rutas.
                  {hasAssignedRoutes
                    ? ' Esta opción está disponible ya que el vehículo tiene rutas asignadas.'
                    : ''}
                </Typography>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<BlockIcon />}
                  onClick={() => {
                    setNewEstado('Suspendido')
                    setStatusDialogOpen(true)
                  }}
                  disabled={vehicle.estado === 'Suspendido'}
                  size="small"
                >
                  Suspender vehículo
                </Button>
              </Box>

              <Divider />

              {/* Delete */}
              <Box>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  Eliminar vehículo
                </Typography>
                {hasAssignedRoutes ? (
                  <Alert severity="warning" sx={{ fontSize: '0.8rem', mb: 1.5 }}>
                    No se puede eliminar el vehículo porque tiene{' '}
                    <strong>{vehicle.assignedRouteIds?.length}</strong> ruta(s) asignada(s).
                    Para eliminar el vehículo primero debe desasignar todas las rutas, o
                    bien suspenderlo.
                  </Alert>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Esta acción es irreversible. El vehículo será eliminado definitivamente
                    del sistema.
                  </Typography>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={hasAssignedRoutes}
                  size="small"
                >
                  Eliminar vehículo
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* ─── Confirm status change dialog ────────────────────────────────── */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar cambio de estado</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Desea cambiar el estado del vehículo <strong>{vehicle.patente}</strong> de{' '}
            <strong>{vehicle.estado}</strong> a <strong>{newEstado}</strong>?
            {newEstado === 'Suspendido' && (
              <Box component="span" sx={{ display: 'block', mt: 1, color: 'warning.main' }}>
                El vehículo suspendido no podrá ser asignado a nuevas rutas.
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)} disabled={statusLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleStatusChange}
            variant="contained"
            color={newEstado === 'Suspendido' ? 'warning' : 'primary'}
            disabled={statusLoading}
          >
            {statusLoading ? <CircularProgress size={20} /> : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Confirm delete dialog ───────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>Eliminar vehículo</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Está seguro de que desea eliminar el vehículo{' '}
            <strong>
              {vehicle.patente} – {vehicle.marca}
            </strong>
            ? Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            variant="contained"
            color="error"
            disabled={deleteLoading}
          >
            {deleteLoading ? <CircularProgress size={20} /> : 'Eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Assign route dialog ─────────────────────────────────────────── */}
      <Dialog open={assignDialogOpen} onClose={() => setAssignDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Asignar ruta al vehículo</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel>Seleccionar ruta</InputLabel>
            <Select
              value={selectedRouteId}
              label="Seleccionar ruta"
              onChange={(e) => setSelectedRouteId(e.target.value)}
            >
              {availableRoutes.map((route) => (
                <MenuItem key={route.id} value={route.id}>
                  {route.routeId} – {route.origin} → {route.destination}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)} disabled={assignLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleAssignRoute}
            variant="contained"
            disabled={!selectedRouteId || assignLoading}
          >
            {assignLoading ? <CircularProgress size={20} /> : 'Asignar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Confirm unassign route dialog ───────────────────────────────── */}
      <Dialog open={unassignDialogOpen} onClose={() => setUnassignDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Desasignar ruta</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Desea desasignar la ruta{' '}
            <strong>{routes.find((r) => r.id === unassignRouteId)?.routeId}</strong> de
            este vehículo?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUnassignDialogOpen(false)} disabled={unassignLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleUnassignRoute}
            variant="contained"
            color="warning"
            disabled={unassignLoading}
          >
            {unassignLoading ? <CircularProgress size={20} /> : 'Desasignar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Snackbar ────────────────────────────────────────────────────── */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
