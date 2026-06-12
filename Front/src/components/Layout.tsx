import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AppBar,
  Badge,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemIcon,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
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
import EmailIcon from '@mui/icons-material/Email'
import MenuIcon from '@mui/icons-material/Menu'
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
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
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
    () => user.fotoPerfil ?? localStorage.getItem(`logitrack_avatar_${user.id}`)
  )
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isDarkPremium, setIsDarkPremium] = useState(() => localStorage.getItem('miPlanDarkMode') === 'true')
  const [isPremiumPlan, setIsPremiumPlan] = useState(() => localStorage.getItem('miPlanTipo') === 'Premium')
  const [repartidorNavAnchor, setRepartidorNavAnchor] = useState<null | HTMLElement>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

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
      primary: { main: '#4FC3F7' },
      secondary: { main: '#7E57C2' },
      background: { default: 'transparent', paper: 'rgba(255,255,255,0.06)' },
      text: { primary: 'rgba(255,255,255,0.92)', secondary: 'rgba(255,255,255,0.55)' },
    },
    shape: { borderRadius: 10 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            transition: 'box-shadow 0.3s ease, transform 0.2s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 24px rgba(79,195,247,0.18)' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            transition: 'box-shadow 0.3s ease',
          },
          outlined: {
            background: 'rgba(255,255,255,0.04)',
          },
        },
      },
      MuiButton: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiDialog: {
        styleOverrides: {
          paper: {
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            background: 'rgba(13,11,30,0.88)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14,
          },
        },
      },
      MuiTab: { styleOverrides: { root: { transition: 'transform 0.15s ease', '&:hover': { transform: 'translateY(-2px)' } } } },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            backdropFilter: 'none',
            background: 'transparent',
            border: 'none',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            backgroundColor: 'rgba(79,195,247,0.08)',
            color: 'rgba(255,255,255,0.87)',
            borderColor: 'rgba(255,255,255,0.1)',
          },
          root: {
            borderColor: 'rgba(255,255,255,0.08)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(255,255,255,0.18)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.4)' },
            },
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            color: '#ffffff',
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
    const handler = () => {
      try {
        const stored = localStorage.getItem('user')
        const u = stored ? JSON.parse(stored) : null
        setAvatarSrc(u?.fotoPerfil ?? localStorage.getItem(`logitrack_avatar_${user.id}`))
      } catch {
        setAvatarSrc(localStorage.getItem(`logitrack_avatar_${user.id}`))
      }
    }
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
    if (pathname.startsWith('/plantillas-email')) return '/plantillas-email'
    if (pathname.startsWith('/auditoria-notificaciones')) return '/auditoria-notificaciones'
    if (pathname.startsWith('/auditoria')) return '/auditoria'
    if (pathname.startsWith('/mi-plan')) return '/mi-plan'
    if (pathname.startsWith('/sucursales')) return '/sucursales'
    if (pathname.startsWith('/pickups')) return '/pickups'
    if (pathname.startsWith('/pickup-historial')) return '/pickup-historial'
    if (pathname.startsWith('/pickup-operacion')) return '/pickup-operacion'
    if (pathname.startsWith('/tarifas')) return '/tarifas'
    if (pathname.startsWith('/ojo-patron')) return '/ojo-patron'
    return false
  })()

  const isAccessDeniedPage = location.pathname === '/access-denied'
  const hasSidebar = user.role === 'gerente' || user.role === 'supervisor' || user.role === 'administrador'
  const sidebarNavItems: Array<{ path: string; label: string; icon: React.ReactNode; badge?: number }> =
    user.role === 'gerente' ? [
      { path: '/sucursales',       label: 'Sucursales',          icon: <StoreIcon fontSize="small" /> },
      { path: '/pickups',          label: 'PickUps',             icon: <PlaceIcon fontSize="small" /> },
      { path: '/tarifas',          label: 'Tarifas',             icon: <PriceChangeIcon fontSize="small" /> },
      { path: '/ojo-patron',       label: 'Ojo del Patrón',      icon: <GraphicEqIcon fontSize="small" /> },
      { path: '/reportes',         label: 'Reportes',            icon: <BarChartIcon fontSize="small" /> },
      { path: '/satisfaccion',     label: 'Satisfacción',        icon: <StarBorderIcon fontSize="small" /> },
      { path: '/plantillas-email', label: 'Plantillas de Email', icon: <EmailIcon fontSize="small" /> },
    ] :
    user.role === 'supervisor' ? [
      { path: '/app',              label: 'Dashboard',            icon: <DashboardIcon fontSize="small" /> },
      { path: '/envios',           label: 'Envíos',               icon: <Inventory2Icon fontSize="small" /> },
      { path: '/calendarizar',     label: 'Calendarizar',         icon: <BoltIcon fontSize="small" /> },
      { path: '/repartidores',     label: 'Repartidores',         icon: <GroupIcon fontSize="small" /> },
      { path: '/calendario',       label: 'Calendario Operativo', icon: <CalendarMonthIcon fontSize="small" /> },
      { path: '/rutas-activas',    label: 'Rutas Activas',        icon: <RouteIcon fontSize="small" /> },
      { path: '/alertas',          label: 'Alertas',              icon: <WarningAmberIcon fontSize="small" />, badge: alertasCount },
      { path: '/incidencias',      label: 'Incidencias',          icon: <ReportProblemIcon fontSize="small" />, badge: incidenciasCount },
      { path: '/reportes',         label: 'Reportes',             icon: <BarChartIcon fontSize="small" /> },
      { path: '/satisfaccion',     label: 'Satisfacción',         icon: <StarBorderIcon fontSize="small" /> },
      { path: '/auditoria',        label: 'Auditoría',            icon: <HistoryIcon fontSize="small" /> },
      { path: '/ojo-patron',       label: 'Ojo del Patrón',       icon: <GraphicEqIcon fontSize="small" /> },
    ] :
    user.role === 'administrador' ? [
      { path: '/app',                      label: 'Dashboard',            icon: <DashboardIcon fontSize="small" /> },
      { path: '/satisfaccion',             label: 'Satisfacción',         icon: <StarBorderIcon fontSize="small" /> },
      { path: '/auditoria',                label: 'Auditoría',            icon: <HistoryIcon fontSize="small" /> },
      { path: '/auditoria-notificaciones', label: 'Notif. Auditoría',     icon: <NotificationsActiveIcon fontSize="small" /> },
      { path: '/mi-plan',                  label: 'Mi Plan',              icon: <WorkspacePremiumIcon fontSize="small" /> },
    ] : []
  const isRepartidorArea = user.role === 'repartidor' && location.pathname.startsWith('/repartidor')
  const repartidorNavValue = (() => {
    if (location.pathname.startsWith('/repartidor/historial')) return '/repartidor/historial'
    if (location.pathname.startsWith('/repartidor/paradas')) return '/repartidor/paradas'
    return '/repartidor'
  })()

  return (
    <Box
      data-dark={isDarkPremium ? 'true' : undefined}
      sx={{
        minHeight: '100vh',
        background: isDarkPremium
          ? 'linear-gradient(145deg, #06040f 0%, #0d0b1e 25%, #0a1533 55%, #07101f 100%)'
          : undefined,
        backgroundAttachment: isDarkPremium ? 'fixed' : undefined,
        bgcolor: isDarkPremium ? undefined : 'background.default',
        color: isDarkPremium ? 'rgba(255,255,255,0.92)' : undefined,
        transition: 'background 0.5s ease',
      }}
    >
      {isDarkPremium && (
        <style>{`
          [data-dark] .MuiTableHead-root .MuiTableRow-root { background-color: rgba(79,195,247,0.06) !important; }
          [data-dark] .MuiTableHead-root .MuiTableCell-root { background-color: rgba(79,195,247,0.06) !important; color: rgba(255,255,255,0.87) !important; border-color: rgba(255,255,255,0.1) !important; }
          [data-dark] .MuiTableCell-root { border-color: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.87) !important; }
          [data-dark] .MuiTableBody-root .MuiTableRow-root:hover { background-color: rgba(79,195,247,0.05) !important; }
          [data-dark] .MuiTableBody-root .MuiTableRow-root { background-color: transparent; }
          [data-dark] input:-webkit-autofill,
          [data-dark] input:-webkit-autofill:hover,
          [data-dark] input:-webkit-autofill:focus,
          [data-dark] input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 1000px rgba(13,11,30,0.95) inset !important;
            -webkit-text-fill-color: rgba(255,255,255,0.9) !important;
            caret-color: rgba(255,255,255,0.9) !important;
          }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: rgba(79,195,247,0.22); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(79,195,247,0.45); }
        `}</style>
      )}
      {!isDarkPremium && (
        <style>{`
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: rgba(0,0,0,0.04); border-radius: 4px; }
          ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.18); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.32); }
        `}</style>
      )}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          borderBottom: isDarkPremium ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.15)',
          ...(isDarkPremium && {
            background: 'rgba(6,4,15,0.82)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }),
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {hasSidebar && !isAccessDeniedPage && (
            <IconButton
              size="small"
              onClick={() => setSidebarOpen((prev) => !prev)}
              sx={{ mr: 1, color: 'white' }}
              aria-label="Toggle navegación"
            >
              <MenuIcon />
            </IconButton>
          )}
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

      {/* Sidebar lateral — Gerente, Supervisor, Administrador */}
      {hasSidebar && !isAccessDeniedPage && (
        <Box sx={{
          position: 'fixed',
          left: 0,
          top: 64,
          bottom: 0,
          width: sidebarOpen ? 240 : 0,
          overflowX: 'hidden',
          transition: 'width 0.25s ease',
          bgcolor: isDarkPremium ? 'transparent' : '#FAFAFA',
          backdropFilter: isDarkPremium ? 'blur(20px)' : undefined,
          background: isDarkPremium ? 'rgba(6,4,15,0.6)' : '#FAFAFA',
          borderRight: isDarkPremium ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E8E8E8',
          zIndex: 89,
          display: 'flex',
          flexDirection: 'column',
        }}>
          {user.role === 'gerente' && (
            <>
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, whiteSpace: 'nowrap' }}>
                <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: '0.08em', color: isDarkPremium ? 'rgba(255,255,255,0.4)' : 'text.disabled' }}>PROVINCIA</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ mt: 0.3, color: isDarkPremium ? 'rgba(255,255,255,0.85)' : 'text.primary' }}>
                  {(user as any).provincia ?? 'Sin asignar'}
                </Typography>
              </Box>
              <Divider sx={{ borderColor: isDarkPremium ? 'rgba(255,255,255,0.08)' : undefined }} />
            </>
          )}
          {(user.role === 'supervisor' || user.role === 'administrador') && (
            <>
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, whiteSpace: 'nowrap' }}>
                <Typography variant="caption" fontWeight={700} sx={{ letterSpacing: '0.08em', color: isDarkPremium ? 'rgba(255,255,255,0.4)' : 'text.disabled' }}>
                  {user.role === 'supervisor' ? 'SUPERVISOR' : 'ADMINISTRADOR'}
                </Typography>
              </Box>
              <Divider sx={{ borderColor: isDarkPremium ? 'rgba(255,255,255,0.08)' : undefined }} />
            </>
          )}
          <List dense sx={{ pt: 1, px: 1, overflowY: 'auto', flex: 1 }}>
            {sidebarNavItems.map((item) => {
              const active = selectedTab === item.path
              return (
                <ListItemButton
                  key={item.path}
                  selected={active}
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: '8px',
                    mb: 0.5,
                    whiteSpace: 'nowrap',
                    color: isDarkPremium ? (active ? '#42A5F5' : 'rgba(255,255,255,0.75)') : undefined,
                    ...(active ? {
                      bgcolor: isDarkPremium ? 'rgba(66,165,245,0.15) !important' : 'rgba(25,118,210,0.08) !important',
                      color: isDarkPremium ? '#42A5F5' : 'primary.main',
                    } : {}),
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                    {(item.badge ?? 0) > 0 ? (
                      <Badge badgeContent={item.badge} color="error" max={9}>
                        {item.icon}
                      </Badge>
                    ) : item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: active ? 700 : 400, color: 'inherit' }}
                  />
                </ListItemButton>
              )
            })}
          </List>
        </Box>
      )}

      {/* Tabs nav — solo Operador y Socio PickUp (Gerente/Supervisor/Administrador usan sidebar) */}
      {!isAccessDeniedPage && (user.role === 'operador' || user.role === 'socio_pickup') && (
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
            {user.role === 'operador' && (
              <Tab icon={<Inventory2Icon fontSize="small" />} iconPosition="start" label="Envíos" value="/envios" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'socio_pickup' && (
              <Tab icon={<StoreIcon fontSize="small" />} iconPosition="start" label="Mi PickUp" value="/pickup-operacion" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
            {user.role === 'socio_pickup' && (
              <Tab icon={<HistoryIcon fontSize="small" />} iconPosition="start" label="Historial" value="/pickup-historial" sx={{ minHeight: 48, textTransform: 'none' }} />
            )}
          </Tabs>
        </Box>
      )}

      {isMobile && isRepartidorArea && (
        <>
          <Paper
            elevation={8}
            sx={{
              position: 'fixed',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 120,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              overflow: 'hidden',
            }}
          >
            <BottomNavigation
              showLabels
              value={repartidorNavValue}
              onChange={(_, value) => {
                if (value === 'more') return
                navigate(value)
              }}
            >
              <BottomNavigationAction label="Ruta" value="/repartidor" icon={<RouteIcon />} />
              <BottomNavigationAction label="Paradas" value="/repartidor/paradas" icon={<Inventory2Icon />} />
              <BottomNavigationAction label="Historial" value="/repartidor/historial" icon={<HistoryIcon />} />
              <BottomNavigationAction
                label="Más"
                value="more"
                icon={<MoreHorizIcon />}
                onClick={(event) => setRepartidorNavAnchor(event.currentTarget)}
              />
            </BottomNavigation>
          </Paper>

          <Menu
            anchorEl={repartidorNavAnchor}
            open={Boolean(repartidorNavAnchor)}
            onClose={() => setRepartidorNavAnchor(null)}
            anchorOrigin={{ horizontal: 'center', vertical: 'top' }}
            transformOrigin={{ horizontal: 'center', vertical: 'bottom' }}
            slotProps={{ paper: { sx: { mb: 1, minWidth: 220, borderRadius: 2 } } }}
          >
            <MenuItem onClick={() => { setRepartidorNavAnchor(null); navigate('/perfil') }}>
              <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Mi perfil</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setRepartidorNavAnchor(null); setOpenChangePassword(true) }}>
              <ListItemIcon><LockIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Cambiar contraseña</ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { setRepartidorNavAnchor(null); handleLogout() }} sx={{ color: 'error.main' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText>Cerrar sesión</ListItemText>
            </MenuItem>
          </Menu>
        </>
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
          <Box sx={{ display: 'flex' }}>
            {hasSidebar && !isAccessDeniedPage && <Box sx={{ width: sidebarOpen ? 240 : 0, flexShrink: 0, transition: 'width 0.25s ease' }} />}
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                py: { xs: 2, sm: 3 },
                px: { xs: 2, sm: 3 },
                pb: isMobile && isRepartidorArea ? 11 : undefined,
                color: isDarkPremium ? 'rgba(255,255,255,0.92)' : undefined,
              }}
            >
              <Box sx={{ maxWidth: 1400, mx: 'auto', width: '100%' }}>
                <Outlet context={user} />
              </Box>
            </Box>
          </Box>
        )}
      </ThemeProvider>
    </Box>
  )
}

export default Layout
