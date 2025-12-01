FROM node:20-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production

# Instalar openssl, certificados, cliente PostgreSQL 16 y cups-client para impresión
RUN apt-get update -y && \
    apt-get install -y openssl ca-certificates gnupg2 wget cups-client && \
    echo "deb http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list && \
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg && \
    apt-get update -y && \
    apt-get install -y postgresql-client-16 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist
COPY package*.json ./

# Crear carpeta de uploads para imágenes de productos y backups
RUN mkdir -p /app/uploads/products /app/backups && chmod -R 755 /app/uploads /app/backups

EXPOSE 3000

# Usar db push con --accept-data-loss=false implícito (por defecto no borra datos)
# Si hay cambios que requieren pérdida de datos, fallará en lugar de borrar
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/index.js"]


