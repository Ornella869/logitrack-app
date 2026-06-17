import { useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Fade,
  FormControl,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import { keyframes } from '@mui/material/styles'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import BlockIcon from '@mui/icons-material/Block'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CloseIcon from '@mui/icons-material/Close'
import GroupsIcon from '@mui/icons-material/Groups'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import SaveIcon from '@mui/icons-material/Save'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import StoreMallDirectoryIcon from '@mui/icons-material/StoreMallDirectory'
import TuneIcon from '@mui/icons-material/Tune'
import UndoIcon from '@mui/icons-material/Undo'
import UsersManagement from '../components/UsersManagement'
import type { Branch, User } from '../types'
import { branchService } from '../services/branchService'
import { gerenteSucursalService } from '../services/gerenteSucursalService'
import {
  permissionService,
  type RolePermission,
  type UserPermission,
  type UserPermissionState,
} from '../services/permissionService'

const reveal = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`

const savingPulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: .45; }
`

const truckDrive = keyframes`
  0%   { transform: translateX(-80px) scaleX(1); opacity: 0; }
  12%  { transform: translateX(0px) scaleX(1);   opacity: 1; }
  82%  { transform: translateX(0px) scaleX(1);   opacity: 1; }
  100% { transform: translateX(80px) scaleX(1);  opacity: 0; }
`

const pendingPulse = keyframes`
  0%, 100% { background-color: rgba(237,108,2,0.06); }
  50%       { background-color: rgba(237,108,2,0.13); }
`

const stateLabels: Record<UserPermissionState, string> = {
  SinExcepcion: 'Usar permiso del rol',
  Habilitado: 'Permitir para este usuario',
  Deshabilitado: 'Denegar para este usuario',
}

const roleLabels: Record<string, string> = {
  Administrador: 'Administrador',
  Gerente: 'Gerente',
  Supervisor: 'Supervisor',
  Operador: 'Operador',
  Repartidor: 'Repartidor',
  SocioPickUp: 'Socio PickUp',
  administrador: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  operador: 'Operador',
  repartidor: 'Repartidor',
  socio_pickup: 'Socio PickUp',
}

interface BranchScopeState {
  open: boolean
  permission: UserPermission | null
  scopeType: 'all' | 'specific'
  allBranches: Branch[]
  selectedBranchIds: string[]
  loading: boolean
  saving: boolean
}

const defaultBranchScope: BranchScopeState = {
  open: false, permission: null, scopeType: 'all',
  allBranches: [], selectedBranchIds: [], loading: false, saving: false,
}

export default function PermisosPage() {
  const [tab, setTab] = useState(0)
  const [roles, setRoles] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState('')
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [pendingRoleChanges, setPendingRoleChanges] = useState<Map<string, boolean>>(new Map())
  const [savingAll, setSavingAll] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [savedSnackbar, setSavedSnackbar] = useState('')
  const [branchScope, setBranchScope] = useState<BranchScopeState>(defaultBranchScope)
  const [gerenteBranches, setGerenteBranches] = useState<{
    available: Branch[]
    selectedIds: string[]
    loading: boolean
    saving: boolean
  }>({ available: [], selectedIds: [], loading: false, saving: false })

  useEffect(() => {
    void permissionService.getRoles()
      .then((data) => {
        setRoles(data)
        setSelectedRole(data[0] ?? '')
      })
      .catch(() => setError('No se pudo cargar la configuración de permisos.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedRole) return
    setLoading(true)
    setError('')
    setPendingRoleChanges(new Map())
    void permissionService.getRolePermissions(selectedRole)
      .then(setRolePermissions)
      .catch(() => setError('No se pudieron cargar los permisos del rol.'))
      .finally(() => setLoading(false))
  }, [selectedRole])

  useEffect(() => {
    if (!selectedUser) return
    setLoading(true)
    setError('')
    void permissionService.getUserPermissions(selectedUser.id)
      .then(setUserPermissions)
      .catch(() => setError('No se pudieron cargar los permisos del usuario.'))
      .finally(() => setLoading(false))
  }, [selectedUser])

  useEffect(() => {
    if (!selectedUser || selectedUser.role !== 'gerente') {
      setGerenteBranches({ available: [], selectedIds: [], loading: false, saving: false })
      return
    }

    let cancelled = false
    setGerenteBranches((prev) => ({ ...prev, loading: true, saving: false }))
    const provincias = getUserProvinces(selectedUser)

    Promise.all([
      branchService.getAllBranches(),
      gerenteSucursalService.getSucursalesDeGerente(selectedUser.id),
    ])
      .then(([branches, habilitadas]) => {
        if (cancelled) return
        const available = branches.filter((branch) =>
          branch.status === 'Activa'
          && provincias.some((provincia) => equalsIgnoreCase(branch.province, provincia)))
        const allowedIds = new Set(available.map((branch) => branch.id))
        setGerenteBranches({
          available,
          selectedIds: habilitadas.map((s) => s.id).filter((id) => allowedIds.has(id)),
          loading: false,
          saving: false,
        })
      })
      .catch(() => {
        if (!cancelled) {
          setGerenteBranches({ available: [], selectedIds: [], loading: false, saving: false })
          setError('No se pudieron cargar las sucursales operativas del gerente.')
        }
      })

    return () => { cancelled = true }
  }, [selectedUser])

  const groupedRolePermissions = useMemo(() => groupByGroup(rolePermissions), [rolePermissions])
  const groupedUserPermissions = useMemo(() => groupByGroup(userPermissions), [userPermissions])
  const roleEnabled = rolePermissions.filter((item) => item.habilitado).length
  const userExceptions = userPermissions.filter((item) => item.estado !== 'SinExcepcion').length

  const onRoleToggle = (permission: RolePermission, checked: boolean) => {
    setPendingRoleChanges((prev) => {
      const next = new Map(prev)
      if (checked === permission.habilitado) {
        next.delete(permission.clave)
      } else {
        next.set(permission.clave, checked)
      }
      return next
    })
  }

  const saveRoleChanges = async () => {
    setSavingAll(true)
    setError('')
    try {
      const entries = Array.from(pendingRoleChanges.entries())
      await Promise.all(entries.map(([clave, enabled]) =>
        permissionService.setRolePermission(selectedRole, clave, enabled),
      ))
      setRolePermissions((current) => current.map((p) =>
        pendingRoleChanges.has(p.clave) ? { ...p, habilitado: pendingRoleChanges.get(p.clave)! } : p,
      ))
      setPendingRoleChanges(new Map())
      window.dispatchEvent(new Event('logitrack:permissions'))
      setSavedSnackbar(`Cambios guardados para ${roleLabels[selectedRole] ?? selectedRole}`)
    } catch {
      setError('No se pudieron guardar los cambios del rol.')
    } finally {
      setSavingAll(false)
    }
  }

  const discardRoleChanges = () => setPendingRoleChanges(new Map())

  const updateUser = async (permission: UserPermission, estado: UserPermissionState) => {
    if (!selectedUser) return

    setSavingKey(permission.clave)
    setError('')
    try {
      await permissionService.setUserPermission(selectedUser.id, permission.clave, estado)
      setUserPermissions(await permissionService.getUserPermissions(selectedUser.id))
      window.dispatchEvent(new Event('logitrack:permissions'))
      setSavedSnackbar(`Excepción guardada para ${selectedUser.name}`)
    } catch {
      setError('No se pudo guardar la excepción del usuario.')
    } finally {
      setSavingKey('')
    }
  }

  const confirmBranchScope = async () => {
    if (!selectedUser || !branchScope.permission) return
    const sucursalesIds = branchScope.scopeType === 'all' ? [] : branchScope.selectedBranchIds
    setBranchScope(prev => ({ ...prev, saving: true }))
    setError('')
    try {
      await permissionService.setUserPermission(selectedUser.id, 'sucursales', 'Habilitado', sucursalesIds)
      setUserPermissions(await permissionService.getUserPermissions(selectedUser.id))
      window.dispatchEvent(new Event('logitrack:permissions'))
      setBranchScope(defaultBranchScope)
      const label = branchScope.scopeType === 'all'
        ? 'todas las sucursales de su provincia'
        : `${sucursalesIds.length} sucursal${sucursalesIds.length !== 1 ? 'es' : ''} específica${sucursalesIds.length !== 1 ? 's' : ''}`
      setSavedSnackbar(`Acceso a sucursales configurado: ${label}`)
    } catch {
      setError('No se pudo guardar el alcance de sucursales.')
      setBranchScope(prev => ({ ...prev, saving: false }))
    }
  }

  const toggleBranchId = (id: string) => {
    setBranchScope(prev => ({
      ...prev,
      selectedBranchIds: prev.selectedBranchIds.includes(id)
        ? prev.selectedBranchIds.filter(x => x !== id)
        : [...prev.selectedBranchIds, id],
    }))
  }

  const toggleGerenteBranchId = (id: string) => {
    setGerenteBranches((prev) => ({
      ...prev,
      selectedIds: prev.selectedIds.includes(id)
        ? prev.selectedIds.filter((value) => value !== id)
        : [...prev.selectedIds, id],
    }))
  }

  const saveGerenteBranches = async () => {
    if (!selectedUser || selectedUser.role !== 'gerente') return
    setGerenteBranches((prev) => ({ ...prev, saving: true }))
    setError('')
    try {
      await gerenteSucursalService.setSucursalesDeGerente(selectedUser.id, gerenteBranches.selectedIds)
      setSavedSnackbar(`Sucursales operativas actualizadas para ${selectedUser.name}`)
    } catch {
      setError('No se pudieron guardar las sucursales operativas del gerente.')
    } finally {
      setGerenteBranches((prev) => ({ ...prev, saving: false }))
    }
  }

  return (
    <Box
      sx={{
        maxWidth: 1440,
        mx: 'auto',
        px: { xs: 1.5, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
          gap: 2,
          alignItems: 'center',
          mb: 2.5,
          p: { xs: 2, md: 2.5 },
          border: '1px solid',
          borderColor: 'rgba(25,118,210,0.10)',
          borderRadius: 3,
          bgcolor: 'rgba(255,255,255,0.72)',
          boxShadow: '0 10px 30px rgba(20,45,75,0.045)',
          animation: `${reveal} 420ms cubic-bezier(.2,.8,.2,1) both`,
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 46, height: 46, borderRadius: 2, boxShadow: '0 14px 28px rgba(25,118,210,0.26)' }}>
              <AdminPanelSettingsIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: 0 }}>Permisos de acceso</Typography>
              <Typography color="text.secondary">
                Definí la base por rol y ajustá casos particulares sin mezclar ámbitos operativos.
              </Typography>
            </Box>
          </Stack>
        </Box>
        <Stack direction="row" spacing={1}>
          <SummaryChip icon={<ShieldOutlinedIcon />} label={`${roleEnabled} permisos del rol`} />
          {selectedUser && <SummaryChip icon={<TuneIcon />} label={`${userExceptions} excepciones`} />}
        </Stack>
      </Box>

      {error && (
        <Fade in>
          <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>
        </Fade>
      )}

      <Paper
        variant="outlined"
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          borderColor: 'rgba(25,118,210,0.16)',
          boxShadow: '0 18px 44px rgba(20, 45, 75, 0.09)',
          animation: `${reveal} 480ms 60ms cubic-bezier(.2,.8,.2,1) both`,
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, value) => { setTab(value); setPendingRoleChanges(new Map()) }}
          variant="fullWidth"
          sx={{
            minHeight: 58,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,0.86)',
            backdropFilter: 'blur(10px)',
            '& .MuiTab-root': { minHeight: 58, fontWeight: 800, textTransform: 'none' },
            '& .MuiTabs-indicator': { height: 3, borderRadius: 999 },
          }}
        >
          <Tab icon={<GroupsIcon />} iconPosition="start" label="Permisos por rol" />
          <Tab icon={<PersonSearchIcon />} iconPosition="start" label="Excepciones por usuario" />
        </Tabs>

        {tab === 0 ? (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <SectionHeading
              icon={<GroupsIcon />}
              title="Base de acceso por rol"
              description="Todo usuario hereda esta configuración, salvo que tenga una excepción individual."
            />

            <ToggleButtonGroup
              value={selectedRole}
              exclusive
              onChange={(_, value) => value && setSelectedRole(value)}
              size="small"
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 1,
                mb: 3,
                '& .MuiToggleButtonGroup-grouped': {
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '999px !important',
                  px: 2,
                  py: 0.85,
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: 'background.paper',
                  transition: 'all 160ms ease',
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    borderColor: 'primary.main',
                    boxShadow: '0 10px 22px rgba(25,118,210,0.22)',
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                },
              }}
            >
              {roles.map((role) => (
                <ToggleButton key={role} value={role}>{roleLabels[role] ?? role}</ToggleButton>
              ))}
            </ToggleButtonGroup>

            {loading ? <Loading /> : (
              <PermissionGrid key={selectedRole}>
                {Object.entries(groupedRolePermissions).map(([group, permissions], index) => {
                  // Para roles no-Admin, ocultar permisos incompatibles (en vez de mostrarlos grisados)
                  const visiblePermissions = selectedRole === 'Administrador'
                    ? permissions
                    : permissions.filter((p) => p.compatible)
                  if (visiblePermissions.length === 0) return null
                  return (
                    <PermissionGroup key={group} title={group} delay={index * 45}>
                      {visiblePermissions.map((permission) => {
                        const hasPending = pendingRoleChanges.has(permission.clave)
                        const pendingValue = hasPending ? pendingRoleChanges.get(permission.clave)! : permission.habilitado
                        return (
                          <PermissionRow
                            key={permission.clave}
                            name={permission.nombre}
                            status={hasPending
                              ? 'Pendiente de guardar'
                              : pendingValue ? 'Permitido' : 'Denegado'}
                            enabled={pendingValue}
                            compatible={true}
                            saving={savingAll && hasPending}
                            pending={hasPending}
                            control={(
                              <Tooltip title={permission.obligatorio ? 'Este permiso es obligatorio' : ''}>
                                <span>
                                  <Switch
                                    checked={pendingValue}
                                    disabled={permission.obligatorio || savingAll}
                                    onChange={(_, checked) => onRoleToggle(permission, checked)}
                                    inputProps={{ 'aria-label': `Permiso ${permission.nombre}` }}
                                  />
                                </span>
                              </Tooltip>
                            )}
                          />
                        )
                      })}
                    </PermissionGroup>
                  )
                })}
              </PermissionGrid>
            )}

            {/* Barra de guardar cambios pendientes */}
            <Fade in={pendingRoleChanges.size > 0}>
              <Box
                sx={{
                  position: 'sticky',
                  bottom: 16,
                  mt: 3,
                  mx: { xs: -2, md: -3 },
                  px: { xs: 2, md: 3 },
                  py: 1.5,
                  bgcolor: 'warning.main',
                  color: 'warning.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                  zIndex: 10,
                  boxShadow: '0 -4px 20px rgba(237,108,2,0.22)',
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center">
                  <SaveIcon fontSize="small" />
                  <Typography fontWeight={700} variant="body2">
                    {pendingRoleChanges.size} {pendingRoleChanges.size === 1 ? 'cambio pendiente' : 'cambios pendientes'} para {roleLabels[selectedRole] ?? selectedRole}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<UndoIcon />}
                    onClick={discardRoleChanges}
                    disabled={savingAll}
                    sx={{ color: 'warning.contrastText', borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' } }}
                  >
                    Descartar
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={savingAll ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                    onClick={() => void saveRoleChanges()}
                    disabled={savingAll}
                    sx={{ bgcolor: 'rgba(0,0,0,0.25)', '&:hover': { bgcolor: 'rgba(0,0,0,0.38)' }, fontWeight: 700 }}
                  >
                    {savingAll ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </Stack>
              </Box>
            </Fade>
          </Box>
        ) : (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <SectionHeading
              icon={<ManageAccountsIcon />}
              title="Excepciones individuales"
              description="Hacé click en 'Configurar' para abrir el panel de permisos de ese usuario. Los cambios solo afectan a esa persona."
            />

            <UsersManagement
              mode="select"
              selectedUserId={selectedUser?.id}
              onSelectUser={(user) => { setSelectedUser(user); setDrawerOpen(true) }}
              title="Seleccionar usuario"
              subtitle="Buscá por nombre, email o DNI y combiná filtros de rol, estado y sucursal."
            />

            <Box
              sx={{
                mt: 3,
                py: 4,
                px: 2,
                textAlign: 'center',
                border: '1px dashed',
                borderColor: selectedUser ? 'primary.light' : 'divider',
                borderRadius: 2,
                bgcolor: selectedUser ? 'rgba(25,118,210,0.04)' : 'action.hover',
                transition: 'all 0.2s ease',
              }}
            >
              <PersonSearchIcon color={selectedUser ? 'primary' : 'disabled'} sx={{ fontSize: 38, mb: 1 }} />
              <Typography fontWeight={750}>
                {selectedUser
                  ? `${selectedUser.name} ${selectedUser.lastname} — permisos personalizados`
                  : 'Elegí un usuario para configurar sus accesos'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedUser
                  ? <Box component="span" sx={{ color: 'primary.main', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setDrawerOpen(true)}>Abrir panel de configuración</Box>
                  : 'Hacé click en "Configurar" en la tabla de arriba.'}
              </Typography>
            </Box>
          </Box>
        )}
      </Paper>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: '100vw', sm: 540, md: 620 },
            display: 'flex',
            flexDirection: 'column',
            bgcolor: '#f8fbff',
            borderLeft: '1px solid rgba(25,118,210,0.12)',
          },
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 3,
            pt: 2,
            pb: 1.5,
            borderBottom: 1,
            borderColor: 'rgba(25,118,210,0.12)',
            flexShrink: 0,
            bgcolor: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TuneIcon color="primary" fontSize="small" />
            <Typography fontWeight={800} variant="subtitle1">Configurar permisos</Typography>
          </Stack>
          <IconButton onClick={() => setDrawerOpen(false)} size="small" aria-label="Cerrar panel">
            <CloseIcon />
          </IconButton>
        </Stack>

        {selectedUser && (
          <Box sx={{ px: 3, pt: 1.5, pb: 0.5, flexShrink: 0 }}>
            <SelectedUserHeader user={selectedUser} exceptions={userExceptions} />
          </Box>
        )}

        <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
          {selectedUser?.role === 'gerente' && (
            <Paper
              variant="outlined"
              sx={{
                mb: 2,
                p: 2,
                borderRadius: 3,
                bgcolor: 'linear-gradient(135deg, rgba(25,118,210,0.08), rgba(25,118,210,0.02))',
                borderColor: 'rgba(25,118,210,0.22)',
                boxShadow: '0 10px 26px rgba(25,118,210,0.08)',
              }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <StoreMallDirectoryIcon color="primary" fontSize="small" />
                    <Typography fontWeight={800}>Sucursales operativas del gerente</Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Estas son las sucursales donde puede usar permisos de operador/supervisor. Solo se muestran sucursales de {getUserProvinces(selectedUser).join(', ') || 'su provincia'}.
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  color={gerenteBranches.selectedIds.length > 0 ? 'primary' : 'default'}
                  label={`${gerenteBranches.selectedIds.length} habilitada${gerenteBranches.selectedIds.length !== 1 ? 's' : ''}`}
                />
              </Stack>

              {gerenteBranches.loading ? (
                <Box display="flex" justifyContent="center" py={2}><CircularProgress size={24} /></Box>
              ) : gerenteBranches.available.length === 0 ? (
                <Alert severity="warning" sx={{ py: 0.5 }}>
                  No hay sucursales activas en la provincia del gerente.
                </Alert>
              ) : (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.paper' }}>
                  <List dense disablePadding>
                    {gerenteBranches.available.map((branch) => (
                      <ListItem key={branch.id} disablePadding sx={{ '& + &': { borderTop: 1, borderColor: 'divider' } }}>
                        <ListItemIcon sx={{ minWidth: 38, pl: 0.5 }}>
                          <Checkbox
                            edge="start"
                            checked={gerenteBranches.selectedIds.includes(branch.id)}
                            onChange={() => toggleGerenteBranchId(branch.id)}
                            size="small"
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={branch.name}
                          secondary={`${branch.city || 'Sin ciudad'} · ${branch.province || 'Sin provincia'}`}
                          primaryTypographyProps={{ fontWeight: 700, variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 1.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => void saveGerenteBranches()}
                  disabled={gerenteBranches.loading || gerenteBranches.saving}
                  startIcon={gerenteBranches.saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                >
                  {gerenteBranches.saving ? 'Guardando...' : 'Guardar sucursales'}
                </Button>
              </Stack>
            </Paper>
          )}

          <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
            <strong>Usar permiso del rol</strong> mantiene la configuración general.
            Las opciones permitir o denegar aplican solo a este usuario.
          </Alert>

          {loading ? <Loading /> : (
            <Stack spacing={2}>
              {Object.entries(groupedUserPermissions).map(([group, permissions], index) => {
                // Ocultar permisos incompatibles con el rol del usuario (no se puede asignar, no se muestra)
                const visiblePermissions = selectedUser?.role === 'administrador'
                  ? permissions
                  : permissions.filter((p) => p.compatible)
                if (visiblePermissions.length === 0) return null
                return (
                  <PermissionGroup key={group} title={group} delay={index * 30}>
                    {visiblePermissions.map((permission) => {
                      const scopeLabel = null
                      return (
                        <PermissionRow
                          key={permission.clave}
                          name={permission.nombre}
                          status={permission.habilitadoEfectivo ? 'Acceso efectivo' : 'Sin acceso'}
                          enabled={permission.habilitadoEfectivo}
                          compatible={true}
                          saving={savingKey === permission.clave}
                          control={(
                            <Stack spacing={0.5} alignItems="flex-end">
                              <FormControl size="small" sx={{ width: { xs: 170, sm: 210 } }}>
                                <Select
                                  value={permission.estado}
                                  disabled={permission.obligatorio || savingKey === permission.clave}
                                  onChange={(event) => void updateUser(permission, event.target.value as UserPermissionState)}
                                  inputProps={{ 'aria-label': `Excepción para ${permission.nombre}` }}
                                >
                                  {(Object.keys(stateLabels) as UserPermissionState[]).map((state) => (
                                    <MenuItem key={state} value={state}>{stateLabels[state]}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              {scopeLabel && (
                                <Chip
                                  size="small"
                                  icon={<StoreMallDirectoryIcon sx={{ fontSize: '14px !important' }} />}
                                  label={scopeLabel}
                                  color="primary"
                                  variant="outlined"
                                  onClick={() => void updateUser(permission, 'Habilitado')}
                                  sx={{ fontSize: 11, height: 22, cursor: 'pointer' }}
                                />
                              )}
                            </Stack>
                          )}
                        />
                      )
                    })}
                  </PermissionGroup>
                )
              })}
            </Stack>
          )}
        </Box>

        <Divider />
        <Box sx={{ px: 3, py: 1.5, flexShrink: 0 }}>
          <Typography variant="caption" color="text.secondary">
            Los cambios se guardan automáticamente al seleccionar una opción.
          </Typography>
        </Box>
      </Drawer>

      {/* Dialog de alcance de sucursales */}
      <Dialog
        open={branchScope.open}
        onClose={() => !branchScope.saving && setBranchScope(defaultBranchScope)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <StoreMallDirectoryIcon color="primary" />
          Alcance de sucursales
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Elegí a qué sucursales puede acceder <strong>{selectedUser?.name} {selectedUser?.lastname}</strong> con el permiso Sucursales habilitado.
          </Typography>
          <RadioGroup
            value={branchScope.scopeType}
            onChange={(_, v) => setBranchScope(prev => ({ ...prev, scopeType: v as 'all' | 'specific' }))}
          >
            <FormControlLabel
              value="all"
              control={<Radio />}
              label={<Box><Typography fontWeight={700}>Todas las sucursales de su provincia</Typography><Typography variant="caption" color="text.secondary">El usuario ve todas las sucursales activas de su provincia</Typography></Box>}
            />
            <FormControlLabel
              value="specific"
              control={<Radio />}
              label={<Box><Typography fontWeight={700}>Sucursales específicas</Typography><Typography variant="caption" color="text.secondary">Seleccioná una o más sucursales individuales</Typography></Box>}
            />
          </RadioGroup>
          {branchScope.scopeType === 'specific' && (
            <Box sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 260, overflowY: 'auto' }}>
              {branchScope.loading ? (
                <Box display="flex" justifyContent="center" py={3}><CircularProgress size={28} /></Box>
              ) : branchScope.allBranches.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No hay sucursales disponibles.</Typography>
              ) : (
                <List dense disablePadding>
                  {branchScope.allBranches.map((branch) => (
                    <ListItem key={branch.id} disablePadding sx={{ '& + &': { borderTop: 1, borderColor: 'divider' } }}>
                      <ListItemIcon sx={{ minWidth: 36, pl: 0.5 }}>
                        <Checkbox
                          edge="start"
                          checked={branchScope.selectedBranchIds.includes(branch.id)}
                          onChange={() => toggleBranchId(branch.id)}
                          size="small"
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={branch.name}
                        secondary={branch.province}
                        primaryTypographyProps={{ fontWeight: 600, variant: 'body2' }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
          {branchScope.scopeType === 'specific' && branchScope.selectedBranchIds.length > 0 && (
            <Typography variant="caption" color="primary" sx={{ mt: 1, display: 'block' }}>
              {branchScope.selectedBranchIds.length} sucursal{branchScope.selectedBranchIds.length !== 1 ? 'es' : ''} seleccionada{branchScope.selectedBranchIds.length !== 1 ? 's' : ''}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={() => setBranchScope(defaultBranchScope)} disabled={branchScope.saving}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void confirmBranchScope()}
            disabled={branchScope.saving || (branchScope.scopeType === 'specific' && branchScope.selectedBranchIds.length === 0)}
            startIcon={branchScope.saving ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {branchScope.saving ? 'Guardando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar con camioneta animada */}
      <Snackbar
        open={!!savedSnackbar}
        autoHideDuration={3500}
        onClose={() => setSavedSnackbar('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="success"
          onClose={() => setSavedSnackbar('')}
          icon={false}
          sx={{ alignItems: 'center', pr: 4, overflow: 'hidden', minWidth: 320 }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                animation: `${truckDrive} 3.5s ease forwards`,
                display: 'flex',
                alignItems: 'center',
                color: 'success.dark',
              }}
            >
              <LocalShippingRoundedIcon sx={{ fontSize: 28 }} />
            </Box>
            <Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CheckCircleIcon sx={{ fontSize: 15, color: 'success.main' }} />
                <Typography variant="body2" fontWeight={700} color="success.dark">
                  ¡Guardado!
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {savedSnackbar}
              </Typography>
            </Stack>
          </Stack>
        </Alert>
      </Snackbar>
    </Box>
  )
}

function equalsIgnoreCase(a?: string | null, b?: string | null) {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

function getUserProvinces(user?: User | null): string[] {
  const values = user?.provincias?.length
    ? user.provincias
    : (user?.provincia ?? '').split(',')
  return values.map((value) => value.trim()).filter(Boolean)
}

function groupByGroup<T extends { grupo: string }>(permissions: T[]): Record<string, T[]> {
  return permissions.reduce<Record<string, T[]>>((groups, permission) => {
    groups[permission.grupo] ??= []
    groups[permission.grupo].push(permission)
    return groups
  }, {})
}

function Loading() {
  return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>
}

function SummaryChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <Chip
      icon={icon as ReactElement}
      label={label}
      variant="outlined"
      sx={{
        height: 36,
        fontWeight: 800,
        bgcolor: 'rgba(255,255,255,0.86)',
        borderColor: 'rgba(25,118,210,0.18)',
        boxShadow: '0 8px 20px rgba(20,45,75,0.06)',
      }}
    />
  )
}

function SectionHeading({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: 2.5 }}>
      <Box
        sx={{
          color: 'primary.main',
          mt: 0.1,
          width: 34,
          height: 34,
          borderRadius: 1.5,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'rgba(25,118,210,0.08)',
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" fontWeight={800}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{description}</Typography>
      </Box>
    </Stack>
  )
}

function SelectedUserHeader({ user, exceptions }: { user: User; exceptions: number }) {
  const initials = `${user.name?.[0] ?? ''}${user.lastname?.[0] ?? ''}`.toUpperCase()
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={2}
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      justifyContent="space-between"
      sx={{
        mb: 2,
        p: 2,
        border: '1px solid',
        borderColor: 'primary.light',
        borderRadius: 2,
        bgcolor: 'rgba(25, 118, 210, 0.05)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar sx={{ bgcolor: 'primary.main', fontWeight: 800 }}>{initials}</Avatar>
        <Box>
          <Typography fontWeight={800}>{user.name} {user.lastname}</Typography>
          <Typography variant="body2" color="text.secondary">{user.email}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Chip size="small" label={roleLabels[user.role] ?? user.role} variant="outlined" />
        <Chip
          size="small"
          label={exceptions > 0 ? `${exceptions} ${exceptions === 1 ? 'excepción activa' : 'excepciones activas'}` : 'Sin excepciones'}
          color={exceptions > 0 ? 'primary' : 'default'}
        />
      </Stack>
    </Stack>
  )
}

function PermissionGrid({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        columnCount: { xs: 1, lg: 2 },
        columnGap: 2,
      }}
    >
      {children}
    </Box>
  )
}

function PermissionGroup({ title, children, delay }: { title: string; children: ReactNode; delay: number }) {
  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        overflow: 'hidden',
        alignSelf: 'start',
        bgcolor: 'background.paper',
        boxShadow: '0 10px 28px rgba(20,45,75,0.06)',
        breakInside: 'avoid',
        mb: 2,
        animation: `${reveal} 360ms ${delay}ms cubic-bezier(.2,.8,.2,1) both`,
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{
          px: 2,
          py: 1.35,
          bgcolor: 'rgba(25,118,210,0.045)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <LockOpenIcon color="primary" sx={{ fontSize: 19 }} />
        <Typography variant="subtitle2" fontWeight={800}>{title}</Typography>
      </Stack>
      {children}
    </Box>
  )
}

function PermissionRow({
  name,
  status,
  enabled,
  compatible,
  saving,
  pending = false,
  control,
}: {
  name: string
  status: string
  enabled: boolean
  compatible: boolean
  saving: boolean
  pending?: boolean
  control: ReactNode
}) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      justifyContent="space-between"
      spacing={1.5}
      sx={{
        minHeight: 72,
        px: 2,
        py: 1.25,
        opacity: compatible ? 1 : 0.55,
        transition: 'background-color 160ms ease, transform 160ms ease',
        '& + &': { borderTop: 1, borderColor: 'divider' },
        '&:hover': { bgcolor: compatible ? 'rgba(25,118,210,0.035)' : undefined },
        ...(pending && { animation: `${pendingPulse} 1.8s ease infinite` }),
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={700} noWrap title={name}>{name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.6 }}>
          {pending
            ? <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: 'warning.main', flexShrink: 0 }} />
            : enabled
              ? <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
              : <BlockIcon color={compatible ? 'action' : 'disabled'} sx={{ fontSize: 16 }} />}
          <Typography
            variant="caption"
            color={pending ? 'warning.main' : enabled ? 'success.main' : 'text.secondary'}
            sx={{ fontWeight: 700, animation: saving ? `${savingPulse} 900ms ease infinite` : undefined }}
          >
            {saving ? 'Guardando...' : status}
          </Typography>
        </Stack>
      </Box>
      {control}
    </Stack>
  )
}
