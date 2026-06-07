import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'

interface Props {
  open: boolean
  submitting?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmPasswordChangeDialog({
  open,
  submitting = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onClose={submitting ? undefined : onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Confirmar cambio de contraseña</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Si confirmás, tu contraseña se actualizará inmediatamente.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Después se cerrará tu sesión actual y vas a ser redirigido al login para volver a ingresar.
        </Typography>
        <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>
          ¿Querés continuar?
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel} disabled={submitting} color="inherit">
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={submitting} variant="contained" color="warning">
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
