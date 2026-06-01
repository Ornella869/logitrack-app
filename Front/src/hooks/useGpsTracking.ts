import { useEffect, useRef, useState } from 'react'
import { sendLocation, sendBatch } from '../services/trackingService'

const QUEUE_KEY = 'gps_queue'
const INTERVAL_MS = 10_000

type PermissionStatus = 'prompt' | 'granted' | 'denied' | 'unavailable'

interface QueuedPosition {
  lat: number
  lng: number
  timestamp: number
}

const readQueue = (): QueuedPosition[] => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

const writeQueue = (q: QueuedPosition[]) =>
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))

const flushQueue = async () => {
  const queue = readQueue()
  if (queue.length === 0) return
  try {
    await sendBatch(queue)
    writeQueue([])
  } catch {
    // mantener la cola para el próximo intento
  }
}

export const useGpsTracking = (active: boolean) => {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>('prompt')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    if (!navigator.geolocation) {
      setPermissionStatus('unavailable')
      return
    }

    const capture = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setPermissionStatus('granted')
          const payload = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: Date.now(),
          }

          if (navigator.onLine) {
            sendLocation(payload).catch(() => {
              const q = readQueue()
              q.push(payload)
              writeQueue(q)
            })
          } else {
            const q = readQueue()
            q.push(payload)
            writeQueue(q)
          }
        },
        (err) => {
          if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
            setPermissionStatus('denied')
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
      )
    }

    capture()
    intervalRef.current = setInterval(capture, INTERVAL_MS)

    window.addEventListener('online', flushQueue)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('online', flushQueue)
    }
  }, [active])

  return { permissionStatus }
}
