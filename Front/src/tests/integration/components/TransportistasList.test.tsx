import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TransportistasList from '../../../components/TransportistasList'

vi.mock('../../../services/authService', () => ({
  authService: {
    getTransportistas: vi.fn(),
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
  getTransportistas: ReturnType<typeof vi.fn>
}

const mockedRouteService = routeService as unknown as {
  getAllRoutes: ReturnType<typeof vi.fn>
}

describe('TransportistasList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CP-74 muestra estado vacio cuando no hay registros', async () => {
    mockedAuthService.getTransportistas.mockResolvedValue([])
    mockedRouteService.getAllRoutes.mockResolvedValue([])

    render(<TransportistasList userRole="operador" />)

    expect(await screen.findByText('No hay transportistas registrados')).toBeInTheDocument()
  })

  it('CP-73 muestra botones de accion para supervisor', async () => {
    mockedAuthService.getTransportistas.mockResolvedValue([
      {
        id: 't1',
        name: 'Ana',
        lastname: 'Diaz',
        email: 'ana@logi.com',
        dni: '12345678',
        licencia: 'LIC-1',
        role: 'transportista',
        estado: 'Activo',
      },
    ])
    mockedRouteService.getAllRoutes.mockResolvedValue([])

    render(<TransportistasList userRole="supervisor" />)

    expect(await screen.findByText('Editar licencia')).toBeInTheDocument()
    expect(screen.getByText('Suspender/Inhabilitar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Registrar transportista' })).toBeInTheDocument()
  })
})
