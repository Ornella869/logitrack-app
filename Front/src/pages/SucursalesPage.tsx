import { useOutletContext } from 'react-router-dom'
import { Alert, Box, Typography } from '@mui/material'
import StoreIcon from '@mui/icons-material/Store'
import BranchManagement from '../components/BranchManagement'
import type { User } from '../types'

export default function SucursalesPage() {
  const user = useOutletContext<User>()

  if (user.role !== 'administrador') {
    return <Alert severity="warning">Solo el Administrador puede acceder a esta sección.</Alert>
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
        <StoreIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Sucursales
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Gestioná las sucursales de tu empresa
      </Typography>
      <BranchManagement />
    </Box>
  )
}
