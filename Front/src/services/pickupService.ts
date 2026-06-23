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
  ocupados?: number
  estaLleno?: boolean
  promedioCalificaciones?: number | null
  totalCalificaciones?: number
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

  async actualizarConfiguracion(horarios: string, capacidadDiaria: number, horariosDetalle?: HorarioPickUpItem[]): Promise<void> {
    await api.patch('/pickup-operacion/configuracion', { horarios, capacidadDiaria, horariosDetalle })
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
    ventanaVencida?: boolean
  }> {
    const r = await api.get('/pickups/calificaciones/check', { params: { trackingCode } })
    return r.data
  },

  async getMisCalificaciones(): Promise<ResumenCalificaciones> {
    const r = await api.get('/pickup-operacion/calificaciones')
    return r.data
  },

  // G1L-152: Horarios estructurados (admin/gerente — por ID de punto)
  async getHorarios(pickupId: string): Promise<HorarioPickUpItem[]> {
    try {
      const r = await api.get(`/pickups/${pickupId}/horarios`)
      return r.data ?? []
    } catch { return [] }
  },

  async setHorarios(pickupId: string, horarios: HorarioPickUpItem[]): Promise<void> {
    await api.put(`/pickups/${pickupId}/horarios`, horarios)
  },

  // G1L-152: Horarios estructurados para SocioPickUp (propio punto)
  async getMisHorarios(): Promise<HorarioPickUpItem[]> {
    try {
      const r = await api.get('/pickup-operacion/horarios')
      return r.data ?? []
    } catch { return [] }
  },

  async setMisHorarios(horarios: HorarioPickUpItem[]): Promise<void> {
    await api.put('/pickup-operacion/horarios', horarios)
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

export interface HorarioPickUpItem {
  diaSemana: number  // 0=Dom, 1=Lun, ..., 6=Sáb
  apertura: string | null  // "HH:mm:ss" or null
  cierre: string | null
  cerrado: boolean
}
