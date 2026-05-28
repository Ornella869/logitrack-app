import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import PhoneIcon from '@mui/icons-material/Phone'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { notificationService } from '../services/notificationService'
import { incidenciaService, type TipoIncidencia } from '../services/incidenciaService'
import { shipmentService } from '../services/shipmentService'
import type { User } from '../types'
import { formatInstantArgentinaTime } from '../utils/argentinaDate'

interface ChatMessage {
  id: string
  from: 'user' | 'tracky'
  text: string
  time: string
  showFollowUp?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  user: User
}

const TEMPLATES = [
  { id: 'accident' as TipoIncidencia, emoji: '🚗', label: 'Accidente de tráfico', text: 'Tuve un accidente de tráfico durante mi ruta y necesito asistencia.' },
  { id: 'mechanical' as TipoIncidencia, emoji: '🔧', label: 'Problema mecánico', text: 'Mi vehículo tiene un problema mecánico y no puedo continuar la ruta.' },
  { id: 'danger' as TipoIncidencia, emoji: '⚠️', label: 'Zona de riesgo', text: 'Estoy en una zona de riesgo y me siento inseguro/a.' },
  { id: 'health' as TipoIncidencia, emoji: '😷', label: 'Problema de salud', text: 'No me siento bien y necesito asistencia médica urgente.' },
  { id: 'delivery' as TipoIncidencia, emoji: '📦', label: 'No puedo entregar', text: 'No puedo completar una entrega y necesito orientación del supervisor.' },
  { id: 'demorado' as TipoIncidencia, emoji: '⏰', label: 'Envío demorado', text: 'Un envío de mi ruta se está demorando y no voy a poder entregarlo en el horario previsto.' },
]

const TRACKY_RESPONSES: Record<string, string> = {
  accident: '¡Qué situación! Lo más importante sos vos. 🚨\n\n• Asegurate de estar en un lugar seguro\n• Si hay heridos, llamá al 911 de inmediato\n• Activá las balizas del vehículo\n• No muevas el vehículo si hubo colisión\n\n¿Querés que le avise a tu supervisor ahora mismo?',
  mechanical: '¡Entendido! Los problemas mecánicos pueden pasar. 🔧\n\nTe recomiendo:\n• Estacioná en un lugar seguro y activá las balizas\n• No intentes reparar en la vía pública\n• Tu supervisor puede coordinar asistencia mecánica\n\n¿Notifico al supervisor para que te organicen ayuda?',
  danger: '¡Tu seguridad es lo primero! ⚠️\n\nSi estás en peligro inmediato:\n• Llamá al 911 ahora\n• Alejate del área si podés hacerlo con seguridad\n• Quedate en un lugar iluminado y concurrido\n\n¿Alertamos a tu supervisor de inmediato?',
  health: '¡Eso es serio, hay que atenderlo enseguida! 😟\n\nPor favor:\n• Si es urgente, llamá al 107 (SAME) o 911\n• Pará el vehículo en un lugar seguro\n• No sigas conduciendo si no te sentís bien\n\n¿Notifico al supervisor para que te envíen asistencia?',
  delivery: 'Entendido, vemos qué podemos hacer. 📦\n\nAlgunas opciones según la situación:\n• Destinatario ausente → intentá en horario alternativo\n• Dirección incorrecta → el supervisor puede verificar los datos\n\n¿Notifico al supervisor ahora?',
  demorado: 'Entendido, los retrasos pueden pasar. ⏰\n\nAlgunos pasos a seguir:\n• Avisale al destinatario que llegás más tarde si podés\n• Anotá la causa del retraso (tráfico, desvío, etc.)\n• El supervisor puede reorganizar las entregas restantes\n\n¿Notifico al supervisor para que tome nota del retraso?',
}

const GENERIC_RESPONSE = 'Recibí tu mensaje. 📝\n\nEstoy aquí para ayudarte con cualquier situación durante tu ruta. ¿Qué querés hacer ahora?'

const KEYWORDS: { pattern: RegExp; tipoId: string }[] = [
  { pattern: /accidente|choque|colisi[oó]n|colision/i, tipoId: 'accident' },
  { pattern: /mec[aá]nic|mecanic|veh[ií]culo|vehiculo|goma|pinchaz|freno|motor/i, tipoId: 'mechanical' },
  { pattern: /zona|riesgo|peligro|insegur|robo|asalt/i, tipoId: 'danger' },
  { pattern: /salud|m[eé]dico|medico|enferm|mareo|dolor|herido|lastim/i, tipoId: 'health' },
  { pattern: /entregar|entrega|destinatario|ausente|direcci[oó]n|nadie/i, tipoId: 'delivery' },
  { pattern: /demor|retraso|tarde|no llego a tiempo|no llegar[eé]/i, tipoId: 'demorado' },
]

