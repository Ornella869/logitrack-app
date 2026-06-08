import api from './api'

const TRACKING_MODE_KEY = 'gps_tracking_mode'

type TrackingMode = 'rutas' | 'envios'

interface UbicacionPayload {
  lat: number
  lng: number
}

interface UbicacionConTimestamp extends UbicacionPayload {
  timestamp: number
}

const readTrackingMode = (): TrackingMode => {
  try {
    return localStorage.getItem(TRACKING_MODE_KEY) === 'envios' ? 'envios' : 'rutas'
  } catch {
    return 'rutas'
  }
}

const writeTrackingMode = (mode: TrackingMode) => {
  try {
    localStorage.setItem(TRACKING_MODE_KEY, mode)
  } catch {
    // ignorar errores de almacenamiento
  }
}

const isNoActiveRouteError = (error: any) =>
  error?.response?.status === 404

export const sendLocation = async (payload: UbicacionPayload): Promise<void> => {
  const mode = readTrackingMode()
  if (mode === 'envios') {
    await api.post('/envios/mi-ubicacion', { latitud: payload.lat, longitud: payload.lng })
    return
  }

  try {
    await api.put('/rutas/mi-ubicacion', payload)
    writeTrackingMode('rutas')
  } catch (error: any) {
    if (!isNoActiveRouteError(error)) throw error
    writeTrackingMode('envios')
    await api.post('/envios/mi-ubicacion', { latitud: payload.lat, longitud: payload.lng })
  }
}

export const sendBatch = async (posiciones: UbicacionConTimestamp[]): Promise<void> => {
  const mode = readTrackingMode()
  if (mode === 'envios') {
    for (const posicion of posiciones) {
      await api.post('/envios/mi-ubicacion', { latitud: posicion.lat, longitud: posicion.lng })
    }
    return
  }

  try {
    await api.post('/rutas/mi-ubicacion/lote', posiciones)
    writeTrackingMode('rutas')
  } catch (error: any) {
    if (!isNoActiveRouteError(error)) throw error
    writeTrackingMode('envios')
    for (const posicion of posiciones) {
      await api.post('/envios/mi-ubicacion', { latitud: posicion.lat, longitud: posicion.lng })
    }
  }
}
