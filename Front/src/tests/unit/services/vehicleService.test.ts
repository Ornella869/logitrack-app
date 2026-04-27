import { beforeEach, describe, expect, it, vi } from 'vitest'

import { vehicleService } from '../../../services/vehicleService'
import { makeBackendVehicle } from '../../fixtures/backendVehicle'

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '../../../services/api'

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

describe('vehicleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mapea estado EnUso del backend a En uso en frontend', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: [makeBackendVehicle({ estado: 'EnUso' })],
    })

    const vehicles = await vehicleService.getAllVehicles()

    expect(vehicles).toHaveLength(1)
    expect(vehicles[0].estado).toBe('En uso')
    expect(mockedApi.get).toHaveBeenCalledWith('/envios/vehiculos/activos')
  })

  it('crea vehiculo con payload esperado y devuelve creado', async () => {
    mockedApi.post.mockResolvedValueOnce({})
    mockedApi.get.mockResolvedValueOnce({
      data: [makeBackendVehicle({ id: 'vehicle-new', patente: 'AB999CD', marca: 'Volvo' })],
    })

    const created = await vehicleService.createVehicle({
      patente: 'AB999CD',
      marca: 'Volvo',
      capacidadCarga: 3500,
      estado: 'Disponible',
      createdDate: '2026-03-28',
      operator: 'op-2',
    })

    expect(mockedApi.post).toHaveBeenCalledWith('/envios/vehiculos/registrar-vehiculo', {
      Patente: 'AB999CD',
      Modelo: 'Volvo',
      Capacidad: 3500,
    })
    expect(created.id).toBe('vehicle-new')
  })

  it('valida existencia de patente sin distinguir mayusculas', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: [makeBackendVehicle({ patente: 'AA123BB' })],
    })

    const exists = await vehicleService.patenteExists('aa123bb')

    expect(exists).toBe(true)
  })

  it('cambia estado de vehiculo usando mapeo de frontend a backend', async () => {
    mockedApi.post.mockResolvedValueOnce({})

    const result = await vehicleService.changeVehicleStatus('vehicle-1', 'En uso')

    expect(result).toEqual({ success: true })
    expect(mockedApi.post).toHaveBeenCalledWith('/envios/vehiculos/vehicle-1/estado/EnUso')
  })

  it('retorna error cuando falla suspender vehiculo', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: 'No autorizado' },
    })

    const result = await vehicleService.suspendVehicle('vehicle-1')

    expect(result).toEqual({ success: false, error: 'No autorizado' })
  })
})
