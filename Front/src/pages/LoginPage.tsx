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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
// import ReCAPTCHA from 'react-google-recaptcha'
import { authService } from '../services/authService'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
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
// Captcha temporalmente deshabilitado para testing
// const DEFAULT_RECAPTCHA_SITE_KEY = '6LdRraUsAAAAABDom6H8iyjAqSoigIn5qPgQXqfR'
// const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || DEFAULT_RECAPTCHA_SITE_KEY
// const RecaptchaWidget = ReCAPTCHA as unknown as ComponentType<{
//   sitekey: string
//   onChange: (token: string | null) => void
//   onExpired: () => void
// }>
const demoUsers = [
  { label: 'Gerente · Buenos Aires', email: 'gerente.bsas@logitrack.com', color: 'warning' as const },
  { label: 'Supervisor · Carlos', email: 'carlos.rodriguez@logitrack.com', color: 'error' as const },
  { label: 'Supervisor · Ana', email: 'ana.martinez@logitrack.com', color: 'error' as const },
  { label: 'Operador · Juan', email: 'juan.perez@logitrack.com', color: 'primary' as const },
  { label: 'Operador · Maria', email: 'maria.gomez@logitrack.com', color: 'primary' as const },
  { label: 'Repartidor · Luis', email: 'luis.lopez@logitrack.com', color: 'success' as const },
  { label: 'Repartidor · Sofia', email: 'sofia.fernandez@logitrack.com', color: 'success' as const },
]

