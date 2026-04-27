import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material'
import HistoryEduIcon from '@mui/icons-material/HistoryEdu'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import SettingsIcon from '@mui/icons-material/Settings'
import { shipmentService, type HistorialEstadoEnvio } from '../services/shipmentService'

// G1L-15: Línea de tiempo del historial de estados.
// Cronológica descendente (lo más reciente arriba), color/ícono por estado y origen.

interface Props {
  paqueteId: string
}

const STATUS_COLOR: Record<string, string> = {
  PendienteDeCalendarizacion: '#9E9E9E',
  ListoParaSalir: '#FFA000',
  EnTransito: '#1976D2',
  Entregado: '#2E7D32',
  Cancelado: '#C62828',
}

const STATUS_LABEL: Record<string, string> = {
  PendienteDeCalendarizacion: 'Pendiente de calendarización',
  ListoParaSalir: 'Listo para salir',
  EnTransito: 'En tránsito',
  Entregado: 'Entregado',
  Cancelado: 'Cancelado',
}

function originIcon(origen: HistorialEstadoEnvio['origen']) {
  if (origen === 'QR') return <QrCodeScannerIcon fontSize="small" />
  if (origen === 'Sistema') return <SettingsIcon fontSize="small" />
  return <HistoryEduIcon fontSize="small" />
}

export default function ShipmentTimeline({ paqueteId }: Props) {
  const [items, setItems] = useState<HistorialEstadoEnvio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const data = await shipmentService.getHistorial(paqueteId)
        setItems(data)
      } catch {
        setError('No se pudo cargar el historial')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [paqueteId])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="warning">{error}</Alert>
  }

  if (items.length === 0) {
    return <Alert severity="info">Aún no hay cambios de estado registrados.</Alert>
  }

  return (
    <Stack spacing={2}>
      {items.map((item, idx) => {
        const color = STATUS_COLOR[item.estadoNuevo] ?? '#757575'
        const label = STATUS_LABEL[item.estadoNuevo] ?? item.estadoNuevo
        const date = new Date(item.fechaHora)
        const dateStr = isNaN(date.getTime())
          ? item.fechaHora
          : date.toLocaleString('es-AR')
        return (
          <Box key={item.id} sx={{ display: 'flex', gap: 2 }}>
            {/* Ícono y línea conectora */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: color,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {originIcon(item.origen)}
              </Box>
              {idx < items.length - 1 && (
                <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', minHeight: 24, mt: 0.5 }} />
              )}
            </Box>

            {/* Contenido */}
            <Box sx={{ flex: 1, pb: 2 }}>
              <Typography variant="subtitle2" sx={{ color, fontWeight: 700 }}>
                {label}
              </Typography>
              <Typography variant="caption" color="textSecondary" display="block">
                {dateStr} · {item.origen === 'QR' ? 'Escaneo QR' : item.origen}
              </Typography>
              {item.motivo && (
                <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                  Motivo: {item.motivo}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Stack>
  )
}
