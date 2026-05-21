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

interface Props {
  open: boolean
  umbral: number
  onClose: () => void
  // Se llama cuando la prueba quedó registrada (aprobada o por máximo de intentos).
  onCompletado: (aprobada: boolean) => void
}

const DURACION_MS = 5000

type Fase = 'cargando-modelo' | 'listo' | 'grabando' | 'analizando' | 'resultado' | 'error'

// G1L-60: prueba acústica con análisis local (HuBERT). El audio no se transmite ni se guarda.
export default function PruebaAcusticaDialog({ open, umbral, onClose, onCompletado }: Props) {
  const [fase, setFase] = useState<Fase>('cargando-modelo')
  const [progresoModelo, setProgresoModelo] = useState(0)
  const [intentos, setIntentos] = useState(0)
  const [ultimo, setUltimo] = useState<AnalisisVoz | null>(null)
  const [aprobada, setAprobada] = useState(false)
  const [error, setError] = useState('')
  const [registrando, setRegistrando] = useState(false)
  const [modeloOk, setModeloOk] = useState(true)
  const recorderRef = useRef<MediaRecorder | null>(null)

  useEffect(() => {
    if (!open) return
    setIntentos(0); setUltimo(null); setAprobada(false); setError(''); setModeloOk(true)
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
    const chunks: BlobPart[] = []
    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = async () => {
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
    setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop() }, DURACION_MS)
  }

  const registrar = async (a: AnalisisVoz, intento: number, paso: boolean) => {
    setRegistrando(true)
    await ojoPatronService.registrarPrueba({
      scoreNeu: a.neu, scoreHap: a.hap, scoreSad: a.sad, scoreAng: a.ang,
      alertnessScore: a.alertness, intentos: intento, resultado: paso ? 0 : 2,
    })
    setRegistrando(false)
  }

  return (
    <Dialog open={open} onClose={() => fase === 'resultado' && onClose()} fullWidth maxWidth="xs">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GraphicEqIcon color="primary" /> <span>Prueba de inicio de ruta</span>
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
                  <Stack alignItems="center" spacing={1}>
                    <MicIcon sx={{ fontSize: 56, color: '#c62828' }} />
                    <Typography variant="body2" color="error">Grabando… hablá ahora (5s)</Typography>
                    <LinearProgress sx={{ width: '100%' }} />
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
            <Stack spacing={1} alignItems="center" sx={{ py: 1 }}>
              <CheckCircleIcon sx={{ fontSize: 56, color: '#2e7d32' }} />
              <Typography variant="h6" sx={{ color: '#2e7d32' }}>Prueba aprobada</Typography>
              {ultimo && (
                <Typography variant="caption" color="text.secondary">
                  Activación vocal: {(ultimo.alertness * 100).toFixed(0)}% (umbral {(umbral * 100).toFixed(0)}%)
                </Typography>
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
