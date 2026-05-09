import type { PagedResult, Shipment, TipoEnvio, TipoPaquete } from '../types'
import api from './api'

// Tipos para requests al backend
interface RegistrarPaqueteRequest {
  Peso: number
  TipoEnvio: TipoEnvio
  TipoPaquete: TipoPaquete
  Comentarios?: string
  Remitente: {
    Nombre: string
    Apellido: string
    Direccion: string
    Localidad: string
    CP: string
    Provincia?: string
    Telefono?: string
  }
  Destinatario: {
    Nombre: string
    Apellido: string
    Direccion: string
    Localidad: string
    CP: string
    Provincia?: string
    Telefono?: string
  }
}

// Mapear status del backend al frontend
const mapStatus = (status: string): Shipment['status'] => {
  switch (status) {
    case 'PendienteDeCalendarizacion': return 'Pendiente de calendarización'
    case 'ListoParaSalir': return 'Listo para salir'
    case 'EnTransito': return 'En tránsito'
    case 'Entregado': return 'Entregado'
    case 'Cancelado': return 'Cancelado'
    case 'AsignadoAVehiculo': return 'Asignado a vehículo'
    case 'CargadoEnVehiculo': return 'Cargado en vehículo'
    default: return 'Pendiente de calendarización'
  }
}

// Mapear status del frontend al backend
const mapStatusToBackend = (status: string): string => {
  switch (status) {
    case 'Pendiente de calendarización': return 'PendienteDeCalendarizacion'
    case 'Listo para salir': return 'ListoParaSalir'
    case 'En tránsito':
    case 'EnTransito':
      return 'EnTransito'
    case 'Entregado': return 'Entregado'
    case 'Cancelado':
      return 'Cancelado'
    case 'Asignado a vehículo': return 'AsignadoAVehiculo'
    case 'Cargado en vehículo': return 'CargadoEnVehiculo'
    default:
      return 'PendienteDeCalendarizacion'
  }
}

// Convertir respuesta del backend a tipo Shipment
const mapToShipment = (paquete: any): Shipment => ({
  id: paquete.id,
  trackingId: paquete.codigoSeguimiento,
  sender: {
    name: [paquete.remitente?.nombre, paquete.remitente?.apellido].filter(Boolean).join(' ') || 'No disponible',
    address: paquete.remitente?.direccion?.calle ?? 'No disponible',
    city: paquete.remitente?.direccion?.ciudad ?? paquete.remitente?.ciudad ?? 'No disponible',
    postalCode: paquete.remitente?.direccion?.cp ?? paquete.remitente?.cp ?? 'No disponible',
    phone: paquete.remitente.telefono,
  },
  receiver: {
    name: [paquete.destinatario?.nombre, paquete.destinatario?.apellido].filter(Boolean).join(' ') || 'No disponible',
    address: paquete.destinatario?.direccion?.calle ?? 'No disponible',
    city: paquete.destinatario?.direccion?.ciudad ?? paquete.destinatario?.ciudad ?? 'No disponible',
    postalCode: paquete.destinatario?.direccion?.cp ?? paquete.destinatario?.cp ?? 'No disponible',
    phone: paquete.destinatario.telefono,
  },
  status: mapStatus(paquete.status),
  tipoEnvio: paquete.tipoEnvio as TipoEnvio | undefined,
  tipoPaquete: paquete.tipoPaquete as TipoPaquete | undefined,
  isEditable: paquete.isEditable ?? false,
  origin: paquete.remitente?.direccion?.ciudad ?? paquete.remitente?.ciudad ?? 'No disponible',
  destination: paquete.destinatario?.direccion?.ciudad ?? paquete.destinatario?.ciudad ?? 'No disponible',
  createdDate: paquete.creadoEn ? new Date(paquete.creadoEn).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
  lastUpdate: new Date().toISOString().split('T')[0],
  estimatedDelivery: '',
  weight: paquete.peso,
  description: paquete.descripcion || '',
  routeId: undefined,
  cancellationReason: paquete.razonCancelacion,
  fechaCalendarizada: paquete.fechaCalendarizada ?? null,
  ubicacionActual: paquete.ubicacionActual
    ? { latitud: paquete.ubicacionActual.latitud, longitud: paquete.ubicacionActual.longitud }
    : null,
  receiverUbicacion: paquete.destinatario?.direccion?.ubicacion
    ? { latitud: paquete.destinatario.direccion.ubicacion.latitud, longitud: paquete.destinatario.direccion.ubicacion.longitud }
    : null,
})

