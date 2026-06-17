import api from './api'

export interface SucursalHabilitada {
  id: string
  nombre: string
  provincia: string | null
}

export interface SucursalActiva {
  id: string | null
  nombre: string | null
  provincia: string | null
}

export const gerenteSucursalService = {
  getSucursalesHabilitadas: async (): Promise<SucursalHabilitada[]> => {
    const res = await api.get('/gerentes/me/sucursales-habilitadas')
    return res.data
  },

  getSucursalActiva: async (): Promise<SucursalActiva> => {
    const res = await api.get('/gerentes/me/sucursal-activa')
    return res.data
  },

  setSucursalActiva: async (sucursalId: string | null): Promise<void> => {
    await api.put('/gerentes/me/sucursal-activa', { sucursalId })
  },

  // Admin: obtener sucursales habilitadas para un gerente específico
  getSucursalesDeGerente: async (gerenteId: string): Promise<SucursalHabilitada[]> => {
    const res = await api.get(`/gerentes/${gerenteId}/sucursales`)
    return res.data
  },

  // Admin: actualizar sucursales habilitadas para un gerente específico
  setSucursalesDeGerente: async (gerenteId: string, sucursalIds: string[]): Promise<void> => {
    await api.put(`/gerentes/${gerenteId}/sucursales`, { sucursalIds })
  },
}
