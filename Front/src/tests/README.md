# Frontend test structure

- `unit/services`: tests de servicios y mapeos de datos.
- `unit/components`: tests unitarios de componentes aislados.
- `integration/pages`: tests de pantallas con navegación.
- `integration/routing`: tests de guardas y redirecciones de rutas.
- `fixtures`: datos compartidos para pruebas.

## Commands

- `npm run test`: ejecuta toda la suite una vez.
- `npm run test:watch`: modo watch para desarrollo.
- `npm run test:coverage`: genera reporte de cobertura.

## Convencion de nombres

- Prefijo con ID del caso de prueba: `CP-XX descripcion del escenario`.
- Cada caso de prueba del Excel debe tener al menos un test asociado.
- Si un caso tiene camino feliz y error, crear dos tests separados.
