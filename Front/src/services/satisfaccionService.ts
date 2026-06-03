import api from './api'

export interface EncuestaInfo {
  paqueteCodigo: string
  destinatarioNombre: string
  yaRespondida: boolean
  calificacion?: number
  comentario?: string
}

export const getEncuesta = (token: string): Promise<EncuestaInfo> =>
  api.get(`/encuesta/${token}`).then(r => r.data)

export const responderEncuesta = (token: string, calificacion: number, comentario?: string): Promise<void> =>
  api.post(`/encuesta/${token}`, { calificacion, comentario }).then(() => undefined)

export interface RespuestaEncuesta {
  id: string
  paqueteCodigo: string
  destinatarioNombre: string
  calificacion: number
  comentario?: string | null
  respondidaEn: string
  repartidorId?: string | null
  repartidorNombre?: string | null
}

export interface MetricaSatisfaccion {
  repartidorId: string
  repartidorNombre: string
  totalRespuestas: number
  promedioCalificacion: number
  nps: number
  promotores: number
  pasivos: number
  detractores: number
}

export interface ResumenSatisfaccion {
  totalRespuestas: number
  promedioCalificacion: number
  nps: number
  promotores: number
  pasivos: number
  detractores: number
  porRepartidor: MetricaSatisfaccion[]
}

export const satisfaccionMetricasService = {
  getRespuestas: async (desde?: string, hasta?: string, repartidorId?: string): Promise<RespuestaEncuesta[]> => {
    const params: Record<string, string> = {}
    if (desde) params.desde = desde
    if (hasta) params.hasta = hasta
    if (repartidorId) params.repartidorId = repartidorId
    const r = await api.get('/encuesta/respuestas', { params })
    return r.data ?? []
  },

  getMetricas: async (desde?: string, hasta?: string): Promise<ResumenSatisfaccion> => {
    const params: Record<string, string> = {}
    if (desde) params.desde = desde
    if (hasta) params.hasta = hasta
    const r = await api.get('/encuesta/metricas', { params })
    return r.data
  },
}
