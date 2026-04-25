import { beforeEach, describe, expect, it, vi } from 'vitest'

import { authService } from '../../../services/authService'

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

import api from '../../../services/api'

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
}

const storage: Record<string, string> = {}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
      clear: () => {
        for (const key of Object.keys(storage)) {
          delete storage[key]
        }
      },
    },
    configurable: true,
  })
}

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('CP-06 login exitoso con credenciales validas', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        token: 'jwt-token',
        user: {
          id: 'user-1',
          nombre: 'Florencia',
          apellido: 'Dominguez',
          email: 'florencia@gmail.com',
          role: 'Operador',
        },
      },
    })

    const user = await authService.login({
      email: 'florencia@gmail.com',
      password: '12345678',
      recaptchaToken: 'captcha-token',
    })

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', {
      Email: 'florencia@gmail.com',
      Password: '12345678',
      RecaptchaToken: 'captcha-token',
    })
    expect(localStorage.getItem('authToken')).toBe('jwt-token')
    expect(user).toMatchObject({
      id: 'user-1',
      name: 'Florencia',
      lastname: 'Dominguez',
      email: 'florencia@gmail.com',
      role: 'operador',
    })
  })

  it('CP-07 y CP-08 devuelve null cuando credenciales son invalidas', async () => {
    mockedApi.post.mockRejectedValueOnce(new Error('Unauthorized'))

    const user = await authService.login({
      email: 'example@gmail.com',
      password: '888888',
      recaptchaToken: 'captcha-token',
    })

    expect(user).toBeNull()
    expect(localStorage.getItem('authToken')).toBeNull()
  })

  it('CP-20 registra transportista internamente', async () => {
    mockedApi.post.mockResolvedValueOnce({
      data: {
        id: 't-1',
        nombre: 'Juan',
        apellido: 'Perez',
        email: 'juan@logi.com',
        dni: '12345678',
        licencia: 'LIC-001',
        estado: 'Activo',
        temporaryPassword: 'temp1234',
      },
    })

    const result = await authService.createTransportista({
      name: 'Juan',
      lastname: 'Perez',
      email: 'juan@logi.com',
      dni: '12345678',
      licencia: 'LIC-001',
    })

    expect(mockedApi.post).toHaveBeenCalledWith('/auth/transportistas', {
      Nombre: 'Juan',
      Apellido: 'Perez',
      Email: 'juan@logi.com',
      DNI: '12345678',
      Licencia: 'LIC-001',
    })
    expect(result?.user.id).toBe('t-1')
    expect(result?.temporaryPassword).toBe('temp1234')
  })

  it('CP-21 falla alta de transportista con dni duplicado', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: 'El DNI ingresado ya se encuentra registrado' },
    })

    const result = await authService.createTransportista({
      name: 'Juan',
      lastname: 'Perez',
      email: 'juan@logi.com',
      dni: '12345678',
      licencia: 'LIC-001',
    })

    expect(result).toBeNull()
  })

  it('CP-09 validacion de campos obligatorios de login se soporta desde helpers', () => {
    expect(authService.isValidEmail('')).toBe(false)
    expect(authService.isValidPassword('')).toBe(false)
    expect(authService.isValidPassword('1234567')).toBe(false)
    expect(authService.isValidPassword('12345678')).toBe(true)
  })
})
