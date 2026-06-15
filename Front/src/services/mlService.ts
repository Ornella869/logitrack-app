import api from './api'

export interface MlMetricas {
  totalRegistros: number
  maeModelo: number
  nuevosRegistros30Dias: number
  distribucionErrores: {
    menosDe4h: number
    de4a8h: number
    de8a24h: number
    masDe24h: number
  }
  tramosConMayorError: TramoDificil[]
  maeHistorico: PuntoMaeHistorico[]
  puedeReentrenar: boolean
  version: string
}

export interface TramoDificil {
  origen: string
  destino: string
  maeHoras: number
  cantidadViajes: number
}

export interface PuntoMaeHistorico {
  mes: string
  mae: number
  registros: number
}

export interface AlertaRiesgo {
  id: string
  paqueteId: string
  codigoSeguimiento: string
  probabilidadDemora: number
  causaPrincipal: string
  sucursalId: string
  generadaEn: string
  gestionada: boolean
  gestionadaEn: string | null
}

export const mlService = {
  async getMetricas(): Promise<MlMetricas> {
    const res = await api.get<MlMetricas>('/ml-metricas')
    return res.data
  },

  async getAlertas(soloNoGestionadas = true): Promise<AlertaRiesgo[]> {
    const res = await api.get<AlertaRiesgo[]>('/ml-metricas/alertas', {
      params: { soloNoGestionadas },
    })
    return res.data
  },

  async gestionarAlerta(id: string, llegoATiempo: boolean | null): Promise<void> {
    await api.put(`/ml-metricas/alertas/${id}/gestionar`, { llegoATiempo })
  },

  async reentrenar(): Promise<string> {
    const res = await api.post<{ mensaje: string }>('/ml-metricas/reentrenar')
    return res.data.mensaje
  },
}
