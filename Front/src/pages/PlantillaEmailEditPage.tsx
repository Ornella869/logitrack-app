import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import VisibilityIcon from '@mui/icons-material/Visibility'
import RestoreIcon from '@mui/icons-material/Restore'
import FormatBoldIcon from '@mui/icons-material/FormatBold'
import FormatItalicIcon from '@mui/icons-material/FormatItalic'
import LinkIcon from '@mui/icons-material/Link'
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions'
import { plantillaEmailService, VARIABLES_SOPORTADAS, type PlantillaEmail } from '../services/plantillaEmailService'

function validarVariables(texto: string): string[] {
  const invalidas: string[] = []
  const regex = /\{\{[^}]+\}\}/g
  const matches = texto.match(regex) ?? []
  const permitidas = new Set(VARIABLES_SOPORTADAS.map((v) => v.variable))
  for (const m of matches) {
    if (!permitidas.has(m)) invalidas.push(m)
  }
  return invalidas
}

function insertarEnCursor(ref: React.RefObject<HTMLTextAreaElement>, texto: string) {
  const el = ref.current
  if (!el) return
  const start = el.selectionStart
  const end = el.selectionEnd
  const valor = el.value
  const nuevo = valor.substring(0, start) + texto + valor.substring(end)
  const event = Object.assign(new Event('input', { bubbles: true }), {})
  Object.defineProperty(event, 'target', { value: { ...el, value: nuevo } })
  el.focus()
  el.setRangeText(texto, start, end, 'end')
  return nuevo
}

