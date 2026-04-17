# Sistema de Gestión de Pedidos — Concejo Escolar de Azul
## Documento de Requerimientos y Análisis

---

## 1. Descripción General

Aplicación web para la gestión de pedidos de ingredientes del Servicio Alimentario Escolar (SAE) del partido de Azul. El sistema permite administrar recetas, menús estacionales, escuelas, proveedores e ingredientes, y genera automáticamente las órdenes de compra semanales por proveedor y un resumen interno global.

**Stack tecnológico:**
- Frontend: Next.js
- Backend: FastAPI (Python)
- Base de datos: SQLite con backups automáticos periódicos
- Autenticación: JWT (industry standards — HTTPS only, tokens con expiración, refresh tokens, almacenamiento seguro)

---

## 2. Roles y Permisos

| Funcionalidad | Administrador | Gestor | Escuela |
|---|---|---|---|
| Crear/editar/desactivar usuarios | ✅ | ❌ | ❌ |
| CRUD Localidades | ✅ | ❌ | ❌ |
| CRUD Ingredientes | ✅ | ❌ | ❌ |
| CRUD Proveedores | ✅ | ❌ | ❌ |
| Asignar proveedor a ingrediente por localidad | ✅ | ❌ | ❌ |
| CRUD Recetas (con ingredientes) | ✅ | ❌ | ❌ |
| CRUD Temporadas y opciones de menú | ✅ | ❌ | ❌ |
| Asignar recetas a días del menú | ✅ | ❌ | ❌ |
| CRUD Escuelas | ✅ | ✅ | ❌ |
| Actualizar matrícula de escuelas | ✅ | ✅ | ❌ |
| Generar órdenes de compra | ✅ | ✅ | ❌ |
| Ver historial de pedidos generados (todos) | ✅ | ✅ | ❌ |
| Cargar stock previo de su escuela | ❌ | ❌ | ✅ |
| Ver pedidos generados de su escuela | ❌ | ❌ | ✅ |

---

## 3. Entidades y Modelo de Datos

### 3.1 Usuario
```
Usuario
  - id
  - nombre
  - email (único)
  - password_hash
  - rol: ADMIN | GESTOR | ESCUELA
  - escuela_id → Escuela  (null para ADMIN y GESTOR; obligatorio para ESCUELA)
  - activo: bool
  - created_at
```

### 3.2 Localidad
Localidades del partido de Azul (Azul, Cacharí, Chillar, etc.)
```
Localidad
  - id
  - nombre (único)
```

### 3.3 Escuela
```
Escuela
  - id
  - nombre
  - codigo (único, ej: "EP1", "EES7", "JI901")
  - localidad_id → Localidad
  - matricula: int  (se actualiza cuando hay movimientos de alumnos)
  - ofrece_desayuno: bool
  - ofrece_almuerzo: bool
  - ofrece_merienda: bool
  - activo: bool
```

**Regla**: La matrícula completa de la escuela recibe todas las comidas que esa escuela ofrece. No hay subdivisiones internas por tipo de comida.

### 3.4 Ingrediente
```
Ingrediente
  - id
  - nombre
  - unidad_medida: (gs | ml | cc | unidades | kg | litros | docenas | etc.)
  - contenido_por_unidad: decimal | null  (solo cuando unidad_medida = "unidades"; peso o volumen por unidad comercial, ej: 900 para botella de 900ml)
  - unidad_contenido: str | null  (unidad en que se expresan las cantidades en recetas para ingredientes por unidad; ej: "ml")
  - indice_correccion: decimal  (default 1.0; factor multiplicador por desperdicios; ej: 1.68 para pollo con hueso)
  - activo: bool
```

### 3.5 Proveedor
```
Proveedor
  - id
  - nombre
  - contacto  (teléfono / email / dirección)
  - activo: bool
```

### 3.6 AsignacionProveedor
Asocia un ingrediente a un proveedor para una localidad específica. Cambia cada ~2 meses con nuevas licitaciones. Se mantiene historial (no se sobreescribe).

