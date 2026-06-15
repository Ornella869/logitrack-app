import api from './api'

export type UserPermissionState = 'SinExcepcion' | 'Habilitado' | 'Deshabilitado'

export interface RolePermission {
  clave: string
  nombre: string
  grupo: string
  habilitado: boolean
  compatible: boolean
  obligatorio: boolean
}

export interface UserPermission {
  clave: string
  nombre: string
  grupo: string
  estado: UserPermissionState
  habilitadoEfectivo: boolean
  compatible: boolean
  obligatorio: boolean
}

export interface PermissionUser {
  id: string
  nombre: string
  email: string
  rol: string
}

export const permissionService = {
  async getMine(): Promise<string[]> {
    const response = await api.get<string[]>('/permisos/me')
    return response.data
  },

  async getRoles(): Promise<string[]> {
    const response = await api.get<string[]>('/permisos/roles')
    return response.data
  },

  async getRolePermissions(role: string): Promise<RolePermission[]> {
    const response = await api.get<RolePermission[]>(`/permisos/roles/${encodeURIComponent(role)}`)
    return response.data
  },

  async setRolePermission(role: string, permission: string, enabled: boolean): Promise<void> {
    await api.put(`/permisos/roles/${encodeURIComponent(role)}/${permission}`, { habilitado: enabled })
  },

  async getUsers(search = ''): Promise<PermissionUser[]> {
    const response = await api.get<PermissionUser[]>('/permisos/usuarios', { params: { search: search || undefined } })
    return response.data
  },

  async getUserPermissions(userId: string): Promise<UserPermission[]> {
    const response = await api.get<UserPermission[]>(`/permisos/usuarios/${userId}`)
    return response.data
  },

  async setUserPermission(userId: string, permission: string, estado: UserPermissionState): Promise<void> {
    await api.put(`/permisos/usuarios/${userId}/${permission}`, { estado })
  },
}
