import { useState, useEffect } from 'react'
import {
  Box,
  Container,
  Grid,
  Typography,
  Card,
  Avatar,
  Rating,
  TextField,
  Button,
  Chip,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
} from '@mui/material'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'
import SendIcon from '@mui/icons-material/Send'
import type { SelectChangeEvent } from '@mui/material'
import type { Review } from './landingData'
import { MOCK_REVIEWS, avatarColor, categoryLabel, categoryColor } from './landingData'
import { RevealBox } from './landingUtils'

interface ReviewsSectionProps {
  reviewsRef: React.RefObject<HTMLElement | null>
}

export default function ReviewsSection({ reviewsRef }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>(MOCK_REVIEWS)
  const [page, setPage] = useState(0)
  const [nr, setNr] = useState({
    name: '',
    role: '',
    category: 'general' as Review['category'],
    rating: 5,
    comment: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [nrError, setNrError] = useState('')

  const totalPages = Math.ceil(reviews.length / 3)

  useEffect(() => {
    const t = setInterval(() => setPage((p) => (p + 1) % totalPages), 5000)
    return () => clearInterval(t)
  }, [totalPages])

  const visible = reviews.slice(page * 3, page * 3 + 3)
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0

  const handleSubmit = () => {
    if (!nr.name.trim()) { setNrError('Ingresá tu nombre'); return }
    if (!nr.comment.trim()) { setNrError('Ingresá un comentario'); return }
    const initials = nr.name.trim().split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    const review: Review = {
      id: Date.now().toString(),
      name: nr.name.trim(),
      role: nr.role.trim() || 'Usuario',
      category: nr.category,
      rating: nr.rating,
      comment: nr.comment.trim(),
      date: new Date().toLocaleDateString('es-AR'),
      avatar: initials,
    }
    setReviews((prev) => [review, ...prev])
    setNr({ name: '', role: '', category: 'general', rating: 5, comment: '' })
    setSubmitted(true)
    setNrError('')
    setPage(0)
  }

  const closeSubmittedToast = () => {
    setSubmitted(false)
  }

  return (
    <Box component="section" ref={reviewsRef} sx={{ py: { xs: 8, md: 12 }, bgcolor: '#F0F8FF' }}>
      <Container maxWidth="lg">
        {/* Header */}
        <RevealBox>
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="overline" sx={{ color: '#0288D1', fontWeight: 700, letterSpacing: '2px', fontSize: '0.75rem' }}>
              OPINIONES
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 900, mt: 1, fontSize: { xs: '1.8rem', md: '2.4rem' }, color: '#1A2027' }}>
              Lo que dicen nuestros clientes
            </Typography>

            {/* Average rating */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 900, fontSize: '3.5rem', color: '#0288D1', lineHeight: 1 }}>
                  {avg.toFixed(1)}
                </Typography>
                <Rating value={avg} precision={0.1} readOnly size="large" sx={{ '& .MuiRating-iconFilled': { color: '#FFB300' } }} />
                <Typography sx={{ color: '#546E7A', fontSize: '0.85rem', mt: 0.5 }}>
                  Basado en {reviews.length} reseñas
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, ml: 3 }}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = reviews.filter((r) => r.rating === star).length
                  const pct = reviews.length ? (count / reviews.length) * 100 : 0
                  return (
                    <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#546E7A', width: 12, textAlign: 'right' }}>{star}</Typography>
                      <Box component="span" sx={{ color: '#FFB300', fontSize: '0.75rem' }}>★</Box>
                      <Box sx={{ width: { xs: 80, sm: 120 }, height: 6, bgcolor: '#E0E7EF', borderRadius: '3px', overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: '#FFB300', borderRadius: '3px', transition: 'width 1s ease' }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.72rem', color: '#90A4AE', width: 18 }}>{count}</Typography>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          </Box>
        </RevealBox>

        {/* Carousel */}
        <Grid container spacing={3} sx={{ mb: 2 }}>
          {visible.map((review, i) => (
            <Grid item xs={12} sm={6} md={4} key={review.id}>
              <RevealBox delay={i * 100}>
                <Card sx={{
                  p: 3, height: '100%', borderRadius: '18px',
                  border: '1px solid #E8F4FD',
                  boxShadow: '0 2px 12px rgba(2,136,209,0.06)',
                  display: 'flex', flexDirection: 'column',
                  transition: 'all 0.3s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 32px rgba(2,136,209,0.12)' },
                }}>
                  <FormatQuoteIcon sx={{ color: '#B3E5FC', fontSize: 32, mb: 1 }} />
                  <Typography sx={{ color: '#37474F', fontSize: '0.92rem', lineHeight: 1.75, flex: 1, mb: 2.5 }}>
                    {review.comment}
                  </Typography>
                  <Box>
                    <Rating value={review.rating} readOnly size="small" sx={{ '& .MuiRating-iconFilled': { color: '#FFB300' }, mb: 1.5 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Avatar sx={{ width: 40, height: 40, fontSize: '0.75rem', fontWeight: 700, bgcolor: avatarColor(review.avatar) }}>
                        {review.avatar}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#1A2027' }}>{review.name}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#78909C' }}>{review.role}</Typography>
                      </Box>
                      <Chip
                        label={categoryLabel[review.category]}
                        size="small"
                        sx={{ bgcolor: `${categoryColor[review.category]}15`, color: categoryColor[review.category], fontWeight: 700, fontSize: '0.65rem', borderRadius: '6px' }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: '0.7rem', color: '#B0BEC5', mt: 1 }}>{review.date}</Typography>
                  </Box>
                </Card>
              </RevealBox>
            </Grid>
          ))}
        </Grid>

        {/* Carousel dots */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 3, mb: 6 }}>
          {Array.from({ length: totalPages }).map((_, i) => (
            <Box
              key={i}
              onClick={() => setPage(i)}
              sx={{
                width: i === page ? 24 : 8, height: 8, borderRadius: '4px',
                bgcolor: i === page ? '#0288D1' : '#B3E5FC',
                cursor: 'pointer', transition: 'all 0.3s ease',
              }}
            />
          ))}
        </Box>

        {/* Leave a review form */}
        <RevealBox delay={100}>
          <Card sx={{ p: { xs: 3, md: 5 }, borderRadius: '24px', border: '2px solid #E1F5FE', boxShadow: '0 8px 32px rgba(2,136,209,0.08)' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, color: '#1A2027' }}>
              Dejá tu reseña
            </Typography>
            <Typography sx={{ color: '#546E7A', mb: 3.5, fontSize: '0.95rem' }}>
              Tu opinión nos ayuda a mejorar y a que otros clientes tomen mejores decisiones.
            </Typography>

            {nrError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setNrError('')}>
                {nrError}
              </Alert>
            )}

            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Tu nombre *"
                  fullWidth
                  value={nr.name}
                  onChange={(e) => setNr((p) => ({ ...p, name: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Tu rol / empresa (opcional)"
                  fullWidth
                  value={nr.role}
                  onChange={(e) => setNr((p) => ({ ...p, role: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Categoría</InputLabel>
                  <Select
                    value={nr.category}
                    label="Categoría"
                    onChange={(e: SelectChangeEvent) => setNr((p) => ({ ...p, category: e.target.value as Review['category'] }))}
                    sx={{ borderRadius: '12px' }}
                  >
                    <MenuItem value="entrega">Tiempo de entrega</MenuItem>
                    <MenuItem value="vehiculo">Vehículo</MenuItem>
                    <MenuItem value="general">General</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography sx={{ fontSize: '0.85rem', color: '#546E7A', fontWeight: 600 }}>Calificación *</Typography>
                  <Rating
                    value={nr.rating}
                    onChange={(_, val) => setNr((p) => ({ ...p, rating: val ?? 5 }))}
                    size="large"
                    sx={{ '& .MuiRating-iconFilled': { color: '#FFB300' }, '& .MuiRating-iconHover': { color: '#FF8F00' } }}
                  />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Tu comentario *"
                  fullWidth
                  multiline
                  rows={3}
                  value={nr.comment}
                  onChange={(e) => setNr((p) => ({ ...p, comment: e.target.value }))}
                  placeholder="Contanos tu experiencia con LogiTrack..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
                />
              </Grid>
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  size="large"
                  endIcon={<SendIcon />}
                  onClick={handleSubmit}
                  sx={{
                    background: 'linear-gradient(135deg,#0288D1,#0277BD)',
                    borderRadius: '12px',
                    px: 4,
                    fontWeight: 700,
                    boxShadow: '0 4px 16px rgba(2,136,209,0.35)',
                    '&:hover': { background: 'linear-gradient(135deg,#0277BD,#01579B)', transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(2,136,209,0.45)' },
                    transition: 'all 0.25s ease',
                  }}
                >
                  Publicar reseña
                </Button>
              </Grid>
            </Grid>
          </Card>
        </RevealBox>

        <Snackbar
          open={submitted}
          autoHideDuration={3000}
          onClose={closeSubmittedToast}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert severity="success" variant="filled" onClose={closeSubmittedToast}>
            ¡Gracias por tu reseña! Ya aparece en el listado.
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  )
}
