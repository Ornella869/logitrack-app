import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Badge,
  Box,
  Chip,
  Container,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Avatar,
  Popover,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import DashboardIcon from '@mui/icons-material/Dashboard'
import BoltIcon from '@mui/icons-material/Bolt'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import RouteIcon from '@mui/icons-material/Route'
import GroupIcon from '@mui/icons-material/Group'
import HistoryIcon from '@mui/icons-material/History'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import BarChartIcon from '@mui/icons-material/BarChart'
import PriceChangeIcon from '@mui/icons-material/PriceChange'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import StoreIcon from '@mui/icons-material/Store'
import PlaceIcon from '@mui/icons-material/Place'
import LogoutIcon from '@mui/icons-material/Logout'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import LockIcon from '@mui/icons-material/Lock'
import AccountCircleIcon from '@mui/icons-material/AccountCircle'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import NotificationsIcon from '@mui/icons-material/Notifications'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ReportProblemIcon from '@mui/icons-material/ReportProblem'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { notificationService, type AppNotification } from '../services/notificationService'
import { alertService } from '../services/alertService'
import { incidenciaService } from '../services/incidenciaService'
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
  const [avatarSrc, setAvatarSrc] = useState<string | null>(
    () => localStorage.getItem(`logitrack_avatar_${user.id}`)
  )
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isDarkPremium, setIsDarkPremium] = useState(() => localStorage.getItem('miPlanDarkMode') === 'true')
  const [isPremiumPlan, setIsPremiumPlan] = useState(() => localStorage.getItem('miPlanTipo') === 'Premium')

  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  // G1L-84: contador de alertas para el badge del tab (solo Supervisor).
  const [alertasCount, setAlertasCount] = useState(0)
  // G1L-91: contador de incidencias abiertas para el badge (solo Supervisor).
  const [incidenciasCount, setIncidenciasCount] = useState(0)

  useEffect(() => {
    if (user.role !== 'supervisor') return
    void alertService.contar().then(setAlertasCount)

    // UH-84: generar notificaciones in-app al inicio de jornada por paquetes sin estado final
    const ALERTA_NOTIF_KEY = 'logitrack_alertas_notificadas'
    const getNotificadas = (): Set<string> => {
      try { return new Set(JSON.parse(localStorage.getItem(ALERTA_NOTIF_KEY) ?? '[]') as string[]) }
      catch { return new Set() }
    }
    void alertService.getPaquetesSinEstadoFinal().then((data) => {
      const notificadas = getNotificadas()
      let huboNuevas = false
      data.forEach((a) => {
        if (!notificadas.has(a.paqueteId)) {
          notificadas.add(a.paqueteId)
          huboNuevas = true
          notificationService.add({
            type: 'incidencia',
            title: 'Paquete sin estado final',
            message: `${a.trackingId} — ${a.repartidorNombre} — ${a.diasDemora} día${a.diasDemora === 1 ? '' : 's'} de demora (${a.estadoActual})`,
            recipientId: user.id,
            navigateTo: `/shipment/${a.paqueteId}`,
          })
        }
      })
      if (huboNuevas) localStorage.setItem(ALERTA_NOTIF_KEY, JSON.stringify([...notificadas]))
    })
  }, [user.role, user.id])

  useEffect(() => {
    if (user.role !== 'supervisor') return
    const refresh = () => void incidenciaService.countAbiertas().then(setIncidenciasCount).catch(() => setIncidenciasCount(0))
    refresh()
    const handler = () => refresh()
    window.addEventListener('logitrack:incidencias', handler)
    return () => window.removeEventListener('logitrack:incidencias', handler)
  }, [user.role])

  const refreshNotifications = useCallback(() => {
    const notifs = notificationService.getForUser(user.id, user.role, user.sucursalId ?? undefined)
    setNotifications(notifs)
    const ids = new Set<string>()
    notifs.forEach((n) => { if (notificationService.isRead(user.id, n.id)) ids.add(n.id) })
    setReadIds(ids)
  }, [user.id, user.role, user.sucursalId])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds],
  )

  const darkPremiumTheme = useMemo(() => createTheme({
    palette: {
      mode: 'dark',
      primary: { main: '#42A5F5' },
      secondary: { main: '#7E57C2' },
      background: { default: '#0A1628', paper: '#162032' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCard: { styleOverrides: { root: { borderRadius: 12, transition: 'background-color 0.4s ease, box-shadow 0.3s ease, transform 0.2s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 6px 24px rgba(66,165,245,0.25)' } } } },
      MuiPaper: { styleOverrides: { root: { transition: 'background-color 0.4s ease' } } },
      MuiButton: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 14 } } },
      MuiTab: { styleOverrides: { root: { transition: 'transform 0.15s ease', '&:hover': { transform: 'translateY(-2px)' } } } },
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
    refreshNotifications()
    const storageHandler = (e: StorageEvent) => {
      if (e.key === 'logitrack_notifications') refreshNotifications()
    }
    window.addEventListener('logitrack:notification', refreshNotifications)
    window.addEventListener('storage', storageHandler)
    return () => {
      window.removeEventListener('logitrack:notification', refreshNotifications)
      window.removeEventListener('storage', storageHandler)
    }
  }, [refreshNotifications])

  useEffect(() => {
    const onDarkChange = () => {
      setIsDarkPremium(localStorage.getItem('miPlanDarkMode') === 'true')
      setIsPremiumPlan(localStorage.getItem('miPlanTipo') === 'Premium')
    }
    window.addEventListener('miPlanDarkModeChange', onDarkChange)
    return () => window.removeEventListener('miPlanDarkModeChange', onDarkChange)
  }, [])

  useEffect(() => {
    const handler = () => setAvatarSrc(localStorage.getItem(`logitrack_avatar_${user.id}`))
    window.addEventListener('logitrack:avatarChange', handler)
    return () => window.removeEventListener('logitrack:avatarChange', handler)
  }, [user.id])

  const toggleDarkPremium = () => {
    const next = !isDarkPremium
    setIsDarkPremium(next)
    localStorage.setItem('miPlanDarkMode', String(next))
    window.dispatchEvent(new Event('miPlanDarkModeChange'))
  }

  const handleNotifOpen = (e: React.MouseEvent<HTMLElement>) => {
    setNotifAnchor(e.currentTarget)
    refreshNotifications()
  }
  const handleNotifClose = () => setNotifAnchor(null)

  const handleNotifClick = (notif: AppNotification) => {
    notificationService.markRead(user.id, notif.id)
    refreshNotifications()
    handleNotifClose()
    if (notif.navigateTo) navigate(notif.navigateTo)
  }

  const handleMarkAllRead = () => {
    notificationService.markAllRead(user.id, user.role, user.sucursalId ?? undefined)
    refreshNotifications()
  }

  const timeAgo = (dateStr: string): string => {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
    if (mins < 1) return 'ahora'
    if (mins < 60) return `hace ${mins} min`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `hace ${hrs} h`
    return `hace ${Math.floor(hrs / 24)} día${Math.floor(hrs / 24) > 1 ? 's' : ''}`
  }

  const notifIcon = (type: AppNotification['type']) => {
    if (type === 'calendarizacion') return <CalendarMonthIcon sx={{ fontSize: 16 }} />
    if (type === 'ruta-asignada') return <RouteIcon sx={{ fontSize: 16 }} />
    if (type === 'incidencia') return <WarningAmberIcon sx={{ fontSize: 16 }} />
    return <NotificationsNoneIcon sx={{ fontSize: 16 }} />
  }

  const notifColor = (type: AppNotification['type']) => {
    if (type === 'calendarizacion') return '#1976d2'
    if (type === 'ruta-asignada') return '#2e7d32'
    if (type === 'incidencia') return '#e65100'
    return '#7b1fa2'
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
    socio_pickup: 'primary',
  }

  const roleLabel: Record<string, string> = {
    administrador: 'Administrador',
    supervisor: 'Supervisor',
    operador: 'Operador',
    repartidor: 'Repartidor',
    socio_pickup: 'Socio Pick Up',
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
    if (pathname.startsWith('/alertas')) return '/alertas'
    if (pathname.startsWith('/satisfaccion')) return '/satisfaccion'
    if (pathname.startsWith('/reportes')) return '/reportes'
    if (pathname.startsWith('/auditoria-notificaciones')) return '/auditoria-notificaciones'
    if (pathname.startsWith('/auditoria')) return '/auditoria'
    if (pathname.startsWith('/mi-plan')) return '/mi-plan'
    if (pathname.startsWith('/sucursales')) return '/sucursales'
    if (pathname.startsWith('/pickups')) return '/pickups'
    if (pathname.startsWith('/pickup-operacion')) return '/pickup-operacion'
    if (pathname.startsWith('/tarifas')) return '/tarifas'
    if (pathname.startsWith('/ojo-patron')) return '/ojo-patron'
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
          [data-dark] input:-webkit-autofill,
          [data-dark] input:-webkit-autofill:hover,
          [data-dark] input:-webkit-autofill:focus,
          [data-dark] input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 1000px #1a2d42 inset !important;
            -webkit-text-fill-color: rgba(255,255,255,0.87) !important;
            caret-color: rgba(255,255,255,0.87) !important;
          }
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
            onClick={() => navigate(user.role === 'repartidor' ? '/repartidor' : user.role === 'socio_pickup' ? '/pickup-operacion' : '/app')}
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

            {/* Notification bell */}
            <Tooltip title="Notificaciones">
              <IconButton onClick={handleNotifOpen} size="small" sx={{ color: 'white' }}>
                <Badge badgeContent={unreadCount > 0 ? unreadCount : undefined} color="error" max={9}>
                  {unreadCount > 0 ? <NotificationsIcon fontSize="small" /> : <NotificationsNoneIcon fontSize="small" />}
                </Badge>
              </IconButton>
            </Tooltip>

            {/* Avatar with dropdown */}
            <Avatar
              src={avatarSrc ?? undefined}
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
              {!avatarSrc && initials}
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
              <MenuItem onClick={() => { handleMenuClose(); navigate('/perfil') }} sx={{ gap: 1 }}>
                <AccountCircleIcon fontSize="small" />
                Mi Perfil
              </MenuItem>
              <MenuItem onClick={handleOpenChangePassword} sx={{ gap: 1 }}>
                <LockIcon fontSize="small" />
                Cambiar contraseña
              </MenuItem>
              <MenuItem onClick={handleLogout} sx={{ color: 'error.main', gap: 1 }}>
                <LogoutIcon fontSize="small" />
                Cerrar sesión
              </MenuItem>
            </Menu>

            {/* Notification panel */}
            <Popover
              open={Boolean(notifAnchor)}
              anchorEl={notifAnchor}
              onClose={handleNotifClose}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{ paper: { sx: { width: 360, maxHeight: 500, display: 'flex', flexDirection: 'column' } } }}
            >
              <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                <Typography variant="subtitle1" fontWeight={700}>Notificaciones</Typography>
                {unreadCount > 0 && (
                  <Typography
                    variant="caption"
                    sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 600 }}
                    onClick={handleMarkAllRead}
                  >
                    Marcar todas como leídas
                  </Typography>
                )}
              </Box>

              {notifications.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <NotificationsNoneIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Sin notificaciones</Typography>
                </Box>
              ) : (
                <List dense disablePadding sx={{ overflow: 'auto', flex: 1 }}>
                  {notifications.map((notif) => {
                    const isRead = readIds.has(notif.id)
                    const color = notifColor(notif.type)
                    return (
                      <ListItemButton
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        sx={{
                          borderBottom: '1px solid #f0f0f0',
                          bgcolor: isRead ? 'transparent' : 'rgba(25,118,210,0.04)',
                          alignItems: 'flex-start',
                          gap: 1,
                          py: 1.5,
                        }}
                      >
                        <Box sx={{ mt: 0.3, color, flexShrink: 0 }}>{notifIcon(notif.type)}</Box>
                        <ListItemText
                          primary={
                            <Typography variant="body2" fontWeight={isRead ? 400 : 700} lineHeight={1.3}>
                              {notif.title}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block" sx={{ mt: 0.2, lineHeight: 1.4 }}>
                                {notif.message}
                              </Typography>
                              <Typography variant="caption" color="text.disabled">
                                {timeAgo(notif.createdAt)}
                              </Typography>
                            </Box>
                          }
                        />
                        {!isRead && (
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1976d2', mt: 0.8, flexShrink: 0 }} />
                        )}
                      </ListItemButton>
                    )
                  })}
                </List>
              )}
            </Popover>

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
      {!isAccessDeniedPage && (user.role === 'supervisor' || user.role === 'administrador' || user.role === 'operador' || user.role === 'gerente' || user.role === 'socio_pickup') && (
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
            scrollButtons={false}
            sx={isDarkPremium ? {
              '& .MuiTab-root': { color: 'rgba(255,255,255,0.85)' },
              '& .Mui-selected': { color: '#42A5F5' },
              '& .MuiTabs-indicator': { backgroundColor: '#42A5F5' },
            } : {}}
          >
            {(user.role === 'supervisor' || user.role === 'administrador') && (
              <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Dashboard" value="/app" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {(user.role === 'supervisor' || user.role === 'operador') && (
              <Tab icon={<Inventory2Icon fontSize="small" />} iconPosition="start" label="Envíos" value="/envios" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'socio_pickup' && (
              <Tab icon={<StoreIcon fontSize="small" />} iconPosition="start" label="Mi PickUp" value="/pickup-operacion" sx={{ minHeight: 48, textTransform: 'none' }} />
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
            {user.role === 'supervisor' && (
              <Tab
                icon={
                  <Badge badgeContent={alertasCount > 0 ? alertasCount : undefined} color="error" max={9}>
                    <WarningAmberIcon fontSize="small" />
                  </Badge>
                }
                iconPosition="start"
                label="Alertas"
                value="/alertas"
                sx={{ minHeight: 48, textTransform: 'none' }}
              />
            )}
            {user.role === 'supervisor' && (
              <Tab
                icon={
                  <Badge badgeContent={incidenciasCount > 0 ? incidenciasCount : undefined} color="error" max={9}>
                    <ReportProblemIcon fontSize="small" />
                  </Badge>
                }
                iconPosition="start"
                label="Incidencias"
                value="/incidencias"
                sx={{ minHeight: 48, textTransform: 'none' }}
              />
            )}
            {(user.role === 'supervisor' || user.role === 'gerente' || user.role === 'administrador') && (
              <Tab icon={<BarChartIcon fontSize="small" />} iconPosition="start" label="Reportes" value="/reportes" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {(user.role === 'supervisor' || user.role === 'gerente' || user.role === 'administrador') && (
              <Tab icon={<StarBorderIcon fontSize="small" />} iconPosition="start" label="Satisfacción" value="/satisfaccion" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {(user.role === 'administrador' || user.role === 'supervisor') && (
              <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Auditoría" value="/auditoria" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {/* Épica D: sucursales, tarifas y ojo del patrón los gestiona el Gerente */}
            {user.role === 'gerente' && (
              <Tab icon={<StoreIcon fontSize="small" />} iconPosition="start" label="Sucursales" value="/sucursales" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'gerente' && (
              <Tab icon={<PlaceIcon fontSize="small" />} iconPosition="start" label="PickUps" value="/pickups" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'gerente' && (
              <Tab icon={<PriceChangeIcon fontSize="small" />} iconPosition="start" label="Tarifas" value="/tarifas" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {(user.role === 'gerente' || user.role === 'supervisor') && (
              <Tab icon={<GraphicEqIcon fontSize="small" />} iconPosition="start" label="Ojo del Patrón" value="/ojo-patron" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'administrador' && (
              <Tab icon={<NotificationsActiveIcon fontSize="small" />} iconPosition="start" label="Notif. Auditoría" value="/auditoria-notificaciones" sx={{ minHeight: 48, textTransform: 'none' }} />
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
