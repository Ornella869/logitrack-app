import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  TextField,
  Button,
  IconButton,
  Link,
  Typography,
  Card,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Chip,
} from '@mui/material'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import { authService } from '../services/authService'
import type { User, LoginCredentials } from '../types'
import ForgotPasswordDialog from '../components/ForgotPasswordDialog'
import { isRepartidorRole } from '../utils/roleUtils'

interface LoginPageProps {
  onLogin: (user: User) => void
  sessionExpired?: boolean
}

interface LoginLocationState {
  registrationDisabled?: boolean
}

const DEMO_PASSWORD = 'kjkszpj1234'

const demoUsers = [
  { label: 'Gerente · Buenos Aires', email: 'gerente.bsas@logitrack.com', color: 'warning' as const },
  { label: 'Supervisor · Carlos', email: 'carlos.rodriguez@logitrack.com', color: 'error' as const },
  { label: 'Supervisor · Ana', email: 'ana.martinez@logitrack.com', color: 'error' as const },
  { label: 'Operador · Juan', email: 'juan.perez@logitrack.com', color: 'primary' as const },
  { label: 'Operador · Maria', email: 'maria.gomez@logitrack.com', color: 'primary' as const },
  { label: 'Repartidor · Luis', email: 'luis.lopez@logitrack.com', color: 'success' as const },
  { label: 'Repartidor · Sofia', email: 'sofia.fernandez@logitrack.com', color: 'success' as const },
]

const darkCardTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#4FC3F7' },
    background: { paper: 'transparent' },
  },
  components: {
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
          '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
        },
        input: { color: 'rgba(255,255,255,0.9)' },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { color: 'rgba(255,255,255,0.5)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: 'linear-gradient(135deg, #0288D1 0%, #7C4DFF 100%)',
          color: '#fff',
          fontWeight: 800,
          letterSpacing: '0.04em',
          boxShadow: '0 0 18px rgba(0,229,255,0.3), 0 0 36px rgba(124,77,255,0.18)',
          transition: 'all 0.3s ease',
          '&:hover': {
            background: 'linear-gradient(135deg, #29B6F6 0%, #B388FF 100%)',
            boxShadow: '0 0 26px rgba(0,229,255,0.5), 0 0 52px rgba(124,77,255,0.3)',
            transform: 'translateY(-2px)',
          },
        },
      },
    },
  },
})

