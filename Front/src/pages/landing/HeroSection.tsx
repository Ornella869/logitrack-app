import { Box, Container, Grid, Typography, Button, Card, Chip, Avatar } from '@mui/material'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { avatarColor } from './landingData'

interface HeroSectionProps {
  onScrollToLogin: () => void
  onScrollToHow: () => void
  onScrollToAbout: () => void
  sectionRef: React.RefObject<HTMLElement | null>
}

export default function HeroSection({ onScrollToLogin, onScrollToHow, onScrollToAbout, sectionRef }: HeroSectionProps) {
  return (
    <Box
      component="section"
      ref={sectionRef}
      sx={{
        minHeight: '100vh',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: 'linear-gradient(135deg,#012849 0%,#01579B 40%,#0288D1 70%,#29B6F6 100%)',
      }}
    >
      {/* Warehouse image overlay */}
      <Box
        sx={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: "url('/warehouse.jpg')",
          backgroundSize: 'cover', backgroundPosition: 'center',
          opacity: 0.15,
        }}
      />

      {/* Animated blobs */}
      {[
        { s: 520, t: '-18%', l: '-12%', d: 18, dl: 0 },
        { s: 360, t: '58%', r: '-8%', d: 14, dl: 3 },
        { s: 260, t: '18%', r: '16%', d: 10, dl: 6 },
      ].map((b, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute', borderRadius: '50%',
            width: b.s, height: b.s,
            top: b.t,
            left: (b as { l?: string }).l,
            right: (b as { r?: string }).r,
            background: 'rgba(255,255,255,0.04)',
            animation: `blob ${b.d}s ease-in-out ${b.dl}s infinite`,
            '@keyframes blob': {
              '0%,100%': { transform: 'scale(1) translate(0,0)' },
              '33%': { transform: 'scale(1.08) translate(15px,-20px)' },
              '66%': { transform: 'scale(0.95) translate(-10px,15px)' },
            },
            zIndex: 0,
          }}
        />
      ))}

      {/* Moving truck */}
      <Box
        sx={{
          position: 'absolute', bottom: '10%', zIndex: 1,
          animation: 'truck 18s linear infinite',
          '@keyframes truck': {
            '0%': { left: '-80px', opacity: 0 },
            '5%': { opacity: 0.07 },
            '92%': { opacity: 0.07 },
            '100%': { left: '105%', opacity: 0 },
          },
        }}
      >
        <LocalShippingIcon sx={{ fontSize: 110, color: '#fff' }} />
      </Box>

      <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, pt: { xs: 12, md: 10 }, pb: 8 }}>
        <Grid container spacing={5} alignItems="center">
          {/* Left */}
          <Grid item xs={12} md={6}>
            {/* Badge */}
            <Box
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75,
                bgcolor: 'rgba(255,255,255,0.13)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.22)',
                borderRadius: '24px', px: 2, py: 0.75, mb: 3,
                animation: 'hf 0.7s ease forwards', opacity: 0,
                '@keyframes hf': {
                  from: { opacity: 0, transform: 'translateY(16px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 13, color: '#80DEEA' }} />
              <Typography sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, fontSize: '0.75rem' }}>
                Sistema de logística líder en Argentina
              </Typography>
            </Box>

            {/* Title */}
            <Typography
              variant="h1"
              sx={{
                color: '#fff', fontWeight: 900,
                fontSize: { xs: '2.5rem', sm: '3.2rem', md: '4rem' },
                lineHeight: 1.08, mb: 2.5,
                textShadow: '0 2px 24px rgba(0,0,0,0.28)',
                animation: 'hf 0.7s ease 0.15s forwards', opacity: 0,
              }}
            >
              Logística{' '}
              <Box
                component="span"
                sx={{
                  background: 'linear-gradient(90deg,#4FC3F7,#80DEEA)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                inteligente
              </Box>
              {' '}para tu empresa
            </Typography>

            {/* Subtitle */}
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.78)',
                fontSize: { xs: '1rem', md: '1.1rem' },
                lineHeight: 1.75, mb: 4, maxWidth: 500,
                animation: 'hf 0.7s ease 0.3s forwards', opacity: 0,
              }}
            >
              Gestioná envíos, rutas y flotas en tiempo real. Transparencia total,
              entregas a tiempo y control absoluto desde una sola plataforma.
            </Typography>

            {/* Buttons */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', animation: 'hf 0.7s ease 0.45s forwards', opacity: 0 }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={onScrollToLogin}
                sx={{
                  bgcolor: '#fff', color: '#0277BD', fontWeight: 800,
                  fontSize: '1rem', px: 3.5, py: 1.5, borderRadius: '14px',
                  boxShadow: '0 4px 20px rgba(255,255,255,0.25)',
                  '&:hover': { bgcolor: '#E1F5FE', transform: 'translateY(-2px)', boxShadow: '0 8px 28px rgba(255,255,255,0.35)' },
                  transition: 'all 0.25s ease',
                }}
              >
                Comenzar ahora
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={onScrollToHow}
                sx={{
                  borderColor: 'rgba(255,255,255,0.45)', color: '#fff',
                  fontWeight: 700, fontSize: '1rem', px: 3.5, py: 1.5, borderRadius: '14px',
                  '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)', transform: 'translateY(-2px)' },
                  transition: 'all 0.25s ease',
                }}
              >
                Ver cómo funciona
              </Button>
            </Box>

            {/* Social proof */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 4, animation: 'hf 0.7s ease 0.6s forwards', opacity: 0 }}>
              <Box sx={{ display: 'flex' }}>
                {['MG', 'RS', 'AR', 'DM'].map((init, i) => (
                  <Avatar
                    key={init}
                    sx={{
                      width: 32, height: 32, fontSize: '0.65rem', fontWeight: 700,
                      bgcolor: avatarColor(init),
                      ml: i > 0 ? '-8px' : 0,
                      border: '2px solid rgba(255,255,255,0.3)',
                    }}
                  >
                    {init}
                  </Avatar>
                ))}
              </Box>
              <Box>
                <Box sx={{ display: 'flex' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Box key={s} component="span" sx={{ color: '#FFD54F', fontSize: '0.9rem' }}>★</Box>
                  ))}
                </Box>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', fontWeight: 600 }}>
                  +2,400 clientes satisfechos
                </Typography>
              </Box>
            </Box>
          </Grid>

          {/* Right: floating cards */}
          <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Box sx={{ position: 'relative', height: 440 }}>
              {/* Tracking card */}
              <Card
                sx={{
                  position: 'absolute', top: 0, left: 30, right: 0,
                  bgcolor: 'rgba(255,255,255,0.11)', backdropFilter: 'blur(18px)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  borderRadius: '22px', p: 2.5,
                  boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
                  animation: 'fcard 7s ease-in-out infinite',
                  '@keyframes fcard': {
                    '0%,100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-14px)' },
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(79,195,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LocalShippingIcon sx={{ color: '#4FC3F7', fontSize: 24 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>Envío en tránsito</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem' }}>TRK-2026-001847</Typography>
                  </Box>
                  <Chip label="En ruta" size="small" sx={{ bgcolor: 'rgba(79,195,247,0.18)', color: '#4FC3F7', fontWeight: 700, fontSize: '0.68rem' }} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 1 }}>
                  {['Recibido', 'Procesado', 'En ruta', 'Entregado'].map((step, i) => (
                    <Box key={step} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, flex: 1 }}>
                      <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: i < 3 ? '#4FC3F7' : 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {i < 3 && <CheckCircleIcon sx={{ fontSize: 16, color: '#012849' }} />}
                      </Box>
                      <Typography sx={{ color: i < 3 ? '#4FC3F7' : 'rgba(255,255,255,0.35)', fontSize: '0.6rem', fontWeight: 600, textAlign: 'center' }}>
                        {step}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Card>

              {/* Stat card left */}
              <Card sx={{ position: 'absolute', bottom: 80, left: 0, width: 155, p: 2, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.95)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'fcard 8s ease-in-out 1s infinite' }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#546E7A', fontWeight: 600, mb: 0.5 }}>Entregas hoy</Typography>
                <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, color: '#0288D1', lineHeight: 1 }}>
                  98<Box component="span" sx={{ fontSize: '1rem' }}>%</Box>
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#4CAF50', fontWeight: 600 }}>↑ +3% vs ayer</Typography>
              </Card>

              {/* Stat card right */}
              <Card sx={{ position: 'absolute', bottom: 80, right: 10, width: 155, p: 2, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.95)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', animation: 'fcard 6s ease-in-out 2s infinite' }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#546E7A', fontWeight: 600, mb: 0.5 }}>Rutas activas</Typography>
                <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, color: '#0288D1', lineHeight: 1 }}>24</Typography>
                <Typography sx={{ fontSize: '0.65rem', color: '#546E7A', fontWeight: 600 }}>en tiempo real</Typography>
              </Card>
            </Box>
          </Grid>
        </Grid>

        {/* Scroll indicator */}
        <Box
          sx={{ display: 'flex', justifyContent: 'center', mt: { xs: 6, md: 4 }, animation: 'hf 0.7s ease 0.8s forwards', opacity: 0 }}
        >
          <Box
            sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
            onClick={onScrollToAbout}
          >
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Scroll
            </Typography>
            <Box sx={{ width: 2, height: 40, bgcolor: 'rgba(255,255,255,0.25)', borderRadius: '2px', position: 'relative', overflow: 'hidden' }}>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40%', bgcolor: 'rgba(255,255,255,0.7)', borderRadius: '2px', animation: 'scrollDot 2s ease-in-out infinite', '@keyframes scrollDot': { '0%': { top: 0 }, '100%': { top: '60%' } } }} />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}
