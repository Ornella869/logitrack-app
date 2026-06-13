import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import RepartidoresList from '../../../components/RepartidoresList'

vi.mock('../../../services/authService', () => ({
  authService: {
    getRepartidoresPage: vi.fn(),
    isValidEmail: vi.fn().mockReturnValue(true),
  },
}))

import { authService } from '../../../services/authService'

const mockedAuthService = authService as unknown as {
  getRepartidoresPage: ReturnType<typeof vi.fn>
}

const emptyPage = {
  items: [],
  page: 1,
  pageSize: 8,
  totalItems: 0,
  totalPages: 1,
}

const renderList = () => render(
  <MemoryRouter>
    <RepartidoresList userRole="supervisor" />
  </MemoryRouter>,
)

describe('repartidoresList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuthService.getRepartidoresPage.mockResolvedValue(emptyPage)
  })

  it('CP-74 muestra estado vacio cuando no hay registros', async () => {
    renderList()

    expect(await screen.findByText('No hay repartidores registrados')).toBeInTheDocument()
  })

  it('muestra el filtro Tipo de jornada integrado con los filtros existentes', async () => {
    renderList()

    expect(await screen.findByText('Tipo de jornada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Part Time' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Full Time' })).toBeInTheDocument()
  })

  it('envia el filtro Part Time sin limpiar el filtro Activo', async () => {
    const user = userEvent.setup()
    renderList()

    await screen.findByText('No hay repartidores registrados')
    await user.click(screen.getByRole('button', { name: 'Activo' }))
    await user.click(screen.getByRole('button', { name: 'Part Time' }))

    await waitFor(() => {
      expect(mockedAuthService.getRepartidoresPage).toHaveBeenLastCalledWith(expect.objectContaining({
        accountStatus: 'activo',
        tipoJornada: 'part-time',
      }))
    })
  })
})
