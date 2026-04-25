import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material'
import type { Vehicle } from '../types'
import { vehicleService } from '../services/vehicleService'

interface VehicleFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (vehicle: Omit<Vehicle, 'id'>) => Promise<void>
  operatorId: string
}

function VehicleForm({ open, onClose, onSubmit, operatorId }: VehicleFormProps) {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [validationError, setValidationError] = useState('')
  const [formData, setFormData] = useState({
    patente: '',
    marca: '',
    capacidadCarga: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
    setValidationError('')
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    if (!formData.patente.trim()) newErrors.patente = 'Requerido'
    if (!formData.marca.trim()) newErrors.marca = 'Requerido'
    if (!formData.capacidadCarga || isNaN(Number(formData.capacidadCarga))) {
      newErrors.capacidadCarga = 'Debe ser un número válido'
    }

    // Validar que la patente no exista
    if (formData.patente.trim() && !newErrors.patente) {
      const exists = await vehicleService.patenteExists(formData.patente)
      if (exists) {
        newErrors.patente = 'Esta patente ya está registrada'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!(await validateForm())) return

    setLoading(true)
    setValidationError('')

    try {
      await onSubmit({
        patente: formData.patente.toUpperCase(),
        marca: formData.marca,
        capacidadCarga: Number(formData.capacidadCarga),
        estado: 'Disponible',
        createdDate: new Date().toISOString().split('T')[0],
        operator: operatorId,
      })

      // Limpiar formulario
      setFormData({
        patente: '',
        marca: '',
        capacidadCarga: '',
      })
      onClose()
    } catch (error) {
      setValidationError('Error al registrar vehículo')
      console.error('Error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar nuevo vehículo</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {validationError && (
            <Alert severity="error">{validationError}</Alert>
          )}

          <TextField
            label="Patente"
            name="patente"
            value={formData.patente}
            onChange={handleChange}
            error={!!errors.patente}
            helperText={errors.patente || 'Ej: ABC123'}
            fullWidth
            disabled={loading}
            placeholder="ABC123"
          />

          <TextField
            label="Marca"
            name="marca"
            value={formData.marca}
            onChange={handleChange}
            error={!!errors.marca}
            helperText={errors.marca}
            fullWidth
            disabled={loading}
            placeholder="Ej: Chevrolet, Ford, Mercedes"
          />

          <TextField
            label="Capacidad de Carga (kg)"
            name="capacidadCarga"
            type="number"
            value={formData.capacidadCarga}
            onChange={handleChange}
            error={!!errors.capacidadCarga}
            helperText={errors.capacidadCarga || 'Ej: 500, 750, 1000'}
            fullWidth
            disabled={loading}
            inputProps={{ step: '1', min: '1' }}
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
          disabled={loading || !formData.patente || !formData.marca || !formData.capacidadCarga}
        >
          {loading ? <CircularProgress size={24} /> : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default VehicleForm
