import api from './api'

export interface PuntoPickUp {
  id: string
  nombre: string
  direccion: string
  localidad: string
  codigoPostal: string
  provincia: string
  horarios: string
  telefono?: string | null
  activo: boolean
  creadoEn: string
}

export interface PuntoPickUpPayload {
  nombre: string
  direccion: string
  localidad: string
  codigoPostal: string
  provincia: string
  horarios: string
  telefono?: string
}

export const pickupService = {
  async getAll(): Promise<PuntoPickUp[]> {
    const r = await api.get('/pickups')
    return r.data ?? []
  },

  async create(payload: PuntoPickUpPayload): Promise<PuntoPickUp> {
    const r = await api.post('/pickups', payload)
    return r.data
  },

  async update(id: string, payload: PuntoPickUpPayload): Promise<PuntoPickUp> {
    const r = await api.put(`/pickups/${id}`, payload)
    return r.data
  },

  async setActivo(id: string, activo: boolean): Promise<void> {
    await api.post(`/pickups/${id}/estado`, { activo })
  },

  async asignarEnvio(pickupId: string, paqueteId: string): Promise<void> {
    await api.post(`/pickups/${pickupId}/asignar-envio/${paqueteId}`)
  },
}
