export const makeBackendShipment = (overrides: Record<string, any> = {}) => ({
  id: 'shipment-1',
  codigoSeguimiento: 'LOG-123',
  remitente: {
    nombre: 'Juan',
    apellido: 'Perez',
    direccion: {
      calle: 'Av Siempre Viva 123',
      ciudad: 'Buenos Aires',
      cp: '1000',
    },
  },
  destinatario: {
    nombre: 'Maria',
    apellido: 'Lopez',
    direccion: {
      calle: 'Calle Falsa 742',
      ciudad: 'Cordoba',
      cp: '5000',
    },
  },
  status: 'EnSucursal',
  creadoEn: '2026-03-20T10:30:00Z',
  peso: 12.5,
  descripcion: 'Electrodomestico',
  razonCancelacion: null,
  ...overrides,
})
