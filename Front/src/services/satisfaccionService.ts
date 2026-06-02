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
