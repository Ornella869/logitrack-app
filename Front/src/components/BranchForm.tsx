import { useEffect, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import { branchMarkerIcon } from '../utils/mapIcons'
import axios from 'axios'

function extractApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data
    if (typeof data === 'string' && data.trim()) return data.trim()
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      for (const key of ['mensaje', 'message', 'Mensaje', 'Message', 'detail', 'title', 'error']) {
        if (typeof d[key] === 'string' && (d[key] as string).trim()) return (d[key] as string).trim()
      }
    }
  }
  return fallback
}
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Box,
  Chip,
  CircularProgress,
  Stack,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Typography,
} from '@mui/material'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import type { Branch, BranchStatus } from '../types'
import { branchService } from '../services/branchService'
import { authService } from '../services/authService'
import { postalCodeService } from '../services/postalCodeService'
import { AR_PROVINCIAS, normalizeProvincia } from '../utils/provincias'

interface BranchFormProps {
  open: boolean
  onClose: () => void
  onSaved: (branch: Branch) => void
  mode?: 'create' | 'edit'
  initialData?: Branch
  // Épica D: si se provee, el Gerente solo puede crear sucursales en su provincia.
  lockedProvince?: string
  // Sucursales existentes para detectar conflicto de provincia.
  existingBranches?: Branch[]
}

// Mueve el centro del mapa cuando cambian las coordenadas de preview.
function MapAutoCenter({ coords }: { coords: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.setView(coords, 6, { animate: false })
  }, [coords, map])
  return null
}

const nameRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'.-]{1,}$/
const cityRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
const addressRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s.,'-]*\s\d+[A-Za-z]?$/
const phoneRegex = /^[+\d][\d\s-]{3,13}$/

const EMPTY_FORM = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  province: '',
  phone: '',
  status: 'Activa' as BranchStatus,
  coveredProvinces: [] as string[],
}

