import { useState, useEffect, useMemo } from 'react'
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
  DialogTitle,
  Grid,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Snackbar,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import BadgeIcon from '@mui/icons-material/Badge'
import BlockIcon from '@mui/icons-material/Block'
import EditIcon from '@mui/icons-material/Edit'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'

import type { User, Route, RepartidorEstado } from '../types'
import { authService } from '../services/authService'
import { routeService } from '../services/routeService'

interface RepartidoresListProps {
  userRole?: string
}

const estadoColorMap: Record<RepartidorEstado, 'success' | 'warning' | 'error'> = {
  Activo: 'success',
  Suspendido: 'warning',
  Inhabilitado: 'error',
}

function RepartidoresList({ userRole }: RepartidoresListProps) {
  const nameRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
  const isSupervisor = userRole === 'supervisor'
  const [repartidores, setRepartidores] = useState<User[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'info' | 'warning' | 'error'
  }>({ open: false, message: '', severity: 'success' })

  const [openCreateDialog, setOpenCreateDialog] = useState(false)
  const [openLicenciaDialog, setOpenLicenciaDialog] = useState(false)
  const [openEstadoDialog, setOpenEstadoDialog] = useState(false)
  const [selectedRepartidor, setSelectedRepartidor] = useState<User | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    lastname: '',
    email: '',
    dni: '',
    licencia: '',
  })
  const [formError, setFormError] = useState('')
  const [licenciaValue, setLicenciaValue] = useState('')
  const [estadoValue, setEstadoValue] = useState<RepartidorEstado>('Suspendido')

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

  useEffect(() => {
    loadRepartidores()
  }, [])

  const routesByRepartidor = useMemo(() => {
    return routes.reduce<Record<string, Route[]>>((acc, route) => {
      acc[route.repartidorId] = [...(acc[route.repartidorId] ?? []), route]
      return acc
    }, {})
  }, [routes])

  const loadRepartidores= async () => {
    setLoading(true)
    setError('')
    try {
        const [repartidoresData, routesData] = await Promise.all([
        authService.getRepartidores(),
        routeService.getAllRoutes(),
      ])
      setRepartidores(repartidoresData)
      setRoutes(routesData)
    } catch (err) {
      setError('Error al cargar los Repartidores')
    } finally {
      setLoading(false)
    }
  }

  const getRouteStatus = (RepartidorId: string) => {
    const assignedRoutes = routesByRepartidor[RepartidorId] ?? []
    if (assignedRoutes.some((route) => route.status === 'En Curso')) {
      return { label: 'En viaje', color: 'warning' as const }
    }
    if (assignedRoutes.some((route) => route.status === 'Creada')) {
      return { label: 'Con ruta asignada', color: 'info' as const }
    }
    if (assignedRoutes.length > 0) {
      return { label: 'Disponible', color: 'success' as const }
    }
    return { label: 'Sin asignación', color: 'default' as const }
  }

  const handleOpenCreateDialog = () => {
    setFormData({ name: '', lastname: '', email: '', dni: '', licencia: '' })
    setFormError('')
    setOpenCreateDialog(true)
  }

  const handleCreateRepartidor = async () => {
    if (!formData.name.trim() || !formData.lastname.trim() || !formData.licencia.trim() || !formData.email.trim()) {
      setFormError('Completá nombre, apellido, email y licencia.')
      return
    }
    if (!authService.isValidEmail(formData.email.trim())) {
      setFormError('Ingresá un email válido.')
      return
    }
    if (!nameRegex.test(formData.name.trim()) || !nameRegex.test(formData.lastname.trim())) {
      setFormError('Nombre y apellido solo pueden contener letras.')
      return
    }
    if (!/^\d{8}$/.test(formData.dni)) {
      setFormError('El DNI debe tener exactamente 8 dígitos.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const created = await authService.createRepartidor({
        name: formData.name,
        lastname: formData.lastname,
        email: formData.email,
        dni: formData.dni,
        licencia: formData.licencia,
      })

      if (!created) {
        setFormError('No se pudo registrar el Repartidor.')
        showToast('No se pudo registrar el Repartidor.', 'error')
        return
      }

      await loadRepartidores()
      showToast(
        `Repartidor registrado. Credenciales de acceso: ${created.user.email}. Contraseña temporal: ${created.temporaryPassword}`,
        'success',
      )
      setOpenCreateDialog(false)
    } catch {
      setFormError('Ocurrió un error al registrar el Repartidor.')
      showToast('Ocurrió un error al registrar el Repartidor.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const openEditLicenciaDialog = (Repartidor: User) => {
    setSelectedRepartidor(Repartidor)
    setLicenciaValue(Repartidor.licencia ?? '')
    setFormError('')
    setOpenLicenciaDialog(true)
  }

  const handleUpdateLicencia = async () => {
    if (!selectedRepartidor) return
    if (!licenciaValue.trim()) {
      setFormError('La licencia es obligatoria.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      const updated = await authService.updateRepartidorLicencia(selectedRepartidor.id, licenciaValue.trim())
      if (!updated) {
        setFormError('No se pudo actualizar la licencia.')
        showToast('No se pudo actualizar la licencia.', 'error')
        return
      }
      await loadRepartidores()
      setOpenLicenciaDialog(false)
      setSelectedRepartidor(null)
      showToast('Licencia actualizada correctamente', 'info')
    } catch {
      setFormError('Ocurrió un error al actualizar la licencia.')
      showToast('Ocurrió un error al actualizar la licencia.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const openChangeEstadoDialog = (Repartidor: User) => {
    setSelectedRepartidor(Repartidor)
    setEstadoValue('Suspendido')
    setFormError('')
    setOpenEstadoDialog(true)
  }

  const handleUpdateEstado = async () => {
    if (!selectedRepartidor) return

    setSubmitting(true)
    setFormError('')
    try {
      const updated = await authService.updateRepartidorEstado(selectedRepartidor.id, estadoValue)
      if (!updated) {
        setFormError('No se pudo cambiar el estado del Repartidor.')
        showToast('No se pudo cambiar el estado del Repartidor.', 'error')
        return
      }
      await loadRepartidores()
      setOpenEstadoDialog(false)
      setSelectedRepartidor(null)
      showToast(
        `Estado de repartidor actualizado a ${estadoValue}`,
        estadoValue === 'Activo' ? 'success' : 'warning',
      )
    } catch {
      setFormError('Ocurrió un error al cambiar el estado del Repartidor.')
      showToast('Ocurrió un error al cambiar el estado del Repartidor.', 'error')
    } finally {
      setSubmitting(false)
    }
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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            repartidores - Total: {repartidores.length}
          </Typography>
          {isSupervisor && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreateDialog}>
              Registrar Repartidor
            </Button>
          )}
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {repartidores.length === 0 ? (
          <Alert severity="info">No hay repartidores registrados</Alert>
        ) : (
          <Grid container spacing={3}>
            {repartidores.map((Repartidor) => {
              const routeStatus = getRouteStatus(Repartidor.id)
              const assignedRoutes = routesByRepartidor[Repartidor.id] ?? []
              const estadoCuenta = (Repartidor.estado ?? 'Activo') as RepartidorEstado

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={Repartidor.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {Repartidor.name} {Repartidor.lastname}
                      </Typography>
                      <Stack spacing={1}>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Email
                          </Typography>
                          <Typography variant="body2">{Repartidor.email}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            DNI
                          </Typography>
                          <Typography variant="body2">{Repartidor.dni}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Licencia
                          </Typography>
                          <Typography variant="body2">{Repartidor.licencia || 'No informada'}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Rutas asignadas
                          </Typography>
                          <Typography variant="body2">{assignedRoutes.length}</Typography>
                        </Box>
                        <Box sx={{ pt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`Cuenta: ${estadoCuenta}`}
                            color={estadoColorMap[estadoCuenta]}
                            size="small"
                            variant="filled"
                            icon={<VerifiedUserIcon />}
                          />
                          <Chip
                            label={routeStatus.label}
                            color={routeStatus.color}
                            size="small"
                            variant="filled"
                          />
                        </Box>
                        {isSupervisor && (
                          <Box sx={{ pt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<BadgeIcon />}
                              onClick={() => openEditLicenciaDialog(Repartidor)}
                            >
                              Editar licencia
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<BlockIcon />}
                              onClick={() => openChangeEstadoDialog(Repartidor)}
                            >
                              Suspender/Inhabilitar
                            </Button>
                          </Box>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Box>

      <Dialog open={openCreateDialog} onClose={() => !submitting && setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Registrar Repartidor</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField
              label="Nombre"
              value={formData.name}
              onChange={(e) =>
                setFormData((current) => ({
                  ...current,
                  name: e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, ''),
                }))
              }
              fullWidth
            />
            <TextField
              label="Apellido"
              value={formData.lastname}
              onChange={(e) =>
                setFormData((current) => ({
                  ...current,
                  lastname: e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, ''),
                }))
              }
              fullWidth
            />
            <TextField
              label="Email"
              value={formData.email}
              onChange={(e) => setFormData((current) => ({ ...current, email: e.target.value }))}
              fullWidth
            />
            <TextField
              label="DNI"
              value={formData.dni}
              inputProps={{ maxLength: 8 }}
              onChange={(e) => setFormData((current) => ({ ...current, dni: e.target.value.replace(/\D/g, '') }))}
              fullWidth
            />
            <TextField
              label="Licencia"
              value={formData.licencia}
              onChange={(e) => setFormData((current) => ({ ...current, licencia: e.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleCreateRepartidor} variant="contained" disabled={submitting}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openLicenciaDialog} onClose={() => !submitting && setOpenLicenciaDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Modificar licencia</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Repartidor: {selectedRepartidor?.name} {selectedRepartidor?.lastname}
            </Typography>
            <TextField
              label="Licencia"
              value={licenciaValue}
              onChange={(e) => setLicenciaValue(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenLicenciaDialog(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleUpdateLicencia} variant="contained" startIcon={<EditIcon />} disabled={submitting}>
            Actualizar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEstadoDialog} onClose={() => !submitting && setOpenEstadoDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cambiar estado del Repartidor</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Typography variant="body2" color="text.secondary">
              Seleccioná el nuevo estado para {selectedRepartidor?.name} {selectedRepartidor?.lastname}.
            </Typography>
            <Select
              value={estadoValue}
              onChange={(e) => setEstadoValue(e.target.value as RepartidorEstado)}
              fullWidth
            >
              <MenuItem value="Suspendido">Suspendido</MenuItem>
              <MenuItem value="Inhabilitado">Inhabilitado</MenuItem>
              <MenuItem value="Activo">Activo</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEstadoDialog(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleUpdateEstado} variant="contained" color="warning" disabled={submitting}>
            Cambiar estado
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
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

export default RepartidoresList
