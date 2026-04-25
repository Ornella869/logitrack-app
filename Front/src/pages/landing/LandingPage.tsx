import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Rating,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import ElectricBoltRoundedIcon from '@mui/icons-material/ElectricBoltRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import RouteRoundedIcon from '@mui/icons-material/RouteRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded'
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded'
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded'
import DirectionsCarFilledRoundedIcon from '@mui/icons-material/DirectionsCarFilledRounded'
import warehouseImage from '../../assets/warehouse.jpg'

type ReviewCategory = 'entrega' | 'vehiculo' | 'general'

interface Review {
  id: string
  name: string
  role: string
  company: string
  category: ReviewCategory
  rating: number
  comment: string
  date: string
}

const baseReviews: Review[] = [
  {
    id: '1',
    name: 'Martina González',
    role: 'Dueña de e-commerce',
    company: 'Marea Shop',
    category: 'entrega',
    rating: 5,
    comment: 'La promesa de entrega se cumple y el seguimiento se entiende perfecto. Mis clientes reciben más información y se nota.',
    date: '18/03/2026',
  },
  {
    id: '2',
    name: 'Roberto Sánchez',
    role: 'Jefe de operaciones',
    company: 'Distribuciones RS',
    category: 'vehiculo',
    rating: 4,
    comment: 'La visibilidad de la flota y el estado de los vehículos ayuda muchísimo para ordenar la operación diaria.',
    date: '15/03/2026',
  },
  {
    id: '3',
    name: 'Ana Rodríguez',
    role: 'Compradora frecuente',
    company: 'Cliente final',
    category: 'general',
    rating: 5,
    comment: 'Es una web clara, rápida y muy linda. Entendí todo sin ayuda y pude ver el estado del envío enseguida.',
    date: '12/03/2026',
  },
  {
    id: '4',
    name: 'Luciano Pérez',
    role: 'Encargado de depósito',
    company: 'Norte Cargo',
    category: 'entrega',
    rating: 5,
    comment: 'Nos organizamos mejor con las rutas y bajamos reclamos. La experiencia es moderna y transmite confianza.',
    date: '09/03/2026',
  },
  {
    id: '5',
    name: 'Sofía Herrera',
    role: 'Coordinadora logística',
    company: 'Fresh Go',
    category: 'vehiculo',
    rating: 5,
    comment: 'Me gusta que se destaquen los vehículos y los tiempos. Sirve para explicar el servicio a clientes nuevos.',
    date: '06/03/2026',
  },
  {
    id: '6',
    name: 'Diego Martínez',
    role: 'Mayorista',
    company: 'Punto Mayor',
    category: 'general',
    rating: 4,
    comment: 'Tiene movimiento justo, sin quedar cargada. Se siente como una plataforma real lista para presentar.',
    date: '02/03/2026',
  },
]

const categoryLabel: Record<ReviewCategory, string> = {
  entrega: 'Tiempo de entrega',
  vehiculo: 'Vehículos',
  general: 'Experiencia general',
}

const categoryColor: Record<ReviewCategory, string> = {
  entrega: '#0288D1',
  vehiculo: '#00897B',
  general: '#7B61FF',
}

const quickStats = [
  { value: '98%', label: 'entregas a tiempo', helper: 'coordinación de punta a punta' },
  { value: '24/7', label: 'seguimiento visible', helper: 'clientes y operación conectados' },
  { value: '+2.4k', label: 'reseñas positivas', helper: 'experiencias reales sobre el servicio' },
  { value: '12 min', label: 'promedio de asignación', helper: 'vehículo y ruta sugeridos rápido' },
]

const features = [
  {
    icon: <RouteRoundedIcon />,
    title: 'Rutas inteligentes',
    description: 'Planificá recorridos, priorizá entregas urgentes y reducÍ kilómetros improductivos.',
  },
  {
    icon: <Inventory2RoundedIcon />,
    title: 'Seguimiento de envíos',
    description: 'Mostrá al cliente el avance de cada pedido con una línea de tiempo simple y visual.',
  },
  {
    icon: <DirectionsCarFilledRoundedIcon />,
    title: 'Visibilidad de vehículos',
    description: 'Destacá disponibilidad, tipo de unidad y rendimiento para tomar decisiones más rápido.',
  },
  {
    icon: <ShieldRoundedIcon />,
    title: 'Operación confiable',
    description: 'Centralizá la información crítica para que la logística sea más previsible y segura.',
  },
]

