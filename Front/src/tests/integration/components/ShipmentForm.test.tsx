import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ShipmentForm from '../../../components/ShipmentForm'

vi.mock('../../../services/branchService', () => ({
  branchService: {
    getAllBranches: vi.fn(),
  },
}))

import { branchService } from '../../../services/branchService'

const mockedBranchService = branchService as unknown as {
  getAllBranches: ReturnType<typeof vi.fn>
}

describe('ShipmentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedBranchService.getAllBranches.mockResolvedValue([
      { id: 'b1', name: 'Centro' },
      { id: 'b2', name: 'Norte' },
    ])
  })

  it('CP-18 muestra errores cuando faltan campos obligatorios', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ShipmentForm open={true} onClose={vi.fn()} onSubmit={onSubmit} />)

    expect(
      await screen.findByDisplayValue('Se asignará automáticamente al guardar'),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(await screen.findAllByText('Requerido')).not.toHaveLength(0)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('CP-19 permite registrar con campos opcionales vacios', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(<ShipmentForm open={true} onClose={vi.fn()} onSubmit={onSubmit} />)

    await screen.findByDisplayValue('Se asignará automáticamente al guardar')

    const nameInputs = screen.getAllByLabelText('Nombre')
    await user.type(nameInputs[0], 'Ana')
    await user.type(nameInputs[1], 'Luis')
    await user.type(screen.getByLabelText('Peso (kg)'), '12')
    await user.type(screen.getByLabelText('Descripción'), 'Caja')
    fireEvent.change(screen.getByLabelText('Fecha estimada de entrega'), {
      target: { value: '2026-04-01' },
    })

    const combos = screen.getAllByRole('combobox')
    fireEvent.mouseDown(combos[0])
    await user.click(await screen.findByRole('option', { name: 'Centro' }))
    fireEvent.mouseDown(combos[1])
    await user.click(await screen.findByRole('option', { name: 'Norte' }))

    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const payload = onSubmit.mock.calls[0][0]
    expect(payload.sender.address).toBe('')
    expect(payload.receiver.address).toBe('')
    expect(payload.sender.postalCode).toBe('')
    expect(payload.receiver.postalCode).toBe('')
    expect(payload.origin).toBe('Centro')
    expect(payload.destination).toBe('Norte')
  })
})
