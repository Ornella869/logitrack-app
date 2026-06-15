export type UserRole = 'supervisor' | 'operador' | 'repartidor' | 'administrador' | 'gerente' | 'cliente' | 'socio_pickup'
export type UserEstado = 'Activo' | 'Inactivo'
export type RepartidorEstado = 'Activo' | 'Suspendido' | 'Inhabilitado'

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface User {
  id: string
  name: string
  lastname: string
  email: string
  dni: string
  role: UserRole
  activo?: boolean
  licencia?: string
  fechaVencimientoLicencia?: string | null
  estado?: UserEstado | RepartidorEstado
  motivoSuspension?: string | null
  // Épica D: ámbito del usuario.
  sucursalId?: string | null
  provincia?: string | null
  provincias?: string[] | null
  puntoPickUpId?: string | null
  horasTrabajo?: number
  tipoJornada?: 'Part Time' | 'Full Time'
  capacidadCargaKg?: number
  fotoPerfil?: string | null
  vencimientoLicencia?: string | null
  licenciaVencida?: boolean
  licenciaProximaAVencer?: boolean
}

export interface CreateRepartidorData {
  name: string
  lastname: string
  email: string
  dni: string
  licencia: string
  fechaVencimientoLicencia?: string | null
  capacidadCargaKg?: number
}

export interface CreateUsuarioData {
  name: string
  lastname: string
  email: string
  dni: string
  role: UserRole
  licencia?: string
  fechaVencimientoLicencia?: string | null
  capacidadCargaKg?: number
  passwordTemporal: string
  // Épica D: sucursal (Supervisor/Operador/Repartidor) o provincia (Gerente).
  sucursalId?: string
  provincia?: string
  puntoPickUpId?: string
}

export interface Vehicle {
  id: string
  patente: string
  marca: string
  capacidadCarga: number // en kg
  estado: 'Disponible' | 'En uso' | 'Mantenimiento' | 'Suspendido'
  createdDate: string
  operator?: string // ID del operador que registró el vehículo
  assignedRouteIds?: string[] // IDs de rutas asignadas actualmente activas
}

export interface Route {
  id: string
  routeId: string // Número identificador de la ruta
  shipmentIds: string[] // IDs de los envíos asignados
  vehicleId: string
  repartidorId: string // ID del repartidor asignado
  status: 'Creada' | 'En Curso' | 'Finalizada' | 'Cancelada'
  createdDate: string
  startDate?: string
  endDate?: string
  origin: string
  destination: string
}

export type BranchStatus = 'Activa' | 'Cerrada' | 'Inhabilitada'

export interface Branch {
  id: string
  name: string
  address: string
  city: string
  postalCode: string
  province?: string
  coveredProvinces?: string[]
  phone: string
  storageCapacityPackages?: number
  createdDate: string
  status: BranchStatus
}

export type TipoEnvio = 'Comun' | 'Prioritario'
export type TipoPaquete = 'Comun' | 'Fragil' | 'Pesado'

export interface Shipment {
  id: string
  trackingId: string
  codigoEntrega?: string | null
  sender: {
    name: string
    address: string
    city: string
    postalCode: string
    province?: string
    phone?: string
    email?: string
  }
  receiver: {
    name: string
    address: string
    city: string
    postalCode: string
    province?: string
    phone?: string
    email?: string
  }
  receiverUbicacion?: { latitud: number; longitud: number } | null
  status: 'En tránsito' | 'Entregado' | 'Cancelado' | 'Pendiente de calendarización' | 'Listo para salir' | 'Asignado a vehículo' | 'Cargado en vehículo' | 'Demorado' | 'Listo para retirar' | 'En tránsito - Descanso' | 'Entregado en punto' | 'Retornando a sucursal' | 'Retornado a sucursal'
  fechaCalendarizada?: string | null
  fechaEstimadaEntrega?: string | null
  sucursalId?: string | null
  ubicacionActual?: { latitud: number; longitud: number; origen?: 'gps' | 'manual' } | null
  tipoEnvio?: TipoEnvio
  tipoPaquete?: TipoPaquete
  isEditable?: boolean
  origin: string
  destination: string
  createdDate: string
  lastUpdate: string
  estimatedDelivery: string
  weight: number
  description: string
  routeId?: string // ID de la ruta a la que pertenece
  cancellationReason?: string // Motivo de cancelación
  // G1L-82: motivo de la demora cuando el envío está en estado "Demorado".
  razonDemora?: string | null
  // G1L-88: cotización congelada al alta.
  costoEnvio?: number
  costoRecargoSeguridad?: number
  esZonaPeligrosa?: boolean
  puntoPickUpId?: string | null
  puntoPickUpNombre?: string | null
  puntoPickUpDireccion?: string | null
  puntoPickUpLocalidad?: string | null
  puntoPickUpHorarios?: string | null
  puntoPickUpTelefono?: string | null
  horasEstimadasRuta?: number
  tramoOperativoId?: string | null
  ordenTramoOperativo?: number | null
  estadoTramoOperativo?: string | null
  origenTramoOperativo?: string | null
  destinoTramoOperativo?: string | null
  esTramoOperativoActual?: boolean
}

export interface LoginCredentials {
  email: string
  password: string
  recaptchaToken: string
}

export interface RegisterData {
  name: string
  lastname: string
  email: string
  dni: string
  password: string
  confirmPassword: string
  role: UserRole
}
