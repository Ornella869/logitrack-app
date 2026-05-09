import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useParams: () => ({ id: 'sh-1' }),
    useNavigate: () => mockNavigate,
    useOutletContext: () => ({
      id: 'op-1',
      name: 'Juan',
      lastname: 'Perez',
      email: 'juan@logitrack.com',
      dni: '12345678',
      role: 'operador',
    }),
  }
})

vi.mock('../../../services/shipmentService', () => ({
  shipmentService: {
    getShipmentTracking: vi.fn(),
  },
}))

vi.mock('../../../components/ShipmentForm', () => ({
  default: () => null,
}))

vi.mock('../../../components/ShipmentTimeline', () => ({
  default: () => <div>TIMELINE</div>,
}))

vi.mock('../../../components/ShipmentMap', () => ({
  default: () => <div>MAPA</div>,
}))

import ShipmentDetail from '../../../pages/ShipmentDetail'
import { shipmentService } from '../../../services/shipmentService'

const mockedShipmentService = shipmentService as unknown as {
  getShipmentTracking: ReturnType<typeof vi.fn>
}

describe('ShipmentDetail navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedShipmentService.getShipmentTracking.mockResolvedValue({
      id: 'sh-1',
      trackingId: 'TRK-001',
      sender: { name: 'Remitente', address: 'A', city: 'B', postalCode: '1000' },
      receiver: { name: 'Destinatario', address: 'C', city: 'D', postalCode: '2000' },
      status: 'Pendiente de calendarización',
      origin: 'Buenos Aires',
      destination: 'La Plata',
      createdDate: '2026-05-01',
      lastUpdate: '2026-05-01',
      estimatedDelivery: '2026-05-02',
      weight: 5,
      description: 'Caja',
      isEditable: true,
    })
  })

  it('vuelve a /envios para roles no repartidor', async () => {
    const user = userEvent.setup()

    render(<ShipmentDetail />)

    await screen.findAllByRole('button', { name: 'Volver' })
    await user.click(screen.getAllByRole('button', { name: 'Volver' })[0])

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/envios', {
        state: { forceReload: expect.any(Number) },
      })
    })
  })
})
