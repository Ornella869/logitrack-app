import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import SearchIcon from '@mui/icons-material/Search'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { pickupOperacionService, type PickUpInventario, type PickUpPaquete, type PickUpPaqueteStatus } from '../services/pickupOperacionService'
import { formatInstantArgentina } from '../utils/argentinaDate'

const STATUS_LABEL: Record<PickUpPaqueteStatus, string> = {
  PendienteDeCalendarizacion: 'Pendiente',
  AsignadoAVehiculo: 'Asignado',
  CargadoEnVehiculo: 'Cargado',
  ListoParaSalir: 'Listo para salir',
  EnTransito: 'En camino',
  Demorado: 'Demorado',
  ListoParaRetirar: 'Listo para retirar',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
}

const STATUS_STYLE: Record<PickUpPaqueteStatus, { color: string; bg: string }> = {
  PendienteDeCalendarizacion: { color: '#7B5E00', bg: '#FFF3CD' },
  AsignadoAVehiculo: { color: '#4527A0', bg: '#EDE7F6' },
  CargadoEnVehiculo: { color: '#311B92', bg: '#D1C4E9' },
  ListoParaSalir: { color: '#E65100', bg: '#FFF3E0' },
  EnTransito: { color: '#0D47A1', bg: '#E3F2FD' },
  Demorado: { color: '#BF360C', bg: '#FFE0B2' },
  ListoParaRetirar: { color: '#00695C', bg: '#E0F2F1' },
  Entregado: { color: '#1B5E20', bg: '#E8F5E9' },
  Cancelado: { color: '#7F0000', bg: '#FFEBEE' },
}

function StatusChip({ status }: { status: PickUpPaqueteStatus }) {
  const cfg = STATUS_STYLE[status]
  return <Chip label={STATUS_LABEL[status] ?? status} size="small" sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700 }} />
}

