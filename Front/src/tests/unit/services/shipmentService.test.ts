import { beforeEach, describe, expect, it, vi } from 'vitest'

import { shipmentService } from '../../../services/shipmentService'
import { makeBackendShipment } from '../../fixtures/backendShipment'

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '../../../services/api'

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

describe('shipmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mapea correctamente los envios del backend', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: [makeBackendShipment({ status: 'EnTransito' })],
    })

    const shipments = await shipmentService.getAllShipments()

    expect(shipments).toHaveLength(1)
    expect(shipments[0]).toMatchObject({
      id: 'shipment-1',
      trackingId: 'LOG-123',
      status: 'En tránsito',
      origin: 'Buenos Aires',
      destination: 'Cordoba',
    })
    expect(mockedApi.get).toHaveBeenCalledWith('/envios/paquetes')
  })

  it('devuelve lista vacia cuando falla obtener envios', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('network error'))

    const shipments = await shipmentService.getAllShipments()

    expect(shipments).toEqual([])
  })

  it('cambia estado usando el mapeo correcto al backend', async () => {
    mockedApi.post.mockResolvedValueOnce({})

    const result = await shipmentService.changeShipmentStatus('shipment-1', 'Rechazado')

    expect(result).toEqual({ success: true })
    expect(mockedApi.post).toHaveBeenCalledWith('/envios/cambiar-estado-paquete/shipment-1/estado/Cancelado')
  })

  it('retorna error de backend cuando cambio de estado falla', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { data: 'Transicion invalida' },
    })

    const result = await shipmentService.changeShipmentStatus('shipment-1', 'Entregado')

    expect(result).toEqual({ success: false, error: 'Transicion invalida' })
  })

  it('cancela paquete enviando motivo', async () => {
    mockedApi.post.mockResolvedValueOnce({})

    const result = await shipmentService.cancelShipment('shipment-1', 'Cliente no disponible')

    expect(result).toEqual({ success: true })
    expect(mockedApi.post).toHaveBeenCalledWith('/envios/cancelar-paquete/shipment-1', {
      Motivo: 'Cliente no disponible',
    })
  })

  it('registra envio y devuelve el paquete creado', async () => {
    mockedApi.post.mockResolvedValueOnce({})
    mockedApi.get.mockResolvedValueOnce({
      data: [
        makeBackendShipment({
          id: 'shipment-new',
          destinatario: {
            nombre: 'Ana',
            apellido: 'Gomez',
            direccion: {
              calle: 'Belgrano 123',
              ciudad: 'Rosario',
              cp: '2000',
            },
          },
        }),
      ],
    })

    const created = await shipmentService.registerShipment({
      sender: {
        name: 'Pedro Sosa',
        address: 'Mitre 450',
        city: 'Santa Fe',
        postalCode: '3000',
      },
      receiver: {
        name: 'Ana Gomez',
        address: 'Belgrano 123',
        city: 'Rosario',
        postalCode: '2000',
      },
      origin: 'Santa Fe',
      destination: 'Rosario',
      weight: 7,
      description: 'Caja pequena',
      cancellationReason: undefined,
    })

    expect(mockedApi.post).toHaveBeenCalledWith('/envios/registrar-paquete', {
      Peso: 7,
      Comentarios: 'Caja pequena',
      Remitente: {
        Nombre: 'Pedro',
        Apellido: 'Sosa',
        Direccion: 'Mitre 450',
        Localidad: 'Santa Fe',
        CP: '3000',
      },
      Destinatario: {
        Nombre: 'Ana',
        Apellido: 'Gomez',
        Direccion: 'Belgrano 123',
        Localidad: 'Rosario',
        CP: '2000',
      },
    })

    expect(created?.id).toBe('shipment-new')
    expect(created?.receiver.name).toContain('Ana')
  })
})
