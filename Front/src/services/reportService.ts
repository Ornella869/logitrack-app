import api from './api'

// G1L-26: Reporte de volumen por período.
export interface ReporteVolumen {
  desde: string
  hasta: string
  totalEnvios: number
  entregados: number
  cancelados: number
  enProceso: number
  efectividadPct: number
  totalEnviosADomicilio: number
  enviosADomicilioPorProvincia: Array<{
    provinciaDestino: string
    cantidad: number
  }>
}

export const reportService = {
  getVolumen: async (desde: string, hasta: string): Promise<ReporteVolumen | null> => {
    try {
      const response = await api.get('/reportes/volumen', { params: { desde, hasta } })
      return response.data as ReporteVolumen
    } catch (error) {
      console.error('Get reporte volumen error:', error)
      return null
    }
  },
}
