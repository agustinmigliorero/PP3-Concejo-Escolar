# Sistema de Gestión de Pedidos SAE
## Documento de Validación — Concejo Escolar de Azul

> Este documento resume cómo va a funcionar el sistema para que el Concejo Escolar pueda revisarlo, hacer correcciones y dejar todo validado antes de comenzar el desarrollo.

---

## 1. ¿Qué es este sistema?

Una aplicación web para administrar los pedidos de ingredientes del **Servicio Alimentario Escolar (SAE)** del partido de Azul. Reemplaza el proceso actual en planillas de Excel por un sistema centralizado que:

- Guarda las recetas, menús, escuelas, proveedores e ingredientes en un solo lugar.
- Calcula automáticamente cuánto hay que pedir de cada ingrediente según el menú de la semana y la matrícula de cada escuela.
- Genera las órdenes de compra listas para enviar a cada proveedor, en PDF y Excel.
- Genera un resumen interno semanal con costos totales para registro del Concejo.

---

## 2. ¿Quiénes van a usar el sistema?

Habrá dos tipos de usuarios:

### Administrador
Tiene acceso total. Es quien mantiene la información "estructural" del sistema:

- Crea y gestiona usuarios (administradores y gestores).
- Carga y modifica las **recetas** cada temporada.
- Carga y modifica los **ingredientes**.
- Carga y modifica los **proveedores** y a qué ingredientes abastecen en cada localidad.
- Define los **menús semanales** (temporada + opción 1 y opción 2).
- También puede hacer todo lo que hace el gestor.

### Gestor
Tiene acceso al día a día operativo:

- Carga y modifica las **escuelas**: nombre, localidad, matrícula, y qué comidas ofrece (desayuno, almuerzo, merienda o combinaciones).
- Actualiza la matrícula cuando hay altas/bajas de alumnos.
- **Genera las órdenes de compra semanales**.
- Consulta el historial de pedidos anteriores.

**No puede**: crear usuarios, modificar recetas, ingredientes, proveedores o menús.

> **📋 Validar**: ¿Los dos roles cubren bien la organización interna? ¿Hay alguna persona que necesite permisos intermedios?

---

## 3. Información que carga el Administrador

### 3.1 Localidades
Localidades del partido de Azul donde hay escuelas (Azul, Cacharí, Chillar, y las que correspondan). Se cargan una sola vez y se actualizan muy poco.

### 3.2 Ingredientes
Cada ingrediente tiene:
- **Nombre** (ej: "Leche fluida", "Fideos secos", "Pollo").
- **Unidad de medida** (gramos, mililitros, litros, kilogramos, unidades, docenas, etc.).

### 3.3 Proveedores
Cada proveedor tiene nombre y datos de contacto. Los proveedores cambian aproximadamente cada 2 meses cuando hay nuevas licitaciones.

### 3.4 Asignación de proveedores por localidad
Acá se define: **"¿Quién provee cada ingrediente en cada localidad?"**

Por ejemplo:
- En **Azul**, la leche la provee el Proveedor A a $1.900/litro.
- En **Cacharí**, la misma leche la provee el Proveedor B a $2.050/litro.
- En **Chillar**, la leche la provee el Proveedor C a $1.850/litro.

Cuando una nueva licitación cambia el proveedor de leche en Azul, el administrador carga la nueva asignación y el sistema automáticamente cierra la anterior, guardando el historial. A partir de ese momento, los cálculos usan el nuevo proveedor y el nuevo precio.

> **📋 Validar**: ¿Es correcto que para un ingrediente + localidad siempre hay un único proveedor a la vez?

### 3.5 Recetas
Cada receta tiene:
- **Nombre** (ej: "Fideos con estofado de pollo + postre de leche").
- **Tipo de comida**: Desayuno, Almuerzo o Merienda.
- **Lista de ingredientes** con la **cantidad por porción** (una sola cantidad estándar, basada en el promedio de un alumno de primaria de 9-11 años).

