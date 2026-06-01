import { useState, useRef, useEffect } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Grid,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Avatar,
  Divider,
  Alert,
  Chip,
  IconButton,
  CircularProgress,
  Tooltip,
  InputAdornment,
} from '@mui/material'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import SaveIcon from '@mui/icons-material/Save'
import LockIcon from '@mui/icons-material/Lock'
import PersonIcon from '@mui/icons-material/Person'
import SecurityIcon from '@mui/icons-material/Security'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import type { User } from '../types'
import { authService } from '../services/authService'
import { branchService } from '../services/branchService'

const ROLE_LABELS: Record<string, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  repartidor: 'Repartidor',
  gerente: 'Gerente',
  cliente: 'Cliente',
}

const ROLE_COLORS: Record<string, string> = {
  administrador: '#7E57C2',
  supervisor: '#ef5350',
  operador: '#1976D2',
  repartidor: '#2e7d32',
  gerente: '#E65100',
  cliente: '#0288D1',
}

export default function ProfilePage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(
    () => localStorage.getItem(`logitrack_avatar_${user.id}`)
  )
  const [avatarError, setAvatarError] = useState('')

  // Basic info
  const [name, setName] = useState(user.name)
  const [lastname, setLastname] = useState(user.lastname)
  const [phone, setPhone] = useState(() => localStorage.getItem(`logitrack_phone_${user.id}`) ?? '')
  const [nameError, setNameError] = useState('')
  const [lastnameError, setLastnameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [infoSaving, setInfoSaving] = useState(false)
  const [infoSuccess, setInfoSuccess] = useState(false)
  const [infoError, setInfoError] = useState('')

  const [sucursalNombre, setSucursalNombre] = useState<string | null>(null)

  useEffect(() => {
    if (!user.sucursalId) return
    branchService.getBranchById(user.sucursalId).then(b => {
      if (b) setSucursalNombre(b.name)
    })
  }, [user.sucursalId])

  const onlyLetters = /^[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ\s]*$/
  const onlyPhone = /^[0-9+\-\s()]*$/

  const handleNameChange = (val: string) => {
    if (!onlyLetters.test(val)) {
      setNameError('El nombre no puede contener números')
      return
    }
    setName(val)
    setNameError(val.trim() ? '' : 'El nombre es obligatorio')
  }

  const handleLastnameChange = (val: string) => {
    if (!onlyLetters.test(val)) {
      setLastnameError('El apellido no puede contener números')
      return
    }
    setLastname(val)
    setLastnameError(val.trim() ? '' : 'El apellido es obligatorio')
  }

  const handlePhoneChange = (val: string) => {
    if (!onlyPhone.test(val)) {
      setPhoneError('El teléfono solo puede contener números')
      return
    }
    setPhone(val)
    setPhoneError('')
  }

  // Password
  const [pwActual, setPwActual] = useState('')
  const [pwNueva, setPwNueva] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [showPw, setShowPw] = useState(false)

  const initials = `${user.name.charAt(0)}${user.lastname.charAt(0)}`.toUpperCase()
  const roleColor = ROLE_COLORS[user.role] ?? '#7E57C2'

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarError('')

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setAvatarError('Solo se permiten archivos JPG o PNG')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('El archivo no puede superar 2 MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result as string
      localStorage.setItem(`logitrack_avatar_${user.id}`, b64)
      setAvatarSrc(b64)
      window.dispatchEvent(new Event('logitrack:avatarChange'))
    }
    reader.readAsDataURL(file)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  const handleSaveInfo = async () => {
    const nErr = name.trim() ? '' : 'El nombre es obligatorio'
    const lErr = lastname.trim() ? '' : 'El apellido es obligatorio'
    setNameError(nErr)
    setLastnameError(lErr)
    if (nErr || lErr || nameError || lastnameError || phoneError) return
    setInfoSaving(true)
    setInfoError('')
    setInfoSuccess(false)
    try {
      const updated = await authService.updateMiPerfil(name.trim(), lastname.trim())
      localStorage.setItem(`logitrack_phone_${user.id}`, phone.trim())
      const updatedUser: User = { ...user, name: updated.name, lastname: updated.lastname }
      localStorage.setItem('user', JSON.stringify(updatedUser))
      window.dispatchEvent(new Event('logitrack:userUpdate'))
      setInfoSuccess(true)
      setTimeout(() => setInfoSuccess(false), 3500)
    } catch (err: any) {
      setInfoError(err?.message ?? 'Error al guardar')
    } finally {
      setInfoSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    if (!pwActual || !pwNueva || !pwConfirm) {
      setPwError('Completá todos los campos')
      return
    }
    if (pwNueva.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres')
      return
    }
    if (pwNueva !== pwConfirm) {
      setPwError('Las contraseñas nuevas no coinciden')
      return
    }
    setPwSaving(true)
    try {
      const result = await authService.cambiarPassword(pwActual, pwNueva, pwConfirm)
      if (result.success) {
        authService.logout()
        navigate('/login')
      } else {
        setPwError(result.error ?? 'Error al cambiar la contraseña')
      }
    } finally {
      setPwSaving(false)
    }
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 3 }}>
        Mi Perfil
      </Typography>

      <Grid container spacing={3}>
        {/* ── Columna izquierda: tarjeta de identidad ── */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 3, textAlign: 'center', position: 'relative' }}>
            {/* Avatar con botón de carga */}
            <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
              <Avatar
                src={avatarSrc ?? undefined}
                sx={{
                  width: 104, height: 104,
                  fontSize: '2.2rem', fontWeight: 700,
                  bgcolor: roleColor,
                  mx: 'auto',
                  boxShadow: `0 4px 20px ${roleColor}44`,
                }}
              >
                {!avatarSrc && initials}
              </Avatar>
              <Tooltip title="Cambiar foto de perfil">
                <IconButton
                  onClick={handleAvatarClick}
                  size="small"
                  sx={{
                    position: 'absolute', bottom: 2, right: 2,
                    bgcolor: 'primary.main', color: 'white',
                    width: 30, height: 30,
                    '&:hover': { bgcolor: 'primary.dark' },
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                  }}
                >
                  <PhotoCameraIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={handleAvatarChange}
              />
            </Box>

            {avatarError && (
              <Alert severity="error" sx={{ mb: 2, fontSize: '0.78rem', textAlign: 'left' }}>
                {avatarError}
              </Alert>
            )}

            <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>
              {user.name} {user.lastname}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {user.email}
            </Typography>
            <Chip
              label={ROLE_LABELS[user.role] ?? user.role}
              size="small"
              sx={{ bgcolor: `${roleColor}18`, color: roleColor, fontWeight: 700 }}
            />

            {phone && (
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 1.5 }}>
                {phone}
              </Typography>
            )}
            {user.provincia && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  Provincia(s)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center', mt: 0.5 }}>
                  {user.provincia.split(',').map(p => p.trim()).filter(Boolean).map(prov => (
                    <Chip key={prov} label={prov} size="small" sx={{ fontSize: '0.68rem', height: 20 }} />
                  ))}
                </Box>
              </>
            )}
          </Card>
        </Grid>

        {/* ── Columna derecha: formularios de edición ── */}
        <Grid item xs={12} md={8}>

          {/* Datos Personales */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <PersonIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>Datos Personales</Typography>
              </Box>

              {infoSuccess && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Información actualizada correctamente
                </Alert>
              )}
              {infoError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {infoError}
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nombre"
                    fullWidth
                    value={name}
                    onChange={e => handleNameChange(e.target.value)}
                    error={!!nameError}
                    helperText={nameError}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Apellido"
                    fullWidth
                    value={lastname}
                    onChange={e => handleLastnameChange(e.target.value)}
                    error={!!lastnameError}
                    helperText={lastnameError}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Teléfono"
                    fullWidth
                    value={phone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    placeholder="+54 11 1234-5678"
                    inputProps={{ autoComplete: 'off' }}
                    error={!!phoneError}
                    helperText={phoneError}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email"
                    fullWidth
                    value={user.email}
                    disabled
                    helperText="Solo el administrador puede modificar el email"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="DNI"
                    fullWidth
                    value={user.dni || '—'}
                    disabled
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={infoSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  onClick={handleSaveInfo}
                  disabled={infoSaving}
                >
                  Guardar cambios
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Datos Operativos (solo lectura) */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <SecurityIcon color="action" />
                <Typography variant="h6" fontWeight={700}>Datos Operativos</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 2.5, display: 'block' }}>
                Solo un Administrador puede modificar los accesos operativos.
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Rol"
                    fullWidth
                    value={ROLE_LABELS[user.role] ?? user.role}
                    disabled
                  />
                </Grid>
                {user.provincia && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Provincia(s)"
                      fullWidth
                      value={user.provincia.replace(/,/g, ', ')}
                      disabled
                    />
                  </Grid>
                )}
                {user.sucursalId && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Sucursal"
                      fullWidth
                      value={sucursalNombre ?? 'Cargando...'}
                      disabled
                    />
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Seguridad */}
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                <LockIcon color="warning" />
                <Typography variant="h6" fontWeight={700}>Seguridad</Typography>
              </Box>

              <Alert severity="info" sx={{ mb: 2.5, fontSize: '0.85rem' }}>
                Al cambiar la contraseña se cerrará la sesión actual y deberás iniciar sesión nuevamente.
              </Alert>

              {pwError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {pwError}
                </Alert>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Contraseña actual"
                    type={showPw ? 'text' : 'password'}
                    fullWidth
                    value={pwActual}
                    onChange={e => setPwActual(e.target.value)}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setShowPw(p => !p)} edge="end">
                            {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Nueva contraseña"
                    type={showPw ? 'text' : 'password'}
                    fullWidth
                    value={pwNueva}
                    onChange={e => setPwNueva(e.target.value)}
                    helperText="Mínimo 8 caracteres"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Confirmar nueva contraseña"
                    type={showPw ? 'text' : 'password'}
                    fullWidth
                    value={pwConfirm}
                    onChange={e => setPwConfirm(e.target.value)}
                    error={!!pwConfirm && pwNueva !== pwConfirm}
                    helperText={pwConfirm && pwNueva !== pwConfirm ? 'Las contraseñas no coinciden' : ''}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={pwSaving ? <CircularProgress size={16} color="inherit" /> : <LockIcon />}
                  onClick={handleChangePassword}
                  disabled={pwSaving}
                >
                  Cambiar contraseña y cerrar sesión
                </Button>
              </Box>
            </CardContent>
          </Card>

        </Grid>
      </Grid>
    </Container>
  )
}
