import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined'

import HistoryIcon from '@mui/icons-material/History'
import { shipmentService } from '../services/shipmentService'
import { incidenciaService, type Incidencia } from '../services/incidenciaService'
import ReportarIncidenteClienteDialog from '../components/ReportarIncidenteClienteDialog'
import type { Shipment } from '../types'
import { formatDateOnlyEs } from '../utils/argentinaDate'

const STATUS_CONFIG: Record<Shipment['status'], { label: string; color: string; bg: string }> = {
  'Pendiente de calendarización': { label: 'En preparación', color: '#7B5E00', bg: '#FFF3CD' },
  'Asignado a vehículo': { label: 'Programado', color: '#4527A0', bg: '#EDE7F6' },
  'Cargado en vehículo': { label: 'Cargado', color: '#311B92', bg: '#D1C4E9' },
  'Listo para salir': { label: 'Listo para despacho', color: '#E65100', bg: '#FFF3E0' },
  'Listo para retirar': { label: 'Listo para retirar', color: '#00695C', bg: '#E0F2F1' },
  'En tránsito': { label: 'En camino', color: '#0D47A1', bg: '#E3F2FD' },
  'Demorado': { label: 'Demorado', color: '#BF360C', bg: '#FFE0B2' },
  'En tránsito - Descanso': { label: 'En ruta (pausa nocturna)', color: '#37474F', bg: '#ECEFF1' },
  'Entregado en punto': { label: 'Llegó al punto Pick Up', color: '#1565C0', bg: '#E3F2FD' },
  'Entregado': { label: 'Entregado ✓', color: '#1B5E20', bg: '#E8F5E9' },
  'Cancelado': { label: 'Cancelado', color: '#7F0000', bg: '#FFEBEE' },
}

const TIPO_LABEL: Record<string, string> = {
  no_llego: 'No llegó', llego_danado: 'Llegó dañado', llego_tarde: 'Llegó tarde',
  otro: 'Otro', accident: 'Accidente', mechanical: 'Problema mecánico',
  danger: 'Zona de riesgo', health: 'Problema de salud', delivery: 'Problema de entrega',
}

const ESTADO_COLOR: Record<string, { color: string; bg: string }> = {
  Abierta: { color: '#c62828', bg: '#fdecea' },
  'En Revisión': { color: '#e65100', bg: '#fff3e0' },
  Resuelta: { color: '#2e7d32', bg: '#e8f5e9' },
}

const BLOQUEADOS: Shipment['status'][] = [
  'Pendiente de calendarización',
  'Asignado a vehículo',
  'Cargado en vehículo',
  'Listo para salir',
]

