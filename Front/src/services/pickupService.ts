import api from './api'

export interface PuntoPickUp {
  id: string
  nombre: string
  direccion: string
  localidad: string
  codigoPostal: string
  provincia: string
  horarios: string
  capacidadDiaria: number
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
  capacidadDiaria: number
  telefono?: string
}

export interface PickUpGeocodingResult {
  latitud: number
  longitud: number
  advertencia?: string | null
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

  async geocodificar(payload: PuntoPickUpPayload): Promise<PickUpGeocodingResult> {
    const r = await api.post('/pickups/geocodificar', payload)
    return r.data
  },

  async asignarEnvio(pickupId: string, paqueteId: string): Promise<void> {
    await api.post(`/pickups/${pickupId}/asignar-envio/${paqueteId}`)
  },

  async calificarExperiencia(payload: {
    trackingCode: string
    estrellas: number
    comentario?: string
    autorNombre?: string
  }): Promise<void> {
    await api.post('/pickups/calificaciones', {
      trackingCode: payload.trackingCode,
      estrellas: payload.estrellas,
      comentario: payload.comentario ?? null,
      autorNombre: payload.autorNombre ?? null,
    })
  },

  async checkCalificacion(trackingCode: string): Promise<{
    calificado: boolean
    estrellas?: number
    comentario?: string | null
    autorNombre?: string | null
    creadoEn?: string
  }> {
    const r = await api.get('/pickups/calificaciones/check', { params: { trackingCode } })
    return r.data
  },

  async getMisCalificaciones(): Promise<ResumenCalificaciones> {
    const r = await api.get('/pickup-operacion/calificaciones')
    return r.data
  },
}

export interface ResumenCalificaciones {
  promedio: number
  total: number
  porEstrella: number[]
  ultimas: CalificacionPickUpItem[]
}

export interface CalificacionPickUpItem {
  id: string
  estrellas: number
  comentario?: string | null
  autorNombre?: string | null
  creadoEn: string
  trackingCode: string
}
