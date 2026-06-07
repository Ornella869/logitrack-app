import { useState } from 'react'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import StarIcon from '@mui/icons-material/Star'
import StarBorderIcon from '@mui/icons-material/StarBorder'
import CloseIcon from '@mui/icons-material/Close'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { pickupService } from '../services/pickupService'

const STAR_LABELS = ['Muy malo', 'Malo', 'Regular', 'Bueno', 'Excelente']

interface Props {
  open: boolean
  onClose: () => void
  trackingCode: string
  puntoNombre: string
  // Si ya tiene una calificación previa, se pasa para modo lectura
  calificacionExistente?: {
    estrellas: number
    comentario?: string | null
    autorNombre?: string | null
  } | null
}

export default function CalificacionPickUpDialog({
  open,
  onClose,
  trackingCode,
  puntoNombre,
  calificacionExistente,
}: Props) {
  const [estrellas, setEstrellas] = useState(calificacionExistente?.estrellas ?? 0)
  const [hover, setHover] = useState(0)
  const [comentario, setComentario] = useState(calificacionExistente?.comentario ?? '')
  const [autorNombre, setAutorNombre] = useState(calificacionExistente?.autorNombre ?? '')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const soloLectura = !!calificacionExistente || enviado

  const handleEnviar = async () => {
    if (estrellas === 0) return
    setEnviando(true)
    setError(null)
    try {
      await pickupService.calificarExperiencia({ trackingCode, estrellas, comentario, autorNombre })
      setEnviado(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: string } })?.response?.data
      setError(typeof msg === 'string' ? msg : 'No se pudo guardar la calificación. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const estrellasActuales = hover || estrellas

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <StorefrontIcon color="action" />
          <Typography variant="subtitle1" fontWeight={700}>
            {soloLectura && !enviado ? 'Tu calificación' : enviado ? '¡Gracias!' : 'Calificá tu experiencia'}
          </Typography>
        </Stack>
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {enviado ? (
          <Stack alignItems="center" spacing={2} py={2}>
            <CheckCircleOutlineIcon sx={{ fontSize: 56, color: '#2e7d32' }} />
            <Typography fontWeight={700} textAlign="center">
              Tu calificación fue enviada correctamente.
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              Gracias por ayudarnos a mejorar el servicio en {puntoNombre}.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={2.5}>
            <Typography variant="body2" color="text.secondary">
              Contanos cómo fue tu experiencia en <strong>{puntoNombre}</strong>.
            </Typography>

            {/* Estrellas */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Calificación *
              </Typography>
              <Stack direction="row" spacing={0.5}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Tooltip key={n} title={STAR_LABELS[n - 1]} placement="top">
                    <IconButton
                      size="small"
                      onClick={() => !soloLectura && setEstrellas(n)}
                      onMouseEnter={() => !soloLectura && setHover(n)}
                      onMouseLeave={() => !soloLectura && setHover(0)}
                      sx={{ color: n <= estrellasActuales ? '#f59e0b' : 'action.disabled', p: 0.5 }}
                    >
                      {n <= estrellasActuales ? (
                        <StarIcon sx={{ fontSize: 36 }} />
                      ) : (
                        <StarBorderIcon sx={{ fontSize: 36 }} />
                      )}
                    </IconButton>
                  </Tooltip>
                ))}
              </Stack>
              {estrellasActuales > 0 && (
                <Typography variant="caption" sx={{ color: '#f59e0b', fontWeight: 600 }}>
                  {STAR_LABELS[estrellasActuales - 1]}
                </Typography>
              )}
            </Box>

            {/* Nombre del autor */}
            <TextField
              label="Tu nombre (opcional)"
              size="small"
              fullWidth
              value={autorNombre}
              onChange={(e) => !soloLectura && setAutorNombre(e.target.value)}
              inputProps={{ readOnly: soloLectura, maxLength: 80 }}
            />

            {/* Comentario */}
            <TextField
              label="Comentario (opcional)"
              size="small"
              fullWidth
              multiline
              minRows={3}
              value={comentario}
              onChange={(e) => !soloLectura && setComentario(e.target.value)}
              inputProps={{ readOnly: soloLectura, maxLength: 500 }}
              placeholder="¿Cómo fue la atención? ¿Estaba limpio y ordenado? ¿Fue fácil encontrar el lugar?"
            />

            {error && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      {!enviado && (
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={onClose} color="inherit">
            {soloLectura ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!soloLectura && (
            <Button
              variant="contained"
              onClick={() => void handleEnviar()}
              disabled={estrellas === 0 || enviando}
              startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ fontWeight: 700 }}
            >
              Enviar calificación
            </Button>
          )}
        </DialogActions>
      )}
      {enviado && (
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={onClose} sx={{ fontWeight: 700 }}>
            Cerrar
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
