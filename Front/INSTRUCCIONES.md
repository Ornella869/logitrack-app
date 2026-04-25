# 📦 LogiTrack - Sistema de Gestión de Envíos

Frontend moderno construido con **React + Vite + TypeScript + Material UI** para gestión integral de envíos.

## ✨ Características

- ✅ **Autenticación** - Login y registro con validación de DNI
- ✅ **Dashboard** - Vista general con buscador de tracking
- ✅ **Gestión de Envíos** - Crear, visualizar y actualizar estado
- ✅ **Detalles Completos** - Información remitente, destinatario, fechas y ubicación
- ✅ **Diseño Responsive** - Mobile-first con Material UI
- ✅ **Componentes Reutilizables** - Arquitectura escalable
- ✅ **Mock Data** - Datos de prueba integrados

## 🚀 Inicio Rápido

### 1. Instalar dependencias
```bash
npm install
```

### 2. Ejecutar en desarrollo
```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

### 3. Build para producción
```bash
npm run build
```

## 📝 Credenciales de Prueba

| Campo | Valor |
|-------|-------|
| DNI | 12345678 |
| Contraseña | password123 |

## 🗂️ Estructura de Carpetas

```
src/
├── pages/              # Páginas principales
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── Dashboard.tsx
│   └── ShipmentDetail.tsx
├── components/         # Componentes reutilizables
│   ├── Layout.tsx
│   ├── ShipmentCard.tsx
│   ├── ShipmentForm.tsx
│   └── SearchBar.tsx
├── services/          # Lógica de negocio
│   ├── authService.ts
│   └── shipmentService.ts
├── types/             # Tipos TypeScript
│   └── index.ts
├── App.tsx            # Componente principal
└── main.tsx           # Entry point
```

## 🎯 Funcionalidades Principales

### 🔐 Autenticación
- **Login**: Validación con DNI (8 dígitos) y contraseña
- **Registro**: Crear cuenta con nombre, apellido, email, DNI y contraseña
- **Persistencia**: Sesión guardada en localStorage

### 📦 Gestión de Envíos
- **Lista de Envíos**: Grid responsive con tarjetas
- **Búsqueda**: Buscar por ID de tracking
- **Crear Envío**: Form completo con validación
- **Ver Detalles**: Page con toda la información del envío
- **Cambiar Estado**: En tránsito → Entregado → Cancelado

### 🎨 Interfaz
- Material UI con tema personalizado
- Responsive design (mobile, tablet, desktop)
- Iconos y colores intuitivos
- Estructura clara y fácil de usar

## 📚 Tipos TypeScript

### User
```typescript
interface User {
  id: string
  name: string
  lastname: string
  email: string
  dni: string
}
```

### Shipment
```typescript
interface Shipment {
  id: string
  trackingId: string
  sender: { name, address, city, postalCode }
  receiver: { name, address, city, postalCode }
  status: 'En tránsito' | 'Entregado' | 'Cancelado'
  origin: string
  destination: string
  createdDate: string
  lastUpdate: string
  estimatedDelivery: string
  weight: number
  description: string
}
```

## 🔧 Servicios Disponibles

### authService
- `login(credentials)` - Autenticar usuario
- `register(data)` - Registrar nuevo usuario
- `isValidDni(dni)` - Validar formato DNI
- `isValidEmail(email)` - Validar email
- `isValidPassword(password)` - Validar contraseña

### shipmentService
- `getAllShipments()` - Obtener todos los envíos
- `getShipmentById(id)` - Obtener envío específico
- `searchByTrackingId(trackingId)` - Buscar por tracking
- `createShipment(shipment)` - Crear nuevo envío
- `updateShipmentStatus(id, status)` - Cambiar estado
- `getRecentShipments(limit)` - Últimos envíos

## 🌐 Rutas

| Ruta | Descripción |
|------|-------------|
| `/login` | Página de login |
| `/register` | Página de registro |
| `/` | Dashboard (requiere autenticación) |
| `/shipment/:id` | Detalle de envío |

## 🛠️ Tecnologías

- **React 18** - UI library
- **Vite 5** - Build tool
- **TypeScript 5** - Type safety
- **Material UI 5** - Component library
- **React Router 6** - Routing
- **Emotion** - CSS-in-JS

## 📦 Dependencias Principales

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "@mui/material": "^5.14.0",
  "@mui/icons-material": "^5.14.0"
}
```

## 🎓 Notas de Desarrollo

- Los datos son mockeados en memoria (perfecto para demo)
- Para integración con backend, modifica los servicios en `src/services/`
- Los estilos están en MUI con `sx` props para máxima flexibilidad
- Usa `import { useNavigate } from 'react-router-dom'` para navegación
- Almacenamiento de sesión en `localStorage`

## 📝 Próximas Mejoras Sugeridas

- [ ] Integración con API real
- [ ] Paginación en listado
- [ ] Filtros avanzados
- [ ] Exportación a PDF
- [ ] Notificaciones en tiempo real
- [ ] Temas oscuro/claro
- [ ] Tests unitarios

## 📞 Soporte

Para reportar bugs o sugerir mejoras, contacta al equipo de desarrollo.

---

**Hecho con ❤️ para LogiTrack**
