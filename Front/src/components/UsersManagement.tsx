import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import SearchIcon from '@mui/icons-material/Search'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import KeyIcon from '@mui/icons-material/Key'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import type { User, UserRole, UserEstado } from '../types'
import { authService } from '../services/authService'
import ConfirmDialog from './ConfirmDialog'

const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  repartidor: 'Repartidor',
}

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  administrador: { bg: '#EDE7F6', color: '#4527A0' },
  supervisor: { bg: '#FFEBEE', color: '#B71C1C' },
  operador: { bg: '#E3F2FD', color: '#0D47A1' },
  repartidor: { bg: '#E8F5E9', color: '#1B5E20' },
}

type RoleFilter = UserRole | 'all'
type EstadoFilter = 'all' | 'active' | 'inactive'

interface PendingReset {
  email: string
  requestedAt: string
  status: 'pending'
}

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Prioriza `activo` (soft-delete flag del back). Si no viene, usa `estado` como fallback.
function isActive(user?: { activo?: boolean; estado?: string }): boolean {
  if (!user) return false
  if (user.activo === false) return false
  if (user.activo === true) return true
  return !user.estado || user.estado === 'Activo'
}

function EstadoChip({ activo, estado }: { activo?: boolean; estado?: string }) {
  if (isActive({ activo, estado })) {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
        label="Activo"
        size="small"
        sx={{ bgcolor: '#E8F5E9', color: '#1B5E20', fontWeight: 700, fontSize: '0.7rem', '& .MuiChip-icon': { color: '#1B5E20' } }}
      />
    )
  }
  const label = estado === 'Inactivo' ? 'Inactivo' : (estado ?? 'Inactivo')
  return (
    <Chip
      icon={<BlockIcon sx={{ fontSize: 14 }} />}
      label={label}
      size="small"
      sx={{ bgcolor: '#FFEBEE', color: '#B71C1C', fontWeight: 700, fontSize: '0.7rem', '& .MuiChip-icon': { color: '#B71C1C' } }}
    />
  )
}

function RoleChip({ role }: { role: UserRole }) {
  const cfg = ROLE_COLORS[role] ?? { bg: '#F5F5F5', color: '#555' }
  return (
    <Chip
      label={ROLE_LABELS[role] ?? role}
      size="small"
      sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, fontSize: '0.7rem' }}
    />
  )
}

const emptyForm = {
  name: '',
  lastname: '',
  email: '',
  dni: '',
  role: 'operador' as UserRole,
  licencia: '',
  passwordTemporal: '',
}

interface UsersManagementProps {
  currentUserId?: string
}

