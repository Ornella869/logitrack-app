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
import Inventory2Icon from '@mui/icons-material/Inventory2'
import BoltIcon from '@mui/icons-material/Bolt'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import RouteIcon from '@mui/icons-material/Route'
import HistoryIcon from '@mui/icons-material/History'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import StoreIcon from '@mui/icons-material/Store'
import LogoutIcon from '@mui/icons-material/Logout'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import LockIcon from '@mui/icons-material/Lock'
import { useState } from 'react'
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

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
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

      {/* Tabs nav (Supervisor / Admin) */}
      {(user.role === 'supervisor' || user.role === 'administrador') && (
        <Box sx={{ bgcolor: 'white', borderBottom: '1px solid #e0e0e0', px: { xs: 1, sm: 4 }, position: 'sticky', top: 64, zIndex: 90 }}>
          <Tabs
            value={(() => {
              const p = location.pathname
              if (p.startsWith('/calendario')) return '/calendario'
              if (p.startsWith('/calendarizar')) return '/calendarizar'
              if (p.startsWith('/rutas-activas')) return '/rutas-activas'
              if (p.startsWith('/auditoria')) return '/auditoria'
              if (p.startsWith('/mi-plan')) return '/mi-plan'
              if (p.startsWith('/sucursales')) return '/sucursales'
              return '/app'
            })()}
            onChange={(_, v) => navigate(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<Inventory2Icon fontSize="small" />} iconPosition="start" label="Envíos" value="/app" sx={{ minHeight: 48, textTransform: 'none' }} />
            {user.role === 'supervisor' && (
              <Tab icon={<BoltIcon fontSize="small" />} iconPosition="start" label="Calendarizar" value="/calendarizar" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            <Tab icon={<CalendarMonthIcon fontSize="small" />} iconPosition="start" label="Calendario Operativo" value="/calendario" sx={{ minHeight: 48, textTransform: 'none' }} />
            <Tab icon={<RouteIcon fontSize="small" />} iconPosition="start" label="Rutas Activas" value="/rutas-activas" sx={{ minHeight: 48, textTransform: 'none' }} />
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

      <Container
        maxWidth="lg"
        sx={{
          py: { xs: 2, sm: 3 },
          px: { xs: 2, sm: 3 },
        }}
      >
        <Outlet context={user} />
      </Container>
    </Box>
  )
}

export default Layout
