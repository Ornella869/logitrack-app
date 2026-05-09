import type { Branch } from '../types'
import api from './api'

// Tipos para requests al backend
interface RegistarSucursalRequest {
  Nombre: string
  Direccion: string
  Ciudad: string
  CodigoPostal: string
  Telefono: string
}

// Mapear status del backend al frontend
const mapStatus = (status: string): Branch['status'] => {
  switch (status) {
    case 'Activa': return 'Activa'
    case 'Inhabilitada': return 'Inhabilitada'
    case 'Cerrada': return 'Cerrada'
    default: return 'Activa'
  }
}

// Mapear datos del backend al tipo Branch
const mapToBranch = (sucursal: any): Branch => ({
  id: sucursal.id,
  name: sucursal.nombre,
  address: sucursal.direccion,
  city: sucursal.ciudad,
  postalCode: sucursal.codigoPostal ?? '',
  phone: sucursal.telefono,
  createdDate: new Date().toISOString().split('T')[0],
  status: mapStatus(sucursal.estado)
})

// Convertir respuesta del backend a tipo Branch
export const branchService = {
  // Obtener todas las sucursales
  getAllBranches: async (): Promise<Branch[]> => {
    try {
      const response = await api.get('/envios/sucursales')
      return response.data.map(mapToBranch)
    } catch (error) {
      console.error('Get branches error:', error)
      return []
    }
  },

  // Obtener una sucursal por ID
  getBranchById: async (id: string): Promise<Branch | null> => {
    try {
      const branches = await branchService.getAllBranches()
      return branches.find(b => b.id === id) || null
    } catch (error) {
      console.error('Get branch by id error:', error)
      return null
    }
  },

  // Crear una nueva sucursal
  createBranch: async (branchData: Omit<Branch, 'id' | 'createdDate'>): Promise<Branch> => {
    try {
      const request: RegistarSucursalRequest = {
        Nombre: branchData.name,
        Direccion: branchData.address,
        Ciudad: branchData.city,
        CodigoPostal: branchData.postalCode,
        Telefono: branchData.phone,
      }

      await api.post('/envios/sucursales/registrar-sucursal', request)

      return {
        ...branchData,
        id: Date.now().toString(),
        createdDate: new Date().toISOString().split('T')[0]
      }
    } catch (error) {
      console.error('Create branch error:', error)
      throw error
    }
  },

  // Actualizar una sucursal existente
  updateBranch: async (id: string, branchData: Omit<Branch, 'id' | 'createdDate'>): Promise<Branch> => {
    try {
      const request: RegistarSucursalRequest = {
        Nombre: branchData.name,
        Direccion: branchData.address,
        Ciudad: branchData.city,
        CodigoPostal: branchData.postalCode,
        Telefono: branchData.phone,
      }
      await api.put(`/envios/sucursales/${id}`, request)
      return {
        ...branchData,
        id,
        createdDate: new Date().toISOString().split('T')[0],
      }
    } catch (error) {
      console.error('Update branch error:', error)
      throw error
    }
  },

  // Eliminar una sucursal por ID
  deleteBranch: async (id: string): Promise<void> => {
    try {
      await api.delete(`/envios/sucursales/${id}`)
    } catch (error) {
      console.error('Delete branch error:', error)
      throw error
    }
  },

  // Buscar sucursales por nombre
  searchBranches: async (query: string): Promise<Branch[]> => {
    try {
      const branches = await branchService.getAllBranches()
      return branches.filter(b => b.name.toLowerCase().includes(query.toLowerCase()))
    } catch (error) {
      console.error('Search branches error:', error)
      return []
    }
  },

  // Verificar si una sucursal existe por nombre
  branchExists: async (name: string): Promise<boolean> => {
    try {
      const branches = await branchService.getAllBranches()
      return branches.some(b => b.name.toLowerCase() === name.toLowerCase())
    } catch (error) {
      console.error('Check branch exists error:', error)
      return false
    }
  },

  // Sucursal de origen geocodificada — la usa el repartidor para pintar en su mapa
  // el punto de salida y trazar la ruta hacia las paradas del día.
  // Si el backend no pudo geocodificar (ej. Nominatim caído desde el server),
  // hacemos el fallback acá pegándole desde el navegador.
  getSucursalOrigen: async (): Promise<BranchOrigin | null> => {
    try {
      const response = await api.get('/envios/sucursal-origen')
      if (response.status === 204 || !response.data) return null
      const data = response.data
      const branch: BranchOrigin = {
        id: data.id,
        name: data.nombre,
        address: data.direccion,
        city: data.ciudad,
        postalCode: data.codigoPostal ?? '',
        phone: data.telefono ?? '',
        latitud: typeof data.latitud === 'number' ? data.latitud : null,
        longitud: typeof data.longitud === 'number' ? data.longitud : null,
      }

      if (branch.latitud == null || branch.longitud == null) {
        const coords = await geocodeFromBrowser(branch.address, branch.city, branch.postalCode)
        if (coords) {
          branch.latitud = coords.lat
          branch.longitud = coords.lng
        } else {
          console.warn('[sucursal-origen] no se pudo geocodificar:', branch.address, branch.city, branch.postalCode)
        }
      }

      return branch
    } catch (error) {
      console.error('Get sucursal origen error:', error)
      return null
    }
  },
}

// Geocoding directo desde el navegador (Nominatim). Tiene CORS habilitado,
// rate-limit ~1 req/seg pero por usuario, así que escala bien.
async function geocodeFromBrowser(
  street: string,
  city: string,
  postalcode?: string,
): Promise<{ lat: number; lng: number } | null> {
  const tryQuery = async (params: Record<string, string>): Promise<{ lat: number; lng: number } | null> => {
    const qs = new URLSearchParams({
      ...params,
      countrycodes: 'ar',
      format: 'json',
      limit: '1',
      'accept-language': 'es',
    }).toString()
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`)
      if (!r.ok) return null
      const data = await r.json()
      const first = Array.isArray(data) && data.length > 0 ? data[0] : null
      if (!first?.lat || !first?.lon) return null
      const lat = parseFloat(first.lat)
      const lng = parseFloat(first.lon)
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null
      return { lat, lng }
    } catch {
      return null
    }
  }

  // 1) Estructurada con CP.
  if (postalcode) {
    const r = await tryQuery({ street, city, postalcode })
    if (r) return r
  }
  // 2) Estructurada sin CP.
  const r2 = await tryQuery({ street, city })
  if (r2) return r2
  // 3) Free-text con todo.
  const free = postalcode ? `${street}, ${city}, ${postalcode}, Argentina` : `${street}, ${city}, Argentina`
  const r3 = await tryQuery({ q: free })
  if (r3) return r3
  // 4) Último recurso: ciudad + CP (centro).
  const cityFree = postalcode ? `${city}, ${postalcode}, Argentina` : `${city}, Argentina`
  return tryQuery({ q: cityFree })
}

export interface BranchOrigin {
  id: string
  name: string
  address: string
  city: string
  postalCode: string
  phone: string
  latitud: number | null
  longitud: number | null
}