Ejemplo:
| Ingrediente | Cantidad por porción |
|---|---|
| Fideos secos | 50 g |
| Pollo | 50 g |
| Tomate triturado | 20 cc |
| Cebolla | 10 g |

> **📋 Validar**: ¿Está bien usar una única porción estándar (promedio 9-11 años) para todos los grupos etarios? En las planillas actuales vemos columnas separadas para Inicial / 6-8 / 9-11 / Secundaria, pero entendemos que el Concejo ya calcula con el promedio.

### 3.6 Temporadas y Menús
- Hay **2 temporadas por año**: Verano e Invierno.
- Cada temporada tiene **2 opciones de menú** (Opción 1 y Opción 2).
- Cada opción es una **semana completa**: Lunes a Viernes, con Desayuno, Almuerzo y Merienda por día.
- Para cada "casilla" (día + comida) el administrador asigna una receta de la biblioteca.

El sistema va a mostrar una grilla tipo calendario para armar cada menú:

|        | Desayuno | Almuerzo | Merienda |
|--------|----------|----------|----------|
| Lunes  | [Receta] | [Receta] | [Receta] |
| Martes | [Receta] | [Receta] | [Receta] |
| ...    | ...      | ...      | ...      |

> **📋 Validar**:
> - ¿Siempre son exactamente 2 opciones por temporada, o podría haber más en algún caso?
> - ¿Las opciones se alternan semana por medio, o el gestor elige cuál aplicar cada semana al generar el pedido?

---

## 4. Información que carga el Gestor

### 4.1 Escuelas
Para cada escuela:
- **Nombre** y **código** (ej: "EP 1", "EES 7", "JI 901").
- **Localidad**.
- **Matrícula total** (número de alumnos).
- **Qué comidas ofrece**: cualquier combinación de Desayuno, Almuerzo y Merienda (puede ser solo una, dos o las tres).
- **Estado**: activa o inactiva.

> **📋 Validar**:
> - ¿La matrícula completa de una escuela recibe todas las comidas que esa escuela ofrece? (O sea, si una escuela tiene 100 alumnos y ofrece almuerzo + merienda, son 100 almuerzos + 100 meriendas).
> - ¿Hace falta guardar historial de cambios de matrícula, o solo nos interesa el valor actual?

---

## 5. Cómo se genera un pedido semanal

Este es el flujo principal del sistema:

### Paso 1: Seleccionar la semana
El gestor elige la fecha de inicio (lunes) de la semana para la que quiere generar el pedido.

### Paso 2: Elegir la opción de menú
Selecciona temporada + Opción 1 o Opción 2. Esto define qué recetas se van a usar esa semana.

### Paso 3: Marcar los días hábiles
Aparecen 5 botones: **Lunes, Martes, Miércoles, Jueves, Viernes**. Todos activados por defecto.

El gestor **desactiva los días que no corresponden** a esa semana puntual: feriados, paros, suspensiones, etc. Por ejemplo, si el viernes es feriado, se desactiva Viernes y las recetas de ese día no se incluyen en el cálculo.

### Paso 4: Cargar stock previo (opcional)
Aparece una tabla con las escuelas y los ingredientes que van a usarse esa semana. **Todos los valores arrancan en 0**.

Si alguna escuela quedó con sobrantes de alguna cosa (por ejemplo, 5 kg de fideos que no se usaron la semana pasada), el gestor los carga en la casilla correspondiente. El sistema va a descontar ese stock del cálculo.

> El stock **no se guarda entre semanas** — cada semana arranca en cero. Es responsabilidad del gestor cargarlo manualmente cuando aplique.

### Paso 5: Revisar y generar
El sistema calcula todo y muestra en pantalla un resumen:

- Cuánto se va a pedir de cada ingrediente.
- Agrupado por proveedor (según la localidad de cada escuela).
- Con advertencias si detecta algún problema (ej: un ingrediente no tiene proveedor asignado en alguna localidad).

### Paso 6: Descargar los documentos
Una vez confirmado, el sistema genera:

