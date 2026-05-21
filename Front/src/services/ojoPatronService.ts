import api from './api'

// G1L-59: consentimiento informado del Ojo del Patrón.
export interface EstadoConsentimiento {
  aceptado: boolean
  versionVigente: string
  aceptadoEn?: string | null
}

export interface TextoLegal {
  version: string
  texto: string
}

// G1L-60 / G1L-61
export interface EstadoPruebaDia {
  realizadaHoy: boolean
  umbralAlertness: number
}

export interface ConfiguracionOjoPatron {
  id: string
  umbralAlertness: number
  actualizadoEn: string
}

// 0 = Aprobada, 2 = Rechazada
export type ResultadoPrueba = 0 | 2

export interface RegistrarPruebaPayload {
  scoreNeu: number
  scoreHap: number
  scoreSad: number
  scoreAng: number
  alertnessScore: number
  intentos: number
  resultado: ResultadoPrueba
}

export const ojoPatronService = {
  getTextoLegal: async (): Promise<TextoLegal | null> => {
    try {
      const r = await api.get('/ojo-patron/texto-legal')
      return r.data as TextoLegal
    } catch (e) {
      console.error('Get texto legal error:', e)
      return null
    }
  },

  getConsentimiento: async (): Promise<EstadoConsentimiento | null> => {
    try {
      const r = await api.get('/ojo-patron/consentimiento')
      return r.data as EstadoConsentimiento
    } catch (e) {
      console.error('Get consentimiento error:', e)
      return null
    }
  },

  aceptar: async (): Promise<{ success: boolean }> => {
    try {
      await api.post('/ojo-patron/consentimiento/aceptar')
      return { success: true }
    } catch (e) {
      console.error('Aceptar consentimiento error:', e)
      return { success: false }
    }
  },

  revocar: async (): Promise<{ success: boolean }> => {
    try {
      await api.post('/ojo-patron/consentimiento/revocar')
      return { success: true }
    } catch (e) {
      console.error('Revocar consentimiento error:', e)
      return { success: false }
    }
  },

  // G1L-60 / G1L-61
  getEstadoPrueba: async (): Promise<EstadoPruebaDia | null> => {
    try {
      const r = await api.get('/ojo-patron/prueba/estado')
      return r.data as EstadoPruebaDia
    } catch (e) {
      console.error('Get estado prueba error:', e)
      return null
    }
  },

  registrarPrueba: async (payload: RegistrarPruebaPayload): Promise<{ success: boolean }> => {
    try {
      await api.post('/ojo-patron/prueba', {
        ScoreNeu: payload.scoreNeu,
        ScoreHap: payload.scoreHap,
        ScoreSad: payload.scoreSad,
        ScoreAng: payload.scoreAng,
        AlertnessScore: payload.alertnessScore,
        Intentos: payload.intentos,
        Resultado: payload.resultado,
      })
      return { success: true }
    } catch (e) {
      console.error('Registrar prueba error:', e)
      return { success: false }
    }
  },

  getConfiguracion: async (): Promise<ConfiguracionOjoPatron | null> => {
    try {
      const r = await api.get('/ojo-patron/configuracion')
      return r.data as ConfiguracionOjoPatron
    } catch (e) {
      console.error('Get config ojo patron error:', e)
      return null
    }
  },

  actualizarConfiguracion: async (umbralAlertness: number): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.put('/ojo-patron/configuracion', { UmbralAlertness: umbralAlertness })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data ?? 'No se pudo actualizar' }
    }
  },
}
