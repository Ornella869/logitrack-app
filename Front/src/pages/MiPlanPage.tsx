import { useEffect, useState } from 'react'
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
  LinearProgress,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew'
import { empresaService, type MiPlanResponse, type PlanCatalogo, type PlanEmpresa } from '../services/empresaService'
import type { User } from '../types'

export default function MiPlanPage() {
  const user = useOutletContext<User>()
  const [plan, setPlan] = useState<MiPlanResponse | null>(null)
  const [catalogo, setCatalogo] = useState<PlanCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Cambio de plan
  const [, setPlanSeleccionado] = useState<PlanEmpresa | null>(null)
  const [codigoEmitido, setCodigoEmitido] = useState<string | null>(null)
  const [codigoInput, setCodigoInput] = useState('')
  const [cambiando, setCambiando] = useState(false)
  const [cambioErr, setCambioErr] = useState('')

  // Suspensión
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
      const [p, c] = await Promise.all([empresaService.miPlan(), empresaService.catalogo()])
      setPlan(p)
      setCatalogo(c)
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

  const consumoPct = plan.limiteCuentas > 0 ? Math.round((plan.cuentasActivas / plan.limiteCuentas) * 100) : 0
  const consumoColor = consumoPct >= 90 ? '#c62828' : consumoPct >= 70 ? '#ed6c02' : '#2e7d32'

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
    setSnack({ open: true, msg: 'Plan actualizado correctamente', sev: 'success' })
    setCodigoEmitido(null)
    setPlanSeleccionado(null)
    setCodigoInput('')
    void load()
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
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <WorkspacePremiumIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Mi Plan
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {plan.nombre} · Plan {plan.plan === 'Premium' ? 'Premium' : 'Básico'} ·
            {' '}
            {plan.estado === 'Suspendida' ? <Chip size="small" label="Suspendida" color="error" /> : <Chip size="small" label="Activa" color="success" />}
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={load}>Actualizar</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {plan.estado === 'Suspendida' && (
        <Alert severity="error" sx={{ mb: 3 }}>
          La empresa está suspendida. Los usuarios no-Admin no pueden iniciar sesión.
          <Button size="small" sx={{ ml: 2 }} variant="outlined" onClick={reactivar}>Reactivar empresa</Button>
        </Alert>
      )}

      {/* Datos del plan */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>Plan actual</Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Plan contratado</Typography>
              <Typography variant="h4" fontWeight={700}>{plan.plan === 'Premium' ? '⭐ Premium' : 'Básico'}</Typography>
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Consumo de cuentas</Typography>
              <Typography variant="h4" fontWeight={700}>
                {plan.cuentasActivas} / {plan.limiteCuentas}
                <Typography component="span" variant="body2" color="text.secondary"> ({consumoPct}%)</Typography>
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, consumoPct)}
                sx={{
                  height: 12, borderRadius: 1, mt: 1,
                  '& .MuiLinearProgress-bar': { bgcolor: consumoColor },
                }}
              />
              {plan.cuentasDesactivadas > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Tenés {plan.cuentasDesactivadas} usuario{plan.cuentasDesactivadas > 1 ? 's' : ''} desactivado{plan.cuentasDesactivadas > 1 ? 's' : ''} que podés reactivar.
                </Typography>
              )}
              {consumoPct >= 90 && (
                <Alert severity="warning" sx={{ mt: 2 }} icon={<WarningAmberIcon />}>
                  Te quedan {plan.limiteCuentas - plan.cuentasActivas} cuenta{plan.limiteCuentas - plan.cuentasActivas !== 1 ? 's' : ''} disponibles en tu plan.
                </Alert>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Planes disponibles */}
      <Typography variant="h6" sx={{ mb: 2 }}>Planes disponibles</Typography>
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {catalogo.map((p) => {
          const esActual = p.plan === plan.plan
          return (
            <Grid item xs={12} md={6} key={p.plan}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderColor: esActual ? '#1976d2' : undefined,
                  borderWidth: esActual ? 2 : undefined,
                  bgcolor: esActual ? '#f0f7ff' : 'white',
                }}
              >
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="overline" color="text.secondary">{p.plan}</Typography>
                      <Typography variant="h5" fontWeight={700}>{p.nombre}</Typography>
                      <Typography variant="body2" color="text.secondary">{p.precioMock}</Typography>
                    </Box>
                    {esActual && <Chip label="Tu plan actual" color="primary" size="small" />}
                  </Stack>
                  <Stack spacing={0.5}>
                    {p.funcionalidades.map((f) => (
                      <Stack key={f} direction="row" spacing={1} alignItems="center">
                        <CheckCircleIcon sx={{ fontSize: 16, color: '#2e7d32' }} />
                        <Typography variant="body2">{f}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #eee' }}>
                    <Typography variant="caption" color="text.secondary">
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
                      {p.plan === 'Premium' ? 'Mejorar al plan Premium' : 'Cambiar al plan Básico'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>

      {/* Dar de baja */}
      <Card variant="outlined" sx={{ borderColor: '#c62828', bgcolor: '#fff5f5', mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, color: '#c62828' }}>
            Dar de baja el plan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Al dar de baja tu plan, los usuarios no podrán operar hasta que contrates un nuevo servicio.
          </Typography>
          <Button color="error" variant="outlined" onClick={() => setOpenBajaDialog(true)} disabled={plan.estado === 'Suspendida'}>
            Solicitar baja del plan
          </Button>
        </CardContent>
      </Card>

      {/* Sección de simulación */}
      <Card variant="outlined" sx={{ borderColor: '#ed6c02', bgcolor: '#fff8f0' }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1 }}>
            <PowerSettingsNewIcon sx={{ verticalAlign: 'middle', mr: 1, color: '#ed6c02' }} />
            Simulación de escenarios (solo demo)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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

      {/* Modal de cambio de plan / código */}
      <Dialog open={Boolean(codigoEmitido)} onClose={() => !cambiando && setCodigoEmitido(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar cambio de plan</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Ingresá el código de verificación (simulamos el envío por email):
          </DialogContentText>
          <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 1, mb: 2, textAlign: 'center' }}>
            <Typography variant="caption" color="text.secondary">Tu código:</Typography>
            <Typography variant="h4" sx={{ fontFamily: 'monospace', letterSpacing: 4, fontWeight: 700 }}>
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

      <Dialog open={openSuspendDialog} onClose={() => setOpenSuspendDialog(false)}>
        <DialogTitle>Simular suspensión</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Vas a suspender el servicio. Cualquier usuario que no sea Administrador no podrá iniciar sesión hasta que reactivés la empresa.
            ¿Confirmás?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSuspendDialog(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={suspender}>Suspender</Button>
        </DialogActions>
      </Dialog>

      {cambioErr && !codigoEmitido && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setCambioErr('')}>{cambioErr}</Alert>
      )}

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack({ ...snack, open: false })}>
        <Alert severity={snack.sev} onClose={() => setSnack({ ...snack, open: false })}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
