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
  Tooltip,
  Typography,
} from '@mui/material'
import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import DirectionsBikeIcon from '@mui/icons-material/DirectionsBike'
import {
  calendarizacionService,
  type TramoEnvio,
  type CalendarioOperativo,
} from '../services/shipmentService'
import type { Shipment } from '../types'
import { dateOnly, formatDateOnlyEs } from '../utils/argentinaDate'

interface Props {
  open: boolean
  shipment: Shipment
  tramo?: TramoEnvio | null
  onClose: () => void
  onSuccess: (mensaje: string) => void
}

const CAPACIDAD_KG = 500

const displayDate = (value: string) =>
  formatDateOnlyEs(value, {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
  })

// G1L-83: asignación manual de un envío pendiente a un repartidor y día.
export default function PrecalendarizarDialog({ open, shipment, tramo, onClose, onSuccess }: Props) {
  const [calendario, setCalendario] = useState<CalendarioOperativo | null>(null)
  const [loading, setLoading] = useState(false)
  const [fecha, setFecha] = useState('')
  const [repartidorId, setRepartidorId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setRepartidorId('')
    setSearch('')
    void (async () => {
      setLoading(true)
      const cal = await calendarizacionService.getCalendario(14)
      setCalendario(cal)
      setFecha(cal?.dias?.[0] ? dateOnly(cal.dias[0]) : '')
      setLoading(false)
    })()
  }, [open])

  const diasDisponibles = useMemo(
    () => [...new Set((calendario?.dias ?? []).map(dateOnly))],
    [calendario],
  )

  const hoy = dateOnly(new Date().toISOString())
  const horasEstimadasAsignacion = tramo?.horasEstimadas ?? shipment.horasEstimadasRuta
  const requiereFullTime = tramo ? (!tramo.esUltimaMilla || tramo.horasEstimadas > 6) : (shipment.horasEstimadasRuta ?? 0) > 6

  // Carga de cada repartidor para el día elegido.
  const cargaPorRepartidor = useMemo(() => {
    const map = new Map<string, { cantidad: number; peso: number }>()
    if (!calendario || !fecha) return map
    for (const rep of calendario.repartidores) {
      const celda = rep.celdas.find((c) => dateOnly(c.fecha) === fecha)
      map.set(rep.repartidorId, {
        cantidad: celda?.paquetes.length ?? 0,
        peso: celda?.pesoTotal ?? 0,
      })
    }
    return map
  }, [calendario, fecha])

  const pesoActual = repartidorId ? cargaPorRepartidor.get(repartidorId)?.peso ?? 0 : 0
  const pesoResultante = pesoActual + (shipment.weight ?? 0)

  const handleConfirm = async () => {
    if (!repartidorId || !fecha) {
      setError('Elegí un repartidor y un día.')
      return
    }
    setSubmitting(true)
    setError('')
    const res = await calendarizacionService.precalendarizar(shipment.id, repartidorId, fecha)
    setSubmitting(false)
    if (!res.success) {
      setError(res.error ?? 'No se pudo asignar manualmente')
      return
    }
    const extraMsg = res.data?.mensaje ? ` ${res.data.mensaje}` : ''
    onSuccess(`Envío asignado manualmente.${extraMsg}`)
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
              {horasEstimadasAsignacion !== undefined && (
                <> · <strong>~{horasEstimadasAsignacion.toFixed(1)} h de ruta</strong>
                  {requiereFullTime && (
                    <Chip
                      label="Solo Full Time"
                      size="small"
                      sx={{ ml: 0.5, bgcolor: '#e3f2fd', color: '#1565c0', fontWeight: 700, fontSize: '0.65rem', height: 20, verticalAlign: 'middle' }}
                    />
                  )}
                </>
              )}
            </Typography>

            <FormControl fullWidth size="small">
              <InputLabel>Día</InputLabel>
              <Select
                value={fecha}
                label="Día"
                onChange={(e) => setFecha(e.target.value)}
              >
                {diasDisponibles.map((d) => (
                  <MenuItem key={d} value={d}>
                    {displayDate(d)}
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
                  const enTransitoHoy = fecha === hoy && rep.estadoJornada === 'EnRuta'
                  const retornando = rep.estadoJornada === 'Retornando'
                  const esPartTime = (rep.horasTrabajo ?? 8) <= 6
                  const incompatibleJornada = esPartTime && requiereFullTime
                  const bloqueado = enTransitoHoy || retornando || quedaExcedido || incompatibleJornada
                  const tooltipTitle = enTransitoHoy
                    ? 'Está en tránsito. Elegí otro día para asignarle un envío.'
                    : retornando
                    ? 'Está regresando a sucursal. Esperá a que cierre su jornada.'
                    : quedaExcedido
                    ? 'No hay capacidad para este envío en este día. Elegí otro día.'
                    : incompatibleJornada
                    ? `Este envío requiere ~${(horasEstimadasAsignacion ?? 0).toFixed(1)} h de ruta. Los repartidores Part Time solo pueden recibir envíos de hasta 6 h o tramos de última milla.`
                    : ''
                  return (
                    <Tooltip key={rep.repartidorId} title={tooltipTitle} placement="top">
                      <Box
                        onClick={() => { if (!bloqueado) setRepartidorId(rep.repartidorId) }}
                        sx={{
                          display: 'flex', alignItems: 'center', gap: 1, p: 1, borderRadius: 1,
                          cursor: bloqueado ? 'not-allowed' : 'pointer',
                          border: '1px solid',
                          borderColor: bloqueado ? 'warning.main' : seleccionado ? 'primary.main' : 'divider',
                          bgcolor: bloqueado ? 'rgba(255,152,0,0.08)' : seleccionado ? 'action.selected' : 'transparent',
                          opacity: bloqueado ? 0.75 : 1,
                        }}
                      >
                        <Radio checked={seleccionado} size="small" disabled={bloqueado} />
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" alignItems="center" spacing={0.5} flexWrap="wrap">
                            <Typography variant="body2" fontWeight={600}>{rep.nombre}</Typography>
                            <Chip
                              label={rep.tipoJornada ?? 'Full Time'}
                              size="small"
                              sx={{
                                bgcolor: esPartTime ? '#fff3e0' : '#e3f2fd',
                                color: esPartTime ? '#e65100' : '#1565c0',
                                fontWeight: 700, fontSize: '0.65rem', height: 20,
                              }}
                            />
                            {enTransitoHoy && (
                              <Chip
                                icon={<DirectionsBikeIcon sx={{ fontSize: '12px !important' }} />}
                                label="En tránsito hoy"
                                size="small"
                                sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                              />
                            )}
                            {retornando && !enTransitoHoy && (
                              <Chip
                                label="Retornando"
                                size="small"
                                sx={{ bgcolor: '#ede7f6', color: '#5e35b1', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                              />
                            )}
                            {quedaExcedido && !enTransitoHoy && !retornando && !incompatibleJornada && (
                              <Chip
                                label="Capacidad llena"
                                size="small"
                                sx={{ bgcolor: '#ffebee', color: '#c62828', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                              />
                            )}
                            {incompatibleJornada && (
                              <Chip
                                label="Solo Full Time"
                                size="small"
                                sx={{ bgcolor: '#ffebee', color: '#c62828', fontWeight: 700, fontSize: '0.65rem', height: 20 }}
                              />
                            )}
                          </Stack>
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
                    </Tooltip>
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
              <Alert severity="info">
                Peso resultante: {pesoResultante.toFixed(1)} kg de {CAPACIDAD_KG} kg.
              </Alert>
            )}

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => void handleConfirm()}
          disabled={submitting || !repartidorId || !fecha}
        >
          {submitting ? <CircularProgress size={20} color="inherit" /> : 'Asignar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
