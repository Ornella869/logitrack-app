import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import api from '../services/api'
import type { User, UserEstado, UserRole } from '../types'

// ── In-memory store ───────────────────────────────────────────────────────────

const mockStore: User[] = [
  { id: 'mock-1', name: 'Carlos', lastname: 'Rodríguez', email: 'carlos.rodriguez@logitrack.com', dni: '30123456', role: 'supervisor', estado: 'Activo' },
  { id: 'mock-2', name: 'Ana', lastname: 'Martínez', email: 'ana.martinez@logitrack.com', dni: '31234567', role: 'supervisor', estado: 'Activo' },
  { id: 'mock-3', name: 'Juan', lastname: 'Pérez', email: 'juan.perez@logitrack.com', dni: '32345678', role: 'operador', estado: 'Activo' },
  { id: 'mock-4', name: 'María', lastname: 'Gómez', email: 'maria.gomez@logitrack.com', dni: '33456789', role: 'operador', estado: 'Activo' },
  { id: 'mock-5', name: 'Luis', lastname: 'López', email: 'luis.lopez@logitrack.com', dni: '34567890', role: 'transportista', estado: 'Activo', licencia: 'LIC-2024-001' },
  { id: 'mock-6', name: 'Sofía', lastname: 'Fernández', email: 'sofia.fernandez@logitrack.com', dni: '35678901', role: 'transportista', estado: 'Activo', licencia: 'LIC-2024-002' },
  { id: 'mock-7', name: 'Lucía', lastname: 'Torres', email: 'lucia.torres@logitrack.com', dni: '36789012', role: 'operador', estado: 'Inactivo' },
  { id: 'mock-8', name: 'Martín', lastname: 'García', email: 'martin.garcia@logitrack.com', dni: '37890123', role: 'supervisor', estado: 'Activo' },
]
let nextId = 9

// ── Helpers ───────────────────────────────────────────────────────────────────

function toApiShape(u: User) {
  return {
    id: u.id,
    nombre: u.name,
    apellido: u.lastname,
    email: u.email,
    dni: u.dni,
    role: u.role,
    licencia: u.licencia,
    estado: u.estado ?? 'Activo',
  }
}

function ok(config: InternalAxiosRequestConfig, data: unknown, status = 200): Promise<AxiosResponse> {
  return Promise.resolve({ data, status, statusText: 'OK', headers: {}, config, request: {} })
}

function tempPassword(): string {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `Temp@${suffix}`
}

// ── Mock adapter — handles /auth/usuarios/* requests ─────────────────────────

function mockAdapter(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  const url = config.url ?? ''
  const method = config.method?.toLowerCase() ?? 'get'
  const body: Record<string, string> = config.data ? JSON.parse(config.data) : {}

  // GET /auth/usuarios
  if (method === 'get' && /\/auth\/usuarios\/?$/.test(url)) {
    return ok(config, mockStore.map(toApiShape))
  }

  // POST /auth/usuarios — crear usuario
  if (method === 'post' && /\/auth\/usuarios\/?$/.test(url)) {
    const role = ((body.Role ?? 'operador') as string).toLowerCase() as UserRole
    const newUser: User = {
      id: `mock-${nextId++}`,
      name: body.Nombre ?? '',
      lastname: body.Apellido ?? '',
      email: body.Email ?? '',
      dni: body.DNI ?? '',
      role,
      estado: 'Activo',
      ...(body.Licencia ? { licencia: body.Licencia } : {}),
    }
    mockStore.push(newUser)
    return ok(config, { ...toApiShape(newUser), temporaryPassword: tempPassword() }, 201)
  }

  // PUT /auth/usuarios/:id/estado — cambiar estado
  const estadoMatch = url.match(/\/auth\/usuarios\/([^/]+)\/estado\/?$/)
  if (method === 'put' && estadoMatch) {
    const id = estadoMatch[1]
    const idx = mockStore.findIndex((u) => u.id === id)
    if (idx >= 0) mockStore[idx].estado = body.Estado as UserEstado
    return ok(config, toApiShape(mockStore[idx] ?? mockStore[0]))
  }

  // PUT /auth/usuarios/:id — editar datos
  const editMatch = url.match(/\/auth\/usuarios\/([^/]+)\/?$/)
  if (method === 'put' && editMatch) {
    const id = editMatch[1]
    const idx = mockStore.findIndex((u) => u.id === id)
    if (idx >= 0) {
      mockStore[idx] = { ...mockStore[idx], name: body.Nombre, lastname: body.Apellido, email: body.Email, dni: body.DNI }
    }
    return ok(config, toApiShape(mockStore[idx] ?? mockStore[0]))
  }

  return Promise.reject(new Error(`[adminMock] Endpoint no manejado: ${method.toUpperCase()} ${url}`))
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function setupAdminMock() {
  api.interceptors.request.use((config) => {
    if (config.url?.includes('/auth/usuarios')) {
      config.adapter = mockAdapter
    }
    return config
  })
}

/**
 * Activa el mock del panel de administrador si VITE_ADMIN_DEMO=true o =1.
 * Llamar una sola vez al inicio de la aplicación (main.tsx).
 */
export function maybeSetupAdminMock() {
  const flag = import.meta.env.VITE_ADMIN_DEMO
  if (flag === 'true' || flag === '1') {
    setupAdminMock()
  }
}
