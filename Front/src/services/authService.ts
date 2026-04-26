import type {
  User,
  LoginCredentials,
  RegisterData,
  UserRole,
  UserEstado,
  RepartidorEstado,
  CreateRepartidorData,
  CreateUsuarioData,
} from '../types'
import api from './api'
import { normalizeUserRole } from '../utils/roleUtils'

interface CreateRepartidorResult {
  user: User
  temporaryPassword: string
}

const mapRepartidor = (t: any): User => ({
  id: t.id,
  name: t.nombre,
  lastname: t.apellido,
  email: t.email,
  dni: t.dni,
  role: 'repartidor',
  activo: t.activo ?? true,
  licencia: t.licencia,
  estado: (t.estado as RepartidorEstado) || 'Activo',
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
        dni: '',
        role: userRole,
        activo: userInfo?.activo ?? true,
      }

      console.log('✓ Login exitoso:', user)
      return user
    } catch (error: any) {
      console.error('Login error:', error)

      const status = error?.response?.status
      const responseData = error?.response?.data
      const unauthorizedByMessage =
        (typeof responseData === 'string' && /unauthorized|no autorizado/i.test(responseData)) ||
        /unauthorized|no autorizado/i.test(String(error?.message || ''))

      if (status === 401) {
        return null
      }

      if (unauthorizedByMessage) {
        return null
      }

      const errorMessage =
        (typeof responseData === 'string' && responseData) ||
        responseData?.message ||
        error?.message ||
        'Error al iniciar sesión'

      throw new Error(errorMessage)
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
    localStorage.removeItem('authToken')
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
      const response = await api.get('/auth/repartidores')
      return response.data.map(mapRepartidor)
    } catch (error) {
      console.error('Get repartidores error:', error)
      return []
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

  updateRepartidorLicencia: async (repartidorId: string, licencia: string): Promise<User | null> => {
    try {
      const response = await api.put(`/auth/repartidores/${repartidorId}/licencia`, {
        Licencia: licencia,
      })
      return mapRepartidor(response.data)
    } catch (error) {
      console.error('Update repartidor licencia error:', error)
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

  // Obtener todos los usuarios
  getUsuarios: async (): Promise<User[]> => {
    try {
      const response = await api.get('/auth/usuarios')
      return response.data.map((usuario: any) => ({
        id: usuario.id,
        name: usuario.nombre,
        lastname: usuario.apellido,
        email: usuario.email,
        dni: usuario.dni,
        role: normalizeUserRole(usuario.role ?? usuario.Role ?? ''),
        activo: usuario.activo ?? true,
        licencia: usuario.licencia,
        estado: usuario.estado as (UserEstado | RepartidorEstado) | undefined,
      }))
    } catch (error) {
      console.error('Get usuarios error:', error)
      return []
    }
  },

  createUsuario: async (data: CreateUsuarioData): Promise<{ user: User; temporaryPassword: string }> => {
    const roleMap: Record<UserRole, string> = {
      supervisor: 'Supervisor',
      operador: 'Operador',
      repartidor: 'Repartidor',
      administrador: 'Administrador',
    }
    const response = await api.post('/auth/usuarios', {
      Nombre: data.name,
      Apellido: data.lastname,
      Email: data.email,
      DNI: data.dni,
      Role: roleMap[data.role],
      PasswordTemporal: data.passwordTemporal,
      ...(data.licencia ? { Licencia: data.licencia } : {}),
    })
    const u = response.data
    return {
      user: {
        id: u.id,
        name: u.nombre,
        lastname: u.apellido,
        email: u.email,
        dni: u.dni,
        role: normalizeUserRole(u.role ?? u.Role ?? ''),
        activo: u.activo ?? true,
        licencia: u.licencia,
        estado: (u.estado as UserEstado) || 'Activo',
      },
      temporaryPassword: u.temporaryPassword || '',
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
        dni: u.dni,
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
