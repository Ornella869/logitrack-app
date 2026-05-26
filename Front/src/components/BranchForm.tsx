import { useEffect, useState } from 'react'
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
  // Épica D: si se provee, el Gerente solo puede crear sucursales en su provincia.
  lockedProvince?: string
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

function BranchForm({ open, onClose, onSaved, mode = 'create', initialData, lockedProvince }: BranchFormProps) {
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
        coveredProvinces: initialData.coveredProvinces ?? [],
      })
    } else {
      setFormData({ ...EMPTY_FORM, province: lockedProvince ?? '' })
    }
  }, [open, isEdit, initialData, lockedProvince])

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

          <FormControl fullWidth required error={!!errors.province} disabled={loading || !!lockedProvince}>
            <InputLabel>Provincia</InputLabel>
            <Select
              value={formData.province}
              label="Provincia"
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  province: e.target.value,
                  coveredProvinces: prev.coveredProvinces.filter((p) => p !== e.target.value),
                }))
                if (errors.province) setErrors((prev) => ({ ...prev, province: '' }))
              }}
            >
              {AR_PROVINCIAS.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {errors.province ?? (lockedProvince
                ? `Como Gerente solo podés crear sucursales en tu provincia (${lockedProvince}).`
                : 'Se pre-selecciona al validar el CP — verificá que sea correcta para CPs ambiguos.')}
            </FormHelperText>
          </FormControl>

          <FormControl fullWidth disabled={loading}>
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
              {AR_PROVINCIAS.filter((p) => p !== formData.province).map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </Select>
            <FormHelperText>La provincia propia siempre queda cubierta.</FormHelperText>
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
