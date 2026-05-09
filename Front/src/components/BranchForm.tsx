import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
} from '@mui/material'
import type { Branch, BranchStatus } from '../types'
import { branchService } from '../services/branchService'
import { postalCodeService } from '../services/postalCodeService'
import { AR_PROVINCIAS, normalizeProvincia } from '../utils/provincias'

interface BranchFormProps {
  open: boolean
  onClose: () => void
  onSaved: (branch: Branch) => void
  mode?: 'create' | 'edit'
  initialData?: Branch
}

const nameRegex = /^[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s'.-]{1,}$/
const cityRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
const addressRegex = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9\s.,'-]*\s\d+[A-Za-z]?$/
const phoneRegex = /^[+\d][\d\s-]{6,19}$/

const EMPTY_FORM = {
  name: '',
  address: '',
  city: '',
  postalCode: '',
  province: '',
  phone: '',
  status: 'Activa' as BranchStatus,
}

function BranchForm({ open, onClose, onSaved, mode = 'create', initialData }: BranchFormProps) {
  const isEdit = mode === 'edit'
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [postalChecking, setPostalChecking] = useState(false)

  useEffect(() => {
    if (!open) return
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
      })
    } else {
      setFormData(EMPTY_FORM)
    }
  }, [open, isEdit, initialData])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target
    let { value } = e.target

    if (name === 'postalCode') {
      value = value.replace(/\D/g, '').slice(0, 4)
    }
    if (name === 'phone') {
      value = value.replace(/[^\d+\s-]/g, '')
    }
    if (name === 'city') {
      value = value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '')
    }

    setFormData((prev) => {
      const next = { ...prev, [name]: value }
      // Cambio de CP → limpiamos la provincia auto-rellenada para que el blur
      // re-sugiera la del CP nuevo. Si el operador eligió manualmente una
      // provincia después, su elección se respeta (ver checkPostal).
      if (name === 'postalCode' && value !== prev.postalCode) {
        next.province = ''
      }
      return next
    })
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }))
    }
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
      setErrors((prev) => {
        const next = { ...prev }
        delete next.postalCode
        return next
      })
      // Pre-rellena provincia solo si está vacía. Si el operador la eligió
      // manualmente (CPs ambiguos como 9420), respetamos su elección.
      const normalizedProvince = normalizeProvincia(result.province)
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
      }
      const saved = isEdit && initialData
        ? await branchService.updateBranch(initialData.id, payload)
        : await branchService.createBranch(payload)
      onSaved(saved)
      setFormData(EMPTY_FORM)
      onClose()
    } catch {
      setErrors((prev) => ({ ...prev, _generic: 'Error al guardar la sucursal' }))
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (loading) return
    setFormData(EMPTY_FORM)
    setErrors({})
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
                setFormData((prev) => ({ ...prev, province: e.target.value }))
                if (errors.province) setErrors((prev) => ({ ...prev, province: '' }))
              }}
            >
              {AR_PROVINCIAS.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {errors.province ?? 'Se pre-selecciona al validar el CP — verificá que sea correcta para CPs ambiguos.'}
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
          />
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
