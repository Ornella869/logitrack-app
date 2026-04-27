import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import VehicleForm from '../../../components/VehicleForm'

vi.mock('../../../services/vehicleService', () => ({
  vehicleService: {
    patenteExists: vi.fn(),
  },
}))

import { vehicleService } from '../../../services/vehicleService'

const mockedVehicleService = vehicleService as unknown as {
  patenteExists: ReturnType<typeof vi.fn>
}

describe('VehicleForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('CP-32 y CP-60 bloquea registro cuando patente ya existe', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    mockedVehicleService.patenteExists.mockResolvedValue(true)

    render(<VehicleForm open={true} onClose={vi.fn()} onSubmit={onSubmit} operatorId="op-1" />)

    await user.type(screen.getByLabelText('Patente'), 'AB123CD')
    await user.type(screen.getByLabelText('Marca'), 'Ford')
    await user.type(screen.getByLabelText('Capacidad de Carga (kg)'), '300')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    expect(await screen.findByText('Esta patente ya está registrada')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('CP-34 y CP-62 bloquea registro con capacidad no numerica', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    mockedVehicleService.patenteExists.mockResolvedValue(false)

    render(<VehicleForm open={true} onClose={vi.fn()} onSubmit={onSubmit} operatorId="op-1" />)

    await user.type(screen.getByLabelText('Patente'), 'AB123CD')
    await user.type(screen.getByLabelText('Marca'), 'Ford')
    await user.type(screen.getByLabelText('Capacidad de Carga (kg)'), 'abc')

    expect(screen.getByRole('button', { name: 'Registrar' })).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('CP-31 y CP-59 registra vehiculo exitosamente', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    mockedVehicleService.patenteExists.mockResolvedValue(false)

    render(<VehicleForm open={true} onClose={vi.fn()} onSubmit={onSubmit} operatorId="op-1" />)

    await user.type(screen.getByLabelText('Patente'), 'ab123cd')
    await user.type(screen.getByLabelText('Marca'), 'Ford Focus')
    await user.type(screen.getByLabelText('Capacidad de Carga (kg)'), '300')
    await user.click(screen.getByRole('button', { name: 'Registrar' }))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      patente: 'AB123CD',
      marca: 'Ford Focus',
      capacidadCarga: 300,
      estado: 'Disponible',
      operator: 'op-1',
    })
  })
})
