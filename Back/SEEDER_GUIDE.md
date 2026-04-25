# 🌱 DatabaseSeeder - Sistema de Datos de Prueba

## Descripción

El `DatabaseSeeder` es un sistema modularizado que carga datos de prueba automáticamente en memoria cuando se inicia el backend. Está completamente separado de la lógica productiva y es controlado por **variables de entorno/configuración**.

## Características

✅ **Controlado por configuración**: Se activa/desactiva mediante `appsettings.json` o variables de entorno
✅ **Modularizado**: Todo en la clase `DatabaseSeeder.cs`, separado del código principal
✅ **Datos realistas**: Usuarios, vehículos y paquetes específicos con datos predefinidos
✅ **Parametrizable**: Cantidad de elementos configurable mediante configuración
✅ **Múltiples casos de uso**: Estados variados de paquetes, rutas y vehículos
✅ **Logging detallado**: Muestra qué se está cargando en cada paso

## Configuración

### Habilitar/Deshabilitar

Edita `appsettings.json`:

```json
{
  "Database": {
    "EnableSeedData": true  // ✅ Cargar datos de prueba
    // "EnableSeedData": false  // ❌ No cargar datos
  }
}
```

### Variables de Entorno

También puedes configurar mediante variables de entorno:

```bash
# Activar/desactivar seeder
Database__EnableSeedData=true

# Configurar cantidades
DatabaseSeederConfiguration__CantidadOperadores=20
DatabaseSeederConfiguration__CantidadSupervisores=10
DatabaseSeederConfiguration__CantidadTransportistas=30
DatabaseSeederConfiguration__CantidadVehiculos=25
DatabaseSeederConfiguration__CantidadPaquetes=100
```

### Configuración por Defecto

Si no se especifica configuración, se usan estos valores por defecto:

```json
{
  "DatabaseSeederConfiguration": {
    "CantidadOperadores": 20,
    "CantidadSupervisores": 10,
    "CantidadTransportistas": 30,
    "CantidadVehiculos": 25,
    "CantidadPaquetes": 100
  }
}
```

## Datos que carga

### 👥 Usuarios de Prueba (6 específicos + aleatorios)

#### Usuarios Específicos (Establecidos)

| Email | Rol | Contraseña | Nombre | Apellido |
|-------|-----|-----------|--------|----------|
| `juan.perez@logitrack.com` | Operador | `kjkszpj1234` | juan | perez |
| `maria.gomez@logitrack.com` | Operador | `kjkszpj1234` | maria | gomez |
| `carlos.rodriguez@logitrack.com` | Supervisor | `kjkszpj1234` | carlos | rodriguez |
| `ana.martinez@logitrack.com` | Supervisor | `kjkszpj1234` | ana | martinez |
| `luis.lopez@logitrack.com` | Transportista | `kjkszpj1234` | luis | lopez |
| `sofia.fernandez@logitrack.com` | Transportista | `kjkszpj1234` | sofia | fernandez |

#### Usuarios Aleatorios Adicionales

Además de los usuarios específicos, se generan usuarios aleatorios según la configuración:
- **Operadores**: Cantidad configurable (por defecto 20)
- **Supervisores**: Cantidad configurable (por defecto 10)
- **Transportistas**: Cantidad configurable (por defecto 30)

### 🚚 Vehículos (7 específicos + aleatorios)

#### Vehículos Específicos (Establecidos)

| Patente | Marca | Capacidad (kg) |
|---------|-------|----------------|
| `ABC123` | Ford | 1500 |
| `DEF456` | Chevrolet | 1200 |
| `GHI789` | Toyota | 1800 |
| `JKL012` | Renault | 1000 |
| `MNO345` | Volkswagen | 1600 |
| `PQR678` | Ford | 1400 |
| `STU901` | Chevrolet | 1300 |

#### Vehículos Aleatorios Adicionales

Se generan vehículos aleatorios adicionales según la configuración (por defecto 25).

### 📦 Paquetes (7 específicos + aleatorios)

#### Paquetes Específicos (Estados de Prueba)

| Código | Estado | Descripción |
|--------|--------|-------------|
| LOG-2024-001 | EnSucursal | En espera de ser enviado |
| LOG-2024-002 | EnTransito | En ruta de entrega |
| LOG-2024-003 | Entregado | Ya fue entregado |
| LOG-2024-004 | Cancelado | Cancelado por cliente |
| LOG-2024-005 | EnSucursal | Pequeño documento |
| LOG-2024-006 | EnTransito | Carga grande |
| LOG-2024-007 | Entregado | Histórico |

#### Paquetes Aleatorios Adicionales

Se generan paquetes aleatorios adicionales según la configuración (por defecto 100).

### 🛣️ Rutas (1 específica + aleatorias)

#### Ruta Específica Asignada

| Transportista | Vehículo | Paquetes | Descripción |
|---------------|----------|----------|-------------|
| `luis.lopez@logitrack.com` | `ABC123` (Ford) | Paquetes específicos | Ruta asignada al transportista específico con todos los paquetes de prueba |

#### Rutas Aleatorias Adicionales

Se generan rutas aleatorias que combinan transportistas, vehículos y paquetes según la configuración.

## Pasos para usar

### 1️⃣ Configurar las cantidades (opcional)

Edita `Back/appsettings.json`:

```json
{
  "Database": {
    "EnableSeedData": true
  },
  "DatabaseSeederConfiguration": {
    "CantidadOperadores": 15,
    "CantidadSupervisores": 8,
    "CantidadTransportistas": 20,
    "CantidadVehiculos": 30,
    "CantidadPaquetes": 200
  }
}
```

