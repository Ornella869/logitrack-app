import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMine } = vi.hoisted(() => ({
  getMine: vi.fn(),
}))

vi.mock('../../../pages/landing/LandingPage', () => ({ default: () => <div>LANDING_PAGE</div> }))
vi.mock('../../../pages/LoginPage', () => ({ default: () => <div>LOGIN_PAGE</div> }))
vi.mock('../../../pages/RegisterPage', () => ({ default: () => <div>REGISTER_PAGE</div> }))
vi.mock('../../../pages/Dashboard', () => ({ default: () => <div>DASHBOARD_PAGE</div> }))
vi.mock('../../../pages/ShipmentDetail', () => ({ default: () => <div>SHIPMENT_DETAIL</div> }))
vi.mock('../../../pages/VehicleDetail', () => ({ default: () => <div>VEHICLE_DETAIL</div> }))
vi.mock('../../../pages/repartidor/RoutesDashboard', () => ({ default: () => <div>Repartidor_HOME</div> }))
vi.mock('../../../pages/repartidor/RouteDetail', () => ({ default: () => <div>Repartidor_DETAIL</div> }))
vi.mock('../../../components/Layout', () => ({
  default: () => <div>LAYOUT_WRAPPER</div>,
}))

vi.mock('../../../services/permissionService', () => ({
  permissionService: {
    getMine,
  },
}))

import App from '../../../App'

describe('App route guards', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.pushState({}, '', '/app')
    getMine.mockReset()
    getMine.mockResolvedValue(['dashboard'])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('CP-11 bloquea acceso a ruta privada sin sesion y redirige a login', async () => {
    render(<App />)

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
  })

  it('CP-12 expira sesion por inactividad y obliga a volver a iniciar sesion', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')

    localStorage.setItem('authToken', 'jwt-token')
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u-1',
        name: 'Florencia',
        lastname: 'Paez',
        email: 'florencia@gmail.com',
        dni: '12345678',
        role: 'operador',
      }),
    )

    render(<App />)

    expect(await screen.findByText('LAYOUT_WRAPPER')).toBeInTheDocument()

    const inactivityCall = setTimeoutSpy.mock.calls.find(([, delay]) => delay === 15 * 60 * 1000)
    const timeoutCallback = inactivityCall?.[0]
    expect(timeoutCallback).toBeTypeOf('function')

    act(() => {
      ;(timeoutCallback as () => void)()
    })

    expect(await screen.findByText('LOGIN_PAGE')).toBeInTheDocument()
    expect(localStorage.getItem('authToken')).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
  })

  it('redirige a login cuando recibe un logout interno de la app', async () => {
    localStorage.setItem('authToken', 'jwt-token')
    localStorage.setItem(
      'user',
      JSON.stringify({
        id: 'u-1',
        name: 'Florencia',
        lastname: 'Paez',
        email: 'florencia@gmail.com',
        dni: '12345678',
        role: 'operador',
      }),
    )

    render(<App />)

    expect(await screen.findByText('LAYOUT_WRAPPER')).toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new Event('logitrack:logout'))
    })

    expect(screen.getByText('LOGIN_PAGE')).toBeInTheDocument()
  })
})
