import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import LockIcon from '@mui/icons-material/Lock'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { authService } from '../services/authService'

interface Props {
  open: boolean
  onClose: () => void
}

export default function ChangePasswordDialog({ open, onClose }: Props) {
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [showPass, setShowPass] = useState({ actual: false, nueva: false, confirmar: false })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleClose = () => {
    setForm({ actual: '', nueva: '', confirmar: '' })
    setShowPass({ actual: false, nueva: false, confirmar: false })
    setError('')
    setSubmitting(false)
    setSuccess(false)
    onClose()
  }

  const validate = () => {
    if (!form.actual || !form.nueva || !form.confirmar) {
      setError('Completá todos los campos.')
      return false
    }
    if (form.nueva.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.')
      return false
    }
    if (form.nueva !== form.confirmar) {
      setError('La nueva contraseña y la confirmación no coinciden.')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    const result = await authService.cambiarPassword(form.actual, form.nueva, form.confirmar)
    setSubmitting(false)
    if (result.success) {
      setSuccess(true)
    } else {
      setError(result.error ?? 'Error al cambiar la contraseña.')
    }
  }

  const togglePass = (field: 'actual' | 'nueva' | 'confirmar') => {
    setShowPass((p) => ({ ...p, [field]: !p[field] }))
  }

  const passwordsMatch = form.confirmar && form.nueva !== form.confirmar

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
        <LockIcon color="primary" />
        Cambiar contraseña
      </DialogTitle>

      <DialogContent dividers>
        {success ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              py: 2,
              textAlign: 'center',
            }}
          >
            <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56 }} />
            <Typography variant="body1" fontWeight={600}>
              Contraseña actualizada correctamente
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tu nueva contraseña ya está activa.
            </Typography>
          </Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Contraseña actual"
              type={showPass.actual ? 'text' : 'password'}
              value={form.actual}
              onChange={(e) => { setForm((p) => ({ ...p, actual: e.target.value })); setError('') }}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => togglePass('actual')} edge="end" size="small">
                      {showPass.actual ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Nueva contraseña"
              type={showPass.nueva ? 'text' : 'password'}
              value={form.nueva}
              onChange={(e) => { setForm((p) => ({ ...p, nueva: e.target.value })); setError('') }}
              fullWidth
              helperText="Mínimo 8 caracteres"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => togglePass('nueva')} edge="end" size="small">
                      {showPass.nueva ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Confirmar nueva contraseña"
              type={showPass.confirmar ? 'text' : 'password'}
              value={form.confirmar}
              onChange={(e) => { setForm((p) => ({ ...p, confirmar: e.target.value })); setError('') }}
              fullWidth
              error={!!passwordsMatch}
              helperText={passwordsMatch ? 'Las contraseñas no coinciden' : ''}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => togglePass('confirmar')} edge="end" size="small">
                      {showPass.confirmar ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
        {success ? (
          <Button onClick={handleClose} variant="contained" fullWidth>
            Cerrar
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={submitting} color="inherit">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={submitting || !!passwordsMatch}
              startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {submitting ? 'Guardando…' : 'Cambiar contraseña'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
