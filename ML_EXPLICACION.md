# Sistema de Machine Learning — LogiTrack

## Visión general

El sistema ML de LogiTrack tiene **dos objetivos concretos**:

1. **Predecir cuánto tarda un paquete en recorrer cada tramo** (regresión)
2. **Detectar anticipadamente si un tramo tiene alto riesgo de demorarse** (clasificación)

Ambos modelos se **entrenan solos**: cada vez que un paquete completa un tramo, el sistema registra automáticamente lo que ocurrió y actualiza sus predicciones futuras.

---

## Arquitectura del sistema

```
  Paquete completa un tramo
           │
           ▼
  RegistrarDatoTramoAsync()
  ┌─────────────────────────────────────────┐
  │  Guarda en DatosEntrenamientoTramo:     │
  │  · ruta (origen → destino)              │
  │  · tiempo real que tardó               │
  │  · peso, tipo de envío, prioridad       │
  │  · día de semana, hora de salida        │
  │  · carga operativa de la sucursal       │
  │  · ¿tuvo demora? (true/false)           │
  │  · error respecto a la estimación previa│
  └─────────────────────────────────────────┘
           │
           ▼
  ReestimarYActualizarAsync()         GenerarAlertaRiesgoSiCorresponde()
  [Modelo de regresión]               [Modelo de clasificación]
```

---

## Modelo 1 — Estimación de tiempo de entrega (Regresión)

### Tipo de algoritmo
**k-NN Regression (k-Nearest Neighbors adaptado a series temporales)**

No usa un modelo estático con parámetros fijos. En cambio, para cada tramo que necesita estimación, busca los **k=100 casos más recientes** del mismo par origen→destino y calcula su promedio.

### Cómo predice

```
Para el tramo  Sucursal A → Sucursal B:

  1. Busca los últimos 100 registros históricos de ese tramo en la BD
  2. Si hay ≥ 10 registros:
       predicción = promedio(TiempoRealHoras de esos 100 registros)
  3. Si hay < 10 registros:
       predicción = estimación estática configurada en el sistema
```

La "confianza" de la predicción se mide como:
```
score = tramos_con_historial_suficiente / tramos_restantes_totales

Si score ≥ 0.6  →  actualiza la fecha estimada de entrega del paquete
```

### Por qué mejora con el tiempo

| Datos disponibles | Comportamiento del modelo |
|---|---|
| < 10 registros del tramo | Usa estimación estática (sin ML) |
| 10–99 registros | Promedia todos los disponibles |
| ≥ 100 registros | Usa solo los 100 más recientes (ventana deslizante) |

La ventana de 100 registros es clave: **los datos más nuevos desplazan a los viejos**, de forma que el modelo se adapta a cambios en la red logística (nuevas rutas, cambios de personal, temporadas).

---

## Modelo 2 — Detección de riesgo de demora (Clasificación)

### Tipo de algoritmo
**Clasificador de frecuencia bayesiana (Naive Frequency Classifier)**

Para cada tramo del próximo envío, calcula la probabilidad de demora histórica en esa ruta específica:

```
P(demora | ruta) = cantidad_de_casos_con_demora / total_casos_de_la_ruta
```

Un caso "con demora" es cuando:
```
TiempoReal > EstimaciónPrevia × 1.5
```
Es decir, tardó más de 1.5 veces lo esperado.

### Cuándo dispara una alerta

```
Si total_registros_de_la_ruta ≥ 5   (mínimo estadístico)
Y probabilidad_demora ≥ 0.70        (70% de casos históricos tuvieron demora)
Y el paquete no tiene ya una alerta activa

→ Crea una AlertaRiesgoDemoraMl con:
   · ProbabilidadDemora = 0.XX
   · CausaPrincipal = "Alta tasa histórica de demora en tramo X → Y (NN% de casos)"
```

La alerta es accionable: el supervisor puede marcarla como "Gestionada" e indicar si finalmente llegó a tiempo (`LlegoATiempo`), lo que permite futuras mejoras de calibración.

---

## Datos que se recolectan (features)

Cada registro en `DatosEntrenamientoTramo` captura:

| Feature | Descripción | Uso futuro |
|---|---|---|
| `SucursalOrigenId` / `SucursalDestinoId` | Identificador del tramo | Filtro principal de ambos modelos |
| `TiempoRealHoras` | Variable objetivo del modelo de regresión | Target de predicción |
| `TuvoDemora` | Variable objetivo del clasificador | Target de clasificación |
| `PesoKg` | Peso del paquete | Feature para modelo avanzado |
| `TipoEnvio` | Estándar / Prioritario / Refrigerado | Feature para modelo avanzado |
| `EsPrioritario` | Boolean | Feature para modelo avanzado |
| `DiaSemana` | 0=Domingo … 6=Sábado | Captura variación día de semana |
| `HoraSalida` | Hora de inicio del tramo | Captura variación horaria |
| `CargaSucursalOrigen` | Paquetes pendientes en origen | Proxy de congestión |
| `RepartidoresActivosDestino` | Repartidores activos en destino | Proxy de capacidad |
| `EstimacionPreviaHoras` | Lo que el sistema predijo antes | Para calcular el error |
| `ErrorAbsolutoHoras` | `|real - estimado|` | Métrica MAE |

