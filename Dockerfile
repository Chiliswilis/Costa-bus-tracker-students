# Dockerfile multi-etapa — Costa Bus Tracker (backend o simulator)
#
# Se usa para hosts de contenedores (Fly.io, Google Cloud Run, etc.).
# Elige el servicio con el argumento SERVICE:
#   docker build --build-arg SERVICE=backend  -t costa-bus-backend  .
#   docker build --build-arg SERVICE=simulator -t costa-bus-simulator .

FROM node:20-slim AS builder
WORKDIR /app
ARG SERVICE=backend

# Copia manifiestos y workspace compartido.
COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json ./shared/
COPY ${SERVICE}/package.json ./${SERVICE}/

# Instala TODAS las dependencias del workspace (incluye dev: necesitamos tsc).
RUN npm ci

# Copia el código y compila shared + el servicio elegido.
COPY shared ./shared
COPY tsconfig.base.json ./
COPY ${SERVICE} ./${SERVICE}
RUN npm run build --workspace @costa-bus/shared \
 && npm run build --workspace @costa-bus/${SERVICE}

# --------------------------------------------------------------------------

FROM node:20-slim AS runner
WORKDIR /app
ARG SERVICE=backend
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY ${SERVICE}/package.json ./${SERVICE}/
RUN npm ci --omit=dev

# Solo los artefactos compilados.
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/${SERVICE}/dist ./${SERVICE}/dist

WORKDIR /app/${SERVICE}
CMD ["node", "dist/index.js"]
