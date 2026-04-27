export interface Review {
  id: string
  name: string
  role: string
  category: 'entrega' | 'vehiculo' | 'general'
  rating: number
  comment: string
  date: string
  avatar: string
}

export const MOCK_REVIEWS: Review[] = [
  { id: '1', name: 'Martina González', role: 'Empresaria', category: 'entrega', rating: 5, comment: 'Excelente tiempo de entrega. Mi pedido llegó antes de lo esperado y en perfectas condiciones. El sistema de seguimiento en tiempo real es increíble.', date: '15/03/2026', avatar: 'MG' },
  { id: '2', name: 'Roberto Sánchez', role: 'Comerciante', category: 'vehiculo', rating: 4, comment: 'La flota de vehículos está muy bien mantenida. Los repartidores son profesionales y cuidan mucho los paquetes.', date: '10/03/2026', avatar: 'RS' },
  { id: '3', name: 'Ana Rodríguez', role: 'Diseñadora', category: 'general', rating: 5, comment: 'La plataforma es muy fácil de usar. Pude rastrear mi envío en todo momento y el soporte al cliente fue excelente.', date: '08/03/2026', avatar: 'AR' },
  { id: '4', name: 'Diego Martínez', role: 'Importador', category: 'entrega', rating: 4, comment: 'Muy buen servicio. Los tiempos de entrega son precisos y el sistema de rutas optimizado me ha ahorrado mucho dinero.', date: '05/03/2026', avatar: 'DM' },
  { id: '5', name: 'Sofía Herrera', role: 'Emprendedora', category: 'vehiculo', rating: 5, comment: 'Los vehículos llegan siempre impecables y los conductores son muy amables. Se nota que hay un control de calidad riguroso.', date: '01/03/2026', avatar: 'SH' },
  { id: '6', name: 'Luciano Pérez', role: 'Mayorista', category: 'general', rating: 5, comment: 'Llevo 2 años usando LogiTrack y no volvería a otra empresa. La transparencia, el seguimiento y la atención son incomparables.', date: '25/02/2026', avatar: 'LP' },
  { id: '7', name: 'Valentina Torres', role: 'Arquitecta', category: 'entrega', rating: 4, comment: 'Muy satisfecha con el servicio. Las estimaciones de entrega son muy precisas y el personal es cordial.', date: '20/02/2026', avatar: 'VT' },
  { id: '8', name: 'Matías Romero', role: 'Fabricante', category: 'vehiculo', rating: 5, comment: 'La calidad de los vehículos refrigerados es excepcional. Perfectos para mis envíos de productos perecederos.', date: '15/02/2026', avatar: 'MR' },
]

export const AVATAR_COLORS = ['#0288D1', '#00897B', '#7B1FA2', '#C62828', '#F57C00', '#2E7D32', '#1565C0', '#AD1457']

export function avatarColor(s: string) {
  let h = 0
  for (const c of s) h += c.charCodeAt(0)
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export const categoryLabel: Record<Review['category'], string> = {
  entrega: 'Tiempo de entrega',
  vehiculo: 'Vehículo',
  general: 'General',
}

export const categoryColor: Record<Review['category'], string> = {
  entrega: '#0288D1',
  vehiculo: '#00897B',
  general: '#7B1FA2',
}
