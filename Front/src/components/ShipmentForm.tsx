import { useState, useEffect } from 'react'
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
  Box,
  Grid,
  CircularProgress,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Alert,
  InputAdornment,
} from '@mui/material'
import type { Shipment, TipoEnvio, TipoPaquete, Branch } from '../types'
import { formatArgentinaDateInput } from '../utils/argentinaDate'
import { postalCodeService } from '../services/postalCodeService'
import { branchService } from '../services/branchService'
import { tarifaService, type Cotizacion } from '../services/tarifaService'
import { pickupService, type PuntoPickUp } from '../services/pickupService'
import { AR_PROVINCIAS, normalizeProvincia } from '../utils/provincias'

interface ShipmentFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (shipment: Omit<Shipment, 'id' | 'lastUpdate' | 'trackingId'>) => Promise<void>
  mode?: 'create' | 'edit'
  initialData?: Shipment
}

// G1L-54: capacidad por repartidor. Un paquete que la supere no podría calendarizarse.
const MAX_WEIGHT_KG = 500

// Capitaliza la primera letra de cada palabra que empieza con letra (deja números sin tocar).
// "bongiovanni 2731" → "Bongiovanni 2731"   "av. corrientes 1234" → "Av. Corrientes 1234"
function capitalizeAddress(value: string): string {
  return value
    .split(' ')
    .map((word) =>
      word && /^[a-záéíóúüñ]/i.test(word)
        ? word[0].toUpperCase() + word.slice(1)
        : word,
    )
    .join(' ')
}

