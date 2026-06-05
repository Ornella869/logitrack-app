import api from './api'

export type PickUpPaqueteStatus =
  | 'PendienteDeCalendarizacion'
  | 'AsignadoAVehiculo'
  | 'CargadoEnVehiculo'
  | 'ListoParaSalir'
  | 'EnTransito'
  | 'Demorado'
  | 'ListoParaRetirar'
  | 'Entregado'
  | 'Cancelado'

export interface PickUpPaquete {
  id: string
  codigoSeguimiento: string
  codigoEntrega: string
  status: PickUpPaqueteStatus
  destinatario: string
  telefono?: string | null
  email?: string | null
  direccion: string
  localidad: string
  codigoPostal: string
  provincia?: string | null
  peso: number
  creadoEn: string
  fechaEstimadaEntrega?: string | null
}

export interface PickUpInventario {
  punto: {
    id: string
    nombre: string
    direccion: string
    localidad: string
    provincia: string
    horarios: string
    capacidadDiaria: number
    activo: boolean
  }
  capacidadUsada: number
  capacidadLibre: number
  enCamino: number
  listosParaRetirar: number
  entregadosHoy: number
  paquetes: PickUpPaquete[]
}

export const pickupOperacionService = {
  async inventario(): Promise<PickUpInventario> {
    const r = await api.get('/pickup-operacion/inventario')
    return r.data
  },

  async recibir(codigoSeguimiento: string): Promise<PickUpPaquete> {
    const r = await api.post('/pickup-operacion/recibir', { codigoSeguimiento })
    return r.data
  },

  async entregar(codigoSeguimiento: string, codigoEntrega: string): Promise<PickUpPaquete> {
    const r = await api.post('/pickup-operacion/entregar', { codigoSeguimiento, codigoEntrega })
    return r.data
  },
}