```
AsignacionProveedor
  - id
  - proveedor_id → Proveedor
  - ingrediente_id → Ingrediente
  - localidad_id → Localidad
  - precio_unitario: decimal
  - fecha_desde: date
  - fecha_hasta: date | null  (null = vigente actualmente)
```

**Regla**: Para una combinación (ingrediente, localidad) solo puede haber UNA asignación activa (fecha_hasta = null) en un momento dado. Al crear una nueva, se cierra la anterior automáticamente.

### 3.7 Temporada
```
Temporada
  - id
  - nombre: VERANO | INVIERNO
  - año: int
  - activo: bool
```

**Regla**: Solo puede haber una temporada activa a la vez. Al activar una nueva temporada, el sistema desactiva la anterior automáticamente. La temporada activa es la que aparece preseleccionada al generar un pedido.

### 3.8 OpcionMenu
Cada temporada tiene 2 opciones de menú (semana A y semana B).
```
OpcionMenu
  - id
  - temporada_id → Temporada
  - numero_opcion: 1 | 2
  - descripcion: str  (opcional, ej: "Semana A - Invierno 2026")
```

### 3.9 Receta
Una receta es una preparación para un tipo de comida específico. La cantidad de cada ingrediente es una sola porción estándar (equivalente al promedio de un alumno de primaria 9-11 años).

```
Receta
  - id
  - nombre  (ej: "Fideos con Estofado de Pollo + Postre de Leche")
  - tipo_comida: DESAYUNO | ALMUERZO | MERIENDA
  - activo: bool
```

### 3.10 RecetaIngrediente
```
RecetaIngrediente
  - id
  - receta_id → Receta
  - ingrediente_id → Ingrediente
  - cantidad_por_porcion: decimal  (en la unidad definida en Ingrediente)
```

### 3.11 DiaMenu
Asignación de recetas a días dentro de una opción de menú. Cada combinación (opcion, dia, tipo_comida) es única.

```
DiaMenu
  - id
  - opcion_menu_id → OpcionMenu
  - dia_semana: 1-5  (1=Lunes ... 5=Viernes)
  - tipo_comida: DESAYUNO | ALMUERZO | MERIENDA
  - receta_id → Receta
```

**Constraint**: UNIQUE (opcion_menu_id, dia_semana, tipo_comida)

### 3.12 GeneracionPedido
Registro histórico de cada orden de compra generada.
```
GeneracionPedido
  - id 
  - semana_inicio: date  (lunes de la semana)
  - opcion_menu_id → OpcionMenu
  - dias_habiles: str  (JSON array, ej: [1,2,3,4] para Lun-Jue; [1,2,3,4,5] = semana completa)
  - generado_por → Usuario
  - generado_at: datetime
  - notas: str (opcional)
  - datos_snapshot: JSON  (precios unitarios y cantidades calculadas al momento de generación, para permitir re-descarga exacta de documentos anteriores)
```

**Regla**: El snapshot se guarda al confirmar el pedido y nunca se modifica. Contiene, por escuela y por ingrediente: cantidad calculada, stock descontado, cantidad final pedida, y precio unitario del proveedor asignado en esa fecha. Esto garantiza que re-descargar un pedido anterior siempre produce el mismo documento original.

### 3.13 StockPrevio
Stock cargado por las escuelas (o manualmente por el gestor) antes de la generación del pedido semanal.
```
StockPrevio
  - id
  - escuela_id → Escuela
  - ingrediente_id → Ingrediente
  - cantidad: decimal  (en la unidad de medida del ingrediente)
  - cargado_por → Usuario
  - cargado_at: datetime
```

**Regla**: Solo puede haber un registro activo por combinación (escuela, ingrediente). Al generar el pedido semanal, todos los registros de StockPrevio de las escuelas incluidas en ese pedido se resetean a 0 automáticamente. Si una escuela no cargó stock, el valor es 0 por defecto.

---

## 4. Reglas de Negocio

1. **Porción estándar**: Todas las recetas usan una única cantidad por porción (promedio 9-11 años). No hay distinción por grupo etario en la app.

