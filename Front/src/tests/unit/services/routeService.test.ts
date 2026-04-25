import { beforeEach, describe, expect, it, vi } from 'vitest'

import { routeService } from '../../../services/routeService'

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

const backendRoute = {
  id: 'route-1',
  estado: 'EnCurso',
  iniciadoEn: '2026-03-28T10:00:00Z',
  vehiculo: { id: 'v-1', marca: 'Iveco' },
  transportista: { id: 't-1' },
  paquetes: [{ id: 'p-1' }, { id: 'p-2' }],
}

describe('routeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CP-55 visualiza listado general de rutas', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [backendRoute] })

    const routes = await routeService.getAllRoutes()

    expect(routes).toHaveLength(1)
    expect(routes[0]).toMatchObject({
      id: 'route-1',
      status: 'En Curso',
      vehicleId: 'v-1',
      transportistId: 't-1',
      shipmentIds: ['p-1', 'p-2'],
    })
  })

  it('CP-39 genera ruta con multiples envios', async () => {
    mockedApi.post.mockResolvedValueOnce({})

    const created = await routeService.createRoute({
      shipmentIds: ['p-1', 'p-2', 'p-3'],
      vehicleId: 'v-1',
      transportistId: 't-1',
      status: 'Creada',
      origin: 'Buenos Aires',
      destination: 'La Plata',
    })

    expect(mockedApi.post).toHaveBeenCalledWith('/rutas/crear-ruta', {
      VehiculoId: 'v-1',
      TransportistaId: 't-1',
      PaqueteIds: ['p-1', 'p-2', 'p-3'],
    })
    expect(created.status).toBe('Creada')
  })

  it('CP-43 iniciar ruta actualiza estado en cascada via endpoint', async () => {
    mockedApi.post.mockResolvedValueOnce({})
    mockedApi.get.mockResolvedValueOnce({ data: [backendRoute] })

    const started = await routeService.startRoute('route-1')

    expect(mockedApi.post).toHaveBeenCalledWith('/rutas/comenzar-ruta/route-1')
    expect(started?.status).toBe('En Curso')
  })

  it('CP-79 cancelar ruta envia motivo y obtiene ruta actualizada', async () => {
    mockedApi.post.mockResolvedValueOnce({})
    mockedApi.get.mockResolvedValueOnce({ data: [{ ...backendRoute, estado: 'Cancelada' }] })

    const cancelled = await routeService.cancelRoute('route-1', 'Falla mecanica')

    expect(mockedApi.post).toHaveBeenCalledWith('/rutas/cancelar-ruta/route-1', { Razon: 'Falla mecanica' })
    expect(cancelled?.status).toBe('Cancelada')
  })
})
