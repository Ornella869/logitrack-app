import { useState, useEffect } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
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
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
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
import CasinoIcon from '@mui/icons-material/Casino'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { generateTempPassword } from '../utils/passwordGenerator'
import type { User, UserRole, UserEstado, Branch } from '../types'
import { authService } from '../services/authService'
import { branchService } from '../services/branchService'
import { AR_PROVINCIAS } from '../utils/provincias'
import { formatInstantArgentina } from '../utils/argentinaDate'
import ConfirmDialog from './ConfirmDialog'

const ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  operador: 'Operador',
  repartidor: 'Repartidor',
  cliente: 'Cliente Portal',
}

const ROLE_COLORS: Record<UserRole, { bg: string; color: string }> = {
  administrador: { bg: '#EDE7F6', color: '#4527A0' },
  gerente: { bg: '#FFF3E0', color: '#E65100' },
  supervisor: { bg: '#FFEBEE', color: '#B71C1C' },
  operador: { bg: '#E3F2FD', color: '#0D47A1' },
  repartidor: { bg: '#E8F5E9', color: '#1B5E20' },
  cliente: { bg: '#E0F7FA', color: '#006064' },
}

const ROLE_COLORS_DARK: Record<UserRole, { bg: string; color: string }> = {
  administrador: { bg: 'rgba(69,39,160,0.25)', color: '#CE93D8' },
  gerente: { bg: 'rgba(230,81,0,0.25)', color: '#FFB74D' },
  supervisor: { bg: 'rgba(183,28,28,0.25)', color: '#EF9A9A' },
  operador: { bg: 'rgba(13,71,161,0.25)', color: '#90CAF9' },
  repartidor: { bg: 'rgba(27,94,32,0.25)', color: '#A5D6A7' },
  cliente: { bg: 'rgba(0,96,100,0.25)', color: '#80DEEA' },
}

type RoleFilter = UserRole | 'all'
type EstadoFilter = 'all' | 'active' | 'inactive'

interface PendingReset {
  email: string
  requestedAt: string
  status: 'pending'
}

function splitProvinces(value?: string | null): string[] {
  return value
    ? value.split(',').map((part) => part.trim()).filter(Boolean)
    : []
}

// Prioriza `activo` (soft-delete flag del back). Si no viene, usa `estado` como fallback.
function isActive(user?: { activo?: boolean; estado?: string }): boolean {
  if (!user) return false
  if (user.activo === false) return false
  if (user.activo === true) return true
  return !user.estado || user.estado === 'Activo'
}

function EstadoChip({ activo, estado }: { activo?: boolean; estado?: string }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  if (isActive({ activo, estado })) {
    return (
      <Chip
        icon={<CheckCircleIcon sx={{ fontSize: 14 }} />}
        label="Activo"
        size="small"
        sx={{
          bgcolor: isDark ? 'rgba(27,94,32,0.25)' : '#E8F5E9',
          color: isDark ? '#A5D6A7' : '#1B5E20',
          fontWeight: 700, fontSize: '0.7rem',
          '& .MuiChip-icon': { color: isDark ? '#A5D6A7' : '#1B5E20' },
        }}
      />
    )
  }
  const label = estado === 'Inactivo' ? 'Inactivo' : (estado ?? 'Inactivo')
  return (
    <Chip
      icon={<BlockIcon sx={{ fontSize: 14 }} />}
      label={label}
      size="small"
      sx={{
        bgcolor: isDark ? 'rgba(183,28,28,0.25)' : '#FFEBEE',
        color: isDark ? '#EF9A9A' : '#B71C1C',
        fontWeight: 700, fontSize: '0.7rem',
        '& .MuiChip-icon': { color: isDark ? '#EF9A9A' : '#B71C1C' },
      }}
    />
  )
}

function RoleChip({ role }: { role: UserRole }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const cfg = (isDark ? ROLE_COLORS_DARK[role] : ROLE_COLORS[role]) ?? { bg: isDark ? 'rgba(255,255,255,0.1)' : '#F5F5F5', color: isDark ? 'rgba(255,255,255,0.7)' : '#555' }
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
  // Épica D: vínculo de ámbito.
  sucursalId: '',
  provincia: '',
}

