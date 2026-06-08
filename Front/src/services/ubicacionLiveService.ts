import { API_BASE_URL } from './api'

export type UbicacionActualizadaEvent = {
  paqueteId?: string
  repartidorId?: string
  codigoSeguimiento?: string
  latitud: number
  longitud: number
  actualizadaEn?: string
  origen?: 'gps' | 'manual'
}

export type UbicacionVisual = {
  latitud: number
  longitud: number
  actualizadaEn?: string
  codigoSeguimiento?: string
  origen?: 'gps' | 'manual'
}

export function mergeUbicacionPreferida(actual: UbicacionVisual | null, incoming: UbicacionVisual): UbicacionVisual {
  if (incoming.origen === 'gps') return incoming
  if (actual?.origen === 'gps') return actual
  return incoming
}

const RECORD_SEPARATOR = String.fromCharCode(30)
const HUB_URL = API_BASE_URL.replace(/\/api$/, '') + '/hubs/ubicacion'

export function subscribeUbicacionActualizada(
  onUpdate: (event: UbicacionActualizadaEvent) => void,
  onError?: () => void,
) {
  let socket: WebSocket | null = null
  let closed = false

  const connect = async () => {
    try {
      const negotiate = await fetch(`${HUB_URL}/negotiate?negotiateVersion=1`, { method: 'POST' })
      if (!negotiate.ok) throw new Error('No se pudo negociar SignalR')
      const data = await negotiate.json()
      const token = data.connectionToken || data.connectionId
      if (!token) throw new Error('SignalR no devolvio connectionToken')

      const wsUrl = `${HUB_URL.replace(/^http/, 'ws')}?id=${encodeURIComponent(token)}`
      socket = new WebSocket(wsUrl)

      socket.onopen = () => {
        socket?.send(JSON.stringify({ protocol: 'json', version: 1 }) + RECORD_SEPARATOR)
      }

      socket.onmessage = (message) => {
        const frames = String(message.data).split(RECORD_SEPARATOR).filter(Boolean)
        for (const frame of frames) {
          const payload = JSON.parse(frame)
          if (payload.type === 1 && payload.target === 'ubicacionActualizada' && payload.arguments?.[0]) {
            onUpdate(payload.arguments[0] as UbicacionActualizadaEvent)
          }
        }
      }

      socket.onerror = () => {
        if (!closed) onError?.()
      }
    } catch {
      if (!closed) onError?.()
    }
  }

  void connect()

  return () => {
    closed = true
    socket?.close()
  }
}