function Kpi({ title, value, icon, color }: { title: string; value: number | string; icon: ReactNode; color: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%', borderLeft: `5px solid ${color}` }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={700}>{title}</Typography>
            <Typography variant="h4" fontWeight={800}>{value}</Typography>
          </Box>
          <Box sx={{ color }}>{icon}</Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

export default function PickUpOperacionPage() {
  const [data, setData] = useState<PickUpInventario | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [codigoRecepcion, setCodigoRecepcion] = useState('')
  const [codigoEntrega, setCodigoEntrega] = useState('')
  const [codigoSegEntrega, setCodigoSegEntrega] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setData(await pickupOperacionService.inventario())
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data || 'No se pudo cargar el inventario Pick Up.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!data) return []
    if (!term) return data.paquetes
    return data.paquetes.filter((p) =>
      p.codigoSeguimiento.toLowerCase().includes(term) ||
      p.destinatario.toLowerCase().includes(term) ||
      p.localidad.toLowerCase().includes(term))
  }, [data, search])

  const onRecibir = async () => {
    if (!codigoRecepcion.trim()) {
      setMessage({ type: 'info', text: 'Ingresá o escaneá un código de seguimiento.' })
      return
    }
    setBusy(true)
    try {
      const paquete = await pickupOperacionService.recibir(codigoRecepcion.trim())
      setCodigoRecepcion('')
      setMessage({ type: 'success', text: `Envio ${paquete.codigoSeguimiento} recibido y listo para retirar.` })
      await load()
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data || 'No se pudo recibir el envio.' })
    } finally {
      setBusy(false)
    }
  }

  const onEntregar = async () => {
    if (!codigoSegEntrega.trim() || !codigoEntrega.trim()) {
      setMessage({ type: 'info', text: 'Ingresá el seguimiento y el código de entrega del cliente.' })
      return
    }
    setBusy(true)
    try {
      const paquete = await pickupOperacionService.entregar(codigoSegEntrega.trim(), codigoEntrega.trim())
      setCodigoSegEntrega('')
      setCodigoEntrega('')
      setMessage({ type: 'success', text: `Envio ${paquete.codigoSeguimiento} entregado correctamente.` })
      await load()
    } catch (error: any) {
      setMessage({ type: 'error', text: error?.response?.data || 'No se pudo entregar el envio.' })
    } finally {
      setBusy(false)
    }
  }

  const fillDelivery = (paquete: PickUpPaquete) => {
    setCodigoSegEntrega(paquete.codigoSeguimiento)
    setCodigoEntrega('')
  }

  if (loading && !data) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1320, mx: 'auto' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h4" fontWeight={800}>Operación Pick Up</Typography>
          <Typography color="text.secondary">Recepción, inventario y entrega con código de seguridad.</Typography>
        </Box>

        {message && <Alert severity={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>}

        {data && (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <StorefrontIcon color="primary" />
                <Box>
                  <Typography variant="h6" fontWeight={800}>{data.punto.nombre}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {data.punto.direccion}, {data.punto.localidad} · {data.punto.provincia}
                  </Typography>
                </Box>
              </Stack>
              <Chip label={data.punto.horarios} color="primary" variant="outlined" />
            </Stack>
          </Paper>
        )}

        {data && (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}><Kpi title="CAPACIDAD USADA" value={`${data.capacidadUsada}/${data.punto.capacidadDiaria}`} icon={<Inventory2Icon />} color="#1976D2" /></Grid>
            <Grid item xs={12} sm={6} md={3}><Kpi title="EN CAMINO AL PUNTO" value={data.enCamino} icon={<LocalShippingIcon />} color="#ED6C02" /></Grid>
            <Grid item xs={12} sm={6} md={3}><Kpi title="LISTOS PARA RETIRAR" value={data.listosParaRetirar} icon={<QrCodeScannerIcon />} color="#00897B" /></Grid>
            <Grid item xs={12} sm={6} md={3}><Kpi title="ENTREGADOS HOY" value={data.entregadosHoy} icon={<CheckCircleIcon />} color="#2E7D32" /></Grid>
          </Grid>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} gutterBottom>Recibir envío</Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Código de seguimiento"
                    value={codigoRecepcion}
                    onChange={(e) => setCodigoRecepcion(e.target.value.toUpperCase())}
                    placeholder="Ej: LT-1234-5678"
                    fullWidth
                    InputProps={{ startAdornment: <InputAdornment position="start"><QrCodeScannerIcon /></InputAdornment> }}
                  />
                  <Button variant="contained" onClick={onRecibir} disabled={busy} startIcon={<Inventory2Icon />}>
                    Marcar como recibido
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} gutterBottom>Entregar al cliente</Typography>
                <Stack spacing={2}>
                  <TextField label="Código de seguimiento" value={codigoSegEntrega} onChange={(e) => setCodigoSegEntrega(e.target.value.toUpperCase())} fullWidth />
                  <TextField label="Código de entrega" value={codigoEntrega} onChange={(e) => setCodigoEntrega(e.target.value.replace(/\D/g, '').slice(0, 6))} fullWidth />
                  <Button variant="contained" color="success" onClick={onEntregar} disabled={busy} startIcon={<CheckCircleIcon />}>
                    Confirmar retiro
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Inventario del punto</Typography>
              <Typography variant="body2" color="text.secondary">Solo envíos asociados a este Pick Up.</Typography>
            </Box>
            <TextField
              size="small"
              placeholder="Buscar por código, cliente o localidad..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ minWidth: { sm: 340 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }}
            />
          </Stack>
          <Divider sx={{ mb: 2 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Cliente</TableCell>
                  <TableCell>Destino</TableCell>
                  <TableCell>Peso</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Estimado</TableCell>
                  <TableCell align="right">Acción</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell><Typography fontWeight={700}>{p.codigoSeguimiento}</Typography></TableCell>
                    <TableCell>
                      <Typography variant="body2">{p.destinatario}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.email || p.telefono || '-'}</Typography>
                    </TableCell>
                    <TableCell>{p.localidad} · CP {p.codigoPostal}</TableCell>
                    <TableCell>{p.peso} kg</TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                    <TableCell>{p.fechaEstimadaEntrega ? formatInstantArgentina(p.fechaEstimadaEntrega) : '-'}</TableCell>
                    <TableCell align="right">
                      {p.status === 'ListoParaRetirar' && (
                        <Button size="small" variant="outlined" onClick={() => fillDelivery(p)}>Entregar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Box sx={{ py: 5, textAlign: 'center', color: 'text.secondary' }}>No hay envíos para mostrar.</Box>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Stack>
    </Box>
  )
}
