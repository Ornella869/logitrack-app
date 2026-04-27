import { Box, CircularProgress, Typography } from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'

interface LoadingStateProps {
  message?: string
  minHeight?: string | number
  branded?: boolean
}

export default function LoadingState({
  message = 'Cargando...',
  minHeight = '240px',
  branded = false,
}: LoadingStateProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight={minHeight}
      gap={2}
    >
      {branded ? (
        <Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress size={56} thickness={3} />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LocalShippingIcon color="primary" fontSize="small" />
          </Box>
        </Box>
      ) : (
        <CircularProgress size={40} />
      )}
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        {message}
      </Typography>
    </Box>
  )
}
