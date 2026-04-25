export type UserRole = 'supervisor' | 'operador' | 'transportista'
export type TransportistaEstado = 'Activo' | 'Suspendido' | 'Inhabilitado'

export interface User {
  id: string
  name: string
  lastname: string
  email: string
  dni: string
  role: UserRole
  licencia?: string
  estado?: TransportistaEstado
}

export interface CreateTransportistaData {
  name: string
  lastname: string
  email: string
  dni: string
  licencia: string
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
  transportistId: string // ID del transportista asignado
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
  phone: string
  createdDate: string
  status: BranchStatus
}

export interface Shipment {
  id: string
  trackingId: string
  sender: {
    name: string
    address: string
    city: string
    postalCode: string
  }
  receiver: {
    name: string
    address: string
    city: string
    postalCode: string
  }
  status: 'En tránsito' | 'Entregado' | 'Cancelado' | 'Pendiente' | 'En sucursal' | 'Rechazado'
  origin: string
  destination: string
  createdDate: string
  lastUpdate: string
  estimatedDelivery: string
  weight: number
  description: string
  routeId?: string // ID de la ruta a la que pertenece
  cancellationReason?: string // Motivo de cancelación
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
