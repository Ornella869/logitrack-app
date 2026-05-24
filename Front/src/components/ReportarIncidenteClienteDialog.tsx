import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'
import { incidenciaService, type TipoIncidencia } from '../services/incidenciaService'
import type { Shipment } from '../types'

const MOTIVOS: { value: TipoIncidencia; label: string }[] = [
  { value: 'no_llego', label: 'No llego' },
  { value: 'llego_danado', label: 'Llego danado' },
  { value: 'llego_tarde', label: 'Llego tarde' },
  { value: 'otro', label: 'Otro' },
]

const ESTADOS_BLOQUEADOS: Shipment['status'][] = [
  'Pendiente de calendarización',
  'Asignado a vehículo',
  'Cargado en vehículo',
  'Listo para salir',
]

interface Props {
  open: boolean
  onClose: () => void
  shipment: Shipment
}

export default function ReportarIncidenteClienteDialog({ open, onClose, shipment }: Props) {
  const [motivo, setMotivo] = useState<TipoIncidencia | ''>('')
  const [descripcion, setDescripcion] = useState('')
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [incidenciaId, setIncidenciaId] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isBlocked = ESTADOS_BLOQUEADOS.includes(shipment.status)

  const handleClose = () => {
    setMotivo('')
    setDescripcion('')
    setEmail('')
    setSubmitted(false)
    setIncidenciaId('')
    setError('')
    onClose()
  }

  const handleSubmit = async () => {
    if (!motivo || !descripcion.trim()) {
      setError('El motivo y la descripcion son obligatorios.')
      return
    }

    setLoading(true)
    setError('')

    const motivoLabel = MOTIVOS.find((m) => m.value === motivo)?.label ?? motivo
    try {
      const nueva = await incidenciaService.createCliente({
        trackingId: shipment.trackingId,
        tipo: motivo,
        tipoLabel: motivoLabel,
        descripcion: descripcion.trim(),
        emailContacto: email.trim() || undefined,
      })
      setIncidenciaId(nueva.id)
      setSubmitted(true)
    } catch (err: any) {
      setError(err.response?.data ?? 'No se pudo registrar la incidencia.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1} alignItems="center">
            <ReportProblemOutlinedIcon sx={{ color: '#c62828' }} />
            <Typography variant="h6" fontWeight={700}>Reportar una incidencia</Typography>
          </Stack>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 4 }}>
          Envio {shipment.trackingId}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {isBlocked ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Solo se pueden reportar incidencias sobre envios en transito, entregados o cancelados.
          </Alert>
        ) : submitted ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 56, color: '#2e7d32' }} />
            <Typography variant="h6" fontWeight={700} textAlign="center">
              Incidencia registrada
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Tu reporte fue recibido y sera revisado por nuestro equipo.
            </Typography>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', width: '100%', textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">ID de seguimiento de la incidencia</Typography>
              <Typography variant="subtitle1" fontWeight={800} sx={{ fontFamily: 'monospace', color: '#0D47A1', mt: 0.3 }}>
                {incidenciaId}
              </Typography>
            </Box>
          </Stack>
        ) : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            <FormControl fullWidth required>
              <InputLabel>Motivo</InputLabel>
              <Select
                value={motivo}
                label="Motivo"
                onChange={(e) => setMotivo(e.target.value as TipoIncidencia)}
              >
                {MOTIVOS.map((m) => (
                  <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Descripcion"
              multiline
              minRows={3}
              fullWidth
              required
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describi el problema con tu envio..."
              inputProps={{ maxLength: 500 }}
              helperText={`${descripcion.length}/500`}
            />

            <TextField
              label="Email de contacto (opcional)"
              fullWidth
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Para que te contactemos si necesitamos mas informacion"
            />
          </Stack>
        )}
      </DialogContent>

      {!isBlocked && !submitted && (
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleClose} variant="outlined" color="inherit">
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading || !motivo || !descripcion.trim()}
            sx={{ bgcolor: '#c62828', '&:hover': { bgcolor: '#b71c1c' }, fontWeight: 600 }}
          >
            Enviar reporte
          </Button>
        </DialogActions>
      )}

      {submitted && (
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={handleClose} variant="contained" sx={{ fontWeight: 600 }}>
            Cerrar
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
