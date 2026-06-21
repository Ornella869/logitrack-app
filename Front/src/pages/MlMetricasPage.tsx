import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import ModelTrainingIcon from '@mui/icons-material/ModelTraining'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { mlService, type AlertaRiesgo, type MlMetricas } from '../services/mlService'

export default function MlMetricasPage() {
  const [metricas, setMetricas] = useState<MlMetricas | null>(null)
  const [alertas, setAlertas] = useState<AlertaRiesgo[]>([])
  const [loading, setLoading] = useState(true)
  const [reentrenando, setReentrenando] = useState(false)
  const [snackbar, setSnackbar] = useState('')
  const [snackbarError, setSnackbarError] = useState('')

  const cargar = async () => {
    setLoading(true)
    try {
      const [m, a] = await Promise.all([
        mlService.getMetricas(),
        mlService.getAlertas(true),
      ])
      setMetricas(m)
      setAlertas(a)
    } catch {
      setSnackbarError('No se pudieron cargar las métricas ML.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void cargar() }, [])

  const handleReentrenar = async () => {
    setReentrenando(true)
    try {
      const res = await mlService.reentrenar()
      setSnackbar(res.mensaje)
      await cargar()
    } catch (e: any) {
      setSnackbarError(e?.response?.data?.mensaje ?? 'No se pudo iniciar el reentrenamiento.')
    } finally {
      setReentrenando(false)
    }
  }

  const handleGestionar = async (id: string, llegoATiempo: boolean) => {
    try {
      await mlService.gestionarAlerta(id, llegoATiempo)
      setAlerta(id)
      setSnackbar(llegoATiempo
        ? 'Alerta gestionada: el envío llegó a tiempo (falsa alarma registrada).'
        : 'Alerta gestionada: el envío se demoró (acierto registrado).')
    } catch {
      setSnackbarError('No se pudo gestionar la alerta.')
    }
  }

  const setAlerta = (id: string) => {
    setAlertas((prev) => prev.filter((a) => a.id !== id))
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={8}>
        <CircularProgress />
      </Box>
    )
  }

  const dist = metricas?.distribucionErrores

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <ModelTrainingIcon sx={{ fontSize: 32, color: 'primary.main' }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>Panel de Métricas ML</Typography>
          <Typography variant="body2" color="text.secondary">
            Estimación de entregas · {metricas?.version}
          </Typography>
        </Box>
      </Stack>

      {/* Tarjetas de resumen */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <SummaryCard
          label="Registros totales"
          value={metricas?.totalRegistros ?? 0}
          sub="histórico completo"
          color="#1976d2"
        />
        <SummaryCard
          label="MAE del modelo"
          value={`${metricas?.maeModelo ?? 0} h`}
          sub="error medio absoluto"
          color="#7b1fa2"
        />
        <SummaryCard
          label="Nuevos (30 días)"
          value={metricas?.nuevosRegistros30Dias ?? 0}
          sub="registros recientes"
          color="#2e7d32"
        />
        <SummaryCard
          label="Alertas activas"
          value={alertas.length}
          sub="riesgo de demora"
          color={alertas.length > 0 ? '#e65100' : '#2e7d32'}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
        {/* Distribución de errores */}
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>
              Distribución de errores de estimación
            </Typography>
            {dist ? (
              <Stack spacing={1.5}>
                <ErrorBar label="Menos de 4 h" value={dist.menosDe4h} color="#2e7d32" />
                <ErrorBar label="4 – 8 h" value={dist.de4a8h} color="#f9a825" />
                <ErrorBar label="8 – 24 h" value={dist.de8a24h} color="#e65100" />
                <ErrorBar label="Más de 24 h" value={dist.masDe24h} color="#c62828" />
              </Stack>
            ) : (
              <Typography color="text.secondary">Sin datos aún.</Typography>
            )}
          </CardContent>
        </Card>

        {/* MAE histórico — gráfico neón */}
        <Card variant="outlined" sx={{ background: 'linear-gradient(135deg, #0a0a1a 0%, #0d1b2a 100%)', border: '1px solid rgba(0,212,255,0.25)' }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={1} sx={{ color: '#00d4ff', textShadow: '0 0 10px #00d4ff66' }}>
              Evolución del MAE (últimos 6 meses)
            </Typography>
            {metricas && metricas.maeHistorico.length > 0 ? (
              <MaeNeonChart data={metricas.maeHistorico} />
            ) : (
              <Typography color="rgba(255,255,255,0.4)" sx={{ py: 4, textAlign: 'center' }}>Sin datos históricos aún.</Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* Tramos con mayor error */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            Top 5 tramos con mayor error de estimación
          </Typography>
          {metricas && metricas.tramosConMayorError.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Origen</TableCell>
                    <TableCell>Destino</TableCell>
                    <TableCell align="right">MAE (horas)</TableCell>
                    <TableCell align="right">Viajes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metricas.tramosConMayorError.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell>{t.origen}</TableCell>
                      <TableCell>{t.destino}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${t.maeHoras} h`}
                          size="small"
                          color={t.maeHoras > 12 ? 'error' : t.maeHoras > 6 ? 'warning' : 'success'}
                        />
                      </TableCell>
                      <TableCell align="right">{t.cantidadViajes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">Sin datos suficientes aún.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Comparativa Modelo ML vs Heurístico */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            Comparativa: Modelo ML vs Heurístico
          </Typography>
          {metricas?.comparativaDisponible && metricas.maeModeloMl != null ? (
            <ComparativaMae maeHeuristico={metricas.maeHeuristico} maeModeloMl={metricas.maeModeloMl} />
          ) : (
            <Typography color="text.secondary">
              El modelo aún no fue entrenado. Tocá "Reentrenar modelo" para entrenarlo con los datos actuales.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Historial de versiones del modelo */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} mb={2}>
            Historial de versiones del modelo
          </Typography>
          {metricas && metricas.versiones.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Versión</TableCell>
                    <TableCell>Fecha entrenado</TableCell>
                    <TableCell align="right">Registros usados</TableCell>
                    <TableCell align="right">MAE modelo</TableCell>
                    <TableCell align="right">MAE heurístico</TableCell>
                    <TableCell>Algoritmo</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metricas.versiones.map((v, i) => (
                    <TableRow key={i}>
                      <TableCell>{v.version}</TableCell>
                      <TableCell>{new Date(v.entrenadoEn).toLocaleString()}</TableCell>
                      <TableCell align="right">{v.registrosUsados}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${v.maeModelo} h`}
                          size="small"
                          color={v.maeModelo <= v.maeHeuristico ? 'success' : 'warning'}
                        />
                      </TableCell>
                      <TableCell align="right">{v.maeHeuristico} h</TableCell>
                      <TableCell>{v.algoritmo}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography color="text.secondary">Todavía no hay versiones entrenadas.</Typography>
          )}
        </CardContent>
      </Card>

      {/* Alertas de riesgo */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              Alertas de riesgo de demora activas
            </Typography>
            {alertas.length > 0 && (
              <Chip label={alertas.length} color="error" size="small" />
            )}
          </Stack>
          {metricas?.precisionAlertas != null && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Precisión de alertas: {metricas.precisionAlertas}% sobre {metricas.alertasEvaluadas} gestionada(s) — sirve para calibrar el umbral.
            </Typography>
          )}
          {alertas.length === 0 ? (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'success.main' }}>
              <CheckCircleIcon fontSize="small" />
              <Typography variant="body2">Sin alertas activas en este momento.</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {alertas.map((a) => (
                <Paper
                  key={a.id}
                  variant="outlined"
                  sx={{ p: 2, borderLeft: '4px solid #e65100', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}
                >
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
                      <WarningAmberIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                      <Typography variant="body2" fontWeight={700}>
                        {a.codigoSeguimiento}
                      </Typography>
                      <Chip
                        label={`${Math.round(a.probabilidadDemora * 100)}% riesgo`}
                        size="small"
                        color="warning"
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {a.causaPrincipal}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Tooltip title="El envío llegó a tiempo (registra falsa alarma)">
                      <Button size="small" variant="outlined" color="success"
                        onClick={() => handleGestionar(a.id, true)}>
                        Llegó a tiempo
                      </Button>
                    </Tooltip>
                    <Tooltip title="El envío se demoró (alerta acertada)">
                      <Button size="small" variant="outlined" color="warning"
                        onClick={() => handleGestionar(a.id, false)}>
                        Se demoró
                      </Button>
                    </Tooltip>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      {/* Reentrenamiento */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700}>Reentrenamiento del modelo</Typography>
              <Typography variant="body2" color="text.secondary">
                {metricas?.puedeReentrenar
                  ? `Hay ${metricas.nuevosRegistros30Dias} nuevos registros disponibles. El modelo puede actualizarse.`
                  : `Se necesitan al menos 50 registros en los últimos 30 días. Actualmente hay ${metricas?.nuevosRegistros30Dias ?? 0}.`}
              </Typography>
            </Box>
            <Tooltip title={metricas?.puedeReentrenar ? 'Iniciar reentrenamiento' : 'Datos insuficientes'}>
              <span>
                <Button
                  variant="contained"
                  startIcon={reentrenando ? <CircularProgress size={16} color="inherit" /> : <AutorenewIcon />}
                  onClick={handleReentrenar}
                  disabled={!metricas?.puedeReentrenar || reentrenando}
                >
                  {reentrenando ? 'Reentrenando...' : 'Reentrenar modelo'}
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar
        open={!!snackbar}
        autoHideDuration={4000}
        onClose={() => setSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSnackbar('')} icon={<CheckCircleIcon />}>
          {snackbar}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!snackbarError}
        autoHideDuration={5000}
        onClose={() => setSnackbarError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSnackbarError('')} icon={<ErrorOutlineIcon />}>
          {snackbarError}
        </Alert>
      </Snackbar>
    </Box>
  )
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: '12px !important' }}>
        <Typography variant="h4" fontWeight={800} sx={{ color }}>
          {value}
        </Typography>
        <Typography variant="body2" fontWeight={600}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{sub}</Typography>
      </CardContent>
    </Card>
  )
}

function ComparativaMae({ maeHeuristico, maeModeloMl }: { maeHeuristico: number; maeModeloMl: number }) {
  const modeloMejor = maeModeloMl <= maeHeuristico
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <Paper
          variant="outlined"
          sx={{ p: 2, textAlign: 'center', borderColor: modeloMejor ? 'success.main' : undefined, borderWidth: modeloMejor ? 2 : 1 }}
        >
          <Typography variant="body2" fontWeight={600} color="text.secondary">Modelo ML</Typography>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#7b1fa2' }}>{maeModeloMl} h</Typography>
          <Typography variant="caption" color="text.secondary">error medio absoluto</Typography>
        </Paper>
        <Paper
          variant="outlined"
          sx={{ p: 2, textAlign: 'center', borderColor: !modeloMejor ? 'success.main' : undefined, borderWidth: !modeloMejor ? 2 : 1 }}
        >
          <Typography variant="body2" fontWeight={600} color="text.secondary">Heurístico</Typography>
          <Typography variant="h4" fontWeight={800} sx={{ color: '#0288d1' }}>{maeHeuristico} h</Typography>
          <Typography variant="caption" color="text.secondary">error medio absoluto</Typography>
        </Paper>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center">
        <CheckCircleIcon fontSize="small" color="success" />
        <Typography variant="body2">
          {maeModeloMl === maeHeuristico
            ? 'Ambos métodos tienen el mismo MAE.'
            : `Mejor método: ${modeloMejor ? 'Modelo ML' : 'Heurístico'} (menor MAE).`}
        </Typography>
      </Stack>
    </Stack>
  )
}

function MaeNeonChart({ data }: { data: { mes: string; mae: number; registros: number }[] }) {
  const W = 380, H = 180
  const PAD = { top: 16, right: 16, bottom: 36, left: 44 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const maxMae = Math.max(...data.map(d => d.mae), 1)

  const xOf = (i: number) => PAD.left + (data.length < 2 ? innerW / 2 : (i / (data.length - 1)) * innerW)
  const yOf = (v: number) => PAD.top + innerH - (v / maxMae) * innerH

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d.mae).toFixed(1)}`).join(' ')
  const areaPath = linePath
    + ` L${xOf(data.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)}`
    + ` L${xOf(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`

  const gridValues = [0, maxMae * 0.5, maxMae]

  return (
    <Box sx={{
      '@keyframes drawLine': { from: { strokeDashoffset: 2000 }, to: { strokeDashoffset: 0 } },
      '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } },
    }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="neon-line">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="neon-dot">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mag-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff00ff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ff00ff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grid horizontales */}
        {gridValues.map((v, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yOf(v)} x2={W - PAD.right} y2={yOf(v)}
              stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="4,4" />
            <text x={PAD.left - 6} y={yOf(v)} textAnchor="end" dominantBaseline="middle"
              fontSize="9" fill="rgba(255,255,255,0.35)">{v.toFixed(1)}h</text>
          </g>
        ))}

        {/* Grid verticales */}
        {data.map((_, i) => (
          <line key={i} x1={xOf(i)} y1={PAD.top} x2={xOf(i)} y2={PAD.top + innerH}
            stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}

        {/* Área relleno */}
        <path d={areaPath} fill="url(#area-grad)"
          style={{ animation: 'fadeIn 1.2s ease forwards', animationDelay: '0.4s', opacity: 0 }} />

        {/* Línea glow (blur) */}
        <path d={linePath} fill="none" stroke="#00d4ff" strokeWidth="3" filter="url(#neon-line)" opacity={0.5} />

        {/* Línea principal animada */}
        <path d={linePath} fill="none" stroke="#00d4ff" strokeWidth="2"
          strokeDasharray="2000" strokeDashoffset="2000"
          style={{ animation: 'drawLine 1.8s cubic-bezier(0.4,0,0.2,1) forwards' }} />

        {/* Segunda línea neón magenta (mejora: si el mae baja, colorea verde) */}
        {data.length >= 2 && (() => {
          const trend = data[data.length - 1].mae - data[0].mae
          const color = trend < 0 ? '#39ff14' : '#ff00ff'
          const glow = trend < 0 ? 'rgba(57,255,20,0.4)' : 'rgba(255,0,255,0.4)'
          return (
            <>
              <path d={linePath} fill="none" stroke={color} strokeWidth="1" opacity="0.35"
                strokeDasharray="2000" strokeDashoffset="2000"
                style={{ animation: 'drawLine 1.8s cubic-bezier(0.4,0,0.2,1) 0.15s forwards' }}
                filter="url(#neon-line)"
              />
              <text x={W - PAD.right} y={PAD.top - 4} textAnchor="end" fontSize="9"
                fill={glow} style={{ animation: 'fadeIn 1s ease 1.5s forwards', opacity: 0 }}>
                {trend < 0 ? '▼ mejorando' : '▲ empeorando'}
              </text>
            </>
          )
        })()}

        {/* Puntos neón */}
        {data.map((d, i) => (
          <g key={i} style={{ animation: `fadeIn 0.4s ease ${0.8 + i * 0.12}s forwards`, opacity: 0 }}>
            <circle cx={xOf(i)} cy={yOf(d.mae)} r="6" fill="transparent" stroke="#00d4ff" strokeWidth="1.5"
              opacity="0.4" filter="url(#neon-dot)" />
            <circle cx={xOf(i)} cy={yOf(d.mae)} r="3.5" fill="#00d4ff" filter="url(#neon-dot)" />
            <circle cx={xOf(i)} cy={yOf(d.mae)} r="2" fill="#fff" />
          </g>
        ))}

        {/* Etiqueta valor sobre cada punto */}
        {data.map((d, i) => (
          <text key={i} x={xOf(i)} y={yOf(d.mae) - 12} textAnchor="middle" fontSize="9"
            fill="#00d4ff" fontWeight="700"
            style={{ animation: `fadeIn 0.4s ease ${1 + i * 0.12}s forwards`, opacity: 0 }}
            filter="url(#neon-line)">
            {d.mae}h
          </text>
        ))}

        {/* Etiquetas eje X */}
        {data.map((d, i) => (
          <text key={i} x={xOf(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.45)">
            {d.mes.split(' ')[0]}
          </text>
        ))}
      </svg>

      {/* Leyenda mini */}
      <Stack direction="row" spacing={2} sx={{ mt: 1, px: 1 }} flexWrap="wrap">
        {data.map((d, i) => (
          <Typography key={i} variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>
            {d.mes}: <strong style={{ color: '#00d4ff' }}>{d.mae}h</strong> · {d.registros} reg.
          </Typography>
        ))}
      </Stack>
    </Box>
  )
}

function ErrorBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" mb={0.3}>
        <Typography variant="caption">{label}</Typography>
        <Typography variant="caption" fontWeight={700}>{value}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={value}
        sx={{ height: 8, borderRadius: 4, bgcolor: `${color}22`, '& .MuiLinearProgress-bar': { bgcolor: color } }}
      />
    </Box>
  )
}
