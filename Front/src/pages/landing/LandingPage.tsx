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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
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
import WarehouseRoundedIcon from '@mui/icons-material/WarehouseRounded'
import DirectionsCarFilledRoundedIcon from '@mui/icons-material/DirectionsCarFilledRounded'
import warehouseImage from '../../assets/warehouse.jpg'
import { empresaService } from '../../services/empresaService'
import { leadService, type PlanInteres } from '../../services/leadService'

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
  { value: '98%', label: 'Entregas a tiempo', helper: 'Coordinación de punta a punta' },
  { value: '24/7', label: 'Seguimiento visible', helper: 'Clientes y operación conectados' },
  { value: '+2.4k', label: 'Reseñas positivas', helper: 'Experiencias reales sobre el servicio' },
  { value: '12 min', label: 'Promedio de asignación', helper: 'Vehículo y ruta sugeridos rápido' },
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
    title: 'Solicitá una demo',
    text: 'Completá el formulario comercial y contanos el volumen y tipo de envíos que gestiona tu empresa.',
    icon: <StorefrontRoundedIcon />,
    accentFrom: '#0A6FD8',
    accentTo: '#0E88DF',
  },
  {
    title: 'Definimos el plan ideal',
    text: 'Te asesoramos con una propuesta acorde a tu operación: cuentas, funciones y acompañamiento.',
    icon: <InsightsRoundedIcon />,
    accentFrom: '#0E88DF',
    accentTo: '#1498E3',
  },
  {
    title: 'Activamos tu cuenta Admin',
    text: 'Te entregamos el acceso inicial para administrar tu operación desde LogiTrack.',
    icon: <ShieldRoundedIcon />,
    accentFrom: '#1498E3',
    accentTo: '#1AA8DF',
  },
  {
    title: 'Configurás tu equipo',
    text: 'Desde la cuenta Admin creás usuarios Supervisor, Operador y Repartidor según tu estructura interna.',
    icon: <WarehouseRoundedIcon />,
    accentFrom: '#1AA8DF',
    accentTo: '#22B6D4',
  },
  {
    title: 'Operás tus envíos',
    text: 'Tu empresa gestiona sus envíos con trazabilidad completa y auditoría.',
    icon: <ScheduleRoundedIcon />,
    accentFrom: '#22B6D4',
    accentTo: '#26A69A',
  },
]

type LandingPlan = {
  name: string
  planValue: PlanInteres
  accountLimit: string
  price: string
  features: string[]
}

const fallbackPlans: LandingPlan[] = [
  {
    name: 'Básico',
    planValue: 'Basico',
    accountLimit: 'Hasta 50 cuentas',
    price: '$50.000 / mes',
    features: [
      'Registro y seguimiento de envios',
      'Estados de entrega y trazabilidad',
      'Dashboard operativo estandar',
      'Soporte por correo en horario laboral',
    ],
  },
  {
    name: 'Premium',
    planValue: 'Premium',
    accountLimit: 'Hasta 100 cuentas',
    price: '$180.000 / mes',
    features: [
      'Todo lo incluido en Basico',
      'Planificacion de rutas avanzada',
      'Reportes ejecutivos y metricas ampliadas',
      'Soporte prioritario y acompanamiento',
    ],
  },
]

const landingFeaturesByPlan: Record<PlanInteres, string[]> = {
  Basico: [
    'Registro y seguimiento de envios',
    'Estados de entrega y trazabilidad',
    'Dashboard operativo estandar',
    'Soporte por correo en horario laboral',
  ],
  Premium: [
    'Todo lo incluido en Basico',
    'Planificacion de rutas avanzada',
    'Reportes ejecutivos y metricas ampliadas',
    'Soporte prioritario y acompanamiento',
  ],
}

