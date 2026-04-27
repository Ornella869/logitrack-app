export const makeBackendVehicle = (overrides: Record<string, any> = {}) => ({
  id: 'vehicle-1',
  patente: 'AA123BB',
  marca: 'Iveco',
  capacidadCarga: 2000,
  estado: 'Disponible',
  createdDate: '2026-03-20',
  operator: 'op-1',
  assignedRouteIds: [],
  ...overrides,
})
