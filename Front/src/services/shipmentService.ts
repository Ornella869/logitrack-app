import type { Shipment } from '../types'
import api from './api'

// Tipos para requests al backend
interface RegistrarPaqueteRequest {
  Peso: number
  Comentarios?: string
  Remitente: {
    Nombre: string
    Apellido: string
    Direccion: string
    Localidad: string
    CP: string
  }
  Destinatario: {
    Nombre: string
    Apellido: string
    Direccion: string
    Localidad: string
    CP: string
  }
}

// Mapear status del backend al frontend
const mapStatus = (status: string): Shipment['status'] => {
  switch (status) {
    case 'EnSucursal': return 'En sucursal'
    case 'EnTransito': return 'En tránsito'
    case 'Entregado': return 'Entregado'
    case 'Rechazado': return 'Rechazado'
    case 'Cancelado': return 'Cancelado'
    default: return 'En sucursal'
  }
}

// Mapear status del frontend al backend
const mapStatusToBackend = (status: string): string => {
  switch (status) {
    case 'Pendiente':
    case 'En sucursal':
      return 'EnSucursal'
    case 'En tránsito':
    case 'EnTransito':
      return 'EnTransito'
    case 'Entregado':
      return 'Entregado'
    case 'Rechazado':
      return 'Cancelado'
    case 'Cancelado':
      return 'Cancelado'
    default:
      return 'EnSucursal'
  }
}

// Convertir respuesta del backend a tipo Shipment
const mapToShipment = (paquete: any): Shipment => ({
  id: paquete.id,
  trackingId: paquete.codigoSeguimiento,
  sender: {
    name: `${paquete.remitente.nombre} ${paquete.remitente.apellido}`,
    address: paquete.remitente.direccion.calle,
    city: paquete.remitente.direccion.ciudad,
    postalCode: paquete.remitente.direccion.cp
  },
  receiver: {
    name: `${paquete.destinatario.nombre} ${paquete.destinatario.apellido}`,
    address: paquete.destinatario.direccion.calle,
    city: paquete.destinatario.direccion.ciudad,
    postalCode: paquete.destinatario.direccion.cp
  },
  status: mapStatus(paquete.status),
  origin: paquete.remitente.direccion.ciudad,
  destination: paquete.destinatario.direccion.ciudad,
  createdDate: paquete.creadoEn ? new Date(paquete.creadoEn).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  lastUpdate: new Date().toISOString().split('T')[0],
  estimatedDelivery: '',
  weight: paquete.peso,
  description: paquete.descripcion || '',
  routeId: undefined,
  cancellationReason: paquete.razonCancelacion
})

// Helper para separar nombre y apellido (si no hay apellido, usa "-")
const splitName = (fullName: string): { nombre: string; apellido: string } => {
  const parts = fullName.trim().split(' ')
  const nombre = parts[0] || '-'
  const apellido = parts.slice(1).join(' ') || '-'
  return { nombre, apellido }
}

