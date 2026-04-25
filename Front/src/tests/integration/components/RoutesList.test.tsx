import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RoutesList from '../../../components/RoutesList'

vi.mock('../../../services/routeService', () => ({
  routeService: {
    getAllRoutes: vi.fn(),
    getRoutesByStatus: vi.fn(),
    createRoute: vi.fn(),
    assignTransportist: vi.fn(),
  },
}))

vi.mock('../../../services/authService', () => ({
  authService: {
    getTransportistas: vi.fn(),
  },
}))

vi.mock('../../../services/vehicleService', () => ({
  vehicleService: {
    getAssignableVehicles: vi.fn(),
  },
}))

vi.mock('../../../services/shipmentService', () => ({
  shipmentService: {
    getAssignableShipments: vi.fn(),
  },
}))

import { routeService } from '../../../services/routeService'
import { authService } from '../../../services/authService'
import { vehicleService } from '../../../services/vehicleService'
import { shipmentService } from '../../../services/shipmentService'

const mockedRouteService = routeService as unknown as {
  getAllRoutes: ReturnType<typeof vi.fn>
  getRoutesByStatus: ReturnType<typeof vi.fn>
  createRoute: ReturnType<typeof vi.fn>
  assignTransportist: ReturnType<typeof vi.fn>
}

const mockedAuthService = authService as unknown as {
  getTransportistas: ReturnType<typeof vi.fn>
}

const mockedVehicleService = vehicleService as unknown as {
  getAssignableVehicles: ReturnType<typeof vi.fn>
}

const mockedShipmentService = shipmentService as unknown as {
  getAssignableShipments: ReturnType<typeof vi.fn>
}

describe('RoutesList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRouteService.getAllRoutes.mockResolvedValue([
      {
        id: 'r1',
        routeId: 'R-1',
        shipmentIds: ['p1'],
        vehicleId: 'v1',
        transportistId: 't1',
        status: 'En Curso',
        createdDate: '2026-03-28',
        origin: 'Centro',
        destination: 'Norte',
      },
    ])
    mockedRouteService.getRoutesByStatus.mockResolvedValue([])
    mockedAuthService.getTransportistas.mockResolvedValue([
      { id: 't1', name: 'Ana', lastname: 'Diaz', dni: '12345678', estado: 'Activo' },
      { id: 't2', name: 'Luis', lastname: 'Lopez', dni: '87654321', estado: 'Suspendido' },
    ])
    mockedVehicleService.getAssignableVehicles.mockResolvedValue([
      { id: 'v1', patente: 'AA123BB', marca: 'Iveco', estado: 'Disponible' },
    ])
    mockedShipmentService.getAssignableShipments.mockResolvedValue([
      { id: 'p1', trackingId: 'LOG-1', origin: 'Centro', destination: 'Norte', status: 'En sucursal' },
    ])
    mockedRouteService.createRoute.mockResolvedValue({})
  })

  it('CP-42 oculta accion de asignar ruta para operador', async () => {
    render(<RoutesList userRole="operador" />)

    expect(await screen.findByText('R-1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Asignar ruta' })).not.toBeInTheDocument()
  })

  it('CP-57 muestra mensaje cuando filtro no tiene resultados', async () => {
    const user = userEvent.setup()
    render(<RoutesList userRole="supervisor" />)

    await screen.findByText('R-1')

    const combo = screen.getAllByRole('combobox')[0]
    fireEvent.mouseDown(combo)
    await user.click(await screen.findByRole('option', { name: 'Cancelada' }))

    expect(await screen.findByText('No hay rutas con este estado')).toBeInTheDocument()
  })

  it('CP-40 y CP-78 exige al menos un envio para guardar asignacion', async () => {
    const user = userEvent.setup()
    mockedShipmentService.getAssignableShipments.mockResolvedValue([])

    render(<RoutesList userRole="supervisor" />)

    await screen.findByText('R-1')
    await user.click(screen.getByRole('button', { name: 'Asignar ruta' }))

    await user.click(screen.getByRole('button', { name: 'Guardar asignación' }))

    expect(await screen.findByText(/al menos un envío/i)).toBeInTheDocument()
  })

  it('CP-58 mantiene nomenclatura de estados en tabla', async () => {
    render(<RoutesList userRole="supervisor" />)

    expect(await screen.findByText('En Curso')).toBeInTheDocument()
  })
})
