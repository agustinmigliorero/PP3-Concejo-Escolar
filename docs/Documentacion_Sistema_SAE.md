# Documentación Arquitectónica y Funcional del Sistema
**Sistema de Gestión de Pedidos - Servicio Alimentario Escolar (SAE) del Consejo Escolar de Azul**

---

## 1. Visión General del Sistema
El Sistema de Gestión de Pedidos SAE es una plataforma web centralizada diseñada para administrar los pedidos de ingredientes destinados a los comedores de las escuelas del partido de Azul. Su objetivo principal es automatizar y optimizar el cálculo de cantidades necesarias basándose en menús estandarizados, matrículas escolares y stocks previos, reemplazando el flujo manual basado en planillas de Excel.

### 1.1. Objetivos Principales
*   **Centralización:** Mantener un registro único de escuelas, proveedores, ingredientes y recetas.
*   **Automatización:** Calcular de manera automática las necesidades de compra semanales.
*   **Generación de Órdenes:** Emitir automáticamente órdenes de compra por proveedor (PDF/Excel).
*   **Trazabilidad:** Guardar el historial inmutable de las compras realizadas, con sus precios y cantidades.

---

## 2. Arquitectura Tecnológica
El proyecto sigue una arquitectura cliente-servidor tradicional, empaquetada en contenedores y preparada para despliegue automatizado.

### 2.1. Stack Tecnológico
*   **Frontend:** Next.js 16, React 19, Tailwind CSS 4.
*   **Backend:** Python 3.12, FastAPI.
*   **ORM y Base de Datos:** SQLAlchemy con SQLite (archivo local persistido en volumen Docker).
*   **Autenticación:** JWT (JSON Web Tokens) implementado con Access Tokens (15 min) y Refresh Tokens (7 días, HTTPOnly cookies).
*   **Infraestructura:** Docker y Docker Compose para orquestación de contenedores.
*   **Despliegue:** Dokploy (Auto-deploy conectado a la rama `main` de GitHub).

### 2.2. Estructura y Funcionalidad del Código (Backend)
El código del backend sigue una arquitectura en capas limpias y separadas para favorecer la escalabilidad y permitir que el equipo trabaje de manera estructurada:

*   **`models/` (Modelos de Datos):** Definen las clases de SQLAlchemy. Mapean exactamente a las tablas de la base de datos (ej. `User`, `Ingrediente`, `Localidad`). Tienen la responsabilidad exclusiva de representar la estructura y relaciones de la base de datos.
*   **`controllers/` (Controladores / Esquemas Pydantic):** Definen los esquemas usados para validar los datos de entrada (Request) y serializar los de salida (Response). Filtran, formatean y validan la información que viaja entre la API y el cliente web.
*   **`services/` (Servicios / Lógica de Negocio):** Contienen toda la lógica, cálculos, reglas de negocio y operaciones transaccionales con la base de datos. Reciben peticiones de las rutas, hacen el trabajo pesado y devuelven el resultado. Es el núcleo puro de la aplicación.
*   **`routes/` (Rutas / Endpoints FastAPI):** Definen las URL y métodos HTTP (GET, POST, PUT, DELETE). Su función es mínima: capturar la petición web, validar la autenticación (mediante dependencias) y delegar el procesamiento al servicio correspondiente.
*   **`middlewares/` y `config/`:** Manejan funciones transversales como la autenticación JWT (`auth_middleware.py` controla los roles), conexión a base de datos (`database.py`) y configuración global manejada con variables de entorno (`settings.py`).

---

## 3. Endpoints API (Implementados)
A continuación, se listan los recursos HTTP desarrollados actualmente en el sistema para que puedan ser consumidos por el Frontend:

### 3.1. Autenticación (`/auth`)
*   `POST /auth/login`: Inicia sesión, retorna `access_token` y establece el `refresh_token` como cookie HTTP-only segura.
*   `POST /auth/refresh`: Renueva un token de acceso expirado usando el `refresh_token` validando la cookie.
*   `POST /auth/logout`: Elimina la cookie del `refresh_token` y lo invalida (cierra sesión).
*   `GET /auth/me`: Retorna la información del usuario autenticado actualmente (requiere token).

### 3.2. Usuarios (`/users`)
*   `GET /users`: Lista completa de todos los usuarios registrados (Requiere rol Admin).
*   `POST /users`: Creación de un usuario definiendo su rol y su escuela asociada si corresponde (Admin).
*   `GET /users/{id}`: Obtiene información detallada de un usuario específico (Admin).
*   `PUT /users/{id}`: Actualiza los datos (nombre, credenciales o rol) de un usuario (Admin).
*   `PATCH /users/{id}/toggle-active`: Activa o desactiva (soft-delete) a un usuario (Admin).

