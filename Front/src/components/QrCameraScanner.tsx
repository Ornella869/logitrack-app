import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Alert, Box, Button, MenuItem, Select, Stack, Typography } from '@mui/material'
import CameraAltIcon from '@mui/icons-material/CameraAlt'

// Si el QR codifica la URL pública de seguimiento, nos quedamos con el ID.
function extractTrackingCode(raw: string): string {
  const match = raw.match(/seguimiento\/([^/?#]+)/i)
  return match ? match[1] : raw.trim()
}

interface QrCameraScannerProps {
  /** Llamado cuando se decodifica un QR. Recibe el código (ya limpio si era una URL). */
  onDetect: (code: string) => void
  /** Por qué falló si no pudo iniciar la cámara (permiso denegado, sin cámara, etc.). */
  onError?: (message: string) => void
  /** Altura del visor de cámara. */
  height?: number
}

export default function QrCameraScanner({ onDetect, onError, height = 280 }: QrCameraScannerProps) {
  const containerIdRef = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([])
  const [cameraId, setCameraId] = useState<string>('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Listamos cámaras al montar.
  useEffect(() => {
    let cancelled = false
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (cancelled) return
        const list = devices.map((d) => ({ id: d.id, label: d.label || 'Cámara' }))
        setCameras(list)
        // Preferimos la trasera (back / environment) si existe.
        const back = list.find((c) => /back|trasera|environment/i.test(c.label))
        setCameraId((back ?? list[0])?.id ?? '')
      })
      .catch((e: Error) => {
        if (cancelled) return
        const msg = e?.message ?? 'No se pudo acceder a la cámara'
        setError(msg)
        onError?.(msg)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Arranca / detiene el scanner cuando hay cámara seleccionada.
  useEffect(() => {
    if (!cameraId) return
    let active = true
    const html5Qr = new Html5Qrcode(containerIdRef.current)
    scannerRef.current = html5Qr

    html5Qr
      .start(
        cameraId,
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (!active) return
          onDetect(extractTrackingCode(decodedText))
        },
        () => {
          // No-op: el callback de error se dispara constantemente cuando no hay QR.
        },
      )
      .then(() => {
        setRunning(true)
        setError(null)
      })
      .catch((e: Error) => {
        const msg = e?.message ?? 'No se pudo iniciar la cámara'
        setError(msg)
        onError?.(msg)
      })

    return () => {
      active = false
      const s = scannerRef.current
      scannerRef.current = null
      if (s && s.isScanning) {
        s.stop().then(() => s.clear()).catch(() => undefined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId])

  if (error) {
    return (
      <Alert severity="warning" icon={<CameraAltIcon />}>
        <Typography variant="body2" fontWeight={600}>
          No se pudo acceder a la cámara
        </Typography>
        <Typography variant="caption">
          {error} — Igual podés ingresar el código manualmente abajo.
        </Typography>
      </Alert>
    )
  }

  return (
    <Stack spacing={1}>
      {cameras.length > 1 && (
        <Select
          size="small"
          value={cameraId}
          onChange={(e) => setCameraId(String(e.target.value))}
        >
          {cameras.map((c) => (
            <MenuItem key={c.id} value={c.id}>
              {c.label}
            </MenuItem>
          ))}
        </Select>
      )}
      <Box
        id={containerIdRef.current}
        sx={{
          width: '100%',
          height,
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: '#000',
          '& video': { width: '100%', height: '100%', objectFit: 'cover' },
        }}
      />
      {!running && cameras.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          Buscando cámaras disponibles…
        </Typography>
      )}
      {running && (
        <Stack direction="row" alignItems="center" spacing={1}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2e7d32' }} />
          <Typography variant="caption" color="text.secondary">
            Escaneando… apuntá la cámara al código QR.
          </Typography>
          <Box flex={1} />
          <Button
            size="small"
            onClick={() => {
              const s = scannerRef.current
              if (s && s.isScanning) {
                s.stop().then(() => s.clear()).catch(() => undefined)
              }
              setRunning(false)
            }}
          >
            Pausar
          </Button>
        </Stack>
      )}
    </Stack>
  )
}