const steps = [
  {
    title: 'Recibí el pedido',
    text: 'Registrá origen, destino y prioridad en una interfaz fácil de usar para cualquier persona.',
    icon: <StorefrontRoundedIcon />,
  },
  {
    title: 'Asigná la mejor unidad',
    text: 'Elegí el vehículo adecuado según carga, distancia y disponibilidad operativa.',
    icon: <WarehouseRoundedIcon />,
  },
  {
    title: 'SeguÍ la entrega',
    text: 'Monitoreá tiempos estimados, estados y desempeño con feedback de clientes reales.',
    icon: <ScheduleRoundedIcon />,
  },
]

function AnimatedNumber({ value }: { value: string }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { threshold: 0.35 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Box ref={ref}>
      <Typography
        variant="h3"
        sx={{
          fontWeight: 900,
          letterSpacing: '-1px',
          color: '#0B1F33',
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          opacity: visible ? 1 : 0,
          transition: 'all 0.65s ease',
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showTop, setShowTop] = useState(false)
  const [reviews, setReviews] = useState<Review[]>(baseReviews)
  const [reviewForm, setReviewForm] = useState({
    name: '',
    role: '',
    company: '',
    category: 'general' as ReviewCategory,
    rating: 5,
    comment: '',
  })
  const [reviewError, setReviewError] = useState('')

  const closeReviewToast = () => {
    setReviewSent(false)
  }
  const [reviewSent, setReviewSent] = useState(false)

  const heroRef = useRef<HTMLElement | null>(null)
  const aboutRef = useRef<HTMLElement | null>(null)
  const reviewsRef = useRef<HTMLElement | null>(null)
  const loginRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
      setShowTop(window.scrollY > 550)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const average = useMemo(() => {
    if (!reviews.length) return 0
    return reviews.reduce((acc, current) => acc + current.rating, 0) / reviews.length
  }, [reviews])

  const grouped = useMemo(
    () => ({
      entrega: reviews.filter((review) => review.category === 'entrega').length,
      vehiculo: reviews.filter((review) => review.category === 'vehiculo').length,
      general: reviews.filter((review) => review.category === 'general').length,
    }),
    [reviews],
  )

  const topReviews = reviews.slice(0, 3)

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }

  const handleReviewSubmit = () => {
    if (!reviewForm.name.trim() || !reviewForm.comment.trim()) {
      setReviewError('Completá tu nombre y comentario para dejar la reseña.')
      return
    }

    setReviews((current) => [
      {
        id: Date.now().toString(),
        name: reviewForm.name.trim(),
        role: reviewForm.role.trim() || 'Usuario',
        company: reviewForm.company.trim() || 'Experiencia compartida',
        category: reviewForm.category,
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim(),
        date: new Date().toLocaleDateString('es-AR'),
      },
      ...current,
    ])

    setReviewForm({
      name: '',
      role: '',
      company: '',
      category: 'general',
      rating: 5,
      comment: '',
    })
    setReviewError('')
    setReviewSent(true)
  }

  const navItems: Array<{ label: string; ref: React.RefObject<HTMLElement | null> }> = [
    { label: 'Inicio', ref: heroRef },
    { label: 'Servicios', ref: aboutRef },
    { label: 'Reseñas', ref: reviewsRef },
    { label: 'Acceso', ref: loginRef },
  ]

  return (
    <Box sx={{ bgcolor: '#F4F9FE', overflowX: 'hidden' }}>
      <Box
        component="nav"
        sx={{
          position: 'fixed',
          inset: '0 0 auto 0',
          zIndex: 20,
          bgcolor: scrolled ? 'rgba(255,255,255,0.9)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(2,136,209,0.12)' : '1px solid transparent',
          transition: 'all 0.3s ease',
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1.5 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ cursor: 'pointer' }} onClick={() => scrollTo(heroRef)}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: '14px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg,#0288D1,#29B6F6)',
                  boxShadow: '0 12px 24px rgba(2,136,209,0.22)',
                }}
              >
                <LocalShippingRoundedIcon sx={{ color: '#fff' }} />
              </Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.15rem', color: scrolled ? '#0B1F33' : '#fff' }}>
                LogiTrack
              </Typography>
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  onClick={() => scrollTo(item.ref)}
                  sx={{
                    color: scrolled ? '#29465B' : 'rgba(255,255,255,0.9)',
                    fontWeight: 700,
                    '&:hover': { bgcolor: 'transparent', color: scrolled ? '#0288D1' : '#fff' },
                  }}
                >
                  {item.label}
                </Button>
              ))}
              <Button
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{
                  ml: 1,
                  borderRadius: '999px',
                  px: 2.5,
                  background: 'linear-gradient(135deg,#0288D1,#0277BD)',
                  boxShadow: '0 10px 22px rgba(2,136,209,0.28)',
                }}
              >
                Ingresar
              </Button>
            </Stack>

            <IconButton sx={{ display: { xs: 'inline-flex', md: 'none' }, color: scrolled ? '#0B1F33' : '#fff' }} onClick={() => setMenuOpen((current) => !current)}>
              {menuOpen ? <CloseRoundedIcon /> : <MenuRoundedIcon />}
            </IconButton>
          </Stack>
        </Container>

        {menuOpen && (
          <Paper square sx={{ display: { xs: 'block', md: 'none' }, px: 2, pb: 2 }}>
            <Stack spacing={1}>
              {navItems.map((item) => (
                <Button key={item.label} onClick={() => scrollTo(item.ref)} sx={{ justifyContent: 'flex-start' }}>
                  {item.label}
                </Button>
              ))}
            </Stack>
          </Paper>
        )}
      </Box>

      <Box
        component="section"
        ref={heroRef}
        sx={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          background: 'linear-gradient(135deg,#04213E 0%,#0C5EA7 42%,#19A5F2 100%)',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(rgba(4,33,62,0.65), rgba(4,33,62,0.3)), url(${warehouseImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.42,
          }}
        />

        {[
          { size: 420, top: '-12%', left: '-8%', duration: '20s' },
          { size: 280, top: '65%', left: '82%', duration: '16s' },
          { size: 220, top: '18%', left: '78%', duration: '13s' },
        ].map((orb, index) => (
          <Box
            key={index}
            sx={{
              position: 'absolute',
              width: orb.size,
              height: orb.size,
              top: orb.top,
              left: orb.left,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              filter: 'blur(8px)',
              animation: `float ${orb.duration} ease-in-out infinite`,
              '@keyframes float': {
                '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
                '50%': { transform: 'translateY(18px) translateX(-12px)' },
              },
            }}
          />
        ))}

        <Box
          sx={{
            position: 'absolute',
            bottom: { xs: '8%', md: '12%' },
            left: '-120px',
            animation: 'truckRun 18s linear infinite',
            '@keyframes truckRun': {
              '0%': { transform: 'translateX(0)', opacity: 0 },
              '5%': { opacity: 0.18 },
              '95%': { opacity: 0.18 },
              '100%': { transform: 'translateX(calc(100vw + 240px))', opacity: 0 },
            },
          }}
        >
          <LocalShippingRoundedIcon sx={{ color: 'rgba(255,255,255,0.9)', fontSize: 110 }} />
        </Box>

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, pt: { xs: 14, md: 12 }, pb: 10 }}>
          <Grid container spacing={5} alignItems="center">
            <Grid item xs={12} md={7}>
              <Chip
                icon={<ElectricBoltRoundedIcon />}
                label="Experiencia logística moderna e interactiva"
                sx={{
                  mb: 3,
                  px: 1,
                  bgcolor: 'rgba(255,255,255,0.14)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              />

              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.7rem', md: '4.3rem' },
                  lineHeight: 1.02,
                  letterSpacing: '-1.6px',
                  fontWeight: 900,
                  color: '#fff',
                  maxWidth: 740,
                }}
              >
                Una página de logística
                <Box component="span" sx={{ color: '#9DE7FF', display: 'inline' }}>
                  {' '}clara, linda y lista para usar
                </Box>
              </Typography>

              <Typography sx={{ mt: 3, maxWidth: 640, color: 'rgba(255,255,255,0.82)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.8 }}>
                Inspirada en plataformas modernas de delivery y operación, esta propuesta presenta envíos, rutas, vehículos,
                reseñas reales y acceso rápido desde una sola landing pensada para cualquier persona.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
                <Button
                  size="large"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  onClick={() => navigate('/login')}
                  sx={{
                    px: 3.5,
                    py: 1.4,
                    borderRadius: '16px',
                    background: '#fff',
                    color: '#0C5EA7',
                    fontWeight: 800,
                    '&:hover': { background: '#E1F5FE', transform: 'translateY(-2px)' },
                  }}
                >
                  Ir a iniciar sesión
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={() => scrollTo(reviewsRef)}
                  sx={{
                    px: 3.5,
                    py: 1.4,
                    borderRadius: '16px',
                    borderColor: 'rgba(255,255,255,0.4)',
                    color: '#fff',
                    '&:hover': { borderColor: '#fff', background: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  Ver comentarios y calificaciones
                </Button>
              </Stack>

              <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 4, flexWrap: 'wrap' }}>
                <Stack direction="row" spacing={-1}>
                  {['MG', 'RS', 'AR', 'LP'].map((initials, index) => (
                    <Avatar key={initials} sx={{ bgcolor: ['#29B6F6', '#7C4DFF', '#26A69A', '#FF7043'][index], border: '2px solid rgba(255,255,255,0.5)' }}>
                      {initials}
                    </Avatar>
                  ))}
                </Stack>
                <Box>
                  <Stack direction="row" spacing={0.25}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <StarRoundedIcon key={index} sx={{ color: '#FFD54F', fontSize: 18 }} />
                    ))}
                  </Stack>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', fontWeight: 600 }}>
                    Opiniones sobre tiempos de entrega, experiencia y vehículos.
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Box sx={{ position: 'relative', minHeight: 420 }}>
                <Card
                  sx={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    left: { xs: 0, md: 30 },
                    p: 2.5,
                    borderRadius: '24px',
                    color: '#fff',
                    backdropFilter: 'blur(16px)',
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    boxShadow: '0 20px 50px rgba(2,13,27,0.24)',
                    animation: 'panelFloat 7s ease-in-out infinite',
                    '@keyframes panelFloat': {
                      '0%, 100%': { transform: 'translateY(0)' },
                      '50%': { transform: 'translateY(-14px)' },
                    },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 800 }}>Seguimiento de envío</Typography>
                      <Typography sx={{ opacity: 0.72, fontSize: '0.82rem' }}>TRK-2026-000918</Typography>
                    </Box>
                    <Chip label="En ruta" sx={{ bgcolor: 'rgba(157,231,255,0.18)', color: '#9DE7FF', fontWeight: 700 }} />
                  </Stack>
                  <Stack spacing={1.5}>
                    {[
                      ['Recepción en depósito', 100],
                      ['Asignación de vehículo', 100],
                      ['Salida a reparto', 82],
                      ['Entrega final', 38],
                    ].map(([label, progress]) => (
                      <Box key={label}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                          <Typography sx={{ fontSize: '0.85rem', opacity: 0.92 }}>{label}</Typography>
                          <Typography sx={{ fontSize: '0.85rem', opacity: 0.72 }}>{progress}%</Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Number(progress)}
                          sx={{
                            height: 9,
                            borderRadius: '999px',
                            bgcolor: 'rgba(255,255,255,0.12)',
                            '& .MuiLinearProgress-bar': { borderRadius: '999px', bgcolor: '#9DE7FF' },
                          }}
                        />
                      </Box>
                    ))}
                  </Stack>
                </Card>

                <Card sx={{ position: 'absolute', left: 0, bottom: 56, p: 2.2, borderRadius: '18px', width: 180, boxShadow: '0 18px 38px rgba(8,34,58,0.22)' }}>
                  <Typography sx={{ color: '#507086', fontSize: '0.78rem', fontWeight: 700 }}>Vehículo asignado</Typography>
                  <Typography sx={{ mt: 0.6, fontWeight: 900, fontSize: '1.6rem', color: '#0B1F33' }}>Sprinter</Typography>
                  <Typography sx={{ color: '#0288D1', fontWeight: 700 }}>Disponible y monitoreada</Typography>
                </Card>

                <Card sx={{ position: 'absolute', right: 10, bottom: 0, p: 2.2, borderRadius: '18px', width: 190, boxShadow: '0 18px 38px rgba(8,34,58,0.22)' }}>
                  <Typography sx={{ color: '#507086', fontSize: '0.78rem', fontWeight: 700 }}>Satisfacción</Typography>
                  <Typography sx={{ mt: 0.6, fontWeight: 900, fontSize: '1.8rem', color: '#0B1F33' }}>4.9/5</Typography>
                  <Typography sx={{ color: '#26A69A', fontWeight: 700 }}>Reseñas activas en la web</Typography>
                </Card>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box component="section" ref={aboutRef} sx={{ mt: -5, position: 'relative', zIndex: 3 }}>
        <Container maxWidth="lg">
          <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: '28px', boxShadow: '0 20px 50px rgba(4,33,62,0.08)' }}>
            <Grid container spacing={3}>
              {quickStats.map((stat) => (
                <Grid item xs={12} sm={6} md={3} key={stat.label}>
                  <Box sx={{ p: 2 }}>
                    <AnimatedNumber value={stat.value} />
                    <Typography sx={{ mt: 1, fontWeight: 800, color: '#12324A' }}>{stat.label}</Typography>
                    <Typography sx={{ mt: 0.5, color: '#5B7488', lineHeight: 1.7 }}>{stat.helper}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 8, md: 10 } }}>
        <Grid container spacing={4} alignItems="stretch">
          <Grid item xs={12} md={5}>
            <Typography sx={{ color: '#0288D1', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
              Sobre la logística
            </Typography>
            <Typography variant="h3" sx={{ mt: 1.2, fontWeight: 900, color: '#0B1F33', lineHeight: 1.1 }}>
              Una experiencia digital pensada para explicar y vender mejor el servicio
            </Typography>
            <Typography sx={{ mt: 2.5, color: '#5B7488', lineHeight: 1.9 }}>
              La logística ya no es solo mover paquetes: también es comunicar estado, transmitir confianza y facilitar decisiones.
              Por eso esta landing combina storytelling, métricas, movimiento visual, reseñas y accesos claros para quienes operan y para quienes consultan.
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 3.5 }}>
              {[
                'Visual moderno con secciones claras y llamadas a la acción.',
                'Comentarios y calificaciones para generar confianza social.',
                'Ingreso rápido con cuentas demo para mostrar la plataforma.',
                'Formulario para reseñas sobre tiempo de entrega y vehículos.',
              ].map((item) => (
                <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                  <CheckCircleRoundedIcon sx={{ color: '#0288D1' }} />
                  <Typography sx={{ color: '#234158', fontWeight: 600 }}>{item}</Typography>
                </Stack>
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12} md={7}>
            <Grid container spacing={2.5}>
              {features.map((feature, index) => (
                <Grid item xs={12} sm={6} key={feature.title}>
                  <Card
                    sx={{
                      height: '100%',
                      borderRadius: '24px',
                      p: 0.5,
                      background: index % 2 === 0 ? 'linear-gradient(180deg,#FFFFFF 0%,#F4FAFF 100%)' : '#fff',
                      border: '1px solid rgba(2,136,209,0.1)',
                      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                      '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 18px 40px rgba(2,136,209,0.12)' },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ width: 52, height: 52, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: '#E1F5FE', color: '#0288D1', mb: 2 }}>
                        {feature.icon}
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#0B1F33' }}>{feature.title}</Typography>
                      <Typography sx={{ mt: 1.2, color: '#5B7488', lineHeight: 1.8 }}>{feature.description}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Container>

      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#EAF5FF' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography sx={{ color: '#0288D1', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
              Cómo funciona
            </Typography>
            <Typography variant="h3" sx={{ mt: 1.2, fontWeight: 900, color: '#0B1F33' }}>
              Simple para mostrar, simple para entender
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {steps.map((step, index) => (
              <Grid item xs={12} md={4} key={step.title}>
                <Card sx={{ height: '100%', borderRadius: '24px', p: 3, position: 'relative', overflow: 'hidden' }}>
                  <Chip label={`0${index + 1}`} sx={{ mb: 2, bgcolor: '#E1F5FE', color: '#0288D1', fontWeight: 800 }} />
                  <Box sx={{ width: 60, height: 60, borderRadius: '18px', display: 'grid', placeItems: 'center', bgcolor: '#0B1F33', color: '#fff', mb: 2.2 }}>
                    {step.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 800, color: '#0B1F33', fontSize: '1.15rem' }}>{step.title}</Typography>
                  <Typography sx={{ mt: 1.2, color: '#5B7488', lineHeight: 1.8 }}>{step.text}</Typography>
                  <Box sx={{ position: 'absolute', right: -35, bottom: -35, width: 120, height: 120, borderRadius: '50%', bgcolor: 'rgba(2,136,209,0.06)' }} />
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Box component="section" ref={reviewsRef} sx={{ py: { xs: 8, md: 10 } }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Typography sx={{ color: '#0288D1', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                Reseñas y calificaciones
              </Typography>
              <Typography variant="h3" sx={{ mt: 1.2, fontWeight: 900, color: '#0B1F33', lineHeight: 1.1 }}>
                Opiniones visibles sobre entregas, vehículos y experiencia general
              </Typography>

              <Paper sx={{ mt: 3, p: 3, borderRadius: '24px' }}>
                <Typography sx={{ fontSize: '3.2rem', fontWeight: 900, color: '#0288D1', lineHeight: 1 }}>{average.toFixed(1)}</Typography>
                <Rating value={average} precision={0.1} readOnly sx={{ mt: 1, '& .MuiRating-iconFilled': { color: '#FFB300' } }} />
                <Typography sx={{ mt: 1.5, color: '#5B7488' }}>Basado en {reviews.length} reseñas activas.</Typography>
                <Divider sx={{ my: 2.5 }} />
                <Stack spacing={1.3}>
                  {(['entrega', 'vehiculo', 'general'] as ReviewCategory[]).map((category) => (
                    <Box key={category}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                        <Typography sx={{ color: '#234158', fontWeight: 700 }}>{categoryLabel[category]}</Typography>
                        <Typography sx={{ color: categoryColor[category], fontWeight: 800 }}>{grouped[category]}</Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={(grouped[category] / Math.max(reviews.length, 1)) * 100}
                        sx={{
                          height: 10,
                          borderRadius: '999px',
                          bgcolor: '#E4EEF7',
                          '& .MuiLinearProgress-bar': { bgcolor: categoryColor[category], borderRadius: '999px' },
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={7}>
              <Grid container spacing={2.5}>
                {topReviews.map((review) => (
                  <Grid item xs={12} key={review.id}>
                    <Card sx={{ borderRadius: '24px', border: '1px solid rgba(2,136,209,0.08)', boxShadow: '0 12px 28px rgba(3,38,61,0.05)' }}>
                      <CardContent sx={{ p: 3.25 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ bgcolor: categoryColor[review.category], width: 52, height: 52, fontWeight: 800 }}>
                              {review.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontWeight: 800, color: '#0B1F33' }}>{review.name}</Typography>
                              <Typography sx={{ color: '#5B7488', fontSize: '0.92rem' }}>
                                {review.role} · {review.company}
                              </Typography>
                            </Box>
                          </Stack>
                          <Chip label={categoryLabel[review.category]} sx={{ bgcolor: `${categoryColor[review.category]}18`, color: categoryColor[review.category], fontWeight: 800 }} />
                        </Stack>
                        <Rating value={review.rating} readOnly sx={{ mt: 2, '& .MuiRating-iconFilled': { color: '#FFB300' } }} />
                        <Typography sx={{ mt: 1.8, color: '#2A4459', lineHeight: 1.9 }}>{review.comment}</Typography>
                        <Typography sx={{ mt: 1.8, color: '#8AA1B3', fontSize: '0.82rem' }}>{review.date}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>

          <Card sx={{ mt: 5, borderRadius: '28px', p: { xs: 3, md: 4 }, boxShadow: '0 20px 50px rgba(4,33,62,0.06)' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0B1F33' }}>
              Dejá tu reseña sobre entregas y vehículos
            </Typography>
            <Typography sx={{ mt: 1, color: '#5B7488', lineHeight: 1.8 }}>
              Sumá una opinión sobre tiempos de entrega, calidad del vehículo o la experiencia general de la página.
            </Typography>

            {reviewError && (
              <Alert severity="error" sx={{ mt: 3 }} onClose={() => setReviewError('')}>
                {reviewError}
              </Alert>
            )}

            <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
              <Grid item xs={12} md={4}>
                <TextField label="Nombre" fullWidth value={reviewForm.name} onChange={(event) => setReviewForm((current) => ({ ...current, name: event.target.value }))} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Rol" fullWidth value={reviewForm.role} onChange={(event) => setReviewForm((current) => ({ ...current, role: event.target.value }))} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Empresa o referencia" fullWidth value={reviewForm.company} onChange={(event) => setReviewForm((current) => ({ ...current, company: event.target.value }))} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField select label="Categoría" fullWidth value={reviewForm.category} onChange={(event) => setReviewForm((current) => ({ ...current, category: event.target.value as ReviewCategory }))}>
                  <MenuItem value="entrega">Tiempo de entrega</MenuItem>
                  <MenuItem value="vehiculo">Vehículos</MenuItem>
                  <MenuItem value="general">General</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={0.75}>
                  <Typography sx={{ color: '#234158', fontWeight: 700 }}>Calificación</Typography>
                  <Rating value={reviewForm.rating} onChange={(_, value) => setReviewForm((current) => ({ ...current, rating: value ?? 5 }))} sx={{ '& .MuiRating-iconFilled': { color: '#FFB300' } }} />
                </Stack>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Comentario"
                  fullWidth
                  multiline
                  minRows={4}
                  value={reviewForm.comment}
                  onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
                  placeholder="Contanos cómo fue la entrega, qué te pareció la presentación del servicio o cómo viste los vehículos."
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" endIcon={<SendRoundedIcon />} onClick={handleReviewSubmit} sx={{ borderRadius: '14px', px: 3, py: 1.2 }}>
                  Publicar reseña
                </Button>
              </Grid>
            </Grid>
          </Card>
        </Container>
      </Box>

      <Box component="section" ref={loginRef} sx={{ py: { xs: 8, md: 10 }, bgcolor: '#071D31' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography sx={{ color: '#4FC3F7', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
                Acceso a la plataforma
              </Typography>
              <Typography variant="h3" sx={{ mt: 1.2, color: '#fff', fontWeight: 900, lineHeight: 1.1 }}>
                Ingresá desde la pantalla de login que ya tenías
              </Typography>
              

              <Stack spacing={1.5} sx={{ mt: 3.5 }}>
                {[
                  'Orientada a mostrar la propuesta logística.',
        
                 'El registro puede realizarse desde su sección específica dentro de la plataforma.',
                ].map((item) => (
                  <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                    <CheckCircleRoundedIcon sx={{ color: '#4FC3F7' }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.84)', fontWeight: 600 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={5}>
              <Card sx={{ borderRadius: '28px', p: { xs: 3, md: 4 }, boxShadow: '0 24px 55px rgba(0,0,0,0.28)' }}>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#0B1F33' }}>
                  Accedé o creá tu cuenta
                </Typography>
                <Typography sx={{ mt: 1, color: '#5B7488', lineHeight: 1.8 }}>
                  Entrá desde la página de login del sistema o registrate para usar la plataforma.
                </Typography>

                <Stack spacing={2} sx={{ mt: 3 }}>
                  <Button variant="contained" size="large" onClick={() => navigate('/login')} sx={{ py: 1.35, borderRadius: '16px', fontWeight: 800 }}>
                    Ir a iniciar sesión
                  </Button>
                  <Button variant="outlined" size="large" onClick={() => navigate('/register')} sx={{ py: 1.35, borderRadius: '16px', fontWeight: 800 }}>
                    Crear cuenta nueva
                  </Button>
                </Stack>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Box sx={{ py: 4, bgcolor: '#04111D' }}>
        <Container maxWidth="lg">
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>LogiTrack</Typography>
              <Typography sx={{ mt: 0.8, color: 'rgba(255,255,255,0.62)' }}>
                Landing de logística con foco en seguimiento, vehículos, reseñas e inicio de sesión integrado.
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent={{ md: 'flex-end' }}>
                {[
                  { icon: <InsightsRoundedIcon />, text: 'Indicadores visibles' },
                  { icon: <SupportAgentRoundedIcon />, text: 'Experiencia clara' },
                  { icon: <ScheduleRoundedIcon />, text: 'Entregas y tiempos' },
                ].map((item) => (
                  <Chip
                    key={item.text}
                    icon={item.icon}
                    label={item.text}
                    sx={{ bgcolor: 'rgba(255,255,255,0.08)', color: '#D3E9F8' }}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      <Snackbar open={reviewSent} autoHideDuration={2500} onClose={closeReviewToast}>
        <Alert severity="success" variant="filled" onClose={closeReviewToast}>
          ¡Gracias! Tu reseña ya quedó visible en la página.
        </Alert>
      </Snackbar>

      {showTop && (
        <IconButton
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          sx={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 30,
            bgcolor: '#0288D1',
            color: '#fff',
            boxShadow: '0 14px 28px rgba(2,136,209,0.3)',
            '&:hover': { bgcolor: '#0277BD' },
          }}
        >
          <KeyboardArrowUpRoundedIcon />
        </IconButton>
      )}
    </Box>
  )
}
