import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import {
  Box, Typography, Rating, TextField, Button, CircularProgress,
  Paper, Alert
} from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import StarIcon from '@mui/icons-material/Star'
import { getEncuesta, responderEncuesta, type EncuestaInfo } from '../services/satisfaccionService'

const LABELS: Record<number, string> = {
  1: 'Muy mala',
  2: 'Mala',
  3: 'Regular',
  4: 'Buena',
  5: 'Excelente',
}

export default function SatisfaccionPage() {
  const { token } = useParams<{ token: string }>()
  const [encuesta, setEncuesta] = useState<EncuestaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [rating, setRating] = useState<number | null>(null)
  const [hover, setHover] = useState(-1)
  const [comentario, setComentario] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) return
    getEncuesta(token)
      .then(data => {
        setEncuesta(data)
        if (data.yaRespondida) {
          setRating(data.calificacion ?? null)
          setComentario(data.comentario ?? '')
        }
      })
      .catch(() => setError('Encuesta no encontrada o link inválido.'))
      .finally(() => setLoading(false))
  }, [token])

  const handleSubmit = async () => {
    if (!token || !rating) return
    setSubmitting(true)
    try {
      await responderEncuesta(token, rating, comentario.trim() || undefined)
      setSubmitted(true)
    } catch {
      setError('No se pudo enviar la encuesta. Intentalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" sx={{ background: '#0f172a' }}>
        <CircularProgress sx={{ color: '#7c3aed' }} />
      </Box>
    )
  }

  if (error && !encuesta) {
    return (
      <Box minHeight="100vh" display="flex" alignItems="center" justifyContent="center" sx={{ background: '#0f172a', p: 2 }}>
        <Paper sx={{ p: 4, borderRadius: 3, background: '#1e293b', border: '1px solid #334155', maxWidth: 420, textAlign: 'center' }}>
          <Typography color="error" variant="h6">Link inválido</Typography>
          <Typography sx={{ color: '#94a3b8', mt: 1 }}>Este link de encuesta no existe o ya venció.</Typography>
        </Paper>
      </Box>
    )
  }

  const isAnswered = encuesta?.yaRespondida || submitted

  return (
    <Box
      minHeight="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      sx={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', p: 2 }}
    >
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 3,
          background: '#1e293b',
          border: '1px solid #334155',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            p: 3,
            textAlign: 'center',
          }}
        >
          <LocalShippingIcon sx={{ fontSize: 44, color: 'white', mb: 1 }} />
          <Typography variant="h5" fontWeight={700} color="white">
            LogiTrack
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, mt: 0.5 }}>
            Encuesta de satisfacción
          </Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          {encuesta && (
            <Typography sx={{ color: '#94a3b8', fontSize: 14, mb: 3 }}>
              Envío <strong style={{ color: '#e2e8f0' }}>{encuesta.paqueteCodigo}</strong> —{' '}
              hola <strong style={{ color: '#e2e8f0' }}>{encuesta.destinatarioNombre}</strong>
            </Typography>
          )}

          {isAnswered ? (
            /* Estado: ya respondida */
            <Box textAlign="center" py={2}>
              <CheckCircleOutlineIcon sx={{ fontSize: 56, color: '#22c55e', mb: 1 }} />
              <Typography variant="h6" fontWeight={700} sx={{ color: '#e2e8f0' }}>
                {submitted ? '¡Gracias por tu respuesta!' : 'Ya respondiste esta encuesta'}
              </Typography>
              <Typography sx={{ color: '#94a3b8', mt: 1, fontSize: 14 }}>
                {submitted
                  ? 'Tu opinion nos ayuda a mejorar el servicio.'
                  : 'Ya registramos tu calificación anteriormente.'}
              </Typography>
              {rating !== null && (
                <Box mt={2}>
                  <Rating
                    value={rating}
                    readOnly
                    icon={<StarIcon fontSize="large" sx={{ color: '#f59e0b' }} />}
                    emptyIcon={<StarIcon fontSize="large" sx={{ color: '#334155' }} />}
                  />
                  {comentario && (
                    <Typography sx={{ color: '#cbd5e1', fontSize: 13, mt: 1, fontStyle: 'italic' }}>
                      "{comentario}"
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          ) : (
            /* Formulario */
            <>
              <Typography variant="h6" fontWeight={600} sx={{ color: '#e2e8f0', mb: 1 }}>
                ¿Cómo fue tu experiencia?
              </Typography>
              <Typography sx={{ color: '#94a3b8', fontSize: 13, mb: 3 }}>
                Calificá la entrega de tu paquete del 1 al 5.
              </Typography>

              <Box display="flex" flexDirection="column" alignItems="center" gap={1} mb={3}>
                <Rating
                  size="large"
                  value={rating}
                  onChange={(_, val) => setRating(val)}
                  onChangeActive={(_, val) => setHover(val)}
                  icon={<StarIcon sx={{ fontSize: 42, color: '#f59e0b' }} />}
                  emptyIcon={<StarIcon sx={{ fontSize: 42, color: '#334155' }} />}
                />
                {(hover > 0 || rating !== null) && (
                  <Typography sx={{ color: '#f59e0b', fontSize: 14, fontWeight: 600 }}>
                    {LABELS[hover > 0 ? hover : (rating ?? 0)]}
                  </Typography>
                )}
              </Box>

              <TextField
                label="Comentario (opcional)"
                multiline
                rows={3}
                fullWidth
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                inputProps={{ maxLength: 500 }}
                sx={{
                  mb: 3,
                  '& .MuiOutlinedInput-root': {
                    color: '#e2e8f0',
                    '& fieldset': { borderColor: '#334155' },
                    '&:hover fieldset': { borderColor: '#7c3aed' },
                    '&.Mui-focused fieldset': { borderColor: '#7c3aed' },
                  },
                  '& .MuiInputLabel-root': { color: '#64748b' },
                  '& .MuiInputLabel-root.Mui-focused': { color: '#a78bfa' },
                }}
                placeholder="Contanos tu experiencia..."
              />

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Button
                variant="contained"
                fullWidth
                disabled={!rating || submitting}
                onClick={handleSubmit}
                sx={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  color: 'white',
                  fontWeight: 700,
                  py: 1.3,
                  borderRadius: 2,
                  '&:hover': { background: 'linear-gradient(135deg, #6d28d9, #5b21b6)' },
                  '&:disabled': { background: '#1e293b', color: '#475569' },
                }}
              >
                {submitting ? <CircularProgress size={22} sx={{ color: 'white' }} /> : 'Enviar calificación'}
              </Button>
            </>
          )}
        </Box>

        <Box sx={{ px: 3, pb: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 11, color: '#334155' }}>
            LogiTrack · Sistema de seguimiento de envíos
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
