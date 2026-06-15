import { useEffect, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  Alert,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  Fade,
  FormControl,
  MenuItem,
  Paper,
  Select,
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
import GroupsIcon from '@mui/icons-material/Groups'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts'
import PersonSearchIcon from '@mui/icons-material/PersonSearch'
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined'
import TuneIcon from '@mui/icons-material/Tune'
import UsersManagement from '../components/UsersManagement'
import type { User } from '../types'
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

export default function PermisosPage() {
  const [tab, setTab] = useState(0)
  const [roles, setRoles] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState('')
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')

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

  const groupedRolePermissions = useMemo(() => groupByGroup(rolePermissions), [rolePermissions])
  const groupedUserPermissions = useMemo(() => groupByGroup(userPermissions), [userPermissions])
  const roleEnabled = rolePermissions.filter((item) => item.habilitado).length
  const userExceptions = userPermissions.filter((item) => item.estado !== 'SinExcepcion').length

  const updateRole = async (permission: RolePermission, enabled: boolean) => {
    setSavingKey(permission.clave)
    setError('')
    try {
      await permissionService.setRolePermission(selectedRole, permission.clave, enabled)
      setRolePermissions((current) => current.map((item) =>
        item.clave === permission.clave ? { ...item, habilitado: enabled } : item))
      window.dispatchEvent(new Event('logitrack:permissions'))
    } catch {
      setError('No se pudo guardar el permiso del rol.')
    } finally {
      setSavingKey('')
    }
  }

  const updateUser = async (permission: UserPermission, estado: UserPermissionState) => {
    if (!selectedUser) return
    setSavingKey(permission.clave)
    setError('')
    try {
      await permissionService.setUserPermission(selectedUser.id, permission.clave, estado)
      setUserPermissions(await permissionService.getUserPermissions(selectedUser.id))
      window.dispatchEvent(new Event('logitrack:permissions'))
    } catch {
      setError('No se pudo guardar la excepción del usuario.')
    } finally {
      setSavingKey('')
    }
  }

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
          gap: 2,
          alignItems: 'end',
          mb: 3,
          animation: `${reveal} 420ms cubic-bezier(.2,.8,.2,1) both`,
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 42, height: 42, borderRadius: 2 }}>
              <AdminPanelSettingsIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={800}>Permisos de acceso</Typography>
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
          borderRadius: 2,
          boxShadow: '0 12px 32px rgba(20, 45, 75, 0.06)',
          animation: `${reveal} 480ms 60ms cubic-bezier(.2,.8,.2,1) both`,
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="fullWidth"
          sx={{
            minHeight: 58,
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '& .MuiTab-root': { minHeight: 58, fontWeight: 750, textTransform: 'none' },
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
                  borderRadius: '6px !important',
                  px: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                },
              }}
            >
              {roles.map((role) => (
                <ToggleButton key={role} value={role}>{roleLabels[role] ?? role}</ToggleButton>
              ))}
            </ToggleButtonGroup>

            {loading ? <Loading /> : (
              <PermissionGrid key={selectedRole}>
                {Object.entries(groupedRolePermissions).map(([group, permissions], index) => (
                  <PermissionGroup key={group} title={group} delay={index * 45}>
                    {permissions.map((permission) => (
                      <PermissionRow
                        key={permission.clave}
                        name={permission.nombre}
                        status={!permission.compatible
                          ? 'No compatible con este rol'
                          : permission.habilitado ? 'Permitido' : 'Denegado'}
                        enabled={permission.habilitado}
                        compatible={permission.compatible}
                        saving={savingKey === permission.clave}
                        control={(
                          <Tooltip title={permission.obligatorio ? 'Este permiso es obligatorio' : ''}>
                            <span>
                              <Switch
                                checked={permission.habilitado}
                                disabled={!permission.compatible || permission.obligatorio || savingKey === permission.clave}
                                onChange={(_, checked) => void updateRole(permission, checked)}
                                inputProps={{ 'aria-label': `Permiso ${permission.nombre}` }}
                              />
                            </span>
                          </Tooltip>
                        )}
                      />
                    ))}
                  </PermissionGroup>
                ))}
              </PermissionGrid>
            )}
          </Box>
        ) : (
          <Box sx={{ p: { xs: 2, md: 3 } }}>
            <SectionHeading
              icon={<ManageAccountsIcon />}
              title="Excepciones individuales"
              description="Seleccioná un usuario usando la misma grilla del Dashboard. Los cambios solo afectan a esa persona."
            />

            <UsersManagement
              mode="select"
              selectedUserId={selectedUser?.id}
              onSelectUser={setSelectedUser}
              title="Seleccionar usuario"
              subtitle="Buscá por nombre, email o DNI y combiná filtros de rol, estado y sucursal."
            />

            {!selectedUser ? (
              <Box
                sx={{
                  mt: 3,
                  py: 5,
                  px: 2,
                  textAlign: 'center',
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                }}
              >
                <PersonSearchIcon color="disabled" sx={{ fontSize: 38, mb: 1 }} />
                <Typography fontWeight={750}>Elegí un usuario para configurar sus accesos</Typography>
                <Typography variant="body2" color="text.secondary">
                  La selección queda activa aunque cambies filtros o navegues entre páginas.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ mt: 3, animation: `${reveal} 360ms cubic-bezier(.2,.8,.2,1) both` }}>
                <SelectedUserHeader user={selectedUser} exceptions={userExceptions} />

                <Alert severity="info" icon={<InfoOutlinedIcon />} sx={{ mb: 2 }}>
                  <strong>Usar permiso del rol</strong> mantiene la configuración general.
                  Las opciones permitir o denegar reemplazan esa base únicamente para este usuario.
                </Alert>

                {loading ? <Loading /> : (
                  <PermissionGrid key={selectedUser.id}>
                    {Object.entries(groupedUserPermissions).map(([group, permissions], index) => (
                      <PermissionGroup key={group} title={group} delay={index * 45}>
                        {permissions.map((permission) => (
                          <PermissionRow
                            key={permission.clave}
                            name={permission.nombre}
                            status={!permission.compatible
                              ? 'No compatible con este rol'
                              : permission.habilitadoEfectivo ? 'Acceso efectivo' : 'Sin acceso'}
                            enabled={permission.habilitadoEfectivo}
                            compatible={permission.compatible}
                            saving={savingKey === permission.clave}
                            control={(
                              <FormControl size="small" sx={{ width: { xs: 190, sm: 230 } }}>
                                <Select
                                  value={permission.estado}
                                  disabled={!permission.compatible || permission.obligatorio || savingKey === permission.clave}
                                  onChange={(event) => void updateUser(permission, event.target.value as UserPermissionState)}
                                  inputProps={{ 'aria-label': `Excepción para ${permission.nombre}` }}
                                >
                                  {(Object.keys(stateLabels) as UserPermissionState[]).map((state) => (
                                    <MenuItem key={state} value={state}>{stateLabels[state]}</MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            )}
                          />
                        ))}
                      </PermissionGroup>
                    ))}
                  </PermissionGrid>
                )}
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  )
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
      sx={{ height: 34, fontWeight: 700, bgcolor: 'background.paper' }}
    />
  )
}

function SectionHeading({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start" sx={{ mb: 2.5 }}>
      <Box sx={{ color: 'primary.main', mt: 0.25 }}>{icon}</Box>
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
          label={`${exceptions} ${exceptions === 1 ? 'excepción' : 'excepciones'}`}
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
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
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
        borderRadius: 2,
        overflow: 'hidden',
        alignSelf: 'start',
        animation: `${reveal} 360ms ${delay}ms cubic-bezier(.2,.8,.2,1) both`,
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 1.25, bgcolor: 'action.hover' }}>
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
  control,
}: {
  name: string
  status: string
  enabled: boolean
  compatible: boolean
  saving: boolean
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
        transition: 'background-color 160ms ease',
        '& + &': { borderTop: 1, borderColor: 'divider' },
        '&:hover': { bgcolor: compatible ? 'action.hover' : undefined },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography fontWeight={700} noWrap title={name}>{name}</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.6 }}>
          {enabled
            ? <CheckCircleIcon color="success" sx={{ fontSize: 16 }} />
            : <BlockIcon color={compatible ? 'action' : 'disabled'} sx={{ fontSize: 16 }} />}
          <Typography
            variant="caption"
            color={enabled ? 'success.main' : 'text.secondary'}
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