// Solo letras + espacios + tildes/diéresis + apóstrofe/guion. Sin números.
const nameRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{1,}$/
const cityRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
// Dirección formato "Calle Altura": empieza con letra, termina con número (opcional sufijo letra ej "1234B").
// Ejemplos válidos: "Rosa Castillo 2487", "Av. 9 de Julio 1500", "Av. Corrientes 1234A".
// Inválidos: "2487 Rosa Castillo", "1234", "asdfgh".
const addressRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s.,'-]*\s\d+[A-Za-z]?$/
const phoneRegex = /^[+\d][\d\s-]{6,19}$/
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ShipmentForm({ open, onClose, onSubmit, mode = 'create', initialData }: ShipmentFormProps) {
  const isEdit = mode === 'edit'
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [postalChecking, setPostalChecking] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [pickups, setPickups] = useState<PuntoPickUp[]>([])
  const [selectedPickUpId, setSelectedPickUpId] = useState('')
  const [deliveryMode, setDeliveryMode] = useState<'domicilio' | 'pickup'>('domicilio')
  // G1L-88: cotización detallada (preview antes de confirmar).
  const [cotizacion, setCotizacion] = useState<Cotizacion | null>(null)
  const [cotizando, setCotizando] = useState(false)
  const [formData, setFormData] = useState({
    receiverName: '',
    receiverAddress: '',
    receiverCity: '',
    receiverPostal: '',
    receiverProvince: '', // se autocompleta cuando el CP valida (no editable por UI)
    receiverPhone: '',
    receiverEmail: '',
    weight: '',
    description: '',
    tipoEnvio: 'Comun' as TipoEnvio,
    tipoPaquete: 'Comun' as TipoPaquete,
  })

  useEffect(() => {
    if (!open) return
    setErrors({})
    setCotizacion(null)
    loadBranches()
    loadPickUps()
    if (isEdit && initialData) {
      setDeliveryMode(initialData.puntoPickUpId ? 'pickup' : 'domicilio')
      setSelectedPickUpId(initialData.puntoPickUpId ?? '')
      setFormData({
        receiverName: initialData.receiver.name,
        receiverAddress: initialData.receiver.address,
        receiverCity: initialData.receiver.city,
        receiverPostal: initialData.receiver.postalCode,
        receiverProvince: initialData.receiver.province ?? '',
        receiverPhone: initialData.receiver.phone ?? '',
        receiverEmail: initialData.receiver.email ?? '',
        weight: String(initialData.weight),
        description: initialData.description,
        tipoEnvio: initialData.tipoEnvio ?? 'Comun',
        tipoPaquete: initialData.tipoPaquete ?? 'Comun',
      })
    } else {
      // Alta nueva: limpiamos los campos para no arrastrar datos de un intento previo.
      setDeliveryMode('domicilio')
      setSelectedPickUpId('')
      setFormData({
        receiverName: '',
        receiverAddress: '',
        receiverCity: '',
        receiverPostal: '',
        receiverProvince: '',
        receiverPhone: '',
        receiverEmail: '',
        weight: '',
        description: '',
        tipoEnvio: 'Comun',
        tipoPaquete: 'Comun',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const loadBranches = async () => {
    setLoadingBranches(true)
    try {
      const all = await branchService.getAllBranches()
      const active = all.filter((b) => b.status === 'Activa')
      setBranches(active)
      if (active.length > 0) setSelectedBranchId((prev) => prev || active[0].id)
    } catch (error) {
      console.error('Error cargando sucursales:', error)
      setBranches([])
    } finally {
      setLoadingBranches(false)
    }
  }

  const loadPickUps = async () => {
    try {
      setPickups(await pickupService.getAll())
    } catch (error) {
      console.error('Error cargando puntos PickUp:', error)
      setPickups([])
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target
    let { value } = e.target

    if (name === 'receiverCity') {
      value = value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '')
    }

    if (name === 'receiverPostal') {
      value = value.replace(/\D/g, '').slice(0, 4)
    }

    if (name === 'receiverPhone') {
      value = value.replace(/[^\d+\s-]/g, '')
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      // Si el operador cambia el CP, limpiamos la provincia auto-rellenada
      // para que el próximo blur re-sugiera una. Si después él/ella elige una
      // provincia manualmente, esa elección NO se vuelve a pisar (ver checkReceiverPostal).
      if (name === 'receiverPostal' && value !== prev.receiverPostal) {
        next.receiverProvince = ''
      }
      return next
    })
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
    // G1L-88: si cambia algo que afecta el precio, invalidamos la cotización previa.
    if (['receiverAddress', 'receiverCity', 'receiverPostal', 'weight'].includes(name)) {
      setCotizacion(null)
    }
  }

  const checkReceiverPostal = async () => {
    const cp = formData.receiverPostal.trim()
    if (!cp) return

    setPostalChecking(true)
    try {
      const result = await postalCodeService.validate(cp)
      if (!result.valid) {
        setErrors((prev) => ({ ...prev, receiverPostal: result.error ?? 'CP inválido' }))
        return
      }
      setErrors((prev) => {
        const next = { ...prev }
        delete next.receiverPostal
        return next
      })
      // Pre-rellenamos ciudad y provincia con lo que sugiere la API. La provincia
      // SOLO la sobreescribimos si el dropdown está vacío — así, si el operador
      // ya eligió una manualmente (caso CPs ambiguos como 9420 → Tierra del Fuego),
      // su elección manda. Cuando el CP cambia (handleChange) se limpia la
      // provincia, así un nuevo CP vuelve a recibir una sugerencia fresca.
      const normalizedProvince = normalizeProvincia(result.province)
      setFormData((prev) => ({
        ...prev,
        receiverCity: result.city ?? prev.receiverCity,
        receiverProvince: prev.receiverProvince || normalizedProvince || '',
      }))
      if (result.city) {
        setErrors((prev) => {
          const next = { ...prev }
          delete next.receiverCity
          return next
        })
      }
    } finally {
      setPostalChecking(false)
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}
    const isPickUp = deliveryMode === 'pickup'
    const selectedPickUp = pickups.find((p) => p.id === selectedPickUpId)

    // Destinatario — G1L-10
    if (!formData.receiverName.trim()) {
      newErrors.receiverName = 'Requerido'
    } else if (!nameRegex.test(formData.receiverName.trim())) {
      newErrors.receiverName = 'Solo letras (mín. 2 caracteres)'
    }

    if (isPickUp) {
      if (!selectedPickUp) {
        newErrors.pickup = 'Elegí un punto PickUp'
      }
      if (formData.receiverPhone.trim() && !phoneRegex.test(formData.receiverPhone.trim())) {
        newErrors.receiverPhone = 'Teléfono inválido'
      }
      if (!formData.receiverEmail.trim()) {
        newErrors.receiverEmail = 'Requerido'
      } else if (!emailRegex.test(formData.receiverEmail.trim())) {
        newErrors.receiverEmail = 'Email invalido'
      }
      const weightNum = Number(formData.weight)
      if (!formData.weight || isNaN(weightNum) || weightNum <= 0) {
        newErrors.weight = 'El peso debe ser mayor a 0'
      } else if (weightNum > MAX_WEIGHT_KG) {
        newErrors.weight = `El peso no puede superar ${MAX_WEIGHT_KG} kg`
      }

      setErrors(newErrors)
      return Object.keys(newErrors).length === 0
    }

    if (!formData.receiverAddress.trim()) {
      newErrors.receiverAddress = 'Requerido'
    } else if (!addressRegex.test(formData.receiverAddress.trim())) {
      newErrors.receiverAddress = 'Formato esperado: "Calle Altura" (ej. Rosa Castillo 2487)'
    }

    if (!formData.receiverCity.trim()) {
      newErrors.receiverCity = 'Requerido'
    } else if (!cityRegex.test(formData.receiverCity.trim())) {
      newErrors.receiverCity = 'Solo letras'
    }

    if (!formData.receiverPostal.trim()) {
      newErrors.receiverPostal = 'Requerido'
    } else if (!postalCodeService.isValidFormat(formData.receiverPostal)) {
      newErrors.receiverPostal = 'Debe tener 4 dígitos'
    }

    if (!formData.receiverProvince.trim()) {
      newErrors.receiverProvince = 'Requerido'
    }

    if (formData.receiverPhone.trim() && !phoneRegex.test(formData.receiverPhone.trim())) {
      newErrors.receiverPhone = 'Teléfono inválido'
    }

    if (!formData.receiverEmail.trim()) {
      newErrors.receiverEmail = 'Requerido'
    } else if (!emailRegex.test(formData.receiverEmail.trim())) {
      newErrors.receiverEmail = 'Email invalido'
    }

    // Peso — G1L-10 (>0) + G1L-54 (capacidad máxima por repartidor)
    const weightNum = Number(formData.weight)
    if (!formData.weight || isNaN(weightNum) || weightNum <= 0) {
      newErrors.weight = 'El peso debe ser mayor a 0'
    } else if (weightNum > MAX_WEIGHT_KG) {
      newErrors.weight = `El peso no puede superar ${MAX_WEIGHT_KG} kg`
    }

    if (!newErrors.receiverPostal) {
      const cpResult = await postalCodeService.validate(formData.receiverPostal)
      if (!cpResult.valid) {
        newErrors.receiverPostal = cpResult.error ?? 'CP inválido'
      } else {
        let provinceToUse = formData.receiverProvince.trim()
        if (cpResult.province && !provinceToUse) {
          provinceToUse = cpResult.province as string
          setFormData((prev) => ({ ...prev, receiverProvince: provinceToUse }))
        }
        // Validar que la calle exista en Nominatim para el CP dado y la Provincia elegida.
        if (!newErrors.receiverAddress) {
          const addrResult = await postalCodeService.validateStreetAddress(
            formData.receiverAddress.trim(),
            formData.receiverPostal.trim(),
            provinceToUse,
          )
          if (!addrResult.valid) {
            newErrors.receiverAddress = addrResult.error ?? 'No se pudo verificar la dirección'
          }
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // G1L-88: pide la cotización al backend (geocodifica destino y evalúa zona peligrosa).
  const handleCotizar = async () => {
    const peso = Number(formData.weight)
    const selectedPickUp = pickups.find((p) => p.id === selectedPickUpId)
    const address = deliveryMode === 'pickup' ? selectedPickUp?.direccion : formData.receiverAddress
    const city = deliveryMode === 'pickup' ? selectedPickUp?.localidad : formData.receiverCity
    const postal = deliveryMode === 'pickup' ? selectedPickUp?.codigoPostal : formData.receiverPostal
    const province = deliveryMode === 'pickup' ? selectedPickUp?.provincia : formData.receiverProvince
    if (!address || !city || !postal || isNaN(peso) || peso <= 0) {
      return
    }
    setCotizando(true)
    const result = await tarifaService.cotizar(peso, address, city, postal, province || undefined)
    if (result && deliveryMode === 'pickup') {
      result.total = Math.round(result.total * 0.75 * 100) / 100
    }
    setCotizando(false)
    setCotizacion(result)
  }

  const handleSubmit = async () => {
    setSubmitError('')
    if (!(await validateForm())) return
    const origin = branches.find((b) => b.id === selectedBranchId)
    if (!origin) return
    const selectedPickUp = pickups.find((p) => p.id === selectedPickUpId)
    if (deliveryMode === 'pickup' && !selectedPickUp) return
    const destino = deliveryMode === 'pickup' && selectedPickUp
      ? {
          address: selectedPickUp.direccion,
          city: selectedPickUp.localidad,
          postalCode: selectedPickUp.codigoPostal,
          province: selectedPickUp.provincia,
          puntoPickUpId: selectedPickUp.id,
        }
      : {
          address: formData.receiverAddress.trim(),
          city: formData.receiverCity.trim(),
          postalCode: formData.receiverPostal.trim(),
          province: formData.receiverProvince.trim() || undefined,
          puntoPickUpId: null,
        }

    setLoading(true)
    try {
      await onSubmit({
        sender: {
          name: origin.name,
          address: origin.address,
          city: origin.city,
          postalCode: origin.postalCode,
          phone: origin.phone || undefined,
        },
        receiver: {
          name: formData.receiverName.trim(),
          address: destino.address,
          city: destino.city,
          postalCode: destino.postalCode,
          province: destino.province,
          phone: formData.receiverPhone.trim() || undefined,
          email: formData.receiverEmail.trim() || undefined,
        },
        origin: origin.city,
        destination: destino.city,
        weight: Number(formData.weight),
        description: formData.description.trim(),
        estimatedDelivery: '',
        status: 'Pendiente de calendarización',
        tipoEnvio: formData.tipoEnvio,
        tipoPaquete: formData.tipoPaquete,
        puntoPickUpId: destino.puntoPickUpId,
        createdDate: formatArgentinaDateInput(),
      })

      setFormData({
        receiverName: '',
        receiverAddress: '',
        receiverCity: '',
        receiverPostal: '',
        receiverProvince: '',
        receiverPhone: '',
        receiverEmail: '',
        weight: '',
        description: '',
        tipoEnvio: 'Comun',
        tipoPaquete: 'Comun',
      })
      setDeliveryMode('domicilio')
      setSelectedPickUpId('')
      onClose()
    } catch (error) {
      setSubmitError(
        extractApiError(
          error,
          'No se pudo registrar el envío. Verificá los datos e intentá de nuevo.',
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  const hasErrors = Object.values(errors).some((v) => !!v)
  const selectedPickUp = pickups.find((p) => p.id === selectedPickUpId)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar envío' : 'Registrar nuevo envío'}</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {hasErrors && (
            <Alert severity="error" sx={{ mb: 1 }}>
              Revisá los campos marcados en rojo.
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSubmitError('')}>
              {submitError}
            </Alert>
          )}

          {!loadingBranches && branches.length === 0 && (
            <Alert severity="warning">
              No hay una sucursal activa configurada. Pedile al administrador que cree una desde
              "Mi sucursal" antes de registrar envíos.
            </Alert>
          )}

          {branches.length === 1 && (
            <Alert severity="info" icon={false} sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                Origen del envío
              </Typography>
              <Typography variant="body2">
                {branches[0].name} — {branches[0].address}, {branches[0].city}
                {branches[0].postalCode ? ` (CP ${branches[0].postalCode})` : ''}
              </Typography>
            </Alert>
          )}

          {branches.length > 1 && (
            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Sucursal de origen</InputLabel>
              <Select
                value={selectedBranchId}
                label="Sucursal de origen"
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>
                    {b.name} — {b.address}, {b.city}
                    {b.postalCode ? ` (CP ${b.postalCode})` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {!isEdit && (
            <TextField
              label="ID de Tracking"
              disabled
              value="Se asignará automáticamente al guardar"
              fullWidth
              size="small"
              sx={{ mt: 1 }}
            />
          )}
          {isEdit && initialData && (
            <TextField
              label="ID de Tracking"
              disabled
              value={initialData.trackingId}
              fullWidth
              size="small"
              sx={{ mt: 1 }}
            />
          )}

          {!isEdit && (
            <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Modalidad de entrega
              </Typography>
              <FormControl fullWidth size="small" sx={{ mb: deliveryMode === 'pickup' ? 1 : 0 }}>
                <InputLabel>Entrega</InputLabel>
                <Select
                  value={deliveryMode}
                  label="Entrega"
                  onChange={(e) => {
                    setDeliveryMode(e.target.value as 'domicilio' | 'pickup')
                    setCotizacion(null)
                    setErrors((prev) => {
                      const next = { ...prev }
                      delete next.pickup
                      return next
                    })
                  }}
                >
                  <MenuItem value="domicilio">A domicilio</MenuItem>
                  <MenuItem value="pickup">Retiro en PickUp</MenuItem>
                </Select>
              </FormControl>
              {deliveryMode === 'pickup' && (
                <FormControl fullWidth size="small" required error={!!errors.pickup}>
                  <InputLabel>Punto PickUp</InputLabel>
                  <Select
                    value={selectedPickUpId}
                    label="Punto PickUp"
                    onChange={(e) => {
                      const value = e.target.value
                      setSelectedPickUpId(value)
                      setCotizacion(null)
                      setErrors((prev) => ({ ...prev, pickup: '' }))
                    }}
                  >
                    {pickups.map((p) => (
                      <MenuItem key={p.id} value={p.id} disabled={!!p.estaLleno}>
                        {p.nombre} - {p.localidad}, {p.provincia} (CP {p.codigoPostal})
                        {p.totalCalificaciones && p.totalCalificaciones > 0 ? ` · ★ ${p.promedioCalificaciones?.toFixed(1)} (${p.totalCalificaciones})` : ''}
                        {p.estaLleno ? ' — Temporalmente sin espacio' : ''}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {errors.pickup || (selectedPickUp
                      ? `${selectedPickUp.direccion}. Horario: ${selectedPickUp.horarios}`
                      : 'Solo se muestran PickUps dentro de la cobertura de tu sucursal.')}
                  </FormHelperText>
                </FormControl>
              )}
              {deliveryMode === 'pickup' && pickups.length === 0 && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  No hay puntos PickUp activos para la cobertura de tu sucursal.
                </Alert>
              )}
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Destinatario
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <TextField
                  label="Nombre"
                  name="receiverName"
                  value={formData.receiverName}
                  onChange={handleChange}
                  error={!!errors.receiverName}
                  helperText={errors.receiverName}
                  required
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}>
                <TextField
                  label="Dirección"
                  name="receiverAddress"
                  value={formData.receiverAddress}
                  onChange={handleChange}
                  onBlur={() => {
                    const normalized = capitalizeAddress(formData.receiverAddress)
                    if (normalized !== formData.receiverAddress) {
                      setFormData((prev) => ({ ...prev, receiverAddress: normalized }))
                    }
                  }}
                  error={!!errors.receiverAddress}
                  helperText={errors.receiverAddress ?? 'Formato: "Calle Altura" (ej. Rosa Castillo 2487)'}
                  required
                  fullWidth
                  size="small"
                  sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}
                />
              </Grid>
              <Grid item xs={6} sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}>
                <TextField
                  label="Ciudad"
                  name="receiverCity"
                  value={formData.receiverCity}
                  onChange={handleChange}
                  error={!!errors.receiverCity}
                  helperText={errors.receiverCity}
                  required
                  fullWidth
                  size="small"
                  sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}
                />
              </Grid>
              <Grid item xs={6} sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}>
                <TextField
                  label="CP"
                  name="receiverPostal"
                  value={formData.receiverPostal}
                  onChange={handleChange}
                  onBlur={checkReceiverPostal}
                  error={!!errors.receiverPostal}
                  helperText={errors.receiverPostal}
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
                  size="small"
                  sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}
                />
              </Grid>
              <Grid item xs={12} sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}>
                <FormControl fullWidth size="small" required error={!!errors.receiverProvince} sx={{ display: deliveryMode === 'pickup' && !isEdit ? 'none' : undefined }}>
                  <InputLabel>Provincia</InputLabel>
                  <Select
                    value={formData.receiverProvince}
                    label="Provincia"
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, receiverProvince: e.target.value }))
                      if (errors.receiverProvince) {
                        setErrors((prev) => ({ ...prev, receiverProvince: '' }))
                      }
                    }}
                  >
                    {AR_PROVINCIAS.map((p) => (
                      <MenuItem key={p} value={p}>{p}</MenuItem>
                    ))}
                  </Select>
                  {errors.receiverProvince && (
                    <FormHelperText>{errors.receiverProvince}</FormHelperText>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Teléfono (opcional)"
                  name="receiverPhone"
                  value={formData.receiverPhone}
                  onChange={handleChange}
                  error={!!errors.receiverPhone}
                  helperText={errors.receiverPhone}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Email para notificaciones"
                  name="receiverEmail"
                  value={formData.receiverEmail}
                  onChange={handleChange}
                  error={!!errors.receiverEmail}
                  helperText={errors.receiverEmail || 'Se usa para avisos de salida a ruta y entrega'}
                  required
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

          <Grid container spacing={1}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de envío</InputLabel>
                <Select
                  value={formData.tipoEnvio}
                  label="Tipo de envío"
                  onChange={(e) => setFormData((prev) => ({ ...prev, tipoEnvio: e.target.value as TipoEnvio }))}
                >
                  <MenuItem value="Comun">Común</MenuItem>
                  <MenuItem value="Prioritario">Prioritario</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de paquete</InputLabel>
                <Select
                  value={formData.tipoPaquete}
                  label="Tipo de paquete"
                  onChange={(e) => setFormData((prev) => ({ ...prev, tipoPaquete: e.target.value as TipoPaquete }))}
                >
                  <MenuItem value="Comun">Común</MenuItem>
                  <MenuItem value="Fragil">Frágil</MenuItem>
                  <MenuItem value="Pesado">Pesado</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <FormControl error={!!errors.weight} fullWidth>
            <TextField
              label="Peso (kg)"
              name="weight"
              type="number"
              value={formData.weight}
              onChange={handleChange}
              error={!!errors.weight}
              helperText={errors.weight}
              required
              fullWidth
              inputProps={{ step: '0.1', min: 0, max: MAX_WEIGHT_KG }}
            />
            {!errors.weight && (
              <FormHelperText>Máximo {MAX_WEIGHT_KG} kg por paquete</FormHelperText>
            )}
          </FormControl>

          <TextField
            label="Observaciones (opcional)"
            name="description"
            value={formData.description}
            onChange={handleChange}
            fullWidth
            multiline
            rows={2}
          />

          {/* G1L-88: Cotización detallada (visualización; el Operador no modifica los valores base). */}
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: cotizacion ? 1.5 : 0 }}>
              <Typography variant="subtitle2">Cotización del envío</Typography>
              <Button size="small" onClick={handleCotizar} disabled={cotizando}>
                {cotizando ? <CircularProgress size={16} /> : 'Calcular'}
              </Button>
            </Box>
            {cotizacion && (
              <Box>
                <Row label={`Peso (${cotizacion.peso} kg × $${cotizacion.precioPorKg}/kg)`} value={cotizacion.costoPeso} />
                <Row label={`Distancia (${cotizacion.distanciaKm} km × $${cotizacion.precioPorKm}/km)`} value={cotizacion.costoDistancia} />
                {cotizacion.esZonaPeligrosa ? (
                  <>
                    <Alert severity="warning" sx={{ my: 1, py: 0 }}>
                      Destino en zona peligrosa: recargo por seguridad del {cotizacion.porcentajeRecargo}%.
                    </Alert>
                    <Row label={`Costo extra por seguridad (${cotizacion.porcentajeRecargo}%)`} value={cotizacion.costoRecargo} highlight />
                  </>
                ) : cotizacion.geocodificado ? (
                  <Row label="Recargo zona peligrosa" value={0} />
                ) : null}
                <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1, pt: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="subtitle1" fontWeight={700}>Total</Typography>
                  <Typography variant="subtitle1" fontWeight={700}>${cotizacion.total.toLocaleString('es-AR')}</Typography>
                </Box>
                {/* Diagnóstico de geocodificación: ayuda a entender si (no) se aplicó el recargo. */}
                {!cotizacion.geocodificado ? (
                  <Typography variant="caption" color="warning.main" display="block" sx={{ mt: 1 }}>
                    ⚠️ No se pudo ubicar la dirección en el mapa, por eso no se evaluó la zona peligrosa.
                  </Typography>
                ) : (
                  cotizacion.latitud != null && (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      📍 Ubicación detectada: {cotizacion.latitud.toFixed(4)}, {cotizacion.longitud?.toFixed(4)}
                    </Typography>
                  )
                )}
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !selectedBranchId}
        >
          {loading ? <CircularProgress size={24} /> : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// G1L-88: fila itemizada del desglose de la cotización.
function Row({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.25 }}>
      <Typography variant="body2" color={highlight ? 'warning.main' : 'text.secondary'}>{label}</Typography>
      <Typography variant="body2" fontWeight={highlight ? 700 : 400} color={highlight ? 'warning.main' : 'text.primary'}>
        ${value.toLocaleString('es-AR')}
      </Typography>
    </Box>
  )
}

export default ShipmentForm
