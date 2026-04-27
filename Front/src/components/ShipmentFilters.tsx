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

const STATUS_OPTIONS: { backendValue: string; label: string }[] = [
  { backendValue: 'PendienteDeCalendarizacion', label: 'Pendiente de calendarización' },
  { backendValue: 'ListoParaSalir', label: 'Listo para salir' },
  { backendValue: 'EnTransito', label: 'En tránsito' },
  { backendValue: 'Entregado', label: 'Entregado' },
  { backendValue: 'Cancelado', label: 'Cancelado' },
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
            sx={{ flexWrap: 'wrap', mb: 2 }}
          >
            {STATUS_OPTIONS.map((opt) => (
              <ToggleButton key={opt.backendValue} value={opt.backendValue} sx={{ textTransform: 'none' }}>
                {opt.label}
              </ToggleButton>
            ))}
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