function LoginPage({ onLogin, sessionExpired = false }: LoginPageProps) {
  const showDemoUsers = import.meta.env.VITE_SHOW_DEMO_USERS === 'true'
  const showAdminDemo = import.meta.env.VITE_ADMIN_DEMO === 'true' || import.meta.env.VITE_ADMIN_DEMO === '1'
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as LoginLocationState | null
  const [credentials, setCredentials] = useState<Omit<LoginCredentials, 'recaptchaToken'>>({
    email: '',
    password: '',
  })
  const [captchaToken] = useState('')
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

    // Captcha temporalmente deshabilitado para testing
    // if (!captchaToken) {
    //   setError('Completá el captcha para continuar')
    //   setLoading(false)
    //   return
    // }

    try {
      const user = await authService.login({
        email: credentials.email,
        password: credentials.password,
        recaptchaToken: captchaToken,
      })

      if (user) {
        onLogin(user)
        navigate(isRepartidorRole(user.role) ? '/repartidor' : user.role === 'cliente' ? '/cliente' : '/app')
      } else {
        setError('Email o contraseña incorrectos')
      }
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  // Captcha temporalmente deshabilitado para testing
  // const handleCaptchaChange = (token: string | null) => {
  //   setCaptchaToken(token ?? '')
  //   setError('')
  // }

  const fillDemo = (email: string) => {
    setCredentials({ email, password: DEMO_PASSWORD })
    setError('')
  }

  const enterAsAdminDemo = () => {
    fillDemo('admin@logitrack.com')
  }

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0D47A1 0%, #1565C0 40%, #1976d2 70%, #0277BD 100%)',
        position: 'relative',
        overflow: 'hidden',
        px: 2,
        py: 4,
      }}
    >
      {/* ── Red de sucursales animada (estilo landing) ── */}
      <Box sx={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>

        {/* Blobs flotantes */}
        {[
          { s: 480, top: '-15%', left: '-10%', d: 20, dl: 0 },
          { s: 320, top: '55%', right: '-6%', d: 16, dl: 4 },
          { s: 220, top: '20%', right: '18%', d: 12, dl: 7 },
        ].map((b, i) => (
          <Box key={i} sx={{
            position: 'absolute',
            borderRadius: '50%',
            width: b.s, height: b.s,
            top: b.top,
            left: (b as any).left,
            right: (b as any).right,
            background: 'rgba(255,255,255,0.05)',
            animation: `loginBlob${i} ${b.d}s ease-in-out ${b.dl}s infinite`,
            [`@keyframes loginBlob${i}`]: {
              '0%,100%': { transform: 'scale(1) translate(0,0)' },
              '33%': { transform: 'scale(1.07) translate(12px,-18px)' },
              '66%': { transform: 'scale(0.96) translate(-8px,12px)' },
            },
          }} />
        ))}

        {/* Camión decorativo flat — rebota suavemente simulando ruta */}
        <Box sx={{
          position: 'absolute',
          bottom: '-18px',
          left: '-24px',
          width: { xs: '90vw', sm: '62vw', md: '52vw' },
          opacity: 0.12,
          animation: 'truckRide 2.8s ease-in-out infinite',
          '@keyframes truckRide': {
            '0%,100%': { transform: 'translateY(0px)' },
            '50%':     { transform: 'translateY(-5px)' },
          },
        }}>
          <svg viewBox="0 0 480 195" xmlns="http://www.w3.org/2000/svg" width="100%">
            <circle cx="82"  cy="162" r="27" fill="rgba(255,255,255,0.22)"/>
            <circle cx="82"  cy="162" r="18" fill="rgba(255,255,255,0.45)"/>
            <circle cx="82"  cy="162" r="7"  fill="rgba(255,255,255,0.7)"/>
            <circle cx="192" cy="162" r="27" fill="rgba(255,255,255,0.22)"/>
            <circle cx="192" cy="162" r="18" fill="rgba(255,255,255,0.45)"/>
            <circle cx="192" cy="162" r="7"  fill="rgba(255,255,255,0.7)"/>
            <circle cx="378" cy="162" r="27" fill="rgba(255,255,255,0.22)"/>
            <circle cx="378" cy="162" r="18" fill="rgba(255,255,255,0.45)"/>
            <circle cx="378" cy="162" r="7"  fill="rgba(255,255,255,0.7)"/>
            <circle cx="444" cy="162" r="27" fill="rgba(255,255,255,0.22)"/>
            <circle cx="444" cy="162" r="18" fill="rgba(255,255,255,0.45)"/>
            <circle cx="444" cy="162" r="7"  fill="rgba(255,255,255,0.7)"/>
            <rect x="6" y="136" width="456" height="9" rx="3" fill="white"/>
            <rect x="8" y="20" width="298" height="118" rx="5" fill="white"/>
            <rect x="8" y="20" width="298" height="17" rx="5" fill="rgba(0,0,50,0.13)"/>
            <rect x="8" y="20" width="5" height="118" rx="2" fill="rgba(0,0,50,0.18)"/>
            <text x="158" y="96" textAnchor="middle"
              fontFamily="'Arial Black','Arial',sans-serif"
              fontWeight="900" fontSize="27" letterSpacing="2"
              fill="rgba(0,20,80,0.38)">LogiTrack</text>
            <rect x="303" y="122" width="12" height="12" rx="2" fill="rgba(255,255,255,0.6)"/>
            <path d="M 316 42 L 368 16 L 452 16 L 452 42 Z" fill="white"/>
            <path d="M 323 41 L 366 18 L 449 18 L 449 41 Z" fill="rgba(180,230,255,0.5)"/>
            <rect x="316" y="42" width="136" height="96" rx="5" fill="white"/>
            <rect x="340" y="50" width="60" height="54" rx="4" fill="rgba(180,230,255,0.5)"/>
            <line x1="400" y1="46" x2="400" y2="136" stroke="rgba(0,0,80,0.1)" strokeWidth="2"/>
            <rect x="448" y="88" width="16" height="46" rx="3" fill="rgba(255,255,255,0.55)"/>
            <rect x="449" y="62" width="10" height="18" rx="3" fill="rgba(255,255,220,0.9)"/>
            <rect x="376" y="-2" width="10" height="20" rx="4" fill="rgba(255,255,255,0.65)"/>
          </svg>
        </Box>

      </Box>

      <Box sx={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 1 }}>
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
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', mb: 3 }}>
            <Box sx={{ justifySelf: 'start' }}>
              <IconButton
                aria-label="Volver"
                onClick={handleGoBack}
                size="small"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: 'transparent',
                  color: 'primary.main',
                  '&:hover': {
                    bgcolor: 'rgba(25, 118, 210, 0.16)',
                  },
                }}
              >
                <ArrowBackIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>

            {/* Card title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifySelf: 'center' }}>
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

            <Box />
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

          {!error && locationState?.registrationDisabled && (
            <Alert severity="info" sx={{ mb: 2.5 }}>
              El alta de cuentas se gestiona por el equipo comercial. 
              Si necesitás acceso, comunicate con nosotros desde la web.
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

              {/* Captcha temporalmente deshabilitado para testing */}
              {/*
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
              */}

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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <Link
                component="button"
                variant="body2"
                onClick={() => setShowForgotPassword(true)}
                sx={{ fontWeight: 600, color: 'primary.main' }}
              >
                ¿Olvidaste tu contraseña?
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

        <ForgotPasswordDialog
          open={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
        />
      </Box>
    </Box>
   ) 
  

}

export default LoginPage
