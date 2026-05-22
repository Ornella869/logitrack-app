import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { ensureModel, analizarAudio, type AnalisisVoz } from '../services/voiceAnalysis'
import { ojoPatronService } from '../services/ojoPatronService'

// Visualizador de onda de sonido usando Web Audio API + Canvas
// Usa callback ref para evitar conflictos de tipos entre RefObject<T|null> y LegacyRef<T>
function SoundWaveCanvas({ onMount }: { onMount: (el: HTMLCanvasElement | null) => void }) {
  return (
    <canvas
      ref={onMount}
      width={300}
      height={80}
      style={{
        width: '100%',
        height: 80,
        borderRadius: 10,
        background: 'rgba(198,40,40,0.06)',
        display: 'block',
      }}
    />
  )
}

interface Props {
  open: boolean
  umbral: number
  // Momento de la prueba: 0 = inicio de ruta, 1 = mitad de recorrido.
  momento?: 0 | 1
  onClose: () => void
  // Se llama cuando la prueba quedó registrada (aprobada o por máximo de intentos).
  onCompletado: (aprobada: boolean) => void
}

const DURACION_MS = 5000

type Fase = 'cargando-modelo' | 'listo' | 'grabando' | 'analizando' | 'resultado' | 'error'

// G1L-60: prueba acústica con análisis local (HuBERT). El audio no se transmite ni se guarda.
export default function PruebaAcusticaDialog({ open, umbral, momento = 0, onClose, onCompletado }: Props) {
  const [fase, setFase] = useState<Fase>('cargando-modelo')
  const [progresoModelo, setProgresoModelo] = useState(0)
  const [intentos, setIntentos] = useState(0)
  const [ultimo, setUltimo] = useState<AnalisisVoz | null>(null)
  const [aprobada, setAprobada] = useState(false)
  const [error, setError] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [modeloOk, setModeloOk] = useState(true)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const animFrameRef = useRef<number>(0)
  const waveCanvasRef = useRef<HTMLCanvasElement | null>(null)

  const startWaveAnimation = () => {
    const analyser = analyserRef.current
    const canvas = waveCanvasRef.current
    if (!analyser || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const BAR_COUNT = 30
    const step = Math.max(1, Math.floor(bufferLength / BAR_COUNT))

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      const { width, height } = canvas
      ctx.clearRect(0, 0, width, height)
      const barW = Math.floor((width - (BAR_COUNT - 1) * 3) / BAR_COUNT)
      for (let i = 0; i < BAR_COUNT; i++) {
        const val = (dataArray[i * step] ?? 0) / 255
        const barH = Math.max(4, val * height * 0.88)
        const x = i * (barW + 3)
        const y = (height - barH) / 2
        const alpha = (0.55 + val * 0.45).toFixed(2)
        ctx.fillStyle = `rgba(${Math.round(198 + val * 40)},${Math.round(40 + val * 20)},40,${alpha})`
        ctx.fillRect(x, y, barW, barH)
      }
    }
    draw()
  }

  const stopWaveAnimation = () => {
    cancelAnimationFrame(animFrameRef.current)
    analyserRef.current?.disconnect()
    analyserRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
  }

  useEffect(() => () => stopWaveAnimation(), [])

  useEffect(() => {
    if (!open) { stopWaveAnimation(); return }
    setIntentos(0); setUltimo(null); setAprobada(false); setError(''); setModeloOk(true); setRegistroError(false)
    setFase('cargando-modelo'); setProgresoModelo(0)
    // El gate es por energía de voz (RMS), así que aunque el modelo de emoción
    // no cargue, igual se puede hacer la prueba. La emoción es complementaria.
    ensureModel((p) => setProgresoModelo(p))
      .then(() => { setModeloOk(true); setFase('listo') })
      .catch(() => { setModeloOk(false); setFase('listo') })
  }, [open])

  const grabar = async () => {
    setError('')
    let stream: MediaStream
    try {
      // Desactivamos el control automático de ganancia para que la energía medida
      // refleje el volumen real (con AGC, hablar bajo se amplifica al nivel normal).
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false },
      })
    } catch {
      setError('No se pudo acceder al micrófono. Revisá los permisos del navegador.')
      return
    }
    // Conectar stream al visualizador de onda
    const audioCtx = new AudioContext()
    audioCtxRef.current = audioCtx
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 128
    analyserRef.current = analyser
    audioCtx.createMediaStreamSource(stream).connect(analyser)

    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = async () => {
      stopWaveAnimation()
      stream.getTracks().forEach((t) => t.stop())
      setFase('analizando')
      try {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
        const analisis = await analizarAudio(blob)
        const intentoActual = intentos + 1
        setIntentos(intentoActual)
        setUltimo(analisis)
        const paso = analisis.alertness >= umbral

        // Gate estricto: solo aprobar habilita el inicio de ruta. Si falla, se registra
        // como rechazada y se permite reintentar (sin tope).
        await registrar(analisis, intentoActual, paso)
        if (paso) {
          setAprobada(true)
          setFase('resultado')
        } else {
          setFase('listo')
        }
      } catch {
        setError('No se pudo analizar el audio. Intentá de nuevo.')
        setFase('listo')
      }
    }
    setFase('grabando')
    recorder.start()
    // Esperar el próximo frame para que el canvas esté en el DOM
    setTimeout(() => startWaveAnimation(), 60)
    setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, DURACION_MS)
  }

  const [registroError, setRegistroError] = useState(false)

  const registrar = async (a: AnalisisVoz, intento: number, paso: boolean) => {
    setRegistrando(true)
    setRegistroError(false)
    const result = await ojoPatronService.registrarPrueba({
      scoreNeu: a.neu, scoreHap: a.hap, scoreSad: a.sad, scoreAng: a.ang,
      alertnessScore: a.alertness, intentos: intento, resultado: paso ? 0 : 2, momento,
    })
    if (!result.success) setRegistroError(true)
    setRegistrando(false)
  }

  return (
    <Dialog open={open} onClose={() => fase === 'resultado' && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GraphicEqIcon color="primary" /> <span>{momento === 1 ? 'Prueba de mitad de recorrido' : 'Prueba de inicio de ruta'}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {fase === 'cargando-modelo' && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Preparando el análisis de voz (se descarga una sola vez)…
              </Typography>
              <LinearProgress variant={progresoModelo > 0 ? 'determinate' : 'indeterminate'} value={progresoModelo} />
            </Box>
          )}

          {fase === 'error' && <Alert severity="error">{error}</Alert>}

          {(fase === 'listo' || fase === 'grabando' || fase === 'analizando') && (
            <>
              <Typography variant="body2" color="text.secondary">
                Grabá 5 segundos de tu voz (por ejemplo, decí tu nombre y la fecha de hoy) para validar tu estado antes de salir.
                El audio se procesa en tu dispositivo y no se guarda.
              </Typography>
              {error && <Alert severity="warning">{error}</Alert>}
              {intentos > 0 && fase === 'listo' && !aprobada && (
                <Alert severity="warning">
                  No superaste la prueba. No podés iniciar la ruta hasta aprobarla. Intentá de nuevo (intento {intentos}).
                  {ultimo && (
                    <Box component="span" sx={{ display: 'block', mt: 0.5, fontSize: 12 }}>
                      Activación vocal detectada: <strong>{(ultimo.alertness * 100).toFixed(0)}%</strong> · umbral {(umbral * 100).toFixed(0)}%
                    </Box>
                  )}
                </Alert>
              )}
              {!modeloOk && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  (Análisis de tono no disponible; la prueba se evalúa solo por energía de voz.)
                </Typography>
              )}
              {registroError && fase === 'listo' && (
                <Alert severity="warning" sx={{ py: 0.5, fontSize: 12 }}>
                  El resultado no pudo guardarse en el servidor. Si el problema persiste, contactá al administrador.
                </Alert>
              )}
              {ultimo && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Energía de voz: {(ultimo.nivelVoz * 100).toFixed(0)}%
                  {ultimo.emocionDisponible && ` · aptitud emocional: ${(ultimo.aptitudEmocional * 100).toFixed(0)}%`}
                </Typography>
              )}
              {ultimo && ultimo.emocionDisponible && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Tono detectado: neutral {(ultimo.neu * 100).toFixed(0)}% · alegría {(ultimo.hap * 100).toFixed(0)}% · tristeza {(ultimo.sad * 100).toFixed(0)}% · enojo {(ultimo.ang * 100).toFixed(0)}%
                </Typography>
              )}
              <Box sx={{ textAlign: 'center', py: 1 }}>
                {fase === 'grabando' ? (
                  <Stack alignItems="center" spacing={1.5}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{
                        width: 10, height: 10, borderRadius: '50%', bgcolor: '#c62828',
                        animation: 'pulseDot 1s ease-in-out infinite',
                        '@keyframes pulseDot': {
                          '0%,100%': { opacity: 1, transform: 'scale(1)' },
                          '50%': { opacity: 0.4, transform: 'scale(0.75)' },
                        },
                      }} />
                      <Typography variant="body2" color="error" fontWeight={600}>
                        Grabando… hablá ahora (5 seg)
                      </Typography>
                    </Stack>
                    <SoundWaveCanvas onMount={(el) => { waveCanvasRef.current = el }} />
                  </Stack>
                ) : fase === 'analizando' ? (
                  <Stack alignItems="center" spacing={1}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary">Analizando…</Typography>
                  </Stack>
                ) : (
                  <Button variant="contained" size="large" startIcon={<MicIcon />} onClick={grabar}>
                    Grabar
                  </Button>
                )}
              </Box>
            </>
          )}

          {fase === 'resultado' && (
            <Stack spacing={1.5} alignItems="center" sx={{ py: 1 }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: '#2e7d32' }} />
              <Typography variant="h6" sx={{ color: '#2e7d32' }}>Prueba aprobada</Typography>
              {ultimo && (
                <Stack spacing={0.3} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    Activación vocal: {(ultimo.alertness * 100).toFixed(0)}% · umbral {(umbral * 100).toFixed(0)}%
                  </Typography>
                  {ultimo.emocionDisponible && (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      Neu {(ultimo.neu * 100).toFixed(0)}% · Ale {(ultimo.hap * 100).toFixed(0)}% · Tri {(ultimo.sad * 100).toFixed(0)}% · Eno {(ultimo.ang * 100).toFixed(0)}%
                    </Typography>
                  )}
                </Stack>
              )}
              {registroError && (
                <Alert severity="warning" sx={{ width: '100%', fontSize: 12 }}>
                  No se pudo guardar el resultado en el servidor. El registro de auditoría puede estar incompleto — contactá al administrador.
                </Alert>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {fase === 'resultado' ? (
          <Button
            variant="contained"
            onClick={() => { onCompletado(aprobada); onClose() }}
            disabled={registrando}
          >
            Continuar
          </Button>
        ) : (
          <Button onClick={onClose} disabled={fase === 'grabando' || fase === 'analizando' || registrando}>
            Cancelar
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