export default function UsersManagement({ currentUserId }: UsersManagementProps = {}) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('all')

  const [openCreate, setOpenCreate] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openConfirmToggle, setOpenConfirmToggle] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const [formData, setFormData] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [showCreatePassword, setShowCreatePassword] = useState(false)

  // Reset password desde el diálogo de edición
  const [showResetSection, setShowResetSection] = useState(false)
  const [resetPassValue, setResetPassValue] = useState('')
  const [showResetPassValue, setShowResetPassValue] = useState(false)
  const [resetPassSubmitting, setResetPassSubmitting] = useState(false)

  // Solicitudes pendientes de restablecimiento de contraseña
  const [pendingResets, setPendingResets] = useState<PendingReset[]>([])
  const [openResolvePending, setOpenResolvePending] = useState(false)
  const [pendingResetEmail, setPendingResetEmail] = useState('')
  const [resolvePassValue, setResolvePassValue] = useState('')
  const [showResolvePassValue, setShowResolvePassValue] = useState(false)
  const [resolveSubmitting, setResolveSubmitting] = useState(false)

  const [toast, setToast] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error' | 'info' | 'warning'
  }>({ open: false, message: '', severity: 'success' })

  const showToast = (message: string, severity: typeof toast.severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  const loadPendingResets = () => {
    const stored: PendingReset[] = JSON.parse(localStorage.getItem('passwordResetRequests') || '[]')
    setPendingResets(stored)
  }

  useEffect(() => {
    loadUsers()
    loadPendingResets()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await authService.getUsuarios()
      setUsers(data)
    } catch {
      setError('Error al cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = normalize(search.trim())
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (estadoFilter === 'active' && !isActive(u)) return false
      if (estadoFilter === 'inactive' && isActive(u)) return false
      if (!q) return true
      return (
        normalize(`${u.name} ${u.lastname}`).includes(q) ||
        normalize(u.email).includes(q) ||
        normalize(u.dni).includes(q) ||
        normalize(ROLE_LABELS[u.role] ?? u.role).includes(q)
      )
    })
  }, [users, search, roleFilter, estadoFilter])

  // ── Create ──────────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setFormData(emptyForm)
    setFormError('')
    setShowCreatePassword(false)
    setOpenCreate(true)
  }

  const handleCreate = async () => {
    if (!validateForm(true)) return
    setSubmitting(true)
    try {
      const result = await authService.createUsuario({
        name: formData.name.trim(),
        lastname: formData.lastname.trim(),
        email: formData.email.trim(),
        dni: formData.dni.trim(),
        role: formData.role,
        passwordTemporal: formData.passwordTemporal.trim(),
        ...(formData.role === 'repartidor' && formData.licencia ? { licencia: formData.licencia.trim() } : {}),
      })
      await loadUsers()
      setOpenCreate(false)
      showToast(
        `Usuario creado. Email: ${result.user.email} · Contraseña temporal: ${formData.passwordTemporal.trim()}`,
        'success',
      )
    } catch (err: any) {
      setFormError(err?.message ?? 'Error al crear el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  const handleOpenEdit = (user: User) => {
    setSelectedUser(user)
    setFormData({
      name: user.name,
      lastname: user.lastname,
      email: user.email,
      dni: user.dni,
      role: user.role,
      licencia: user.licencia ?? '',
      passwordTemporal: '',
    })
    setFormError('')
    setShowResetSection(false)
    setResetPassValue('')
    setShowResetPassValue(false)
    setOpenEdit(true)
  }

  const handleEdit = async () => {
    if (!selectedUser) return
    if (!validateForm(false)) return
    setSubmitting(true)
    try {
      const updated = await authService.updateUsuario(selectedUser.id, {
        name: formData.name.trim(),
        lastname: formData.lastname.trim(),
        email: formData.email.trim(),
        dni: formData.dni.trim(),
      })
      if (updated) {
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)))
      }
      setOpenEdit(false)
      showToast('Usuario actualizado correctamente', 'success')
    } catch (err: any) {
      setFormError(err?.message ?? 'Error al actualizar el usuario')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Reset Password (desde edición) ──────────────────────────────────────────

  const handleResetPassword = async () => {
    if (!selectedUser || !resetPassValue.trim()) {
      showToast('Ingresá una contraseña temporal.', 'warning')
      return
    }
    setResetPassSubmitting(true)
    const result = await authService.resetPassword(selectedUser.id, resetPassValue.trim())
    setResetPassSubmitting(false)
    if (result.success) {
      setOpenEdit(false)
      setShowResetSection(false)
      setResetPassValue('')
      showToast(
        `Contraseña reseteada para ${selectedUser.name} ${selectedUser.lastname}. Contraseña temporal: ${resetPassValue.trim()}`,
        'success',
      )
    } else {
      showToast(result.error ?? 'Error al resetear la contraseña', 'error')
    }
  }

  // ── Toggle estado ────────────────────────────────────────────────────────────

  const handleOpenToggle = (user: User) => {
    // Guard: no permitir desactivarse a uno mismo
    if (currentUserId && user.id === currentUserId) {
      showToast('No podés desactivar tu propia cuenta de administrador.', 'warning')
      return
    }
    setSelectedUser(user)
    setOpenConfirmToggle(true)
  }

  const handleToggleEstado = async () => {
    if (!selectedUser) return
    const nuevoEstado: UserEstado = isActive(selectedUser) ? 'Inactivo' : 'Activo'
    setSubmitting(true)
    const ok = await authService.updateUsuarioEstado(selectedUser.id, nuevoEstado)
    setSubmitting(false)
    setOpenConfirmToggle(false)
    if (ok) {
      // Actualizar tanto el flag `activo` (soft-delete) como `estado` para reflejar al instante
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUser.id
            ? { ...u, estado: nuevoEstado, activo: nuevoEstado === 'Activo' }
            : u,
        ),
      )
      showToast(
        `Usuario ${nuevoEstado === 'Inactivo' ? 'desactivado' : 'activado'} correctamente`,
        nuevoEstado === 'Inactivo' ? 'warning' : 'success',
      )
    } else {
      showToast('No se pudo cambiar el estado del usuario', 'error')
    }
  }

  // ── Resolver solicitud pendiente de reseteo ──────────────────────────────────

  const handleOpenResolvePending = (email: string) => {
    setPendingResetEmail(email)
    setResolvePassValue('')
    setShowResolvePassValue(false)
    setOpenResolvePending(true)
  }

  const handleResolvePending = async () => {
    if (!resolvePassValue.trim()) {
      showToast('Ingresá una contraseña temporal.', 'warning')
      return
    }
    const foundUser = users.find((u) => u.email.toLowerCase() === pendingResetEmail.toLowerCase())
    if (!foundUser) {
      showToast('No se encontró un usuario con ese email en el sistema.', 'error')
      return
    }
    setResolveSubmitting(true)
    const result = await authService.resetPassword(foundUser.id, resolvePassValue.trim())
    setResolveSubmitting(false)
    if (result.success) {
      const stored: PendingReset[] = JSON.parse(localStorage.getItem('passwordResetRequests') || '[]')
      const updated = stored.filter((r) => r.email.toLowerCase() !== pendingResetEmail.toLowerCase())
      localStorage.setItem('passwordResetRequests', JSON.stringify(updated))
      loadPendingResets()
      setOpenResolvePending(false)
      showToast(
        `Contraseña asignada a ${foundUser.name} ${foundUser.lastname}. Contraseña temporal: ${resolvePassValue.trim()}`,
        'success',
      )
    } else {
      showToast(result.error ?? 'Error al resetear la contraseña', 'error')
    }
  }

  // ── Validación ───────────────────────────────────────────────────────────────

  const nameRegex = /^[A-Za-zÀ-ÿ\s'-]+$/

  const validateForm = (isCreate: boolean): boolean => {
    if (!formData.name.trim() || !formData.lastname.trim() || !formData.email.trim() || !formData.dni.trim()) {
      setFormError('Completá todos los campos obligatorios.')
      return false
    }
    if (!nameRegex.test(formData.name.trim()) || !nameRegex.test(formData.lastname.trim())) {
      setFormError('Nombre y apellido solo pueden contener letras.')
      return false
    }
    if (!authService.isValidEmail(formData.email.trim())) {
      setFormError('Ingresá un email válido.')
      return false
    }
    if (!/^\d{8}$/.test(formData.dni.trim())) {
      setFormError('El DNI debe tener exactamente 8 dígitos.')
      return false
    }
    if (isCreate) {
      if (!formData.passwordTemporal.trim()) {
        setFormError('La contraseña temporal es obligatoria.')
        return false
      }
      if (formData.passwordTemporal.trim().length < 8) {
        setFormError('La contraseña temporal debe tener al menos 8 caracteres.')
        return false
      }
      if (formData.role === 'repartidor' && !formData.licencia.trim()) {
        setFormError('La licencia es obligatoria para repartidores.')
        return false
      }
    }
    setFormError('')
    return true
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeCount = users.filter((u) => isActive(u)).length
  const inactiveCount = users.length - activeCount

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" component="span">Equipo</Typography>
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {filtered.length !== users.length
              ? `${filtered.length} de ${users.length} integrantes`
              : `${users.length} ${users.length === 1 ? 'integrante' : 'integrantes'}`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
          Nuevo usuario
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Solicitudes pendientes de restablecimiento */}
      {pendingResets.length > 0 && (
        <Paper
          variant="outlined"
          sx={{ borderRadius: 2, mb: 3, overflow: 'hidden', borderColor: '#F57C00' }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, bgcolor: '#FFF3E0' }}>
            <NotificationsActiveIcon sx={{ color: '#F57C00', fontSize: 20 }} />
            <Typography variant="subtitle2" sx={{ color: '#E65100', fontWeight: 700 }}>
              Solicitudes de restablecimiento de contraseña ({pendingResets.length})
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#FFF8F0', fontSize: '0.75rem' } }}>
                <TableCell>Email</TableCell>
                <TableCell>Fecha de solicitud</TableCell>
                <TableCell align="center">Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pendingResets.map((req) => (
                <TableRow key={req.email} sx={{ '&:last-child td': { border: 0 } }}>
                  <TableCell>
                    <Typography variant="body2">{req.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                      {new Date(req.requestedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<KeyIcon sx={{ fontSize: 14 }} />}
                      onClick={() => handleOpenResolvePending(req.email)}
                      sx={{ fontSize: '0.72rem', py: 0.3, px: 1 }}
                    >
                      Asignar contraseña
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Search + filters */}
      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
        <TextField
          placeholder="Buscar por nombre, email, DNI o rol…"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 380 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <ToggleButtonGroup
            value={roleFilter}
            exclusive
            onChange={(_e, v: RoleFilter | null) => { if (v !== null) setRoleFilter(v) }}
            size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: '0.75rem', textTransform: 'none', fontWeight: 600 } }}
          >
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton
              value="supervisor"
              sx={{ color: '#7c4010', bgcolor: '#fff8f1', '&:hover': { bgcolor: '#ffeedd' }, '&.Mui-selected': { color: '#BF360C', bgcolor: '#FFE0B2', borderColor: '#FFCC80' }, '&.Mui-selected:hover': { bgcolor: '#ffd494' } }}
            >
              Supervisores
            </ToggleButton>
            <ToggleButton
              value="operador"
              sx={{ color: '#4a1a7a', bgcolor: '#f8f2ff', '&:hover': { bgcolor: '#efe2ff' }, '&.Mui-selected': { color: '#6A1B9A', bgcolor: '#E1BEE7', borderColor: '#CE93D8' }, '&.Mui-selected:hover': { bgcolor: '#d4a8e0' } }}
            >
              Operadores
            </ToggleButton>
            <ToggleButton
              value="repartidor"
              sx={{ color: '#8c1a4a', bgcolor: '#fff2f7', '&:hover': { bgcolor: '#ffe0ee' }, '&.Mui-selected': { color: '#AD1457', bgcolor: '#F8BBD0', borderColor: '#F48FB1' }, '&.Mui-selected:hover': { bgcolor: '#f5a3c0' } }}
            >
              Repartidores
            </ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={estadoFilter}
            exclusive
            onChange={(_e, v: EstadoFilter | null) => { if (v !== null) setEstadoFilter(v) }}
            size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: '0.75rem', textTransform: 'none', fontWeight: 600 } }}
          >
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton
              value="active"
              sx={{ '&.Mui-selected': { color: '#1B5E20', bgcolor: '#E8F5E9', '&:hover': { bgcolor: '#C8E6C9' } } }}
            >
              Activos ({activeCount})
            </ToggleButton>
            <ToggleButton
              value="inactive"
              sx={{ '&.Mui-selected': { color: '#B71C1C', bgcolor: '#FFEBEE', '&:hover': { bgcolor: '#FFCDD2' } } }}
            >
              Inactivos ({inactiveCount})
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : filtered.length === 0 ? (
        <Alert severity="info">
          {search || roleFilter !== 'all' || estadoFilter !== 'all'
            ? 'No se encontraron usuarios con los filtros aplicados.'
            : 'No hay usuarios registrados.'}
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#F5F7FA', fontSize: '0.78rem' } }}>
                <TableCell>Integrante</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>DNI</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((user) => {
                const initials = `${user.name.charAt(0)}${user.lastname.charAt(0)}`.toUpperCase()
                const active = isActive(user)
                const roleColor = ROLE_COLORS[user.role] ?? { color: '#555' }
                return (
                  <TableRow
                    key={user.id}
                    sx={{
                      opacity: active ? 1 : 0.6,
                      '&:last-child td': { border: 0 },
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{ width: 32, height: 32, fontSize: '0.75rem', fontWeight: 700, bgcolor: roleColor.color }}
                        >
                          {initials}
                        </Avatar>
                        <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                          {user.name} {user.lastname}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{user.dni}</Typography>
                    </TableCell>
                    <TableCell><RoleChip role={user.role} /></TableCell>
                    <TableCell><EstadoChip activo={user.activo} estado={user.estado} /></TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        <Tooltip title="Editar datos">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleOpenEdit(user)}
                              sx={{ fontSize: '0.72rem', py: 0.3, px: 1 }}
                            >
                              Editar
                            </Button>
                          </span>
                        </Tooltip>
                        {(() => {
                          const isSelf = !!currentUserId && user.id === currentUserId
                          const tooltip = isSelf
                            ? 'No podés desactivar tu propia cuenta'
                            : active
                              ? 'Desactivar usuario'
                              : 'Activar usuario'
                          return (
                            <Tooltip title={tooltip}>
                              <span>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  color={active ? 'error' : 'success'}
                                  disabled={isSelf}
                                  startIcon={
                                    active
                                      ? <BlockIcon sx={{ fontSize: 14 }} />
                                      : <CheckCircleIcon sx={{ fontSize: 14 }} />
                                  }
                                  onClick={() => handleOpenToggle(user)}
                                  sx={{ fontSize: '0.72rem', py: 0.3, px: 1 }}
                                >
                                  {active ? 'Desactivar' : 'Activar'}
                                </Button>
                              </span>
                            </Tooltip>
                          )
                        })()}
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Diálogo: Crear usuario */}
      <Dialog open={openCreate} onClose={() => !submitting && setOpenCreate(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Nuevo usuario</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Nombre *"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '') }))}
                fullWidth
              />
              <TextField
                label="Apellido *"
                value={formData.lastname}
                onChange={(e) => setFormData((p) => ({ ...p, lastname: e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '') }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              fullWidth
            />
            <TextField
              label="DNI *"
              value={formData.dni}
              inputProps={{ maxLength: 8 }}
              onChange={(e) => setFormData((p) => ({ ...p, dni: e.target.value.replace(/\D/g, '') }))}
              fullWidth
              helperText="8 dígitos"
            />
            <FormControl fullWidth>
              <InputLabel>Rol *</InputLabel>
              <Select
                label="Rol *"
                value={formData.role}
                onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as UserRole }))}
              >
                <MenuItem value="administrador">Administrador</MenuItem>
                <MenuItem value="supervisor">Supervisor</MenuItem>
                <MenuItem value="operador">Operador</MenuItem>
                <MenuItem value="repartidor">Repartidor</MenuItem>
              </Select>
            </FormControl>
            {formData.role === 'repartidor' && (
              <TextField
                label="Licencia *"
                value={formData.licencia}
                onChange={(e) => setFormData((p) => ({ ...p, licencia: e.target.value }))}
                fullWidth
              />
            )}
            <TextField
              label="Contraseña Temporal *"
              type={showCreatePassword ? 'text' : 'password'}
              value={formData.passwordTemporal}
              onChange={(e) => setFormData((p) => ({ ...p, passwordTemporal: e.target.value }))}
              fullWidth
              helperText="Mínimo 8 caracteres. El usuario deberá cambiarla al ingresar."
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowCreatePassword((p) => !p)}
                      edge="end"
                      size="small"
                    >
                      {showCreatePassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleCreate} variant="contained" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Crear usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Editar usuario */}
      <Dialog
        open={openEdit}
        onClose={() => !submitting && !resetPassSubmitting && setOpenEdit(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Editar usuario</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Nombre *"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '') }))}
                fullWidth
              />
              <TextField
                label="Apellido *"
                value={formData.lastname}
                onChange={(e) => setFormData((p) => ({ ...p, lastname: e.target.value.replace(/[^A-Za-zÀ-ÿ\s'-]/g, '') }))}
                fullWidth
              />
            </Stack>
            <TextField
              label="Email *"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              fullWidth
            />
            <TextField
              label="DNI *"
              value={formData.dni}
              inputProps={{ maxLength: 8 }}
              onChange={(e) => setFormData((p) => ({ ...p, dni: e.target.value.replace(/\D/g, '') }))}
              fullWidth
              helperText="8 dígitos"
            />
            <Box sx={{ p: 1.5, bgcolor: '#F5F7FA', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Rol actual: <strong>{ROLE_LABELS[selectedUser?.role ?? 'operador']}</strong> — el rol no se puede modificar desde este panel.
              </Typography>
            </Box>

            {/* Sección: Reseteo de contraseña de emergencia */}
            <Box>
              <Button
                size="small"
                variant={showResetSection ? 'contained' : 'outlined'}
                color="warning"
                startIcon={<KeyIcon sx={{ fontSize: 14 }} />}
                onClick={() => {
                  setShowResetSection((p) => !p)
                  setResetPassValue('')
                  setShowResetPassValue(false)
                }}
                sx={{ fontSize: '0.78rem' }}
              >
                {showResetSection ? 'Cancelar reseteo' : 'Asignar contraseña temporal'}
              </Button>
              <Collapse in={showResetSection}>
                <Box sx={{ mt: 1.5, p: 2, bgcolor: '#FFF8E1', borderRadius: 1, border: '1px solid #FFD54F' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                    Ingresá la nueva contraseña temporal. La contraseña actual del usuario será reemplazada.
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <TextField
                      label="Nueva contraseña temporal"
                      type={showResetPassValue ? 'text' : 'password'}
                      value={resetPassValue}
                      onChange={(e) => setResetPassValue(e.target.value)}
                      size="small"
                      fullWidth
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowResetPassValue((p) => !p)}
                              edge="end"
                              size="small"
                            >
                              {showResetPassValue ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                    <Button
                      variant="contained"
                      color="warning"
                      onClick={handleResetPassword}
                      disabled={resetPassSubmitting || !resetPassValue.trim()}
                      sx={{ whiteSpace: 'nowrap', minWidth: 'auto', py: '7px' }}
                    >
                      {resetPassSubmitting
                        ? <CircularProgress size={16} color="inherit" />
                        : 'Guardar'}
                    </Button>
                  </Stack>
                </Box>
              </Collapse>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)} disabled={submitting || resetPassSubmitting}>Cancelar</Button>
          <Button onClick={handleEdit} variant="contained" disabled={submitting || resetPassSubmitting}>
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo: Resolver solicitud pendiente */}
      <Dialog
        open={openResolvePending}
        onClose={() => !resolveSubmitting && setOpenResolvePending(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon color="warning" />
          Asignar contraseña temporal
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
              El usuario <strong>{pendingResetEmail}</strong> solicitó un restablecimiento de contraseña.
            </Alert>
            <TextField
              label="Nueva contraseña temporal"
              type={showResolvePassValue ? 'text' : 'password'}
              value={resolvePassValue}
              onChange={(e) => setResolvePassValue(e.target.value)}
              fullWidth
              autoFocus
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowResolvePassValue((p) => !p)}
                      edge="end"
                      size="small"
                    >
                      {showResolvePassValue ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenResolvePending(false)} disabled={resolveSubmitting}>Cancelar</Button>
          <Button
            onClick={handleResolvePending}
            variant="contained"
            color="warning"
            disabled={resolveSubmitting || !resolvePassValue.trim()}
          >
            {resolveSubmitting ? 'Guardando…' : 'Asignar contraseña'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmar cambio de estado */}
      <ConfirmDialog
        open={openConfirmToggle}
        title={isActive(selectedUser ?? undefined) ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          isActive(selectedUser ?? undefined)
            ? `¿Estás segura de que querés desactivar a ${selectedUser?.name} ${selectedUser?.lastname}? El historial de envíos y rutas no se verá afectado.`
            : `¿Querés volver a activar a ${selectedUser?.name} ${selectedUser?.lastname}?`
        }
        confirmLabel={isActive(selectedUser ?? undefined) ? 'Desactivar' : 'Activar'}
        confirmColor={isActive(selectedUser ?? undefined) ? 'error' : 'success'}
        onConfirm={handleToggleEstado}
        onCancel={() => setOpenConfirmToggle(false)}
      />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((p) => ({ ...p, open: false }))}
          sx={{ width: '100%' }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
