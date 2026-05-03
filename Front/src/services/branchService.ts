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
  }
}
