import { Box, Typography } from '@mui/material'
import { useOutletContext } from 'react-router-dom'
import RepartidoresList from '../components/RepartidoresList'
import type { User } from '../types'

export default function RepartidoresPage() {
  const user = useOutletContext<User>()

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          Repartidores
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Consultá el listado completo de repartidores registrados y gestioná su disponibilidad.
        </Typography>
      </Box>

      <RepartidoresList userRole={user.role} canTransfer={user.role === 'gerente'} />
    </Box>
  )
}