2. **Cantidad a pedir por escuela**: La fórmula completa, en orden de aplicación:
   1. `cantidad_base = suma(cantidad_por_porción × días_hábiles_aplicables) × matrícula` (solo para comidas que la escuela ofrece)
   2. `cantidad_corregida = cantidad_base × indice_correccion` (si indice = 1.0, no hay cambio)
   3. `cantidad_neta = max(0, cantidad_corregida - stock_previo)`
   4. Si el ingrediente es por unidad: `cantidad_final = ceil(cantidad_neta / contenido_por_unidad)` (entero, siempre redondea hacia arriba)

3. **Cantidad semanal por escuela**: Se suman únicamente los días hábiles seleccionados al generar el pedido. Si se deshabilita el viernes (feriado, paro, etc.), no se suma ninguna receta de ese día para ninguna escuela.

4. **Asignación de proveedor**: Para cada ingrediente que necesita una escuela, el proveedor se determina por `(ingrediente, localidad_de_la_escuela)`. Se usa la asignación activa en la fecha de generación del pedido.

5. **Cambio de proveedor (licitación)**: Al crear una nueva asignación proveedor-ingrediente-localidad, el sistema cierra automáticamente la vigente anterior y abre la nueva.

6. **Opciones de menú**: Hay exactamente 2 opciones por temporada. Al generar un pedido, el gestor elige qué opción aplica a esa semana.

7. **Días inhábiles**: Al generar un pedido, el usuario puede desactivar cualquier día de la semana (1-5). Los días desactivados no se suman en el cálculo. Esto aplica uniformemente a todas las escuelas. Los días seleccionados quedan guardados en el registro histórico del pedido.

8. **Stock previo por escuela**: El stock puede ser cargado de dos maneras: (a) por el usuario Escuela directamente en cualquier momento antes de la generación, o (b) por el gestor en el paso de carga de stock durante la generación del pedido. El gestor ve la tabla pre-completada con lo que cada escuela haya cargado y puede editarla. Si una escuela no cargó nada, su stock es 0. El stock se ingresa en la misma unidad de medida del ingrediente. Al confirmar el pedido, todos los registros de StockPrevio de las escuelas incluidas se resetean a 0.

9. **Escuelas inactivas**: No se incluyen en los cálculos de pedidos.

10. **Ingredientes sin proveedor asignado**: Si al generar el pedido existe un ingrediente de una receta sin proveedor activo para esa localidad, el sistema muestra una advertencia y excluye ese ingrediente del documento, listándolo aparte para resolución manual.

11. **Índice de corrección por desperdicios**: Cada ingrediente puede tener un índice de corrección (por defecto 1.0 = sin corrección). Se multiplica por la cantidad base antes de descontar el stock y antes de redondear a unidades. Ejemplo: 100 g de pollo × 1.68 = 168 g a pedir al proveedor.

12. **Ingredientes por unidad**: Cuando `unidad_medida = "unidades"` y `contenido_por_unidad` está definido, la cantidad calculada en la unidad base se convierte a unidades comerciales redondeando siempre hacia arriba (`ceil`). Ejemplo: 1200 ml / 900 ml por botella = ceil(1.33) = 2 botellas. El descuento de stock también se expresa en la unidad base antes del redondeo.

13. **Rol Escuela**: Cada usuario con rol ESCUELA está asociado a una única escuela. Solo puede cargar el stock previo de su propia escuela y ver el historial de pedidos generados que incluyen a su escuela. No puede generar pedidos, ver datos de otras escuelas ni acceder a ninguna función administrativa.

---

## 5. Funcionalidades Principales

### 5.1 Autenticación
- Login con email + contraseña
- JWT access token (corta duración) + refresh token (larga duración, rotativo)
- Logout invalida el refresh token
- Passwords hasheadas con bcrypt
- Protección contra brute force (rate limiting en login)
- Solo HTTPS en producción

### 5.2 Gestión de Usuarios (Admin)
- Crear usuario con rol (Admin/Gestor/Escuela)
- Para usuarios con rol Escuela, seleccionar la escuela asociada (1:1)
- Editar nombre, email, rol
- Activar/desactivar usuario (no se eliminan)
- Reset de contraseña por el administrador

