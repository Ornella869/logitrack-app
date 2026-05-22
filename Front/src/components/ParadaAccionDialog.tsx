import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import NavigationIcon from '@mui/icons-material/Navigation'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import QrCameraScanner from './QrCameraScanner'
import { shipmentService } from '../services/shipmentService'
import type { Shipment } from '../types'

const MOTIVOS_DEMORA = [
  'Tráfico intenso',
  'Desvío por obra',
  'Problema con el vehículo',
  'Dirección difícil de encontrar',
  'Sin respuesta en el domicilio',
  'Otro',
]

interface ScanResult {
  prevStatus: string
  message: string
  severity: 'success' | 'info'
}

interface ParadaAccionDialogProps {
  open: boolean
  parada: Shipment | null
  onClose: () => void
  onScanSuccess: (feedback: { severity: 'success' | 'info' | 'error'; message: string }) => void
  onReload: () => void
}

export default function ParadaAccionDialog({
  open,
  parada,
  onClose,
  onScanSuccess,
  onReload,
}: ParadaAccionDialogProps) {
  const navigate = useNavigate()
  const [qrTab, setQrTab] = useState<0 | 1>(0)
  const [manualCode, setManualCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [demoraOpen, setDemoraOpen] = useState(false)
  const [demoraMotivo, setDemoraMotivo] = useState('')
  const [demoraOtro, setDemoraOtro] = useState('')
  const [demoraLoading, setDemoraLoading] = useState(false)
  const [demoraError, setDemoraError] = useState('')
  const lastScannedRef = useRef<{ code: string; at: number } | null>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setScanResult(null)
      setManualCode('')
      setDemoraOpen(false)
      setDemoraMotivo('')
      setDemoraOtro('')
      setDemoraError('')
      setScanning(false)
      setQrTab(0)
    }
  }, [open])

  // Auto-fill tracking code when switching to manual tab
  useEffect(() => {
    if (qrTab === 1 && parada?.trackingId) {
      setManualCode(parada.trackingId)
    }
  }, [qrTab, parada?.trackingId])

  const handleClose = () => {
    if (scanResult) {
      onScanSuccess({ severity: scanResult.severity, message: scanResult.message })
    }
    onClose()
  }

  const processScan = async (code: string) => {
    if (scanning) return
    setScanning(true)
    const result = await shipmentService.escanearQr(code)
    setScanning(false)
    if (!result.success) {
      onScanSuccess({ severity: 'error', message: result.error ?? 'No se pudo procesar el QR' })
      onClose()
      return
    }
    const accion = result.data?.accion
    if (accion === 'AbrirFichaEntrega' && result.data?.paqueteId) {
      onClose()
      navigate(`/shipment/${result.data.paqueteId}`)
      return
    }
    const message = result.data?.mensaje
      ?? (accion === 'TransitoIniciado' ? 'Tránsito iniciado. ¡Buena ruta!' : 'Estado actualizado correctamente.')
    setScanResult({
      prevStatus: parada?.status ?? '',
      message,
      severity: 'success',
    })
    onReload()
  }

  const handleCameraDetect = (code: string) => {
    if (scanning) return
    const now = Date.now()
    const last = lastScannedRef.current
    if (last && last.code === code && now - last.at < 3000) return
    lastScannedRef.current = { code, at: now }
    void processScan(code)
  }

  const handleManualSubmit = () => {
    const code = manualCode.trim()
    if (!code) return
    void processScan(code)
  }

  const handleDemora = async () => {
    const motivo = demoraMotivo === 'Otro' ? demoraOtro.trim() : demoraMotivo
    if (!motivo || !parada) return
    setDemoraLoading(true)
    setDemoraError('')
    const result = await shipmentService.marcarDemorado(parada.id, motivo)
    setDemoraLoading(false)
    if (!result.success) {
      setDemoraError(result.error ?? 'No se pudo registrar la demora')
      return
    }
    setScanResult({
      prevStatus: parada.status,
      message: 'Envío marcado como demorado.',
      severity: 'info',
    })
    onReload()
  }

  if (!parada) return null

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      {/* Header azul */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1565C0 0%, #0d47a1 100%)',
          px: 3,
          py: 2.5,
          color: '#fff',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          <NavigationIcon />
          <Typography variant="h6" fontWeight={700}>
            Próxima parada
          </Typography>
        </Stack>
        <Typography variant="body2" sx={{ opacity: 0.85 }}>
          {parada.receiver.name}
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          {parada.receiver.address}, {parada.receiver.city}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          <Chip
            label={parada.status}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600, fontSize: 11 }}
          />
          {parada.trackingId && (
            <Chip
              label={parada.trackingId}
              size="small"
              sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 11 }}
            />
          )}
        </Stack>
      </Box>

      <DialogContent sx={{ pt: 2, pb: 1 }}>
        {/* ── Resultado del escaneo ── */}
        {scanResult ? (
          <Stack spacing={2} alignItems="center" sx={{ py: 2, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ fontSize: 60, color: scanResult.severity === 'success' ? '#2e7d32' : '#1565C0' }} />
            <Typography variant="h6" fontWeight={700} color={scanResult.severity === 'success' ? 'success.main' : 'primary.main'}>
              {scanResult.severity === 'success' ? '¡Estado actualizado!' : '¡Registrado!'}
            </Typography>

            {/* Estado anterior → nuevo */}
            <Box
              sx={{
                width: '100%',
                bgcolor: 'action.hover',
                borderRadius: 2,
                px: 2,
                py: 1.5,
              }}
            >
              <Stack spacing={0.8}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Estado anterior
                  </Typography>
                  <Chip
                    label={scanResult.prevStatus}
                    size="small"
                    sx={{ fontSize: 11, fontWeight: 600 }}
                  />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>
                    Resultado
                  </Typography>
                  <Typography variant="caption" fontWeight={600} color={scanResult.severity === 'success' ? 'success.main' : 'primary.main'}>
                    {scanResult.message}
                  </Typography>
                </Stack>
              </Stack>
            </Box>
          </Stack>
        ) : (
          <>
            {/* ── Tabs QR ── */}
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
              Escanear etiqueta QR
            </Typography>
            <Tabs
              value={qrTab}
              onChange={(_, v) => setQrTab(v as 0 | 1)}
              sx={{ mb: 1.5, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
            >
              <Tab icon={<QrCodeScannerIcon fontSize="small" />} iconPosition="start" label="Cámara" value={0} />
              <Tab icon={<KeyboardIcon fontSize="small" />} iconPosition="start" label="Manual" value={1} />
            </Tabs>

            {scanning && (
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">Procesando...</Typography>
              </Stack>
            )}

            {qrTab === 0 && (
              <QrCameraScanner onDetect={handleCameraDetect} height={220} />
            )}

            {qrTab === 1 && (
              <Stack spacing={1}>
                <TextField
                  size="small"
                  fullWidth
                  label="Código de seguimiento"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleManualSubmit() }}
                  disabled={scanning}
                  InputProps={{
                    sx: { fontFamily: 'monospace', letterSpacing: 1 },
                  }}
                />
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={scanning ? <CircularProgress size={16} color="inherit" /> : <QrCodeScannerIcon />}
                  onClick={handleManualSubmit}
                  disabled={!manualCode.trim() || scanning}
                >
                  {scanning ? 'Procesando...' : 'Confirmar código'}
                </Button>
              </Stack>
            )}

            {/* ── Demora ── */}
            <Box sx={{ mt: 2.5, borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
              {!demoraOpen ? (
                <Button
                  size="small"
                  startIcon={<AccessTimeIcon />}
                  color="warning"
                  onClick={() => setDemoraOpen(true)}
                  sx={{ textTransform: 'none' }}
                >
                  Reportar demora en esta parada
                </Button>
              ) : (
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" fontWeight={700} color="warning.main">
                    Motivo de la demora
                  </Typography>
                  {demoraError && <Alert severity="error" sx={{ py: 0 }}>{demoraError}</Alert>}
                  <Select
                    size="small"
                    fullWidth
                    value={demoraMotivo}
                    onChange={(e) => { setDemoraMotivo(e.target.value); setDemoraError('') }}
                    displayEmpty
                  >
                    <MenuItem value="" disabled>Seleccioná un motivo</MenuItem>
                    {MOTIVOS_DEMORA.map((m) => (
                      <MenuItem key={m} value={m}>{m}</MenuItem>
                    ))}
                  </Select>
                  {demoraMotivo === 'Otro' && (
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Describí el motivo"
                      value={demoraOtro}
                      onChange={(e) => setDemoraOtro(e.target.value)}
                      multiline
                      rows={2}
                    />
                  )}
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => { setDemoraOpen(false); setDemoraMotivo(''); setDemoraOtro('') }}>
                      Cancelar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      disabled={!demoraMotivo || (demoraMotivo === 'Otro' && !demoraOtro.trim()) || demoraLoading}
                      startIcon={demoraLoading ? <CircularProgress size={14} /> : <AccessTimeIcon />}
                      onClick={handleDemora}
                    >
                      Confirmar demora
                    </Button>
                  </Stack>
                </Stack>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      {/* Actions */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, pb: 2, pt: 0.5 }}>
        <Button
          size="small"
          onClick={handleClose}
          color="inherit"
          variant={scanResult ? 'contained' : 'text'}
          sx={scanResult ? { bgcolor: '#0d47a1', '&:hover': { bgcolor: '#082f6e' }, color: '#fff' } : undefined}
        >
          {scanResult ? 'Listo' : 'Cerrar'}
        </Button>
        {!scanResult && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<OpenInNewIcon />}
            onClick={() => { onClose(); navigate(`/shipment/${parada.id}`) }}
          >
            Ver y gestionar
          </Button>
        )}
      </Stack>
    </Dialog>
  )
}
