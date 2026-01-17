# --------- Build stage ---------
FROM node:20-alpine AS builder
WORKDIR /app

# Declarar argumentos de build (se pasan desde docker-compose)
ARG EXPO_PUBLIC_BASE_URL
ARG EXPO_PUBLIC_ISSUER

# Convertir a variables de entorno para el build
ENV EXPO_PUBLIC_BASE_URL=${EXPO_PUBLIC_BASE_URL}
ENV EXPO_PUBLIC_ISSUER=${EXPO_PUBLIC_ISSUER}

# Instalar dependencias
COPY package*.json ./
RUN npm ci --production=false

# Copiar código y construir (las variables se embeben aquí)
COPY . .
RUN npm run build

# --------- Production stage ---------
FROM node:20-alpine
WORKDIR /app

# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --production --ignore-scripts && \
    npm cache clean --force

# Copiar el build
COPY --from=builder /app/dist ./dist

# Instalar servidor ligero
RUN npm install -g serve

ENV CI=1
EXPOSE 80

# Servir archivos estáticos
CMD ["serve", "-s", "dist", "-l", "80"]
