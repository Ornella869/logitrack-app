import { useState, useEffect, useMemo } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
import type { User, UserRole, UserEstado } from '../types'
import { authService } from '../services/authService'
import ConfirmDialog from './ConfirmDialog'

const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  transportista: 'Transportista',
}

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  administrador: { bg: '#EDE7F6', color: '#4527A0' },
  supervisor: { bg: '#FFEBEE', color: '#B71C1C' },
  operador: { bg: '#E3F2FD', color: '#0D47A1' },
  transportista: { bg: '#E8F5E9', color: '#1B5E20' },
}

type RoleFilter = UserRole | 'all'
type EstadoFilter = 'all' | 'active' | 'inactive'

function normalize(str: string): string {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function isActive(estado?: string): boolean {
  return !estado || estado === 'Activo'
}

function EstadoChip({ estado }: { estado?: string }) {
  if (isActive(estado)) {
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

const emptyForm = { name: '', lastname: '', email: '', dni: '', role: 'operador' as UserRole, licencia: '' }

export default function UsersManagement() {
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

  const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({
    open: false, message: '', severity: 'success',
  })

  const showToast = (message: string, severity: typeof toast.severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  useEffect(() => { loadUsers() }, [])

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
      if (estadoFilter === 'active' && !isActive(u.estado)) return false
      if (estadoFilter === 'inactive' && isActive(u.estado)) return false
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
    setOpenCreate(true)
  }

  const handleCreate = async () => {
    if (!validateForm()) return
    setSubmitting(true)
    try {
      const result = await authService.createUsuario({
        name: formData.name.trim(),
        lastname: formData.lastname.trim(),
        email: formData.email.trim(),
        dni: formData.dni.trim(),
        role: formData.role,
        ...(formData.role === 'transportista' && formData.licencia ? { licencia: formData.licencia.trim() } : {}),
      })
      await loadUsers()
      setOpenCreate(false)
      showToast(
        `Usuario creado. Email: ${result.user.email}${result.temporaryPassword ? ` · Contraseña temporal: ${result.temporaryPassword}` : ''}`,
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
    setFormData({ name: user.name, lastname: user.lastname, email: user.email, dni: user.dni, role: user.role, licencia: user.licencia ?? '' })
    setFormError('')
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

  // ── Toggle estado ────────────────────────────────────────────────────────────

  const handleOpenToggle = (user: User) => {
    setSelectedUser(user)
    setOpenConfirmToggle(true)
  }

  const handleToggleEstado = async () => {
    if (!selectedUser) return
    const nuevoEstado: UserEstado = isActive(selectedUser.estado) ? 'Inactivo' : 'Activo'
    setSubmitting(true)
    const ok = await authService.updateUsuarioEstado(selectedUser.id, nuevoEstado)
    setSubmitting(false)
    setOpenConfirmToggle(false)
    if (ok) {
      setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, estado: nuevoEstado } : u)))
      showToast(
        `Usuario ${nuevoEstado === 'Inactivo' ? 'desactivado' : 'activado'} correctamente`,
        nuevoEstado === 'Inactivo' ? 'warning' : 'success',
      )
    } else {
      showToast('No se pudo cambiar el estado del usuario', 'error')
    }
  }

  // ── Validation ───────────────────────────────────────────────────────────────

  const nameRegex = /^[A-Za-zÀ-ÿ\s'-]+$/

  const validateForm = (checkRole = true): boolean => {
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
    if (checkRole && formData.role === 'transportista' && !formData.licencia.trim()) {
      setFormError('La licencia es obligatoria para transportistas.')
      return false
    }
    setFormError('')
    return true
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const activeCount = users.filter((u) => isActive(u.estado)).length
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
          {/* Role filter */}
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
              sx={{
                color: '#7c4010',
                bgcolor: '#fff8f1',
                '&:hover': { bgcolor: '#ffeedd' },
                '&.Mui-selected': { color: '#BF360C', bgcolor: '#FFE0B2', borderColor: '#FFCC80' },
                '&.Mui-selected:hover': { bgcolor: '#ffd494' },
              }}
            >
              Supervisores
            </ToggleButton>
            <ToggleButton
              value="operador"
              sx={{
                color: '#4a1a7a',
                bgcolor: '#f8f2ff',
                '&:hover': { bgcolor: '#efe2ff' },
                '&.Mui-selected': { color: '#6A1B9A', bgcolor: '#E1BEE7', borderColor: '#CE93D8' },
                '&.Mui-selected:hover': { bgcolor: '#d4a8e0' },
              }}
            >
              Operadores
            </ToggleButton>
            <ToggleButton
              value="transportista"
              sx={{
                color: '#8c1a4a',
                bgcolor: '#fff2f7',
                '&:hover': { bgcolor: '#ffe0ee' },
                '&.Mui-selected': { color: '#AD1457', bgcolor: '#F8BBD0', borderColor: '#F48FB1' },
                '&.Mui-selected:hover': { bgcolor: '#f5a3c0' },
              }}
            >
              Repartidores
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Estado filter */}
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
                const active = isActive(user.estado)
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
                          sx={{
                            width: 32,
                            height: 32,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            bgcolor: roleColor.color,
                          }}
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
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                        {user.dni}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <RoleChip role={user.role} />
                    </TableCell>
                    <TableCell>
                      <EstadoChip estado={user.estado} />
                    </TableCell>
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
                        <Tooltip title={active ? 'Desactivar usuario' : 'Activar usuario'}>
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              color={active ? 'error' : 'success'}
                              startIcon={active ? <BlockIcon sx={{ fontSize: 14 }} /> : <CheckCircleIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleOpenToggle(user)}
                              sx={{ fontSize: '0.72rem', py: 0.3, px: 1 }}
                            >
                              {active ? 'Desactivar' : 'Activar'}
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create dialog */}
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
                <MenuItem value="transportista">Transportista</MenuItem>
              </Select>
            </FormControl>
            {formData.role === 'transportista' && (
              <TextField
                label="Licencia *"
                value={formData.licencia}
                onChange={(e) => setFormData((p) => ({ ...p, licencia: e.target.value }))}
                fullWidth
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreate(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleCreate} variant="contained" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Crear usuario'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={openEdit} onClose={() => !submitting && setOpenEdit(false)} maxWidth="sm" fullWidth>
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleEdit} variant="contained" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm toggle dialog */}
      <ConfirmDialog
        open={openConfirmToggle}
        title={isActive(selectedUser?.estado) ? 'Desactivar usuario' : 'Activar usuario'}
        message={
          isActive(selectedUser?.estado)
            ? `¿Estás segura de que querés desactivar a ${selectedUser?.name} ${selectedUser?.lastname}? El historial de envíos y rutas no se verá afectado.`
            : `¿Querés volver a activar a ${selectedUser?.name} ${selectedUser?.lastname}?`
        }
        confirmLabel={isActive(selectedUser?.estado) ? 'Desactivar' : 'Activar'}
        confirmColor={isActive(selectedUser?.estado) ? 'error' : 'success'}
        onConfirm={handleToggleEstado}
        onCancel={() => setOpenConfirmToggle(false)}
      />

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
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
