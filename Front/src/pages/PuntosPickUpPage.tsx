import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet'
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
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  InputAdornment,
  Tabs,
  Tab,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import PlaceIcon from '@mui/icons-material/Place'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import { pickupService, type PuntoPickUp, type PuntoPickUpPayload } from '../services/pickupService'
import { postalCodeService } from '../services/postalCodeService'
import { AR_PROVINCIAS, normalizeProvincia } from '../utils/provincias'
import { branchMarkerIcon } from '../utils/mapIcons'
import type { User } from '../types'

const emptyForm: PuntoPickUpPayload = {
  nombre: '',
  direccion: '',
  localidad: '',
  codigoPostal: '',
  provincia: '',
  horarios: 'Lunes a Viernes de 09:00 a 18:00',
  telefono: '',
}

const nameRegex = /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s'-]{1,}$/
const cityRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
const addressRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s.,'-]*\s\d+[A-Za-z]?$/
const phoneRegex = /^[+\d][\d\s-]{6,19}$/

function MapAutoCenter({ coords }: { coords: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.setView(coords, 15, { animate: false })
  }, [coords, map])
  return null
}

export default function PuntosPickUpPage() {
  const user = useOutletContext<User>()
  const puedeEditar = user.role === 'gerente' || user.role === 'administrador'
  const [items, setItems] = useState<PuntoPickUp[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<PuntoPickUp | null>(null)
  const [form, setForm] = useState<PuntoPickUpPayload>(emptyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [postalChecking, setPostalChecking] = useState(false)
  const [previewCoords, setPreviewCoords] = useState<[number, number] | null>(null)
  const [geocodingPreview, setGeocodingPreview] = useState(false)
  const [previewMsg, setPreviewMsg] = useState('')

  // Builder para horarios
  const [scheduleMode, setScheduleMode] = useState<'builder' | 'manual'>('builder')
  const [dias, setDias] = useState('Lunes a Viernes')
  const [apertura, setApertura] = useState('09:00')
  const [cierre, setCierre] = useState('18:00')

  useEffect(() => {
    if (scheduleMode === 'builder') {
      setForm((prev) => ({ ...prev, horarios: `${dias} de ${apertura} a ${cierre}` }))
      if (formErrors.horarios) setFormErrors((prev) => ({ ...prev, horarios: '' }))
    }
  }, [dias, apertura, cierre, scheduleMode])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setItems(await pickupService.getAll())
    } catch {
      setError('No se pudieron cargar los puntos PickUp.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, provincia: user.role === 'gerente' ? user.provincia ?? '' : '' })
    setScheduleMode('builder')
    setDias('Lunes a Viernes')
    setApertura('09:00')
    setCierre('18:00')
    setFormErrors({})
    setPreviewCoords(null)
    setPreviewMsg('')
    setMsg('')
    setOpen(true)
  }

  const openEdit = (item: PuntoPickUp) => {
    setEditing(item)
    setForm({
      nombre: item.nombre,
      direccion: item.direccion,
      localidad: item.localidad,
      codigoPostal: item.codigoPostal,
      provincia: item.provincia,
      horarios: item.horarios,
      telefono: item.telefono ?? '',
    })
    setScheduleMode('manual')
    setFormErrors({})
    setPreviewCoords(null)
    setPreviewMsg('')
    setMsg('')
    setOpen(true)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target
    let { value } = e.target

    if (name === 'localidad') {
      value = value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '')
    }
    if (name === 'codigoPostal') {
      value = value.replace(/\D/g, '').slice(0, 4)
    }
    if (name === 'telefono') {
      value = value.replace(/[^\d+\s-]/g, '')
    }

    setForm((prev) => {
      const next = { ...prev, [name]: value }
      if (name === 'codigoPostal' && value !== prev.codigoPostal) {
        next.provincia = ''
      }
      return next
    })

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }))
    }
    if (['direccion', 'localidad', 'codigoPostal', 'provincia'].includes(name)) {
      setPreviewCoords(null)
      setPreviewMsg('')
    }
  }

  const geocodePreview = async (localidadOverride?: string, cpOverride?: string) => {
    const localidad = (localidadOverride ?? form.localidad).trim()
    const cp = (cpOverride ?? form.codigoPostal).trim()
    if (!form.direccion.trim() || !localidad) {
      setPreviewMsg('Completa direccion y localidad para ver el mapa.')
      return
    }
    const provincia = form.provincia.trim()
    if (!provincia) {
      setPreviewMsg('Completa provincia para ver el mapa.')
      return
    }
    setGeocodingPreview(true)
    setPreviewMsg('')
    try {
      const coords = await pickupService.geocodificar({
        ...form,
        direccion: form.direccion.trim(),
        localidad,
        codigoPostal: cp,
        provincia,
      })
      setPreviewCoords([coords.latitud, coords.longitud])
      setPreviewMsg(coords.advertencia ?? '')
    } catch (e: any) {
      setPreviewCoords(null)
      setPreviewMsg(e.response?.data ?? 'No se pudo ubicar en el mapa. Revisa calle, localidad, CP y provincia.')
    } finally {
      setGeocodingPreview(false)
    }
  }

  const checkPostalCode = async () => {
    const cp = form.codigoPostal.trim()
    if (!cp) return

    setPostalChecking(true)
    try {
      const result = await postalCodeService.validate(cp)
      if (!result.valid) {
        setFormErrors((prev) => ({ ...prev, codigoPostal: result.error ?? 'CP inválido' }))
        return
      }
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next.codigoPostal
        return next
      })
      
      const normalizedProvince = normalizeProvincia(result.province)
      setForm((prev) => ({
        ...prev,
        localidad: result.city ?? prev.localidad,
        provincia: prev.provincia || normalizedProvince || '',
      }))
      if (result.city) {
        setFormErrors((prev) => {
          const next = { ...prev }
          delete next.localidad
          return next
        })
      }
      void geocodePreview(result.city ?? form.localidad, cp)
    } finally {
      setPostalChecking(false)
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    if (!form.nombre.trim()) newErrors.nombre = 'Requerido'
    else if (!nameRegex.test(form.nombre.trim())) newErrors.nombre = 'Nombre inválido'

    if (!form.direccion.trim()) newErrors.direccion = 'Requerido'
    else if (!addressRegex.test(form.direccion.trim())) newErrors.direccion = 'Formato esperado: "Calle Altura" (ej. Rosa Castillo 2487)'

    if (!form.localidad.trim()) newErrors.localidad = 'Requerido'
    else if (!cityRegex.test(form.localidad.trim())) newErrors.localidad = 'Solo letras'

    if (!form.codigoPostal.trim()) newErrors.codigoPostal = 'Requerido'
    else if (!postalCodeService.isValidFormat(form.codigoPostal)) newErrors.codigoPostal = 'Debe tener 4 dígitos'

    if (!form.provincia.trim()) newErrors.provincia = 'Requerido'

    if ((form.telefono ?? '').trim() && !phoneRegex.test((form.telefono ?? '').trim())) {
      newErrors.telefono = 'Teléfono inválido'
    }

    if (!form.horarios.trim()) newErrors.horarios = 'Requerido'

    if (!newErrors.codigoPostal) {
      const cpResult = await postalCodeService.validate(form.codigoPostal)
      if (!cpResult.valid) {
        newErrors.codigoPostal = cpResult.error ?? 'CP inválido'
      } else {
        const provinciaCp = normalizeProvincia(cpResult.province)
        const provinciaForm = normalizeProvincia(form.provincia)
        const provinciaValidacion = form.provincia.trim() || provinciaCp || ''
        if (provinciaForm && provinciaCp && provinciaCp !== provinciaForm) {
          newErrors.codigoPostal = `El CP pertenece a ${provinciaCp}, no a ${form.provincia}.`
        }

        if (provinciaCp && !form.provincia) {
          setForm((prev) => ({ ...prev, provincia: provinciaCp }))
        }
        if (!newErrors.direccion && !newErrors.codigoPostal) {
          const addrResult = await postalCodeService.validateStreetAddress(
            form.direccion.trim(),
            form.codigoPostal.trim(),
            provinciaValidacion,
          )
          if (!addrResult.valid && addrResult.error?.includes('pertenece a')) {
            newErrors.direccion = addrResult.error ?? 'No se pudo verificar la dirección'
          }
        }
      }
    }

    setFormErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const save = async () => {
    setMsg('')
    if (!(await validateForm())) {
      setMsg('Revisá los campos marcados en rojo.')
      return
    }
    
    setSaving(true)
    try {
      if (editing) await pickupService.update(editing.id, form)
      else await pickupService.create(form)
      setOpen(false)
      await load()
    } catch (e: any) {
      setMsg(e.response?.data ?? 'No se pudo guardar el punto PickUp.')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (item: PuntoPickUp) => {
    setError('')
    try {
      await pickupService.setActivo(item.id, !item.activo)
      await load()
    } catch {
      setError('No se pudo cambiar el estado del punto PickUp.')
    }
  }

  if (user.role !== 'gerente' && user.role !== 'supervisor' && user.role !== 'administrador') {
    return <Alert severity="warning">No tenés permisos para ver puntos PickUp.</Alert>
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 3 }} spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <PlaceIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Puntos PickUp
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Puntos alternativos de retiro dentro del alcance territorial.
          </Typography>
        </Box>
        {puedeEditar && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Nuevo PickUp
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : items.length === 0 ? (
        <Alert severity="info">Todavía no hay puntos PickUp para tu alcance.</Alert>
      ) : (
        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid item xs={12} md={6} lg={4} key={item.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                    <Box>
                      <Typography variant="h6">{item.nombre}</Typography>
                      <Typography variant="body2" color="text.secondary">{item.direccion}</Typography>
                    </Box>
                    <Chip size="small" label={item.activo ? 'Activo' : 'Inactivo'} color={item.activo ? 'success' : 'default'} />
                  </Stack>
                  <Stack spacing={0.5} sx={{ mt: 2 }}>
                    <Typography variant="body2">{item.localidad} · CP {item.codigoPostal}</Typography>
                    <Typography variant="body2">{item.provincia}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.horarios}</Typography>
                    {item.telefono && <Typography variant="body2" color="text.secondary">{item.telefono}</Typography>}
                  </Stack>
                  {puedeEditar && (
                    <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                      <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(item)}>Editar</Button>
                      <Button size="small" color={item.activo ? 'warning' : 'success'} onClick={() => toggleActivo(item)}>
                        {item.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editing ? 'Editar PickUp' : 'Nuevo PickUp'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Nombre del local *" name="nombre" value={form.nombre} onChange={handleChange} error={!!formErrors.nombre} helperText={formErrors.nombre} fullWidth />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}>
                <TextField label="Dirección *" name="direccion" value={form.direccion} onChange={handleChange} error={!!formErrors.direccion} helperText={formErrors.direccion || 'Formato: "Calle Altura"'} fullWidth />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="CP *"
                  name="codigoPostal"
                  value={form.codigoPostal}
                  onChange={handleChange}
                  onBlur={checkPostalCode}
                  error={!!formErrors.codigoPostal}
                  helperText={formErrors.codigoPostal}
                  inputProps={{ inputMode: 'numeric', maxLength: 4 }}
                  InputProps={{
                    endAdornment: postalChecking ? (
                      <InputAdornment position="end">
                        <CircularProgress size={14} />
                      </InputAdornment>
                    ) : null,
                  }}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Localidad *" name="localidad" value={form.localidad} onChange={handleChange} error={!!formErrors.localidad} helperText={formErrors.localidad} fullWidth />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Provincia *"
                  name="provincia"
                  value={form.provincia}
                  onChange={(e) => {
                    setForm({ ...form, provincia: e.target.value })
                    setPreviewCoords(null)
                    setPreviewMsg('')
                    if (formErrors.provincia) setFormErrors((prev) => ({ ...prev, provincia: '' }))
                  }}
                  error={!!formErrors.provincia}
                  helperText={formErrors.provincia}
                  fullWidth
                  disabled={user.role === 'gerente'}
                >
                  {AR_PROVINCIAS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="subtitle2">Ubicación en el mapa</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Usalo para confirmar visualmente que el PickUp cae en la provincia correcta.
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  startIcon={geocodingPreview ? <CircularProgress size={16} /> : <LocationOnIcon />}
                  onClick={() => void geocodePreview()}
                  disabled={geocodingPreview}
                >
                  Ver en mapa
                </Button>
              </Stack>
              {previewMsg && <Alert severity="warning" sx={{ mb: 1 }}>{previewMsg}</Alert>}
              <Box sx={{ height: 260, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}>
                <MapContainer
                  center={previewCoords ?? [-28.4696, -65.7795]}
                  zoom={previewCoords ? 15 : 5}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapAutoCenter coords={previewCoords} />
                  {previewCoords && <Marker position={previewCoords} icon={branchMarkerIcon} />}
                </MapContainer>
              </Box>
            </Box>

            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Horarios de atención</Typography>
              <Tabs value={scheduleMode} onChange={(_, v) => setScheduleMode(v)} sx={{ mb: 2, minHeight: 32 }}>
                <Tab label="Constructor" value="builder" sx={{ minHeight: 32, py: 0 }} />
                <Tab label="Manual" value="manual" sx={{ minHeight: 32, py: 0 }} />
              </Tabs>

              {scheduleMode === 'builder' ? (
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField select label="Días" value={dias} onChange={(e) => setDias(e.target.value)} fullWidth size="small">
                      <MenuItem value="Lunes a Viernes">Lunes a Viernes</MenuItem>
                      <MenuItem value="Lunes a Sábados">Lunes a Sábados</MenuItem>
                      <MenuItem value="Todos los días">Todos los días</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField select label="Desde" value={apertura} onChange={(e) => setApertura(e.target.value)} fullWidth size="small">
                      {['08:00', '09:00', '10:00', '11:00'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField select label="Hasta" value={cierre} onChange={(e) => setCierre(e.target.value)} fullWidth size="small">
                      {['17:00', '18:00', '19:00', '20:00', '21:00'].map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Resultado: <strong>{form.horarios}</strong>
                    </Typography>
                  </Grid>
                </Grid>
              ) : (
                <TextField
                  label="Escribí el horario"
                  name="horarios"
                  value={form.horarios}
                  onChange={handleChange}
                  error={!!formErrors.horarios}
                  helperText={formErrors.horarios || 'Ej: Lunes a Sábados de 09:00 a 18:00 y Domingos de 10:00 a 14:00'}
                  fullWidth
                  size="small"
                />
              )}
            </Box>

            <TextField label="Teléfono de contacto" name="telefono" value={form.telefono ?? ''} onChange={handleChange} error={!!formErrors.telefono} helperText={formErrors.telefono} fullWidth />
            {msg && <Alert severity="error">{msg}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={save} disabled={saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
