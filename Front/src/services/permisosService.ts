import api from './api'

export const ROLES_DISPONIBLES = ['supervisor', 'operador', 'repartidor', 'gerente'] as const
export type RolPermiso = typeof ROLES_DISPONIBLES[number]

export interface CeldaPermiso {
  rol: RolPermiso
  habilitado: boolean
  esMinimo: boolean
}

export interface FilaPermisos {
  funcionalidadId: string
  label: string
  celdas: CeldaPermiso[]
}

export interface MatrizPermisos {
  filas: FilaPermisos[]
}

export const permisosService = {
  getMatriz: async (): Promise<MatrizPermisos | null> => {
    try {
      const res = await api.get('/permisos')
      return res.data
    } catch {
      return null
    }
  },

  actualizar: async (funcionalidad: string, rol: string, habilitado: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.put(`/permisos/${funcionalidad}/${rol}`, { habilitado })
      return { success: true }
    } catch (error: any) {
      const msg = error.response?.data?.message ?? 'No se pudo actualizar el permiso'
      return { success: false, error: typeof msg === 'string' ? msg : 'Error desconocido' }
    }
  },

  getPorRol: async (rol: string): Promise<string[]> => {
    try {
      const res = await api.get(`/permisos/por-rol/${rol}`)
      return res.data ?? []
    } catch {
      return []
    }
  },
}
