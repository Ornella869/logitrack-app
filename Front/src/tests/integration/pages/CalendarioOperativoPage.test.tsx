import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()
const mockUseOutletContext = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useOutletContext: () => mockUseOutletContext(),
  }
})

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: {
        dias: [],
        repartidores: [],
      },
    }),
  },
}))

import CalendarioOperativoPage from '../../../pages/CalendarioOperativoPage'

describe('CalendarioOperativoPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no muestra Nueva Calendarización para administrador', async () => {
    mockUseOutletContext.mockReturnValue({
      id: 'adm-1',
      name: 'Ada',
      lastname: 'Min',
      email: 'admin@logitrack.com',
      dni: '12345678',
      role: 'administrador',
    })

    render(<CalendarioOperativoPage />)

    expect(await screen.findByText('Calendario Operativo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Nueva Calendarización' })).not.toBeInTheDocument()
  })
})