function canReport(s: Shipment): boolean {
  return !BLOQUEADOS.includes(s.status)
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  return formatDateOnlyEs(iso, { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function PortalClientePublico() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [searching, setSearching] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const [misIncidencias, setMisIncidencias] = useState<Incidencia[]>([])

  useEffect(() => {
    if (!shipment) {
      setMisIncidencias([])
      return
    }
    void incidenciaService.getAll()
      .then((items) => setMisIncidencias(items.filter((i) => i.origen === 'cliente' && i.repartidorId === `cliente_${shipment.trackingId}`)))
      .catch(() => setMisIncidencias([]))
  }, [shipment])

  const handleSearch = async () => {
    const id = query.trim()
    if (!id) return
    setSearching(true)
    setNotFound(false)
    setShipment(null)
    const found = await shipmentService.getShipmentByTrackingCode(id)
    if (found) setShipment(found)
    else setNotFound(true)
    setSearching(false)
  }

  const statusCfg = shipment ? STATUS_CONFIG[shipment.status] : null
  const showReport = shipment ? canReport(shipment) : false

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(160deg,#04213E 0%,#0C5EA7 50%,#19A5F2 100%)' }}>
      {/* Navbar mínima */}
      <Box sx={{ px: { xs: 2, md: 4 }, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <IconButton onClick={() => navigate('/')} sx={{ color: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
          <ArrowBackIcon />
        </IconButton>
        <LocalShippingIcon sx={{ color: 'white', fontSize: 28 }} />
        <Typography variant="h6" fontWeight={800} sx={{ color: 'white', letterSpacing: '-0.5px' }}>
          LogiTrack · Portal Cliente
        </Typography>
      </Box>

      <Box sx={{ maxWidth: 680, mx: 'auto', px: 2, pb: 6 }}>
        {/* Hero texto */}
        <Box sx={{ textAlign: 'center', py: { xs: 4, md: 6 } }}>
          <Typography variant="h4" fontWeight={900} sx={{ color: 'white', mb: 1 }}>
            ¿Dónde está tu envío?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '1.05rem' }}>
            Ingresá tu código de seguimiento para ver el estado en tiempo real.
          </Typography>
        </Box>

        {/* Buscador */}
        <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField
                fullWidth
                size="medium"
                placeholder="Ej: LOG-2024-003"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSearch() }}
                disabled={searching}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> }}
              />
              <Button
                variant="contained"
                size="large"
                startIcon={searching ? <CircularProgress size={18} color="inherit" /> : <SearchIcon />}
                onClick={() => void handleSearch()}
                disabled={searching || !query.trim()}
                sx={{ minWidth: 130, fontWeight: 700, borderRadius: 2 }}
              >
                Buscar
              </Button>
            </Stack>
            {notFound && (
              <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
                No encontramos ningún envío con ese código. Verificá que sea correcto.
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Resultado */}
        {shipment && statusCfg && (
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.22)', mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Código de seguimiento</Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ fontFamily: 'monospace' }}>{shipment.trackingId}</Typography>
                </Box>
                <Chip
                  label={statusCfg.label}
                  sx={{ fontWeight: 700, fontSize: 13, color: statusCfg.color, bgcolor: statusCfg.bg, border: `1px solid ${statusCfg.color}33`, px: 0.5 }}
                />
              </Stack>

              <Divider sx={{ mb: 2 }} />

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                  <Typography variant="caption" color="text.secondary">Origen</Typography>
                  <Typography fontWeight={600}>{shipment.origin}</Typography>
                </Box>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: '#F8FAFC' }}>
                  <Typography variant="caption" color="text.secondary">Destino</Typography>
                  <Typography fontWeight={600}>{shipment.destination}</Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: showReport ? 2 : 0 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">Fecha de alta</Typography>
                  <Typography fontWeight={600}>{fmt(shipment.createdDate)}</Typography>
                </Box>
                {(shipment.fechaEstimadaEntrega || shipment.fechaCalendarizada) && (
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" color="text.secondary">Entrega estimada</Typography>
                    <Typography fontWeight={600}>{fmt(shipment.fechaEstimadaEntrega ?? shipment.fechaCalendarizada ?? '')}</Typography>
                  </Box>
                )}
              </Stack>

              {showReport && (
                <Button
                  variant="outlined"
                  startIcon={<ReportProblemOutlinedIcon />}
                  onClick={() => setDialogOpen(true)}
                  sx={{ mt: 1, color: '#c62828', borderColor: '#c62828', fontWeight: 600, borderRadius: 2, '&:hover': { bgcolor: 'rgba(198,40,40,0.06)' } }}
                >
                  Reportar un problema con este envío
                </Button>
              )}

              {!showReport && (
                <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
                  Podés reportar incidencias una vez que el envío esté en tránsito, entregado, cancelado o con SLA vencido.
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Incidencias previas */}
        {shipment && misIncidencias.length > 0 && (
          <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.22)' }}>
            <CardContent sx={{ p: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <HistoryIcon color="action" />
                <Typography variant="subtitle1" fontWeight={700}>Reportes anteriores para este envío</Typography>
              </Stack>
              <Stack spacing={1.5}>
                {misIncidencias.map((inc) => {
                  const ec = ESTADO_COLOR[inc.estado] ?? ESTADO_COLOR['Abierta']
                  return (
                    <Box key={inc.id} sx={{ p: 2, borderRadius: 2, border: '1px solid #E2E8F0', bgcolor: '#FAFAFA' }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{TIPO_LABEL[inc.tipo] ?? inc.tipoLabel}</Typography>
                          <Typography variant="caption" color="text.secondary">{fmt(inc.fechaReporte)}</Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>{inc.descripcion}</Typography>
                        </Box>
                        <Chip label={inc.estado} size="small" sx={{ fontWeight: 700, color: ec.color, bgcolor: ec.bg, border: `1px solid ${ec.color}`, flexShrink: 0, ml: 1 }} />
                      </Stack>
                    </Box>
                  )
                })}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>

      {shipment && (
        <ReportarIncidenteClienteDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          shipment={shipment}
        />
      )}
    </Box>
  )
}