### 3.3. Localidades (`/localidades`)
*   `GET /localidades`: Lista todas las localidades disponibles (Requiere rol Admin o Gestor).
*   `POST /localidades`: Crea el registro de una nueva localidad (Admin).
*   `PUT /localidades/{id}`: Actualiza el nombre u otros datos de una localidad (Admin).
*   `PATCH /localidades/{id}/toggle-active`: Activa o desactiva temporalmente a la localidad (Admin).

### 3.4. Ingredientes (`/ingredientes`)
*   `GET /ingredientes`: Listado general de ingredientes del SAE (Admin/Gestor).
*   `GET /ingredientes/{id}`: Detalle de un ingrediente en particular (Admin/Gestor).
*   `POST /ingredientes`: Crea un nuevo ingrediente (permite definir la unidad, las conversiones por unidad comercial y el índice de corrección por desperdicio) (Admin).
*   `PUT /ingredientes/{id}`: Edita las propiedades estructurales de un ingrediente (Admin).
*   `PATCH /ingredientes/{id}/toggle-active`: Activa o desactiva temporalmente el uso de un ingrediente para no mostrarlo en nuevas recetas (Admin).

---

## 4. Roles y Seguridad

El sistema implementa un modelo de Control de Acceso Basado en Roles (RBAC) con tres perfiles bien definidos:

1.  **Administrador:** Acceso irrestricto. Responsable de la configuración estructural (ABM de Usuarios, Localidades, Ingredientes, Proveedores, Asignaciones, Recetas y Menús estacionales).
2.  **Gestor:** Acceso operativo. Gestiona la información de las Escuelas (matrículas), genera los pedidos semanales (con posibilidad de alterar días hábiles y editar stock previo) y consulta el historial global.
3.  **Escuela:** Acceso restringido. Cada usuario de este tipo está vinculado estrictamente a una (1) escuela. Puede cargar el stock sobrante (previo al pedido) y visualizar exclusivamente los pedidos donde su institución está incluida.

*Seguridad:* Las contraseñas están hasheadas usando `bcrypt`. Todas las transacciones en producción deben operar bajo HTTPS.

---

## 5. Modelo de Entidades y Datos

El modelo de dominio se basa en las siguientes entidades principales:

*   **Usuario:** Credenciales y asignación de roles.
*   **Escuela:** Institución educativa con su matrícula y los servicios que ofrece (Desayuno, Almuerzo, Merienda).
*   **Localidad:** División geográfica (Azul, Cacharí, Chillar, etc.).
*   **Proveedor:** Entidades comerciales que suministran los ingredientes.
*   **Ingrediente:** Materias primas con su unidad de medida, factor de desperdicio (índice de corrección) y regla de conversión a unidades comerciales si aplica.
*   **Asignación de Proveedor:** Relación temporal y excluyente que determina qué proveedor entrega qué ingrediente en qué localidad, fijando el precio unitario vigente.
*   **Receta e Ingredientes de Receta:** Composiciones estándar por porción para un tipo de comida específico.
*   **Temporada y Menú:** Esquema de 2 semanas (Opción 1 y 2) que mapea una receta para cada combinación de "Día de la Semana + Tipo de Comida".
*   **Stock Previo:** Cantidades sobrantes reportadas por las escuelas, descontables del próximo pedido.
*   **Generación de Pedido:** Registro histórico (snapshot) inmutable de los cálculos, precios y escuelas involucradas en una semana determinada.

---

## 6. Reglas de Negocio Centrales y Motor de Cálculo

El corazón del sistema es el motor de cálculo de necesidades semanales. Para cada escuela y cada ingrediente del menú semanal activo, el cálculo es:

1.  **Cantidad Base:** `Suma(Cantidad en Receta × Días Hábiles Seleccionados) × Matrícula de la Escuela`. *(Se considera solo para los servicios alimentarios que la escuela efectivamente brinda).*
2.  **Corrección por Desperdicio:** `Cantidad Base × Índice de Corrección` (Ej: Pollo con hueso = 1.68).
3.  **Descuento de Stock Previsto:** `Max(0, Cantidad Corregida - Stock Previo Reportado)`.
4.  **Ajuste a Unidad Comercial (Redondeo):** Si el ingrediente se compra por unidad (ej. botella de 900ml), se aplica: `Ceil(Cantidad Neta / Contenido de Unidad Comercial)`. Siempre se redondea hacia arriba para evitar desabastecimiento.

