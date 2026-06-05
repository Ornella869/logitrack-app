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
import SucursalesPage from './pages/SucursalesPage'
import PuntosPickUpPage from './pages/PuntosPickUpPage'
import PickUpOperacionPage from './pages/PickUpOperacionPage'
import RepartidoresPage from './pages/RepartidoresPage'
import PerfilRendimientoPage from './pages/PerfilRendimientoPage'
import ShipmentDetail from './pages/ShipmentDetail'
import ShipmentLabel from './pages/ShipmentLabel'
import TrackingPublicPage from './pages/TrackingPublicPage'
import PortalClientePublico from './pages/PortalClientePublico'
import SatisfaccionPage from './pages/SatisfaccionPage'
import SatisfaccionMetricasPage from './pages/SatisfaccionMetricasPage'
import Layout from './components/Layout'
import RepartidorDashboard from './pages/repartidor/RepartidorDashboard'
import RepartidorHistorialPage from './pages/repartidor/RepartidorHistorialPage'
import ClienteDashboard from './pages/ClienteDashboard'
import LandingPage from './pages/landing/LandingPage'
import AccessDenied from './pages/AccessDenied'
import ProfilePage from './pages/ProfilePage'
import type { User } from './types'
import { isRepartidorRole, normalizeUserRole } from './utils/roleUtils'

const LAST_ACTIVITY_STORAGE_KEY = 'sessionLastActivityAt'
const DEFAULT_SESSION_TIMEOUT_MS = 15 * 60 * 1000
const parsedSessionTimeout = Number(import.meta.env.VITE_SESSION_TIMEOUT_MS)
const SESSION_TIMEOUT_MS = Number.isFinite(parsedSessionTimeout) && parsedSessionTimeout > 0
  ? parsedSessionTimeout
  : DEFAULT_SESSION_TIMEOUT_MS

const clearStoredSession = () => {
  localStorage.removeItem('user')
  localStorage.removeItem('authToken')
  localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
}

const touchSessionActivity = () => {
  localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, Date.now().toString())
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sessionExpired, setSessionExpired] = useState(false)

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

        setUser(normalizedUser)
        touchSessionActivity()
      }
    } catch {
      clearStoredSession()
    }
    setLoading(false)
  }, [])

  const handleLogin = (userData: User) => {
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    )
  }

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
              ? <Navigate to={isRepartidorRole(user.role) ? '/repartidor' : user.role === 'cliente' ? '/cliente' : user.role === 'socio_pickup' ? '/pickup-operacion' : '/app'} />
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
            user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          }
        >
          <Route path="/access-denied" element={<AccessDenied user={user as User} />} />

          {/* Rutas comunes — el componente decide qué hacer según rol */}
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/shipment/:id" element={<ShipmentDetail />} />
          <Route path="/shipment/:id/etiqueta" element={<ShipmentLabel />} />

          {/* Repartidor */}
          <Route
            path="/repartidor"
            element={
              user && isRepartidorRole(user.role) ? (
                <RepartidorDashboard />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/repartidor/paradas"
            element={
              user && isRepartidorRole(user.role) ? (
                <RepartidorDashboard />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/repartidor/historial"
            element={
              user && isRepartidorRole(user.role) ? (
                <RepartidorHistorialPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
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
              user && !isRepartidorRole(user.role) && user.role !== 'cliente' ? (
                user.role === 'socio_pickup' ? <Navigate to="/pickup-operacion" replace />
                  : user.role === 'operador' ? <Navigate to="/envios" replace />
                  : user.role === 'gerente' ? <Navigate to="/sucursales" replace />
                  : <Dashboard />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/envios"
            element={
              user && (user.role === 'operador' || user.role === 'supervisor') ? (
                <EnviosPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* Supervisor: página dedicada de calendarización */}
          <Route
            path="/calendarizar"
            element={
              user && user.role === 'supervisor' ? (
                <CalendarizarPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* Supervisor / Admin: calendario operativo y rutas activas */}
          <Route
            path="/repartidores"
            element={
              user && user.role === 'supervisor' ? (
                <RepartidoresPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          <Route
            path="/calendario"
            element={
              user && (user.role === 'supervisor' || user.role === 'administrador') ? (
                <CalendarioOperativoPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/rutas-activas"
            element={
              user && (user.role === 'supervisor' || user.role === 'administrador') ? (
                <RutasActivasPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/rutas-activas/:repartidorId"
            element={
              user && (user.role === 'supervisor' || user.role === 'administrador') ? (
                <DetalleRutaPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* Admin: auditoría y plan */}
          <Route
            path="/auditoria"
            element={
              user && (user.role === 'administrador' || user.role === 'supervisor') ? (
                <AuditoriaPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/auditoria-notificaciones"
            element={
              user && user.role === 'administrador' ? (
                <NotificacionesAuditoriaPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/mi-plan"
            element={
              user && user.role === 'administrador' ? (
                <MiPlanPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          {/* Épica D: sucursales las gestiona el Gerente (por provincia) */}
          <Route
            path="/sucursales"
            element={
              user && user.role === 'gerente' ? (
                <SucursalesPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          {/* G1L-86/87/88 + Épica D: tarifas y zonas peligrosas las gestiona el Gerente */}
          <Route
            path="/pickups"
            element={
              user && (user.role === 'gerente' || user.role === 'supervisor' || user.role === 'administrador') ? (
                <PuntosPickUpPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/pickup-operacion"
            element={
              user && user.role === 'socio_pickup' ? (
                <PickUpOperacionPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          <Route
            path="/tarifas"
            element={
              user && user.role === 'gerente' ? (
                <TarifasPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
          {/* G1L-61 + Épica D: umbral del Ojo del Patrón lo gestiona el Gerente */}
          <Route
            path="/ojo-patron"
            element={
              user && (user.role === 'gerente' || user.role === 'supervisor' || user.role === 'administrador') ? (
                <OjoPatronConfigPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* G1L-91: Dashboard de incidencias (Supervisor) */}
          <Route
            path="/incidencias"
            element={
              user && user.role === 'supervisor' ? (
                <IncidenciasPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* G1L-84: Panel de alertas de paquetes sin estado final (Supervisor) */}
          <Route
            path="/alertas"
            element={
              user && user.role === 'supervisor' ? (
                <AlertasPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* G1L-26: Reportes de volumen (Supervisor / Gerente) */}
          <Route
            path="/reportes"
            element={
              user && (user.role === 'supervisor' || user.role === 'gerente' || user.role === 'administrador') ? (
                <ReportesPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* Encuesta satisfacción — métricas (Supervisor / Gerente / Administrador) */}
          <Route
            path="/satisfaccion"
            element={
              user && (user.role === 'supervisor' || user.role === 'gerente' || user.role === 'administrador') ? (
                <SatisfaccionMetricasPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />

          {/* Supervisor / Admin: perfil de rendimiento de un repartidor */}
          <Route
            path="/repartidor/:repartidorId/rendimiento"
            element={
              user && (user.role === 'supervisor' || user.role === 'administrador') ? (
                <PerfilRendimientoPage />
              ) : (
                <Navigate to="/access-denied" replace />
              )
            }
          />
        </Route>

        <Route path="*" element={<Navigate to={user ? (isRepartidorRole(user.role) ? '/repartidor' : user.role === 'socio_pickup' ? '/pickup-operacion' : '/app') : '/login'} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
