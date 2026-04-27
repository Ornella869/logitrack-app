import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RepartidoresList from '../../../components/RepartidoresList'

vi.mock('../../../services/authService', () => ({
  authService: {
    getRepartidores: vi.fn(),
    isValidEmail: vi.fn().mockReturnValue(true),
  },
}))

vi.mock('../../../services/routeService', () => ({
  routeService: {
    getAllRoutes: vi.fn(),
  },
}))

import { authService } from '../../../services/authService'
import { routeService } from '../../../services/routeService'

const mockedAuthService = authService as unknown as {
  getRepartidores: ReturnType<typeof vi.fn>
}

const mockedRouteService = routeService as unknown as {
  getAllRoutes: ReturnType<typeof vi.fn>
}

describe('repartidoresList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CP-74 muestra estado vacio cuando no hay registros', async () => {
    mockedAuthService.getRepartidores.mockResolvedValue([])
    mockedRouteService.getAllRoutes.mockResolvedValue([])

    render(<RepartidoresList userRole="operador" />)

    expect(await screen.findByText('No hay repartidores registrados')).toBeInTheDocument()
  })

  it('CP-73 muestra botones de accion para supervisor', async () => {
    mockedAuthService.getRepartidores.mockResolvedValue([
      {
        id: 't1',
        name: 'Ana',
        lastname: 'Diaz',
        email: 'ana@logi.com',
        dni: '12345678',
        licencia: 'LIC-1',
        role: 'Repartidor',
        estado: 'Activo',
      },
    ])
    mockedRouteService.getAllRoutes.mockResolvedValue([])

    render(<RepartidoresList userRole="supervisor" />)

    expect(await screen.findByText('Editar licencia')).toBeInTheDocument()
    expect(screen.getByText('Suspender/Inhabilitar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar Repartidor' })).toBeInTheDocument()
  })
})
