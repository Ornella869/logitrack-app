import api from './api'

export interface EmailNotificacion {
  id: string
  paqueteId?: string | null
  codigoSeguimiento?: string | null
  destinatarioEmail: string
  asunto: string
  evento: string
  estado: 'Pendiente' | 'Enviado' | 'Fallido'
  creadoEn: string
  enviadoEn?: string | null
  error?: string | null
  intentos: number
}

export const emailNotificacionService = {
  async getPorPaquete(paqueteId: string): Promise<EmailNotificacion[]> {
    const r = await api.get(`/emails/paquete/${paqueteId}`)
    return r.data ?? []
  },

  async reintentar(emailId: string): Promise<EmailNotificacion> {
    const r = await api.post(`/emails/${emailId}/reintentar`)
    return r.data
  },
}