### 5.3 CRUD Localidades (Admin)
- Crear, editar, listar localidades del partido de Azul

### 5.4 CRUD Ingredientes (Admin)
- Crear, editar, desactivar ingredientes
- Definir nombre y unidad de medida
- Si la unidad es "unidades": definir `contenido_por_unidad` y `unidad_contenido` (ej: 900 ml por botella)
- Definir índice de corrección por desperdicios (opcional; default 1.0)

### 5.5 CRUD Proveedores (Admin)
- Crear, editar, desactivar proveedores
- Datos de contacto
- Vista de asignaciones activas e historial por proveedor

### 5.6 Asignaciones Proveedor-Ingrediente-Localidad (Admin)
- Listar asignaciones vigentes
- Crear nueva asignación (cierra la anterior automáticamente)
- Ver historial de cambios por ingrediente+localidad
- Editar precio de asignación vigente

### 5.7 CRUD Recetas (Admin)
- Crear receta con nombre y tipo de comida
- Agregar/editar/eliminar ingredientes de la receta con sus cantidades
- Ver listado de recetas por tipo de comida

### 5.8 Gestión de Temporadas y Menús (Admin)
- Crear temporada (Verano/Invierno + año)
- Para cada temporada, crear las 2 opciones de menú
- Para cada opción, asignar una receta a cada combinación (día 1-5, comida: D/A/M)
- Vista tipo grilla semanal (filas=días, columnas=comidas) para armar el menú

### 5.9 CRUD Escuelas (Admin + Gestor)
- Crear escuela con código, nombre, localidad, matrícula y comidas que ofrece
- Editar matrícula
- Activar/desactivar escuela
- Ver listado por localidad

### 5.10 Generación de Órdenes de Compra (Admin + Gestor)
1. Seleccionar semana (fecha de inicio = lunes)
2. Seleccionar opción de menú (temporada + opción 1 ó 2)
3. **Seleccionar días hábiles**: 5 botones toggle (Lun/Mar/Mié/Jue/Vie), todos activados por defecto. El usuario desactiva los días sin clases (feriados, paros, etc.)
4. **Cargar stock previo** (opcional): tabla editable pre-completada con el stock que cada escuela haya cargado previamente mediante su usuario propio. Las celdas sin carga de escuela muestran 0. El gestor puede editar cualquier celda antes de confirmar.
5. El sistema calcula para cada escuela activa:
   - Solo los días hábiles seleccionados y las comidas que esa escuela ofrece
   - `cantidad_base = suma(cantidad_por_porción × días_hábiles) × matrícula`
   - `cantidad_corregida = cantidad_base × indice_correccion`
   - `cantidad_neta = max(0, cantidad_corregida - stock_previo)`
   - Si es ingrediente por unidad: `ceil(cantidad_neta / contenido_por_unidad)`
6. Agrupa resultados por proveedor (según asignación activa en esa fecha por localidad)
7. Muestra resumen en pantalla con advertencias si hay ingredientes sin proveedor
8. Exporta:
   - **Un documento por proveedor**: lista de escuelas de su localidad con cantidades por ingrediente y totales
   - **Resumen global**: todos los ingredientes, todas las escuelas, cantidades, precios unitarios y costo total semanal
9. Ambos formatos disponibles en **PDF** y **Excel (.xlsx)**

### 5.11 Historial de Pedidos
- Listado de pedidos generados (fecha, semana, menú usado, usuario)
- Re-descarga de documentos de pedidos anteriores (snapshot al momento de generación)

### 5.12 Funcionalidades del usuario Escuela
- **Cargar stock previo**: tabla con los ingredientes relevantes para su escuela (los que aparecen en el menú activo). El usuario ingresa las cantidades disponibles en cada ingrediente. Solo se muestran ingredientes de la temporada activa.
- **Ver historial de pedidos**: listado de pedidos generados que incluyen a su escuela, con los documentos descargables correspondientes (solo las filas de su escuela).
- No tiene acceso a datos de otras escuelas, proveedores, recetas, ni a la función de generación.

