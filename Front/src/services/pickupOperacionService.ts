import api from './api'

export type PickUpPaqueteStatus =
  | 'PendienteDeCalendarizacion'
  | 'AsignadoAVehiculo'
  | 'CargadoEnVehiculo'
  | 'ListoParaSalir'
  | 'EnTransito'
  | 'EnTransitoDescanso'
  | 'Demorado'
  | 'EntregadoEnPunto'
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
  fechaCalendarizada?: string | null
  fechaEstimadaEntrega?: string | null
  fechaListoParaRetirar?: string | null
  diasAlmacenado?: number | null
  repartidorNombre?: string | null
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
  pendienteRecepcion: number
  enCamino: number
  listosParaRetirar: number
  entregadosHoy: number
  paquetes: PickUpPaquete[]
}

export interface PickUpAgenda {
  fecha: string
  paquetes: PickUpPaquete[]
}

export interface PickUpHistorialEvento {
  estado: PickUpPaqueteStatus
  fechaHora: string
  origen: 'Manual' | 'QR' | 'Sistema' | number
  motivo?: string | null
}

export interface PickUpHistorialPaquete {
  paquete: PickUpPaquete
  ultimoMovimiento: string
  eventos: PickUpHistorialEvento[]
}

export const pickupOperacionService = {
  async inventario(): Promise<PickUpInventario> {
    const r = await api.get('/pickup-operacion/inventario')
    return r.data
  },

  async esperadosHoy(): Promise<PickUpAgenda> {
    const r = await api.get('/pickup-operacion/esperados-hoy')
    return r.data
  },

  async historial(): Promise<PickUpHistorialPaquete[]> {
    const r = await api.get('/pickup-operacion/historial')
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

  async devolver(codigoSeguimiento: string): Promise<PickUpPaquete> {
    const r = await api.post('/pickup-operacion/devolver', { codigoSeguimiento })
    return r.data
  },
}
