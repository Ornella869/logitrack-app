import type {
  User,
  LoginCredentials,
  RegisterData,
  UserRole,
  UserEstado,
  RepartidorEstado,
  CreateRepartidorData,
  CreateUsuarioData,
  PagedResult,
} from '../types'
import api from './api'
import { normalizeUserRole } from '../utils/roleUtils'

const LAST_ACTIVITY_STORAGE_KEY = 'sessionLastActivityAt'
const LOGOUT_EVENT_NAME = 'logitrack:logout'

interface CreateRepartidorResult {
  user: User
  temporaryPassword: string
}

const readDni = (data: any): string => data?.dni ?? data?.Dni ?? data?.DNI ?? ''

export interface RepartidorListItem extends User {
  assignedRoutesCount: number
  routeStatusKey: 'en-viaje' | 'con-ruta-asignada' | 'sin-asignacion'
  routeStatusLabel: string
}

export interface LicenciaPorVencerItem {
  repartidorId: string
  nombre: string
  apellido: string
  email: string
  dni: string
  licencia: string
  fechaVencimientoLicencia: string
  diasRestantes: number
  urgente: boolean
}

const mapRepartidor = (t: any): User => ({
  id: t.id,
  name: t.nombre,
  lastname: t.apellido,
  email: t.email,
  dni: readDni(t),
  role: 'repartidor',
  activo: t.activo ?? true,
  licencia: t.licencia,
  fechaVencimientoLicencia: t.fechaVencimientoLicencia ?? null,
  estado: (t.estado as RepartidorEstado) || 'Activo',
  motivoSuspension: t.motivoSuspension ?? null,
  horasTrabajo: t.horasTrabajo ?? 8,
  tipoJornada: (t.tipoJornada as 'Part Time' | 'Full Time') ?? 'Full Time',
  capacidadCargaKg: Number(t.capacidadCargaKg ?? t.CapacidadCargaKg ?? 500),
})

const mapRepartidorListItem = (t: any): RepartidorListItem => ({
  ...mapRepartidor(t),
  assignedRoutesCount: Number(t.assignedRoutesCount ?? 0),
  routeStatusKey: (t.routeStatusKey ?? 'sin-asignacion') as RepartidorListItem['routeStatusKey'],
  routeStatusLabel: t.routeStatusLabel ?? 'Sin asignacion',
})

const mapPagedRepartidores = (data: any): PagedResult<RepartidorListItem> => {
  if (Array.isArray(data)) {
    return {
      items: data.map(mapRepartidorListItem),
      page: 1,
      pageSize: data.length,
      totalItems: data.length,
      totalPages: 1,
    }
  }

  return {
    items: Array.isArray(data?.items) ? data.items.map(mapRepartidorListItem) : [],
    page: Number(data?.page ?? 1),
    pageSize: Number(data?.pageSize ?? 10),
    totalItems: Number(data?.totalItems ?? 0),
    totalPages: Number(data?.totalPages ?? 1),
  }
}

const mapUsuario = (usuario: any): User => ({
  id: usuario.id,
  name: usuario.nombre,
  lastname: usuario.apellido,
  email: usuario.email,
  dni: readDni(usuario),
  role: normalizeUserRole(usuario.role ?? usuario.Role ?? ''),
  activo: usuario.activo ?? true,
  licencia: usuario.licencia,
  fechaVencimientoLicencia: usuario.fechaVencimientoLicencia ?? null,
  estado: usuario.estado as (UserEstado | RepartidorEstado) | undefined,
  motivoSuspension: usuario.motivoSuspension ?? null,
  sucursalId: usuario.sucursalId ?? usuario.SucursalId ?? null,
  provincia: usuario.provincia ?? usuario.Provincia ?? null,
  provincias: usuario.provincias ?? usuario.Provincias ?? null,
  puntoPickUpId: usuario.puntoPickUpId ?? usuario.PuntoPickUpId ?? null,
  fotoPerfil: usuario.fotoPerfil ?? null,
  capacidadCargaKg: usuario.capacidadCargaKg ?? usuario.CapacidadCargaKg ?? undefined,
})

