import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Outlet } from 'react-router-dom'

const { getMine } = vi.hoisted(() => ({
  getMine: vi.fn(),
}))

vi.mock('../../../services/permissionService', () => ({
  permissionService: {
    getMine,
  },
}))

vi.mock('../../../components/Layout', () => ({
  default: () => <Outlet />,
}))

vi.mock('../../../pages/LoginPage', () => ({ default: () => <div>LOGIN_PAGE</div> }))
vi.mock('../../../pages/Dashboard', () => ({ default: () => <div>DASHBOARD_PAGE</div> }))
vi.mock('../../../pages/EnviosPage', () => ({ default: () => <div>ENVIOS_PAGE</div> }))
vi.mock('../../../pages/CalendarizarPage', () => ({ default: () => <div>CALENDARIZAR_PAGE</div> }))
vi.mock('../../../pages/CalendarioOperativoPage', () => ({ default: () => <div>CALENDARIO_PAGE</div> }))
vi.mock('../../../pages/RutasActivasPage', () => ({ default: () => <div>RUTAS_ACTIVAS_PAGE</div> }))
vi.mock('../../../pages/DetalleRutaPage', () => ({ default: () => <div>DETALLE_RUTA_PAGE</div> }))
vi.mock('../../../pages/AuditoriaPage', () => ({ default: () => <div>AUDITORIA_PAGE</div> }))
vi.mock('../../../pages/NotificacionesAuditoriaPage', () => ({ default: () => <div>AUDITORIA_NOTIFICACIONES_PAGE</div> }))
vi.mock('../../../pages/MiPlanPage', () => ({ default: () => <div>MI_PLAN_PAGE</div> }))
vi.mock('../../../pages/ReportesPage', () => ({ default: () => <div>REPORTES_PAGE</div> }))
vi.mock('../../../pages/TarifasPage', () => ({ default: () => <div>TARIFAS_PAGE</div> }))
vi.mock('../../../pages/OjoPatronConfigPage', () => ({ default: () => <div>OJO_PATRON_PAGE</div> }))
vi.mock('../../../pages/AlertasPage', () => ({ default: () => <div>ALERTAS_PAGE</div> }))
vi.mock('../../../pages/IncidenciasPage', () => ({ default: () => <div>INCIDENCIAS_PAGE</div> }))
vi.mock('../../../pages/IncidenciaDetallePage', () => ({ default: () => <div>INCIDENCIA_DETALLE_PAGE</div> }))
vi.mock('../../../pages/SucursalesPage', () => ({ default: () => <div>SUCURSALES_PAGE</div> }))
vi.mock('../../../pages/PuntosPickUpPage', () => ({ default: () => <div>PICKUPS_PAGE</div> }))
vi.mock('../../../pages/PickUpOperacionPage', () => ({ default: () => <div>PICKUP_OPERACION_PAGE</div> }))
vi.mock('../../../pages/PickUpHistorialPage', () => ({ default: () => <div>PICKUP_HISTORIAL_PAGE</div> }))
vi.mock('../../../pages/RepartidoresPage', () => ({ default: () => <div>REPARTIDORES_PAGE</div> }))
vi.mock('../../../pages/PerfilRendimientoPage', () => ({ default: () => <div>PERFIL_RENDIMIENTO_PAGE</div> }))
vi.mock('../../../pages/ShipmentDetail', () => ({ default: () => <div>SHIPMENT_DETAIL_PAGE</div> }))
vi.mock('../../../pages/ShipmentLabel', () => ({ default: () => <div>SHIPMENT_LABEL_PAGE</div> }))
vi.mock('../../../pages/TrackingPublicPage', () => ({ default: () => <div>TRACKING_PUBLIC_PAGE</div> }))
vi.mock('../../../pages/PortalClientePublico', () => ({ default: () => <div>PORTAL_CLIENTE_PUBLICO_PAGE</div> }))
vi.mock('../../../pages/SatisfaccionPage', () => ({ default: () => <div>SATISFACCION_PAGE</div> }))
vi.mock('../../../pages/SatisfaccionMetricasPage', () => ({ default: () => <div>SATISFACCION_METRICAS_PAGE</div> }))
vi.mock('../../../pages/PlantillasEmailPage', () => ({ default: () => <div>PLANTILLAS_EMAIL_PAGE</div> }))
vi.mock('../../../pages/PlantillaEmailEditPage', () => ({ default: () => <div>PLANTILLA_EMAIL_EDIT_PAGE</div> }))
vi.mock('../../../pages/PermisosPage', () => ({ default: () => <div>PERMISOS_PAGE</div> }))
vi.mock('../../../pages/repartidor/RepartidorDashboard', () => ({ default: () => <div>REPARTIDOR_PAGE</div> }))
vi.mock('../../../pages/repartidor/RepartidorHistorialPage', () => ({ default: () => <div>REPARTIDOR_HISTORIAL_PAGE</div> }))
vi.mock('../../../pages/ClienteDashboard', () => ({ default: () => <div>CLIENTE_PAGE</div> }))
vi.mock('../../../pages/landing/LandingPage', () => ({ default: () => <div>LANDING_PAGE</div> }))
vi.mock('../../../pages/AccessDenied', () => ({ default: () => <div>ACCESS_DENIED_PAGE</div> }))
vi.mock('../../../pages/ProfilePage', () => ({ default: () => <div>PROFILE_PAGE</div> }))

import App from '../../../App'

describe('App refresh permissions fallback', () => {
  beforeEach(() => {
    localStorage.clear()
    getMine.mockReset()
    window.history.pushState({}, '', '/envios')
  })

  it('mantiene una ruta valida tras refresh cuando falla la recarga de permisos', async () => {
    localStorage.setItem('authToken', 'jwt-token')
    localStorage.setItem('user', JSON.stringify({
      id: 'u-1',
      name: 'Florencia',
      lastname: 'Paez',
      email: 'florencia@gmail.com',
      dni: '12345678',
      role: 'operador',
    }))
    localStorage.setItem('userPermissions', JSON.stringify(['envios_ver']))
    getMine.mockRejectedValueOnce(new Error('network error'))

    render(<App />)

    expect(await screen.findByText('ENVIOS_PAGE')).toBeInTheDocument()
  })
})