### 2️⃣ Iniciar el backend

```bash
cd Back
dotnet run
```

Verás en la consola:

```
[SEED] Iniciando carga de datos de prueba...
[SEED] Usuario Operador: juan.perez@logitrack.com
[SEED] Usuario Operador: maria.gomez@logitrack.com
[SEED] Usuario Supervisor: carlos.rodriguez@logitrack.com
[SEED] Usuario Supervisor: ana.martinez@logitrack.com
[SEED] Usuario Transportista: luis.lopez@logitrack.com
[SEED] Usuario Transportista: sofia.fernandez@logitrack.com
[SEED] ✓ 6 usuarios específicos creados
[SEED] ✓ Usuarios aleatorios adicionales creados
[SEED] ✓ 7 vehículos específicos creados
[SEED] ✓ Vehículos aleatorios adicionales creados
[SEED] ✓ Paquetes creados
[SEED] ✓ Rutas creadas
[SEED] ✓ Datos de prueba cargados exitosamente
```

### 3️⃣ Probar con el frontend

Inicia el frontend y prueba el login con cualquiera de estos usuarios:

**Ejemplos de login:**
```
Operador: juan.perez@logitrack.com / kjkszpj1234
Supervisor: carlos.rodriguez@logitrack.com / kjkszpj1234
Transportista: luis.lopez@logitrack.com / kjkszpj1234
```

## 🎯 Casos de Prueba Disponibles

Los datos están diseñados para validar:

✅ **Autenticación**: 3 roles diferentes (Supervisor, Operador, Transportista)
✅ **Estados de paquetes**: Todos los estados posibles
✅ **Estados de rutas**: Pendiente, EnCurso, Finalizada
✅ **Vehículos**: Vehículos específicos con patentes conocidas
✅ **Rutas específicas**: Transportista `luis.lopez` asignado a ruta con paquetes específicos
✅ **Búsqueda**: Por código de seguimiento, destinatario
✅ **Filtrado**: Rutas activas, paquetes en sucursal, etc.
✅ **Asignación**: Vehículos a rutas, paquetes a rutas
✅ **Parametrización**: Configurable mediante variables de entorno

## 📁 Arquitectura

```
Back/
├── Infrastructure/
│   └── DatabaseSeeder.cs         ← Seeder modularizado
├── appsettings.json              ← Configuración
├── Program.cs                    ← Inicializa seeder
└── ...
```

## ⚙️ Desactivar Temporalmente

Si necesitas trabajar sin datos de prueba:

```json
"Database": {
  "EnableSeedData": false
}
```

Simplemente reinicia el backend y los datos no se cargarán (los repositorios siguen funcionando normalmente).

## 🔧 Configuración Avanzada

### Variables de Entorno Completas

```bash
# Control del seeder
Database__EnableSeedData=true

# Configuración de cantidades
DatabaseSeederConfiguration__CantidadOperadores=25
DatabaseSeederConfiguration__CantidadSupervisores=15
DatabaseSeederConfiguration__CantidadTransportistas=40
DatabaseSeederConfiguration__CantidadVehiculos=35
DatabaseSeederConfiguration__CantidadPaquetes=300
```

### Configuración en Docker

```yaml
environment:
  - Database__EnableSeedData=true
  - DatabaseSeederConfiguration__CantidadOperadores=10
  - DatabaseSeederConfiguration__CantidadSupervisores=5
  - DatabaseSeederConfiguration__CantidadTransportistas=15
  - DatabaseSeederConfiguration__CantidadVehiculos=20
  - DatabaseSeederConfiguration__CantidadPaquetes=150
```

## 📝 Agregar más datos de prueba

Para agregar más datos:

1. **Usuarios específicos**: Edita `UsuarioGenerator.GenerarUsuariosEspecificos()`
2. **Vehículos específicos**: Edita `PaquetesGenerator.GenerarVehiculosEspecificos()`
3. **Paquetes específicos**: Edita `PaquetesGenerator.GenerarPaquetesEspecificos()`
4. **Cantidades**: Modifica `DatabaseSeederConfiguration` en `appsettings.json`

## 🏗️ Desarrollo y Testing

### Usuarios de Prueba Fiables

Los usuarios específicos garantizan datos consistentes para testing:

- **juan.perez@logitrack.com** (Operador)
- **carlos.rodriguez@logitrack.com** (Supervisor)
- **luis.lopez@logitrack.com** (Transportista con ruta específica)

### Vehículos de Prueba

- **ABC123** (Ford - usado en ruta específica)
- **DEF456** (Chevrolet)
- **GHI789** (Toyota)

### Paquetes de Prueba

- **LOG-2024-001** a **LOG-2024-007** (todos los estados posibles)

## 🔒 Consideraciones de Seguridad

- ✅ Los datos de prueba **SÓLO** se carga si está explícitamente habilitado
- ✅ Las contraseñas se hashean con **bcrypt**
- ✅ No hay datos sensibles reales
- ✅ Completamente separado de lógica productiva
- ✅ En producción, setting `EnableSeedData: false`

## 📊 Rendimiento

El seeder está optimizado para:
- **Cargas grandes**: Maneja cientos de entidades eficientemente
- **Memoria**: Usa Entity Framework para inserción masiva
- **Tiempo**: Carga en segundos para datasets típicos
- **Configurabilidad**: Ajusta cantidades según necesidades de testing</content>
<parameter name="filePath">/home/zamasu/sw/LogiTrack.Api/Back/SEEDER_GUIDE.md
