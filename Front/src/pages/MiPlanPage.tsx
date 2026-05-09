import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  IconButton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import WbSunnyIcon from '@mui/icons-material/WbSunny'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import { empresaService, type MiPlanResponse, type PlanCatalogo, type PlanEmpresa } from '../services/empresaService'
import { authService } from '../services/authService'
import type { User } from '../types'

const ROLE_COLORS_DONUT = {
  supervisor: '#FF7043',
  operador: '#42A5F5',
  repartidor: '#66BB6A',
}

interface DonutSegment {
  value: number
  color: string
  label: string
}

function DonutChart({ segments, size = 180, thickness = 28, trackColor = '#e0e0e0' }: {
  segments: DonutSegment[]
  size?: number
  thickness?: number
  trackColor?: string
}) {
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const total = segments.reduce((s, seg) => s + seg.value, 0)

  let accOffset = 0
  const arcs = segments.map((seg) => {
    const dash = total > 0 ? (seg.value / total) * circumference : 0
    const result = { ...seg, dash, offset: accOffset }
    accOffset += dash
    return result
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ transform: 'rotate(-90deg)', display: 'block' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={trackColor}
        strokeWidth={thickness}
      />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={thickness}
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={circumference - arc.offset}
          strokeLinecap="butt"
        >
          <animate
            attributeName="stroke-dasharray"
            from={`0 ${circumference - arc.dash}`}
            to={`${arc.dash} ${circumference - arc.dash}`}
            dur={`${0.6 + i * 0.25}s`}
            fill="freeze"
            begin="0s"
          />
        </circle>
      ))}
    </svg>
  )
}

function Confetti() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF9F43']
  const pieces = useMemo(
    () =>
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        color: colors[i % colors.length],
        left: `${(i * 2) % 100}%`,
        animDelay: `${(i * 0.05) % 2.5}s`,
        size: 6 + (i % 9),
        duration: `${2 + (i % 4) * 0.4}s`,
        isCircle: i % 3 === 0,
      })),
    [],
  )

  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg);   opacity: 1; }
          100% { transform: translateY(420px) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <Box
          key={p.id}
          sx={{
            position: 'absolute',
            top: '-20px',
            left: p.left,
            width: p.size,
            height: p.size,
            bgcolor: p.color,
            borderRadius: p.isCircle ? '50%' : 1,
            animation: `confettiFall ${p.duration} ${p.animDelay} ease-in forwards`,
          }}
        />
      ))}
    </Box>
  )
}