const COUNTRIES = [
  { code: 'AR', dial: '+54', name: 'Argentina', digits: 10 },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const initialLeadForm = {
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    plan: 'Basico' as PlanInteres,
    comments: '',
  }
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
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [leadDialogOpen, setLeadDialogOpen] = useState(false)
  const [leadSubmitting, setLeadSubmitting] = useState(false)
  const [leadSent, setLeadSent] = useState(false)
  const [leadError, setLeadError] = useState('')
  const [leadForm, setLeadForm] = useState(initialLeadForm)
  const [leadFormErrors, setLeadFormErrors] = useState<Partial<Record<'companyName' | 'contactName' | 'email' | 'phone' | 'plan', string>>>({})
  const [plans, setPlans] = useState<LandingPlan[]>(fallbackPlans)
  const selectedCountry = COUNTRIES[0]

  const closeReviewToast = () => {
    setReviewSent(false)
  }

  const closeLeadToast = () => {
    setLeadSent(false)
  }

  const resetLeadForm = () => {
    setLeadForm(initialLeadForm)
    setLeadFormErrors({})
    setLeadError('')
  }
  const [reviewSent, setReviewSent] = useState(false)

  const heroRef = useRef<HTMLElement | null>(null)
  const aboutRef = useRef<HTMLElement | null>(null)
  const reviewsRef = useRef<HTMLElement | null>(null)
  const plansRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40)
      setShowTop(window.scrollY > 550)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    let active = true

    const loadPlans = async () => {
      const catalogo = await empresaService.catalogo()
      if (!active || !catalogo.length) return

      const orderedPlans: PlanInteres[] = ['Basico', 'Premium']
      setPlans(
        orderedPlans
          .map((planValue) => {
            const plan = catalogo.find((item) => item.plan === planValue)
            if (!plan) return null

            return {
              name: plan.nombre,
              planValue,
              accountLimit: `Hasta ${plan.limiteCuentas} cuentas`,
              price: plan.precioMock,
              features: landingFeaturesByPlan[planValue],
            }
          })
          .filter((plan): plan is LandingPlan => plan !== null),
      )
    }

    void loadPlans()

    return () => {
      active = false
    }
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
    if (!/^[A-Za-zÀ-ÿ\s'-]+$/.test(reviewForm.name.trim())) {
      setReviewError('El nombre solo puede contener letras.')
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
    setShowReviewForm(false)
  }

  const openLeadDialog = (plan: PlanInteres) => {
    resetLeadForm()
    setLeadForm((current) => ({ ...current, plan }))
    setLeadDialogOpen(true)
  }

  const closeLeadDialog = () => {
    if (leadSubmitting) {
      return
    }
    resetLeadForm()
    setLeadDialogOpen(false)
  }

  const handleLeadChange = (field: keyof typeof leadForm, value: string) => {
    if (field === 'companyName') value = value.replace(/[0-9]/g, '').slice(0, 30)
    if (field === 'contactName') value = value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '').slice(0, 30)
    if (field === 'phone') value = value.replace(/\D/g, '')
    setLeadForm((current) => ({
      ...current,
      [field]: field === 'plan' ? (value as PlanInteres) : value,
    }))
    setLeadFormErrors((current) => ({ ...current, [field]: undefined }))
    setLeadError('')
  }

  const validateLeadForm = () => {
    const errors: Partial<Record<'companyName' | 'contactName' | 'email' | 'phone' | 'plan', string>> = {}

    if (!leadForm.companyName.trim()) {
      errors.companyName = 'Completá el nombre de la empresa.'
    } else if (leadForm.companyName.trim().length > 30) {
      errors.companyName = 'Máximo 30 caracteres.'
    }
    if (!leadForm.contactName.trim()) {
      errors.contactName = 'Completá el nombre de contacto.'
    } else if (!/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]*$/.test(leadForm.contactName.trim()) || leadForm.contactName.trim().length < 2) {
      errors.contactName = 'Solo letras, mínimo 2 caracteres.'
    }
    if (!leadForm.email.trim()) {
      errors.email = 'Completá el email de contacto.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadForm.email.trim())) {
      errors.email = 'Ingresá un email válido.'
    }

    const digits = leadForm.phone.replace(/\D/g, '')
    if (!leadForm.phone.trim()) {
      errors.phone = 'Completá el teléfono de contacto.'
    } else if (digits.length !== selectedCountry.digits) {
      errors.phone = `Ingresá ${selectedCountry.digits} dígitos (${selectedCountry.name}).`
    } else if (selectedCountry.code === 'AR' && (digits.startsWith('0') || digits.startsWith('15'))) {
      errors.phone = 'Para Argentina, el número no debe comenzar con 0 ni con 15.'
    }

    if (!leadForm.plan) {
      errors.plan = 'Seleccioná un plan de interés.'
    }

    setLeadFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleLeadSubmit = async () => {
    if (!validateLeadForm()) {
      return
    }

    try {
      setLeadSubmitting(true)
      await leadService.createLead({
        companyName: leadForm.companyName,
        contactName: leadForm.contactName,
        email: leadForm.email,
        phone: `${selectedCountry.dial}${leadForm.phone}`,
        plan: leadForm.plan,
        comments: leadForm.comments,
      })

      setLeadDialogOpen(false)
      setLeadSent(true)
      resetLeadForm()
    } catch (error: any) {
      setLeadError(error?.response?.data?.message || error?.response?.data || 'No pudimos enviar tu solicitud. Probá nuevamente.')
    } finally {
      setLeadSubmitting(false)
    }
  }

  const navItems: Array<{ label: string; ref: React.RefObject<HTMLElement | null> }> = [
    { label: 'Inicio', ref: heroRef },
    { label: 'Planes', ref: plansRef },
    { label: 'Plataforma', ref: aboutRef },
    { label: 'Reseñas', ref: reviewsRef },
  ]

  const plansSection = (
    <Box component="section" ref={plansRef} sx={{ pt: { xs: 8, md: 10 }, pb: { xs: 12, md: 16 }, bgcolor: '#071D31' }}>
      <Container maxWidth="lg">
        <Stack spacing={1.25} sx={{ mb: 4 }}>
          <Typography sx={{ color: '#4FC3F7', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
            Planes LogiTrack
          </Typography>
          <Typography variant="h3" sx={{ color: '#fff', fontWeight: 900, lineHeight: 1.1 }}>
            Elegí el plan ideal para tu operación
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.75)', maxWidth: 780, lineHeight: 1.75 }}>
            Compará funcionalidades y capacidad por plan. Si ya sos cliente, podés ingresar directo al sistema desde el botón de acceso.
          </Typography>
        </Stack>

        <Grid container spacing={3}>
          {plans.map((plan) => {
            const isPremium = plan.planValue === 'Premium'
            const accentMain = isPremium ? '#26A69A' : '#0288D1'
            const accentSoft = isPremium ? '#4DB6AC' : '#26C6DA'

            return (
            <Grid item xs={12} md={6} key={plan.planValue}>
              <Card
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: '24px',
                  p: { xs: 2.5, md: 3 },
                  minHeight: '100%',
                  boxShadow: isPremium ? '0 28px 60px rgba(38,166,154,0.35)' : '0 28px 60px rgba(2,136,209,0.35)',
                  border: isPremium ? '2px solid rgba(38,166,154,0.4)' : '2px solid rgba(2,136,209,0.4)',
                  background: isPremium
                    ? 'linear-gradient(160deg,#FFFFFF 0%,#E6F7F4 100%)'
                    : 'linear-gradient(160deg,#FFFFFF 0%,#E3F4FF 100%)',
                  transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  '&:hover': {
                    transform: 'translateY(-6px)',
                    boxShadow: isPremium ? '0 32px 66px rgba(38,166,154,0.42)' : '0 32px 66px rgba(2,136,209,0.42)',
                  },
                }}
              >
                <Box
                  sx={{
                    position: 'absolute',
                    width: 170,
                    height: 170,
                    borderRadius: '50%',
                    top: -70,
                    right: -55,
                    background: isPremium ? 'rgba(2,136,209,0.12)' : 'rgba(2,136,209,0.07)',
                  }}
                />

                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.4 }}>
                  {isPremium ? (
                    <Chip
                      label="Más elegido"
                      size="small"
                      sx={{
                        fontWeight: 800,
                        color: '#fff',
                        background: `linear-gradient(135deg,${accentMain},${accentSoft})`,
                        zIndex: 2,
                      }}
                    />
                  ) : (
                    <Box />
                  )}
                  <Chip
                    label={plan.accountLimit}
                    sx={{
                      bgcolor: isPremium ? '#DFF4F1' : '#D5EEFF',
                      color: accentMain,
                      fontWeight: 800,
                      zIndex: 1,
                    }}
                  />
                </Stack>

                <Typography variant="h5" sx={{ fontWeight: 900, color: '#0B1F33' }}>
                  {plan.name}
                </Typography>

                <Typography sx={{ mt: 1.5, color: accentMain, fontWeight: 900, fontSize: '1.5rem' }}>
                  {plan.price}
                </Typography>

                <Stack spacing={1.15} sx={{ mt: 2.5 }}>
                  {plan.features.map((feature) => (
                    <Stack key={feature} direction="row" spacing={1.2} alignItems="center">
                      <CheckCircleRoundedIcon sx={{ color: accentMain, fontSize: 20 }} />
                      <Typography sx={{ color: '#244156', fontWeight: 600 }}>{feature}</Typography>
                    </Stack>
                  ))}
                </Stack>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => openLeadDialog(plan.planValue)}
                    sx={{
                      py: 1.25,
                      borderRadius: '14px',
                      fontWeight: 800,
                      bgcolor: accentMain,
                      '&:hover': { bgcolor: accentSoft },
                    }}
                  >
                    Quiero contratar
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => openLeadDialog(plan.planValue)}
                    sx={{
                      py: 1.25,
                      borderRadius: '14px',
                      fontWeight: 800,
                      borderColor: accentMain,
                      color: accentMain,
                      '&:hover': { borderColor: accentSoft, bgcolor: isPremium ? 'rgba(38,166,154,0.08)' : 'rgba(2,136,209,0.08)' },
                    }}
                  >
                    Más información
                  </Button>
                </Stack>
              </Card>
            </Grid>
          )})}
        </Grid>
      </Container>
    </Box>
  )

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
                Iniciar sesión
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
              <Button variant="contained" onClick={() => navigate('/login')} sx={{ mt: 0.5 }}>
                Iniciar sesión
              </Button>
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
                  fontSize: { xs: '2.45rem', md: '4.6rem' },
                  lineHeight: { xs: 1.07, md: 0.98 },
                  letterSpacing: { xs: '-1.1px', md: '-1.9px' },
                  fontWeight: 950,
                  color: '#fff',
                  maxWidth: 780,
                  textWrap: 'balance',
                  textShadow: '0 10px 28px rgba(1,17,31,0.35)',
                }}
              >
                Gestioná tu negocio
                <Box component="span" sx={{ color: '#9DE7FF', display: 'inline' }}>
                  {' '}con una plataforma clara y confiable
                </Box>
              </Typography>

              <Box
                sx={{
                  mt: 2,
                  width: { xs: 110, md: 150 },
                  height: 6,
                  borderRadius: '999px',
                  background: 'linear-gradient(90deg,#9DE7FF 0%, rgba(157,231,255,0.1) 100%)',
                }}
              />

              <Typography sx={{ mt: 3, maxWidth: 640, color: 'rgba(255,255,255,0.82)', fontSize: { xs: '1rem', md: '1.15rem' }, lineHeight: 1.8 }}>
                Mostrá profesionalismo desde el primer contacto: centralizá tus operaciones, métricas y administra entregas,
                rutas y equipos desde un solo lugar.
              </Typography>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
                <Button
                  size="large"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  onClick={() => {
                    scrollTo(plansRef)
                    openLeadDialog('Basico')
                  }}
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
                  Quiero contratar
                </Button>
                <Button
                  size="large"
                  variant="outlined"
                  onClick={() => scrollTo(plansRef)}
                  sx={{
                    px: 3.5,
                    py: 1.4,
                    borderRadius: '16px',
                    borderColor: 'rgba(255,255,255,0.4)',
                    color: '#fff',
                    '&:hover': { borderColor: '#fff', background: 'rgba(255,255,255,0.08)' },
                  }}
                >
                  Ver planes
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

      {plansSection}

      <Box sx={{ py: { xs: 5, md: 6 }, bgcolor: '#F0F7FD' }}>
        <Container maxWidth="lg">
          <Grid container spacing={2}>
            {quickStats.map((stat) => (
              <Grid item xs={12} sm={6} md={3} key={stat.label}>
                <Paper sx={{ p: 2.25, borderRadius: '18px', border: '1px solid rgba(2,136,209,0.1)', boxShadow: '0 10px 22px rgba(4,33,62,0.06)' }}>
                  <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#0C5EA7', lineHeight: 1.1 }}>
                    {stat.value}
                  </Typography>
                  <Typography sx={{ mt: 0.7, fontWeight: 800, color: '#12324A' }}>{stat.label}</Typography>
                  <Typography sx={{ mt: 0.4, color: '#5B7488', lineHeight: 1.6, fontSize: '0.9rem' }}>{stat.helper}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      <Container component="section" ref={aboutRef} maxWidth="lg" sx={{ py: { xs: 8, md: 10 } }}>
        <Grid container spacing={4} alignItems="stretch">
          <Grid item xs={12} md={5}>
            <Typography sx={{ color: '#0288D1', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: '0.8rem' }}>
              Sobre la plataforma
            </Typography>
            <Typography variant="h3" sx={{ mt: 1.2, fontWeight: 900, color: '#0B1F33', lineHeight: 1.1 }}>
              Un sistema para Empresas que buscan gestionar sus envíos
            </Typography>
            <Typography sx={{ mt: 2.5, color: '#5B7488', lineHeight: 1.9 }}>
              LogiTrack permite centralizar la operación de envíos de tu negocio sin depender de herramientas dispersas.
              Tu empresa administra usuarios, pedidos, estados y trazabilidad en un entorno claro y escalable.
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 3.5 }}>
              {[
                'Cuenta Administrador inicial para gobernar toda la operación.',
                'Gestión de roles internos: Supervisor, Operador y Repartidor.',
                'Seguimiento con estado y trazabilidad para destinatarios variables.',
                'Escalabilidad por planes según crecimiento y volumen de cuentas.',
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
              Implementación SaaS
            </Typography>
            <Typography variant="h3" sx={{ mt: 1.2, fontWeight: 900, color: '#0B1F33' }}>
              De interés comercial a operación activa
            </Typography>
          </Box>

          <Grid container spacing={3} justifyContent="center">
            {steps.map((step, index) => (
              <Grid item xs={12} sm={6} md={4} key={step.title}>
                <Card sx={{ height: '100%', borderRadius: '24px', p: 3, position: 'relative', overflow: 'hidden', borderTop: `4px solid ${step.accentFrom}` }}>
                  <Chip label={`Paso 0${index + 1}`} sx={{ mb: 2, bgcolor: '#E1F5FE', color: step.accentFrom, fontWeight: 800 }} />
                  <Box
                    sx={{
                      width: 60,
                      height: 60,
                      borderRadius: '18px',
                      display: 'grid',
                      placeItems: 'center',
                      background: `linear-gradient(135deg, ${step.accentFrom}, ${step.accentTo})`,
                      color: '#fff',
                      mb: 2.2,
                    }}
                  >
                    {step.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 800, color: '#0B1F33', fontSize: '1.15rem' }}>{step.title}</Typography>
                  <Typography sx={{ mt: 1.2, color: '#5B7488', lineHeight: 1.8 }}>{step.text}</Typography>
                  <Box sx={{ position: 'absolute', right: -35, bottom: -35, width: 120, height: 120, borderRadius: '50%', bgcolor: `${step.accentTo}20` }} />
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

          <Card sx={{ mt: 5, borderRadius: '28px', p: { xs: 2.5, md: 3 }, boxShadow: '0 20px 50px rgba(4,33,62,0.06)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 900, color: '#0B1F33' }}>
                  Dejá tu reseña
                </Typography>
                <Typography sx={{ mt: 0.8, color: '#5B7488', lineHeight: 1.7 }}>
                  Compartí tu experiencia de forma opcional.
                </Typography>
              </Box>
              <Button
                variant="outlined"
                endIcon={<ExpandMoreRoundedIcon sx={{ transform: showReviewForm ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />}
                onClick={() => setShowReviewForm((current) => !current)}
                sx={{ borderRadius: '12px', fontWeight: 700, px: 2.2, whiteSpace: 'nowrap' }}
              >
                {showReviewForm ? 'Ocultar formulario' : 'Escribir reseña'}
              </Button>
            </Stack>

            {showReviewForm && (
              <>
                {reviewError && (
                  <Alert severity="error" sx={{ mt: 3 }} onClose={() => setReviewError('')}>
                    {reviewError}
                  </Alert>
                )}

                <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
                  <Grid item xs={12} md={4}>
                    <TextField label="Nombre" fullWidth value={reviewForm.name} onChange={(event) => setReviewForm((current) => ({ ...current, name: event.target.value.replace(/[0-9]/g, '') }))} />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField label="Rol" fullWidth value={reviewForm.role} onChange={(event) => setReviewForm((current) => ({ ...current, role: event.target.value.replace(/[0-9]/g, '') }))} />
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
              </>
            )}
          </Card>
        </Container>
      </Box>

      <Box sx={{ py: 4, bgcolor: '#04111D' }}>
        <Container maxWidth="lg">
          <Grid container spacing={3} alignItems="flex-start">
            <Grid item xs={12} md={4}>
              <Typography sx={{ color: '#fff', fontWeight: 800 }}>LogiTrack</Typography>
              <Typography sx={{ mt: 0.8, color: 'rgba(255,255,255,0.62)' }}>
                Plataforma SaaS para empresas que gestionan sus propios envíos con control operativo, trazabilidad y escalabilidad.
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography sx={{ color: '#9DE7FF', fontWeight: 800, fontSize: '0.92rem' }}>Nuestro Producto</Typography>
              <Stack spacing={0.9} sx={{ mt: 1.2 }}>
                {['Gestión por roles', 'Trazabilidad de envíos', 'Escalabilidad por planes'].map((item) => (
                  <Typography key={item} sx={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.92rem' }}>{item}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography sx={{ color: '#9DE7FF', fontWeight: 800, fontSize: '0.92rem' }}>Acciones rápidas</Typography>
              <Stack spacing={1.2} sx={{ mt: 1.2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => openLeadDialog('Basico')}
                  sx={{
                    justifyContent: 'flex-start',
                    width: 'fit-content',
                    color: '#D3E9F8',
                    borderColor: 'rgba(157,231,255,0.35)',
                    '&:hover': { borderColor: '#9DE7FF', bgcolor: 'rgba(157,231,255,0.08)' },
                  }}
                >
                  Solicitar contacto comercial
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => navigate('/login')}
                  sx={{
                    justifyContent: 'flex-start',
                    width: 'fit-content',
                    bgcolor: '#0288D1',
                    '&:hover': { bgcolor: '#0277BD' },
                  }}
                >
                  Iniciar sesión
                </Button>
              </Stack>
            </Grid>
          </Grid>
          <Typography sx={{ mt: 3, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.82rem' }}>
            © 2026 LogiTrack. Todos los derechos reservados.
          </Typography>
        </Container>
      </Box>

      <Snackbar open={reviewSent} autoHideDuration={2500} onClose={closeReviewToast}>
        <Alert severity="success" variant="filled" onClose={closeReviewToast}>
          ¡Gracias! Tu reseña ya quedó visible en la página.
        </Alert>
      </Snackbar>

      <Dialog open={leadDialogOpen} onClose={closeLeadDialog} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800 }}>Formulario de Contacto</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.3 }}>
            <Grid item xs={12}>
              <TextField
                label="Nombre de la empresa"
                fullWidth
                value={leadForm.companyName}
                onChange={(event) => handleLeadChange('companyName', event.target.value)}
                error={Boolean(leadFormErrors.companyName)}
                helperText={leadFormErrors.companyName}
                inputProps={{ maxLength: 30 }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Nombre de contacto"
                fullWidth
                value={leadForm.contactName}
                onChange={(event) => handleLeadChange('contactName', event.target.value)}
                error={Boolean(leadFormErrors.contactName)}
                helperText={leadFormErrors.contactName}
                inputProps={{ maxLength: 30 }}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Email"
                fullWidth
                value={leadForm.email}
                onChange={(event) => handleLeadChange('email', event.target.value)}
                error={Boolean(leadFormErrors.email)}
                helperText={leadFormErrors.email}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    border: '1px solid rgba(0,0,0,0.23)',
                    borderRadius: 1,
                    px: 1.5,
                    height: 56,
                    minWidth: 100,
                    flexShrink: 0,
                  }}
                >
                  <img
                    src="https://flagcdn.com/w20/ar.png"
                    width={20}
                    alt="Argentina"
                    style={{ borderRadius: 2, display: 'block' }}
                  />
                  <span style={{ fontSize: 14 }}>+54</span>
                </Box>
                <TextField
                  label="Teléfono"
                  fullWidth
                  value={leadForm.phone}
                  onChange={(event) => handleLeadChange('phone', event.target.value)}
                  error={Boolean(leadFormErrors.phone)}
                  helperText={leadFormErrors.phone}
                  inputProps={{ maxLength: selectedCountry.digits, inputMode: 'numeric' }}
                />
              </Stack>
            </Grid>
            <Grid item xs={12}>
              <TextField
                select
                label="Plan de interés"
                fullWidth
                value={leadForm.plan}
                onChange={(event) => handleLeadChange('plan', event.target.value)}
                error={Boolean(leadFormErrors.plan)}
                helperText={leadFormErrors.plan}
              >
                <MenuItem value="Basico">Básico</MenuItem>
                <MenuItem value="Premium">Premium</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Comentarios (opcional)"
                fullWidth
                multiline
                minRows={3}
                value={leadForm.comments}
                onChange={(event) => handleLeadChange('comments', event.target.value)}
              />
            </Grid>
            {leadError && (
              <Grid item xs={12}>
                <Alert severity="error">{leadError}</Alert>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={closeLeadDialog} disabled={leadSubmitting}>Cancelar</Button>
          <Button variant="contained" onClick={handleLeadSubmit} disabled={leadSubmitting}>
            {leadSubmitting ? 'Enviando...' : 'Enviar solicitud'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={leadSent}
        onClose={closeLeadToast}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '24px',
            overflow: 'hidden',
            background: 'linear-gradient(160deg,#04213E 0%,#0C5EA7 60%,#19A5F2 100%)',
          },
        }}
      >
        <DialogContent sx={{ p: 0, position: 'relative', overflow: 'hidden', minHeight: 320 }}>
          {[
            { delay: '0s', dur: '6s', top: '70%', size: 80 },
            { delay: '2.5s', dur: '9s', top: '30%', size: 52 },
            { delay: '4.5s', dur: '7s', top: '5%', size: 42 },
          ].map((t, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: t.top,
                left: '-120px',
                animation: `truckCelebrate ${t.dur} linear infinite`,
                animationDelay: t.delay,
                '@keyframes truckCelebrate': {
                  '0%': { transform: 'translateX(0)', opacity: 0 },
                  '8%': { opacity: 0.55 },
                  '90%': { opacity: 0.55 },
                  '100%': { transform: 'translateX(800px)', opacity: 0 },
                },
              }}
            >
              <LocalShippingRoundedIcon sx={{ color: '#fff', fontSize: t.size }} />
            </Box>
          ))}
          <Box sx={{ py: 7, px: 4, textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <CheckCircleRoundedIcon sx={{ color: '#4FC3F7', fontSize: 72, mb: 2 }} />
            <Typography variant="h4" sx={{ fontWeight: 900, color: '#fff', mb: 1.5 }}>
              ¡Solicitud enviada!
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.82)', lineHeight: 1.75, maxWidth: 400, mx: 'auto' }}>
              Recibimos tu solicitud. Te contactaremos a la brevedad para brindarte todos los detalles de tu plan.
            </Typography>
            <Button
              variant="contained"
              onClick={closeLeadToast}
              sx={{
                mt: 4,
                borderRadius: '14px',
                px: 4,
                py: 1.4,
                bgcolor: '#0288D1',
                fontWeight: 800,
                fontSize: '1rem',
                boxShadow: '0 8px 24px rgba(2,136,209,0.45)',
                '&:hover': { bgcolor: '#0277BD' },
              }}
            >
              Seguir navegando por la página
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

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
