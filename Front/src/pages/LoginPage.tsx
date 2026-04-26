import { useEffect, useState, type ComponentType, type SyntheticEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  TextField,
  Button,
  Link,
  Typography,
  Card,
  Alert,
  CircularProgress,
  Divider,
  Stack,
  Chip,
  Snackbar,
} from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ReCAPTCHA from 'react-google-recaptcha'
import { authService } from '../services/authService'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import type { User, LoginCredentials } from '../types'

interface LoginPageProps {
  onLogin: (user: User) => void
  sessionExpired?: boolean
}

interface LoginLocationState {
  registrationSuccess?: boolean
  registeredEmail?: string
}

const DEMO_PASSWORD = 'kjkszpj1234'
const DEFAULT_RECAPTCHA_SITE_KEY = '6LdRraUsAAAAABDom6H8iyjAqSoigIn5qPgQXqfR'
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || DEFAULT_RECAPTCHA_SITE_KEY
const RecaptchaWidget = ReCAPTCHA as unknown as ComponentType<{
  sitekey: string
  onChange: (token: string | null) => void
  onExpired: () => void
}>
const demoUsers = [
  { label: 'Supervisor · Carlos', email: 'carlos.rodriguez@logitrack.com', color: 'error' as const },
  { label: 'Supervisor · Ana', email: 'ana.martinez@logitrack.com', color: 'error' as const },
  { label: 'Operador · Juan', email: 'juan.perez@logitrack.com', color: 'primary' as const },
  { label: 'Operador · Maria', email: 'maria.gomez@logitrack.com', color: 'primary' as const },
  { label: 'Transportista · Luis', email: 'luis.lopez@logitrack.com', color: 'success' as const },
  { label: 'Transportista · Sofia', email: 'sofia.fernandez@logitrack.com', color: 'success' as const },
]

