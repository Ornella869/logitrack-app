import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Slider,
  Stack,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { ojoPatronService } from '../services/ojoPatronService'
import type { User } from '../types'

// G1L-61: configuración del umbral del Ojo del Patrón (Administrador).
export default function OjoPatronConfigPage() {
  const user = useOutletContext<User>()
  const isAdmin = user.role === 'gerente'

  const [umbral, setUmbral] = useState(0.4)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ sev: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    void (async () => {
      const c = await ojoPatronService.getConfiguracion()
      if (c) setUmbral(c.umbralAlertness)
      setLoading(false)
    })()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const res = await ojoPatronService.actualizarConfiguracion(umbral)
    setSaving(false)
    setMsg(res.success
      ? { sev: 'success', text: 'Umbral actualizado. Aplica a las pruebas posteriores.' }
      : { sev: 'error', text: res.error ?? 'Error al guardar' })
  }

  if (!isAdmin) return <Alert severity="warning">Solo el Gerente.</Alert>
  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>Ojo del Patrón</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configurá el umbral de activación vocal requerido para aprobar la prueba acústica de inicio de ruta.
      </Typography>

      <Card variant="outlined" sx={{ maxWidth: 560 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Umbral de activación vocal</Typography>
          <Typography variant="caption" color="text.secondary">
            Valor entre 0 y 1. La prueba se aprueba cuando el score supera este umbral.
            El score combina energía de voz (60%) y aptitud emocional —neutral + alegría— (40%).
            Un valor más alto es más exigente.
          </Typography>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
            <Slider
              value={umbral}
              onChange={(_, v) => setUmbral(v as number)}
              min={0} max={1} step={0.05}
              marks={[{ value: 0, label: '0' }, { value: 0.5, label: '0.5' }, { value: 1, label: '1' }]}
              valueLabelDisplay="auto"
            />
            <Typography variant="h5" fontWeight={700} sx={{ minWidth: 56, textAlign: 'right' }}>
              {umbral.toFixed(2)}
            </Typography>
          </Stack>

          {msg && <Alert severity={msg.sev} sx={{ mt: 2 }}>{msg.text}</Alert>}

          <Stack direction="row" spacing={1} sx={{ mt: 2 }} alignItems="center">
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              onClick={handleSave}
              disabled={saving}
            >
              Guardar umbral
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <VisibilityIcon fontSize="inherit" /> El historial de pruebas se ve en Auditoría (acción "Prueba Ojo del Patrón").
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  )
}
