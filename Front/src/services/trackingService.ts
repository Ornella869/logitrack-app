import api from './api'

interface UbicacionPayload {
  lat: number
  lng: number
}

interface UbicacionConTimestamp extends UbicacionPayload {
  timestamp: number
}

export const sendLocation = (payload: UbicacionPayload): Promise<void> =>
  api.put('/rutas/mi-ubicacion', payload).then(() => undefined)

export const sendBatch = (posiciones: UbicacionConTimestamp[]): Promise<void> =>
  api.post('/rutas/mi-ubicacion/lote', posiciones).then(() => undefined)