// Helper para separar nombre y apellido (si no hay apellido, usa "-")
const splitName = (fullName: string): { nombre: string; apellido: string } => {
  const parts = fullName.trim().split(' ')
  const nombre = parts[0] || '-'
  const apellido = parts.slice(1).join(' ') || '-'
  return { nombre, apellido }
}

const mapPagedShipments = (data: any): PagedResult<Shipment> => {
  if (Array.isArray(data)) {
    return {
      items: data.map(mapToShipment),
      page: 1,
      pageSize: data.length,
      totalItems: data.length,
      totalPages: 1,
    }
  }

  return {
    items: Array.isArray(data?.items) ? data.items.map(mapToShipment) : [],
    page: Number(data?.page ?? 1),
    pageSize: Number(data?.pageSize ?? 10),
    totalItems: Number(data?.totalItems ?? 0),
    totalPages: Number(data?.totalPages ?? 1),
  }
}

export const shipmentService = {
  // Registrar un nuevo paquete
  registerShipment: async (shipment: Omit<Shipment, 'id' | 'trackingId' | 'status' | 'createdDate' | 'lastUpdate' | 'estimatedDelivery' | 'routeId'>): Promise<Shipment | null> => {
    try {
      const remitente = splitName(shipment.sender.name)
      const destinatario = splitName(shipment.receiver.name)

      const request: RegistrarPaqueteRequest = {
        Peso: shipment.weight,
        TipoEnvio: shipment.tipoEnvio ?? 'Comun',
        TipoPaquete: shipment.tipoPaquete ?? 'Comun',
        Comentarios: shipment.description,
        Remitente: {
          Nombre: remitente.nombre,
          Apellido: remitente.apellido,
          Direccion: shipment.sender.address,
          Localidad: shipment.sender.city,
          CP: shipment.sender.postalCode,
          Provincia: shipment.sender.province,
          Telefono: shipment.sender.phone,
        },
        Destinatario: {
          Nombre: destinatario.nombre,
          Apellido: destinatario.apellido,
          Direccion: shipment.receiver.address,
          Localidad: shipment.receiver.city,
          CP: shipment.receiver.postalCode,
          Provincia: shipment.receiver.province,
          Telefono: shipment.receiver.phone,
        }
      }

      const registerResponse = await api.post('/envios/registrar-paquete', request)

      // El backend ahora devuelve { id, codigoSeguimiento, status, qrBase64 }
      if (registerResponse.data?.id) {
        const created = await shipmentService.getShipmentTracking(registerResponse.data.id)
        if (created) return created
      }

      // Fallback: buscar por destinatario en la lista
      const allShipments = await shipmentService.getAllShipments()
      const createdShipment = allShipments.find(s =>
        s.receiver.name.includes(destinatario.nombre) &&
        s.receiver.address === shipment.receiver.address
      )
      return createdShipment || allShipments[allShipments.length - 1] || null
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

  // Obtener paquetes en sucursal (pendientes de calendarización)
  getShipmentsInBranch: async (): Promise<Shipment[]> => {
    try {
      const response = await api.get('/envios/paquetes-pendientes')
      return response.data.map(mapToShipment)
    } catch (error) {
      console.error('Get shipments in branch error:', error)
      return []
    }
  },

  // Obtener paquetes pendientes de calendarización (para asignar a rutas)
  getPendingShipments: async (): Promise<Shipment[]> => {
    try {
      const response = await api.get('/envios/paquetes-pendientes')
      return response.data.map(mapToShipment)
    } catch (error) {
      console.error('Get pending shipments error:', error)
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
  cancelShipment: async (
    shipmentId: string,
    reason: string,
    mode: 'Definitivo' | 'Reagendar' = 'Definitivo'
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post(`/envios/cancelar-paquete/${shipmentId}`, { Motivo: reason, Mode: mode })
      return { success: true }
    } catch (error: any) {
      console.error('Cancel shipment error:', error)
      const errorMessage = error.response?.data || 'Error al cancelar el paquete'
      return { success: false, error: errorMessage }
    }
  },

  // Obtener envíos asignables a rutas (pendientes de calendarización)
  getAssignableShipments: async (): Promise<Shipment[]> => {
    try {
      return await shipmentService.getPendingShipments()
    } catch (error) {
      console.error('Get assignable shipments error:', error)
      return []
    }
  },

  getShipmentsPage: async (
    page: number,
    pageSize: number,
    search?: string,
    status?: string[],
    from?: string,
    to?: string,
  ): Promise<PagedResult<Shipment>> => {
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('pageSize', String(pageSize))
      if (search) params.set('search', search)
      if (status && status.length > 0) status.forEach((value) => params.append('status', value))
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      const response = await api.get(`/envios/paquetes?${params.toString()}`)
      return mapPagedShipments(response.data)
    } catch (error) {
      console.error('Get shipments page error:', error)
      return { items: [], page, pageSize, totalItems: 0, totalPages: 1 }
    }
  },

  // Obtener todos los envíos con búsqueda y filtros opcionales — G1L-39, G1L-40
  getAllShipments: async (
    search?: string,
    status?: string[],
    from?: string,
    to?: string,
  ): Promise<Shipment[]> => {
    try {
      const firstPage = await shipmentService.getShipmentsPage(1, 100, search, status, from, to)
      if (firstPage.totalPages <= 1) return firstPage.items

      const remainingPages = await Promise.all(
        Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
          shipmentService.getShipmentsPage(index + 2, 100, search, status, from, to),
        ),
      )

      return [firstPage, ...remainingPages].flatMap((result) => result.items)
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
  },

  // Editar envío pendiente de calendarización
  editShipment: async (
    paqueteId: string,
    data: Omit<Shipment, 'id' | 'trackingId' | 'status' | 'createdDate' | 'lastUpdate' | 'estimatedDelivery' | 'routeId'>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const remitente = splitName(data.sender.name)
      const destinatario = splitName(data.receiver.name)
      await api.put(`/envios/paquete/${paqueteId}`, {
        Peso: data.weight,
        TipoEnvio: data.tipoEnvio ?? 'Comun',
        TipoPaquete: data.tipoPaquete ?? 'Comun',
        Comentarios: data.description,
        Remitente: {
          Nombre: remitente.nombre,
          Apellido: remitente.apellido,
          Direccion: data.sender.address,
          Localidad: data.sender.city,
          CP: data.sender.postalCode,
          Provincia: data.sender.province,
          Telefono: data.sender.phone,
        },
        Destinatario: {
          Nombre: destinatario.nombre,
          Apellido: destinatario.apellido,
          Direccion: data.receiver.address,
          Localidad: data.receiver.city,
          CP: data.receiver.postalCode,
          Provincia: data.receiver.province,
          Telefono: data.receiver.phone,
        },
      })
      return { success: true }
    } catch (error: any) {
      const errorMessage = error.response?.data || 'Error al editar el envío'
      return { success: false, error: errorMessage }
    }
  },

  // Obtener historial de estados de un paquete
  getHistorial: async (paqueteId: string): Promise<HistorialEstadoEnvio[]> => {
    try {
      const response = await api.get(`/envios/paquete/${paqueteId}/historial`)
      return response.data
    } catch (error) {
      console.error('Get historial error:', error)
      return []
    }
  },

  // URL del QR de un paquete (imagen PNG)
  getQrUrl: (paqueteId: string): string => {
    return `${api.defaults.baseURL}/envios/paquete/${paqueteId}/qr`
  },

  // Obtener datos de etiqueta imprimible
  getEtiqueta: async (paqueteId: string): Promise<EtiquetaResponse | null> => {
    try {
      const response = await api.get(`/envios/paquete/${paqueteId}/etiqueta`)
      return response.data
    } catch (error) {
      console.error('Get etiqueta error:', error)
      return null
    }
  },

  // Escanear QR: transiciona estado del paquete
  escanearQr: async (codigoSeguimiento: string): Promise<{ success: boolean; data?: EscaneoResultado; error?: string }> => {
    try {
      const response = await api.post(`/envios/escanear-qr/${codigoSeguimiento}`)
      return { success: true, data: response.data }
    } catch (error: any) {
      const errorMessage = error.response?.data || 'Error al escanear el QR'
      return { success: false, error: errorMessage }
    }
  },

  // G1L-43: Inicializar Ruta — pasa todos los "Listo para Salir" del día a "En Tránsito".
  inicializarRuta: async (fecha?: string): Promise<{ success: boolean; cantidad?: number; error?: string }> => {
    try {
      const response = await api.post('/envios/inicializar-ruta', null, { params: fecha ? { fecha } : undefined })
      return { success: true, cantidad: response.data?.cantidad ?? 0 }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message ?? error.response?.data ?? 'No se pudo iniciar la ruta'
      return { success: false, error: errorMessage }
    }
  },

  // G1L-23: Ruta del día del repartidor logueado, ordenada por CP.
  // Si no se pasa fecha y no hay paradas hoy, devuelve la próxima fecha futura con asignaciones.
  getMiRutaDelDia: async (fecha?: string): Promise<{ fecha: string | null; paradas: Shipment[] }> => {
    try {
      const response = await api.get('/envios/mi-ruta-del-dia', { params: fecha ? { fecha } : undefined })
      return {
        fecha: response.data?.fecha ?? null,
        paradas: (response.data?.paradas ?? []).map(mapToShipment),
      }
    } catch (error) {
      console.error('Get mi-ruta-del-dia error:', error)
      return { fecha: null, paradas: [] }
    }
  },

  // G1L-18: Admin actualiza ubicación GPS del envío en tránsito.
  actualizarUbicacion: async (paqueteId: string, lat: number, lng: number): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.post(`/envios/paquete/${paqueteId}/ubicacion`, { latitud: lat, longitud: lng })
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.response?.data ?? 'No se pudo actualizar la ubicación' }
    }
  },

  // G1L-42: Repartidor asignado a un paquete (Supervisor / Admin)
  getRepartidorDePaquete: async (paqueteId: string): Promise<{ id: string; nombre: string; apellido: string; email: string; estado: string } | null> => {
    try {
      const r = await api.get(`/envios/paquete/${paqueteId}/repartidor-asignado`)
      if (r.status === 204 || !r.data) return null
      return r.data
    } catch {
      return null
    }
  },

  // Lista de fechas con asignaciones del repartidor logueado.
  getMisFechasDeRuta: async (): Promise<string[]> => {
    try {
      const response = await api.get('/envios/mis-fechas-ruta')
      return response.data ?? []
    } catch (error) {
      console.error('Get mis-fechas-ruta error:', error)
      return []
    }
  },
}

