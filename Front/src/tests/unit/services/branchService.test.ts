import { beforeEach, describe, expect, it, vi } from 'vitest'

import { branchService } from '../../../services/branchService'

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

describe('branchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CP-51 lista sucursales con datos', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: [
        {
          id: 's-1',
          nombre: 'Sucursal Centro',
          direccion: 'Av. 9 de Julio 100',
          ciudad: 'Buenos Aires',
          telefono: '1144556677',
          estado: 'Activa',
        },
      ],
    })

    const branches = await branchService.getAllBranches()

    expect(branches).toHaveLength(1)
    expect(branches[0]).toMatchObject({
      id: 's-1',
      name: 'Sucursal Centro',
      status: 'Activa',
    })
  })

  it('CP-52 maneja estado vacio sin errores', async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [] })

    const branches = await branchService.getAllBranches()

    expect(branches).toEqual([])
  })

  it('CP-47 registra sucursal correctamente', async () => {
    mockedApi.post.mockResolvedValueOnce({})

    const created = await branchService.createBranch({
      name: 'Sucursal Nueva',
      address: 'Mitre 123',
      city: 'Rosario',
      postalCode: '2000',
      phone: '3411234567',
      status: 'Activa',
    })

    expect(mockedApi.post).toHaveBeenCalledWith('/envios/sucursales/registrar-sucursal', {
      Nombre: 'Sucursal Nueva',
      Direccion: 'Mitre 123',
      Ciudad: 'Rosario',
      Telefono: '3411234567',
    })
    expect(created.name).toBe('Sucursal Nueva')
  })

  it('CP-49 detecta nombre de sucursal duplicado', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: [
        {
          id: 's-1',
          nombre: 'Sucursal Centro',
          direccion: 'Av. 9 de Julio 100',
          ciudad: 'Buenos Aires',
          telefono: '1144556677',
          estado: 'Activa',
        },
      ],
    })

    const exists = await branchService.branchExists('sucursal centro')

    expect(exists).toBe(true)
  })
})
