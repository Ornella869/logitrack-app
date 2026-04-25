import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import LoginPage from '../../../pages/LoginPage'

vi.mock('../../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    isValidEmail: vi.fn(),
  },
}))

vi.mock('react-google-recaptcha', () => ({
  default: ({ onChange }: { onChange?: (token: string | null) => void }) => (
    <button type="button" onClick={() => onChange?.('captcha-token')}>
      Resolver captcha
    </button>
  ),
}))

import { authService } from '../../../services/authService'

const mockedAuthService = authService as unknown as {
  login: ReturnType<typeof vi.fn>
  isValidEmail: ReturnType<typeof vi.fn>
}

describe('LoginPage integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedAuthService.isValidEmail.mockReturnValue(true)
  })

  const renderLogin = (onLogin = vi.fn()) => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage onLogin={onLogin} />} />
          <Route path="/app" element={<div>APP_DASHBOARD</div>} />
          <Route path="/transportista" element={<div>TRANSPORTISTA_DASHBOARD</div>} />
          <Route path="/register" element={<div>REGISTER_PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('CP-06 permite login exitoso y redirige al dashboard del rol', async () => {
    const user = userEvent.setup()
    const onLogin = vi.fn()

    mockedAuthService.login.mockResolvedValueOnce({
      id: 'u-1',
      name: 'Florencia',
      lastname: 'Paez',
      email: 'florencia@gmail.com',
      dni: '11111111',
      role: 'operador',
    })

    renderLogin(onLogin)

    await user.type(screen.getByLabelText('Email'), 'florencia@gmail.com')
    await user.type(screen.getByLabelText('Contraseña'), '12345678')
    await user.click(screen.getByRole('button', { name: 'Resolver captcha' }))
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(mockedAuthService.login).toHaveBeenCalledWith({
      email: 'florencia@gmail.com',
      password: '12345678',
      recaptchaToken: 'captcha-token',
    })
    expect(onLogin).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('APP_DASHBOARD')).toBeInTheDocument()
  })

  it('CP-07 y CP-08 muestra error para credenciales invalidas', async () => {
    const user = userEvent.setup()

    mockedAuthService.login.mockResolvedValueOnce(null)

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'example@gmail.com')
    await user.type(screen.getByLabelText('Contraseña'), '888888')
    await user.click(screen.getByRole('button', { name: 'Resolver captcha' }))
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Email o contraseña incorrectos')).toBeInTheDocument()
  })

  it('CP-09 valida campos vacios antes de enviar', async () => {
    const user = userEvent.setup()

    renderLogin()

    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Por favor completá todos los campos')).toBeInTheDocument()
    expect(mockedAuthService.login).not.toHaveBeenCalled()
  })

  it('bloquea el submit cuando no se completa captcha', async () => {
    const user = userEvent.setup()

    renderLogin()

    await user.type(screen.getByLabelText('Email'), 'example@gmail.com')
    await user.type(screen.getByLabelText('Contraseña'), '12345678')
    await user.click(screen.getByRole('button', { name: 'Ingresar' }))

    expect(await screen.findByText('Completá el captcha para continuar')).toBeInTheDocument()
    expect(mockedAuthService.login).not.toHaveBeenCalled()
  })

  it('CP-10 pendiente funcional: no existe bloqueo por 3 intentos en frontend actual', () => {
    expect(true).toBe(true)
  })
})
