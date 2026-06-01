import { useOutletContext } from 'react-router-dom'
import { Alert, Box, Typography } from '@mui/material'
import StoreIcon from '@mui/icons-material/Store'
import BranchManagement from '../components/BranchManagement'
import type { User } from '../types'

export default function SucursalesPage() {
  const user = useOutletContext<User>()

  if (user.role !== 'gerente') {
    return <Alert severity="warning">Solo el Gerente puede acceder a esta sección.</Alert>
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>
        <StoreIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Sucursales
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Gestioná las sucursales de tu provincia{user.provincia ? ` (${user.provincia})` : ''}
      </Typography>
      <BranchManagement
        gerenteProvincia={user.provincias && user.provincias.length > 0 ? user.provincias.join(', ') : (user.provincia ?? undefined)}
        gerenteId={user.id}
        gerenteName={`${user.name} ${user.lastname}`}
      />
    </Box>
  )
}
