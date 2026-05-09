import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import Layout from '../../../components/Layout'

vi.mock('@mui/material', async () => {
  const actual = await vi.importActual<typeof import('@mui/material')>('@mui/material')

  return {
    ...actual,
    useMediaQuery: () => false,
  }
})

vi.mock('../../../components/ChangePasswordDialog', () => ({
  default: () => null,
}))

const supervisorUser = {
  id: 'sup-1',
  name: 'Carla',
  lastname: 'Suarez',
  email: 'carla@logitrack.com',
  dni: '12345678',
  role: 'supervisor' as const,
}

const operadorUser = {
  id: 'op-1',
  name: 'Juan',
  lastname: 'Perez',
  email: 'juan@logitrack.com',
  dni: '12345678',
  role: 'operador' as const,
}

const adminUser = {
  id: 'adm-1',
  name: 'Ada',
  lastname: 'Min',
  email: 'admin@logitrack.com',
  dni: '12345678',
  role: 'administrador' as const,
}

function renderLayout(initialEntry: string, user = supervisorUser) {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<Layout user={user} onLogout={vi.fn()} />}>
          <Route path="/app" element={<div>APP</div>} />
          <Route path="/envios" element={<div>ENVIOS</div>} />
          <Route path="/calendarizar" element={<div>CALENDARIZAR</div>} />
          <Route path="/repartidor/:repartidorId/rendimiento" element={<div>RENDIMIENTO</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('Layout tabs', () => {
  it('activa la tab Dashboard en /app', () => {
    renderLayout('/app')

    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Envíos' })).toHaveAttribute('aria-selected', 'false')
  })

  it('activa la tab Envíos en /envios', () => {
    renderLayout('/envios')

    expect(screen.getByRole('tab', { name: 'Envíos' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'false')
  })

  it('no activa tabs de seccion en rutas de detalle', () => {
    renderLayout('/repartidor/rep-1/rendimiento')

    expect(screen.getByRole('tab', { name: 'Dashboard' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: 'Envíos' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByText('RENDIMIENTO')).toBeInTheDocument()
  })

  it('muestra tabs de Dashboard y Envíos para operador', () => {
    renderLayout('/app', operadorUser)

    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Envíos' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Calendarizar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Calendario Operativo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Rutas Activas' })).not.toBeInTheDocument()
  })

  it('no muestra la tab Envíos para administrador', () => {
    renderLayout('/app', adminUser)

    expect(screen.getByRole('tab', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Envíos' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calendario Operativo' })).toBeInTheDocument()
  })
})