interface UsersManagementProps {
  currentUserId?: string
}

export default function UsersManagement({ currentUserId }: UsersManagementProps = {}) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [users, setUsers] = useState<User[]>([])
  const [provinceOwners, setProvinceOwners] = useState<User[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void branchService.getAllBranches().then(setBranches).catch(() => setBranches([]))
  }, [])

  useEffect(() => {
    void authService.getUsuarios()
      .then((result) => setProvinceOwners(result.filter((user) => user.role === 'gerente' && user.activo !== false)))
      .catch(() => setProvinceOwners([]))
  }, [])

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>('all')
  const [sucursalFilter, setSucursalFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  const [openCreate, setOpenCreate] = useState(false)
  const [openEdit, setOpenEdit] = useState(false)
  const [openConfirmToggle, setOpenConfirmToggle] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  const [formData, setFormData] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [showCreatePassword, setShowCreatePassword] = useState(false)
  const [createProvinceOpen, setCreateProvinceOpen] = useState(false)

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

  const handleCopyEmail = (email: string) => {
    void navigator.clipboard.writeText(email).then(() => {
      showToast('Email copiado al portapapeles', 'info')
    })
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [openBulkConfirm, setOpenBulkConfirm] = useState(false)

  const showToast = (message: string, severity: typeof toast.severity = 'success') => {
    setToast({ open: true, message, severity })
  }

  const loadPendingResets = () => {
    const stored: PendingReset[] = JSON.parse(localStorage.getItem('passwordResetRequests') || '[]')
    setPendingResets(stored)
  }

  useEffect(() => {
    void loadUsers()
    loadPendingResets()
  }, [page, pageSize, search, roleFilter, estadoFilter, sucursalFilter])

  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, pageSize, search, roleFilter, estadoFilter, sucursalFilter])

  const loadUsers = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await authService.getUsuariosPage({
        page,
        pageSize,
        search: search.trim() || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        active: estadoFilter === 'all' ? undefined : estadoFilter === 'active',
        sucursalId: sucursalFilter === 'all' ? undefined : sucursalFilter,
      })
      setUsers(result.items)
      setTotalItems(result.totalItems)
    } catch {
      setError('Error al cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }

  const findProvinceOwner = (province: string, excludedUserId?: string) => {
    const normalizedProvince = province.trim().toLowerCase()
    return provinceOwners.find((user) => {
      if (excludedUserId && user.id === excludedUserId) return false
      const assigned = splitProvinces(user.provincias?.join(', ') ?? user.provincia)
      return assigned.some((assignedProvince) => assignedProvince.toLowerCase() === normalizedProvince)
    })
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  const handleOpenCreate = () => {
    setFormData(emptyForm)
    setFormError('')
    setShowCreatePassword(false)
    setOpenCreate(true)
  }

  const handleCreate = async () => {
    if (!validateForm(true)) return

    // Multiple provinces allowed — no single-province uniqueness check

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
        // Épica D: gerente lleva provincia; los demás roles operativos llevan sucursal.
        ...(formData.role === 'gerente' && formData.provincia ? { provincia: formData.provincia } : {}),
        ...(formData.role !== 'gerente' && formData.role !== 'administrador' && formData.sucursalId ? { sucursalId: formData.sucursalId } : {}),
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
      sucursalId: user.sucursalId ?? '',
      provincia: user.provincias && user.provincias.length > 0 ? user.provincias.join(', ') : (user.provincia ?? ''),
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
      if (selectedUser.role === 'gerente' && formData.provincia) {
        const provincias = formData.provincia.split(',').map((s) => s.trim()).filter(Boolean)
        if (provincias.length > 0) await authService.assignProvincias(selectedUser.id, provincias)
      }
      if (updated) {
        await loadUsers()
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
      showToast(
        `Usuario ${nuevoEstado === 'Inactivo' ? 'desactivado' : 'activado'} correctamente`,
        nuevoEstado === 'Inactivo' ? 'warning' : 'success',
      )
      void loadUsers()
    } else {
      showToast('No se pudo cambiar el estado del usuario', 'error')
    }
  }

  // ── Bulk toggle estado ───────────────────────────────────────────────────────

  const handleBulkToggle = async () => {
    const selectedUsers = users.filter((u) => selectedIds.has(u.id))
    const toDeactivate = selectedUsers.filter((u) => isActive(u))
    const toActivate = selectedUsers.filter((u) => !isActive(u))
    setSubmitting(true)
    try {
      await Promise.all([
        ...toDeactivate.map((u) => authService.updateUsuarioEstado(u.id, 'Inactivo')),
        ...toActivate.map((u) => authService.updateUsuarioEstado(u.id, 'Activo')),
      ])
      setOpenBulkConfirm(false)
      setSelectedIds(new Set())
      const parts = [
        toDeactivate.length > 0 ? `${toDeactivate.length} cuenta${toDeactivate.length > 1 ? 's' : ''} desactivada${toDeactivate.length > 1 ? 's' : ''}` : '',
        toActivate.length > 0 ? `${toActivate.length} cuenta${toActivate.length > 1 ? 's' : ''} activada${toActivate.length > 1 ? 's' : ''}` : '',
      ].filter(Boolean)
      showToast(parts.join(' y '), 'success')
      void loadUsers()
    } catch {
      showToast('Error al procesar algunas cuentas', 'error')
    } finally {
      setSubmitting(false)
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
    const foundUser = await authService.findUsuarioByEmail(pendingResetEmail)
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
      if (formData.role === 'gerente' && !formData.provincia) {
        setFormError('La provincia es obligatoria para gerentes.')
        return false
      }
      if (formData.role === 'gerente' && formData.provincia) {
        const selectedProvincias = formData.provincia.split(',').map((s) => s.trim()).filter(Boolean)
        const conflicts = selectedProvincias.flatMap((prov) => {
          const owner = users.find((u) => {
            if (u.role !== 'gerente' || u.activo === false) return false
            const assigned = (u.provincias && u.provincias.length > 0)
              ? u.provincias
              : (u.provincia ? u.provincia.split(',').map((s) => s.trim()) : [])
            return assigned.includes(prov)
          })
          return owner ? [`${prov} (ya cubierta por ${owner.name} ${owner.lastname})`] : []
        })
        if (conflicts.length > 0) {
          setFormError(`No podés asignar: ${conflicts.join(', ')}. Cada provincia solo puede tener un gerente activo.`)
          return false
        }
      }
      if (
        (formData.role === 'supervisor' || formData.role === 'operador' || formData.role === 'repartidor')
        && !formData.sucursalId
      ) {
        setFormError('La sucursal es obligatoria para supervisores, operadores y repartidores.')
        return false
      }
      if (formData.role === 'repartidor') {
        if (!formData.licencia.trim()) {
          setFormError('La licencia es obligatoria para repartidores.')
          return false
        }
        if (!/^[A-Za-z0-9\- ]{6,15}$/.test(formData.licencia.trim())) {
          setFormError('La licencia debe tener entre 6 y 15 caracteres alfanuméricos.')
          return false
        }
      }
    }
    setFormError('')
    return true
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const filtersApplied = Boolean(search.trim() || roleFilter !== 'all' || estadoFilter !== 'all' || sucursalFilter !== 'all')
  const selectableUsers = users.filter((u) => !(currentUserId && u.id === currentUserId))
  const allSelected = selectableUsers.length > 0 && selectableUsers.every((u) => selectedIds.has(u.id))
  const someSelected = selectableUsers.some((u) => selectedIds.has(u.id))
  const selectedUsers = users.filter((u) => selectedIds.has(u.id))
  const toDeactivate = selectedUsers.filter((u) => isActive(u))
  const toActivate = selectedUsers.filter((u) => !isActive(u))

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" component="span">Equipo</Typography>
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {filtersApplied
              ? `${users.length} de ${totalItems} integrantes`
              : `${totalItems} ${totalItems === 1 ? 'integrante' : 'integrantes'}`}
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, bgcolor: isDark ? 'rgba(245,124,0,0.15)' : '#FFF3E0' }}>
            <NotificationsActiveIcon sx={{ color: '#F57C00', fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ color: '#E65100', fontWeight: 700 }}>
              Solicitudes de restablecimiento de contraseña ({pendingResets.length})
            </Typography>
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1B2D42' : '#FFF8F0', fontSize: '0.75rem' } }}>
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
                      {formatInstantArgentina(req.requestedAt, { dateStyle: 'short', timeStyle: 'short' })}
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
            placeholder="Buscar por nombre, email o DNI…"
            size="small"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
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
            onChange={(_e, v: RoleFilter | null) => {
              if (v !== null) {
                setRoleFilter(v)
                setPage(1)
              }
            }}
            size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: '0.75rem', textTransform: 'none', fontWeight: 600 } }}
          >
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton
              value="supervisor"
              sx={{
                '&.Mui-selected': {
                  color: isDark ? '#FF8A65' : '#BF360C',
                  bgcolor: isDark ? 'rgba(191,54,12,0.25)' : '#FFE0B2',
                  borderColor: isDark ? '#FF8A65' : '#FFCC80',
                },
                '&.Mui-selected:hover': { bgcolor: isDark ? 'rgba(191,54,12,0.35)' : '#ffd494' },
              }}
            >
              Supervisores
            </ToggleButton>
            <ToggleButton
              value="operador"
              sx={{
                '&.Mui-selected': {
                  color: isDark ? '#CE93D8' : '#6A1B9A',
                  bgcolor: isDark ? 'rgba(106,27,154,0.25)' : '#E1BEE7',
                  borderColor: isDark ? '#CE93D8' : '#CE93D8',
                },
                '&.Mui-selected:hover': { bgcolor: isDark ? 'rgba(106,27,154,0.35)' : '#d4a8e0' },
              }}
            >
              Operadores
            </ToggleButton>
            <ToggleButton
              value="repartidor"
              sx={{
                '&.Mui-selected': {
                  color: isDark ? '#F48FB1' : '#AD1457',
                  bgcolor: isDark ? 'rgba(173,20,87,0.25)' : '#F8BBD0',
                  borderColor: isDark ? '#F48FB1' : '#F48FB1',
                },
                '&.Mui-selected:hover': { bgcolor: isDark ? 'rgba(173,20,87,0.35)' : '#f5a3c0' },
              }}
            >
              Repartidores
            </ToggleButton>
            <ToggleButton
              value="gerente"
              sx={{
                '&.Mui-selected': {
                  color: isDark ? '#FFB74D' : '#E65100',
                  bgcolor: isDark ? 'rgba(230,81,0,0.25)' : '#FFF3E0',
                  borderColor: isDark ? '#FFB74D' : '#FFB74D',
                },
                '&.Mui-selected:hover': { bgcolor: isDark ? 'rgba(230,81,0,0.35)' : '#ffe0b2' },
              }}
            >
              Gerentes
            </ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            value={estadoFilter}
            exclusive
            onChange={(_e, v: EstadoFilter | null) => {
              if (v !== null) {
                setEstadoFilter(v)
                setPage(1)
              }
            }}
            size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1.5, py: 0.5, fontSize: '0.75rem', textTransform: 'none', fontWeight: 600 } }}
          >
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton
              value="active"
              sx={{
                '&.Mui-selected': {
                  color: isDark ? '#A5D6A7' : '#1B5E20',
                  bgcolor: isDark ? 'rgba(27,94,32,0.25)' : '#E8F5E9',
                  '&:hover': { bgcolor: isDark ? 'rgba(27,94,32,0.35)' : '#C8E6C9' },
                },
              }}
            >
              Activos
            </ToggleButton>
            <ToggleButton
              value="inactive"
              sx={{
                '&.Mui-selected': {
                  color: isDark ? '#EF9A9A' : '#B71C1C',
                  bgcolor: isDark ? 'rgba(183,28,28,0.25)' : '#FFEBEE',
                  '&:hover': { bgcolor: isDark ? 'rgba(183,28,28,0.35)' : '#FFCDD2' },
                },
              }}
            >
              Inactivos
            </ToggleButton>
          </ToggleButtonGroup>

          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Sucursal</InputLabel>
            <Select
              label="Sucursal"
              value={sucursalFilter}
              onChange={(e) => {
                setSucursalFilter(e.target.value)
                setPage(1)
              }}
            >
              <MenuItem value="all">Todas las sucursales</MenuItem>
              {branches.map((b) => (
                <MenuItem key={b.id} value={b.id}>{b.name}{b.province ? ` (${b.province})` : ''}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {filtersApplied && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setSearch('')
                setRoleFilter('all')
                setEstadoFilter('all')
                setSucursalFilter('all')
                setPage(1)
              }}
              sx={{ fontSize: '0.75rem', py: 0.5, px: 1.5, textTransform: 'none' }}
            >
              Limpiar filtros
            </Button>
          )}
        </Box>
      </Stack>

      {selectedIds.size > 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', bgcolor: isDark ? 'rgba(25,118,210,0.18)' : '#E3F2FD', borderColor: '#1976D2', borderRadius: 2 }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            <strong>{selectedIds.size}</strong> seleccionado{selectedIds.size > 1 ? 's' : ''}
            {toDeactivate.length > 0 && toActivate.length > 0
              ? ` · desactivar ${toDeactivate.length}, activar ${toActivate.length}`
              : toDeactivate.length > 0
                ? ` · desactivar ${toDeactivate.length}`
                : ` · activar ${toActivate.length}`}
          </Typography>
          <Button size="small" variant="contained" onClick={() => setOpenBulkConfirm(true)}>
            Confirmar acción
          </Button>
          <Button size="small" onClick={() => setSelectedIds(new Set())}>
            Cancelar selección
          </Button>
        </Paper>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : users.length === 0 ? (
        <Alert severity="info">
          {search || roleFilter !== 'all' || estadoFilter !== 'all'
            ? 'No se encontraron usuarios con los filtros aplicados.'
            : 'No hay usuarios registrados.'}
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: (theme) => theme.palette.mode === 'dark' ? '#1B2D42' : '#F5F7FA', fontSize: '0.78rem' } }}>
                <TableCell padding="checkbox" sx={{ width: 40 }}>
                  <Checkbox
                    size="small"
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onChange={() => {
                      if (allSelected) {
                        setSelectedIds(new Set())
                      } else {
                        setSelectedIds(new Set(selectableUsers.map((u) => u.id)))
                      }
                    }}
                  />
                </TableCell>
                <TableCell>Integrante</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>DNI</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Sucursal / Provincia</TableCell>
                <TableCell>Estado</TableCell>
                <TableCell align="center">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((user) => {
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
                      ...(selectedIds.has(user.id) && { bgcolor: 'rgba(25,118,210,0.06)' }),
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={selectedIds.has(user.id)}
                        disabled={!!(currentUserId && user.id === currentUserId)}
                        onChange={() => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(user.id)) next.delete(user.id)
                            else next.add(user.id)
                            return next
                          })
                        }}
                      />
                    </TableCell>
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
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                          {user.email}
                        </Typography>
                        <Tooltip title="Copiar email">
                          <IconButton size="small" onClick={() => handleCopyEmail(user.email)} sx={{ p: 0.3, opacity: 0.5, '&:hover': { opacity: 1 } }}>
                            <ContentCopyIcon sx={{ fontSize: 13 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>{user.dni}</Typography>
                    </TableCell>
                    <TableCell><RoleChip role={user.role} /></TableCell>
                    <TableCell>
                      {user.role === 'gerente' && user.provincia ? (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.4 }}>
                          {user.provincia.split(',').map((p) => p.trim()).filter(Boolean).map((prov) => (
                            <Chip key={prov} label={prov} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                          ))}
                        </Box>
                      ) : user.sucursalId ? (
                        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                          {branches.find((b) => b.id === user.sucursalId)?.name ?? '—'}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8rem' }}>—</Typography>
                      )}
                    </TableCell>
                    <TableCell><EstadoChip activo={user.activo} estado={user.estado} /></TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center">
                        <Tooltip title="Editar datos">
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleOpenEdit(user)}
                              sx={{ fontSize: '0.72rem', py: 0.3, px: 1, minWidth: 76 }}
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
                                  sx={{ fontSize: '0.72rem', py: 0.3, px: 1, minWidth: 104 }}
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
          <TablePagination
            component="div"
            count={totalItems}
            page={page - 1}
            onPageChange={(_event, nextPage) => setPage(nextPage + 1)}
            rowsPerPage={pageSize}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Usuarios por página"
          />
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
                onChange={(e) => setFormData((p) => ({
                  ...p,
                  role: e.target.value as UserRole,
                  provincia: '',
                  sucursalId: '',
                  licencia: '',
                }))}
              >
                <MenuItem value="gerente">Gerente</MenuItem>
                <MenuItem value="supervisor">Supervisor</MenuItem>
                <MenuItem value="operador">Operador</MenuItem>
                <MenuItem value="repartidor">Repartidor</MenuItem>
              </Select>
            </FormControl>
            {/* Épica D: el Gerente lleva provincias (múltiple); los roles operativos, sucursal. */}
            {formData.role === 'gerente' && (
              <>
                <FormControl fullWidth>
                  <InputLabel>Provincias a cargo *</InputLabel>
                    <Select
                      label="Provincia a cargo *"
                      value={formData.provincia}
                      onChange={(e) => {
                        setFormData((p) => ({ ...p, provincia: e.target.value as string }))
                      }}
                      renderValue={(selected) => selected as string}
                    >
                    {AR_PROVINCIAS.map((prov) => {
                      const isSelected = splitProvinces(formData.provincia).some((selected) => selected.toLowerCase() === prov.toLowerCase())
                      const ownerGerente = findProvinceOwner(prov)
                      const isBlocked = !!ownerGerente && !isSelected
                      return (
                        <MenuItem
                          key={prov}
                          value={prov}
                          disabled={isBlocked}
                          sx={{
                            opacity: isBlocked ? 0.55 : 1,
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 1 }}>
                            <span>{prov}</span>
                            {ownerGerente && (
                              <Typography
                                variant="caption"
                                color={isBlocked ? 'text.disabled' : 'warning.main'}
                                sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}
                              >
                                Asignada a {ownerGerente.name} {ownerGerente.lastname}
                              </Typography>
                            )}
                          </Box>
                        </MenuItem>
                      )
                    })}
                  </Select>
                </FormControl>
                {/* Provincias bloqueadas: aviso informativo */}
                {provinceOwners.length > 0 && (
                  <Alert severity="info" sx={{ mt: -1, fontSize: '0.8rem' }}>
                    Las provincias marcadas con nombre ya tienen un gerente activo asignado y no están disponibles.
                  </Alert>
                )}
              </>
            )}
            {(formData.role === 'supervisor' || formData.role === 'operador' || formData.role === 'repartidor') && (
              <FormControl fullWidth>
                <InputLabel>Sucursal *</InputLabel>
                <Select
                  label="Sucursal *"
                  value={formData.sucursalId}
                  onChange={(e) => setFormData((p) => ({ ...p, sucursalId: e.target.value }))}
                >
                  {branches.map((b) => (
                    <MenuItem key={b.id} value={b.id}>{b.name} {b.province ? `(${b.province})` : ''}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            {formData.role === 'repartidor' && (
              <TextField
                label="Licencia *"
                value={formData.licencia}
                onChange={(e) => setFormData((p) => ({ ...p, licencia: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '') }))}
                fullWidth
                placeholder="Ej: 12345678"
                helperText="Número de licencia de conducir (6–15 caracteres alfanuméricos)"
                inputProps={{ maxLength: 15 }}
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
                      onClick={() => {
                        setFormData((p) => ({ ...p, passwordTemporal: generateTempPassword() }))
                        setShowCreatePassword(true)
                      }}
                      edge="end"
                      size="small"
                      title="Generar contraseña automáticamente"
                    >
                      <CasinoIcon />
                    </IconButton>
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

            {/* Provincias a cargo (solo para Gerente) */}
            {selectedUser?.role === 'gerente' && (
              <FormControl fullWidth>
                <InputLabel>Provincia a cargo</InputLabel>
                <Select
                  label="Provincia a cargo"
                  value={formData.provincia}
                  onChange={(e) => {
                    const val = e.target.value as string
                    const current = formData.provincia

                    if (val !== current) {
                      const owner = findProvinceOwner(val, selectedUser?.id)
                      if (owner) {
                        setFormError(`No podés asignar: ${val} (ya cubierta por ${owner.name} ${owner.lastname}). Cada provincia solo puede tener un gerente.`)
                        return // No aplica el cambio
                      }
                      
                      // Check for existing sucursales
                      if (current) {
                        const hasSucursales = branches.some((b) => b.province?.toLowerCase() === current.toLowerCase())
                        if (hasSucursales) {
                          setFormError(`El gerente ya tiene sucursales registradas en ${current}, no se puede cambiar su provincia.`)
                          return // No aplica el cambio
                        }

                        // Check for orphans
                        const isOrphaned = !provinceOwners.some((u) => u.id !== selectedUser?.id && splitProvinces(u.provincias?.join(', ') ?? u.provincia).some((assigned) => assigned.toLowerCase() === current.toLowerCase()))
                        if (isOrphaned) {
                          setFormError(`Atención: ${current} quedará sin supervisión gerencial. Podés continuar igual.`)
                        } else {
                          setFormError('')
                        }
                      } else {
                        setFormError('')
                      }
                    }

                    setFormData((p) => ({ ...p, provincia: val }))
                  }}
                  renderValue={(selected) => (selected as string) || '— Sin provincia —'}
                >
                  {AR_PROVINCIAS.map((prov) => {
                    const selected = splitProvinces(formData.provincia).some((value) => value.toLowerCase() === prov.toLowerCase())
                    const ownerGerente = findProvinceOwner(prov, selectedUser?.id)
                    const isBlocked = !!ownerGerente && !selected
                    return (
                      <MenuItem
                        key={prov}
                        value={prov}
                        disabled={isBlocked}
                        sx={{
                          opacity: isBlocked ? 0.55 : 1,
                          '&.Mui-disabled': { opacity: 0.55 },
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', gap: 1 }}>
                          <span>{prov}</span>
                          {ownerGerente && (
                            <Typography variant="caption" color={isBlocked ? 'text.disabled' : 'warning.main'} sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
                              Asignada a {ownerGerente.name} {ownerGerente.lastname}
                            </Typography>
                          )}
                        </Box>
                      </MenuItem>
                    )
                  })}
                </Select>
              </FormControl>
            )}

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
                              onClick={() => {
                                setResetPassValue(generateTempPassword())
                                setShowResetPassValue(true)
                              }}
                              edge="end"
                              size="small"
                              title="Generar contraseña automáticamente"
                            >
                              <CasinoIcon />
                            </IconButton>
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
                      onClick={() => {
                        setResolvePassValue(generateTempPassword())
                        setShowResolvePassValue(true)
                      }}
                      edge="end"
                      size="small"
                      title="Generar contraseña automáticamente"
                    >
                      <CasinoIcon />
                    </IconButton>
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

      {/* Confirmar acción masiva */}
      <Dialog open={openBulkConfirm} onClose={() => !submitting && setOpenBulkConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirmar acción masiva</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {[
              toDeactivate.length > 0 ? `¿Querés desactivar ${toDeactivate.length} cuenta${toDeactivate.length > 1 ? 's' : ''}` : '',
              toActivate.length > 0 ? `${toDeactivate.length > 0 ? 'y activar' : '¿Querés activar'} ${toActivate.length} cuenta${toActivate.length > 1 ? 's' : ''}` : '',
            ].filter(Boolean).join(' ')}{toDeactivate.length + toActivate.length > 0 ? '?' : ''}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBulkConfirm(false)} disabled={submitting}>Cancelar</Button>
          <Button variant="contained" onClick={handleBulkToggle} disabled={submitting}>
            {submitting ? 'Procesando…' : 'Confirmar'}
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
