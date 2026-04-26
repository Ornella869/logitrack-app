import { Routes, Route, Navigate } from 'react-router-dom'
import { Snackbar, Alert } from '@mui/material'
import type { User } from '../../types'
import { useRepartidorState } from '../../hooks/useRepartidorState'
import RoutesDashboard from './RoutesDashboard'
import RouteDetail from './RouteDetail'

interface RepartidorAppProps {
  user: User
}

export default function RepartidorApp({ user }: RepartidorAppProps) {
  const { state, hideSnackbar } = useRepartidorState()

  return (
    <>
      <Routes>
        <Route index element={<RoutesDashboard user={user} />} />
        <Route path="ruta/:id" element={<RouteDetail />} />
        <Route path="*" element={<Navigate to="/repartidor" replace />} />
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
