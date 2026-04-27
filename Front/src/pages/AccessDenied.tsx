import { useNavigate } from 'react-router-dom'
import { Box, Button, Card, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import type { User } from '../types'

interface AccessDeniedProps {
  user: User | null
}

function AccessDenied({ user }: AccessDeniedProps) {
  const navigate = useNavigate()

  const homeUrl = !user
    ? '/login'
    : user.role === 'repartidor'
    ? '/repartidor'
    : '/app'

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0D47A1 0%, #1565C0 40%, #1976d2 70%, #0277BD 100%)',
        px: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420, textAlign: 'center' }}>
        {/* Brand */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3, color: 'white' }}>
          <LocalShippingIcon sx={{ fontSize: 32 }} />
          <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.5px' }}>
            LogiTrack
          </Typography>
        </Box>

        <Card sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              bgcolor: '#FFEBEE',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <LockOutlinedIcon sx={{ fontSize: 36, color: 'error.main' }} />
          </Box>

          <Typography variant="h6" fontWeight={700} gutterBottom>
            Acceso denegado
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            No tenés permiso para acceder a esta sección.
            {user && (
              <>
                {' '}Tu rol actual es{' '}
                <strong>
                  {{
                    administrador: 'Administrador',
                    supervisor: 'Supervisor',
                    operador: 'Operador',
                    repartidor: 'Repartidor',
                  }[user.role] ?? user.role}
                </strong>
                .
              </>
            )}
          </Typography>

          <Button variant="contained" size="large" fullWidth onClick={() => navigate(homeUrl)}>
            Volver al inicio
          </Button>
        </Card>
      </Box>
    </Box>
  )
}

export default AccessDenied
