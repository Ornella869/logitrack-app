import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import Dashboard from './pages/Dashboard'
import ShipmentDetail from './pages/ShipmentDetail'
import VehicleDetail from './pages/VehicleDetail'
import Layout from './components/Layout'
import RoutesDashboard from './pages/transportista/RoutesDashboard'
import RouteDetail from './pages/transportista/RouteDetail'
import LandingPage from './pages/landing/LandingPage'
import AccessDenied from './pages/AccessDenied'
import type { User } from './types'

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
        setUser(parsedUser)
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
              ? <Navigate to={user.role === 'transportista' ? '/transportista' : '/app'} />
              : <LoginPage onLogin={handleLogin} sessionExpired={sessionExpired} />
          }
        />
        <Route
          path="/register"
          element={
            user ? <Navigate to={user.role === 'transportista' ? '/transportista' : '/app'} /> : <RegisterPage />
          }
        />

        <Route
          path="/transportista"
          element={
            user?.role === 'transportista' ? (
              <Layout user={user} onLogout={handleLogout} />
            ) : user ? (
              <AccessDenied user={user} />
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route index element={<RoutesDashboard user={user as User} />} />
          <Route path="ruta/:id" element={<RouteDetail />} />
        </Route>

        <Route
          element={
            user ? (
              user.role === 'transportista' ? (
                <AccessDenied user={user} />
              ) : (
                <Layout user={user} onLogout={handleLogout} />
              )
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route path="/app" element={<Dashboard />} />
          <Route path="/shipment/:id" element={<ShipmentDetail />} />
          <Route path="/vehiculo/:id" element={<VehicleDetail />} />
        </Route>

        <Route path="*" element={<Navigate to={user ? (user.role === 'transportista' ? '/transportista' : '/app') : '/login'} />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