export default function PlantillaEmailEditPage() {
  const { evento } = useParams<{ evento: string }>()
  const [plantilla, setPlantilla] = useState<PlantillaEmail | null>(null)
  const [asunto, setAsunto] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [preview, setPreview] = useState(false)
  const [confirmarRestaurar, setConfirmarRestaurar] = useState(false)
  const [emojiAnchor, setEmojiAnchor] = useState<null | HTMLElement>(null)
  const cuerpoRef = useRef<HTMLTextAreaElement>(null)

  const eventoNum = parseInt(evento ?? '', 10)

  useEffect(() => {
    if (isNaN(eventoNum)) return
    plantillaEmailService
      .obtener(eventoNum)
      .then((p) => {
        setPlantilla(p)
        setAsunto(p.asunto)
        setCuerpo(p.cuerpo)
      })
      .catch(() => setMessage({ type: 'error', text: 'No se pudo cargar la plantilla.' }))
      .finally(() => setLoading(false))
  }, [eventoNum])

  const erroresVariables = validarVariables(asunto + ' ' + cuerpo)

  const onGuardar = async () => {
    if (!asunto.trim()) { setMessage({ type: 'error', text: 'El asunto no puede estar vacío.' }); return }
    if (!cuerpo.trim()) { setMessage({ type: 'error', text: 'El cuerpo no puede estar vacío.' }); return }
    if (erroresVariables.length > 0) {
      setMessage({ type: 'error', text: `Variables inválidas: ${erroresVariables.join(', ')}` })
      return
    }
    setSaving(true)
    try {
      const updated = await plantillaEmailService.guardar(eventoNum, { asunto, cuerpo })
      setPlantilla(updated)
      setMessage({ type: 'success', text: 'Plantilla guardada correctamente.' })
    } catch (err: any) {
      const errData = err?.response?.data
      const errMsg = typeof errData === 'string' ? errData : errData?.mensaje ?? 'No se pudo guardar la plantilla.'
      setMessage({ type: 'error', text: errMsg })
    } finally {
      setSaving(false)
    }
  }

  const onRestaurar = async () => {
    setSaving(true)
    try {
      await plantillaEmailService.restaurar(eventoNum)
      const updated = await plantillaEmailService.obtener(eventoNum)
      setPlantilla(updated)
      setAsunto(updated.asunto)
      setCuerpo(updated.cuerpo)
      setConfirmarRestaurar(false)
      setMessage({ type: 'success', text: 'Plantilla restaurada al valor por defecto.' })
    } catch {
      setMessage({ type: 'error', text: 'No se pudo restaurar la plantilla.' })
    } finally {
      setSaving(false)
    }
  }

  const insertarFormato = (tipo: 'bold' | 'italic' | 'link') => {
    const el = cuerpoRef.current
    if (!el) return
    const sel = cuerpo.substring(el.selectionStart, el.selectionEnd) || 'texto'
    let insercion = ''
    if (tipo === 'bold') insercion = `<strong>${sel}</strong>`
    if (tipo === 'italic') insercion = `<em>${sel}</em>`
    if (tipo === 'link') insercion = `<a href="URL">${sel}</a>`
    const nuevo = insertarEnCursor(cuerpoRef, insercion)
    if (nuevo !== undefined) setCuerpo(nuevo)
  }

  const previewBody = cuerpo
    ? cuerpo.replace(/\n/g, '<br>')
    : '<p style="color:#64748b;font-style:italic;">Sin contenido.</p>'

  const previewHtml = `
    <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:16px;">
      <div style="background:linear-gradient(135deg,#1d4ed8,#1e40af);padding:20px;border-radius:10px 10px 0 0;text-align:center;">
        <div style="font-size:32px;">🚛</div>
        <h2 style="margin:8px 0 0;font-size:18px;color:#fff;">${asunto}</h2>
      </div>
      <div style="background:#1e293b;padding:20px;border-radius:0 0 10px 10px;color:#e2e8f0;">
        ${previewBody}
      </div>
    </div>
  `

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="40vh">
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: 'auto' }}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box>
            <Typography variant="h5" fontWeight={800}>{plantilla?.eventoNombre ?? 'Plantilla'}</Typography>
            <Typography variant="body2" color="text.secondary">
              Provincia: <strong>{plantilla?.provincia}</strong>
              {plantilla?.esPersonalizada && (
                <Chip label="Personalizada" size="small" color="primary" variant="outlined" sx={{ ml: 1, height: 20 }} />
              )}
            </Typography>
          </Box>
        </Stack>

        {message && <Alert severity={message.type} onClose={() => setMessage(null)}>{message.text}</Alert>}

        {erroresVariables.length > 0 && (
          <Alert severity="warning">
            Variables inválidas: <strong>{erroresVariables.join(', ')}</strong>.
            {' '}Usá solo: {VARIABLES_SOPORTADAS.map((v) => v.variable).join(', ')}
          </Alert>
        )}

        <TextField
          label="Asunto del email"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          fullWidth
          helperText="Podés usar variables como {{tracking}} o {{destinatario}}"
        />

        <Paper variant="outlined" sx={{ borderRadius: 2 }}>
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5, borderBottom: '1px solid #e0e0e0' }}>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mr: 1 }}>FORMATO</Typography>
              <Tooltip title="Negrita">
                <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => insertarFormato('bold')}><FormatBoldIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Itálica">
                <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => insertarFormato('italic')}><FormatItalicIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Link">
                <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => insertarFormato('link')}><LinkIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Tooltip title="Emojis">
                <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={(e) => setEmojiAnchor(e.currentTarget)}><EmojiEmotionsIcon fontSize="small" /></IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ mr: 0.5 }}>VARIABLES</Typography>
              {plantilla?.variablesDisponibles.split(',').map((v) => v.trim()).filter(Boolean).map((v) => (
                <Chip
                  key={v}
                  label={v}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
                  onClick={() => {
                    const el = cuerpoRef.current
                    if (!el) return
                    const nuevo = insertarEnCursor(cuerpoRef, v)
                    if (nuevo !== undefined) setCuerpo(nuevo)
                  }}
                />
              ))}
            </Stack>
          </Box>
          <TextField
            inputRef={cuerpoRef}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            multiline
            minRows={10}
            fullWidth
            placeholder="Escribí el cuerpo del email en HTML. Usá las variables y los botones de formato de arriba."
            sx={{ '& fieldset': { border: 'none' } }}
          />
        </Paper>

        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={onGuardar}
            disabled={saving || erroresVariables.length > 0}
          >
            Guardar plantilla
          </Button>
          <Button
            variant="outlined"
            startIcon={<VisibilityIcon />}
            onClick={() => setPreview(true)}
          >
            Previsualizar
          </Button>
          {plantilla?.esPersonalizada && (
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RestoreIcon />}
              onClick={() => setConfirmarRestaurar(true)}
              disabled={saving}
            >
              Restaurar por defecto
            </Button>
          )}
        </Stack>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 1 }}>
            VARIABLES DISPONIBLES
          </Typography>
          <Stack spacing={0.5}>
            {VARIABLES_SOPORTADAS.map((v) => (
              <Stack key={v.variable} direction="row" spacing={1} alignItems="center">
                <Chip label={v.variable} size="small" variant="outlined" sx={{ fontSize: '0.75rem', fontFamily: 'monospace' }} />
                <Typography variant="caption" color="text.secondary">{v.descripcion}</Typography>
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Stack>

      {/* Emoji picker */}
      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 1 } } }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 260 }}>
          {['📦','🚚','🚛','✅','❌','⚠️','🎉','📍','🔔','💬','📧','🕐','👋','😊','🙏','👍','❗','✨','📱','🗓️','🏠','🔑','📋','🚨','💡'].map((emoji) => (
            <IconButton
              key={emoji}
              size="small"
              sx={{ fontSize: '1.25rem', lineHeight: 1, p: 0.5 }}
              onClick={() => {
                const nuevo = insertarEnCursor(cuerpoRef, emoji)
                if (nuevo !== undefined) setCuerpo(nuevo)
                setEmojiAnchor(null)
              }}
            >
              {emoji}
            </IconButton>
          ))}
        </Box>
      </Popover>

      {/* Preview dialog */}
      <Dialog open={preview} onClose={() => setPreview(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Previsualización</DialogTitle>
        <DialogContent dividers sx={{ p: 0, bgcolor: '#0f172a' }}>
          <Box
            dangerouslySetInnerHTML={{ __html: previewHtml }}
            sx={{ minHeight: 300 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview(false)}>Cerrar</Button>
          <Button variant="contained" onClick={() => { setPreview(false); onGuardar() }} disabled={saving || erroresVariables.length > 0}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Restaurar confirm */}
      <Dialog open={confirmarRestaurar} onClose={() => setConfirmarRestaurar(false)}>
        <DialogTitle>Restaurar plantilla</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Restaurar la plantilla <strong>{plantilla?.eventoNombre}</strong> al valor por defecto?
            Se perderán todos los cambios personalizados.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmarRestaurar(false)}>Cancelar</Button>
          <Button color="warning" variant="contained" onClick={onRestaurar} disabled={saving}>
            Restaurar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
