# Backend

## Virtual Env

Ir a la carpeta del backend y ejecutar el comando `python -m venv .venv`
Con eso creamos el entorno virtual.
Luego lo iniciamos con `.venv\Scripts\Activate.ps1`
Y ya podemos usar FastAPI dentro del entorno virtual.

Para instalar las dependencias del proyecto ejecutar el comando `pip install -r requirements.txt`

Para agregar nuevas dependencias, luego de instalarlas hacer un freeze de las dependencias con el comando `pip freeze > requirements.txt`

## FastAPI

Para correr el backend usar `fastapi dev`