function AnimatedBrand() {
  return (
    <Box sx={{ textAlign: 'center', mb: 3.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 0.5 }}>
        {/* Camion animado */}
        <Box
          sx={{
            animation: 'truckSlideIn 1s cubic-bezier(0.34,1.56,0.64,1) forwards',
            '@keyframes truckSlideIn': {
              '0%': { transform: 'translateX(-70px)', opacity: 0 },
              '65%': { transform: 'translateX(5px)', opacity: 1 },
              '100%': { transform: 'translateX(0)', opacity: 1 },
            },
          }}
        >
          <LocalShippingRoundedIcon sx={{ fontSize: 48, color: '#fff' }} />
        </Box>
        {/* Letras que aparecen una por una */}
        <Box sx={{ display: 'flex', overflow: 'visible' }}>
          {'LogiTrack'.split('').map((letra, i) => (
            <Typography
              key={i}
              component="span"
              sx={{
                fontSize: { xs: '1.9rem', sm: '2.1rem' },
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '-0.5px',
                lineHeight: 1,
                opacity: 0,
                display: 'inline-block',
                animation: 'letraAparecer 0.35s ease forwards',
                animationDelay: `${0.75 + i * 0.065}s`,
                '@keyframes letraAparecer': {
                  '0%': { opacity: 0, transform: 'translateY(10px)' },
                  '100%': { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              {letra}
            </Typography>
          ))}
        </Box>
      </Box>
      <Typography
        variant="body2"
        sx={{
          color: 'rgba(255,255,255,0)',
          animation: 'subtituloFade 0.6s ease forwards',
          animationDelay: '1.6s',
          '@keyframes subtituloFade': {
            to: { color: 'rgba(255,255,255,0.55)' },
          },
        }}
      >
        Sistema de Gestión de Envíos
      </Typography>
    </Box>
  )
}

function LoginPage({ onLogin, sessionExpired = false }: LoginPageProps) {
  const showDemoUsers = import.meta.env.VITE_SHOW_DEMO_USERS === 'true'
  const showAdminDemo = import.meta.env.VITE_ADMIN_DEMO === 'true' || import.meta.env.VITE_ADMIN_DEMO === '1'
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as LoginLocationState | null
  const [credentials, setCredentials] = useState<Omit<LoginCredentials, 'recaptchaToken'>>({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCredentials((prev) => ({ ...prev, [name]: value }))
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!credentials.email || !credentials.password) {
      setError('Por favor completá todos los campos')
      setLoading(false)
      return
    }

    if (!authService.isValidEmail(credentials.email)) {
      setError('El email no tiene un formato válido')
      setLoading(false)
      return
    }

    try {
      const user = await authService.login({ email: credentials.email, password: credentials.password, recaptchaToken: '' })
      if (user) {
        onLogin(user)
        navigate(isRepartidorRole(user.role) ? '/repartidor' : user.role === 'cliente' ? '/cliente' : user.role === 'socio_pickup' ? '/pickup-operacion' : '/app')
      } else {
        setError('Email o contraseña incorrectos')
      }
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (email: string) => {
    setCredentials({ email, password: DEMO_PASSWORD })
    setError('')
  }

  const handleGoBack = () => {
    if (window.history.length > 1) { navigate(-1); return }
    navigate('/')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #021828 0%, #042B50 30%, #073D7A 65%, #0D5299 100%)',
        position: 'relative',
        overflow: 'hidden',
        px: 2,
        py: 4,
      }}
    >
      {/* Blobs decorativos azul profundo */}
      {[
        { s: 500, top: '-18%', left: '-12%', color: 'rgba(2,60,130,0.3)', d: 22, dl: 0 },
        { s: 360, top: '55%', right: '-8%', color: 'rgba(13,82,153,0.2)', d: 17, dl: 3 },
        { s: 260, top: '12%', right: '10%', color: 'rgba(7,61,122,0.22)', d: 14, dl: 6 },
        { s: 180, top: '40%', left: '6%', color: 'rgba(14,100,180,0.14)', d: 19, dl: 9 },
      ].map((b, i) => (
        <Box key={i} sx={{
          position: 'absolute',
          borderRadius: '50%',
          width: b.s, height: b.s,
          top: b.top,
          left: (b as any).left,
          right: (b as any).right,
          background: b.color,
          filter: 'blur(60px)',
          animation: `loginBlob${i} ${b.d}s ease-in-out ${b.dl}s infinite`,
          [`@keyframes loginBlob${i}`]: {
            '0%,100%': { transform: 'scale(1) translate(0,0)' },
            '33%': { transform: 'scale(1.08) translate(14px,-20px)' },
            '66%': { transform: 'scale(0.94) translate(-10px,14px)' },
          },
        }} />
      ))}

      <Box sx={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
        <AnimatedBrand />

        <ThemeProvider theme={darkCardTheme}>
          <Card
            sx={{
              p: { xs: 3, sm: 4 },
              borderRadius: 3,
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 30px 70px rgba(0,0,0,0.55)',
            }}
          >
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', mb: 3 }}>
              <Box sx={{ justifySelf: 'start' }}>
                <IconButton
                  aria-label="Volver"
                  onClick={handleGoBack}
                  size="small"
                  sx={{ width: 36, height: 36, borderRadius: 2, color: 'rgba(255,255,255,0.6)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}
                >
                  <ArrowBackIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifySelf: 'center' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, background: 'linear-gradient(135deg,#0288D1,#29B6F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(2,136,209,0.4)' }}>
                  <LockOutlinedIcon sx={{ color: 'white', fontSize: 18 }} />
                </Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Iniciar sesión
                </Typography>
              </Box>
              <Box />
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError('')}>{error}</Alert>}
            {!error && sessionExpired && <Alert severity="warning" sx={{ mb: 2.5 }}>Tu sesión expiró por inactividad. Iniciá sesión nuevamente para continuar.</Alert>}
            {!error && locationState?.registrationDisabled && <Alert severity="info" sx={{ mb: 2.5 }}>El alta de cuentas se gestiona por el equipo comercial. Si necesitás acceso, comunicate con nosotros desde la web.</Alert>}

            <form onSubmit={handleSubmit} noValidate>
              <Stack spacing={2.5}>
                <TextField label="Email" name="email" type="email" value={credentials.email} onChange={handleChange} placeholder="usuario@ejemplo.com" disabled={loading} fullWidth autoFocus />
                <TextField label="Contraseña" name="password" type="password" value={credentials.password} onChange={handleChange} disabled={loading} fullWidth />
                <Button type="submit" variant="contained" color="primary" size="large" disabled={loading} fullWidth sx={{ mt: 0.5, minHeight: 48 }}>
                  {loading ? <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><CircularProgress size={20} color="inherit" />Ingresando...</Box> : 'Ingresar'}
                </Button>
              </Stack>
            </form>

            <Box sx={{ mt: 2.5, textAlign: 'center' }}>
              <Typography variant="body2">
                <Link component="button" variant="body2" onClick={() => setShowForgotPassword(true)} sx={{ fontWeight: 600, color: '#4FC3F7' }}>
                  ¿Olvidaste tu contraseña?
                </Link>
              </Typography>
            </Box>

            {showAdminDemo && (
              <Box sx={{ mt: 2 }}>
                <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>DEV</Typography>
                </Divider>
                <Button fullWidth variant="outlined" color="secondary" startIcon={<AdminPanelSettingsIcon />} onClick={() => fillDemo('admin@logitrack.com')} sx={{ fontWeight: 700, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}>
                  Entrar como Administrador (demo)
                </Button>
              </Box>
            )}

            {showDemoUsers && (
              <Box>
                <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>DEMO</Typography>
                </Divider>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mb: 1.5, textAlign: 'center' }}>
                  Clic en un usuario para autocompletar · contraseña: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{DEMO_PASSWORD}</strong>
                </Typography>
                <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                  {demoUsers.map((demoUser) => (
                    <Chip key={demoUser.email} label={demoUser.label} color={demoUser.color} variant="outlined" size="small" onClick={() => fillDemo(demoUser.email)} sx={{ cursor: 'pointer', fontWeight: 600 }} />
                  ))}
                </Stack>
              </Box>
            )}
          </Card>
        </ThemeProvider>

        <ForgotPasswordDialog open={showForgotPassword} onClose={() => setShowForgotPassword(false)} />
      </Box>
    </Box>
  )
}

export default LoginPage