function LoginPage({ onLogin, sessionExpired = false }: LoginPageProps) {
  const location = useLocation()
  const showDemoUsers = import.meta.env.VITE_SHOW_DEMO_USERS === 'true'
  const showAdminDemo = import.meta.env.VITE_ADMIN_DEMO === 'true' || import.meta.env.VITE_ADMIN_DEMO === '1'
  const navigate = useNavigate()
  const locationState = location.state as LoginLocationState | null
  const [credentials, setCredentials] = useState<Omit<LoginCredentials, 'recaptchaToken'>>({
    email: '',
    password: '',
  })
  const [captchaToken, setCaptchaToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [registrationToast, setRegistrationToast] = useState({
    open: false,
    message: '',
  })

  useEffect(() => {
    if (!locationState?.registrationSuccess) return

    const message = `Cuenta creada correctamente${locationState.registeredEmail ? ` para ${locationState.registeredEmail}` : ''}. Iniciá sesión para continuar.`
    setRegistrationToast({ open: true, message })

    // Limpiar el estado para no volver a mostrar el toast al regresar a /login.
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, locationState, navigate])

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

    if (!captchaToken) {
      setError('Completá el captcha para continuar')
      setLoading(false)
      return
    }

    try {
      const user = await authService.login({
        email: credentials.email,
        password: credentials.password,
        recaptchaToken: captchaToken,
      })

      if (user) {
        onLogin(user)
        navigate(user.role === 'transportista' ? '/transportista' : '/app')
      } else {
        setError('Email o contraseña incorrectos')
      }
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  const handleCaptchaChange = (token: string | null) => {
    setCaptchaToken(token ?? '')
    setError('')
  }

  const fillDemo = (email: string) => {
    setCredentials({ email, password: DEMO_PASSWORD })
    setError('')
  }

  const enterAsAdminDemo = () => {
    const adminDemo: User = {
      id: 'demo-admin-001',
      name: 'Admin',
      lastname: 'Demo',
      email: 'admin.demo@logitrack.com',
      dni: '00000000',
      role: 'administrador',
      estado: 'Activo',
    }
    onLogin(adminDemo)
    navigate('/app')
  }

  const handleRegistrationToastClose = (_event: Event | SyntheticEvent, reason?: string) => {
    if (reason === 'clickaway') return
    setRegistrationToast((prev) => ({ ...prev, open: false }))
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0D47A1 0%, #1565C0 40%, #1976d2 70%, #0277BD 100%)',
        px: 2,
        py: 4,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 420 }}>
        {/* Brand header above card */}
        <Box sx={{ textAlign: 'center', mb: 3, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
            <LocalShippingIcon sx={{ fontSize: 36 }} />
            <Typography variant="h4" fontWeight={800} sx={{ letterSpacing: '-0.5px' }}>
              LogiTrack
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ opacity: 0.8 }}>
            Sistema de Gestión de Envíos
          </Typography>
        </Box>

        <Card
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* Card title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LockOutlinedIcon sx={{ color: 'white', fontSize: 18 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>
              Iniciar sesión
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {!error && sessionExpired && (
            <Alert severity="warning" sx={{ mb: 2.5 }}>
              Tu sesión expiró por inactividad. Iniciá sesión nuevamente para continuar.
            </Alert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <Stack spacing={2.5}>
              <TextField
                label="Email"
                name="email"
                type="email"
                value={credentials.email}
                onChange={handleChange}
                placeholder="usuario@ejemplo.com"
                disabled={loading}
                fullWidth
                autoFocus
              />
              <TextField
                label="Contraseña"
                name="password"
                type="password"
                value={credentials.password}
                onChange={handleChange}
                disabled={loading}
                fullWidth
              />

              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box
                  sx={{
                    transform: { xs: 'scale(0.85)', sm: 'scale(1)' },
                    transformOrigin: 'center',
                    height: { xs: 66, sm: 78 },
                  }}
                >
                  <RecaptchaWidget
                    sitekey={RECAPTCHA_SITE_KEY}
                    onChange={handleCaptchaChange}
                    onExpired={() => setCaptchaToken('')}
                  />
                </Box>
              </Box>

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                fullWidth
                sx={{ mt: 0.5, minHeight: 48 }}
              >
                {loading ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CircularProgress size={20} color="inherit" />
                    Ingresando...
                  </Box>
                ) : (
                  'Ingresar'
                )}
              </Button>
            </Stack>
          </form>

          <Box sx={{ mt: 2.5, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              ¿No tenés cuenta?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/register')}
                sx={{ fontWeight: 600 }}
              >
                Registrate aquí
              </Link>
            </Typography>
          </Box>

          {showAdminDemo && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ my: 2 }}>
                <Typography variant="caption" color="text.disabled" fontWeight={600}>
                  DEV
                </Typography>
              </Divider>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                startIcon={<AdminPanelSettingsIcon />}
                onClick={enterAsAdminDemo}
                sx={{ fontWeight: 700, borderStyle: 'dashed' }}
              >
                Entrar como Administrador (demo)
              </Button>
            </Box>
          )}

          {/* Demo credentials */}
          {showDemoUsers && (
            <Box>
              <Divider sx={{ my: 3 }}>
                <Typography variant="caption" color="text.disabled" fontWeight={600}>
                  DEMO
                </Typography>
              </Divider>

              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5, textAlign: 'center' }}>
                Clic en un usuario para autocompletar · contraseña: <strong>{DEMO_PASSWORD}</strong>
              </Typography>

              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" useFlexGap>
                {demoUsers.map((demoUser) => (
                  <Chip
                    key={demoUser.email}
                    label={demoUser.label}
                    color={demoUser.color}
                    variant="outlined"
                    size="small"
                    onClick={() => fillDemo(demoUser.email)}
                    sx={{ cursor: 'pointer', fontWeight: 600 }}
                  />
                ))}
              </Stack>
            </Box>
          )}
        </Card>

        <Snackbar
          open={registrationToast.open}
          autoHideDuration={4500}
          onClose={handleRegistrationToastClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert
            severity="success"
            variant="filled"
            onClose={handleRegistrationToastClose}
            sx={{ width: '100%' }}
          >
            {registrationToast.message}
          </Alert>
        </Snackbar>
      </Box>
    </Box>
   ) 
  

}

export default LoginPage