export const shipmentService = {
  // Registrar un nuevo paquete
  registerShipment: async (shipment: Omit<Shipment, 'id' | 'trackingId' | 'status' | 'createdDate' | 'lastUpdate' | 'estimatedDelivery' | 'routeId'>): Promise<Shipment | null> => {
    try {
      const remitente = splitName(shipment.sender.name)
      const destinatario = splitName(shipment.receiver.name)

      const request: RegistrarPaqueteRequest = {
        Peso: shipment.weight,
        Comentarios: shipment.description,
        Remitente: {
          Nombre: remitente.nombre,
          Apellido: remitente.apellido,
          Direccion: shipment.sender.address,
          Localidad: shipment.sender.city,
          CP: shipment.sender.postalCode
        },
        Destinatario: {
          Nombre: destinatario.nombre,
          Apellido: destinatario.apellido,
          Direccion: shipment.receiver.address,
          Localidad: shipment.receiver.city,
          CP: shipment.receiver.postalCode
        }
      }

      await api.post('/envios/registrar-paquete', request)

      // Obtener lista actualizada y buscar el paquete recién creado
      const allShipments = await shipmentService.getAllShipments()

      // Buscar el paquete más reciente que coincida con los datos del destinatario
      const createdShipment = allShipments.find(s =>
        s.receiver.name.includes(destinatario.nombre) &&
        s.receiver.address === shipment.receiver.address
      )

      if (createdShipment) {
        return createdShipment
      }

      // Fallback: devolver el más reciente (último creado)
      return allShipments[allShipments.length - 1] || null
    } catch (error) {
      console.error('Register shipment error:', error)
      return null
    }
  },

  // Obtener seguimiento de un paquete por ID (GUID)
  getShipmentTracking: async (paqueteId: string): Promise<Shipment | null> => {
    try {
      const response = await api.get(`/envios/paquete/${paqueteId}`)
      console.log('[DEBUG] Backend response for paquete:', response.data)
      console.log('[DEBUG] Status from backend:', response.data.status)
      const mapped = mapToShipment(response.data)
      console.log('[DEBUG] Mapped shipment status:', mapped.status)
      return mapped
    } catch (error) {
      console.error('Get shipment tracking error:', error)
      return null
    }
  },

  // Obtener seguimiento por código de seguimiento
  getShipmentByTrackingCode: async (codigoSeguimiento: string): Promise<Shipment | null> => {
    try {
      const response = await api.get(`/envios/seguimiento/${codigoSeguimiento}`)
      return mapToShipment(response.data)
    } catch (error) {
      console.error('Get shipment by tracking code error:', error)
      return null
    }
  },

  // Obtener paquetes en sucursal
  getShipmentsInBranch: async (): Promise<Shipment[]> => {
    try {
      const response = await api.get('/envios/paquetes-en-sucursal')
      return response.data.map(mapToShipment)
    } catch (error) {
      console.error('Get shipments in branch error:', error)
      return []
    }
  },

  // Cambiar estado de paquete
  changeShipmentStatus: async (shipmentId: string, status: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const backendStatus = mapStatusToBackend(status)
      console.log('[DEBUG] Changing status:', { shipmentId, frontendStatus: status, backendStatus })
      await api.post(`/envios/cambiar-estado-paquete/${shipmentId}/estado/${backendStatus}`)
      return { success: true }
    } catch (error: any) {
      console.error('Change shipment status error:', error)
      const errorMessage = error.response?.data || 'Error al cambiar el estado del envío'
      return { success: false, error: errorMessage }
    }
  },

  // Reenviar paquete cancelado
  resendCancelledShipment: async (shipmentId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post(`/envios/reenviar-paquete/${shipmentId}`)
      return { success: true }
    } catch (error: any) {
      console.error('Resend shipment error:', error)
      const errorMessage = error.response?.data || 'Error al reenviar el paquete'
      return { success: false, error: errorMessage }
    }
  },

  // Cancelar paquete con motivo específico
  cancelShipment: async (shipmentId: string, reason: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post(`/envios/cancelar-paquete/${shipmentId}`, { Motivo: reason })
      return { success: true }
    } catch (error: any) {
      console.error('Cancel shipment error:', error)
      const errorMessage = error.response?.data || 'Error al cancelar el paquete'
      return { success: false, error: errorMessage }
    }
  },

  // Obtener envíos asignables (en sucursal)
  getAssignableShipments: async (): Promise<Shipment[]> => {
    try {
      return await shipmentService.getShipmentsInBranch()
    } catch (error) {
      console.error('Get assignable shipments error:', error)
      return []
    }
  },

  // Generar tracking ID único
  generateTrackingId: async (): Promise<string> => {
    // En una implementación real, el backend generaría el ID
    return `LT-${Date.now()}`
  },

  // Verificar si tracking ID existe
  trackingIdExists: async (trackingId: string): Promise<boolean> => {
    try {
      const shipment = await shipmentService.getShipmentTracking(trackingId)
      return shipment !== null
    } catch (error) {
      return false
    }
  },

  // Obtener todos los envíos (todos los estados)
  getAllShipments: async (): Promise<Shipment[]> => {
    try {
      const response = await api.get('/envios/todos-los-paquetes')
      return response.data.map(mapToShipment)
    } catch (error) {
      console.error('Get all shipments error:', error)
      return []
    }
  },

  // Buscar por tracking ID (código de seguimiento)
  searchByTrackingId: async (trackingId: string): Promise<Shipment | null> => {
    try {
      return await shipmentService.getShipmentByTrackingCode(trackingId)
    } catch (error) {
      console.error('Search by tracking ID error:', error)
      return null
    }
  }
}