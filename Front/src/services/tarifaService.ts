import api from './api'

// G1L-87
export interface ConfiguracionTarifa {
  id: string
  precioPorKg: number
  precioPorKm: number
  porcentajeRecargoZonaPeligrosa: number
  actualizadoEn: string
}

// G1L-86
export interface ZonaPeligrosa {
  id: string
  nombre: string
  latMin: number
  latMax: number
  lngMin: number
  lngMax: number
  activa: boolean
  creadoEn: string
}

// G1L-88
export interface Cotizacion {
  peso: number
  precioPorKg: number
  costoPeso: number
  distanciaKm: number
  precioPorKm: number
  costoDistancia: number
  esZonaPeligrosa: boolean
  porcentajeRecargo: number
  costoRecargo: number
  total: number
  latitud?: number | null
  longitud?: number | null
  geocodificado: boolean
}

export const tarifaService = {
  getConfiguracion: async (): Promise<ConfiguracionTarifa | null> => {
    try {
      const r = await api.get('/tarifas/configuracion')
      return r.data as ConfiguracionTarifa
    } catch (e) {
      console.error('Get config tarifa error:', e)
      return null
    }
  },

  actualizarConfiguracion: async (
    precioPorKg: number, precioPorKm: number, porcentajeRecargoZonaPeligrosa: number,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.put('/tarifas/configuracion', { PrecioPorKg: precioPorKg, PrecioPorKm: precioPorKm, PorcentajeRecargoZonaPeligrosa: porcentajeRecargoZonaPeligrosa })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data ?? 'No se pudo actualizar' }
    }
  },

  getZonas: async (): Promise<ZonaPeligrosa[]> => {
    try {
      const r = await api.get('/tarifas/zonas')
      return (r.data ?? []) as ZonaPeligrosa[]
    } catch (e) {
      console.error('Get zonas error:', e)
      return []
    }
  },

  crearZona: async (
    nombre: string, latMin: number, latMax: number, lngMin: number, lngMax: number,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post('/tarifas/zonas', { Nombre: nombre, LatMin: latMin, LatMax: latMax, LngMin: lngMin, LngMax: lngMax })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data ?? 'No se pudo crear la zona' }
    }
  },

  eliminarZona: async (id: string): Promise<{ success: boolean }> => {
    try {
      await api.delete(`/tarifas/zonas/${id}`)
      return { success: true }
    } catch (e) {
      console.error('Eliminar zona error:', e)
      return { success: false }
    }
  },

  cotizar: async (
    peso: number, direccion: string, localidad: string, cp: string, provincia?: string,
  ): Promise<Cotizacion | null> => {
    try {
      const r = await api.post('/tarifas/cotizar', { Peso: peso, Direccion: direccion, Localidad: localidad, CP: cp, Provincia: provincia })
      return r.data as Cotizacion
    } catch (e) {
      console.error('Cotizar error:', e)
      return null
    }
  },
}