// G1L-54: Calendarización Automática
export interface RepartidorResumen {
  repartidorId: string
  nombre: string
  email: string
  cantidad: number
  pesoTotal: number
}

export interface DiaResumen {
  fecha: string
  cantidad: number
  repartidores: RepartidorResumen[]
}

export interface CalendarizacionResultado {
  totalPendientes: number
  totalCalendarizados: number
  totalSinAsignar: number
  resumenPorDia: DiaResumen[]
}

export const calendarizacionService = {
  contarPendientes: async (): Promise<number> => {
    try {
      const response = await api.get('/calendarizacion/pendientes')
      return response.data?.total ?? 0
    } catch (error) {
      console.error('Contar pendientes error:', error)
      return 0
    }
  },

  ejecutar: async (): Promise<{ success: boolean; data?: CalendarizacionResultado; error?: string }> => {
    try {
      const response = await api.post('/calendarizacion/ejecutar')
      return { success: true, data: response.data }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message ?? error.response?.data ?? 'No se pudo ejecutar la calendarización'
      return { success: false, error: typeof errorMessage === 'string' ? errorMessage : 'Error desconocido' }
    }
  },

  getEstadoActual: async (): Promise<DiaResumen[]> => {
    try {
      const response = await api.get('/calendarizacion/estado-actual')
      return response.data ?? []
    } catch (error) {
      console.error('Estado actual error:', error)
      return []
    }
  },
}

export interface HistorialEstadoEnvio {
  id: string
  paqueteId: string
  estadoNuevo: string
  fechaHora: string
  usuarioId?: string
  origen: 'Manual' | 'QR' | 'Sistema'
  motivo?: string
}

export interface EtiquetaResponse {
  codigoSeguimiento: string
  urlSeguimiento: string
  qrBase64: string
  remitente: EtiquetaCliente
  destinatario: EtiquetaCliente
  peso: number
  tipoEnvio: string
  tipoPaquete: string
}

export interface EtiquetaCliente {
  nombre: string
  apellido: string
  telefono?: string
  direccion: string
  ciudad: string
  cp: string
}

export interface EscaneoResultado {
  paqueteId: string
  codigoSeguimiento: string
  status: string
  accion: string
  mensaje?: string
}
