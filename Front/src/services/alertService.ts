import api from './api'

// G1L-84
export interface AlertaPaqueteSinEstadoFinal {
  paqueteId: string
  trackingId: string
  repartidorId?: string | null
  repartidorNombre: string
  fechaPrevista: string
  diasDemora: number
  estadoActual: string
}

export const alertService = {
  getPaquetesSinEstadoFinal: async (): Promise<AlertaPaqueteSinEstadoFinal[]> => {
    try {
      const r = await api.get('/alertas/paquetes-sin-estado-final')
      return (r.data ?? []) as AlertaPaqueteSinEstadoFinal[]
    } catch (e) {
      console.error('Get alertas error:', e)
      return []
    }
  },

  contar: async (): Promise<number> => {
    try {
      const r = await api.get('/alertas/contador')
      return r.data?.total ?? 0
    } catch {
      return 0
    }
  },
}
