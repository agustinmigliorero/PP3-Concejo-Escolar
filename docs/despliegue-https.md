# Activacion de HTTPS para SAE

SEC-03 requiere cifrar el acceso publico al frontend y a la API, usar una cookie
de sesion Secure y cerrar los accesos directos que permitirian eludir el proxy.
El codigo y el archivo `docker-compose.https.yml` preparan ese cambio. La medida
queda pendiente de cierre hasta configurar TLS y verificar el servidor real.

El despliegue actual usa Dokploy con Traefik. Para el destino previsto con
Docker y Apache, consultar la seccion de Apache antes de activar el archivo
HTTPS: la conexion entre el proxy y los contenedores depende de donde se ejecute
Apache. No hace falta instalar Nginx.

## Mientras se obtiene el certificado

El despliegue actual con `docker-compose.yml` conserva su funcionamiento HTTP.
No activar `ENVIRONMENT=production`, `REFRESH_COOKIE_SECURE=true` ni el archivo
HTTPS en ese despliegue hasta disponer de HTTPS funcional para ambos servicios.
Ese modo de transicion sigue teniendo el riesgo de transporte del informe.

Para desarrollo local se mantienen los comandos habituales:

```bash
docker compose --env-file backend/.env -f docker-compose.yml -f docker-compose.dev.yml up --build
```

El override de desarrollo fuerza `ENVIRONMENT=development`, cookie sin Secure y
sin Domain para localhost. El frontend queda en `http://localhost:3005` y la API
en `http://localhost:8000`. El backend tambien puede ejecutarse directamente con
`uvicorn app.main:app --reload` desde `backend/`.

## Variables del despliegue HTTPS

Ejemplo para frontend y API en subdominios del mismo dominio propio. Sustituir
los dominios y la IP de ejemplo por los reales en Environment de Dokploy:

```env
ENVIRONMENT=production
REFRESH_COOKIE_SECURE=true
REFRESH_COOKIE_DOMAIN=.ejemplo.com
CORS_ORIGINS=https://sae.ejemplo.com
NEXT_PUBLIC_API_URL=https://api.ejemplo.com
FORWARDED_ALLOW_IPS=10.20.0.2
```

Conservar `SECRET_KEY` y las demas variables existentes del sistema. No guardar
secretos de produccion en el repositorio. El override HTTPS fija production y
Secure=true aunque las variables externas tengan otros valores.

`FORWARDED_ALLOW_IPS` identifica la IP del proxy que realmente se conecta a
Uvicorn. Revisar la conexion desde Apache o Traefik y usar una IP estable o, cuando sea
necesario, una red CIDR dedicada cuyos miembros sean de confianza. No usar `*`
ni copiar la IP del ejemplo: confiar en clientes arbitrarios permite falsificar
la IP del usuario y el esquema HTTPS mediante cabeceras forwarded.

`CORS_ORIGINS` debe contener solo los origenes HTTPS exactos del frontend, sin
rutas y sin comodines. `NEXT_PUBLIC_API_URL` debe empezar por `https://`; el
frontend necesita reconstruirse cuando cambia esta URL o el modo de despliegue.

`REFRESH_COOKIE_DOMAIN` debe ser el dominio padre comun a ambos servicios porque
`frontend/proxy.ts` comprueba la cookie al abrir el dashboard. Usar solo dominios
y subdominios propios y de confianza. Dejarlo vacio si ambos servicios se publican
en el mismo host; publicar la API bajo una ruta requiere ademas ajustar el
enrutamiento. Dominios independientes no funcionan con esta configuracion de
cookie compartida y SameSite=Lax.

## Activacion coordinada en Dokploy

1. Configurar DNS y certificados validos para los dos dominios. En Domains de la
   aplicacion Compose, asociar el frontend a su puerto interno **3001** y el
   backend a **8000**, activar HTTPS y la redireccion de HTTP a HTTPS.
2. Revisar Preview Compose: Traefik debe compartir red con ambos servicios y
   apuntar a sus puertos internos. Dokploy gestiona las etiquetas y redes al
   configurar Domains; este repositorio no fija nombres de routers ni redes del
   servidor. Comprobar HTTPS en ambos dominios antes de cortar el acceso anterior.
3. Cargar las variables anteriores. En Advanced / Command, conservar el comando
   completo y el nombre de proyecto que muestra Dokploy, y agregar un segundo
   `-f docker-compose.https.yml` despues del archivo base. Por ejemplo, adaptando
   el nombre del proyecto y las rutas al comando real del panel:

   ```text
   compose -p NOMBRE_ACTUAL -f docker-compose.yml -f docker-compose.https.yml up -d --build --remove-orphans
   ```

   Dokploy antepone `docker`. No combinar con `docker-compose.dev.yml`. Se usa
   Docker Compose, no Docker Stack. El CLI debe admitir `!reset` (Compose 2.24.4+
   recomendado); el reset quita las publicaciones heredadas de los dos servicios.
