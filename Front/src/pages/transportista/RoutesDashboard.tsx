import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  TextField,
  Typography,
  Alert,
  Divider,
  Stack,
  LinearProgress,
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import RouteIcon from '@mui/icons-material/Route'
import VisibilityIcon from '@mui/icons-material/Visibility'
import HistoryIcon from '@mui/icons-material/History'
import DirectionsIcon from '@mui/icons-material/Directions'
import type { Route, User } from '../../types'
import { routeService } from '../../services/routeService'
import { shipmentService } from '../../services/shipmentService'
import { authService } from '../../services/authService'
import { useTransportistaState } from '../../hooks/useTransportistaState'
import StatusBadge from '../../components/StatusBadge'
import LoadingState from '../../components/LoadingState'

interface RoutesDashboardProps {
  user: User
}

export default function RoutesDashboard({ user }: RoutesDashboardProps) {
  const navigate = useNavigate()
  const {
    state,
    setLoading,
    setRoutes,
    setShipments,
    updateRoute,
    showSnackbar,
    allShipmentsCompleted,
  } = useTransportistaState()

  const [cancelDialog, setCancelDialog] = useState<{ open: boolean; routeId: string | null }>({
    open: false,
    routeId: null,
  })
  const [cancelReason, setCancelReason] = useState('')
  const [cancelReasonError, setCancelReasonError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      try {
        // Intentar con el ID actual del usuario logueado
        const [initialRoutes, shipments] = await Promise.all([
          routeService.getRoutesByRepartidor(user.id),
          shipmentService.getAllShipments(),
        ])

        let routes = initialRoutes

        // Fallback para sesiones viejas: resolver repartidor por email y reintentar
        if (routes.length === 0 && user.email) {
          const repartidores = await authService.getRepartidores()
          const repartidorActual = repartidores.find(
            (t) => t.email.toLowerCase() === user.email.toLowerCase(),
          )

          if (repartidorActual && repartidorActual.id !== user.id) {
            routes = await routeService.getRoutesByRepartidor(repartidorActual.id)
          }
        }

        setRoutes(routes)
        setShipments(shipments)
      } catch {
        // mock — no error UI needed
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [user.id, setLoading, setRoutes, setShipments])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStartRoute = async (route: Route) => {
    setLoading(true)
    try {
      const updated = await routeService.startRoute(route.id)
      if (updated) {
        updateRoute(updated)
        showSnackbar(`Ruta ${route.routeId} iniciada correctamente`, 'success')
        navigate(`/transportista/ruta/${route.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleViewRoute = (routeId: string) => {
    navigate(`/transportista/ruta/${routeId}`)
  }

  const handleFinishRoute = async (route: Route) => {
    setLoading(true)
    try {
      const updated = await routeService.completeRoute(route.id)
      if (updated) {
        updateRoute(updated)
        showSnackbar(`Ruta ${route.routeId} finalizada correctamente`, 'success')
      }
    } finally {
      setLoading(false)
    }
  }

  const openCancelDialog = (routeId: string) => {
    setCancelReason('')
    setCancelReasonError('')
    setCancelDialog({ open: true, routeId })
  }

  const closeCancelDialog = () => {
    setCancelDialog({ open: false, routeId: null })
    setCancelReason('')
    setCancelReasonError('')
  }

  const handleConfirmCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelReasonError('El motivo de cancelación es obligatorio')
      return
    }
    if (!cancelDialog.routeId) return

    setLoading(true)
    closeCancelDialog()
    try {
      const updated = await routeService.cancelRoute(cancelDialog.routeId, cancelReason.trim())
      if (updated) {
        updateRoute(updated)
        showSnackbar(`Ruta cancelada: ${cancelReason}`, 'warning')
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeRoutes = state.routes.filter(
    (r) => r.status === 'Creada' || r.status === 'En Curso',
  )
  const historyRoutes = state.routes.filter(
    (r) => r.status === 'Finalizada' || r.status === 'Cancelada',
  )

  // Progress loading bar
  if (state.loading) return <LoadingState message="Cargando rutas..." />

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Hero header */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1565C0 0%, #1976d2 60%, #0277BD 100%)',
          borderRadius: 3,
          p: { xs: 2.5, sm: 3 },
          mb: 3,
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <LocalShippingIcon sx={{ fontSize: { xs: 28, sm: 34 } }} />
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Mis Rutas
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ opacity: 0.85, mb: 2 }}>
          Bienvenido, <strong>{user.name} {user.lastname}</strong>. Gestioná tus rutas de entrega.
        </Typography>

        {/* Summary chips */}
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            icon={<RouteIcon />}
            label={`${activeRoutes.length} activa${activeRoutes.length !== 1 ? 's' : ''}`}
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 600, '& .MuiChip-icon': { color: 'white' } }}
          />
          <Chip
            icon={<HistoryIcon />}
            label={`${historyRoutes.length} en historial`}
            sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', '& .MuiChip-icon': { color: 'rgba(255,255,255,0.7)' } }}
          />
        </Stack>
      </Box>

      {/* Empty state */}
      {activeRoutes.length === 0 && historyRoutes.length === 0 && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          No tenés rutas asignadas por el momento.
        </Alert>
      )}

      {/* Active routes */}
      {activeRoutes.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RouteIcon fontSize="small" color="primary" />
            Rutas activas
          </Typography>
          <Grid container spacing={{ xs: 2, sm: 2.5 }} sx={{ mb: 4 }} alignItems="stretch">
            {activeRoutes.map((route) => (
              <Grid item xs={12} sm={6} md={4} key={route.id} sx={{ display: 'flex' }}>
                <RouteCard
                  route={route}
                  canFinish={allShipmentsCompleted(route)}
                  shipmentCount={state.shipments.filter((s) => route.shipmentIds.includes(s.id)).length}
                  deliveredCount={state.shipments.filter((s) => route.shipmentIds.includes(s.id) && s.status === 'Entregado').length}
                  onStart={() => handleStartRoute(route)}
                  onView={() => handleViewRoute(route.id)}
                  onFinish={() => handleFinishRoute(route)}
                  onCancel={() => openCancelDialog(route.id)}
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* History */}
      {historyRoutes.length > 0 && (
        <>
          <Divider sx={{ mb: 2.5 }} />
          <Typography variant="h6" sx={{ mb: 2, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <HistoryIcon fontSize="small" />
            Historial
          </Typography>
          <Grid container spacing={{ xs: 2, sm: 2.5 }} alignItems="stretch">
            {historyRoutes.map((route) => (
              <Grid item xs={12} sm={6} md={4} key={route.id} sx={{ display: 'flex' }}>
                <RouteCard
                  route={route}
                  canFinish={false}
                  shipmentCount={route.shipmentIds.length}
                  deliveredCount={0}
                  onStart={() => {}}
                  onView={() => handleViewRoute(route.id)}
                  onFinish={() => {}}
                  onCancel={() => {}}
                  readOnly
                />
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialog.open}
        onClose={closeCancelDialog}
        maxWidth="xs"
        fullWidth
        keepMounted={false}
      >
        <DialogTitle sx={{ pb: 1 }}>Cancelar ruta</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Por favor indicá el motivo de la cancelación.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Motivo de cancelación"
            value={cancelReason}
            onChange={(e) => {
              setCancelReason(e.target.value)
              if (e.target.value.trim()) setCancelReasonError('')
            }}
            error={Boolean(cancelReasonError)}
            helperText={cancelReasonError || ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={closeCancelDialog} variant="outlined" fullWidth>
            Volver
          </Button>
          <Button onClick={handleConfirmCancel} variant="contained" color="error" fullWidth>
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ─── RouteCard sub-component ──────────────────────────────────────────────────

interface RouteCardProps {
  route: Route
  canFinish: boolean
  shipmentCount: number
  deliveredCount: number
  readOnly?: boolean
  onStart: () => void
  onView: () => void
  onFinish: () => void
  onCancel: () => void
}

function RouteCard({
  route,
  canFinish,
  shipmentCount,
  deliveredCount,
  readOnly = false,
  onStart,
  onView,
  onFinish,
  onCancel,
}: RouteCardProps) {
  const progress = shipmentCount > 0 ? Math.round((deliveredCount / shipmentCount) * 100) : 0
  const isActive = route.status === 'Creada' || route.status === 'En Curso'

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.25s, transform 0.15s',
        '&:hover': { boxShadow: 4, transform: 'translateY(-1px)' },
        opacity: readOnly ? 0.85 : 1,
      }}
    >
      <CardContent sx={{ flex: 1, pb: 1 }}>
        {/* Route ID + status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            {route.routeId}
          </Typography>
          <StatusBadge status={route.status} />
        </Box>

        {/* Origin → Destination */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <DirectionsIcon fontSize="small" color="action" />
          <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1 }}>
            {route.origin} → {route.destination}
          </Typography>
        </Box>

        {/* Shipments chip + date */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          <Chip
            size="small"
            label={`${shipmentCount} envío${shipmentCount !== 1 ? 's' : ''}`}
            color="info"
            variant="outlined"
          />
          {route.startDate && (
            <Typography variant="caption" color="text.secondary">
              Inicio: {route.startDate}
            </Typography>
          )}
        </Box>

        {/* Progress bar for active "En Curso" routes */}
        {route.status === 'En Curso' && shipmentCount > 0 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Progreso
              </Typography>
              <Typography variant="caption" fontWeight={600} color={progress === 100 ? 'success.main' : 'text.secondary'}>
                {deliveredCount}/{shipmentCount}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              color={progress === 100 ? 'success' : 'primary'}
              sx={{ borderRadius: 4, height: 6 }}
            />
          </Box>
        )}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0.5, flexDirection: 'column', gap: 0.75 }}>
        {!readOnly && (
          <>
            {route.status === 'Creada' && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<PlayArrowIcon />}
                onClick={onStart}
                fullWidth
                size="large"
              >
                Iniciar ruta
              </Button>
            )}

            {route.status === 'En Curso' && (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<VisibilityIcon />}
                onClick={onView}
                fullWidth
              >
                Ver envíos
              </Button>
            )}

            {route.status === 'En Curso' && (
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={onFinish}
                disabled={!canFinish}
                fullWidth
                title={!canFinish ? 'Todos los envíos deben estar completados' : ''}
              >
                Finalizar ruta
              </Button>
            )}

            {isActive && (
              <Button
                variant="text"
                color="error"
                startIcon={<CancelIcon />}
                onClick={onCancel}
                fullWidth
                size="small"
              >
                Cancelar ruta
              </Button>
            )}
          </>
        )}

        {readOnly && (
          <Button
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={onView}
            fullWidth
          >
            Ver detalle
          </Button>
        )}
      </CardActions>
    </Card>
  )
}
