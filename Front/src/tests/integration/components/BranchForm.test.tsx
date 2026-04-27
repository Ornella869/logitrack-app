import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import BranchForm from '../../../components/BranchForm'

vi.mock('../../../services/branchService', () => ({
  branchService: {
    branchExists: vi.fn(),
    createBranch: vi.fn(),
  },
}))

import { branchService } from '../../../services/branchService'

const mockedBranchService = branchService as unknown as {
  branchExists: ReturnType<typeof vi.fn>
  createBranch: ReturnType<typeof vi.fn>
}

describe('BranchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CP-48 muestra error por campos incompletos', async () => {
    const user = userEvent.setup()

    render(<BranchForm open={true} onClose={vi.fn()} onBranchCreated={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Registrar Sucursal' }))

    expect(await screen.findByText('El nombre de la sucursal es requerido')).toBeInTheDocument()
  })

  it('CP-49 bloquea alta por nombre duplicado', async () => {
    const user = userEvent.setup()

    mockedBranchService.branchExists.mockResolvedValue(true)

    render(<BranchForm open={true} onClose={vi.fn()} onBranchCreated={vi.fn()} />)

    await user.type(screen.getByLabelText('Nombre de la sucursal'), 'Sucursal Centro')
    await user.type(screen.getByLabelText('Dirección'), 'Av. 9 de Julio 100')
    await user.type(screen.getByLabelText('Ciudad'), 'Buenos Aires')
    await user.type(screen.getByLabelText('Código Postal'), '1000')
    await user.type(screen.getByLabelText('Teléfono'), '1144556677')
    await user.click(screen.getByRole('button', { name: 'Registrar Sucursal' }))

    expect(await screen.findByText('Una sucursal con este nombre ya existe')).toBeInTheDocument()
  })

  it('CP-47 registra sucursal exitosamente', async () => {
    const user = userEvent.setup()
    const onBranchCreated = vi.fn()

    mockedBranchService.branchExists.mockResolvedValue(false)
    mockedBranchService.createBranch.mockResolvedValue({
      id: 's-1',
      name: 'Sucursal Centro',
      address: 'Av. 9 de Julio 100',
      city: 'Buenos Aires',
      postalCode: '1000',
      phone: '1144556677',
      status: 'Activa',
      createdDate: '2026-03-28',
    })

    render(<BranchForm open={true} onClose={vi.fn()} onBranchCreated={onBranchCreated} />)

    await user.type(screen.getByLabelText('Nombre de la sucursal'), 'Sucursal Centro')
    await user.type(screen.getByLabelText('Dirección'), 'Av. 9 de Julio 100')
    await user.type(screen.getByLabelText('Ciudad'), 'Buenos Aires')
    await user.type(screen.getByLabelText('Código Postal'), '1000')
    await user.type(screen.getByLabelText('Teléfono'), '1144556677')
    await user.click(screen.getByRole('button', { name: 'Registrar Sucursal' }))

    await waitFor(() => expect(onBranchCreated).toHaveBeenCalledTimes(1))
  })

  it('CP-50 aplica validacion numerica en codigo postal y telefono', async () => {
    const user = userEvent.setup()

    render(<BranchForm open={true} onClose={vi.fn()} onBranchCreated={vi.fn()} />)

    const postalInput = screen.getByLabelText('Código Postal') as HTMLInputElement
    const phoneInput = screen.getByLabelText('Teléfono') as HTMLInputElement

    await user.type(postalInput, '12ab')
    await user.type(phoneInput, '11-44aa')

    expect(postalInput.value).toBe('12')
    expect(phoneInput.value).toBe('1144')
  })
})
