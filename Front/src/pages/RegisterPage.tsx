import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Box,
  TextField,
  Button,
  Link,
  Typography,
  Card,
  Alert,
  CircularProgress,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
} from '@mui/material'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import { authService } from '../services/authService'
import type { RegisterData, UserRole } from '../types'

function RegisterPage() {
  const nameRegex = /^[A-Za-zÀ-ÿ\s'-]+$/
  const navigate = useNavigate()
  const [formData, setFormData] = useState<RegisterData>({
    name: '',
    lastname: '',
    email: '',
    dni: '',
    password: '',
    confirmPassword: '',
    role: 'operador',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name } = e.target
    let { value } = e.target

    if (name === 'name' || name === 'lastname') {
      value = value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '')
    }

    if (name === 'dni') {
      value = value.replace(/\D/g, '')
    }

    const nextFormData = {
      ...formData,
      [name]: value,
    }

    setFormData(nextFormData)

    setErrors((prev) => {
      const nextErrors = { ...prev }

      if (name === 'password') {
        if (value.length > 0 && value.length < 8) {
          nextErrors.password = 'Contraseña debe tener al menos 8 caracteres'
        } else {
          nextErrors.password = ''
        }

        if (nextFormData.confirmPassword && nextFormData.confirmPassword !== value) {
          nextErrors.confirmPassword = 'Las contraseñas no coinciden'
        } else {
          nextErrors.confirmPassword = ''
        }
      } else if (name === 'confirmPassword') {
        if (value && value !== nextFormData.password) {
          nextErrors.confirmPassword = 'Las contraseñas no coinciden'
        } else {
          nextErrors.confirmPassword = ''
        }
      } else if (nextErrors[name]) {
        nextErrors[name] = ''
      }

      return nextErrors
    })

    setGeneralError('')
  }

  const handleRoleChange = (e: any) => {
    setFormData((prev) => ({
      ...prev,
      role: e.target.value as UserRole,
    }))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'Requerido'
    else if (!nameRegex.test(formData.name.trim())) newErrors.name = 'Solo se permiten letras'
    if (!formData.lastname.trim()) newErrors.lastname = 'Requerido'
    else if (!nameRegex.test(formData.lastname.trim())) newErrors.lastname = 'Solo se permiten letras'
    if (!authService.isValidEmail(formData.email)) newErrors.email = 'Email inválido'
    if (!authService.isValidDni(formData.dni)) newErrors.dni = 'DNI debe tener 8 dígitos'
    if (!authService.isValidPassword(formData.password))
      newErrors.password = 'Contraseña debe tener al menos 8 caracteres'
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = 'Las contraseñas no coinciden'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneralError('')

    if (!validateForm()) return

    setLoading(true)

    try {
      const registered = await authService.register(formData)
      if (registered) {
        navigate('/login', {
          state: {
            registrationSuccess: true,
            registeredEmail: formData.email,
          },
        })
      } else {
        setGeneralError('No se pudo completar el registro')
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  const closeGeneralErrorToast = () => {
    setGeneralError('')
  }

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          py: 2,
        }}
      >
        <Card sx={{ width: '100%', p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '11px',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'linear-gradient(135deg,#0288D1,#29B6F6)',
                  boxShadow: '0 8px 18px rgba(2,136,209,0.24)',
                }}
              >
                <LocalShippingRoundedIcon sx={{ color: '#fff', fontSize: 19 }} />
              </Box>
              <Typography variant="h4" component="h1">
                LogiTrack
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary">
              Crear nueva cuenta
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Grid container spacing={1}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    error={!!errors.name}
                    helperText={errors.name}
                    disabled={loading}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Apellido"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleChange}
                    error={!!errors.lastname}
                    helperText={errors.lastname}
                    disabled={loading}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <TextField
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                error={!!errors.email}
                helperText={errors.email}
                disabled={loading}
                fullWidth
              />

              <TextField
                label="DNI"
                name="dni"
                value={formData.dni}
                onChange={handleChange}
                placeholder="12345678"
                error={!!errors.dni}
                helperText={errors.dni}
                disabled={loading}
                fullWidth
              />

              <FormControl fullWidth disabled={loading}>
                <InputLabel>Rol</InputLabel>
                <Select
                  value={formData.role}
                  onChange={handleRoleChange}
                  label="Rol"
                >
                  <MenuItem value="supervisor">Supervisor</MenuItem>
                  <MenuItem value="operador">Operador</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary">
                El rol transportista solo puede ser creado por un supervisor desde el panel interno.
              </Typography>

              <TextField
                label="Contraseña"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                error={!!errors.password}
                helperText={errors.password}
                disabled={loading}
                fullWidth
              />

              <TextField
                label="Confirmar contraseña"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={!!errors.confirmPassword}
                helperText={errors.confirmPassword}
                disabled={loading}
                fullWidth
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={loading}
                sx={{ mt: 2 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Registrarse'}
              </Button>
            </Box>
          </form>

          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              ¿Ya tienes cuenta?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/login')}
                sx={{ cursor: 'pointer' }}
              >
                Inicia sesión aquí
              </Link>
            </Typography>
          </Box>
        </Card>
      </Box>

      <Snackbar
        open={Boolean(generalError)}
        autoHideDuration={4000}
        onClose={closeGeneralErrorToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity="error"
          variant="filled"
          onClose={closeGeneralErrorToast}
          sx={{ width: '100%' }}
        >
          {generalError}
        </Alert>
      </Snackbar>
    </Container>
  )
}

export default RegisterPage