function BranchForm({ open, onClose, onSaved, mode = 'create', initialData, lockedProvince, existingBranches }: BranchFormProps) {
  const isEdit = mode === 'edit'
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [postalChecking, setPostalChecking] = useState(false)
  const [previewCoords, setPreviewCoords] = useState<[number, number] | null>(null)
  const [geocodingPreview, setGeocodingPreview] = useState(false)
  const [provinceConflictWarning, setProvinceConflictWarning] = useState('')
  const [provinciasConGerente, setProvinciasConGerente] = useState<string[]>([])

  // Provincias que ya tienen su propia sucursal registrada (excluye la sucursal actual si se está editando)
  const coveredBlockedProvinces = (existingBranches ?? [])
    .filter((b) => !isEdit || b.id !== initialData?.id)
    .flatMap((b) => (b.province ? [b.province.toLowerCase()] : []))

  useEffect(() => {
    if (!open) {
      setPreviewCoords(null)
      return
    }
    setErrors({})
    if (isEdit && initialData) {
      setFormData({
        name: initialData.name,
        address: initialData.address,
        city: initialData.city,
        postalCode: initialData.postalCode,
        province: initialData.province ?? '',
        phone: initialData.phone,
        status: initialData.status,
        coveredProvinces: initialData.coveredProvinces ?? [],
      })
    } else {
      // lockedProvince puede ser una lista CSV de provincias asignadas al gerente.
      // Por compatibilidad, si viene, no forzamos a una sola provincia: dejamos vacía
      // para que el gerente elija cuál de sus provincias crear.
      setFormData({ ...EMPTY_FORM, province: '' })
    }
    // Cargar provincias ya asignadas a gerentes activos
    void (async () => {
      try {
        const provincias = await authService.getGerenteProvinciasOcupadas()
        setProvinciasConGerente(provincias.map((p) => p.toLowerCase()))
      } catch {
        setProvinciasConGerente([])
      }
    })()
  }, [open, isEdit, initialData, lockedProvince])

  const gerenteProvincias = lockedProvince
    ? (lockedProvince as string).split(',').map((p) => p.trim()).filter(Boolean)
    : []

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target
    let { value } = e.target

    if (name === 'postalCode') {
      value = value.replace(/\D/g, '').slice(0, 4)
    }
    if (name === 'phone') {
      value = value.replace(/[^\d+\s-]/g, '').slice(0, 15)
    }
    if (name === 'city') {
      value = value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '')
    }
    if (name === 'name') {
      value = value.replace(/[0-9]/g, '')
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      // Cambio de CP → limpiamos la provincia auto-rellenada para que el blur
      // re-sugiera la del CP nuevo. Si el operador eligió manualmente una
      // provincia después, su elección se respeta (ver checkPostal).
      if (name === 'postalCode' && value !== prev.postalCode && !lockedProvince) {
        next.province = ''
      }
      return next
    })
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
  }

  const geocodePreview = async (address: string, city: string, postalCode: string) => {
    if (!address.trim() || !city.trim()) return
    setGeocodingPreview(true)
    const coords = await postalCodeService.geocodeAddress(address.trim(), city.trim(), postalCode.trim() || undefined)
    setGeocodingPreview(false)
    setPreviewCoords(coords ? [coords.lat, coords.lng] : null)
  }

  const checkPostal = async () => {
    const cp = formData.postalCode.trim()
    if (!cp) return
    setPostalChecking(true)
    try {
      const result = await postalCodeService.validate(cp)
      if (!result.valid) {
        setErrors((prev) => ({ ...prev, postalCode: result.error ?? 'CP inválido' }))
        return
      }
      const normalizedProvince = normalizeProvincia(result.province)
      // Si hay provincia bloqueada (Gerente), el CP debe pertenecer a esa misma provincia.
      if (lockedProvince && normalizedProvince &&
          normalizedProvince.toLowerCase() !== lockedProvince.toLowerCase()) {
        setErrors((prev) => ({
          ...prev,
          postalCode: `Este CP pertenece a ${normalizedProvince}, no a ${lockedProvince}`,
        }))
        return
      }
      setErrors((prev) => {
        const next = { ...prev }
        delete next.postalCode
        return next
      })
      // Pre-rellena provincia solo si está vacía. Si el operador la eligió
      // manualmente (CPs ambiguos como 9420), respetamos su elección.
      const resolvedCity = result.city ?? formData.city
      setFormData((prev) => ({
        ...prev,
        city: result.city ?? prev.city,
        province: prev.province || normalizedProvince || '',
      }))
      if (result.city) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next.city
          return next
        })
      }
      void geocodePreview(formData.address, resolvedCity, cp)
    } finally {
      setPostalChecking(false)
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Requerido'
    } else if (!nameRegex.test(formData.name.trim())) {
      newErrors.name = 'Mínimo 2 caracteres'
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Requerido'
    } else if (!addressRegex.test(formData.address.trim())) {
      newErrors.address = 'Formato esperado: "Calle Altura" (ej. Rosa Castillo 2487)'
    }

    if (!formData.city.trim()) {
      newErrors.city = 'Requerido'
    } else if (!cityRegex.test(formData.city.trim())) {
      newErrors.city = 'Solo letras'
    }

    if (!formData.postalCode.trim()) {
      newErrors.postalCode = 'Requerido'
    } else if (!postalCodeService.isValidFormat(formData.postalCode)) {
      newErrors.postalCode = 'Debe tener 4 dígitos'
    }

    if (!formData.province.trim()) {
      newErrors.province = 'Requerido'
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Requerido'
    } else if (!phoneRegex.test(formData.phone.trim())) {
      newErrors.phone = 'Teléfono inválido'
    }

    if (!newErrors.postalCode) {
      const cpResult = await postalCodeService.validate(formData.postalCode)
      if (!cpResult.valid) {
        newErrors.postalCode = cpResult.error ?? 'CP inválido'
      } else {
        if (lockedProvince && cpResult.province) {
          const normalizedCpProvince = normalizeProvincia(cpResult.province)
          if (normalizedCpProvince && normalizedCpProvince.toLowerCase() !== lockedProvince.toLowerCase()) {
            newErrors.postalCode = `Este CP pertenece a ${normalizedCpProvince}, no a ${lockedProvince}`
          }
        }
        // Validar que la calle exista para el CP dado.
        if (!newErrors.address) {
          const addrResult = await postalCodeService.validateStreetAddress(
            formData.address.trim(),
            formData.postalCode.trim(),
          )
          if (!addrResult.valid) {
            newErrors.address = addrResult.error ?? 'No se pudo verificar la dirección'
          }
        }
      }
    }

    if (!isEdit && !newErrors.name) {
      const exists = await branchService.branchExists(formData.name.trim())
      if (exists) newErrors.name = 'Ya existe una sucursal con este nombre'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!(await validateForm())) return

    setLoading(true)
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        postalCode: formData.postalCode.trim(),
        province: formData.province.trim() || undefined,
        phone: formData.phone.trim(),
        status: formData.status,
        coveredProvinces: formData.coveredProvinces,
      }
      const saved = isEdit && initialData
        ? await branchService.updateBranch(initialData.id, payload)
        : await branchService.createBranch(payload)
      onSaved(saved)
      setFormData(EMPTY_FORM)
      onClose()
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        _generic: extractApiError(
          err,
          isEdit
            ? 'No se pudo actualizar la sucursal. Verificá los datos e intentá de nuevo.'
            : 'No podés crear sucursales en una provincia distinta a la tuya. Solo se permiten sucursales dentro de tu provincia asignada.',
        ),
      }))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setFormData(EMPTY_FORM)
    setErrors({})
    setProvinceConflictWarning('')
    onClose()
  }

  const hasErrors = Object.values(errors).some((v) => !!v)

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar sucursal' : 'Registrar nueva sucursal'}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Stack spacing={2} padding={1}>
          {(hasErrors || errors._generic) && (
            <Alert severity="error">
              {errors._generic ?? 'Revisá los campos marcados en rojo.'}
            </Alert>
          )}

          <TextField
            label="Nombre de la sucursal"
            name="name"
            value={formData.name}
            onChange={handleChange}
            error={!!errors.name}
            helperText={errors.name}
            required
            fullWidth
            placeholder="Ej: Sucursal Centro"
            disabled={loading}
          />

          <TextField
            label="Dirección"
            name="address"
            value={formData.address}
            onChange={handleChange}
            onBlur={() => {
              if (formData.address.trim() && formData.city.trim()) {
                void geocodePreview(formData.address, formData.city, formData.postalCode)
              }
            }}
            error={!!errors.address}
            helperText={errors.address ?? 'Formato: "Calle Altura" (ej. Av. Corrientes 1000)'}
            required
            fullWidth
            disabled={loading}
          />

          <TextField
            label="Código Postal"
            name="postalCode"
            value={formData.postalCode}
            onChange={handleChange}
            onBlur={checkPostal}
            error={!!errors.postalCode}
            helperText={errors.postalCode}
            required
            inputProps={{ inputMode: 'numeric', maxLength: 4 }}
            InputProps={{
              endAdornment: postalChecking ? (
                <InputAdornment position="end">
                  <CircularProgress size={14} />
                </InputAdornment>
              ) : null,
            }}
            fullWidth
            placeholder="Ej: 1043"
            disabled={loading}
          />

          <TextField
            label="Ciudad"
            name="city"
            value={formData.city}
            onChange={handleChange}
            error={!!errors.city}
            helperText={errors.city ?? 'Se autocompleta cuando ingresás un CP válido'}
            required
            fullWidth
            disabled={loading}
          />

          <FormControl fullWidth required error={!!errors.province} disabled={loading}>
            <InputLabel>Provincia</InputLabel>
            <Select
              value={formData.province}
              label="Provincia"
              onChange={(e) => {
                const selected = e.target.value
                setFormData((prev) => ({
                  ...prev,
                  province: selected,
                  coveredProvinces: prev.coveredProvinces.filter((p) => p !== selected),
                }))
                if (errors.province) setErrors((prev) => ({ ...prev, province: '' }))
                // Advertencia si ya existe una sucursal en esa provincia
                if (existingBranches && selected && !isEdit) {
                  const conflict = existingBranches.some(
                    (b) => b.province?.toLowerCase() === selected.toLowerCase()
                  )
                  setProvinceConflictWarning(
                    conflict
                      ? `Ya existe una sucursal en ${selected}. Registrar otra podría superponerse con la gestión de otro gerente.`
                      : ''
                  )
                }
              }}
            >
              {(gerenteProvincias.length > 0 ? gerenteProvincias : AR_PROVINCIAS).map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {errors.province ?? (gerenteProvincias.length > 0
                ? `Como Gerente solo podés crear sucursales en tus provincias asignadas (${gerenteProvincias.join(', ')}).`
                : 'Se pre-selecciona al validar el CP — verificá que sea correcta para CPs ambiguos.')}
            </FormHelperText>
          </FormControl>
          {provinceConflictWarning && (
            <Alert severity="warning" sx={{ mt: -1 }}>
              {provinceConflictWarning}
            </Alert>
          )}

            <FormControl fullWidth disabled={loading}>
              <FormHelperText sx={{ mb: 1 }}>
                <strong>Nota:</strong> Solo podés asignar cobertura de provincias que no tengan gerente activo asignado ni sucursal propia.
              </FormHelperText>
              <InputLabel>Cobertura adicional</InputLabel>
              <Select
                multiple
                value={formData.coveredProvinces}
                label="Cobertura adicional"
                onChange={(e) => {
                  const value = e.target.value
                  setFormData((prev) => ({
                    ...prev,
                    coveredProvinces: (typeof value === 'string' ? value.split(',') : value)
                      .filter((p) => p !== prev.province),
                  }))
                }}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
              >
                {AR_PROVINCIAS.filter((p) => p !== formData.province).map((p) => {
                  const lower = p.toLowerCase()
                  const isBlockedByBranch = coveredBlockedProvinces.includes(lower)
                  const isBlockedByGerente = provinciasConGerente.includes(lower)
                  const isAlreadySelected = formData.coveredProvinces.map((s) => s.toLowerCase()).includes(lower)
                  const disabled = (isBlockedByBranch || isBlockedByGerente) && !isAlreadySelected
                  return (
                    <MenuItem key={p} value={p} disabled={disabled}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 1 }}>
                        <span>{p}</span>
                        {isBlockedByGerente && !isAlreadySelected && (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                            ya tiene gerente
                          </Typography>
                        )}
                        {isBlockedByBranch && !isAlreadySelected && !isBlockedByGerente && (
                          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                            ya tiene sucursal
                          </Typography>
                        )}
                      </Box>
                    </MenuItem>
                  )
                })}
              </Select>
              <FormHelperText>
                {formData.coveredProvinces.length > 0
                  ? 'Estas coberturas se guardan solo si la provincia no tiene gerente asignado.'
                  : 'La provincia propia siempre queda cubierta.'}
              </FormHelperText>
            </FormControl>

          <TextField
            label="Teléfono"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            error={!!errors.phone}
            helperText={errors.phone}
            required
            fullWidth
            placeholder="Ej: 11 4567-8901"
            disabled={loading}
            inputProps={{ maxLength: 15 }}
          />

          {/* Vista previa de ubicación */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.75 }}>
              <LocationOnIcon fontSize="small" color="primary" />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Ubicación en el mapa
              </Typography>
              {geocodingPreview && <CircularProgress size={12} />}
            </Stack>
            <Box
              sx={{
                height: 200,
                borderRadius: 1,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <MapContainer
                center={[-38, -65]}
                zoom={4}
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
                attributionControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapAutoCenter coords={previewCoords} />
                {previewCoords && (
                  <Marker position={previewCoords} icon={branchMarkerIcon} />
                )}
              </MapContainer>
            </Box>
            {!previewCoords && !geocodingPreview && (
              <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                Completá la dirección y el código postal para ver la ubicación.
              </Typography>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || postalChecking}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Registrar sucursal'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default BranchForm
