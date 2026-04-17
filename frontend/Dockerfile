# Imagen base de Node.js
FROM node:20-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar e instalar dependencias primero (para aprovechar el cache de Docker)
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Puerto que expone el frontend
EXPOSE 3001

# Comando para arrancar en modo desarrollo
CMD ["npm", "run", "dev", "--", "-p", "3001", "-H", "0.0.0.0"]
