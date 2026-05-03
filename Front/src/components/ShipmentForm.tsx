import { useState, useEffect } from 'react'
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
import { postalCodeService } from '../services/postalCodeService'
import { branchService } from '../services/branchService'

interface ShipmentFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (shipment: Omit<Shipment, 'id' | 'lastUpdate' | 'trackingId'>) => Promise<void>
  mode?: 'create' | 'edit'
  initialData?: Shipment
}

// G1L-54: capacidad por repartidor. Un paquete que la supere no podría calendarizarse.
const MAX_WEIGHT_KG = 500

// Solo letras + espacios + tildes/diéresis + apóstrofe/guion. Sin números.
const nameRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s'-]{1,}$/
const cityRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
// Dirección formato "Calle Altura": empieza con letra, termina con número (opcional sufijo letra ej "1234B").
// Ejemplos válidos: "Rosa Castillo 2487", "Av. 9 de Julio 1500", "Av. Corrientes 1234A".
// Inválidos: "2487 Rosa Castillo", "1234", "asdfgh".
const addressRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s.,'-]*\s\d+[A-Za-z]?$/
const phoneRegex = /^[+\d][\d\s-]{6,19}$/

function ShipmentForm({ open, onClose, onSubmit, mode = 'create', initialData }: ShipmentFormProps) {
  const isEdit = mode === 'edit'
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [postalChecking, setPostalChecking] = useState(false)
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [formData, setFormData] = useState({
    receiverName: '',
    receiverAddress: '',
    receiverCity: '',
    receiverPostal: '',
    receiverPhone: '',
    weight: '',
    description: '',
    tipoEnvio: 'Comun' as TipoEnvio,
    tipoPaquete: 'Comun' as TipoPaquete,
  })

  useEffect(() => {
    if (!open) return
    setErrors({})
    loadBranches()
    if (isEdit && initialData) {
      setFormData({
        receiverName: initialData.receiver.name,
        receiverAddress: initialData.receiver.address,
        receiverCity: initialData.receiver.city,
        receiverPostal: initialData.receiver.postalCode,
        receiverPhone: initialData.receiver.phone ?? '',
        weight: String(initialData.weight),
        description: initialData.description,
        tipoEnvio: initialData.tipoEnvio ?? 'Comun',
        tipoPaquete: initialData.tipoPaquete ?? 'Comun',
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

    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
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
      // Autocompletar siempre la ciudad con la que devuelva la API (sobreescribe lo escrito).
      if (result.city) {
        setFormData((prev) => ({ ...prev, receiverCity: result.city as string }))
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

    // Destinatario — G1L-10
    if (!formData.receiverName.trim()) {
      newErrors.receiverName = 'Requerido'
    } else if (!nameRegex.test(formData.receiverName.trim())) {
      newErrors.receiverName = 'Solo letras (mín. 2 caracteres)'
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

    if (formData.receiverPhone.trim() && !phoneRegex.test(formData.receiverPhone.trim())) {
      newErrors.receiverPhone = 'Teléfono inválido'
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
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!(await validateForm())) return
    const origin = branches.find((b) => b.id === selectedBranchId)
    if (!origin) return

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
          address: formData.receiverAddress.trim(),
          city: formData.receiverCity.trim(),
          postalCode: formData.receiverPostal.trim(),
          phone: formData.receiverPhone.trim() || undefined,
        },
        origin: origin.city,
        destination: formData.receiverCity.trim(),
        weight: Number(formData.weight),
        description: formData.description.trim(),
        estimatedDelivery: '',
        status: 'Pendiente de calendarización',
        tipoEnvio: formData.tipoEnvio,
        tipoPaquete: formData.tipoPaquete,
        createdDate: new Date().toISOString().split('T')[0],
      })

      setFormData({
        receiverName: '',
        receiverAddress: '',
        receiverCity: '',
        receiverPostal: '',
        receiverPhone: '',
        weight: '',
        description: '',
        tipoEnvio: 'Comun',
        tipoPaquete: 'Comun',
      })
      onClose()
    } catch (error) {
      console.error('Error al crear envío:', error)
    } finally {
      setLoading(false)
    }
  }

  const hasErrors = Object.values(errors).some((v) => !!v)

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
              <Grid item xs={12}>
                <TextField
                  label="Dirección"
                  name="receiverAddress"
                  value={formData.receiverAddress}
                  onChange={handleChange}
                  error={!!errors.receiverAddress}
                  helperText={errors.receiverAddress ?? 'Formato: "Calle Altura" (ej. Rosa Castillo 2487)'}
                  required
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
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
                />
              </Grid>
              <Grid item xs={6}>
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
                />
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

export default ShipmentForm
