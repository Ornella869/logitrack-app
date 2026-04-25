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
} from '@mui/material'
import type { Shipment, Branch } from '../types'
import { shipmentService } from '../services/shipmentService'
import { branchService } from '../services/branchService'

interface ShipmentFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (shipment: Omit<Shipment, 'id' | 'lastUpdate'>) => Promise<void>
}

function ShipmentForm({ open, onClose, onSubmit }: ShipmentFormProps) {
  const cityRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
  const [loading, setLoading] = useState(false)
  const [generatingId, setGeneratingId] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [branches, setBranches] = useState<Branch[]>([])
  const [formData, setFormData] = useState({
    trackingId: '',
    senderName: '',
    senderAddress: '',
    senderCity: '',
    senderPostal: '',
    receiverName: '',
    receiverAddress: '',
    receiverCity: '',
    receiverPostal: '',
    origin: '',
    destination: '',
    weight: '',
    description: '',
    estimatedDelivery: '',
  })

  // Cargar sucursales y generar tracking ID cuando se abre el modal
  useEffect(() => {
    if (open) {
      loadBranches()
      generateNewTrackingId()
    }
  }, [open])

  const loadBranches = async () => {
    try {
      const data = await branchService.getAllBranches()
      setBranches(data)
    } catch (error) {
      console.error('Error cargando sucursales:', error)
    }
  }

  const generateNewTrackingId = async () => {
    setGeneratingId(true)
    try {
      const newId = await shipmentService.generateTrackingId()
      setFormData((prev) => ({
        ...prev,
        trackingId: newId,
      }))
      // Limpiar error de tracking ID
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.trackingId
        return newErrors
      })
    } catch (error) {
      console.error('Error generando tracking ID:', error)
    } finally {
      setGeneratingId(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target
    let { value } = e.target

    if (name === 'senderCity' || name === 'receiverCity') {
      value = value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '')
    }

    if (name === 'senderPostal' || name === 'receiverPostal') {
      value = value.replace(/\D/g, '')
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }))
    }
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {}

    if (!formData.trackingId) newErrors.trackingId = 'Requerido'
    if (!formData.senderName) newErrors.senderName = 'Requerido'
    if (!formData.receiverName) newErrors.receiverName = 'Requerido'
    if (formData.senderCity && !cityRegex.test(formData.senderCity.trim())) newErrors.senderCity = 'Solo letras'
    if (formData.receiverCity && !cityRegex.test(formData.receiverCity.trim())) newErrors.receiverCity = 'Solo letras'
    if (!formData.origin) newErrors.origin = 'Requerido'
    if (!formData.destination) newErrors.destination = 'Requerido'
    if (!formData.weight || isNaN(Number(formData.weight))) newErrors.weight = 'Debe ser un número'
    if (!formData.description) newErrors.description = 'Requerido'
    if (!formData.estimatedDelivery) newErrors.estimatedDelivery = 'Requerido'

    // Validar que el tracking ID no exista
    if (formData.trackingId && !newErrors.trackingId) {
      const exists = await shipmentService.trackingIdExists(formData.trackingId)
      if (exists) {
        newErrors.trackingId = 'Este ID de tracking ya existe'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!(await validateForm())) return

    setLoading(true)
    try {
      await onSubmit({
        trackingId: formData.trackingId,
        sender: {
          name: formData.senderName,
          address: formData.senderAddress,
          city: formData.senderCity,
          postalCode: formData.senderPostal,
        },
        receiver: {
          name: formData.receiverName,
          address: formData.receiverAddress,
          city: formData.receiverCity,
          postalCode: formData.receiverPostal,
        },
        origin: formData.origin,
        destination: formData.destination,
        weight: Number(formData.weight),
        description: formData.description,
        estimatedDelivery: formData.estimatedDelivery,
        status: 'En tránsito',
        createdDate: new Date().toISOString().split('T')[0],
      })

      // Limpiar formulario
      setFormData({
        trackingId: '',
        senderName: '',
        senderAddress: '',
        senderCity: '',
        senderPostal: '',
        receiverName: '',
        receiverAddress: '',
        receiverCity: '',
        receiverPostal: '',
        origin: '',
        destination: '',
        weight: '',
        description: '',
        estimatedDelivery: '',
      })
      onClose()
    } catch (error) {
      console.error('Error al crear envío:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar nuevo envío</DialogTitle>
      <DialogContent sx={{ pt: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1 }}>
              <TextField
                label="ID de Tracking"
                disabled={true}
                name="trackingId"
                value={formData.trackingId}
                onChange={handleChange}
                error={!!errors.trackingId}
               
                fullWidth
                size="small"
              />
              <Button
                variant="outlined"
                size="small"
                onClick={generateNewTrackingId}
                disabled={generatingId || loading}
                sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
                title="Generar nuevo ID"
              >
                {generatingId ? <CircularProgress size={16} /> : '🔄'}
              </Button>
            </Box>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Remitente
            </Typography>
            <Grid container spacing={1}>
              <Grid item xs={12}>
                <TextField
                  label="Nombre"
                  name="senderName"
                  value={formData.senderName}
                  onChange={handleChange}
                  error={!!errors.senderName}
                  helperText={errors.senderName}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Dirección"
                  name="senderAddress"
                  value={formData.senderAddress}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Ciudad"
                  name="senderCity"
                  value={formData.senderCity}
                  onChange={handleChange}
                  error={!!errors.senderCity}
                  helperText={errors.senderCity}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="CP"
                  name="senderPostal"
                  value={formData.senderPostal}
                  onChange={handleChange}
                  inputProps={{ inputMode: 'numeric' }}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

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
                  inputProps={{ inputMode: 'numeric' }}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>

          <Grid container spacing={1}>
            <Grid item xs={6}>
              <Select
                label="Origen"
                name="origin"
                value={formData.origin}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    origin: e.target.value,
                  }))
                  if (errors.origin) {
                    setErrors((prev) => ({
                      ...prev,
                      origin: '',
                    }))
                  }
                }}
                error={!!errors.origin}
                fullWidth
                displayEmpty
              >
                <MenuItem value="">Seleccionar origen</MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid item xs={6}>
              <Select
                label="Destino"
                name="destination"
                value={formData.destination}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    destination: e.target.value,
                  }))
                  if (errors.destination) {
                    setErrors((prev) => ({
                      ...prev,
                      destination: '',
                    }))
                  }
                }}
                error={!!errors.destination}
                fullWidth
                displayEmpty
              >
                <MenuItem value="">Seleccionar destino</MenuItem>
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.name}>
                    {branch.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
          </Grid>

          <TextField
            label="Peso (kg)"
            name="weight"
            type="number"
            value={formData.weight}
            onChange={handleChange}
            error={!!errors.weight}
            helperText={errors.weight}
            fullWidth
            inputProps={{ step: '0.1' }}
          />

          <TextField
            label="Descripción"
            name="description"
            value={formData.description}
            onChange={handleChange}
            error={!!errors.description}
            helperText={errors.description}
            fullWidth
            multiline
            rows={2}
          />

          <TextField
            label="Fecha estimada de entrega"
            name="estimatedDelivery"
            type="date"
            value={formData.estimatedDelivery}
            onChange={handleChange}
            error={!!errors.estimatedDelivery}
            helperText={errors.estimatedDelivery}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading || generatingId}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || generatingId || !formData.trackingId}
        >
          {loading ? <CircularProgress size={24} /> : 'Registrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ShipmentForm
