import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Stack,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import PrintIcon from '@mui/icons-material/Print'
import { shipmentService, type EtiquetaResponse } from '../services/shipmentService'

// G1L-28 + G1L-32: Etiqueta de envío imprimible con QR.
// El QR base64 viene listo del back, el front solo lo muestra.

export default function ShipmentLabel() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<EtiquetaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!id) return
      const res = await shipmentService.getEtiqueta(id)
      if (res) {
        setData(res)
      } else {
        setError('No se pudo obtener la etiqueta')
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (!data) {
    return (
      <Box>
        <Alert severity="error">{error || 'Etiqueta no encontrada'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          Volver
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      {/* Toolbar oculto al imprimir — G1L-28 AC3 */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ mb: 3, displayPrint: 'none' }}
        className="no-print"
      >
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
          Volver
        </Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>
          Imprimir
        </Button>
      </Stack>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .label-card { box-shadow: none !important; border: 1px solid #000 !important; page-break-inside: avoid; }
        }
      `}</style>

      <Box
        className="label-card"
        sx={{
          maxWidth: 480,
          mx: 'auto',
          p: 3,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          boxShadow: 1,
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="overline" sx={{ fontWeight: 700, letterSpacing: 2 }}>
            LogiTrack
          </Typography>
          <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
            {data.codigoSeguimiento}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Tipo: {data.tipoEnvio} · {data.tipoPaquete} · {data.peso} kg
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          {/* QR en base64 — G1L-32 */}
          <img
            src={data.qrBase64}
            alt={`QR ${data.codigoSeguimiento}`}
            style={{ width: 200, height: 200 }}
          />
        </Box>

        <Typography variant="caption" color="textSecondary" align="center" display="block" sx={{ mb: 2 }}>
          {data.urlSeguimiento}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Box sx={{ mb: 2 }}>
          <Typography variant="overline" color="textSecondary">
            Remitente
          </Typography>
          <Typography variant="body2">
            {data.remitente.nombre} {data.remitente.apellido}
          </Typography>
          <Typography variant="body2">{data.remitente.direccion}</Typography>
          <Typography variant="body2">
            {data.remitente.ciudad} ({data.remitente.cp})
          </Typography>
          {data.remitente.telefono && (
            <Typography variant="body2">Tel: {data.remitente.telefono}</Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        <Box>
          <Typography variant="overline" color="textSecondary">
            Destinatario
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {data.destinatario.nombre} {data.destinatario.apellido}
          </Typography>
          <Typography variant="body1">{data.destinatario.direccion}</Typography>
          <Typography variant="body1">
            {data.destinatario.ciudad} ({data.destinatario.cp})
          </Typography>
          {data.destinatario.telefono && (
            <Typography variant="body2">Tel: {data.destinatario.telefono}</Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
