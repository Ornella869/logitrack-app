import { FormControl, InputLabel, MenuItem, Select, Skeleton, Typography } from '@mui/material'
import { useSucursalActiva } from '../hooks/useSucursalActiva'

interface GerenteSucursalSelectorProps {
  isDarkPremium: boolean
}

export default function GerenteSucursalSelector({ isDarkPremium }: GerenteSucursalSelectorProps) {
  const { sucursalActiva, sucursalesHabilitadas, loading, setSucursalActiva } = useSucursalActiva()

  if (!loading && sucursalesHabilitadas.length === 0) return null

  return (
    <FormControl
      size="small"
      fullWidth
      sx={{ mt: 0.5 }}
    >
      <InputLabel
        sx={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: isDarkPremium ? 'rgba(255,255,255,0.5)' : 'text.secondary',
          textTransform: 'uppercase',
        }}
      >
        Sucursal activa
      </InputLabel>
      {loading ? (
        <Skeleton variant="rounded" height={32} sx={{ mt: 2 }} />
      ) : (
        <Select
          value={sucursalActiva?.id ?? ''}
          label="Sucursal activa"
          onChange={(e) => void setSucursalActiva(e.target.value || null)}
          sx={{
            fontSize: 13,
            bgcolor: isDarkPremium ? 'rgba(255,255,255,0.06)' : 'action.hover',
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isDarkPremium ? 'rgba(255,255,255,0.15)' : undefined,
            },
          }}
          displayEmpty
          renderValue={(selected) => {
            if (!selected) return <Typography variant="caption" color="text.disabled">Sin seleccionar</Typography>
            const found = sucursalesHabilitadas.find((s) => s.id === selected)
            return found?.nombre ?? selected
          }}
        >
          <MenuItem value="">
            <Typography variant="body2" color="text.secondary">Sin seleccionar</Typography>
          </MenuItem>
          {sucursalesHabilitadas.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.nombre}
              {s.provincia ? (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                  ({s.provincia})
                </Typography>
              ) : null}
            </MenuItem>
          ))}
        </Select>
      )}
    </FormControl>
  )
}
