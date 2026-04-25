import { Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

type ShipmentStatus = 'En tránsito' | 'Entregado' | 'Cancelado' | 'Pendiente' | 'En sucursal' | 'Rechazado'
type RouteStatus = 'Creada' | 'En Curso' | 'Finalizada' | 'Cancelada'

type StatusType = ShipmentStatus | RouteStatus

interface StatusBadgeProps {
  status: StatusType
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
}

const statusConfig: Record<StatusType, { label: string; color: string; bg: string }> = {
  // Shipment statuses
  Pendiente: { label: 'Pendiente', color: '#7B5E00', bg: '#FFF3CD' },
  'En sucursal': { label: 'En sucursal', color: '#455A64', bg: '#ECEFF1' },
  'En tránsito': { label: 'En tránsito', color: '#0D47A1', bg: '#E3F2FD' },
  Entregado: { label: 'Entregado', color: '#1B5E20', bg: '#E8F5E9' },
  Cancelado: { label: 'Cancelado', color: '#7F0000', bg: '#FFEBEE' },
  Rechazado: { label: 'Rechazado', color: '#BF360C', bg: '#FBE9E7' },
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