4. Validar el modelo combinado antes de desplegar, desde la carpeta del proyecto
   y con las variables disponibles en el entorno:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.https.yml config --quiet
   ```

5. Desplegar y reconstruir el frontend. El override deja solo los puertos
   internos expuestos a la red Docker, sin publicaciones en el host. Traefik
   termina TLS; la conexion interna hacia los contenedores sigue usando HTTP.

Mantener el mismo proyecto y el volumen `concejo_escolar_sqlite_data`; no usar
`down -v` para esta migracion.

## Docker sin Dokploy con Apache

Apache puede recibir HTTPS con el certificado y actuar como proxy inverso hacia
el frontend y la API. Se conservan las variables de produccion y los cambios de
cookies y HSTS; no se necesita Dokploy para esas protecciones.

Antes de activar HTTPS hay que confirmar donde corre Apache:

- **Apache dentro de Docker:** conectar el proxy a la misma red que frontend y
  backend. Puede acceder a `frontend:3001` y `backend:8000` sin publicar esos
  puertos en el host, usando el override HTTPS. El contenedor de Apache, sus
  certificados y sus virtual hosts deben configurarse en el servidor.
- **Apache instalado en el host:** el override HTTPS, tal como esta, elimina
  todos los puertos publicados y Apache no podra acceder por localhost. Adaptar
  el Compose final para publicar solamente `127.0.0.1:3005:3001` y
  `127.0.0.1:8000:8000`. Apache debe reenviar a esos destinos locales. No volver
  a publicar en `0.0.0.0`; comprobar el modelo combinado con `docker compose
  config` antes de aplicar los cambios.

En ambos casos Apache debe servir los dominios HTTPS, redirigir HTTP a HTTPS y
sobrescribir `X-Forwarded-Proto` con `https` en los virtual hosts TLS. Configurar
`ProxyPass` y `ProxyPassReverse` para cada servicio. Uvicorn debe confiar solo
en el origen de conexion real de Apache mediante `FORWARDED_ALLOW_IPS`; con
puertos publicados Docker puede presentar la IP de su gateway en lugar de
127.0.0.1, por lo que hay que verificarla en el servidor.

Esta preparacion no incluye una instalacion de Apache ni rutas concretas a sus
certificados. Hasta confirmar esa topologia y probar HTTPS, conservar el
Compose HTTP habitual y no activar el override HTTPS.

## Verificacion de SEC-03

Las pruebas automatizadas se ejecutan desde `backend/`:

```bash
pytest tests/test_transport_security.py -v
pytest -q
```

Verifican rechazo de produccion con cookie insegura, atributos al crear, rotar y
borrar la cookie, login / refresh / logout en HTTP local y HTTPS simulado,
revocacion de refresh al salir, HSTS y reconocimiento de forwarded headers solo
desde el proxy de confianza. TestClient simula el esquema HTTPS: no comprueba
certificados ni la configuracion del servidor real.

Despues del despliegue, comprobar desde un equipo externo:

- Ambos dominios tienen certificado valido y HTTP redirige a HTTPS.
- Las respuestas HTTPS del frontend y de la API incluyen
  `Strict-Transport-Security: max-age=31536000`.
- En las herramientas del navegador, `refresh_token` tiene Secure, HttpOnly,
  SameSite=Lax, Path=/ y el Domain previsto.
- Login, recarga del dashboard, renovacion de sesion y logout funcionan; la
  cookie se elimina al salir y un refresh posterior devuelve 401.
- Las peticiones del frontend usan la API HTTPS sin errores de contenido mixto
  ni CORS.
- La IP del servidor con puertos 8000 y 3005 ya no permite acceder directamente
  al sistema desde otro equipo; solo se accede por Apache o Traefik. Si Apache
  esta en el host, los destinos 127.0.0.1 siguen disponibles solo localmente.

HSTS se activa exclusivamente en el modo HTTPS de produccion. No se usa
`includeSubDomains` ni `preload`, para no imponer HTTPS a otros subdominios que
este proyecto no administra. Despues de activarlo, mantener HTTPS disponible:
los navegadores recuerdan esta politica durante el max-age.

## Referencias

- [Proxy inverso con Apache](https://httpd.apache.org/docs/2.4/howto/reverse_proxy.html)
- [Certificados TLS en Apache](https://httpd.apache.org/docs/2.4/ssl/ssl_howto.html)
- [Dominios y redes de Compose en Dokploy](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Comando personalizado de Dokploy](https://docs.dokploy.com/docs/core/docker-compose#advanced)
- [Combinacion y reset de Compose](https://docs.docker.com/reference/compose-file/merge/)
- [Proxies de confianza en Uvicorn](https://github.com/Kludex/uvicorn/blob/main/docs/settings.md)
- [Cabeceras HTTP en Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers)
