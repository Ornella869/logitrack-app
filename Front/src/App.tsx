import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard from './pages/Dashboard'
import ShipmentDetail from './pages/ShipmentDetail'
import ShipmentLabel from './pages/ShipmentLabel'
import Layout from './components/Layout'
import RepartidorDashboard from './pages/repartidor/RepartidorDashboard'
import LandingPage from './pages/landing/LandingPage'
import AccessDenied from './pages/AccessDenied'
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

        <Route
          path="/login"
          element={
            user
              ? <Navigate to={isRepartidorRole(user.role) ? '/repartidor' : '/app'} />
              : <LoginPage onLogin={handleLogin} sessionExpired={sessionExpired} />
          }
        />
        <Route
          path="/register"
          element={
            user ? <Navigate to={isRepartidorRole(user.role) ? '/repartidor' : '/app'} /> : <RegisterPage />
          }
        />

        {/* Rutas autenticadas (cualquier rol) */}
        <Route
          element={
            user ? <Layout user={user} onLogout={handleLogout} /> : <Navigate to="/login" />
          }
        >
          {/* Rutas comunes — el componente decide qué hacer según rol */}
          <Route path="/shipment/:id" element={<ShipmentDetail />} />
          <Route path="/shipment/:id/etiqueta" element={<ShipmentLabel />} />

          {/* Repartidor */}
          <Route
            path="/repartidor"
            element={
              user && isRepartidorRole(user.role) ? (
                <RepartidorDashboard />
              ) : (
                <AccessDenied user={user as User} />
              )
            }
          />

          {/* Operador / Supervisor / Administrador */}
          <Route
            path="/app"
            element={
              user && !isRepartidorRole(user.role) ? (
                <Dashboard />
              ) : (
                <AccessDenied user={user as User} />
              )
            }
          />
        </Route>

        <Route
          path="/access-denied"
          element={user ? <AccessDenied user={user} /> : <Navigate to="/login" />}
        />

        <Route path="*" element={<Navigate to={user ? (isRepartidorRole(user.role) ? '/repartidor' : '/app') : '/login'} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