export default function MiPlanPage() {
  const user = useOutletContext<User>()
  const [plan, setPlan] = useState<MiPlanResponse | null>(null)
  const [catalogo, setCatalogo] = useState<PlanCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roleCounts, setRoleCounts] = useState({ supervisor: 0, operador: 0, repartidor: 0 })

  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('miPlanDarkMode') === 'true')
  const [showCelebration, setShowCelebration] = useState(false)
  const firstLoad = useRef(true)

  const [, setPlanSeleccionado] = useState<PlanEmpresa | null>(null)
  const [codigoEmitido, setCodigoEmitido] = useState<string | null>(null)
  const [codigoInput, setCodigoInput] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [cambioErr, setCambioErr] = useState('')

  const [openSuspendDialog, setOpenSuspendDialog] = useState(false)
  const [openBajaDialog, setOpenBajaDialog] = useState(false)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: 'success' | 'info' | 'error' | 'warning' }>({ open: false, msg: '', sev: 'success' })

  useEffect(() => {
    if (user.role !== 'administrador') return
    void load()
  }, [user.role])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [p, c, supRes, opRes, repRes] = await Promise.all([
        empresaService.miPlan(),
        empresaService.catalogo(),
        authService.getUsuariosPage({ page: 1, pageSize: 1, role: 'supervisor', active: true }),
        authService.getUsuariosPage({ page: 1, pageSize: 1, role: 'operador', active: true }),
        authService.getUsuariosPage({ page: 1, pageSize: 1, role: 'repartidor', active: true }),
      ])
      setPlan(p)
      setCatalogo(c)
      setRoleCounts({
        supervisor: supRes.totalItems,
        operador: opRes.totalItems,
        repartidor: repRes.totalItems,
      })
      localStorage.setItem('miPlanTipo', p?.plan ?? 'Basico')
      window.dispatchEvent(new Event('miPlanDarkModeChange'))
      if (p?.plan !== 'Premium') {
        setDarkMode(false)
        localStorage.setItem('miPlanDarkMode', 'false')
        window.dispatchEvent(new Event('miPlanDarkModeChange'))
      } else if (firstLoad.current) {
        setDarkMode(true)
        localStorage.setItem('miPlanDarkMode', 'true')
        window.dispatchEvent(new Event('miPlanDarkModeChange'))
      }
      firstLoad.current = false
    } catch {
      setError('No se pudo cargar la información del plan')
    } finally {
      setLoading(false)
    }
  }

  if (user.role !== 'administrador') {
    return <Alert severity="warning">Solo el Administrador puede acceder a esta sección.</Alert>
  }

  if (loading || !plan) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>

  const dk = darkMode && plan.plan === 'Premium'
  const overLimit = plan.cuentasActivas > plan.limiteCuentas
  const libre = Math.max(0, plan.limiteCuentas - plan.cuentasActivas)
  const consumoPct = plan.limiteCuentas > 0 ? Math.round((plan.cuentasActivas / plan.limiteCuentas) * 100) : 0

  const cardBg = dk ? 'rgba(255,255,255,0.07)' : 'white'
  const textColor = dk ? 'rgba(255,255,255,0.92)' : 'text.primary'
  const subColor = dk ? 'rgba(255,255,255,0.55)' : 'text.secondary'
  const borderCol = dk ? 'rgba(255,255,255,0.14)' : undefined

  const donutSegments: DonutSegment[] = [
    { value: roleCounts.supervisor, color: ROLE_COLORS_DONUT.supervisor, label: 'Supervisores' },
    { value: roleCounts.operador, color: ROLE_COLORS_DONUT.operador, label: 'Operadores' },
    { value: roleCounts.repartidor, color: ROLE_COLORS_DONUT.repartidor, label: 'Repartidores' },
  ].filter((s) => s.value > 0)

  const effectiveSegments = donutSegments.length > 0
    ? donutSegments
    : [{ value: 1, color: '#e0e0e0', label: 'Sin usuarios' }]

  const toggleDarkMode = () => {
    const next = !dk
    setDarkMode(next)
    localStorage.setItem('miPlanDarkMode', String(next))
    window.dispatchEvent(new Event('miPlanDarkModeChange'))
  }

  const solicitarCambio = async (planDestino: PlanEmpresa) => {
    setCambiando(true)
    setCambioErr('')
    setPlanSeleccionado(planDestino)
    const r = await empresaService.cambiarPlan(planDestino)
    setCambiando(false)
    if (!r.success) {
      setCambioErr(r.error ?? 'Error')
      setPlanSeleccionado(null)
      return
    }
    setCodigoEmitido(r.codigo ?? null)
  }

  const confirmarCodigo = async () => {
    setCambiando(true)
    setCambioErr('')
    const r = await empresaService.confirmarCambio(codigoInput.trim())
    setCambiando(false)
    if (!r.success) {
      setCambioErr(r.error ?? 'Código incorrecto')
      return
    }
    const prevPlan = plan.plan
    setCodigoEmitido(null)
    setPlanSeleccionado(null)
    setCodigoInput('')
    await load()
    setSnack({ open: true, msg: 'Plan actualizado correctamente', sev: 'success' })
    if (prevPlan !== 'Premium') {
      setDarkMode(true)
      localStorage.setItem('miPlanDarkMode', 'true')
      window.dispatchEvent(new Event('miPlanDarkModeChange'))
      setShowCelebration(true)
    }
  }

  const suspender = async () => {
    setOpenSuspendDialog(false)
    const ok = await empresaService.suspender()
    if (ok) {
      setSnack({ open: true, msg: 'Empresa suspendida (los usuarios no-Admin no podrán ingresar)', sev: 'warning' })
      void load()
    }
  }

  const reactivar = async () => {
    const ok = await empresaService.reactivar()
    if (ok) {
      setSnack({ open: true, msg: 'Empresa reactivada', sev: 'success' })
      void load()
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100%',
        background: dk ? 'linear-gradient(135deg, #0D1B2A 0%, #1B2D42 60%, #0A1628 100%)' : undefined,
        borderRadius: 2,
        p: dk ? 3 : 0,
        transition: 'background 0.5s ease, padding 0.3s ease',
      }}
    >
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} color={textColor} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WorkspacePremiumIcon sx={{ color: plan.plan === 'Premium' ? '#FFD700' : undefined }} />
            Mi Plan
          </Typography>
          <Typography variant="body2" color={subColor}>
            {plan.nombre} · Plan {plan.plan === 'Premium' ? '⭐ Premium' : 'Básico'} ·{' '}
            {plan.estado === 'Suspendida'
              ? <Chip size="small" label="Suspendida" color="error" sx={{ ml: 0.5 }} />
              : <Chip size="small" label="Activa" color="success" sx={{ ml: 0.5 }} />}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {plan.plan === 'Premium' && (
            <Tooltip title={dk ? 'Cambiar a modo claro' : 'Activar modo oscuro Premium'}>
              <IconButton onClick={toggleDarkMode} sx={{ color: dk ? '#FFD700' : '#1976d2' }}>
                {dk ? <WbSunnyIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          )}
          <Button
            startIcon={<RefreshIcon />}
            onClick={load}
            variant={dk ? 'outlined' : 'text'}
            sx={{ color: dk ? 'white' : undefined, borderColor: dk ? 'rgba(255,255,255,0.4)' : undefined }}
          >
            Actualizar
          </Button>
        </Stack>
      </Stack>

      {cambioErr && !codigoEmitido && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setCambioErr('')}>{cambioErr}</Alert>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {plan.estado === 'Suspendida' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          La empresa está suspendida. Los usuarios no-Admin no pueden iniciar sesión.
          <Button size="small" sx={{ ml: 2 }} variant="outlined" onClick={reactivar}>Reactivar empresa</Button>
        </Alert>
      )}

      {/* Donut + breakdown */}
      <Card variant="outlined" sx={{ mb: 3, bgcolor: cardBg, borderColor: borderCol, transition: 'all 0.5s ease' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }} color={textColor}>Consumo de cuentas</Typography>
          <Grid container spacing={3} alignItems="center">

            {/* Donut */}
            <Grid item xs={12} sm={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <Box sx={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <DonutChart
                  segments={effectiveSegments}
                  trackColor={dk ? '#2a3f55' : '#e8e8e8'}
                />
                <Box sx={{ position: 'absolute', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="h4" fontWeight={800} color={overLimit ? '#ef5350' : textColor} lineHeight={1}>
                    {plan.cuentasActivas}
                  </Typography>
                  <Typography variant="caption" color={subColor}>
                    de {plan.limiteCuentas}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color={subColor}>Cuentas activas</Typography>
            </Grid>

            {/* Breakdown por rol */}
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color={subColor} sx={{ mb: 1.5 }}>Distribución del equipo</Typography>
              <Stack spacing={1.5}>
                {[
                  { label: 'Supervisores', count: roleCounts.supervisor, color: ROLE_COLORS_DONUT.supervisor },
                  { label: 'Operadores', count: roleCounts.operador, color: ROLE_COLORS_DONUT.operador },
                  { label: 'Repartidores', count: roleCounts.repartidor, color: ROLE_COLORS_DONUT.repartidor },
                ].map((r) => (
                  <Stack key={r.label} direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: r.color, flexShrink: 0 }} />
                    <Typography variant="body2" color={textColor} sx={{ flex: 1 }}>{r.label}</Typography>
                    <Chip
                      label={r.count}
                      size="small"
                      sx={{ bgcolor: `${r.color}28`, color: r.color, fontWeight: 700, fontSize: '0.72rem', minWidth: 32 }}
                    />
                  </Stack>
                ))}
              </Stack>
            </Grid>

            {/* Stats */}
            <Grid item xs={12} sm={4}>
              <Stack spacing={1.5}>
                <Box sx={{ p: 1.5, borderRadius: 1.5, bgcolor: dk ? 'rgba(255,255,255,0.06)' : '#F5F7FA' }}>
                  <Typography variant="caption" color={subColor}>Plan contratado</Typography>
                  <Typography variant="h5" fontWeight={700} color={dk ? '#FFD700' : 'text.primary'}>
                    {plan.plan === 'Premium' ? '⭐ Premium' : 'Básico'}
                  </Typography>
                </Box>
                <Box sx={{
                  p: 1.5, borderRadius: 1.5,
                  bgcolor: overLimit ? (dk ? 'rgba(198,40,40,0.2)' : '#fff5f5')
                    : consumoPct >= 90 ? (dk ? 'rgba(230,81,0,0.2)' : '#fff8e1')
                    : dk ? 'rgba(46,125,50,0.2)' : '#f0fff4',
                }}>
                  <Typography variant="caption" color={subColor}>Cuentas disponibles</Typography>
                  <Typography
                    variant="h5"
                    fontWeight={700}
                    color={overLimit ? '#ef5350' : consumoPct >= 90 ? '#e65100' : '#2e7d32'}
                  >
                    {libre}
                  </Typography>
                  {overLimit && (
                    <Typography variant="caption" color="#ef5350">
                      Superaste el límite ({consumoPct}%)
                    </Typography>
                  )}
                  {!overLimit && consumoPct >= 90 && (
                    <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 1, py: 0 }}>
                      Quedan pocas cuentas
                    </Alert>
                  )}
                </Box>
              </Stack>
            </Grid>

          </Grid>
        </CardContent>
      </Card>

      {/* Planes disponibles */}
      <Typography variant="h6" sx={{ mb: 2 }} color={textColor}>Planes disponibles</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {catalogo.map((p) => {
          const esActual = p.plan === plan.plan
          return (
            <Grid item xs={12} md={6} key={p.plan}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  bgcolor: esActual
                    ? dk ? 'rgba(25,118,210,0.22)' : '#f0f7ff'
                    : dk ? 'rgba(255,255,255,0.05)' : 'white',
                  borderColor: esActual ? '#1976d2' : borderCol,
                  borderWidth: esActual ? 2 : 1,
                  transition: 'all 0.5s ease',
                }}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="overline" color={subColor}>{p.plan}</Typography>
                      <Typography variant="h5" fontWeight={700} color={textColor}>
                        {p.plan === 'Premium' ? '⭐ ' : ''}{p.nombre}
                      </Typography>
                      <Typography variant="body2" color={subColor}>{p.precioMock}</Typography>
                    </Box>
                    {esActual && <Chip label="Tu plan actual" color="primary" size="small" />}
                  </Stack>
                  <Stack spacing={0.5}>
                    {p.funcionalidades.filter((f) => !f.toLowerCase().includes('gps')).map((f) => (
                      <Stack key={f} direction="row" spacing={1} alignItems="center">
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
                        <Typography variant="body2" color={textColor}>{f}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${dk ? 'rgba(255,255,255,0.1)' : '#eee'}` }}>
                    <Typography variant="caption" color={subColor}>
                      Hasta <strong>{p.limiteCuentas}</strong> cuentas activas
                    </Typography>
                  </Box>
                  {!esActual && (
                    <Button
                      variant="contained"
                      fullWidth
                      sx={{ mt: 2 }}
                      onClick={() => solicitarCambio(p.plan)}
                      disabled={cambiando || plan.estado === 'Suspendida'}
                    >
                      {p.plan === 'Premium' ? '⭐ Mejorar al plan Premium' : 'Cambiar al plan Básico'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Dar de baja */}
      <Card variant="outlined" sx={{ borderColor: '#c62828', bgcolor: dk ? 'rgba(198,40,40,0.12)' : '#fff5f5', mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, color: '#c62828' }}>Dar de baja el plan</Typography>
          <Typography variant="body2" color={subColor} sx={{ mb: 2 }}>
            Al dar de baja tu plan, los usuarios no podrán operar hasta que contrates un nuevo servicio.
          </Typography>
          <Button color="error" variant="outlined" onClick={() => setOpenBajaDialog(true)} disabled={plan.estado === 'Suspendida'}>
            Solicitar baja del plan
          </Button>
        </CardContent>
      </Card>

      {/* Simulación */}
      <Card variant="outlined" sx={{ borderColor: '#ed6c02', bgcolor: dk ? 'rgba(237,108,2,0.12)' : '#fff8f0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }} color={textColor}>
            <PowerSettingsNewIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#ed6c02' }} />
            Simulación de escenarios (solo demo)
          </Typography>
          <Typography variant="body2" color={subColor} sx={{ mb: 2 }}>
            Esta acción simula un evento externo operado por el equipo comercial de LogiTrack.
          </Typography>
          {plan.estado === 'Activa' ? (
            <Button color="error" variant="outlined" onClick={() => setOpenSuspendDialog(true)}>
              Simular suspensión por falta de pago
            </Button>
          ) : (
            <Button color="success" variant="contained" onClick={reactivar}>
              Reactivar empresa
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Modal: confirmar cambio de plan */}
      <Dialog open={Boolean(codigoEmitido)} onClose={() => !cambiando && setCodigoEmitido(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar cambio de plan</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Ingresá el código de verificación (simulamos el envío por email):
          </DialogContentText>
          <Box sx={{ p: 2, bgcolor: dk ? '#0A1628' : '#f5f5f5', border: dk ? '1px solid rgba(66,165,245,0.3)' : 'none', borderRadius: 1, mb: 2, textAlign: 'center' }}>
            <Typography variant="caption" color={dk ? 'rgba(255,255,255,0.6)' : 'text.secondary'}>Tu código:</Typography>
            <Typography variant="h4" sx={{ fontFamily: 'monospace', letterSpacing: 4, fontWeight: 700, color: '#1565C0', textShadow: dk ? '0 0 20px rgba(66,165,245,0.6)' : 'none' }}>
              {codigoEmitido}
            </Typography>
          </Box>
          <TextField
            label="Código de verificación"
            fullWidth
            value={codigoInput}
            onChange={(e) => setCodigoInput(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 6, style: { fontFamily: 'monospace', letterSpacing: 4, textAlign: 'center', fontSize: 20 } }}
          />
          {cambioErr && <Alert severity="error" sx={{ mt: 2 }}>{cambioErr}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCodigoEmitido(null); setPlanSeleccionado(null); setCodigoInput(''); setCambioErr('') }} disabled={cambiando}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={confirmarCodigo} disabled={cambiando || codigoInput.length !== 6}>
            {cambiando ? 'Confirmando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: baja */}
      <Dialog open={openBajaDialog} onClose={() => setOpenBajaDialog(false)}>
        <DialogTitle>Solicitar baja del plan</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vas a solicitar la baja de tu plan. El equipo de LogiTrack procesará tu solicitud en las próximas 48 horas hábiles. ¿Confirmás?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBajaDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              setOpenBajaDialog(false)
              setSnack({ open: true, msg: 'Solicitud de baja enviada. Te contactaremos en 48 hs hábiles.', sev: 'info' })
            }}
          >
            Confirmar baja
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: suspensión */}
      <Dialog open={openSuspendDialog} onClose={() => setOpenSuspendDialog(false)}>
        <DialogTitle>Simular suspensión</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vas a suspender el servicio. Cualquier usuario que no sea Administrador no podrá iniciar sesión hasta que reactivés la empresa. ¿Confirmás?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSuspendDialog(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={suspender}>Suspender</Button>
        </DialogActions>
      </Dialog>

      {/* Modal: ¡Bienvenido al Premium! */}
      <Dialog open={showCelebration} onClose={() => setShowCelebration(false)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #0D1B2A, #1565C0)',
            color: 'white',
            textAlign: 'center',
            fontSize: '1.4rem',
            fontWeight: 700,
            py: 2,
          }}
        >
          🎉 ¡Felicitaciones!
        </DialogTitle>
        <DialogContent
          sx={{
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #0D1B2A, #1B3A6B)',
            minHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2.5,
            py: 4,
          }}
        >
          <Confetti />
          <style>{`
            @keyframes truckBounce {
              from { transform: translateY(0px);  }
              to   { transform: translateY(-14px); }
            }
          `}</style>
          <Typography variant="h5" fontWeight={700} color="white" textAlign="center" sx={{ zIndex: 1 }}>
            ⭐ Cambiaste al Plan Premium ⭐
          </Typography>
          <Stack direction="row" justifyContent="center" spacing={2} sx={{ zIndex: 1 }}>
            <LocalShippingIcon sx={{ fontSize: 52, color: '#42A5F5', animation: 'truckBounce 0.55s ease infinite alternate' }} />
            <LocalShippingIcon sx={{ fontSize: 52, color: '#FFD700', animation: 'truckBounce 0.55s ease 0.18s infinite alternate' }} />
            <LocalShippingIcon sx={{ fontSize: 52, color: '#66BB6A', animation: 'truckBounce 0.55s ease 0.36s infinite alternate' }} />
          </Stack>
          <Typography variant="body1" color="rgba(255,255,255,0.82)" textAlign="center" sx={{ zIndex: 1, maxWidth: 340, px: 1 }}>
            Ahora tenés acceso a todas las funcionalidades premium de LogiTrack. ¡Disfrutalo!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ bgcolor: '#0D1B2A', justifyContent: 'center', py: 2 }}>
          <Button
            variant="contained"
            onClick={() => setShowCelebration(false)}
            sx={{ background: 'linear-gradient(90deg, #1565C0, #42A5F5)', color: 'white', px: 4, fontWeight: 700 }}
          >
            ¡Empezar!
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
