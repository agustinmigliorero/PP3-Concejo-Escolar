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

| Funcionalidad | Administrador | Gestor |
|---|---|---|
| Crear/editar/desactivar usuarios | ✅ | ❌ |
| CRUD Localidades | ✅ | ❌ |
| CRUD Ingredientes | ✅ | ❌ |
| CRUD Proveedores | ✅ | ❌ |
| Asignar proveedor a ingrediente por localidad | ✅ | ❌ |
| CRUD Recetas (con ingredientes) | ✅ | ❌ |
| CRUD Temporadas y opciones de menú | ✅ | ❌ |
| Asignar recetas a días del menú | ✅ | ❌ |
| CRUD Escuelas | ✅ | ✅ |
| Actualizar matrícula de escuelas | ✅ | ✅ |
| Generar órdenes de compra | ✅ | ✅ |
| Ver historial de pedidos generados | ✅ | ✅ |

---

## 3. Entidades y Modelo de Datos

### 3.1 Usuario
```
Usuario
  - id
  - nombre
  - email (único)
  - password_hash
  - rol: ADMIN | GESTOR
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
  - generado_por → Usuario
  - generado_at: datetime
  - notas: str (opcional)
```

---

## 4. Reglas de Negocio

1. **Porción estándar**: Todas las recetas usan una única cantidad por porción (promedio 9-11 años). No hay distinción por grupo etario en la app.

2. **Cantidad a pedir por escuela**: `matrícula_escuela × cantidad_por_porción_ingrediente`, aplicado solo a los días/comidas que esa escuela ofrece.

3. **Cantidad semanal por escuela**: Se suman los 5 días de la semana para cada comida que ofrece la escuela. Si una escuela solo tiene almuerzo, solo se suman los almuerzos de lunes a viernes.

4. **Asignación de proveedor**: Para cada ingrediente que necesita una escuela, el proveedor se determina por `(ingrediente, localidad_de_la_escuela)`. Se usa la asignación activa en la fecha de generación del pedido.

5. **Cambio de proveedor (licitación)**: Al crear una nueva asignación proveedor-ingrediente-localidad, el sistema cierra automáticamente la vigente anterior y abre la nueva.

6. **Opciones de menú**: Hay exactamente 2 opciones por temporada. Al generar un pedido, el gestor elige qué opción aplica a esa semana.

7. **Escuelas inactivas**: No se incluyen en los cálculos de pedidos.

8. **Ingredientes sin proveedor asignado**: Si al generar el pedido existe un ingrediente de una receta sin proveedor activo para esa localidad, el sistema muestra una advertencia y excluye ese ingrediente del documento, listándolo aparte para resolución manual.

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
- Crear usuario con rol (Admin/Gestor)
- Editar nombre, email, rol
- Activar/desactivar usuario (no se eliminan)
- Reset de contraseña por el administrador

### 5.3 CRUD Localidades (Admin)
- Crear, editar, listar localidades del partido de Azul

### 5.4 CRUD Ingredientes (Admin)
- Crear, editar, desactivar ingredientes
- Definir nombre y unidad de medida

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
- Editar matrícula (con fecha de actualización registrada)
- Activar/desactivar escuela
- Ver listado por localidad

### 5.10 Generación de Órdenes de Compra (Admin + Gestor)
1. Seleccionar semana (fecha de inicio = lunes)
2. Seleccionar opción de menú (temporada + opción 1 ó 2)
3. El sistema calcula:
   - Para cada escuela activa con comidas asignadas
   - Para cada día de la semana y cada comida que ofrece esa escuela
   - Suma cantidades de cada ingrediente × matrícula
4. Agrupa resultados por proveedor (según asignación activa en esa fecha por localidad)
5. Muestra resumen en pantalla con advertencias si hay ingredientes sin proveedor
6. Exporta:
   - **Un documento por proveedor**: lista de escuelas de su localidad con cantidades por ingrediente y totales
   - **Resumen global**: todos los ingredientes, todas las escuelas, cantidades, precios unitarios y costo total semanal
7. Ambos formatos disponibles en **PDF** y **Excel (.xlsx)**

### 5.11 Historial de Pedidos
- Listado de pedidos generados (fecha, semana, menú usado, usuario)
- Re-descarga de documentos de pedidos anteriores (snapshot al momento de generación)

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

Ingrediente | Unidad | Cant. Total | Proveedor(es) | Precio Unit. | Costo Total
...

COSTO TOTAL SEMANAL: $XXX.XXX
Generado por: [usuario] | [fecha y hora]
```

---

## 7. Plan de Implementación por Fases

### Fase 1 — Infraestructura base
- Setup del proyecto: Next.js + FastAPI + SQLite
- Sistema de autenticación JWT completo
- CRUD de usuarios con roles
- Layout base del frontend con navegación por rol

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
- Actualización de matrícula con historial de cambios

### Fase 5 — Generación de Pedidos
- Motor de cálculo de cantidades
- Agrupación por proveedor y localidad
- Generación de documentos PDF
- Generación de documentos Excel (.xlsx)
- Historial de pedidos generados

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
