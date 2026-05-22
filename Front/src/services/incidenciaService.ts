export type EstadoIncidencia = 'Abierta' | 'En Revisión' | 'Resuelta'
export type TipoIncidencia = 'accident' | 'mechanical' | 'danger' | 'health' | 'delivery' | 'otro'

export interface ObservacionIncidencia {
  texto: string
  supervisorNombre: string
  supervisorId: string
  fecha: string
}

export interface HistorialEstadoIncidencia {
  estadoAnterior: EstadoIncidencia
  estadoNuevo: EstadoIncidencia
  porNombre: string
  porId: string
  fecha: string
}

export interface Incidencia {
  id: string
  repartidorId: string
  repartidorNombre: string
  tipo: TipoIncidencia
  tipoLabel: string
  descripcion: string
  estado: EstadoIncidencia
  fechaReporte: string
  observaciones: ObservacionIncidencia[]
  historialEstados: HistorialEstadoIncidencia[]
  paradasAfectadas?: string[]
}

const STORAGE_KEY = 'logitrack_incidencias'
const MAX_STORED = 500

function loadAll(): Incidencia[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Incidencia[]
  } catch {
    return []
  }
}

function saveAll(items: Incidencia[]): void {
  const trimmed = items.length > MAX_STORED ? items.slice(items.length - MAX_STORED) : items
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
  window.dispatchEvent(new Event('logitrack:incidencias'))
}

export const incidenciaService = {
  getAll(): Incidencia[] {
    return loadAll().sort(
      (a, b) => new Date(b.fechaReporte).getTime() - new Date(a.fechaReporte).getTime(),
    )
  },

  getById(id: string): Incidencia | null {
    return loadAll().find((i) => i.id === id) ?? null
  },

  countByEstado(estado: EstadoIncidencia): number {
    return loadAll().filter((i) => i.estado === estado).length
  },

  countAbiertas(): number {
    return loadAll().filter((i) => i.estado === 'Abierta').length
  },

  create(data: Omit<Incidencia, 'id' | 'fechaReporte' | 'observaciones' | 'historialEstados'>): Incidencia {
    const all = loadAll()
    const nueva: Incidencia = {
      ...data,
      id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      fechaReporte: new Date().toISOString(),
      observaciones: [],
      historialEstados: [
        {
          estadoAnterior: 'Abierta',
          estadoNuevo: 'Abierta',
          porNombre: data.repartidorNombre,
          porId: data.repartidorId,
          fecha: new Date().toISOString(),
        },
      ],
    }
    all.push(nueva)
    saveAll(all)
    return nueva
  },

  cambiarEstado(
    id: string,
    nuevoEstado: EstadoIncidencia,
    supervisor: { id: string; nombre: string },
  ): Incidencia | null {
    const all = loadAll()
    const idx = all.findIndex((i) => i.id === id)
    if (idx < 0) return null
    const inc = all[idx]!
    inc.historialEstados.push({
      estadoAnterior: inc.estado,
      estadoNuevo: nuevoEstado,
      porNombre: supervisor.nombre,
      porId: supervisor.id,
      fecha: new Date().toISOString(),
    })
    inc.estado = nuevoEstado
    all[idx] = inc
    saveAll(all)
    return inc
  },

  agregarObservacion(
    id: string,
    texto: string,
    supervisor: { id: string; nombre: string },
  ): Incidencia | null {
    const all = loadAll()
    const idx = all.findIndex((i) => i.id === id)
    if (idx < 0) return null
    all[idx]!.observaciones.push({
      texto,
      supervisorNombre: supervisor.nombre,
      supervisorId: supervisor.id,
      fecha: new Date().toISOString(),
    })
    saveAll(all)
    return all[idx]!
  },
}
