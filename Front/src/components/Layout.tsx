import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Container,
  Menu,
  MenuItem,
  Avatar,
  Chip,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
  Divider,
  Tabs,
  Tab,
} from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import DashboardIcon from '@mui/icons-material/Dashboard'
import BoltIcon from '@mui/icons-material/Bolt'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import RouteIcon from '@mui/icons-material/Route'
import GroupIcon from '@mui/icons-material/Group'
import HistoryIcon from '@mui/icons-material/History'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import StoreIcon from '@mui/icons-material/Store'
import LogoutIcon from '@mui/icons-material/Logout'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import LockIcon from '@mui/icons-material/Lock'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { useState, useEffect, useMemo } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import type { User } from '../types'
import ChangePasswordDialog from './ChangePasswordDialog'

interface LayoutProps {
  user: User
  onLogout: () => void
}

function Layout({ user, onLogout }: LayoutProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [openChangePassword, setOpenChangePassword] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isDarkPremium, setIsDarkPremium] = useState(() => localStorage.getItem('miPlanDarkMode') === 'true')
  const [isPremiumPlan, setIsPremiumPlan] = useState(() => localStorage.getItem('miPlanTipo') === 'Premium')

  const darkPremiumTheme = useMemo(() => createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#42A5F5' },
      secondary: { main: '#7E57C2' },
      background: { default: '#0A1628', paper: '#162032' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCard: { styleOverrides: { root: { borderRadius: 12, transition: 'background-color 0.4s ease, box-shadow 0.3s ease', '&:hover': { boxShadow: '0 4px 20px rgba(66,165,245,0.18)' } } } },
      MuiPaper: { styleOverrides: { root: { transition: 'background-color 0.4s ease' } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 14 } } },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: '#1B2D42',
            color: 'rgba(255,255,255,0.87)',
            borderColor: 'rgba(255,255,255,0.12)',
          },
          root: {
            borderColor: 'rgba(255,255,255,0.1)',
          },
        },
      },
    },
  }), [])

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onDarkChange = () => {
      setIsDarkPremium(localStorage.getItem('miPlanDarkMode') === 'true')
      setIsPremiumPlan(localStorage.getItem('miPlanTipo') === 'Premium')
    }
    window.addEventListener('miPlanDarkModeChange', onDarkChange)
    return () => window.removeEventListener('miPlanDarkModeChange', onDarkChange)
  }, [])

  const toggleDarkPremium = () => {
    const next = !isDarkPremium
    setIsDarkPremium(next)
    localStorage.setItem('miPlanDarkMode', String(next))
    window.dispatchEvent(new Event('miPlanDarkModeChange'))
  }

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleOpenChangePassword = () => {
    handleMenuClose()
    setOpenChangePassword(true)
  }

  const handleLogout = () => {
    handleMenuClose()
    onLogout()
    navigate('/')
  }

  const initials = `${user.name.charAt(0)}${user.lastname.charAt(0)}`.toUpperCase()

  const roleColor: Record<string, 'error' | 'primary' | 'success' | 'secondary' | 'default'> = {
    administrador: 'secondary',
    supervisor: 'error',
    operador: 'primary',
    repartidor: 'success',
  }

  const roleLabel: Record<string, string> = {
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    operador: 'Operador',
    repartidor: 'Repartidor',
  }

  const selectedTab = (() => {
    const pathname = location.pathname

    if (pathname === '/app') return '/app'
    if (pathname === '/envios') return '/envios'
    if (pathname.startsWith('/repartidor/') && pathname.endsWith('/rendimiento')) return false
    if (pathname.startsWith('/shipment/')) return false
    if (pathname.startsWith('/calendario')) return '/calendario'
    if (pathname.startsWith('/calendarizar')) return '/calendarizar'
    if (pathname.startsWith('/repartidores')) return '/repartidores'
    if (pathname.startsWith('/rutas-activas')) return '/rutas-activas'
    if (pathname.startsWith('/auditoria')) return '/auditoria'
    if (pathname.startsWith('/mi-plan')) return '/mi-plan'
    if (pathname.startsWith('/sucursales')) return '/sucursales'
    return false
  })()

  const isAccessDeniedPage = location.pathname === '/access-denied'

  return (
    <Box data-dark={isDarkPremium ? 'true' : undefined} sx={{ minHeight: '100vh', bgcolor: isDarkPremium ? '#0A1628' : 'background.default', color: isDarkPremium ? 'rgba(255,255,255,0.87)' : undefined, transition: 'background-color 0.5s ease' }}>
      {isDarkPremium && (
        <style>{`
          [data-dark] .MuiTableHead-root .MuiTableRow-root { background-color: #1B2D42 !important; }
          [data-dark] .MuiTableHead-root .MuiTableCell-root { background-color: #1B2D42 !important; color: rgba(255,255,255,0.87) !important; border-color: rgba(255,255,255,0.12) !important; }
          [data-dark] .MuiTableCell-root { border-color: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.87) !important; }
          [data-dark] .MuiTableBody-root .MuiTableRow-root:hover { background-color: rgba(255,255,255,0.06) !important; }
          [data-dark] .MuiTableBody-root .MuiTableRow-root { background-color: #162032; }
        `}</style>
      )}
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.15)', ...(isDarkPremium && { background: 'linear-gradient(135deg, #0A1628 0%, #1B2D42 100%)' }) }}>
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {/* Logo */}
          <Box
            sx={{
              flexGrow: 1,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
            onClick={() => navigate(user.role === 'repartidor' ? '/repartidor' : '/app')}
          >
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '12px',
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg,#0288D1,#29B6F6)',
                boxShadow: '0 8px 18px rgba(2,136,209,0.24)',
              }}
            >
              <LocalShippingRoundedIcon sx={{ color: '#fff', fontSize: 20 }} />
            </Box>
            <Typography
              variant="h6"
              component="div"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.3px',
              }}
            >
              LogiTrack
            </Typography>
          </Box>

          {/* Right side */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
            {/* Role chip + name — hidden on xs */}
            {!isMobile && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.3 }}>
                  {user.name} {user.lastname}
                </Typography>
                <Chip
                  label={roleLabel[user.role] ?? user.role}
                  size="small"
                  color={roleColor[user.role] ?? 'default'}
                  variant="outlined"
                  sx={{ height: 20, color: 'rgba(255,255,255,0.85)', borderColor: 'rgba(255,255,255,0.4)', fontSize: '0.65rem' }}
                />
              </Box>
            )}

            {/* Dark mode toggle — only for Premium plan */}
            {isPremiumPlan && (
              <Tooltip title={isDarkPremium ? 'Cambiar a modo claro' : 'Activar modo oscuro Premium'}>
                <IconButton onClick={toggleDarkPremium} size="small" sx={{ color: 'white' }}>
                  {isDarkPremium ? <WbSunnyIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            )}

            {/* Avatar with dropdown */}
            <Avatar
              onClick={handleMenuOpen}
              sx={{
                cursor: 'pointer',
                bgcolor: 'secondary.main',
                width: { xs: 34, sm: 38 },
                height: { xs: 34, sm: 38 },
                fontSize: { xs: '0.8rem', sm: '0.9rem' },
                fontWeight: 700,
                transition: 'opacity 0.2s',
                '&:hover': { opacity: 0.85 },
              }}
            >
              {initials}
            </Avatar>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{ paper: { sx: { mt: 0.5, minWidth: 200 } } }}
            >
              <MenuItem disabled sx={{ opacity: '1 !important' }}>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    {user.name} {user.lastname}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {user.email}
                  </Typography>
                </Box>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleOpenChangePassword} sx={{ gap: 1 }}>
                <LockIcon fontSize="small" />
                Cambiar contraseña
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: 'error.main', gap: 1 }}>
                <LogoutIcon fontSize="small" />
                Cerrar sesión
              </MenuItem>
            </Menu>

            {/* Quick logout on mobile */}
            {isMobile && (
              <Tooltip title="Cerrar sesión">
                <IconButton onClick={handleLogout} size="small" sx={{ color: 'white' }}>
                  <LogoutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Tabs nav */}
      {!isAccessDeniedPage && (user.role === 'supervisor' || user.role === 'administrador' || user.role === 'operador') && (
        <Box sx={{
          bgcolor: isDarkPremium ? '#1B2D42' : 'white',
          borderBottom: isDarkPremium ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e0e0e0',
          px: { xs: 1, sm: 4 },
          position: 'sticky',
          top: 64,
          zIndex: 90,
          transition: 'background-color 0.5s ease',
        }}>
          <Tabs
            value={selectedTab}
            onChange={(_, v) => navigate(v)}
            variant="scrollable"
            scrollButtons="auto"
            sx={isDarkPremium ? {
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.85)' },
              '& .Mui-selected': { color: '#42A5F5' },
              '& .MuiTabs-indicator': { backgroundColor: '#42A5F5' },
            } : {}}
          >
            {user.role !== 'operador' && (
              <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Dashboard" value="/app" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {(user.role === 'supervisor' || user.role === 'operador') && (
              <Tab icon={<Inventory2Icon fontSize="small" />} iconPosition="start" label="Envíos" value="/envios" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'supervisor' && (
              <Tab icon={<BoltIcon fontSize="small" />} iconPosition="start" label="Calendarizar" value="/calendarizar" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'supervisor' && (
              <Tab icon={<GroupIcon fontSize="small" />} iconPosition="start" label="Repartidores" value="/repartidores" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'supervisor' && (
              <Tab icon={<CalendarMonthIcon fontSize="small" />} iconPosition="start" label="Calendario Operativo" value="/calendario" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'supervisor' && (
              <Tab icon={<RouteIcon fontSize="small" />} iconPosition="start" label="Rutas Activas" value="/rutas-activas" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'administrador' && (
              <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Auditoría" value="/auditoria" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'administrador' && (
              <Tab icon={<StoreIcon fontSize="small" />} iconPosition="start" label="Sucursales" value="/sucursales" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'administrador' && (
              <Tab icon={<WorkspacePremiumIcon fontSize="small" />} iconPosition="start" label="Mi Plan" value="/mi-plan" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
          </Tabs>
        </Box>
      )}

      {/* Dialog para cambiar contraseña */}
      <ChangePasswordDialog open={openChangePassword} onClose={() => setOpenChangePassword(false)} />

      {showScrollTop && (
        <IconButton
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 30,
            bgcolor: '#0288D1',
            color: '#fff',
            boxShadow: '0 8px 20px rgba(2,136,209,0.3)',
            '&:hover': { bgcolor: '#0277BD' },
          }}
        >
          <KeyboardArrowUpIcon />
        </IconButton>
      )}

      <ThemeProvider theme={isDarkPremium ? darkPremiumTheme : theme}>
        {isAccessDeniedPage ? (
          <Outlet context={user} />
        ) : (
          <Container
            maxWidth="lg"
            sx={{
              py: { xs: 2, sm: 3 },
              px: { xs: 2, sm: 3 },
              color: isDarkPremium ? 'rgba(255,255,255,0.87)' : undefined,
            }}
          >
            <Outlet context={user} />
          </Container>
        )}
      </ThemeProvider>
    </Box>
  )
}

export default Layout
