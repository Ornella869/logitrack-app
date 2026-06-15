import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import EnviosPage from './pages/EnviosPage'
import CalendarizarPage from './pages/CalendarizarPage'
import CalendarioOperativoPage from './pages/CalendarioOperativoPage'
import RutasActivasPage from './pages/RutasActivasPage'
import DetalleRutaPage from './pages/DetalleRutaPage'
import AuditoriaPage from './pages/AuditoriaPage'
import NotificacionesAuditoriaPage from './pages/NotificacionesAuditoriaPage'
import MiPlanPage from './pages/MiPlanPage'
import ReportesPage from './pages/ReportesPage'
import TarifasPage from './pages/TarifasPage'
import OjoPatronConfigPage from './pages/OjoPatronConfigPage'
import AlertasPage from './pages/AlertasPage'
import IncidenciasPage from './pages/IncidenciasPage'
import IncidenciaDetallePage from './pages/IncidenciaDetallePage'
import SucursalesPage from './pages/SucursalesPage'
import PuntosPickUpPage from './pages/PuntosPickUpPage'
import PickUpOperacionPage from './pages/PickUpOperacionPage'
import PickUpHistorialPage from './pages/PickUpHistorialPage'
import RepartidoresPage from './pages/RepartidoresPage'
import PerfilRendimientoPage from './pages/PerfilRendimientoPage'
import PermisosPage from './pages/PermisosPage'
import MlMetricasPage from './pages/MlMetricasPage'
import ProyeccionPersonalPage from './pages/ProyeccionPersonalPage'
import ShipmentDetail from './pages/ShipmentDetail'
import ShipmentLabel from './pages/ShipmentLabel'
import TrackingPublicPage from './pages/TrackingPublicPage'
import PortalClientePublico from './pages/PortalClientePublico'
import SatisfaccionPage from './pages/SatisfaccionPage'
import SatisfaccionMetricasPage from './pages/SatisfaccionMetricasPage'
import PlantillasEmailPage from './pages/PlantillasEmailPage'
import PlantillaEmailEditPage from './pages/PlantillaEmailEditPage'
import Layout from './components/Layout'
import RepartidorDashboard from './pages/repartidor/RepartidorDashboard'
import RepartidorHistorialPage from './pages/repartidor/RepartidorHistorialPage'
import ClienteDashboard from './pages/ClienteDashboard'
import LandingPage from './pages/landing/LandingPage'
import AccessDenied from './pages/AccessDenied'
import ProfilePage from './pages/ProfilePage'
import type { User } from './types'
import { normalizeUserRole } from './utils/roleUtils'
import { permissionService } from './services/permissionService'

const LAST_ACTIVITY_STORAGE_KEY = 'sessionLastActivityAt'
const PERMISSIONS_STORAGE_KEY = 'userPermissions'
const LOGOUT_EVENT_NAME = 'logitrack:logout'
const DEFAULT_SESSION_TIMEOUT_MS = 15 * 60 * 1000
const parsedSessionTimeout = Number(import.meta.env.VITE_SESSION_TIMEOUT_MS)
const SESSION_TIMEOUT_MS = Number.isFinite(parsedSessionTimeout) && parsedSessionTimeout > 0
  ? parsedSessionTimeout
  : DEFAULT_SESSION_TIMEOUT_MS

const clearStoredSession = () => {
  localStorage.removeItem('user')
  localStorage.removeItem('authToken')
  localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
  localStorage.removeItem(PERMISSIONS_STORAGE_KEY)
}

const touchSessionActivity = () => {
  localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, Date.now().toString())
}

