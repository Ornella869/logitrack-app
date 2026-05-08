import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import FilterAltIcon from '@mui/icons-material/FilterAlt'
import ClearAllIcon from '@mui/icons-material/ClearAll'

// G1L-40: Filtrado de Envíos por estado y rango de fechas

const STATUS_OPTIONS: { backendValue: string; label: string; color: string; bg: string }[] = [
  { backendValue: 'PendienteDeCalendarizacion', label: 'Pendiente de calendarización', color: '#e65100', bg: '#fff3e0' },
  { backendValue: 'AsignadoAVehiculo', label: 'Asignado a vehículo', color: '#1565c0', bg: '#e3f2fd' },
  { backendValue: 'CargadoEnVehiculo', label: 'Cargado en vehículo', color: '#1976d2', bg: '#e8f0fe' },
  { backendValue: 'ListoParaSalir', label: 'Listo para salir', color: '#00695c', bg: '#e0f2f1' },
  { backendValue: 'EnTransito', label: 'En tránsito', color: '#2e7d32', bg: '#e8f5e9' },
  { backendValue: 'Entregado', label: 'Entregado', color: '#1b5e20', bg: '#c8e6c9' },
  { backendValue: 'Cancelado', label: 'Cancelado', color: '#b71c1c', bg: '#fce4ec' },
]

export interface ShipmentFiltersValue {
  status: string[]
  from: string
  to: string
}

interface Props {
  value: ShipmentFiltersValue
  onChange: (value: ShipmentFiltersValue) => void
  onClear: () => void
}

export default function ShipmentFilters({ value, onChange, onClear }: Props) {
  const [expanded, setExpanded] = useState(false)
  const activeCount =
    value.status.length + (value.from ? 1 : 0) + (value.to ? 1 : 0)

  const handleStatusToggle = (_e: unknown, newStatus: string[]) => {
    onChange({ ...value, status: newStatus })
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: expanded ? 2 : 0 }}>
        <Button
          variant={expanded ? 'contained' : 'outlined'}
          size="small"
          startIcon={<FilterAltIcon />}
          onClick={() => setExpanded((v) => !v)}
        >
          Filtros{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
        {activeCount > 0 && (
          <Button
            variant="text"
            size="small"
            startIcon={<ClearAllIcon />}
            onClick={onClear}
          >
            Limpiar
          </Button>
        )}
      </Stack>

      {expanded && (
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Estado
          </Typography>
          <ToggleButtonGroup
            value={value.status}
            onChange={handleStatusToggle}
            size="small"
            sx={{ flexWrap: 'wrap', mb: 2, gap: 0.5, '& .MuiToggleButtonGroup-grouped': { borderRadius: '16px !important', border: '1px solid !important', mx: 0 } }}
          >
            {STATUS_OPTIONS.map((opt) => {
              const selected = value.status.includes(opt.backendValue)
              return (
                <ToggleButton
                  key={opt.backendValue}
                  value={opt.backendValue}
                  sx={{
                    textTransform: 'none',
                    px: 1.5,
                    py: 0.5,
                    fontSize: 12,
                    fontWeight: selected ? 700 : 400,
                    color: selected ? opt.color : 'text.secondary',
                    bgcolor: selected ? opt.bg : 'transparent',
                    borderColor: selected ? `${opt.color} !important` : 'divider !important',
                    '&:hover': { bgcolor: opt.bg, color: opt.color },
                    '&.Mui-selected': { bgcolor: opt.bg, color: opt.color },
                    '&.Mui-selected:hover': { bgcolor: opt.bg },
                  }}
                >
                  {opt.label}
                </ToggleButton>
              )
            })}
          </ToggleButtonGroup>

          <Typography variant="subtitle2" gutterBottom>
            Rango de fechas (creación)
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="date"
              label="Desde"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
            />
            <TextField
              type="date"
              label="Hasta"
              size="small"
              InputLabelProps={{ shrink: true }}
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
            />
          </Stack>

          {activeCount > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }} useFlexGap>
              {value.status.map((s) => {
                const opt = STATUS_OPTIONS.find((o) => o.backendValue === s)
                return (
                  <Chip
                    key={s}
                    label={opt?.label ?? s}
                    size="small"
                    onDelete={() =>
                      onChange({ ...value, status: value.status.filter((x) => x !== s) })
                    }
                    sx={opt ? { bgcolor: opt.bg, color: opt.color, borderColor: opt.color, border: '1px solid', fontWeight: 600 } : {}}
                  />
                )
              })}
              {value.from && (
                <Chip
                  label={`Desde ${value.from}`}
                  size="small"
                  onDelete={() => onChange({ ...value, from: '' })}
                />
              )}
              {value.to && (
                <Chip
                  label={`Hasta ${value.to}`}
                  size="small"
                  onDelete={() => onChange({ ...value, to: '' })}
                />
              )}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  )
}
