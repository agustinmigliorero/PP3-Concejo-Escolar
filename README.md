# Consejo Escolar — Guía de desarrollo

Sistema de gestión de pedidos de comida escolar para el Consejo Escolar de Azul.

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Estructura del repositorio](#estructura-del-repositorio)
3. [Opción A — Levantar con Docker](#opción-a--levantar-con-docker-recomendado)
4. [Opción B — Levantar manualmente (venv + npm)](#opción-b--levantar-manualmente-venv--npm)
5. [Variables de entorno](#variables-de-entorno)
6. [Base de datos y primer usuario](#base-de-datos-y-primer-usuario)
7. [Flujo de trabajo Git](#flujo-de-trabajo-git)
8. [Deploy a producción](#deploy-a-producción)
9. [Referencia rápida de la API](#referencia-rápida-de-la-api)
10. [Comandos útiles](#comandos-útiles)

---

## Stack tecnológico

| Capa          | Tecnología                                                            |
| ------------- | --------------------------------------------------------------------- |
| Backend       | Python 3.12 + FastAPI + SQLAlchemy                                    |
| Base de datos | SQLite (archivo local)                                                |
| Autenticación | JWT (access token 15 min + refresh token 7 días como cookie httpOnly) |
| Frontend      | Next.js 16 + React 19 + Tailwind CSS 4                                |
| Contenedores  | Docker + Docker Compose                                               |
| Deploy        | Dokploy (auto-deploy desde `main` en GitHub)                          |

---

## Estructura del repositorio

```
PP3-Concejo-Escolar/
├── backend/
│   ├── app/
│   │   ├── config/
│   │   │   ├── database.py      # Conexión SQLite + get_db()
│   │   │   ├── security.py      # Hash bcrypt, JWT access/refresh
│   │   │   └── settings.py      # Variables de entorno (pydantic-settings)
│   │   ├── controllers/         # Schemas Pydantic (request/response)
│   │   ├── middlewares/
│   │   │   └── auth_middleware.py  # get_current_user, require_admin
│   │   ├── models/              # Modelos SQLAlchemy (tablas)
│   │   ├── routes/              # Endpoints FastAPI
│   │   ├── services/            # Lógica de negocio
│   │   └── main.py              # App FastAPI, routers, startup
│   ├── seed.py                  # Crea el usuario admin inicial
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── layout.tsx       # Layout con nav + contexto de usuario
│   │   │   ├── page.tsx         # Pantalla de bienvenida
│   │   │   ├── user-context.tsx # Contexto React del usuario logueado
│   │   │   └── usuarios/
│   │   │       └── page.tsx     # CRUD de usuarios (solo admin)
│   │   ├── login/
│   │   │   └── page.tsx         # Formulario de login
│   │   └── layout.tsx           # Layout raíz
│   ├── lib/
│   │   ├── api.ts               # Cliente HTTP con refresh automático
│   │   └── auth.ts              # Access token en memoria
│   ├── proxy.ts                 # Protección de rutas (Next.js 16)
│   ├── next.config.ts
│   └── Dockerfile
├── db/
│   └── db-script.sql            # Schema de referencia (MySQL histórico)
├── docs/
│   └── requerimientos.md        # Requerimientos funcionales del cliente
├── docker-compose.yml           # Orquestación para producción / Dokploy
└── docker-compose.dev.yml       # Overrides para desarrollo local
```

---

## Opción A — Levantar con Docker (recomendado)

Es la forma más rápida. Solo necesitás tener **Docker Desktop** instalado.

### 1. Clonar el repositorio

```bash
git clone https://github.com/agustinmigliorero/PP3-Concejo-Escolar.git
cd PP3-Concejo-Escolar
```

### 2. Crear los archivos de variables de entorno

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Editá los valores según tu entorno. Ver la sección [Variables de entorno](#variables-de-entorno) para el detalle de cada variable.

### 3. Levantar los contenedores en desarrollo

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Esto construye las imágenes y levanta backend y frontend. La primera vez tarda unos minutos.
En desarrollo, `docker-compose.dev.yml` cambia el frontend a `npm run dev -- --webpack`, monta el código local como volumen, activa polling para hot reload dentro de Docker Desktop y usa `http://localhost:8000` como API por defecto. También monta el backend local y lo ejecuta con `uvicorn --reload`.

> Después del primer `up --build`, no deberías apagar ni recrear los contenedores para ver cambios de código en local. Si cambiás dependencias (`package.json`, `package-lock.json` o `requirements.txt`), ahí sí corresponde reconstruir.

> Regla del equipo: local usa `docker-compose.yml + docker-compose.dev.yml`; Dokploy usa solo `docker-compose.yml`.

| Servicio                    | URL local                  |
| --------------------------- | -------------------------- |
| Frontend                    | http://localhost:3005      |
| Backend (API)               | http://localhost:8000      |
| Docs interactivos (Swagger) | http://localhost:8000/docs |

### 4. Crear el usuario admin inicial

En otra terminal, mientras los contenedores están corriendo:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python seed.py
```

Salida esperada:

```
[seed] Admin creado — usuario: 'admin' | contraseña: 'admin1234'
[seed] Cambiá la contraseña en producción.
```

### 5. Ingresar al sistema

Abrí http://localhost:3005, iniciá sesión con `admin` / `admin1234`.

### Detener los contenedores

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

> La base de datos SQLite vive en el volumen Docker `concejo_escolar_sqlite_data` y persiste aunque se recree el contenedor.

---

## Opción B — Levantar manualmente (venv + npm)

Útil si preferís ver los logs directamente o trabajar sin Docker.

### Requisitos previos

- Python 3.12+
- Node.js 20+
- npm

---

### Backend

```bash
cd backend

# Crear y activar entorno virtual
python -m venv .venv

# Windows (PowerShell)
.venv\Scripts\Activate.ps1

# macOS / Linux
source .venv/bin/activate

# Instalar dependencias (requirements-dev.txt incluye requirements.txt + pytest)
pip install -r requirements-dev.txt

# Crear archivo de entorno (ver sección Variables de entorno)
cp .env.example .env   # o crearlo manualmente

# Levantar el servidor en modo desarrollo (con hot reload)
uvicorn app.main:app --reload
```

> **¿Por qué `uvicorn` y no `fastapi dev`?**
> `fastapi dev app/main.py` agrega la carpeta `app/` al `sys.path` en lugar de `backend/`,
> por lo que los imports del estilo `from app.config.X import ...` fallan con `No module named 'app'`.
> `uvicorn` toma el directorio actual (`backend/`) como raíz, resolviendo los imports correctamente.

El backend queda en **http://localhost:8000**.

**Crear el admin inicial (solo la primera vez):**

```bash
python seed.py
```

---

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Crear archivo de entorno
cp .env.example .env.local

# Levantar el servidor en modo desarrollo
npm run dev
```

El frontend queda en **http://localhost:3000**.

---

### Agregar nuevas dependencias

**Backend:**

```bash
# Con el venv activado
pip install nombre-paquete==X.Y.Z
```

Agregar la línea `nombre-paquete==X.Y.Z` a mano en el archivo que corresponda:

- `requirements.txt`: lo que necesita la app en producción (es lo que instala la imagen de Docker).
- `requirements-dev.txt`: herramientas de desarrollo y tests (pytest, httpx). No van a la imagen.

No usar `pip freeze > requirements.txt` con el venv de desarrollo: metería pytest y el resto de las herramientas de test en la imagen de producción. Antes de commitear, verificar que no haya dependencias con vulnerabilidades conocidas:

```bash
pip install pip-audit
pip-audit -r requirements.txt
```

> **Importante en Windows**: si editás los requirements desde PowerShell, guardalos en UTF-8 sin BOM (pip en Linux falla con otros encodings).

**Frontend:**

```bash
npm install nombre-paquete
```

---

## Variables de entorno

Cada parte del proyecto tiene un `.env.example` con todas las variables documentadas. Copiálo y editá los valores:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Estos archivos están en `.gitignore` y **nunca se commitean**.

### Backend (`backend/.env`)

| Variable | Descripción | Default |
|---|---|---|
| `SECRET_KEY` | Clave para firmar JWT. **Cambiala en producción.** | *(valor inseguro)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Vida útil del access token | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Vida útil del refresh token | `7` |
| `DATABASE_URL` | URL de conexión SQLAlchemy | `sqlite:///./concejo_escolar.db` |
| `ADMIN_USERNAME` | Usuario admin del seed inicial | `admin` |
| `ADMIN_PASSWORD` | Contraseña admin del seed inicial | `admin1234` |
| `CORS_ORIGINS` | Orígenes CORS permitidos (separados por coma) | `http://localhost:3000,...` |
| `TRUSTED_PROXY_IPS` | Proxies de confianza (IP o CIDR, separados por coma) para resolver la IP real del cliente en el login. Vacío = no se confía en `X-Forwarded-For` | `""` |
| `ENABLE_API_DOCS` | Publica `/docs`, `/redoc` y `/openapi.json`. Apagado por defecto (SEC-10); poné `true` solo en desarrollo | `false` |

> Para generar una `SECRET_KEY` segura:
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(32))"
> ```

> En producción, `DATABASE_URL` apunta a `sqlite:////app/data/concejo_escolar.db` (volumen Docker persistente).

> Si el backend queda detrás de un proxy inverso (Traefik), poné en `TRUSTED_PROXY_IPS` la IP o la red del proxy. Si no, todos los usuarios comparten la IP del proxy y el límite de intentos del login (SEC-07) bloquearía a todos a la vez. Nunca uses un rango abierto: un atacante podría falsear su propia IP y esquivar el límite.

### Frontend (`frontend/.env.local`)

| Variable | Descripción | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública del backend | `http://localhost:8000` |

> **Importante (Next.js):** `NEXT_PUBLIC_API_URL` se embebe en el bundle durante el `build`. Si cambiás la URL en producción, necesitás rebuildar la imagen Docker del frontend.

> **Cabeceras de seguridad (SEC-10):** el frontend envía `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` en todas las rutas. En producción se suma una `Content-Security-Policy` estricta (`default-src 'self'`, `frame-ancestors 'none'`). La CSP **no** se aplica en desarrollo: rompería el hot reload (el websocket de HMR no está cubierto por `connect-src 'self'`).

### Producción con Docker Compose / Dokploy

En producción las variables se cargan desde el panel **Environment** de Dokploy. Dokploy las usa para interpolar `${VARIABLE}` dentro de `docker-compose.yml`, sin necesidad de subir archivos `.env` al repo.

Variables mínimas:

```env
NEXT_PUBLIC_API_URL=http://TU_IP:8000
CORS_ORIGINS=http://TU_IP:3005
SECRET_KEY=tu_clave_segura
ADMIN_PASSWORD=tu_password_seguro
```

El `docker-compose.yml` referencia esas variables así:

```yaml
backend:
  environment:
    DATABASE_URL: sqlite:////app/data/concejo_escolar.db
    CORS_ORIGINS: ${CORS_ORIGINS}

frontend:
  build:
    context: ./frontend
    target: runner
    args:
      NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL}
```

> **¿Por qué `args` y no `environment` en el frontend?**
> `NEXT_PUBLIC_API_URL` se embebe en el bundle de Next.js durante el `npm run build`.
> Las variables en `environment` llegan en runtime (cuando el contenedor ya arrancó), demasiado tarde.
> Pasarla como build arg garantiza que esté disponible al momento de compilar. El `frontend/Dockerfile` falla el build si `NEXT_PUBLIC_API_URL` llega vacío.

---

## Base de datos y primer usuario

El esquema de la base de datos se crea **automáticamente** al iniciar el backend (`Base.metadata.create_all()` en el startup de FastAPI). No hace falta correr migraciones manualmente.

El archivo `db/db-script.sql` es un esquema de referencia histórico (MySQL), no se usa en el código.

### Crear el admin inicial

```bash
# Con Docker
docker compose exec backend python seed.py

# Sin Docker (con venv activado)
python seed.py
```

El script es idempotente: si el usuario ya existe, no hace nada.

### Cambiar credenciales del admin

Opción 1 — desde la interfaz: loguearse como admin → Usuarios → Editar.

Opción 2 — variables de entorno antes de correr el seed:

```bash
ADMIN_USERNAME=miusuario ADMIN_PASSWORD=mipassword python seed.py
```

### Seed de stock sobrante

Dos scripts para poblar la tabla de stock sobrante con datos de prueba secuenciales:

| Script | Descripción |
|---|---|
| `seed_stock_semana1.py` | Carga inicial simulando ingredientes cargados hace 7 días por la EP 1 |
| `seed_stock_semana2.py` | Simula el estado 7 días después: algunos ingredientes consumidos, otros recargados, más ingredientes nuevos |

```bash
# Con Docker
docker compose exec backend python seed_stock_semana1.py
docker compose exec backend python seed_stock_semana2.py

# Sin Docker (con venv activado, desde backend/)
python seed_stock_semana1.py
python seed_stock_semana2.py
```

> **Orden sugerido**: correr `seed_stock_semana1.py` primero y `seed_stock_semana2.py` después para ver la evolución del stock. Ambos son idempotentes.

---

## Flujo de trabajo Git

### Ramas

| Rama   | Propósito                                                |
| ------ | -------------------------------------------------------- |
| `main` | Producción. Todo push aquí dispara un deploy automático. |

> El proyecto actualmente trabaja directo sobre `main`. Si el equipo crece, se recomienda usar ramas de feature y Pull Requests.

### Ciclo de trabajo típico

```bash
# 1. Asegurate de tener lo último
git pull origin main

# 2. Hacé tus cambios

# 3. Revisá qué cambiaste
git status
git diff

# 4. Agregá los archivos relevantes (evitá git add -A sin revisar)
git add ruta/al/archivo.py ruta/al/otro.tsx

# 5. Commiteá con un mensaje descriptivo
git commit -m "feat: descripción corta de lo que hiciste"

# 6. Pusheá
git push origin main
```

### Convención de mensajes de commit

```
tipo: descripción corta en español

Tipos comunes:
  feat:     nueva funcionalidad
  fix:      corrección de bug
  chore:    cambios de configuración, dependencias, CI
  refactor: refactoring sin cambio de comportamiento
  docs:     documentación
```

Ejemplos:

```
feat: CRUD de ingredientes con validación
fix: corregir cookie path del refresh token
chore: actualizar requirements.txt a bcrypt 4.3
docs: agregar guía de desarrollo
```

---

## Deploy a producción

La preparacion de **SEC-03 (HTTPS y cookie Secure)** y los pasos para activarla
cuando este disponible el certificado estan en [Despliegue HTTPS](docs/despliegue-https.md).
El archivo adicional `docker-compose.https.yml` se activa junto con TLS en
Dokploy; el compose base conserva temporalmente el despliegue HTTP actual.

El deploy es **automático**: cada push a `main` en GitHub dispara un redeploy en Dokploy.

### Qué hace Dokploy al detectar un push

1. Clona el repositorio desde GitHub
2. Ejecuta Docker Compose usando solo `docker-compose.yml`
3. Construye las imágenes en modo producción:
   - **Backend**: instala deps + copia código (sin `--reload`)
   - **Frontend**: `npm run build` → `next start` (sin Turbopack)
4. Levanta los contenedores nuevos y elimina los viejos

### Verificar el estado del deploy

En Dokploy, ir a la aplicación y revisar la pestaña **Logs**. Un deploy exitoso termina con los contenedores en estado `running`.

### Recuperar los datos tras el cambio de montaje de SQLite

El commit `d26e6a2` cambió `/app/data` del volumen Docker
`concejo_escolar_sqlite_data` a la carpeta `./backend/data` del checkout.
Ese cambio no copia ni migra la base anterior: si la carpeta está vacía, el
backend crea otra base sin los usuarios y datos existentes. La configuración
corregida vuelve a montar el volumen original y mantiene la misma `DATABASE_URL`.

Antes de redesplegar, desde una terminal del **host VPS**:

```bash
# Debe existir el volumen original. Si no existe, no crear uno vacío como recuperación.
docker volume inspect concejo_escolar_sqlite_data

# Identificar el backend y comprobar qué almacenamiento está usando realmente.
docker ps --format 'table {{.ID}}\t{{.Names}}'
docker inspect <ID_BACKEND> --format '{{json .Mounts}}'
```

Si el volumen existe, verificar que contenga `concejo_escolar.db` con los datos
esperados. Detener el backend desde Dokploy y respaldar **ambos** almacenamientos
(el volumen original y la carpeta indicada por `Source` en el montaje actual),
incluidos los archivos auxiliares de SQLite si existen. Mantener detenido el
backend durante la copia evita un respaldo inconsistente.

Luego desplegar esta configuración desde Dokploy. Comprobar con `docker inspect`
que `/app/data` tenga `Type: volume` y `Name: concejo_escolar_sqlite_data`, revisar
los logs e ingresar con un usuario anterior para confirmar sus datos.

Si el volumen no existe o está vacío, buscar el volumen o respaldo anterior antes
de continuar. No ejecutar `seed.py`, `docker compose down -v` ni una limpieza de
volúmenes para intentar recuperar los datos. Conservar también `backend/data`:
los registros creados durante el montaje incorrecto no se fusionan automáticamente
con la base original.

### Primera vez en producción (o luego de recrear el volumen)

Después de un deploy exitoso, crear el admin desde la terminal de Docker en Dokploy:

```bash
python seed.py
```

### Variables de entorno en producción

Configurarlas en Dokploy → tu aplicación → **Environment** (no en archivos `.env` en el repo).

Variables recomendadas en Environment de Dokploy:

```
SECRET_KEY=<clave larga y aleatoria>
ADMIN_PASSWORD=<contraseña segura>
DATABASE_URL=sqlite:////app/data/concejo_escolar.db
CORS_ORIGINS=http://<TU_IP>:3005
NEXT_PUBLIC_API_URL=http://<TU_IP>:8000
```

`NEXT_PUBLIC_API_URL` se carga en Environment de Dokploy, pero el punto importante es que `docker-compose.yml` la pasa como `build.args` al frontend. Next.js la embebe durante `npm run build`, por eso hay que redeployar/rebuildar si cambia.

### ⚠️ Cosas a tener en cuenta

- **No commitear `.env`** — está en `.gitignore`. Las secrets van solo en Dokploy.
- **La base de datos vive en el volumen Docker** `concejo_escolar_sqlite_data`. Su nombre físico es fijo para que Dokploy lo reutilice entre deploys. Si eliminás el volumen, perdés todos los datos. Hacé backups periódicos.
- **El `requirements.txt` debe estar en UTF-8 sin BOM** (ver sección de dependencias). pip en Linux falla con otros encodings.

---

## Referencia rápida de la API

La documentación interactiva completa (Swagger UI) está en `http://localhost:8000/docs`, pero **solo si el backend arranca con `ENABLE_API_DOCS=true`**: por defecto está apagada (SEC-10) y `/docs`, `/redoc` y `/openapi.json` devuelven 404.

### Autenticación

| Método | Endpoint        | Descripción                       | Auth requerida |
| ------ | --------------- | --------------------------------- | -------------- |
| POST   | `/auth/login`   | Login con usuario y contraseña    | No             |
| POST   | `/auth/refresh` | Renovar access token (usa cookie) | No             |
| POST   | `/auth/logout`  | Cerrar sesión                     | No             |
| GET    | `/auth/me`      | Datos del usuario logueado        | Sí             |

### Usuarios

| Método | Endpoint                    | Descripción                               | Rol requerido |
| ------ | --------------------------- | ----------------------------------------- | ------------- |
| GET    | `/users`                    | Listar todos los usuarios                 | admin         |
| POST   | `/users`                    | Crear usuario                             | admin         |
| GET    | `/users/{id}`               | Ver un usuario                            | admin         |
| PUT    | `/users/{id}`               | Editar usuario                            | admin         |
| PATCH  | `/users/{id}/toggle-active` | Activar / desactivar                      | admin         |
| DELETE | `/users/{id}`               | Eliminar permanentemente (solo inactivos) | admin         |

### Stock previo

| Método | Endpoint                  | Descripción                                      | Rol requerido |
| ------ | ------------------------- | ------------------------------------------------ | ------------- |
| GET    | `/stock-previo/me`        | Ver stock sobrante de la escuela propia          | escuela       |
| PUT    | `/stock-previo/me`        | Cargar/actualizar stock sobrante propio          | escuela       |
| GET    | `/stock-previo/{school_id}` | Ver stock sobrante de una escuela              | admin/gestor  |
| PUT    | `/stock-previo/{school_id}` | Cargar/actualizar stock sobrante de una escuela | admin/gestor  |

### Pedidos

| Método | Endpoint                       | Descripción                                                      | Rol requerido |
| ------ | ------------------------------ | ---------------------------------------------------------------- | ------------- |
| PATCH  | `/pedidos/{pedido_id}/items`   | Editar cantidades de una orden regular ya generada, recalculando sus totales | admin |
| GET    | `/pedidos` · `/pedidos/{pedido_id}` | Historial. La escuela recibe solo sus filas, con proveedor y sin precios ni costos | todos |
| GET    | `/pedidos/{pedido_id}/export/{excel\|pdf}` | Resumen global con precios y costos | admin/gestor |
| GET    | `/pedidos/{pedido_id}/export/proveedores/{excel\|pdf}` | ZIP de órdenes por proveedor (`incluir_precios=true\|false`) | admin/gestor |
| GET    | `/pedidos/{pedido_id}/export/localidades/pdf` | ZIP de pedidos por localidad | admin/gestor |
| GET    | `/pedidos/{pedido_id}/export/escuelas/pdf` | ZIP de pedidos por escuela (con precios) | admin/gestor |
| GET    | `/pedidos/{pedido_id}/export/mi-escuela/pdf` | PDF del pedido de la escuela propia: artículos, cantidades y proveedor, sin precios | escuela |

### Tipos de comida

Catálogo administrable de tipos de comida (desayuno, almuerzo, merienda y los que se agreguen). Cada receta y cada escuela se asocian a uno o varios tipos.

| Método | Endpoint                          | Descripción                       | Rol requerido |
| ------ | --------------------------------- | --------------------------------- | ------------- |
| GET    | `/tipos-comida`                   | Listar tipos de comida            | admin/gestor  |
| POST   | `/tipos-comida`                   | Crear tipo de comida              | admin         |
| PUT    | `/tipos-comida/{id}`              | Renombrar tipo de comida          | admin         |
| PATCH  | `/tipos-comida/{id}/toggle-active`| Activar / desactivar              | admin         |

### Contacto de la escuela propia

| Método | Endpoint                 | Descripción                                       | Rol requerido |
| ------ | ------------------------ | ------------------------------------------------- | ------------- |
| PATCH  | `/schools/me/contact`    | Editar teléfono y email propios (ambos opcionales) | escuela       |

### Cómo autenticarse en Swagger

> La documentación interactiva está **deshabilitada por defecto** (SEC-10): `/docs`, `/redoc` y `/openapi.json` devuelven 404. Para verla en desarrollo, poné `ENABLE_API_DOCS=true` en `backend/.env` (el `docker-compose.dev.yml` ya lo activa). En producción queda apagada salvo que la subas a propósito.

1. Llamar a `POST /auth/login` con body `{ "username": "admin", "password": "..." }`
2. Copiar el `access_token` de la respuesta
3. Hacer clic en el botón **Authorize** (candado arriba a la derecha)
4. Pegar el token como `Bearer <token>`

---

## Comandos útiles

### Docker

```bash
# Levantar en desarrollo local (con rebuild de imágenes)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Levantar en desarrollo local en background
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build

# Ver logs de un servicio
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend

# Abrir una terminal dentro del contenedor
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend sh

# Detener todo
docker compose -f docker-compose.yml -f docker-compose.dev.yml down

# Detener y eliminar volúmenes (borra la DB)
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

# Producción / Dokploy usa solo docker-compose.yml
docker compose -f docker-compose.yml up -d --build
```

### Backend (con venv activado)

```bash
# Levantar en desarrollo
fastapi dev app/main.py

# Correr seed
python seed.py

# Ver qué dependencias están instaladas
pip list
```

### Frontend

```bash
# Desarrollo
npm run dev

# Build de producción local
npm run build
npm run start

# Lint
npm run lint

# Tests (vitest)
npm test
```
