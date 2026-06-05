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
  activo: boolean
}

export interface ConfiguracionOjoPatron {
  id: string
  provincia: string
  umbralAlertness: number
  activo: boolean
  actualizadoEn: string
}

// 0 = Aprobada, 2 = Rechazada
export type ResultadoPrueba = 0 | 2

// 0 = Inicio de ruta, 1 = Mitad de recorrido
export type MomentoPrueba = 0 | 1

export interface OverrideOjoPatron {
  id: string
  repartidorId: string
  supervisorId?: string | null
  momento: string
  motivo: string
  estado: 'Pendiente' | 'Aprobado' | 'Rechazado'
  solicitadoEn: string
  resueltoEn?: string | null
  comentarioSupervisor?: string | null
}

export interface MetricaOjoPatron {
  repartidorId: string
  repartidorNombre: string
  aprobadas: number
  fallidas: number
  overridesAprobados: number
  promedioAlertness: number
  ultimaPrueba?: string | null
  esCritico: boolean
}

export interface RegistrarPruebaPayload {
  scoreNeu: number
  scoreHap: number
  scoreSad: number
  scoreAng: number
  alertnessScore: number
  intentos: number
  resultado: ResultadoPrueba
  momento?: MomentoPrueba
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
        Momento: payload.momento ?? 0,
      })
      return { success: true }
    } catch (e) {
      console.error('Registrar prueba error:', e)
      return { success: false }
    }
  },

  // Fase B: ¿al entregar este paquete se requiere la prueba de mitad de recorrido?
  requierePruebaMitad: async (paqueteId: string): Promise<boolean> => {
    try {
      const r = await api.get(`/ojo-patron/prueba-mitad-requerida/${paqueteId}`)
      return r.data?.requerida ?? false
    } catch {
      return false
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

  actualizarConfiguracion: async (umbralAlertness: number, activo: boolean): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.put('/ojo-patron/configuracion', { UmbralAlertness: umbralAlertness, Activo: activo })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data ?? 'No se pudo actualizar' }
    }
  },

  solicitarOverride: async (momento: MomentoPrueba, motivo: string): Promise<{ success: boolean; data?: OverrideOjoPatron; error?: string }> => {
    try {
      const r = await api.post('/ojo-patron/override/solicitar', { Momento: momento, Motivo: motivo })
      return { success: true, data: r.data }
    } catch (e: any) {
      return { success: false, error: e.response?.data ?? 'No se pudo solicitar el override' }
    }
  },

  getOverrides: async (): Promise<OverrideOjoPatron[]> => {
    const r = await api.get('/ojo-patron/override/solicitudes')
    return r.data ?? []
  },

  resolverOverride: async (overrideId: string, aprobado: boolean, comentario?: string): Promise<OverrideOjoPatron> => {
    const r = await api.post(`/ojo-patron/override/${overrideId}/resolver`, { Aprobado: aprobado, Comentario: comentario })
    return r.data
  },

  getMetricasHistoricas: async (desde?: string, hasta?: string): Promise<MetricaOjoPatron[]> => {
    const params: Record<string, string> = {}
    if (desde) params.desde = desde
    if (hasta) params.hasta = hasta
    const r = await api.get('/ojo-patron/metricas-historicas', { params })
    return r.data ?? []
  },
}
