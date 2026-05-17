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
└── docker-compose.yml           # Orquestación para producción
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

### 3. Levantar los contenedores

```bash
docker compose up --build
```

Esto construye las imágenes y levanta backend y frontend. La primera vez tarda unos minutos.

| Servicio                    | URL local                  |
| --------------------------- | -------------------------- |
| Frontend                    | http://localhost:3005      |
| Backend (API)               | http://localhost:8000      |
| Docs interactivos (Swagger) | http://localhost:8000/docs |

### 4. Crear el usuario admin inicial

En otra terminal, mientras los contenedores están corriendo:

```bash
docker compose exec backend python seed.py
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
docker compose down
```

> La base de datos SQLite en dev vive dentro del contenedor. Si necesitás persistirla localmente, montá un volumen en `docker-compose.yml`.

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

# Instalar dependencias
pip install -r requirements.txt

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
pip install nombre-paquete

# Actualizar requirements.txt (en Windows, guardar en UTF-8 sin BOM)
pip freeze > requirements.txt
```

> **Importante en Windows**: `pip freeze >` puede guardar el archivo en UTF-16. Verificá que sea UTF-8 antes de commitear, o usá:
>
> ```powershell
> pip freeze | Out-File -Encoding utf8 requirements.txt
> ```

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

> Para generar una `SECRET_KEY` segura:
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(32))"
> ```

> En producción, `DATABASE_URL` apunta a `sqlite:////app/data/concejo_escolar.db` (volumen Docker persistente).

### Frontend (`frontend/.env.local`)

| Variable | Descripción | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL pública del backend | `http://localhost:8000` |

> **Importante (Next.js):** `NEXT_PUBLIC_API_URL` se embebe en el bundle durante el `build`. Si cambiás la URL en producción, necesitás rebuildar la imagen Docker del frontend.

### Producción con Docker Compose

En producción las variables se pasan directamente en `docker-compose.yml`, sin necesidad de archivos `.env` en el servidor:

```yaml
backend:
  environment:
    - DATABASE_URL=sqlite:////app/data/concejo_escolar.db
    - SECRET_KEY=tu_clave_segura
    - CORS_ORIGINS=http://TU_IP:3005,http://TU_IP:3001

frontend:
  environment:
    - NEXT_PUBLIC_API_URL=http://TU_IP:8000
```

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

El deploy es **automático**: cada push a `main` en GitHub dispara un redeploy en Dokploy.

### Qué hace Dokploy al detectar un push

1. Clona el repositorio desde GitHub
2. Ejecuta `docker compose up -d --build --remove-orphans`
3. Construye las imágenes en modo producción:
   - **Backend**: instala deps + copia código (sin `--reload`)
   - **Frontend**: `npm run build` → `next start` (sin Turbopack)
4. Levanta los contenedores nuevos y elimina los viejos

### Verificar el estado del deploy

En Dokploy, ir a la aplicación y revisar la pestaña **Logs**. Un deploy exitoso termina con los contenedores en estado `running`.

### Primera vez en producción (o luego de recrear el volumen)

Después de un deploy exitoso, crear el admin desde la terminal de Docker en Dokploy:

```bash
python seed.py
```

### Variables de entorno en producción

Configurarlas en Dokploy → tu aplicación → **Environment** (no en archivos `.env` en el repo).

Variables recomendadas para el backend:

```
SECRET_KEY=<clave larga y aleatoria>
ADMIN_PASSWORD=<contraseña segura>
DATABASE_URL=sqlite:////app/data/concejo_escolar.db
CORS_ORIGINS=http://<TU_IP>:3005,http://<TU_IP>:3001
```

Y para el frontend:

```
NEXT_PUBLIC_API_URL=http://<TU_IP>:8000
```

### ⚠️ Cosas a tener en cuenta

- **No commitear `.env`** — está en `.gitignore`. Las secrets van solo en Dokploy.
- **La base de datos vive en un volumen Docker** (`sqlite_data`). Si eliminás el volumen, perdés todos los datos. Hacé backups periódicos.
- **El `requirements.txt` debe estar en UTF-8 sin BOM** (ver sección de dependencias). pip en Linux falla con otros encodings.

---

## Referencia rápida de la API

La documentación interactiva completa está en `http://localhost:8000/docs` (Swagger UI).

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

### Cómo autenticarse en Swagger

1. Llamar a `POST /auth/login` con body `{ "username": "admin", "password": "..." }`
2. Copiar el `access_token` de la respuesta
3. Hacer clic en el botón **Authorize** (candado arriba a la derecha)
4. Pegar el token como `Bearer <token>`

---

## Comandos útiles

### Docker

```bash
# Levantar (con rebuild de imágenes)
docker compose up --build

# Levantar en background
docker compose up -d --build

# Ver logs de un servicio
docker compose logs -f backend
docker compose logs -f frontend

# Abrir una terminal dentro del contenedor
docker compose exec backend bash
docker compose exec frontend sh

# Detener todo
docker compose down

# Detener y eliminar volúmenes (⚠️ borra la DB)
docker compose down -v
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
```