const readStoredPermissions = (): Set<string> => {
  try {
    const storedPermissions = localStorage.getItem(PERMISSIONS_STORAGE_KEY)
    const parsedPermissions = storedPermissions ? JSON.parse(storedPermissions) : []
    return new Set(Array.isArray(parsedPermissions) ? parsedPermissions.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

const storePermissions = (items: Iterable<string>) => {
  localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(Array.from(items)))
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [permissions, setPermissions] = useState<Set<string>>(() => readStoredPermissions())
  const [permissionsLoading, setPermissionsLoading] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('user')
    const authToken = localStorage.getItem('authToken')
    const storedLastActivity = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)

    if (!storedUser || !authToken) {
      clearStoredSession()
      setLoading(false)
      return
    }

    try {
      const parsedUser = JSON.parse(storedUser) as User
      const lastActivity = storedLastActivity ? Number(storedLastActivity) : Date.now()
      const sessionIsExpired = Number.isFinite(lastActivity) && Date.now() - lastActivity > SESSION_TIMEOUT_MS

      if (sessionIsExpired) {
        clearStoredSession()
        setSessionExpired(true)
      } else {
        const normalizedUser: User = {
          ...parsedUser,
          role: normalizeUserRole(parsedUser.role),
        }

        if (normalizedUser.role !== parsedUser.role) {
          localStorage.setItem('user', JSON.stringify(normalizedUser))
        }

        setPermissionsLoading(true)
        setUser(normalizedUser)
        touchSessionActivity()
      }
    } catch {
      clearStoredSession()
    }
    setLoading(false)
  }, [])

  const handleLogin = (userData: User) => {
    setPermissionsLoading(true)
    setUser(userData)
    setSessionExpired(false)
    localStorage.setItem('user', JSON.stringify(userData))
    touchSessionActivity()
  }

  const handleLogout = () => {
    setUser(null)
    setSessionExpired(false)
    clearStoredSession()
  }

  useEffect(() => {
    if (!user) {
      setPermissions(new Set())
      if (!loading) {
        setPermissionsLoading(false)
      }
      return
    }

    const loadPermissions = (showLoading = false) => {
      if (showLoading) setPermissionsLoading(true)
      void permissionService.getMine()
        .then((items) => {
          const nextPermissions = new Set(items)
          setPermissions(nextPermissions)
          storePermissions(nextPermissions)
          if (showLoading) setPermissionsLoading(false)
        })
        .catch(() => {
          setPermissions(readStoredPermissions())
          if (showLoading) setPermissionsLoading(false)
        })
    }

    loadPermissions(true)
    const handlePermissionsChanged = () => loadPermissions()
    window.addEventListener('logitrack:permissions', handlePermissionsChanged)
    return () => window.removeEventListener('logitrack:permissions', handlePermissionsChanged)
  }, [loading, user])

  useEffect(() => {
    const handler = () => {
      try {
        const stored = localStorage.getItem('user')
        if (stored) setUser(JSON.parse(stored) as User)
      } catch { /* ignore */ }
    }
    window.addEventListener('logitrack:userUpdate', handler)
    return () => window.removeEventListener('logitrack:userUpdate', handler)
  }, [])

  useEffect(() => {
    const handleExternalLogout = () => {
      setUser(null)
      setSessionExpired(false)
    }

    window.addEventListener(LOGOUT_EVENT_NAME, handleExternalLogout)
    return () => window.removeEventListener(LOGOUT_EVENT_NAME, handleExternalLogout)
  }, [])

  useEffect(() => {
    if (!user) {
      return
    }

    let inactivityTimer: number | undefined
    const activityEvents: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart']

    const resetInactivityTimer = () => {
      touchSessionActivity()

      if (inactivityTimer) {
        window.clearTimeout(inactivityTimer)
      }

      inactivityTimer = window.setTimeout(() => {
        setUser(null)
        setSessionExpired(true)
        clearStoredSession()
      }, SESSION_TIMEOUT_MS)
    }

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, resetInactivityTimer, { passive: true })
    })
    resetInactivityTimer()

    return () => {
      if (inactivityTimer) {
        window.clearTimeout(inactivityTimer)
      }
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, resetInactivityTimer)
      })
    }
  }, [user])

  if (loading || (user && permissionsLoading)) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

  const homePath = getHomePath(user?.role, permissions)
  const permitted = (permission: string, element: JSX.Element) =>
    user && permissions.has(permission) ? element : <Navigate to="/access-denied" replace />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/seguimiento/:trackingId" element={<TrackingPublicPage />} />
        <Route path="/portal-cliente" element={<PortalClientePublico />} />
        <Route path="/encuesta/:token" element={<SatisfaccionPage />} />

        <Route
          path="/login"
          element={
            user
              ? <Navigate to={homePath} />
              : <LoginPage onLogin={handleLogin} sessionExpired={sessionExpired} />
          }
        />
        <Route
          path="/register"
          element={<Navigate to="/login" replace state={{ registrationDisabled: true }} />}
        />

        {/* Rutas autenticadas (cualquier rol) */}
        <Route
          element={
            user ? <Layout user={user} permissions={permissions} onLogout={handleLogout} /> : <Navigate to="/login" />
          }
        >
          <Route path="/access-denied" element={<AccessDenied user={user as User} />} />

          {/* Rutas comunes — el componente decide qué hacer según rol */}
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/shipment/:id" element={<ShipmentDetail permissions={permissions} />} />
          <Route path="/shipment/:id/etiqueta" element={<ShipmentLabel />} />

          {/* Repartidor */}
          <Route
            path="/repartidor"
            element={
              permitted('ruta_repartidor', <RepartidorDashboard />)
            }
          />
          <Route
            path="/repartidor/paradas"
            element={
              permitted('ruta_repartidor', <RepartidorDashboard />)
            }
          />
          <Route
            path="/repartidor/historial"
            element={
              permitted('historial_repartidor', <RepartidorHistorialPage />)
            }
          />

          {/* Portal cliente */}
          <Route
            path="/cliente"
            element={
              user && user.role === 'cliente' ? (
                <ClienteDashboard />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* Operador / Supervisor / Administrador */}
          <Route
            path="/app"
            element={
              user && permissions.has('dashboard')
                ? <Dashboard />
                : <Navigate to={homePath === '/app' ? '/access-denied' : homePath} replace />
            }
          />
          <Route
            path="/envios"
            element={
              permitted('envios_ver', <EnviosPage permissions={permissions} />)
            }
          />

          {/* Supervisor: página dedicada de calendarización */}
          <Route
            path="/calendarizar"
            element={
              permitted('calendarizacion', <CalendarizarPage />)
            }
          />

          {/* Supervisor: listado de repartidores */}
          <Route
            path="/repartidores"
            element={
              permitted('repartidores', <RepartidoresPage />)
            }
          />

          <Route
            path="/calendario"
            element={
              permitted('calendario', <CalendarioOperativoPage permissions={permissions} />)
            }
          />
          <Route
            path="/rutas-activas"
            element={
              permitted('rutas_activas', <RutasActivasPage />)
            }
          />
          <Route
            path="/rutas-activas/:repartidorId"
            element={
              permitted('rutas_activas', <DetalleRutaPage />)
            }
          />

          {/* Admin: auditoría y plan */}
          <Route
            path="/auditoria"
            element={
              permitted('auditoria', <AuditoriaPage />)
            }
          />
          <Route
            path="/auditoria-notificaciones"
            element={
              permitted('auditoria_notificaciones', <NotificacionesAuditoriaPage />)
            }
          />
          <Route
            path="/mi-plan"
            element={
              permitted('mi_plan', <MiPlanPage />)
            }
          />
          {/* Épica D: sucursales las gestiona el Gerente (por provincia) */}
          <Route
            path="/sucursales"
            element={
              permitted('sucursales', <SucursalesPage />)
            }
          />
          {/* G1L-86/87/88 + Épica D: tarifas y zonas peligrosas las gestiona el Gerente */}
          <Route
            path="/pickups"
            element={
              permitted('pickups', <PuntosPickUpPage />)
            }
          />
          <Route
            path="/pickup-operacion"
            element={
              permitted('pickup_operacion', <PickUpOperacionPage />)
            }
          />
          <Route
            path="/pickup-historial"
            element={
              permitted('pickup_historial', <PickUpHistorialPage />)
            }
          />
          <Route
            path="/tarifas"
            element={
              permitted('tarifas', <TarifasPage />)
            }
          />
          {/* G1L-61 + Épica D: umbral del Ojo del Patrón lo gestiona el Gerente */}
          <Route
            path="/ojo-patron"
            element={
              permitted('ojo_patron', <OjoPatronConfigPage />)
            }
          />

          {/* G1L-91: Dashboard de incidencias (Supervisor) */}
          <Route
            path="/incidencias"
            element={
              permitted('incidencias', <IncidenciasPage />)
            }
          />
          <Route
            path="/incidencias/:id"
            element={
              permitted('incidencias', <IncidenciaDetallePage />)
            }
          />

          {/* G1L-84: Panel de alertas de paquetes sin estado final (Supervisor) */}
          <Route
            path="/alertas"
            element={
              permitted('alertas', <AlertasPage />)
            }
          />

          {/* G1L-26: Reportes de volumen (Supervisor / Gerente) */}
          <Route
            path="/reportes"
            element={
              permitted('reportes', <ReportesPage />)
            }
          />

          {/* Encuesta satisfacción — métricas (Supervisor / Gerente / Administrador) */}
          <Route
            path="/satisfaccion"
            element={
              permitted('satisfaccion', <SatisfaccionMetricasPage />)
            }
          />

          {/* G1L-114: plantillas de email provinciales (Gerente) */}
          <Route
            path="/plantillas-email"
            element={permitted('plantillas_email', <PlantillasEmailPage />)}
          />
          <Route
            path="/plantillas-email/:evento"
            element={permitted('plantillas_email', <PlantillaEmailEditPage />)}
          />

          {/* Supervisor / Admin: perfil de rendimiento de un repartidor */}
          <Route
            path="/repartidor/:repartidorId/rendimiento"
            element={
              permitted('perfil_rendimiento', <PerfilRendimientoPage permissions={permissions} />)
            }
          />
          <Route path="/permisos" element={permitted('gestionar_permisos', <PermisosPage />)} />
          <Route
            path="/admin/ml-metricas"
            element={
              permitted('auditoria', <MlMetricasPage />)
            }
          />

          <Route
            path="/proyeccion-personal"
            element={
              user && (user.role === 'supervisor' || user.role === 'administrador')
                ? <ProyeccionPersonalPage />
                : <Navigate to="/access-denied" replace />
            }
          />
        </Route>

        <Route path="*" element={<Navigate to={user ? homePath : '/login'} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App

function getHomePath(role: string | undefined, permissions: Set<string>): string {
  if (role === 'cliente') return '/cliente'
  const options: Array<[string, string]> = role === 'repartidor'
    ? [
        ['ruta_repartidor', '/repartidor'],
        ['envios_ver', '/envios'],
        ['calendarizacion', '/calendarizar'],
        ['repartidores', '/repartidores'],
        ['calendario', '/calendario'],
        ['rutas_activas', '/rutas-activas'],
        ['alertas', '/alertas'],
        ['incidencias', '/incidencias'],
        ['historial_repartidor', '/repartidor/historial'],
      ]
    : role === 'socio_pickup'
      ? [['pickup_operacion', '/pickup-operacion'], ['pickup_historial', '/pickup-historial']]
      : role === 'gerente'
        ? [['sucursales', '/sucursales'], ['reportes', '/reportes'], ['envios_ver', '/envios'], ['dashboard', '/app']]
        : role === 'operador'
          ? [
              ['envios_ver', '/envios'],
              ['calendarizacion', '/calendarizar'],
              ['repartidores', '/repartidores'],
              ['calendario', '/calendario'],
              ['rutas_activas', '/rutas-activas'],
              ['alertas', '/alertas'],
              ['incidencias', '/incidencias'],
              ['dashboard', '/app'],
            ]
      : [
          ['dashboard', '/app'],
          ['envios_ver', '/envios'],
          ['sucursales', '/sucursales'],
          ['calendarizacion', '/calendarizar'],
          ['reportes', '/reportes'],
        ]
  return options.find(([permission]) => permissions.has(permission))?.[1] ?? '/access-denied'
}
