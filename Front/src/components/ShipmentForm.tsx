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
} from '@mui/material'
import type { Shipment, TipoEnvio, TipoPaquete } from '../types'
import { shipmentService } from '../services/shipmentService'

interface ShipmentFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (shipment: Omit<Shipment, 'id' | 'lastUpdate'>) => Promise<void>
  mode?: 'create' | 'edit'
  initialData?: Shipment
}

function ShipmentForm({ open, onClose, onSubmit, mode = 'create', initialData }: ShipmentFormProps) {
  const isEdit = mode === 'edit'
  const cityRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
  const [loading, setLoading] = useState(false)
  const [generatingId, setGeneratingId] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formData, setFormData] = useState({
    trackingId: '',
    senderName: '',
    senderAddress: '',
    senderCity: '',
    senderPostal: '',
    senderPhone: '',
    receiverName: '',
    receiverAddress: '',
    receiverCity: '',
    receiverPostal: '',
    receiverPhone: '',
    origin: '',
    destination: '',
    weight: '',
    description: '',
    estimatedDelivery: '',
    tipoEnvio: 'Comun' as TipoEnvio,
    tipoPaquete: 'Comun' as TipoPaquete,
  })

  // Al abrir: prefillear si es edición; generar tracking nuevo si es alta
  useEffect(() => {
    if (!open) return
    if (isEdit && initialData) {
      setFormData({
        trackingId: initialData.trackingId,
        senderName: initialData.sender.name,
        senderAddress: initialData.sender.address,
        senderCity: initialData.sender.city,
        senderPostal: initialData.sender.postalCode,
        senderPhone: initialData.sender.phone ?? '',
        receiverName: initialData.receiver.name,
        receiverAddress: initialData.receiver.address,
        receiverCity: initialData.receiver.city,
        receiverPostal: initialData.receiver.postalCode,
        receiverPhone: initialData.receiver.phone ?? '',
        origin: initialData.origin,
        destination: initialData.destination,
        weight: String(initialData.weight),
        description: initialData.description,
        estimatedDelivery: initialData.estimatedDelivery,
        tipoEnvio: initialData.tipoEnvio ?? 'Comun',
        tipoPaquete: initialData.tipoPaquete ?? 'Comun',
      })
    } else {
      generateNewTrackingId()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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
    // G1L-10: Peso > 0 obligatorio
    if (!formData.weight || isNaN(Number(formData.weight)) || Number(formData.weight) <= 0) {
      newErrors.weight = 'El peso debe ser mayor a 0'
    }

    // En modo create validar que el tracking ID no exista (en edit es el mismo)
    if (!isEdit && formData.trackingId && !newErrors.trackingId) {
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
          phone: formData.senderPhone || undefined,
        },
        receiver: {
          name: formData.receiverName,
          address: formData.receiverAddress,
          city: formData.receiverCity,
          postalCode: formData.receiverPostal,
          phone: formData.receiverPhone || undefined,
        },
        // G1L-10: origin/destination se derivan de las ciudades para no pedirlos al usuario
        origin: formData.senderCity,
        destination: formData.receiverCity,
        weight: Number(formData.weight),
        description: formData.description,
        // G1L-10 AC6: la fecha estimada se calcula en la calendarización (Sprint 2)
        estimatedDelivery: '',
        status: 'Pendiente de calendarización',
        tipoEnvio: formData.tipoEnvio,
        tipoPaquete: formData.tipoPaquete,
        createdDate: new Date().toISOString().split('T')[0],
      })

      // Limpiar formulario
      setFormData({
        trackingId: '',
        senderName: '',
        senderAddress: '',
        senderCity: '',
        senderPostal: '',
        senderPhone: '',
        receiverName: '',
        receiverAddress: '',
        receiverCity: '',
        receiverPostal: '',
        receiverPhone: '',
        origin: '',
        destination: '',
        weight: '',
        description: '',
        estimatedDelivery: '',
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? 'Editar envío' : 'Registrar nuevo envío'}</DialogTitle>
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
              {!isEdit && (
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
              )}
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
              <Grid item xs={12}>
                <TextField
                  label="Teléfono (opcional)"
                  name="senderPhone"
                  value={formData.senderPhone}
                  onChange={handleChange}
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
              <Grid item xs={12}>
                <TextField
                  label="Teléfono (opcional)"
                  name="receiverPhone"
                  value={formData.receiverPhone}
                  onChange={handleChange}
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
