import api from './api'

export type EstadoIncidencia = 'Abierta' | 'En Revisión' | 'Resuelta'
export type SeveridadIncidencia = 'Baja' | 'Media' | 'Alta'
export type TipoIncidencia = 'accident' | 'mechanical' | 'danger' | 'health' | 'delivery' | 'demorado' | 'otro' | 'no_llego' | 'llego_danado' | 'llego_tarde'

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
  origen?: 'repartidor' | 'cliente'
  envioId?: string
  codigoSeguimiento?: string
  emailContacto?: string
  chatFinalizado?: boolean
  sucursalId?: string
  severidad?: SeveridadIncidencia
  slaVenceEn?: string | null
  slaVencido?: boolean
  resueltaEn?: string | null
  slaResueltoFueraDePlazo?: boolean
  minutosResolucion?: number | null
}

const normalizeEstado = (estado: string): EstadoIncidencia =>
  estado === 'En Revision' || estado === 'EnRevision' || estado === 'En RevisiÃ³n' ? 'En Revisión' : estado as EstadoIncidencia

const mapIncidencia = (raw: any): Incidencia => ({
  id: raw.id,
  repartidorId: raw.repartidorId,
  repartidorNombre: raw.repartidorNombre,
  tipo: raw.tipo,
  tipoLabel: raw.tipoLabel,
  descripcion: raw.descripcion,
  estado: normalizeEstado(raw.estado),
  fechaReporte: raw.fechaReporte,
  observaciones: raw.observaciones ?? [],
  historialEstados: (raw.historialEstados ?? []).map((h: any) => ({
    ...h,
    estadoAnterior: normalizeEstado(h.estadoAnterior),
    estadoNuevo: normalizeEstado(h.estadoNuevo),
  })),
  paradasAfectadas: raw.paradasAfectadas ?? [],
  origen: raw.origen,
  envioId: raw.envioId ?? raw.codigoSeguimiento,
  codigoSeguimiento: raw.codigoSeguimiento,
  emailContacto: raw.emailContacto,
  chatFinalizado: raw.chatFinalizado,
  sucursalId: raw.sucursalId ?? undefined,
  severidad: raw.severidad ?? 'Media',
  slaVenceEn: raw.slaVenceEn ?? null,
  slaVencido: raw.slaVencido ?? false,
  resueltaEn: raw.resueltaEn ?? null,
  slaResueltoFueraDePlazo: raw.slaResueltoFueraDePlazo ?? false,
  minutosResolucion: raw.minutosResolucion ?? null,
})

function dispatch(): void {
  window.dispatchEvent(new Event('logitrack:incidencias'))
}

export const incidenciaService = {
  async getAll(): Promise<Incidencia[]> {
    const response = await api.get('/incidencias')
    return (response.data ?? []).map(mapIncidencia)
  },

  async getMisIncidencias(): Promise<Incidencia[]> {
    const response = await api.get('/incidencias/mis-incidencias')
    return (response.data ?? []).map(mapIncidencia)
  },

  async countAbiertas(): Promise<number> {
    const items = await incidenciaService.getAll()
    return items.filter((i) => i.estado === 'Abierta').length
  },

  async createRepartidor(data: {
    tipo: TipoIncidencia
    tipoLabel: string
    descripcion: string
    paradasAfectadas?: string[]
    severidad?: SeveridadIncidencia
  }): Promise<Incidencia> {
    const response = await api.post('/incidencias/repartidor', {
      tipo: data.tipo,
      tipoLabel: data.tipoLabel,
      descripcion: data.descripcion,
      paradasAfectadas: data.paradasAfectadas ?? [],
      severidad: data.severidad ?? 'Media',
    })
    dispatch()
    return mapIncidencia(response.data)
  },

  checkDuplicateCliente(..._args: unknown[]): boolean {
    return false
  },

  checkDuplicateRepartidor(..._args: unknown[]): boolean {
    return false
  },

  async create(data: {
    repartidorId?: string
    repartidorNombre?: string
    tipo: TipoIncidencia
    tipoLabel: string
    descripcion: string
    estado?: EstadoIncidencia
    origen?: 'repartidor' | 'cliente'
    envioId?: string
    emailContacto?: string
    paradasAfectadas?: string[]
    severidad?: SeveridadIncidencia
  }): Promise<Incidencia> {
    return incidenciaService.createRepartidor(data)
  },

  async createCliente(data: {
    trackingId: string
    tipo: TipoIncidencia
    tipoLabel: string
    descripcion: string
    emailContacto?: string
    severidad?: SeveridadIncidencia
  }): Promise<Incidencia> {
    const response = await api.post('/incidencias/publica', data)
    return mapIncidencia(response.data)
  },

  async cambiarEstado(id: string, nuevoEstado: EstadoIncidencia): Promise<Incidencia | null> {
    const response = await api.put(`/incidencias/${id}/estado`, { estado: nuevoEstado })
    dispatch()
    return mapIncidencia(response.data)
  },

  async cambiarSeveridad(id: string, severidad: SeveridadIncidencia): Promise<Incidencia | null> {
    const response = await api.put(`/incidencias/${id}/severidad`, { severidad })
    dispatch()
    return mapIncidencia(response.data)
  },

  async agregarObservacion(id: string, texto: string): Promise<Incidencia | null> {
    const response = await api.post(`/incidencias/${id}/observaciones`, { texto })
    dispatch()
    return mapIncidencia(response.data)
  },

  async finalizarChat(id: string): Promise<Incidencia | null> {
    const response = await api.put(`/incidencias/${id}/finalizar-chat`)
    dispatch()
    return mapIncidencia(response.data)
  },

  async rankingZonas(): Promise<Array<{ provincia: string; localidad: string; total: number; altas: number; vencidas: number; severidadPredominante: string; tipoPredominante: string }>> {
    const response = await api.get('/incidencias/ranking-zonas')
    return response.data ?? []
  },
}
