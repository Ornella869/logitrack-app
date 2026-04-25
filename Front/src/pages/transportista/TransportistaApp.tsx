import { Routes, Route, Navigate } from 'react-router-dom'
import { Snackbar, Alert } from '@mui/material'
import type { User } from '../../types'
import { useTransportistaState } from '../../hooks/useTransportistaState'
import RoutesDashboard from './RoutesDashboard'
import RouteDetail from './RouteDetail'

interface TransportistaAppProps {
  user: User
}

export default function TransportistaApp({ user }: TransportistaAppProps) {
  const { state, hideSnackbar } = useTransportistaState()

  return (
    <>
      <Routes>
        <Route index element={<RoutesDashboard user={user} />} />
        <Route path="ruta/:id" element={<RouteDetail />} />
        <Route path="*" element={<Navigate to="/transportista" replace />} />
      </Routes>

      <Snackbar
        open={state.snackbar.open}
        autoHideDuration={3500}
        onClose={hideSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={hideSnackbar}
          severity={state.snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {state.snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}
