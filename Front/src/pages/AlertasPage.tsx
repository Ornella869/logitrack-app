import { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import { alertService, type AlertaPaqueteSinEstadoFinal } from '../services/alertService'
import { notificationService } from '../services/notificationService'
import { shipmentService } from '../services/shipmentService'
import type { User } from '../types'
import { formatDateOnlyEs } from '../utils/argentinaDate'

const ALERTA_NOTIF_KEY = 'logitrack_alertas_notificadas'

function getNotificadasIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ALERTA_NOTIF_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}

function saveNotificadasIds(ids: Set<string>): void {
  localStorage.setItem(ALERTA_NOTIF_KEY, JSON.stringify([...ids]))
}

// G1L-84: panel de alertas de paquetes sin estado final (Supervisor).
export default function AlertasPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const [alertas, setAlertas] = useState<AlertaPaqueteSinEstadoFinal[]>([])
  const [loading, setLoading] = useState(true)
  const [resolviendoId, setResolviendoId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const data = await alertService.getPaquetesSinEstadoFinal()
    setAlertas(data)
    setLoading(false)

    // UH-84: generar notificaciones in-app para alertas nuevas (evitar duplicados)
    const notificadas = getNotificadasIds()
    let huboNuevas = false
    data.forEach((a) => {
      if (!notificadas.has(a.paqueteId)) {
        notificadas.add(a.paqueteId)
        huboNuevas = true
        notificationService.add({
          type: 'incidencia',
          title: 'Paquete sin estado final',
          message: `${a.trackingId} — ${a.repartidorNombre} — ${a.diasDemora} día${a.diasDemora === 1 ? '' : 's'} de demora (${a.estadoActual})`,
          recipientId: user.id,
          navigateTo: `/shipment/${a.paqueteId}`,
        })
      }
    })
    if (huboNuevas) saveNotificadasIds(notificadas)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resolverAlerta = async (alerta: AlertaPaqueteSinEstadoFinal, accion: 'Reprogramar' | 'Cancelar') => {
    const motivo = window.prompt(`Motivo para ${accion.toLowerCase()} ${alerta.trackingId}`)
    if (!motivo?.trim()) return
    setResolviendoId(alerta.paqueteId)
    const result = await shipmentService.resolverIncidente(alerta.paqueteId, accion, motivo.trim())
    setResolviendoId(null)
    if (!result.success) {
      window.alert(result.error ?? 'No se pudo resolver la alerta.')
      return
    }
    await load()
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <WarningAmberIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#ed6c02' }} />
            Alertas de envíos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Paquetes En Tránsito o Demorados con fecha de entrega vencida, o que llevan más de 24 h en tránsito.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Actualizar</Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : alertas.length === 0 ? (
        <Alert severity="success" sx={{ mt: 2 }}>No hay paquetes sin estado final. Todo al día.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tracking ID</TableCell>
                <TableCell>Repartidor</TableCell>
                <TableCell>Motivo</TableCell>
                <TableCell>Referencia</TableCell>
                <TableCell align="center">Días</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="right">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alertas.map((a) => (
                <TableRow key={a.paqueteId} hover>
                  <TableCell sx={{ fontFamily: 'monospace' }}>{a.trackingId}</TableCell>
                  <TableCell>{a.repartidorNombre}</TableCell>
                  <TableCell>
                    {a.motivoAlerta === 'MasDe24hEnTransito' ? (
                      <Chip size="small" icon={<AccessTimeIcon sx={{ fontSize: '16px !important' }} />} label="Más de 24 h en tránsito" sx={{ bgcolor: '#f3e5f5', color: '#6a1b9a', fontWeight: 600 }} />
                    ) : (
                      <Chip size="small" icon={<WarningAmberIcon sx={{ fontSize: '16px !important' }} />} label="Fecha vencida" sx={{ bgcolor: '#fff3e0', color: '#e65100', fontWeight: 600 }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {a.motivoAlerta === 'MasDe24hEnTransito'
                      ? `En tránsito desde ${formatDateOnlyEs(a.fechaPrevista)}`
                      : formatDateOnlyEs(a.fechaPrevista)}
                  </TableCell>
                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={`${a.diasDemora} día${a.diasDemora === 1 ? '' : 's'}`}
                      sx={{ bgcolor: a.diasDemora >= 3 ? '#ffebee' : '#fff3e0', color: a.diasDemora >= 3 ? '#c62828' : '#e65100', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={a.estadoActual}
                      sx={{ bgcolor: a.estadoActual === 'Demorado' ? '#ffe0b2' : '#e3f2fd', color: a.estadoActual === 'Demorado' ? '#bf360c' : '#0d47a1', fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button size="small" onClick={() => void resolverAlerta(a, 'Reprogramar')} disabled={resolviendoId === a.paqueteId}>
                        Reprogramar
                      </Button>
                      <Button size="small" color="error" onClick={() => void resolverAlerta(a, 'Cancelar')} disabled={resolviendoId === a.paqueteId}>
                        Cancelar
                      </Button>
                      <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/shipment/${a.paqueteId}`)}>
                        Ver envio
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
