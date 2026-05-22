import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { MapContainer, TileLayer, Rectangle, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SaveIcon from '@mui/icons-material/Save'
import DeleteIcon from '@mui/icons-material/Delete'
import AddLocationAltIcon from '@mui/icons-material/AddLocationAlt'
import { tarifaService, type ConfiguracionTarifa, type ZonaPeligrosa } from '../services/tarifaService'
import { branchService } from '../services/branchService'
import type { User } from '../types'

type LatLng = { lat: number; lng: number }

// Captura los clics en el mapa para definir las dos esquinas del rectángulo.
function ClickCapturer({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function TarifasPage() {
  const user = useOutletContext<User>()
  const isAdmin = user.role === 'gerente'

  const [config, setConfig] = useState<ConfiguracionTarifa | null>(null)
  const [kg, setKg] = useState('')
  const [km, setKm] = useState('')
  const [recargo, setRecargo] = useState('')
  const [savingConfig, setSavingConfig] = useState(false)
  const [configMsg, setConfigMsg] = useState<{ sev: 'success' | 'error'; text: string } | null>(null)

  const [zonas, setZonas] = useState<ZonaPeligrosa[]>([])
  const [loading, setLoading] = useState(true)
  const [corners, setCorners] = useState<LatLng[]>([])
  const [zonaNombre, setZonaNombre] = useState('')
  const [savingZona, setSavingZona] = useState(false)
  const [zonaMsg, setZonaMsg] = useState<{ sev: 'success' | 'error'; text: string } | null>(null)
  // Centro inicial del mapa: sucursal de origen si tiene coords; si no, centro de Argentina.
  const [mapCenter, setMapCenter] = useState<[number, number]>([-34.6, -58.45])
  const [mapZoom, setMapZoom] = useState(11)

  useEffect(() => {
    void (async () => {
      const [c, z, origen] = await Promise.all([
        tarifaService.getConfiguracion(),
        tarifaService.getZonas(),
        branchService.getSucursalOrigen().catch(() => null),
      ])
      if (c) {
        setConfig(c)
        setKg(String(c.precioPorKg))
        setKm(String(c.precioPorKm))
        setRecargo(String(c.porcentajeRecargoZonaPeligrosa))
      }
      setZonas(z)
      if (origen?.latitud != null && origen?.longitud != null) {
        setMapCenter([origen.latitud, origen.longitud])
        setMapZoom(12)
      }
      setLoading(false)
    })()
  }, [])

  const handleSaveConfig = async () => {
    const nKg = Number(kg), nKm = Number(km), nRec = Number(recargo)
    if ([nKg, nKm, nRec].some((v) => isNaN(v) || v < 0)) {
      setConfigMsg({ sev: 'error', text: 'Los valores deben ser números no negativos.' })
      return
    }
    setSavingConfig(true)
    const res = await tarifaService.actualizarConfiguracion(nKg, nKm, nRec)
    setSavingConfig(false)
    setConfigMsg(res.success
      ? { sev: 'success', text: 'Tarifas actualizadas. Impactan en las cotizaciones futuras.' }
      : { sev: 'error', text: res.error ?? 'Error al guardar' })
  }

  const handleMapClick = (p: LatLng) => {
    if (!isAdmin) return
    setCorners((prev) => (prev.length >= 2 ? [p] : [...prev, p]))
  }

  const rectBounds = corners.length === 2
    ? [[corners[0].lat, corners[0].lng], [corners[1].lat, corners[1].lng]] as [[number, number], [number, number]]
    : null

  const handleSaveZona = async () => {
    if (corners.length !== 2) {
      setZonaMsg({ sev: 'error', text: 'Marcá dos esquinas en el mapa para delimitar la zona.' })
      return
    }
    if (!zonaNombre.trim()) {
      setZonaMsg({ sev: 'error', text: 'Poné un nombre a la zona.' })
      return
    }
    setSavingZona(true)
    const res = await tarifaService.crearZona(
      zonaNombre.trim(),
      corners[0].lat, corners[1].lat,
      corners[0].lng, corners[1].lng,
    )
    setSavingZona(false)
    if (res.success) {
      setZonas(await tarifaService.getZonas())
      setCorners([])
      setZonaNombre('')
      setZonaMsg({ sev: 'success', text: 'Zona peligrosa creada.' })
    } else {
      setZonaMsg({ sev: 'error', text: res.error ?? 'Error al crear la zona' })
    }
  }

  const handleDeleteZona = async (id: string) => {
    await tarifaService.eliminarZona(id)
    setZonas(await tarifaService.getZonas())
  }

  if (!isAdmin) {
    return <Alert severity="warning">Solo el Gerente puede configurar tarifas.</Alert>
  }

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5 }}>Gestión de tarifas</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configurá los valores base de tarificación y las zonas de riesgo que aplican recargo.
      </Typography>

      <Grid container spacing={3}>
        {/* G1L-87: Configuración de tarifas */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>Valores base</Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField
                  label="Precio por kilogramo ($/kg)" type="number" size="small" fullWidth
                  value={kg} onChange={(e) => setKg(e.target.value)} inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  label="Precio por kilómetro ($/km)" type="number" size="small" fullWidth
                  value={km} onChange={(e) => setKm(e.target.value)} inputProps={{ min: 0, step: 0.01 }}
                />
                <TextField
                  label="Recargo por zona peligrosa (%)" type="number" size="small" fullWidth
                  value={recargo} onChange={(e) => setRecargo(e.target.value)} inputProps={{ min: 0, step: 0.01 }}
                />
                {configMsg && <Alert severity={configMsg.sev} sx={{ py: 0 }}>{configMsg.text}</Alert>}
                <Button
                  variant="contained" startIcon={savingConfig ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveConfig} disabled={savingConfig}
                >
                  Guardar tarifas
                </Button>
                {config && (
                  <Typography variant="caption" color="text.secondary">
                    Última actualización: {new Date(config.actualizadoEn).toLocaleString('es-AR')}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* G1L-86: Zonas peligrosas */}
        <Grid item xs={12} md={7}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>Zonas peligrosas</Typography>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                Hacé clic en dos puntos del mapa para delimitar el rectángulo de la zona, ponele nombre y guardá.
              </Typography>
              <Box sx={{ height: 320, borderRadius: 1, overflow: 'hidden', mb: 2 }}>
                <MapContainer center={mapCenter} zoom={mapZoom} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                  <ClickCapturer onClick={handleMapClick} />
                  {/* Zonas existentes */}
                  {zonas.map((z) => (
                    <Rectangle
                      key={z.id}
                      bounds={[[z.latMin, z.lngMin], [z.latMax, z.lngMax]]}
                      pathOptions={{ color: '#c62828', weight: 2, fillOpacity: 0.2 }}
                    />
                  ))}
                  {/* Rectángulo en construcción */}
                  {rectBounds && <Rectangle bounds={rectBounds} pathOptions={{ color: '#1976d2', dashArray: '6', weight: 2, fillOpacity: 0.15 }} />}
                </MapContainer>
              </Box>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip size="small" label={`Esquinas marcadas: ${corners.length}/2`} color={corners.length === 2 ? 'primary' : 'default'} />
                {corners.length > 0 && (
                  <Button size="small" onClick={() => setCorners([])}>Reiniciar</Button>
                )}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
                <TextField
                  label="Nombre de la zona" size="small" fullWidth
                  value={zonaNombre} onChange={(e) => setZonaNombre(e.target.value)}
                  placeholder="Ej: Zona sur - Rosario"
                />
                <Button
                  variant="contained" startIcon={<AddLocationAltIcon />}
                  onClick={handleSaveZona} disabled={savingZona || corners.length !== 2}
                >
                  Crear zona
                </Button>
              </Stack>
              {zonaMsg && <Alert severity={zonaMsg.sev} sx={{ py: 0, mb: 1 }}>{zonaMsg.text}</Alert>}

              <Divider sx={{ my: 1 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Zonas registradas ({zonas.length})</Typography>
              {zonas.length === 0 ? (
                <Typography variant="caption" color="text.secondary">No hay zonas peligrosas definidas.</Typography>
              ) : (
                <Stack spacing={0.5}>
                  {zonas.map((z) => (
                    <Stack key={z.id} direction="row" alignItems="center" spacing={1} sx={{ py: 0.5 }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>{z.nombre}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          [{z.latMin.toFixed(4)}, {z.lngMin.toFixed(4)}] → [{z.latMax.toFixed(4)}, {z.lngMax.toFixed(4)}]
                        </Typography>
                      </Box>
                      <IconButton size="small" color="error" onClick={() => handleDeleteZona(z.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}