const mapPagedUsuarios = (data: any): PagedResult<User> => ({
  items: Array.isArray(data?.items) ? data.items.map(mapUsuario) : [],
  page: Number(data?.page ?? 1),
  pageSize: Number(data?.pageSize ?? 10),
  totalItems: Number(data?.totalItems ?? 0),
  totalPages: Number(data?.totalPages ?? 1),
})

export const authService = {
  // Login
  login: async (credentials: LoginCredentials): Promise<User | null> => {
    try {
      const response = await api.post('/auth/login', {
        Email: credentials.email,
        Password: credentials.password,
        RecaptchaToken: credentials.recaptchaToken,
      })

      const token = response.data.token
      const userInfo = response.data.user

      const userId = userInfo?.id ?? userInfo?.Id ?? ''
      const userRoleRaw = userInfo?.role ?? userInfo?.Role ?? ''
      const userRole = normalizeUserRole(userRoleRaw)

      localStorage.setItem('authToken', token)

      const user: User = {
        id: userId,
        name: userInfo?.nombre ?? userInfo?.Nombre ?? '',
        lastname: userInfo?.apellido ?? userInfo?.Apellido ?? '',
        email: userInfo?.email ?? userInfo?.Email ?? '',
        dni: readDni(userInfo),
        role: userRole,
        activo: userInfo?.activo ?? true,
        sucursalId: userInfo?.sucursalId ?? userInfo?.SucursalId ?? null,
        provincia: userInfo?.provincia ?? userInfo?.Provincia ?? null,
        provincias: userInfo?.provincias ?? userInfo?.Provincias ?? null,
        puntoPickUpId: userInfo?.puntoPickUpId ?? userInfo?.PuntoPickUpId ?? null,
        capacidadCargaKg: userInfo?.capacidadCargaKg ?? userInfo?.CapacidadCargaKg ?? undefined,
        fotoPerfil: userInfo?.fotoPerfil ?? null,
      }

      console.log('✓ Login exitoso:', user)
      return user
    } catch (error: any) {
      console.error('Login error:', error)

      const status = error?.response?.status
      const responseData = error?.response?.data
      const responseMsg =
        (typeof responseData === 'string' && responseData) ||
        responseData?.message ||
        ''

      // 401 puede ser credencial inválida, usuario inactivo o cuenta bloqueada.
      if (status === 401) {
        if (/inactivo|bloqueada|bloqueado/i.test(responseMsg)) {
          throw new Error(responseMsg)
        }
        return null
      }

      const unauthorizedByMessage =
        /unauthorized|no autorizado/i.test(responseMsg) ||
        /unauthorized|no autorizado/i.test(String(error?.message || ''))
      if (unauthorizedByMessage) {
        return null
      }

      throw new Error(responseMsg || error?.message || 'Error al iniciar sesión')
    }
  },

  // Registro
  register: async (data: RegisterData): Promise<boolean> => {
    try {
      const roleMap = {
        supervisor: 'Supervisor',
        operador: 'Operador',
      } as const

      if (data.role === 'repartidor') {
        throw new Error('El rol repartidor no está habilitado para registro público')
      }

      await api.post('/auth/registrarse', {
        Nombre: data.name,
        Apellido: data.lastname,
        Email: data.email,
        Password: data.password,
        DNI: data.dni,
        Role: roleMap[data.role as 'supervisor' | 'operador']
      })

      return true
    } catch (error: any) {
      console.error('Register error:', error)
      const errorMessage =
        (typeof error?.response?.data === 'string' && error.response.data) ||
        error?.response?.data?.message ||
        error?.message ||
        'Error al registrarse'

      throw new Error(errorMessage)
    }
  },

  // Logout
  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('authToken')
    localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(LOGOUT_EVENT_NAME))
    }
  },

  // Verificar si está autenticado
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('authToken')
  },

  // Validar DNI básico (formato argentino)
  isValidDni: (dni: string): boolean => {
    const dniRegex = /^\d{8}$/
    return dniRegex.test(dni)
  },

  // Validar email
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  // Validar contraseña
  isValidPassword: (password: string): boolean => {
    return password.length >= 8
  },

  // Obtener repartidores
  getRepartidores: async (): Promise<User[]> => {
    try {
      const firstPage = await authService.getRepartidoresPage({ page: 1, pageSize: 100 })
      if (firstPage.totalPages <= 1) return firstPage.items

      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
          authService.getRepartidoresPage({ page: index + 2, pageSize: 100 }),
        ),
      )

      return [firstPage, ...remainingPages].flatMap((result) => result.items)
    } catch (error) {
      console.error('Get repartidores error:', error)
      return []
    }
  },

  getRepartidoresPage: async ({
    page,
    pageSize,
    search,
    accountStatus,
    routeStatus,
    tipoJornada,
  }: {
    page: number
    pageSize: number
    search?: string
    accountStatus?: 'activo' | 'inactivo'
    routeStatus?: 'en-viaje' | 'con-ruta-asignada' | 'sin-asignacion'
    tipoJornada?: 'part-time' | 'full-time'
  }): Promise<PagedResult<RepartidorListItem>> => {
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (search) params.set('search', search)
      if (accountStatus) params.set('accountStatus', accountStatus)
      if (routeStatus) params.set('routeStatus', routeStatus)
      if (tipoJornada) params.set('tipoJornada', tipoJornada)
      const response = await api.get(`/auth/repartidores?${params.toString()}`)
      return mapPagedRepartidores(response.data)
    } catch (error) {
      console.error('Get repartidores page error:', error)
      return { items: [], page, pageSize, totalItems: 0, totalPages: 1 }
    }
  },

  // Registrar repartidor (solo gestión interna)
  createRepartidor: async (data: CreateRepartidorData): Promise<CreateRepartidorResult | null> => {
    try {
      const response = await api.post('/auth/repartidores', {
        Nombre: data.name,
        Apellido: data.lastname,
        Email: data.email,
        DNI: data.dni,
        Licencia: data.licencia,
        FechaVencimientoLicencia: data.fechaVencimientoLicencia || null,
        CapacidadCargaKg: data.capacidadCargaKg ?? 500,
      })
      const t = response.data
      return {
        user: mapRepartidor(t),
        temporaryPassword: t.temporaryPassword || '',
      }
    } catch (error) {
      console.error('Create repartidor error:', error)
      return null
    }
  },

  updateRepartidorLicencia: async (repartidorId: string, licencia: string, fechaVencimientoLicencia?: string | null): Promise<User | null> => {
    try {
      const response = await api.put(`/auth/repartidores/${repartidorId}/licencia`, {
        Licencia: licencia,
        FechaVencimientoLicencia: fechaVencimientoLicencia || null,
      })
      return mapRepartidor(response.data)
    } catch (error) {
      console.error('Update repartidor licencia error:', error)
      return null
    }
  },

  updateRepartidorHorasTrabajo: async (repartidorId: string, horasTrabajo: number): Promise<User | null> => {
    try {
      const response = await api.put(`/auth/repartidores/${repartidorId}/horas-trabajo`, {
        HorasTrabajo: horasTrabajo,
      })
      return mapRepartidor(response.data)
    } catch (error) {
      console.error('Update repartidor horas trabajo error:', error)
      return null
    }
  },

  updateRepartidorCapacidadCarga: async (repartidorId: string, capacidadCargaKg: number): Promise<User | null> => {
    try {
      const response = await api.put(`/auth/repartidores/${repartidorId}/capacidad-carga`, {
        CapacidadCargaKg: capacidadCargaKg,
      })
      return mapRepartidor(response.data)
    } catch (error) {
      console.error('Update repartidor capacidad carga error:', error)
      return null
    }
  },

  updateRepartidorEstado: async (repartidorId: string, estado: RepartidorEstado): Promise<User | null> => {
    try {
      const response = await api.put(`/auth/repartidores/${repartidorId}/estado`, {
        Estado: estado,
      })
      return mapRepartidor(response.data)
    } catch (error) {
      console.error('Update repartidor estado error:', error)
      return null
    }
  },

  getLicenciasPorVencer: async (dias = 30): Promise<LicenciaPorVencerItem[]> => {
    try {
      const response = await api.get(`/auth/repartidores/licencias-por-vencer?dias=${dias}`)
      return Array.isArray(response.data)
        ? response.data.map((item: any) => ({
          repartidorId: item.repartidorId ?? item.RepartidorId ?? '',
          nombre: item.nombre ?? item.Nombre ?? '',
          apellido: item.apellido ?? item.Apellido ?? '',
          email: item.email ?? item.Email ?? '',
          dni: item.dni ?? item.DNI ?? item.dNI ?? '',
          licencia: item.licencia ?? item.Licencia ?? '',
          fechaVencimientoLicencia: item.fechaVencimientoLicencia ?? item.FechaVencimientoLicencia ?? '',
          diasRestantes: Number(item.diasRestantes ?? item.DiasRestantes ?? 0),
          urgente: Boolean(item.urgente ?? item.Urgente ?? false),
        }))
        : []
    } catch (error) {
      console.error('Get licencias por vencer error:', error)
      return []
    }
  },

  // Obtener todos los usuarios
  getUsuarios: async (): Promise<User[]> => {
    try {
      const firstPage = await authService.getUsuariosPage({ page: 1, pageSize: 100 })
      if (firstPage.totalPages <= 1) return firstPage.items

      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
          authService.getUsuariosPage({ page: index + 2, pageSize: 100 }),
        ),
      )

      return [firstPage, ...remainingPages].flatMap((result) => result.items)
    } catch (error) {
      console.error('Get usuarios error:', error)
      return []
    }
  },

  getUsuariosPage: async ({
    page,
    pageSize,
    search,
    role,
    active,
    sucursalId,
  }: {
    page: number
    pageSize: number
    search?: string
    role?: UserRole
    active?: boolean
    sucursalId?: string
  }): Promise<PagedResult<User>> => {
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (search) params.set('search', search)
      if (role) params.set('role', role)
      if (typeof active === 'boolean') params.set('active', String(active))
      if (sucursalId) params.set('sucursalId', sucursalId)
      const response = await api.get(`/auth/usuarios?${params.toString()}`)
      return mapPagedUsuarios(response.data)
    } catch (error) {
      console.error('Get usuarios page error:', error)
      return { items: [], page, pageSize, totalItems: 0, totalPages: 1 }
    }
  },

  getGerenteProvinciasOcupadas: async (): Promise<string[]> => {
    try {
      const response = await api.get('/auth/gerentes/provincias-ocupadas')
      return Array.isArray(response.data) ? response.data : []
    } catch (error) {
      console.error('Get gerente provincias ocupadas error:', error)
      return []
    }
  },

  findUsuarioByEmail: async (email: string): Promise<User | null> => {
    const result = await authService.getUsuariosPage({ page: 1, pageSize: 10, search: email })
    return result.items.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null
  },

  createUsuario: async (data: CreateUsuarioData): Promise<{ user: User; temporaryPassword: string }> => {
    const roleMap: Record<UserRole, string> = {
      supervisor: 'Supervisor',
      operador: 'Operador',
      repartidor: 'Repartidor',
      administrador: 'Administrador',
      gerente: 'Gerente',
      cliente: 'UsuarioPortal',
      socio_pickup: 'SocioPickUp',
    }
    try {
      const response = await api.post('/auth/usuarios', {
        Nombre: data.name,
        Apellido: data.lastname,
        Email: data.email,
        DNI: data.dni,
        Role: roleMap[data.role],
        PasswordTemporal: data.passwordTemporal,
        ...(data.licencia ? { Licencia: data.licencia } : {}),
        ...(data.role === 'repartidor' ? { FechaVencimientoLicencia: data.fechaVencimientoLicencia || null } : {}),
        ...(data.role === 'repartidor' ? { CapacidadCargaKg: data.capacidadCargaKg ?? 500 } : {}),
        ...(data.sucursalId ? { SucursalId: data.sucursalId } : {}),
        ...(data.provincia ? { Provincia: data.provincia } : {}),
        ...(data.puntoPickUpId ? { PuntoPickUpId: data.puntoPickUpId } : {}),
      })
      const u = response.data
      return {
        user: {
          id: u.id,
          name: u.nombre,
          lastname: u.apellido,
          email: u.email,
          dni: readDni(u),
          role: normalizeUserRole(u.role ?? u.Role ?? ''),
          activo: u.activo ?? true,
          licencia: u.licencia,
          fechaVencimientoLicencia: u.fechaVencimientoLicencia ?? null,
          capacidadCargaKg: u.capacidadCargaKg ?? u.CapacidadCargaKg ?? undefined,
          estado: (u.estado as UserEstado) || 'Activo',
          motivoSuspension: u.motivoSuspension ?? null,
          puntoPickUpId: u.puntoPickUpId ?? u.PuntoPickUpId ?? null,
        },
        temporaryPassword: u.temporaryPassword || '',
      }
    } catch (error: any) {
      // Sacar el mensaje del back si lo hay; si no, mensaje genérico
      const data = error?.response?.data
      let msg: string | undefined
      if (typeof data === 'string') {
        msg = data
      } else if (data?.message) {
        msg = data.message
      } else if (data?.errors) {
        // ASP.NET Core ModelState validation: { errors: { Field: ["msg"] } }
        const first = Object.values(data.errors)[0]
        if (Array.isArray(first) && first.length) msg = String(first[0])
      }
      throw new Error(msg || error?.message || 'Error al crear el usuario')
    }
  },

  updateUsuarioEstado: async (userId: string, estado: UserEstado): Promise<boolean> => {
    try {
      const endpoint = estado === 'Activo' ? 'activar' : 'desactivar'
      await api.post(`/auth/usuarios/${userId}/${endpoint}`)
      return true
    } catch (error) {
      console.error('Update usuario estado error:', error)
      return false
    }
  },

  updateUsuario: async (
    userId: string,
    data: Pick<CreateUsuarioData, 'name' | 'lastname' | 'email' | 'dni'>,
  ): Promise<User | null> => {
    try {
      const response = await api.put(`/auth/usuarios/${userId}`, {
        Nombre: data.name,
        Apellido: data.lastname,
        Email: data.email,
        DNI: data.dni,
      })
      const u = response.data
      return {
        id: u.id,
        name: u.nombre,
        lastname: u.apellido,
        email: u.email,
        dni: readDni(u),
        role: normalizeUserRole(u.role ?? u.Role ?? ''),
        activo: u.activo ?? true,
        estado: u.estado,
      }
    } catch (error: any) {
      const msg =
        (typeof error?.response?.data === 'string' && error.response.data) ||
        error?.response?.data?.message ||
        error?.message ||
        'Error al actualizar el usuario'
      throw new Error(msg)
    }
  },

  updateFotoPerfil: async (fotoBase64: string): Promise<User> => {
    const response = await api.put('/auth/me/foto-perfil', { FotoPerfil: fotoBase64 })
    return mapUsuario(response.data)
  },

  updateMiPerfil: async (nombre: string, apellido: string): Promise<User> => {
    const response = await api.put('/auth/mi-perfil', { Nombre: nombre, Apellido: apellido })
    const u = response.data
    return {
      id: u.id,
      name: u.nombre,
      lastname: u.apellido,
      email: u.email,
      dni: readDni(u),
      role: normalizeUserRole(u.role ?? u.Role ?? ''),
      activo: u.activo ?? true,
      estado: u.estado,
    }
  },

  getMiPerfil: async (): Promise<User> => {
    const response = await api.get('/auth/mi-perfil')
    return mapUsuario(response.data)
  },

  assignProvincias: async (userId: string, provincias: string[]): Promise<void> => {
    await api.put(`/auth/usuarios/${userId}/provincias`, { Provincias: provincias })
  },

  cambiarPassword: async (
    passwordActual: string,
    passwordNueva: string,
    passwordConfirmacion: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post('/auth/cambiar-password', {
        PasswordActual: passwordActual,
        PasswordNueva: passwordNueva,
        PasswordConfirmacion: passwordConfirmacion,
      })
      return { success: true }
    } catch (error: any) {
      const msg =
        (typeof error?.response?.data === 'string' && error.response.data) ||
        error?.response?.data?.message ||
        error?.message ||
        'Error al cambiar la contraseña'
      return { success: false, error: msg }
    }
  },

  resetPassword: async (
    userId: string,
    passwordTemporal?: string,
  ): Promise<{ success: boolean; temporaryPassword?: string; error?: string }> => {
    try {
      const response = await api.post(`/auth/usuarios/${userId}/reset-password`, {
        PasswordTemporal: passwordTemporal ?? null,
      })
      return { success: true, temporaryPassword: response.data?.temporaryPassword }
    } catch (error: any) {
      const msg =
        (typeof error?.response?.data === 'string' && error.response.data) ||
        error?.response?.data?.message ||
        error?.message ||
        'Error al resetear la contraseña'
      return { success: false, error: msg }
    }
  },
}
