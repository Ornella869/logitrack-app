import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
  LinearProgress,
  Stack,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import BlockIcon from '@mui/icons-material/Block'
import SearchIcon from '@mui/icons-material/Search'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import PersonIcon from '@mui/icons-material/Person'
import ScaleIcon from '@mui/icons-material/Scale'
import type { Route, Shipment } from '../../types'
import { routeService } from '../../services/routeService'
import { shipmentService } from '../../services/shipmentService'
import { useRepartidorState } from '../../hooks/useRepartidorState'
import StatusBadge from '../../components/StatusBadge'
import LoadingState from '../../components/LoadingState'

export default function RouteDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const { state, setLoading, setRoutes, setShipments, showSnackbar } =
    useRepartidorState()

  const [route, setRoute] = useState<Route | null>(null)
  const [routeShipments, setRouteShipments] = useState<Shipment[]>([])

  // Scan input
  const [scanInput, setScanInput] = useState('')
  const [scanError, setScanError] = useState('')
  const [scanHighlight, setScanHighlight] = useState<{ id: string; type: 'delivered' | 'rejected' } | null>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; shipmentId: string | null }>({
    open: false,
    shipmentId: null,
  })
  const [rejectReason, setRejectReason] = useState('')
  const [rejectReasonError, setRejectReasonError] = useState('')

  // ── Load data ─────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [foundRoute, allShipments] = await Promise.all([
        routeService.getRouteById(id),
        shipmentService.getAllShipments(),
      ])
      if (foundRoute) {
        setRoute(foundRoute)
        const linked = allShipments.filter((s) => foundRoute.shipmentIds.includes(s.id))
        setRouteShipments(linked)
        setShipments(allShipments)
        setRoutes([foundRoute])
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id, setLoading, setShipments, setRoutes])

  // Sync local list with global state updates
  useEffect(() => {
    if (!route) return
    const updated = state.shipments.filter((s) => route.shipmentIds.includes(s.id))
    if (updated.length > 0) setRouteShipments(updated)
  }, [state.shipments, route])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleDelivered = async (shipment: Shipment) => {
    try {
      const result = await shipmentService.changeShipmentStatus(shipment.id, 'Entregado')
      if (result.success) {
        await loadData()
        showSnackbar(`✓ ${shipment.trackingId} marcado como Entregado`, 'success')
        highlightRow(shipment.id, 'delivered')
      } else {
        showSnackbar(result.error || 'No se pudo marcar el envío como entregado', 'error')
      }
    } catch {
      showSnackbar('Error al actualizar el envío', 'error')
    }
  }

  const openRejectDialog = (shipmentId: string) => {
    setRejectReason('')
    setRejectReasonError('')
    setRejectDialog({ open: true, shipmentId })
  }

  const closeRejectDialog = () => {
    setRejectDialog({ open: false, shipmentId: null })
    setRejectReason('')
    setRejectReasonError('')
  }

  const handleConfirmReject = async () => {
    if (!rejectReason.trim()) {
      setRejectReasonError('El motivo de rechazo es obligatorio')
      return
    }
    if (!rejectDialog.shipmentId) return

    closeRejectDialog()
    try {
      const result = await shipmentService.cancelShipment(rejectDialog.shipmentId!, rejectReason)
      if (result.success) {
        await loadData()
        showSnackbar(`Envío rechazado: ${rejectReason}`, 'warning')
        highlightRow(rejectDialog.shipmentId!, 'rejected')
      } else {
        showSnackbar(result.error || 'No se pudo rechazar el envío', 'error')
      }
    } catch {
      showSnackbar('Error al actualizar el envío', 'error')
    }
  }

  // Scan simulation
  const handleScan = async () => {
    const trackingId = scanInput.trim().toUpperCase()
    setScanError('')
    if (!trackingId) {
      setScanError('Ingresá un tracking ID para escanear')
      return
    }

    const found = routeShipments.find((s) => s.trackingId.toUpperCase() === trackingId)

    if (!found) {
      setScanError(`Paquete "${trackingId}" no encontrado en esta ruta`)
      return
    }

    if (found.status === 'Entregado' || found.status === 'Cancelado') {
      setScanError(`Este paquete ya fue ${found.status.toLowerCase()}`)
      return
    }

    const result = await shipmentService.changeShipmentStatus(found.id, 'Entregado')
    if (result.success) {
      await loadData()
      showSnackbar(`📦 ${trackingId} escaneado y marcado como Entregado`, 'success')
      setScanInput('')
      highlightRow(found.id, 'delivered')
      scanRef.current?.focus()
    } else {
      setScanError(result.error || 'No se pudo actualizar el estado del paquete')
    }
  }

  const highlightRow = (shipmentId: string, type: 'delivered' | 'rejected') => {
    setScanHighlight({ id: shipmentId, type })
    setTimeout(() => setScanHighlight(null), 2500)
  }

  const handleScanKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleScan()
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const delivered = routeShipments.filter((s) => s.status === 'Entregado').length
  const rejected = routeShipments.filter((s) => s.status === 'Cancelado').length
  const pending = routeShipments.filter(
    (s) => s.status !== 'Entregado' && s.status !== 'Cancelado',
  ).length
  const total = routeShipments.length
  const progress = total > 0 ? Math.round(((delivered + rejected) / total) * 100) : 0
  const displayRouteStatus: Route['status'] =
    route?.status === 'Finalizada' && pending > 0 ? 'En Curso' : route?.status ?? 'Creada'
  const canManageShipments = displayRouteStatus === 'En Curso'

  if (state.loading) return <LoadingState message="Cargando ruta..." />

  if (!route) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/repartidor')} sx={{ mb: 2 }}>
          Volver a mis rutas
        </Button>
        <Alert severity="error">Ruta no encontrada.</Alert>
      </Box>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Back + Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton
          onClick={() => navigate('/repartidor')}
          size="small"
          sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h5" fontWeight={700} noWrap>
              {route.routeId}
            </Typography>
            <StatusBadge status={displayRouteStatus} size="medium" />
          </Box>
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {route.origin} → {route.destination}
            {route.startDate && ` · Iniciada: ${route.startDate}`}
          </Typography>
        </Box>
      </Box>

      {/* Progress summary */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={4}>
          <SummaryCard label="Entregados" value={delivered} color="#1B5E20" bg="#E8F5E9" />
        </Grid>
        <Grid item xs={4}>
          <SummaryCard label="Rechazados" value={rejected} color="#BF360C" bg="#FBE9E7" />
        </Grid>
        <Grid item xs={4}>
          <SummaryCard label="Pendientes" value={pending} color="#7B5E00" bg="#FFF8E1" />
        </Grid>
      </Grid>

      {/* Overall progress bar */}
      {total > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant="body2" fontWeight={600}>
              Progreso general
            </Typography>
            <Typography variant="body2" color={progress === 100 ? 'success.main' : 'text.secondary'} fontWeight={600}>
              {progress}% · {delivered + rejected}/{total}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={progress === 100 ? 'success' : 'primary'}
            sx={{ borderRadius: 4, height: 8 }}
          />
        </Paper>
      )}

      {/* Scan section — only for active routes */}
      {canManageShipments && (
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            background: 'linear-gradient(135deg, #E3F2FD 0%, #EDE7F6 100%)',
            borderColor: 'primary.light',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <QrCodeScannerIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700} color="primary.dark">
              Escanear paquete
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Ingresá el tracking ID o presioná Enter para marcar como entregado
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              inputRef={scanRef}
              size="small"
              fullWidth
              placeholder="Ej: LT-2024-001"
              value={scanInput}
              onChange={(e) => {
                setScanInput(e.target.value)
                setScanError('')
              }}
              onKeyDown={handleScanKeyDown}
              error={Boolean(scanError)}
              helperText={scanError || ' '}
              sx={{ bgcolor: 'white', borderRadius: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              variant="contained"
              onClick={handleScan}
              sx={{ whiteSpace: 'nowrap', minWidth: { xs: 80, sm: 100 }, alignSelf: 'flex-start' }}
            >
              Escanear
            </Button>
          </Box>
        </Paper>
      )}

      {/* Shipments list header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <LocalShippingIcon color="action" fontSize="small" />
        <Typography variant="h6" fontWeight={600}>
          Envíos ({routeShipments.length})
        </Typography>
      </Box>

      {routeShipments.length === 0 && (
        <Alert severity="info">Esta ruta no tiene envíos asociados.</Alert>
      )}

      {/* Mobile: card list */}
      {isMobile ? (
        <Stack spacing={1.5}>
          {routeShipments.map((shipment) => (
            <ShipmentCard
              key={shipment.id}
              shipment={shipment}
              highlight={scanHighlight?.id === shipment.id ? scanHighlight.type : null}
              routeActive={route.status === 'En Curso'}
              onDeliver={() => handleDelivered(shipment)}
              onReject={() => openRejectDialog(shipment.id)}
            />
          ))}
        </Stack>
      ) : (
        /* Desktop: table */
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ overflowX: 'auto' }}
        >
          <Table size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell>Tracking ID</TableCell>
                <TableCell>Destinatario</TableCell>
                <TableCell>Destino</TableCell>
                <TableCell>Peso</TableCell>
                <TableCell>Estado</TableCell>
                {canManageShipments && (
                  <TableCell align="center">Acciones</TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {routeShipments.map((shipment) => {
                const isDone =
                  shipment.status === 'Entregado' ||
                  shipment.status === 'Cancelado'
                const hlType = scanHighlight?.id === shipment.id ? scanHighlight.type : null
                return (
                  <TableRow
                    key={shipment.id}
                    sx={{
                      bgcolor: hlType === 'rejected'
                        ? '#FFEBEE'
                        : hlType === 'delivered'
                          ? '#E8F5E9'
                          : isDone
                            ? 'grey.50'
                            : 'inherit',
                      transition: 'background-color 0.5s',
                      '&:last-child td': { border: 0 },
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontFamily="monospace" fontWeight={700}>
                        {shipment.trackingId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {shipment.receiver.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {shipment.receiver.address}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{shipment.destination}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{shipment.weight} kg</Typography>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={shipment.status} />
                      {shipment.cancellationReason && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                          {shipment.cancellationReason}
                        </Typography>
                      )}
                    </TableCell>
                    {canManageShipments && (
                      <TableCell align="center">
                        {!isDone ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                            <Tooltip title="Marcar como Entregado">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleDelivered(shipment)}
                                sx={{ bgcolor: 'success.50' }}
                              >
                                <CheckCircleOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Rechazar envío">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => openRejectDialog(shipment.id)}
                                sx={{ bgcolor: 'error.50' }}
                              >
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onClose={closeRejectDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Rechazar envío</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Indicá el motivo del rechazo. Esta acción no se puede deshacer.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Motivo de rechazo"
            value={rejectReason}
            onChange={(e) => {
              setRejectReason(e.target.value)
              if (e.target.value.trim()) setRejectReasonError('')
            }}
            error={Boolean(rejectReasonError)}
            helperText={rejectReasonError || ' '}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={closeRejectDialog} variant="outlined" fullWidth>
            Cancelar
          </Button>
          <Button onClick={handleConfirmReject} variant="contained" color="error" fullWidth>
            Rechazar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ─── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  color,
  bg,
}: {
  label: string
  value: number
  color: string
  bg: string
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        textAlign: 'center',
        py: { xs: 1.5, sm: 2 },
        bgcolor: bg,
        borderColor: `${color}33`,
        transition: 'transform 0.15s',
        '&:hover': { transform: 'translateY(-1px)' },
      }}
    >
      <Typography variant="h4" fontWeight={800} sx={{ color, lineHeight: 1.1 }}>
        {value}
      </Typography>
      <Typography variant="caption" sx={{ color, fontWeight: 600, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
        {label}
      </Typography>
    </Card>
  )
}

// ─── Mobile Shipment Card ──────────────────────────────────────────────────────

interface ShipmentCardProps {
  shipment: Shipment
  highlight: 'delivered' | 'rejected' | null
  routeActive: boolean
  onDeliver: () => void
  onReject: () => void
}

function ShipmentCard({ shipment, highlight, routeActive, onDeliver, onReject }: ShipmentCardProps) {
  const isDone =
    shipment.status === 'Entregado' ||
    shipment.status === 'Cancelado'

  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: highlight === 'rejected'
          ? '#FFEBEE'
          : highlight === 'delivered'
            ? '#E8F5E9'
            : isDone
              ? 'grey.50'
              : 'background.paper',
        transition: 'background-color 0.6s ease',
        borderColor: highlight === 'rejected'
          ? 'error.main'
          : highlight === 'delivered'
            ? 'success.main'
            : isDone
              ? 'grey.200'
              : 'divider',
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        {/* Tracking + Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle2" fontFamily="monospace" fontWeight={800} color="primary.dark">
            {shipment.trackingId}
          </Typography>
          <StatusBadge status={shipment.status} />
        </Box>

        <Divider sx={{ my: 1 }} />

        {/* Recipient */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.5 }}>
          <PersonIcon fontSize="small" color="action" sx={{ mt: 0.1, flexShrink: 0 }} />
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {shipment.receiver.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {shipment.receiver.address}, {shipment.destination}
            </Typography>
          </Box>
        </Box>

        {/* Weight + rejection reason */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <ScaleIcon fontSize="small" color="action" sx={{ fontSize: 14 }} />
          <Chip size="small" label={`${shipment.weight} kg`} variant="outlined" />
          {shipment.cancellationReason && (
            <Typography variant="caption" color="error.main" sx={{ ml: 0.5 }}>
              {shipment.cancellationReason}
            </Typography>
          )}
        </Box>

        {/* Action buttons */}
        {routeActive && !isDone && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <Button
              size="small"
              variant="contained"
              color="success"
              startIcon={<CheckCircleOutlineIcon />}
              onClick={onDeliver}
              sx={{ flex: 1, minHeight: 40 }}
            >
              Entregado
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<BlockIcon />}
              onClick={onReject}
              sx={{ flex: 1, minHeight: 40 }}
            >
              Rechazar
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
