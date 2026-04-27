import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Box,
  CircularProgress,
} from '@mui/material'
import LockResetIcon from '@mui/icons-material/LockReset'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'

interface ForgotPasswordDialogProps {
  open: boolean
  onClose: () => void
}

interface PasswordResetRequest {
  email: string
  requestedAt: string
  status: 'pending'
}

function ForgotPasswordDialog({ open, onClose }: ForgotPasswordDialogProps) {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const handleClose = () => {
    setEmail('')
    setEmailError('')
    setSubmitted(false)
    setLoading(false)
    onClose()
  }

  const handleSubmit = () => {
    if (!email.trim()) {
      setEmailError('El email es obligatorio')
      return
    }
    if (!isValidEmail(email)) {
      setEmailError('El email no tiene un formato válido')
      return
    }

    setLoading(true)

    // Guardar la solicitud en localStorage para que el administrador la vea
    const existing: PasswordResetRequest[] = JSON.parse(
      localStorage.getItem('passwordResetRequests') || '[]'
    )

    const alreadyExists = existing.some(
      (r) => r.email.toLowerCase() === email.toLowerCase()
    )

    if (!alreadyExists) {
      const newRequest: PasswordResetRequest = {
        email: email.toLowerCase().trim(),
        requestedAt: new Date().toISOString(),
        status: 'pending',
      }
      localStorage.setItem(
        'passwordResetRequests',
        JSON.stringify([...existing, newRequest])
      )
    }

    // Simulamos un pequeño delay para dar sensación de proceso
    setTimeout(() => {
      setLoading(false)
      setSubmitted(true)
    }, 800)
  }

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : handleClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LockResetIcon color="primary" />
          <Typography variant="h6" fontWeight={700}>
            ¿Olvidaste tu contraseña?
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {!submitted ? (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Ingresá tu email y le avisaremos al administrador para que te
              asigne una contraseña temporal.
            </Typography>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError('')
              }}
              error={!!emailError}
              helperText={emailError}
              disabled={loading}
              fullWidth
              autoFocus
              placeholder="usuario@ejemplo.com"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit()
              }}
            />
          </Box>
        ) : (
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
            <Alert severity="success" sx={{ width: '100%' }}>
              <Typography variant="body2" fontWeight={600}>
                Solicitud enviada correctamente
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                El administrador fue notificado. Te contactarán a{' '}
                <strong>{email}</strong> para asignarte una contraseña temporal.
              </Typography>
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        {!submitted ? (
          <>
            <Button onClick={handleClose} disabled={loading} color="inherit">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              variant="contained"
              disabled={loading}
              startIcon={
                loading ? <CircularProgress size={16} color="inherit" /> : undefined
              }
            >
              {loading ? 'Enviando...' : 'Notificar al administrador'}
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} variant="contained" fullWidth>
            Cerrar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default ForgotPasswordDialog
