import api from './api'

export interface MensajeIncidencia {
  id: string
  incidenciaId: string
  de: string
  deNombre: string
  deRol: 'repartidor' | 'supervisor'
  texto: string
  fecha: string
  leidoPorRepartidor: boolean
  leidoPorSupervisor: boolean
}

export const mensajeIncidenciaService = {
  async getByIncidencia(incidenciaId: string): Promise<MensajeIncidencia[]> {
    try {
      const response = await api.get(`/incidencias/${incidenciaId}/mensajes`)
      return (response.data ?? []) as MensajeIncidencia[]
    } catch {
      return []
    }
  },

  async send(incidenciaId: string, texto: string): Promise<void> {
    await api.post(`/incidencias/${incidenciaId}/mensajes`, { texto })
  },

  async markRead(incidenciaId: string): Promise<void> {
    try { await api.put(`/incidencias/${incidenciaId}/mensajes/marcar-leido`) } catch { /* ignore */ }
  },

  async countMisNoLeidos(): Promise<number> {
    try {
      const response = await api.get('/incidencias/mensajes/mis-no-leidos')
      return (response.data as number) ?? 0
    } catch {
      return 0
    }
  },

  countUnreadFromSupervisor(mensajes: MensajeIncidencia[]): number {
    return mensajes.filter((m) => m.deRol === 'supervisor' && !m.leidoPorRepartidor).length
  },

  countUnreadFromRepartidor(mensajes: MensajeIncidencia[]): number {
    return mensajes.filter((m) => m.deRol === 'repartidor' && !m.leidoPorSupervisor).length
  },
}