// Respuestas afirmativas: "si", "sí", "dale", "ok", "claro", "avisá", etc.
const AFFIRMATIVE = /^(s[ií]|dale|ok|claro|sí por favor|si por favor|avisá?|notificá?|avisa|notifica|por favor|anda|va|bueno)\.?$/i

// Respuestas negativas: "no", "no gracias", "estoy bien"
const NEGATIVE = /^(no|no gracias|estoy bien|gracias|tranquilo|tranquila|no te preocupes)\.?$/i

function detectKeyword(text: string): string | null {
  for (const { pattern, tipoId } of KEYWORDS) {
    if (pattern.test(text)) return tipoId
  }
  return null
}

const FOLLOW_UP_OPTS = [
  { id: 'templates', emoji: '📋', label: 'Ver opciones de reporte' },
  { id: 'supervisor', emoji: '👮', label: 'Notificar supervisor' },
  { id: 'ok', emoji: '✅', label: 'Estoy bien, gracias' },
]

const WELLBEING_RESPONSE = 'Qué bueno saberlo! 😊\n\nRecordá que podés contactarme en cualquier momento si surge algo durante la jornada. ¡Cuídate y buena ruta!'

function nowTime(): string {
  return formatInstantArgentinaTime(new Date(), { hour: '2-digit', minute: '2-digit' })
}

function welcomeMsg(): ChatMessage {
  return {
    id: 'welcome',
    from: 'tracky',
    text: '¡Hola! Soy Tracky 🤖\n\nEstoy aquí para ayudarte si tenés algún inconveniente durante tu jornada.\nContame qué pasó o elegí una de las opciones de abajo.',
    time: nowTime(),
  }
}

// Avatar de Tracky — robot azul con cara expresiva, estilo LogiTrack
function TrackyAvatar({ size = 52 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="trFaceGrad" cx="38%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#42A5F5" />
          <stop offset="100%" stopColor="#1565C0" />
        </radialGradient>
      </defs>
      {/* Círculo exterior */}
      <circle cx="50" cy="50" r="48" fill="#0D47A1" />
      <circle cx="50" cy="50" r="45" fill="url(#trFaceGrad)" />
      {/* Brillo superior */}
      <ellipse cx="37" cy="22" rx="22" ry="9" fill="white" opacity="0.1" />
      {/* Gorra */}
      <path d="M 20 46 Q 20 15 50 12 Q 80 15 80 46 Z" fill="#0D47A1" />
      <path d="M 13 48 Q 50 41 87 48" stroke="#082070" strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* Logo en la gorra */}
      <circle cx="50" cy="23" r="5" fill="#42A5F5" />
      <text x="50" y="26" textAnchor="middle" fill="white" fontSize="6" fontWeight="bold" fontFamily="Arial">L</text>
      {/* Antena */}
      <rect x="48" y="3" width="4" height="10" rx="2" fill="#90CAF9" />
      <circle cx="50" cy="3" r="4" fill="#42A5F5" />
      <circle cx="50" cy="3" r="2.2" fill="white" />
      {/* Ojos — fondo oscuro */}
      <circle cx="35" cy="57" r="11" fill="#082070" />
      <circle cx="65" cy="57" r="11" fill="#082070" />
      {/* Esclerótica */}
      <circle cx="35" cy="57" r="8.5" fill="#E3F2FD" />
      <circle cx="65" cy="57" r="8.5" fill="#E3F2FD" />
      {/* Iris */}
      <circle cx="35" cy="57" r="5.5" fill="#1976D2" />
      <circle cx="65" cy="57" r="5.5" fill="#1976D2" />
      {/* Pupila */}
      <circle cx="35" cy="57" r="3" fill="#0D47A1" />
      <circle cx="65" cy="57" r="3" fill="#0D47A1" />
      {/* Brillo en ojo */}
      <circle cx="35" cy="57" r="1.4" fill="#90CAF9" />
      <circle cx="65" cy="57" r="1.4" fill="#90CAF9" />
      <circle cx="32" cy="54" r="1.8" fill="white" opacity="0.85" />
      <circle cx="62" cy="54" r="1.8" fill="white" opacity="0.85" />
      {/* Sonrisa */}
      <path d="M 32 72 Q 50 84 68 72" stroke="white" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      {/* Mejillas */}
      <ellipse cx="23" cy="65" rx="7" ry="4.5" fill="#FF8A80" opacity="0.38" />
      <ellipse cx="77" cy="65" rx="7" ry="4.5" fill="#FF8A80" opacity="0.38" />
      {/* Badge pecho */}
      <rect x="28" y="80" width="44" height="14" rx="5" fill="#082070" />
      <text x="50" y="90" textAnchor="middle" fill="#64B5F6" fontSize="8" fontWeight="bold" fontFamily="Arial, sans-serif">TRACKY</text>
    </svg>
  )
}

