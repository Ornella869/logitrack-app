import { Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

type ShipmentStatus = 'En tránsito' | 'Entregado' | 'Cancelado' | 'Pendiente de calendarización' | 'Listo para salir'
type RouteStatus = 'Creada' | 'En Curso' | 'Finalizada' | 'Cancelada'

type StatusType = ShipmentStatus | RouteStatus

interface StatusBadgeProps {
  status: StatusType
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
}

const statusConfig: Record<StatusType, { label: string; color: string; bg: string }> = {
  // Shipment statuses
  'Pendiente de calendarización': { label: 'Pendiente de calendarización', color: '#7B5E00', bg: '#FFF3CD' },
  'Listo para salir': { label: 'Listo para salir', color: '#E65100', bg: '#FFF3E0' },
  'En tránsito': { label: 'En tránsito', color: '#0D47A1', bg: '#E3F2FD' },
  Entregado: { label: 'Entregado', color: '#1B5E20', bg: '#E8F5E9' },
  Cancelado: { label: 'Cancelado', color: '#7F0000', bg: '#FFEBEE' },
  // Route statuses
  Creada: { label: 'Creada', color: '#4A148C', bg: '#F3E5F5' },
  'En Curso': { label: 'En Curso', color: '#0D47A1', bg: '#E3F2FD' },
  Finalizada: { label: 'Finalizada', color: '#1B5E20', bg: '#E8F5E9' },
  Cancelada: { label: 'Cancelada', color: '#7F0000', bg: '#FFEBEE' },
}

export default function StatusBadge({ status, size = 'small', sx }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, color: '#333', bg: '#eee' }

  return (
    <Chip
      label={config.label}
      size={size}
      sx={{
        fontWeight: 600,
        color: config.color,
        backgroundColor: config.bg,
        border: `1px solid ${config.color}33`,
        borderRadius: 1,
        ...sx,
      }}
    />
  )
}
