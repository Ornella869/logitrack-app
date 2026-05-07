import api from './api'

export type PlanEmpresa = 'Basico' | 'Premium'
export type EstadoEmpresa = 'Activa' | 'Suspendida'

export interface MiPlanResponse {
  empresaId: string
  nombre: string
  plan: PlanEmpresa
  limiteCuentas: number
  cuentasActivas: number
  cuentasDesactivadas: number
  estado: EstadoEmpresa
  cambioPendiente: boolean
  planDestinoPendiente: PlanEmpresa | null
}

export interface PlanCatalogo {
  plan: PlanEmpresa
  nombre: string
  limiteCuentas: number
  precioMock: string
  funcionalidades: string[]
}

export const empresaService = {
  miPlan: async (): Promise<MiPlanResponse | null> => {
    try {
      const r = await api.get('/empresa/mi-plan')
      return r.data
    } catch {
      return null
    }
  },
  catalogo: async (): Promise<PlanCatalogo[]> => {
    try {
      const r = await api.get('/empresa/planes')
      return r.data ?? []
    } catch {
      return []
    }
  },
  cambiarPlan: async (plan: PlanEmpresa): Promise<{ success: boolean; codigo?: string; error?: string }> => {
    try {
      const r = await api.post('/empresa/cambiar-plan', { plan })
      return { success: true, codigo: r.data?.codigo }
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message ?? 'Error al solicitar cambio' }
    }
  },
  confirmarCambio: async (codigo: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post('/empresa/cambiar-plan/confirmar', { codigo })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message ?? 'Código incorrecto' }
    }
  },
  suspender: async (): Promise<boolean> => {
    try { await api.post('/empresa/suspender'); return true } catch { return false }
  },
  reactivar: async (): Promise<boolean> => {
    try { await api.post('/empresa/reactivar'); return true } catch { return false }
  },
}