function ChatBubble({ msg, isDark, onFollowUp }: {
  msg: ChatMessage
  isDark: boolean
  onFollowUp?: (id: string) => void
}) {
  const isTracky = msg.from === 'tracky'
  return (
    <Stack direction={isTracky ? 'row' : 'row-reverse'} spacing={1} alignItems="flex-end" sx={{ mb: 1.5 }}>
      {isTracky && (
        <Box sx={{ flexShrink: 0, mb: 0.5 }}>
          <TrackyAvatar size={30} />
        </Box>
      )}
      <Box sx={{ maxWidth: '80%' }}>
        <Paper
          elevation={0}
          sx={{
            px: 1.8, py: 1.2,
            borderRadius: isTracky ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
            bgcolor: isTracky
              ? (isDark ? '#0d2137' : '#E3F2FD')
              : '#1565C0',
            color: isTracky ? 'text.primary' : 'white',
            border: isTracky
              ? `1px solid ${isDark ? 'rgba(100,181,246,0.18)' : 'rgba(25,118,210,0.18)'}`
              : 'none',
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line', lineHeight: 1.6 }}>
            {msg.text}
          </Typography>
        </Paper>

        {/* Opciones follow-up */}
        {msg.showFollowUp && onFollowUp && (
          <Stack direction="row" spacing={0.7} flexWrap="wrap" sx={{ mt: 0.8, ml: 0.5 }}>
            {FOLLOW_UP_OPTS.map((opt) => (
              <Chip
                key={opt.id}
                label={`${opt.emoji} ${opt.label}`}
                size="small"
                onClick={() => onFollowUp(opt.id)}
                sx={{
                  cursor: 'pointer',
                  bgcolor: isDark ? 'rgba(25,118,210,0.15)' : 'rgba(25,118,210,0.08)',
                  color: '#1565C0',
                  border: '1px solid rgba(25,118,210,0.3)',
                  fontSize: 11,
                  fontWeight: 500,
                  '&:hover': { bgcolor: 'rgba(25,118,210,0.2)' },
                }}
              />
            ))}
          </Stack>
        )}

        <Typography variant="caption" color="text.disabled" sx={{ px: 0.5, display: 'block', textAlign: isTracky ? 'left' : 'right', mt: 0.3 }}>
          {msg.time}
        </Typography>
      </Box>
    </Stack>
  )
}

export default function ReportarIncidenteDialog({ open, onClose, user }: Props) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMsg()])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [supervisorNotificado, setSupervisorNotificado] = useState(false)
  const [lastTemplateId, setLastTemplateId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open) {
      setMessages([welcomeMsg()])
      setInput('')
      setSupervisorNotificado(false)
      setTyping(false)
      setLastTemplateId(null)
    }
  }, [open])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const addUserMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, from: 'user', text, time: nowTime() }])
  }

  const addTrackyMessage = (text: string, showFollowUp = false) => {
    setMessages((prev) => [...prev, { id: `t_${Date.now()}`, from: 'tracky', text, time: nowTime(), showFollowUp }])
  }

  const simulateReply = (templateId?: string) => {
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      // Siempre mostramos follow-up para que el usuario tenga opciones claras
      addTrackyMessage(
        templateId ? (TRACKY_RESPONSES[templateId] ?? GENERIC_RESPONSE) : GENERIC_RESPONSE,
        true,
      )
    }, 900)
  }

  const handleSend = () => {
    const text = input.trim()
    if (!text) return
    addUserMessage(text)
    setInput('')

    // Si hay contexto de incidente y el usuario responde afirmativamente → notificar supervisor
    if (lastTemplateId && !supervisorNotificado && AFFIRMATIVE.test(text)) {
      setTyping(true)
      setTimeout(() => { setTyping(false); handleNotificarSupervisor() }, 700)
      return
    }

    // Si el usuario responde negativamente → cierre amigable
    if (lastTemplateId && NEGATIVE.test(text)) {
      setTyping(true)
      setTimeout(() => { setTyping(false); addTrackyMessage(WELLBEING_RESPONSE, false) }, 700)
      return
    }

    const detectedType = detectKeyword(text)
    if (detectedType) {
      setLastTemplateId(detectedType)
      if (detectedType === 'demorado') {
        setTyping(true)
        setTimeout(() => {
          setTyping(false)
          handleNotificarSupervisor('demorado')
        }, 900)
      } else {
        simulateReply(detectedType)
      }
    } else {
      simulateReply()
    }
  }

  const handleTemplate = (t: typeof TEMPLATES[0]) => {
    addUserMessage(t.text)
    setLastTemplateId(t.id)
    if (t.id === 'demorado') {
      // Notifica al supervisor automáticamente sin mostrar consejos.
      setTyping(true)
      setTimeout(() => {
        setTyping(false)
        handleNotificarSupervisor('demorado')
      }, 900)
    } else {
      simulateReply(t.id)
    }
  }

  const handleFollowUp = (optId: string) => {
    // Marcar el mensaje que tenía follow-up como consumido
    setMessages((prev) => prev.map((m) => ({ ...m, showFollowUp: false })))

    if (optId === 'templates') {
      addTrackyMessage('Claro, acá están las opciones. Elegí la que mejor describe tu situación:')
    } else if (optId === 'supervisor') {
      handleNotificarSupervisor()
    } else if (optId === 'ok') {
      addUserMessage('Estoy bien, gracias.')
      setTyping(true)
      setTimeout(() => { setTyping(false); addTrackyMessage(WELLBEING_RESPONSE) }, 700)
    }
  }

  const handleNotificarSupervisor = (tipoId?: string) => {
    const tipoTemplate = tipoId ?? lastTemplateId ?? 'otro'
    const tipoLabel = TEMPLATES.find((t) => t.id === tipoTemplate)?.label ?? 'Incidente'

    if (incidenciaService.checkDuplicateRepartidor(user.id, tipoTemplate)) {
      addTrackyMessage(`⚠️ Ya reporté un incidente de tipo "${tipoLabel}" recientemente al supervisor. No generé una nueva notificación para evitar duplicados.\n\nSi la situación empeoró o cambió, contame los detalles nuevos.`, true)
      return
    }

    notificationService.add({
      type: 'incidencia',
      title: '🚨 Incidente reportado',
      message: `${user.name} reportó: ${tipoLabel}. Revisá la sección de Incidencias.`,
      recipientId: 'supervisor',
      sucursalId: user.sucursalId ?? undefined,
      navigateTo: '/incidencias',
    })

    setSupervisorNotificado(true)
    addTrackyMessage('✅ ¡Listo! Le avisé a tu supervisor ahora mismo. En breve se van a comunicar con vos.\n\nQuedá tranquilo/a, estás en buenas manos. ¿Hay algo más?', true)

    void (async () => {
      let paradasAfectadas: string[] = []
      try {
        const ruta = await shipmentService.getMiRutaDelDia()
        paradasAfectadas = ruta.paradas
          .filter((p) => p.status === 'En tránsito' || p.status === 'Demorado')
          .map((p) => p.id)
      } catch {
        // no bloqueamos si falla
      }
      incidenciaService.create({
        repartidorId: user.id,
        repartidorNombre: user.name,
        tipo: tipoTemplate as TipoIncidencia,
        tipoLabel,
        descripcion: TEMPLATES.find((t) => t.id === tipoTemplate)?.text ?? 'Incidente reportado por repartidor.',
        estado: 'Abierta',
        paradasAfectadas,
      })
    })()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          height: { xs: '90vh', sm: 630 },
          display: 'flex',
          flexDirection: 'column',
          border: `2px solid ${isDark ? 'rgba(198,40,40,0.3)' : 'rgba(198,40,40,0.18)'}`,
        },
      }}
    >
      {/* Header azul */}
      <DialogTitle sx={{ p: 0 }}>
        <Box
          sx={{
            px: 2.5, py: 1.5,
            background: isDark
              ? 'linear-gradient(135deg, #0a1929 0%, #0d2137 100%)'
              : 'linear-gradient(135deg, #E3F2FD 0%, #f0f8ff 100%)',
            borderBottom: `1px solid ${isDark ? 'rgba(25,118,210,0.25)' : 'rgba(25,118,210,0.18)'}`,
            borderRadius: '10px 10px 0 0',
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <TrackyAvatar size={46} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: isDark ? '#42A5F5' : '#1565C0', lineHeight: 1.2 }}>
                Tracky
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Asistente de incidentes · LogiTrack
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#4caf50' }} />
              <Typography variant="caption" color="text.secondary">en línea</Typography>
            </Stack>
            <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 0, overflow: 'hidden' }}>
        {/* Área de mensajes */}
        <Box
          sx={{
            flex: 1, overflowY: 'auto', px: 2.5, py: 2,
            bgcolor: isDark ? '#060e18' : '#f7fbff',
          }}
        >
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              msg={msg}
              isDark={isDark}
              onFollowUp={msg.showFollowUp ? handleFollowUp : undefined}
            />
          ))}

          {/* Indicador "escribiendo..." */}
          {typing && (
            <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ mb: 1.5 }}>
              <TrackyAvatar size={30} />
              <Paper
                elevation={0}
                sx={{
                  px: 2, py: 1.2, borderRadius: '4px 16px 16px 16px',
                  bgcolor: isDark ? '#0d2137' : '#E3F2FD',
                  border: `1px solid ${isDark ? 'rgba(100,181,246,0.18)' : 'rgba(25,118,210,0.18)'}`,
                }}
              >
                <Stack direction="row" spacing={0.5} alignItems="center">
                  {[0, 150, 300].map((delay) => (
                    <Box
                      key={delay}
                      sx={{
                        width: 7, height: 7, borderRadius: '50%', bgcolor: '#1976D2',
                        animation: 'trBounce 1.2s ease-in-out infinite',
                        animationDelay: `${delay}ms`,
                        '@keyframes trBounce': {
                          '0%,80%,100%': { transform: 'scale(0.6)', opacity: 0.4 },
                          '40%': { transform: 'scale(1)', opacity: 1 },
                        },
                      }}
                    />
                  ))}
                </Stack>
              </Paper>
            </Stack>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Plantillas rápidas */}
        <Box
          sx={{
            px: 2, py: 1.2,
            bgcolor: isDark ? '#060e18' : '#f7fbff',
            borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#dde8f5'}`,
          }}
        >
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Reportes rápidos
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
            {TEMPLATES.map((t) => (
              <Chip
                key={t.id}
                label={`${t.emoji} ${t.label}`}
                size="small"
                onClick={() => handleTemplate(t)}
                disabled={typing}
                sx={{
                  cursor: 'pointer',
                  bgcolor: isDark ? 'rgba(25,118,210,0.12)' : 'rgba(25,118,210,0.08)',
                  color: isDark ? '#64B5F6' : '#1565C0',
                  border: '1px solid rgba(25,118,210,0.25)',
                  fontWeight: 500,
                  fontSize: 11,
                  '&:hover': { bgcolor: 'rgba(25,118,210,0.18)' },
                }}
              />
            ))}
          </Box>
        </Box>

        <Divider />

        {/* Input */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: isDark ? '#060e18' : 'white' }}>
          <TextField
            fullWidth size="small"
            placeholder="Contale a Tracky qué pasó…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            disabled={typing}
            multiline maxRows={3}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleSend} disabled={!input.trim() || typing} sx={{ color: '#1565C0' }}>
                    <SendIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              sx: { borderRadius: 3 },
            }}
          />
        </Box>

        {/* Botones de acción */}
        <Box sx={{ px: 2, pb: 2, pt: 0.5, bgcolor: isDark ? '#060e18' : 'white', borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0'}` }}>
          {supervisorNotificado ? (
            <Alert severity="success" icon={<CheckCircleIcon fontSize="small" />} sx={{ borderRadius: 2, py: 0.5 }}>
              Supervisor notificado. ¡Vamos para allá!
            </Alert>
          ) : (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                fullWidth variant="contained"
                startIcon={<NotificationsActiveIcon />}
                onClick={() => handleNotificarSupervisor()}
                sx={{
                  bgcolor: '#c62828', '&:hover': { bgcolor: '#b71c1c' },
                  borderRadius: 2, fontWeight: 600,
                  boxShadow: '0 3px 10px rgba(198,40,40,0.3)',
                }}
              >
                Notificar Supervisor
              </Button>
              <Button
                fullWidth variant="outlined"
                startIcon={<PhoneIcon />}
                href="tel:911"
                component="a"
                sx={{
                  color: '#c62828', borderColor: '#c62828', borderRadius: 2, fontWeight: 600,
                  '&:hover': { bgcolor: 'rgba(198,40,40,0.06)', borderColor: '#b71c1c' },
                }}
              >
                Emergencias (911)
              </Button>
            </Stack>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
