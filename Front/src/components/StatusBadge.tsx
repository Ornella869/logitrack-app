import { Chip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

type ShipmentStatus = 'En transito' | 'Entregado' | 'Cancelado' | 'Pendiente de calendarizacion' | 'Listo para salir' | 'Asignado a vehiculo' | 'Cargado en vehiculo' | 'Demorado' | 'Listo para retirar'
type RouteStatus = 'Creada' | 'En Curso' | 'Finalizada' | 'Cancelada'

type StatusType = ShipmentStatus | RouteStatus | string

interface StatusBadgeProps {
  status: StatusType
  size?: 'small' | 'medium'
  sx?: SxProps<Theme>
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  'Pendiente de calendarizacion': { label: 'Pendiente de calendarizacion', color: '#7B5E00', bg: '#FFF3CD' },
  'Pendiente de calendarización': { label: 'Pendiente de calendarización', color: '#7B5E00', bg: '#FFF3CD' },
  'Asignado a vehiculo': { label: 'Asignado a vehiculo', color: '#4527A0', bg: '#EDE7F6' },
  'Asignado a vehículo': { label: 'Asignado a vehículo', color: '#4527A0', bg: '#EDE7F6' },
  'Cargado en vehiculo': { label: 'Cargado en vehiculo', color: '#311B92', bg: '#D1C4E9' },
  'Cargado en vehículo': { label: 'Cargado en vehículo', color: '#311B92', bg: '#D1C4E9' },
  'Listo para salir': { label: 'Listo para salir', color: '#E65100', bg: '#FFF3E0' },
  'Listo para retirar': { label: 'Listo para retirar', color: '#00695C', bg: '#E0F2F1' },
  'En transito': { label: 'En transito', color: '#0D47A1', bg: '#E3F2FD' },
  'En tránsito': { label: 'En tránsito', color: '#0D47A1', bg: '#E3F2FD' },
  Demorado: { label: 'Demorado', color: '#BF360C', bg: '#FFE0B2' },
  Entregado: { label: 'Entregado', color: '#1B5E20', bg: '#E8F5E9' },
  Cancelado: { label: 'Cancelado', color: '#7F0000', bg: '#FFEBEE' },
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
