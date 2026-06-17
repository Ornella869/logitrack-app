import { useCallback, useEffect, useState } from 'react'
import { gerenteSucursalService, type SucursalActiva, type SucursalHabilitada } from '../services/gerenteSucursalService'

interface UseSucursalActivaResult {
  sucursalActiva: SucursalActiva | null
  sucursalesHabilitadas: SucursalHabilitada[]
  loading: boolean
  setSucursalActiva: (id: string | null) => Promise<void>
}

export function useSucursalActiva(): UseSucursalActivaResult {
  const [sucursalActiva, setSucursalActivaState] = useState<SucursalActiva | null>(null)
  const [sucursalesHabilitadas, setSucursalesHabilitadas] = useState<SucursalHabilitada[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      gerenteSucursalService.getSucursalActiva(),
      gerenteSucursalService.getSucursalesHabilitadas(),
    ])
      .then(([activa, habilitadas]) => {
        setSucursalActivaState(activa)
        setSucursalesHabilitadas(habilitadas)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const setSucursalActiva = useCallback(async (id: string | null) => {
    await gerenteSucursalService.setSucursalActiva(id)
    const activa = id
      ? sucursalesHabilitadas.find((s) => s.id === id) ?? null
      : null
    setSucursalActivaState(activa ? { id: activa.id, nombre: activa.nombre, provincia: activa.provincia } : { id: null, nombre: null, provincia: null })
  }, [sucursalesHabilitadas])

  return { sucursalActiva, sucursalesHabilitadas, loading, setSucursalActiva }
}
