import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  Slider,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import VisibilityIcon from '@mui/icons-material/Visibility'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import { ojoPatronService } from '../services/ojoPatronService'
import type { User } from '../types'
import OjoPatronSupervisorPanel from './OjoPatronSupervisorPanel'

export default function OjoPatronConfigPage() {
  const user = useOutletContext<User>()
  // Ruta gateada por permiso 'ojo_patron'. El Supervisor ve su panel; Gerente/Operador (con permiso
  // concedido) y Admin ven la configuración de umbral provincial.

  const [umbral, setUmbral] = useState(0.4)
  const [activo, setActivo] = useState(true)
  const [provincia, setProvincia] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ sev: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (user.role === 'supervisor') {
      setLoading(false)
      return
    }
    void (async () => {
      const c = await ojoPatronService.getConfiguracion()
      if (c) {
        setUmbral(c.umbralAlertness)
        setActivo(c.activo)
        setProvincia(c.provincia)
      }
      setLoading(false)
    })()
  }, [user.role])

  const handleSave = async () => {
    setSaving(true)
    const res = await ojoPatronService.actualizarConfiguracion(umbral, activo)
    setSaving(false)
    setMsg(res.success
      ? {
          sev: 'success',
          text: activo
            ? 'Ojo del Patron activo. La configuracion aplica a las proximas rutas.'
            : 'Ojo del Patron desactivado. Los repartidores podran iniciar ruta sin prueba acustica.',
        }
      : { sev: 'error', text: res.error ?? 'Error al guardar' })
  }

  if (user.role === 'supervisor') return <OjoPatronSupervisorPanel />
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>Ojo del Patron</Typography>
          <Typography variant="body2" color="text.secondary">
            Control operativo de la prueba acustica para {provincia || 'tu provincia'}.
          </Typography>
        </Box>
        <Chip
          icon={activo ? <GraphicEqIcon /> : <PowerSettingsNewIcon />}
          label={activo ? 'Activo' : 'Desactivado'}
          color={activo ? 'success' : 'default'}
          variant={activo ? 'filled' : 'outlined'}
          sx={{ fontWeight: 700 }}
        />
      </Stack>

      <Card variant="outlined" sx={{ maxWidth: 760, mb: 2, borderLeft: '5px solid', borderLeftColor: activo ? 'success.main' : 'warning.main' }}>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
            <Box>
              <Typography variant="h6" fontWeight={800}>Control maestro</Typography>
              <Typography variant="body2" color="text.secondary">
                {activo
                  ? 'La prueba acustica se exige al iniciar ruta y a mitad de recorrido cuando corresponde.'
                  : 'La prueba queda suspendida para la provincia. El backend libera consentimiento, inicio y mitad de ruta.'}
              </Typography>
            </Box>
            <FormControlLabel
              control={<Switch checked={activo} onChange={(e) => setActivo(e.target.checked)} color="success" />}
              label={activo ? 'Exigir prueba' : 'No exigir prueba'}
              sx={{ m: 0, '& .MuiFormControlLabel-label': { fontWeight: 700 } }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ maxWidth: 760 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6" fontWeight={800}>Umbral de activacion vocal</Typography>
            <Typography variant="h5" fontWeight={900} color={activo ? 'primary.main' : 'text.disabled'}>
              {umbral.toFixed(2)}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Valor entre 0 y 1. La prueba se aprueba cuando el score supera este umbral.
            El score combina energia de voz (60%) y aptitud emocional, neutral + alegria (40%).
            Un valor mas alto es mas exigente.
          </Typography>

          <Slider
            value={umbral}
            onChange={(_, v) => setUmbral(v as number)}
            min={0}
            max={1}
            step={0.05}
            marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
            valueLabelDisplay="auto"
            disabled={!activo}
            sx={{ mt: 3 }}
          />

          <Divider sx={{ my: 2 }} />

          <Alert severity={activo ? 'info' : 'warning'}>
            {activo
              ? 'Al guardar, los repartidores deberan tener consentimiento vigente y prueba aprobada para iniciar la proxima ruta.'
              : 'Mientras este desactivado, los repartidores podran iniciar rutas sin pasar por consentimiento ni prueba acustica.'}
          </Alert>

          {msg && <Alert severity={msg.sev} sx={{ mt: 2 }}>{msg.text}</Alert>}

          <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              Guardar configuracion
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon fontSize="inherit" /> El historial de pruebas se ve en Auditoria.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
