import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import EditIcon from '@mui/icons-material/Edit'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { plantillaEmailService, type PlantillaEmail } from '../services/plantillaEmailService'
import { formatInstantArgentina } from '../utils/argentinaDate'

export default function PlantillasEmailPage() {
  const navigate = useNavigate()
  const [plantillas, setPlantillas] = useState<PlantillaEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    plantillaEmailService
      .listar()
      .then(setPlantillas)
      .catch(() => setError('No se pudieron cargar las plantillas.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1100, mx: 'auto' }}>
      <Stack spacing={3}>
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
            <EmailIcon color="primary" />
            <Typography variant="h4" fontWeight={800}>Plantillas de Email</Typography>
          </Stack>
          <Typography color="text.secondary">
            Personalizá el asunto y cuerpo de cada notificación para tu provincia.
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Grid container spacing={2}>
          {plantillas.map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p.evento}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderLeft: p.esPersonalizada ? '4px solid #1976D2' : '4px solid #e0e0e0',
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: 3 },
                }}
              >
                <CardActionArea sx={{ height: '100%' }} onClick={() => navigate(`/plantillas-email/${p.evento}`)}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
                      <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>
                        {p.eventoNombre}
                      </Typography>
                      {p.esPersonalizada ? (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
                          label="Personalizada"
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={<RadioButtonUncheckedIcon sx={{ fontSize: 14 }} />}
                          label="Por defecto"
                          size="small"
                          variant="outlined"
                          sx={{ color: 'text.secondary', borderColor: '#ccc' }}
                        />
                      )}
                    </Stack>

                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 1.5, fontStyle: 'italic', fontSize: '0.8rem' }}
                      noWrap
                    >
                      {p.asunto}
                    </Typography>

                    {p.modificadoEn && (
                      <Typography variant="caption" color="text.disabled">
                        Última edición: {formatInstantArgentina(p.modificadoEn)}
                      </Typography>
                    )}

                    <Box sx={{ mt: 2 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={(e) => { e.stopPropagation(); navigate(`/plantillas-email/${p.evento}`) }}
                      >
                        Editar
                      </Button>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Stack>
    </Box>
  )
}
