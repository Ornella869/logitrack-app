import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Radio,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import {
  calendarizacionService,
  type CalendarioOperativo,
} from '../services/shipmentService'
import type { Shipment } from '../types'

interface Props {
  open: boolean
  shipment: Shipment
  onClose: () => void
  onSuccess: (mensaje: string) => void
}

const CAPACIDAD_KG = 500

// G1L-83: asignación manual de un envío pendiente a un repartidor y día.
export default function PrecalendarizarDialog({ open, shipment, onClose, onSuccess }: Props) {
  const [calendario, setCalendario] = useState<CalendarioOperativo | null>(null)
  const [loading, setLoading] = useState(false)
  const [fecha, setFecha] = useState('')
  const [repartidorId, setRepartidorId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Cuando el backend avisa sobrecarga, guardamos el mensaje y habilitamos confirmación.
  const [warnSobrecarga, setWarnSobrecarga] = useState<string | null>(null)
  // Buscador de repartidor: filtro local sobre la lista ya cargada (no pega al backend).
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setWarnSobrecarga(null)
    setRepartidorId('')
    setSearch('')
    void (async () => {
      setLoading(true)
      const cal = await calendarizacionService.getCalendario(14)
      setCalendario(cal)
      // Días hábiles próximos (excluye sábado y domingo).
      const habiles = (cal?.dias ?? []).filter((d) => {
        const dow = new Date(d).getDay()
        return dow !== 0 && dow !== 6
      })
      setFecha(habiles[0] ?? cal?.dias?.[0] ?? '')
      setLoading(false)
    })()
  }, [open])

  const diasHabiles = useMemo(
    () =>
      (calendario?.dias ?? []).filter((d) => {
        const dow = new Date(d).getDay()
        return dow !== 0 && dow !== 6
      }),
    [calendario],
  )

  // Carga de cada repartidor para el día elegido.
  const cargaPorRepartidor = useMemo(() => {
    const map = new Map<string, { cantidad: number; peso: number }>()
    if (!calendario || !fecha) return map
    for (const rep of calendario.repartidores) {
      const celda = rep.celdas.find((c) => c.fecha.split('T')[0] === fecha.split('T')[0])
      map.set(rep.repartidorId, {
        cantidad: celda?.paquetes.length ?? 0,
        peso: celda?.pesoTotal ?? 0,
      })
    }
    return map
  }, [calendario, fecha])

  const pesoActual = repartidorId ? cargaPorRepartidor.get(repartidorId)?.peso ?? 0 : 0
  const pesoResultante = pesoActual + (shipment.weight ?? 0)
  const excede = pesoResultante > CAPACIDAD_KG

  const handleConfirm = async (confirmarSobrecarga = false) => {
    if (!repartidorId || !fecha) {
      setError('Elegí un repartidor y un día.')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await calendarizacionService.precalendarizar(shipment.id, repartidorId, fecha, confirmarSobrecarga)
    setSubmitting(false)
    if (!res.success) {
      setError(res.error ?? 'No se pudo asignar manualmente')
      return
    }
    if (res.data?.requiereConfirmacion) {
      setWarnSobrecarga(res.data.mensaje ?? 'El peso supera la capacidad. Confirmá para continuar.')
      return
    }
    const reversionMsg = res.data?.huboReversion ? ` ${res.data.mensaje}` : ''
    onSuccess(`Envío asignado manualmente.${reversionMsg}`)
  }

  return (
    <Dialog open={open} onClose={() => !submitting && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <EventAvailableIcon color="primary" /> <span>Asignar manualmente</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Envío <strong>{shipment.trackingId}</strong> · {(shipment.weight ?? 0).toFixed(1)} kg · destino CP {shipment.receiver.postalCode}
            </Typography>

            <FormControl fullWidth size="small">
              <InputLabel>Día</InputLabel>
              <Select
                value={fecha}
                label="Día"
                onChange={(e) => { setFecha(e.target.value); setWarnSobrecarga(null) }}
              >
                {diasHabiles.map((d) => (
                  <MenuItem key={d} value={d}>
                    {new Date(d).toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'short' })}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box>
              <Typography variant="subtitle2" gutterBottom>Repartidores disponibles</Typography>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar repartidor por nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                sx={{ mb: 1.5 }}
              />
              <Stack spacing={1}>
                {(calendario?.repartidores ?? [])
                  .filter((rep) => rep.nombre.toLowerCase().includes(search.trim().toLowerCase()))
                  .map((rep) => {
                  const carga = cargaPorRepartidor.get(rep.repartidorId) ?? { cantidad: 0, peso: 0 }
                  const seleccionado = repartidorId === rep.repartidorId
                  const quedaExcedido = carga.peso + (shipment.weight ?? 0) > CAPACIDAD_KG
                  return (
                    <Box
                      key={rep.repartidorId}
                      onClick={() => { setRepartidorId(rep.repartidorId); setWarnSobrecarga(null) }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1, cursor: 'pointer',
                        border: '1px solid', borderColor: seleccionado ? 'primary.main' : 'divider',
                        bgcolor: seleccionado ? 'action.selected' : 'transparent',
                      }}
                    >
                      <Radio checked={seleccionado} size="small" />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{rep.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {carga.cantidad} envíos · {carga.peso.toFixed(1)} kg acumulados
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={`${carga.peso.toFixed(0)}/${CAPACIDAD_KG} kg`}
                        sx={{
                          bgcolor: quedaExcedido ? '#ffebee' : '#e8f5e9',
                          color: quedaExcedido ? '#c62828' : '#2e7d32',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  )
                })}
                {(calendario?.repartidores ?? []).filter((rep) => rep.nombre.toLowerCase().includes(search.trim().toLowerCase())).length === 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ py: 1 }}>
                    No se encontraron repartidores con ese nombre.
                  </Typography>
                )}
              </Stack>
            </Box>

            {repartidorId && (
              <Alert severity={excede ? 'warning' : 'info'}>
                Peso resultante: {pesoResultante.toFixed(1)} kg de {CAPACIDAD_KG} kg.
                {excede && ' Supera la capacidad del repartidor.'}
              </Alert>
            )}

            {warnSobrecarga && <Alert severity="warning">{warnSobrecarga}</Alert>}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        {warnSobrecarga ? (
          <Button
            variant="contained" color="warning"
            onClick={() => void handleConfirm(true)}
            disabled={submitting}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Confirmar igualmente'}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={() => void handleConfirm(false)}
            disabled={submitting || !repartidorId || !fecha}
          >
            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Asignar'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
