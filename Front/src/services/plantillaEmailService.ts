import api from './api'

export interface PlantillaEmail {
  id?: string | null
  provincia: string
  evento: number
  eventoNombre: string
  asunto: string
  cuerpo: string
  variablesDisponibles: string
  esPersonalizada: boolean
  modificadoEn?: string | null
}

export const VARIABLES_SOPORTADAS = [
  { variable: '{{tracking}}', descripcion: 'Código de seguimiento del envío' },
  { variable: '{{destinatario}}', descripcion: 'Nombre completo del destinatario' },
  { variable: '{{nombre}}', descripcion: 'Nombre del destinatario' },
  { variable: '{{estado}}', descripcion: 'Estado actual del envío' },
  { variable: '{{codigoEntrega}}', descripcion: 'Código de entrega OTP' },
  { variable: '{{fecha}}', descripcion: 'Fecha estimada de entrega' },
  { variable: '{{provincia}}', descripcion: 'Provincia de destino' },
]

export const plantillaEmailService = {
  async listar(): Promise<PlantillaEmail[]> {
    const r = await api.get('/plantillas-email')
    return r.data
  },

  async obtener(evento: number): Promise<PlantillaEmail> {
    const r = await api.get(`/plantillas-email/${evento}`)
    return r.data
  },

  async guardar(evento: number, data: { asunto: string; cuerpo: string }): Promise<PlantillaEmail> {
    const r = await api.put(`/plantillas-email/${evento}`, data)
    return r.data
  },

  async restaurar(evento: number): Promise<void> {
    await api.delete(`/plantillas-email/${evento}`)
  },
}
