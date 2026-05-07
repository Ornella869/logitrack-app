import api from './api'

export type PlanInteres = 'Basico' | 'Premium'

export interface CrearLeadPayload {
  companyName: string
  contactName: string
  email: string
  phone: string
  plan: PlanInteres
  comments?: string
}

export const leadService = {
  createLead: async (payload: CrearLeadPayload): Promise<void> => {
    await api.post('/leads', {
      NombreEmpresa: payload.companyName,
      NombreContacto: payload.contactName,
      Email: payload.email,
      Telefono: payload.phone,
      PlanInteres: payload.plan,
      Comentarios: payload.comments?.trim() || null,
    })
  },
}