---

## 6. Estructura de Documentos de Output

### Documento por Proveedor
```
ORDEN DE COMPRA — SEMANA: [fecha inicio] al [fecha fin]
Proveedor: [nombre] | Localidad: [localidad]

Ingrediente         | Unidad | [Escuela 1] | [Escuela 2] | ... | TOTAL
--------------------|--------|-------------|-------------|-----|------
Leche fluida        | litros |     76,80   |     39,20   | ... | XXX
Azúcar              | kg     |      1,44   |      0,74   | ... | XXX
...

Precio unitario referencia: $X.XXX/[unidad]
Costo estimado total: $XX.XXX
```

### Resumen Global Interno
```
RESUMEN SEMANAL SAE — SEMANA: [fecha inicio] al [fecha fin]
Menú: [Temporada] - Opción [N]

Ingrediente         | Unidad | Localidad  | Cant. Total | Proveedor        | Precio Unit. | Costo Total
--------------------|--------|------------|-------------|------------------|--------------|------------
Leche fluida        | litros | Azul       |     250,00  | Proveedor A      |   $1.900,00  |  $475.000
Leche fluida        | litros | Cacharí    |      80,00  | Proveedor B      |   $2.050,00  |  $164.000
Leche fluida        | litros | Chillar    |      45,00  | Proveedor C      |   $1.850,00  |   $83.250
...

COSTO TOTAL SEMANAL: $XXX.XXX
Generado por: [usuario] | [fecha y hora]
```

Cada fila del resumen global corresponde a una combinación (ingrediente, localidad). Si un ingrediente es provisto en 3 localidades, aparece en 3 filas separadas con su proveedor y precio unitario correspondiente.

---

## 7. Plan de Implementación por Fases

### Fase 1 — Infraestructura base
- Setup del proyecto: Next.js + FastAPI + SQLite
- Sistema de autenticación JWT completo
- CRUD de usuarios con roles (Admin, Gestor, Escuela)
- Asociación usuario Escuela ↔ escuela
- Layout base del frontend con navegación por rol (cada rol ve su propia sección)

### Fase 2 — Datos maestros (Admin)
- CRUD Localidades
- CRUD Ingredientes
- CRUD Proveedores
- Gestión de asignaciones proveedor-ingrediente-localidad con historial

### Fase 3 — Recetas y Menús (Admin)
- CRUD Recetas con ingredientes y cantidades
- CRUD Temporadas
- Gestión de opciones de menú (grilla semanal)

### Fase 4 — Escuelas (Admin + Gestor)
- CRUD Escuelas
- Actualización de matrícula
- Gestión de StockPrevio (carga por usuario Escuela y edición por gestor)
- Vista de historial de pedidos para usuario Escuela (filtrado a su propia escuela)

### Fase 5 — Generación de Pedidos
- Motor de cálculo de cantidades con soporte de días hábiles, índice de corrección, redondeo por unidad y descuento de stock
- UI con toggles de días y tabla de stock editable pre-completada con carga de escuelas
- Agrupación por proveedor y localidad
- Generación de documentos PDF
- Generación de documentos Excel (.xlsx)
- Historial de pedidos generados con snapshot completo

### Fase 6 — Backups y producción
- Backup automático de SQLite (diario, con retención configurable)
- Manejo de errores global y logging
- Validaciones y mensajes de advertencia en UI
- Deploy

---

## 8. Consideraciones Técnicas

- **SQLite**: suficiente para el volumen de datos (~50-100 escuelas, pedidos semanales). Backups automáticos con copia del archivo `.db` a directorio seguro.
- **PDF**: generación server-side con `WeasyPrint` o `ReportLab` en el backend.
- **Excel**: generación con `openpyxl` en el backend.
- **Rate limiting**: en endpoints de autenticación para prevenir brute force.
- **CORS**: configurado estrictamente para el dominio del frontend.
- **Variables de entorno**: secrets (JWT_SECRET, etc.) nunca en el repositorio.
- **Migraciones**: `Alembic` para gestión del schema de SQLite.
