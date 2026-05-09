import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockedNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockedNavigate,
}))

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

  it('CP-73 muestra el listado en modo solo lectura para supervisor', async () => {
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

    expect(await screen.findByText('Ana Diaz')).toBeInTheDocument()
    expect(screen.getByText('Cuenta: Activo')).toBeInTheDocument()
    expect(screen.getAllByText('Sin asignacion').length).toBeGreaterThan(0)
    expect(screen.queryByText('Editar licencia')).not.toBeInTheDocument()
    expect(screen.queryByText('Suspender/Inhabilitar')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar Repartidor' })).not.toBeInTheDocument()
  })

  it('CP-75 filtra repartidores con el buscador', async () => {
    const user = userEvent.setup()

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
      {
        id: 't2',
        name: 'Bruno',
        lastname: 'Perez',
        email: 'bruno@logi.com',
        dni: '87654321',
        licencia: 'LIC-2',
        role: 'Repartidor',
        estado: 'Activo',
      },
    ])
    mockedRouteService.getAllRoutes.mockResolvedValue([])

    render(<RepartidoresList userRole="supervisor" />)

    expect(await screen.findByText('Ana Diaz')).toBeInTheDocument()
    expect(screen.getByText('Bruno Perez')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Buscar por nombre, email, DNI o licencia...'), 'bruno')

    expect(screen.queryByText('Ana Diaz')).not.toBeInTheDocument()
    expect(screen.getByText('Bruno Perez')).toBeInTheDocument()
    expect(screen.getByText('Total: 1')).toBeInTheDocument()
  })

  it('CP-76 filtra repartidores por multiples estados', async () => {
    const user = userEvent.setup()

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
      {
        id: 't2',
        name: 'Bruno',
        lastname: 'Perez',
        email: 'bruno@logi.com',
        dni: '87654321',
        licencia: 'LIC-2',
        role: 'Repartidor',
        estado: 'Suspendido',
      },
      {
        id: 't3',
        name: 'Carla',
        lastname: 'Lopez',
        email: 'carla@logi.com',
        dni: '45678123',
        licencia: 'LIC-3',
        role: 'Repartidor',
        estado: 'Activo',
      },
    ])
    mockedRouteService.getAllRoutes.mockResolvedValue([
      { repartidorId: 't1', status: 'En Curso' },
      { repartidorId: 't3', status: 'Creada' },
    ])

    render(<RepartidoresList userRole="supervisor" />)

    expect(await screen.findByText('Ana Diaz')).toBeInTheDocument()
    expect(screen.getByText('Bruno Perez')).toBeInTheDocument()
    expect(screen.getByText('Carla Lopez')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Inactivo' }))
    await user.click(screen.getByRole('button', { name: 'Con ruta asignada' }))

    expect(screen.queryByText('Ana Diaz')).not.toBeInTheDocument()
    expect(screen.getByText('Bruno Perez')).toBeInTheDocument()
    expect(screen.getByText('Carla Lopez')).toBeInTheDocument()
    expect(screen.getByText('Total: 2')).toBeInTheDocument()
  })

  it('CP-77 combina filtros de estado con buscador', async () => {
    const user = userEvent.setup()

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
      {
        id: 't2',
        name: 'Bruno',
        lastname: 'Perez',
        email: 'bruno@logi.com',
        dni: '87654321',
        licencia: 'LIC-2',
        role: 'Repartidor',
        estado: 'Activo',
      },
    ])
    mockedRouteService.getAllRoutes.mockResolvedValue([
      { repartidorId: 't1', status: 'En Curso' },
      { repartidorId: 't2', status: 'En Curso' },
    ])

    render(<RepartidoresList userRole="supervisor" />)

    expect(await screen.findByText('Ana Diaz')).toBeInTheDocument()
    expect(screen.getByText('Bruno Perez')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'En viaje' }))
    await user.type(screen.getByPlaceholderText('Buscar por nombre, email, DNI o licencia...'), 'bruno')

    expect(screen.queryByText('Ana Diaz')).not.toBeInTheDocument()
    expect(screen.getByText('Bruno Perez')).toBeInTheDocument()
    expect(screen.getByText('Total: 1')).toBeInTheDocument()
  })

  it('CP-78 navega al perfil de rendimiento al hacer click en un repartidor', async () => {
    const user = userEvent.setup()

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

    await user.click(await screen.findByText('Ana Diaz'))

    expect(mockedNavigate).toHaveBeenCalledWith('/repartidor/t1/rendimiento')
  })
})
