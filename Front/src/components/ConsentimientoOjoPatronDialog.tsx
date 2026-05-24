import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material'
import GavelIcon from '@mui/icons-material/Gavel'
import { ojoPatronService, type EstadoConsentimiento, type TextoLegal } from '../services/ojoPatronService'
import { formatInstantArgentina } from '../utils/argentinaDate'

interface Props {
  open: boolean
  // 'requerido' = el repartidor debe aceptar para continuar (no puede cerrar sin decidir).
  // 'gestion' = vista desde "Mi Perfil", puede ver estado y revocar/aceptar.
  modo: 'requerido' | 'gestion'
  onClose: () => void
  onAceptado?: () => void
}

// G1L-59: modal de consentimiento informado (Ley 25.326).
export default function ConsentimientoOjoPatronDialog({ open, modo, onClose, onAceptado }: Props) {
  const [legal, setLegal] = useState<TextoLegal | null>(null)
  const [estado, setEstado] = useState<EstadoConsentimiento | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!open) return
    void (async () => {
      setLoading(true)
      const [t, e] = await Promise.all([ojoPatronService.getTextoLegal(), ojoPatronService.getConsentimiento()])
      setLegal(t)
      setEstado(e)
      setLoading(false)
    })()
  }, [open])

  const handleAceptar = async () => {
    setWorking(true)
    const res = await ojoPatronService.aceptar()
    setWorking(false)
    if (res.success) {
      onAceptado?.()
      onClose()
    }
  }

  const handleRevocar = async () => {
    setWorking(true)
    await ojoPatronService.revocar()
    const e = await ojoPatronService.getConsentimiento()
    setEstado(e)
    setWorking(false)
  }

  return (
    <Dialog open={open} onClose={() => modo === 'gestion' && !working && onClose()} fullWidth maxWidth="sm">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GavelIcon color="primary" /> <span>Consentimiento — Ojo del Patrón</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {estado?.aceptado && (
              <Alert severity="success">
                Consentimiento vigente (v{estado.versionVigente})
                {estado.aceptadoEn ? ` · aceptado el ${formatInstantArgentina(estado.aceptadoEn)}` : ''}
              </Alert>
            )}
            {modo === 'requerido' && !estado?.aceptado && (
              <Alert severity="warning">
                Para iniciar la ruta necesitás aceptar el tratamiento de tus datos biométricos de voz.
              </Alert>
            )}
            <Chip label={`Versión del texto: ${legal?.version ?? '—'}`} size="small" sx={{ alignSelf: 'flex-start' }} />
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line', color: 'text.secondary' }}>
              {legal?.texto ?? 'No se pudo cargar el texto legal.'}
            </Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {modo === 'gestion' ? (
          <>
            {estado?.aceptado ? (
              <Button color="error" onClick={handleRevocar} disabled={working}>
                {working ? <CircularProgress size={18} /> : 'Revocar consentimiento'}
              </Button>
            ) : (
              <Button variant="contained" onClick={handleAceptar} disabled={working}>
                {working ? <CircularProgress size={18} color="inherit" /> : 'Aceptar'}
              </Button>
            )}
            <Button onClick={onClose} disabled={working}>Cerrar</Button>
          </>
        ) : (
          // Modo requerido: o acepta, o no continúa.
          <>
            <Button onClick={onClose} disabled={working} color="inherit">No aceptar</Button>
            <Button variant="contained" onClick={handleAceptar} disabled={working || loading || estado?.aceptado}>
              {working ? <CircularProgress size={18} color="inherit" /> : 'Acepto'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
