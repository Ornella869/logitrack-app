import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../../services/authService', () => ({
  authService: {
    register: vi.fn(),
    isValidEmail: vi.fn(() => true),
    isValidDni: vi.fn(() => true),
    isValidPassword: vi.fn(() => true),
  },
}))

import RegisterPage from '../../../pages/RegisterPage'

describe('RegisterPage navigation CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vuelve a la pagina anterior cuando hay historial', async () => {
    const user = userEvent.setup()

    vi.spyOn(window.history, 'length', 'get').mockReturnValue(2)

    render(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('redirecciona al inicio cuando no hay historial', async () => {
    const user = userEvent.setup()

    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)

    render(<RegisterPage />)

    await user.click(screen.getByRole('button', { name: 'Volver' }))

    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