Estos features están pensados para cuando se migre a un modelo más avanzado (regresión lineal múltiple, árbol de decisión, o red neuronal vía ML.NET).

---

## Métricas de evaluación

El sistema expone métricas en tiempo real en el panel `/admin/ml-metricas`:

### MAE (Mean Absolute Error)
```
MAE = promedio(|TiempoReal - EstimaciónPrevia|) sobre todos los registros
```
Representa en promedio cuántas horas se equivoca el modelo. Cuanto más baja, mejor.

### Distribución de errores
Clasifica los errores en rangos:
- **< 4 h** → predicción muy precisa
- **4–8 h** → predicción aceptable
- **8–24 h** → predicción imprecisa
- **> 24 h** → predicción muy imprecisa

### MAE histórico mensual
Permite ver si el modelo **mejoró** con el tiempo comparando el MAE mes a mes.

### Tramos con mayor error
Identifica las rutas donde el modelo predice peor, lo que señala dónde recolectar más datos o revisar la configuración.

---

## Ciclo de auto-entrenamiento

```
                    ┌──────────────────────────────────┐
                    │         Operación normal         │
                    │  Paquetes circulan por la red    │
                    └──────────────┬───────────────────┘
                                   │ al completarse cada tramo
                                   ▼
                    ┌──────────────────────────────────┐
                    │     RegistrarDatoTramoAsync()    │
                    │  Guarda el caso real en la BD    │
                    └──────────────┬───────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────┐
                    │   ReestimarYActualizarAsync()    │
                    │  Consulta historial acumulado    │
                    │  Genera nueva predicción         │◄──┐
                    │  Actualiza fecha estimada        │   │
                    └──────────────┬───────────────────┘   │
                                   │                       │
                                   ▼                       │
                    ┌──────────────────────────────────┐   │
                    │  GenerarAlertaRiesgoSiCorresponde│   │
                    │  Calcula P(demora | ruta)        │   │
                    │  Si ≥ 70% → crea alerta         │   │
                    └──────────────┬───────────────────┘   │
                                   │                       │
                                   └───────────────────────┘
                                   (el ciclo se repite con
                                    cada tramo completado)
```

**No hay un paso de "reentrenamiento" manual**: el sistema aprende continuamente. Cada entrega completada es inmediatamente un nuevo dato de entrenamiento para las próximas predicciones.

---

## Versiones del modelo

El sistema reconoce automáticamente en qué fase está:

| Registros acumulados | Versión | Comportamiento |
|---|---|---|
| 0–49 | `v0.1 – Heurística base` | Sin ML real, usa estimaciones estáticas |
| 50–499 | `v1.0 – Heurística mejorada con historial` | Promedios históricos activos |
| 500+ | *(preparado para upgrade)* | Listo para migrar a ML.NET / modelo entrenado |

El flag `PuedeReentrenar = true` se activa cuando hay ≥ 50 registros nuevos en los últimos 30 días, señalando que hay suficiente volumen para un ciclo de mejora.

---

## Roadmap de mejoras (próximos pasos naturales)

1. **Regresión lineal múltiple**: usar todos los features (`Peso`, `DiaSemana`, `CargaSucursalOrigen`, etc.) en lugar de solo el promedio por tramo
2. **Árbol de decisión / Random Forest** vía `ML.NET`: el dataset `DatosEntrenamientoTramo` ya tiene exactamente el formato correcto para entrenarlo
3. **Calibración del clasificador de riesgo**: usar el feedback de `AlertaRiesgoDemoraMl.LlegoATiempo` para ajustar el umbral del 70%
4. **Modelo por segmento de features**: separar modelos por `TipoEnvio` o `DiaSemana` para mayor precisión

---

## Resumen ejecutivo

| Aspecto | Detalle |
|---|---|
| **Técnica de regresión** | k-NN con ventana deslizante de 100 instancias por ruta |
| **Técnica de clasificación** | Clasificador de frecuencia bayesiana (P(demora\|ruta)) |
| **Tipo de aprendizaje** | Online / incremental — sin reentrenamiento manual |
| **Se auto-mejora** | Sí, con cada tramo de entrega completado |
| **Umbral de activación ML** | ≥ 10 registros por tramo (regresión) / ≥ 5 registros (clasificación) |
| **Métrica de calidad** | MAE en horas (regresión) + tasa de detección (clasificación) |
| **Dataset** | `DatosEntrenamientoTramo` — 11 features por registro |
| **Preparado para escalar** | Sí — estructura lista para ML.NET u otro framework |