**a) Un documento por cada proveedor** (PDF y Excel)
Lista las escuelas de esa localidad, con las cantidades de cada ingrediente que ese proveedor debe entregar. Es el documento que se le envía al proveedor como orden de compra.

**b) Un resumen global interno** (PDF y Excel)
Todos los ingredientes, todas las escuelas, precios unitarios y **costo total estimado de la semana**. Es para registro interno del Concejo.

---

## 6. Fórmula de cálculo (explicada)

Para cada ingrediente de cada receta:

```
Cantidad a pedir = (cantidad_por_porción × matrícula × días hábiles aplicables) - stock en la escuela
```

Y si el resultado es negativo (la escuela tiene más stock del que necesita), se pide **cero** — nunca un número negativo.

**Ejemplo concreto:**

- Escuela **EP 14** tiene 164 alumnos, ofrece almuerzo.
- La semana hay **4 días hábiles** (el viernes es feriado).
- Las recetas de Lunes a Jueves llevan en total **240 g de pollo por porción**.
- La escuela reporta **3 kg de stock** de pollo.

Cálculo:
```
240 g × 164 alumnos = 39.360 g = 39,36 kg
39,36 kg - 3 kg = 36,36 kg de pollo a pedir
```

Ese pedido va dirigido al proveedor de pollo asignado a la localidad de EP 14.

---

## 7. Historial y trazabilidad

El sistema guarda un registro de cada pedido generado:
- Fecha y hora de generación.
- Usuario que lo generó.
- Semana a la que corresponde.
- Qué opción de menú se usó.
- Qué días hábiles se aplicaron.

Cualquier pedido anterior se puede volver a descargar en PDF o Excel en cualquier momento.

---

## 8. Lo que el sistema NO hace (aclaraciones de alcance)

Para evitar malentendidos, dejamos claro lo que **queda fuera** del alcance inicial:

- ❌ **No controla stock en tiempo real**: el stock se ingresa manualmente al generar el pedido y no se descuenta automáticamente después.
- ❌ **No gestiona entregas ni logística**: solo emite las órdenes de compra. El seguimiento de entregas queda fuera.
- ❌ **No gestiona facturas ni pagos a proveedores**.
- ❌ **No distingue porciones por grupo etario**: usa una única porción estándar por receta.
- ❌ **No calcula información nutricional** (calorías, macros, etc.).
- ❌ **No envía emails automáticos a proveedores**: los documentos se descargan y el envío es manual.

> **📋 Validar**: ¿Alguna de estas exclusiones debería estar incluida? ¿Falta algún otro aclaración de alcance?

---

## 9. Preguntas pendientes de validación

Resumen de las preguntas que quedan abiertas para conversar con el Concejo:

1. ¿Los dos roles (Administrador y Gestor) cubren bien las necesidades operativas?
2. ¿Es correcto que cada ingrediente + localidad tenga un único proveedor activo a la vez?
3. ¿Está bien usar una única porción estándar (9-11 años) para todas las recetas?
4. ¿Siempre son exactamente 2 opciones de menú por temporada?
5. ¿Cómo se elige qué opción aplica cada semana? ¿Alternancia fija o elección del gestor?
6. ¿Necesitamos guardar historial de matrícula o solo el valor actual alcanza?
7. ¿Hay alguna funcionalidad dentro de "lo que no hace" que debería incluirse?
8. ¿Hay algún reporte adicional que el Concejo necesite más allá de las órdenes por proveedor y el resumen global?
9. ¿Cuántas localidades y escuelas aproximadamente va a manejar el sistema?
10. ¿Con qué frecuencia cambia la matrícula? ¿Y los proveedores (confirmamos que es cada 2 meses)?

---

## 10. Próximos pasos

1. **Revisión del Concejo**: lectura del documento y respuesta a las preguntas pendientes.
2. **Reunión de validación**: ajustes finales sobre lo discutido.
3. **Inicio del desarrollo**: comenzamos con el sistema de usuarios y los datos base (localidades, ingredientes, proveedores).

---

*Documento preparado para validación con el Concejo Escolar de Azul.*