### Otras reglas de validación:
*   Para cada pedido, el sistema selecciona automáticamente el proveedor basándose en la localidad de la escuela y la asignación activa en ese momento.
*   Si un ingrediente requerido carece de proveedor en la localidad de una escuela, el sistema levanta una advertencia (Warning) en la pre-visualización del pedido.
*   Los datos de los pedidos confirmados se congelan (snapshot de precios y cantidades). Las modificaciones futuras en matrículas o precios no alteran el histórico.

---

## 7. Flujo de Generación de Órdenes (Core Flow)

El Gestor o Administrador ejecuta las siguientes acciones:
1.  **Parámetros Iniciales:** Selecciona la semana de ejecución, la temporada y la opción de menú.
2.  **Ajuste de Días Hábiles:** Desmarca feriados o días de paro (afecta el factor multiplicador).
3.  **Ajuste de Stock:** Valida o corrige en una matriz pre-completada los stocks sobrantes informados por las escuelas.
4.  **Confirmación y Snapshot:** El sistema calcula las cantidades y precios. Se vacían los stocks previos (quedan en 0 para el ciclo siguiente) y se guarda el estado inmutable del pedido.
5.  **Emisión:** Generación de un PDF y un Excel por cada proveedor (Órdenes de Compra) y un Resumen Global unificado para el Consejo.

---

## 8. Despliegue, Producción y DevOps

Para subir y administrar este entorno en producción, es vital comprender la configuración y orquestación que se definió.

### 8.1. Entorno de Desarrollo (Local)
*   Soportado nativamente por **Docker Compose** (`docker compose up --build`).
*   Los desarrolladores pueden ejecutar backend independientemente usando `uvicorn`/`fastapi dev` y el frontend con `npm run dev`.
*   Para generar el usuario Administrador base en local: ejecutar `docker compose exec backend python seed.py` (crea un superusuario default `admin` / `admin1234`).

### 8.2. Pase a Producción con Dokploy
El despliegue es administrado de manera continua por **Dokploy** y se dispara automáticamente con cada `push` a la rama `main` de GitHub. Se requieren consideraciones especiales respecto a las variables de entorno, ya que no se usarán archivos `.env` (éstos jamás deben comitearse).

#### Configuración de Variables en el Backend (En el panel "Environment" de Dokploy):
*   `SECRET_KEY`: Una cadena segura generada por el admin (ej. con `python -c "import secrets; print(secrets.token_urlsafe(32))"`).
*   `ADMIN_PASSWORD`: Contraseña para proteger al usuario admin principal.
*   `DATABASE_URL`: `sqlite:////app/data/concejo_escolar.db`
*   `CORS_ORIGINS`: Dominio o IPs públicas del frontend separadas por coma. (Ej: `http://midominio.com,https://midominio.com`).

#### Configuración de Variables en el Frontend (Next.js):
La variable `NEXT_PUBLIC_API_URL` (URL pública a la cual apuntan los llamados del frontend hacia el backend) **NO** debe inyectarse en el "Environment" común de Dokploy. Next.js necesita que estas variables existan en tiempo de compilación (*build*). 

En el archivo `docker-compose.yml` (que Dokploy utiliza para construir la imagen) esta variable se inyecta como un **build argument** (`args`):

```yaml
frontend:
  build:
    context: ./frontend
    args:
      - NEXT_PUBLIC_API_URL=http://TUDOMINIO_DEL_BACKEND:8000
```

### 8.3. Volúmenes y Base de Datos (Muy Importante)
*   Dado que usamos SQLite, la base de datos persiste físicamente en el servidor hospedador (host) dentro de un **Volumen de Docker** (nombrado `sqlite_data` en el `docker-compose.yml`). 
*   **Precaución:** Si dicho volumen se destruye al reiniciar o actualizar los contenedores incorrectamente, se perderán todos los datos. 
*   **Backup:** El administrador del servidor debe configurar scripts o rutinas de resguardo periódicas para copiar el archivo `/app/data/concejo_escolar.db` a almacenamiento seguro o cloud.

---

## 9. Alcance y Limitaciones Definidas
*   **Manejo de Stock:** El sistema **no** maneja un kardex de stock en tiempo real. El stock reportado es puramente un mecanismo de descuento previo a la compra semanal.
*   **Estándar Nutricional:** No se discrimina la porción por grupos etarios; se utiliza un estándar promedio unificado (niños 9-11 años).
*   **Logística y Finanzas:** No se gestionan pagos, control de facturas, ni remitos de entrega de mercadería.

---
*Documento mantenido para referencia del equipo de desarrollo, arquitectura y requerimientos del PP3-Concejo-Escolar.*