# 🚌 Costa Bus Tracker

Rastreo en tiempo real de autobuses de pasajeros circulando por la **Costa de Jalisco, México**.

> **Fase 1 (actual):** posiciones GPS **simuladas** por un motor de interpolación.
> La arquitectura ya está desacoplada para migrar a **hardware GPS real (Teltonika)** sin
> tocar el frontend: solo hay que sustituir el simulador por un ingestador que emita el
> mismo evento `bus-position` en el mismo formato.

---

## Arquitectura (monorepo con npm workspaces)

```
costa-bus-tracker/
├── package.json          # workspaces: shared, simulator, backend, frontend
├── shared/               # Tipos TS + definición de rutas + utilidades (geo, ETA)
├── simulator/            # Node.js: emite posiciones GPS falsas cada 3 s
├── backend/              # Express + Socket.io (puerto 4000)
└── frontend/             # Vite + React + TypeScript + react-leaflet (puerto 5173)
```

### Flujo de datos

```
Simulator (interpola posiciones entre ciudades)
        │  socket.emit("bus-position")
        ▼
Backend :4000  ──reenvía──▶  socket.emit("bus-update")  →  todos los clientes
        │
        └── si ETA ≤ 5 min ──▶ socket.emit("bus-alert")
        ▼
Frontend :5173  (hook useSocket → estado React)
        │
        └──▶ Mapa Leaflet: marcadores se mueven suavemente
```

---

## Stack

| Capa      | Tecnología                                          |
| --------- | --------------------------------------------------- |
| Runtime   | Node.js 20+                                         |
| Backend   | Express 4.19.2 · Socket.io 4.7.5                    |
| Simulator | Node.js · Socket.io-client 4.7.5 · TypeScript       |
| Frontend  | React 18.3.1 · Vite 5.3.4 · TypeScript 5.5.3        |
| Mapa      | Leaflet 1.9.4 · react-leaflet 4.2.1 · OpenStreetMap |
| Orquest.  | concurrently 8.2.2                                  |

---

## Puesta en marcha

```bash
npm install      # instala los 4 workspaces
npm run dev      # levanta backend + simulator + frontend a la vez
```

- Backend: http://localhost:4000
- Frontend: http://localhost:5173

### Scripts disponibles

| Comando             | Descripción                                     |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Backend + Simulator + Frontend (desarrollo)     |
| `npm run build`     | Compila shared, backend, simulator y frontend   |
| `npm run typecheck` | Verifica tipos en backend, simulator y frontend |
| `npm run start`     | Backend + Simulator en modo producción          |

---

## Rutas cubiertas

1. **Guadalajara → Barra de Navidad** (vía Autlán, Casimiro Castillo, La Huerta, Melaque)
2. **Guadalajara → Manzanillo** (vía Colima)
3. **Manzanillo → Barra de Navidad** (vía Cihuatlán)
4. **Barra de Navidad → Puerto Vallarta** (vía Melaque, Tomatlán)

Cada ruta transporta **2 autobuses simulados**.

## Operadores

| Operador                  | Compra                                     | Respaldo                                         |
| ------------------------- | ------------------------------------------ | ------------------------------------------------ |
| ETN Turistar Lujo         | https://www.etn.com.mx                     | —                                                |
| Primera Plus              | https://www.primeraplus.com.mx             | —                                                |
| Autocamiones del Pacífico | https://www.autocamionesdelpacifico.com.mx | https://www.facebook.com/autocamionesdelpacifico |

---

## Características del frontend

- Mapa interactivo (Leaflet + OpenStreetMap), tiles oscuros CARTO.
- Polilíneas punteadas por ruta y paradas marcadas.
- Autobuses moviéndose en tiempo real vía WebSocket.
- Panel lateral: selector de ruta, lista de autobuses con **próxima parada + ETA**,
  alertas cuando un bus está a **≤ 5 min** y enlaces de compra según la ruta.
- **Modo GO**: navegación con alertas de sonido cuando el bus está por llegar
  (generadas con Web Audio API, sin assets externos).
- **Modo offline básico**: rutas y paradas se cargan sin conexión; el último estado
  se cachea en `localStorage` y se restaura al volver a abrir.
- Diseño **dark mode**, responsivo, en **español**.

---

## Despliegue (fase 1)

La app tiene dos piezas desplegables por separado: el **frontend** (estático, va a
Netlify) y el **backend + simulador** (procesos Node con WebSocket, van a un host
que ejecute Node: Railway, Render, Fly.io…).

Orden recomendado: **backend → simulador → frontend** (el frontend necesita la URL
del backend, y el simulador también).

### 1. Backend + simulador (Node)

En los tres hosts de abajo, `backend` y `simulator` son **dos servicios separados**
sobre el **mismo repositorio**. Antes de nada, aquí tienes cada variable:

| Variable      | Servicio  | Ejemplo                                        |
| ------------- | --------- | ---------------------------------------------- |
| `CORS_ORIGIN` | backend   | `https://costa-bus-tracker.netlify.app`        |
| `BACKEND_URL` | simulator | `https://costa-bus-backend.up.railway.app`     |

`PORT` normalmente lo inyecta el host; solo defínelo si es necesario.

> ⚠️ **Importante:** ambos servicios importan `@costa-bus/shared`, así que el
> build debe compilar `shared` **antes** que el servicio. Todos los archivos de
> configuración incluidos ya lo hacen (`npm run build --workspace @costa-bus/shared
> && npm run build --workspace @costa-bus/<servicio>`).

#### Opción A — Render (recomendada; hay blueprint listo)

El proyecto trae **`render.yaml`** en la raíz con los dos servicios ya declarados.

1. Sube el repo a GitHub.
2. Render → **New → Blueprint** → selecciona el repositorio.
3. Render detecta `render.yaml` y crea `costa-bus-backend` (web) y
   `costa-bus-simulator` (worker).
4. Completa en el panel las variables marcadas como `sync: false`:
   - `costa-bus-backend` → `CORS_ORIGIN` = tu dominio de Netlify.
   - `costa-bus-simulator` → `BACKEND_URL` = la URL pública del backend
     (`https://costa-bus-backend.onrender.com`).

> En el plan free de Render, el backend se "duerme" por inactividad; la primera
> carga tras un rato puede tardar unos segundos en reconectar el WebSocket.

#### Opción B — Railway

Railway despliega por servicio desde un repo. Crea **dos servicios** apuntando al
mismo repo y, en cada uno, define **Root Directory = `backend`** y `simulator`
respectivamente. Cada carpeta incluye `railway.json` con su `buildCommand`/`startCommand`,
así que Railway no necesita configuración extra. Agrega las variables `CORS_ORIGIN`
y `BACKEND_URL` en la pestaña *Variables*.

#### Opción C — Contenedores (Fly.io, Cloud Run, Docker local)

El `Dockerfile` de la raíz compila cualquiera de los dos servicios mediante el
argumento `SERVICE`:

```bash
docker build --build-arg SERVICE=backend   -t costa-bus-backend  .
docker build --build-arg SERVICE=simulator -t costa-bus-simulator .
```

### 2. Frontend (Netlify)

El **`netlify.toml`** de la **raíz del repositorio** ya define todo el build.
Solo conecta el repo en Netlify; **deja vacíos** en el panel *Base directory*,
*Build command* y *Publish directory*:

| Campo de Netlify      | Valor                                                          |
| --------------------- | -------------------------------------------------------------- |
| **Base directory**    | *(vacío — lo define el `netlify.toml`)*                          |
| **Build command**     | *(vacío — lo define el `netlify.toml`)*                          |
| **Publish directory** | *(vacío — lo define el `netlify.toml`)*                          |
| **Variable**          | `VITE_BACKEND_URL=https://costa-bus-backend.onrender.com`        |

El `netlify.toml` raíz ejecuta el build desde la raíz con workspaces:

```toml
[build]
  command = "npm run build --workspace @costa-bus/shared && npm run build --workspace @costa-bus/frontend"
  publish = "frontend/dist"
```

Esto compila `@costa-bus/shared` (dependencia de tipos) y luego **solo** el
frontend, publicando `frontend/dist`. **No** ejecuta el `npm run build` raíz, que
también compilaría backend y simulator (esos van en Render).

> ⚠️ Errores comunes:
> - `Deploy directory 'dist' does not exist` → la config del panel quedó con
>   "Base directory = `frontend`". Un `base` explícito en el `netlify.toml` raíz
>   sobrescribe el panel ([docs](https://docs.netlify.com/build/configure-builds/monorepos/));
>   al no fijar `base` y publicar `frontend/dist`, funciona igual.
> - Build que intenta compilar backend/simulator → se está usando el `npm run build`
>   raíz; usa los comandos con `--workspace`.

Sin `VITE_BACKEND_URL`, el bundle intentaría conectarse a `localhost:4000` y el
mapa cargaría sin datos. Ver `.env.example` para la plantilla completa.

### Integración continua

El workflow **`.github/workflows/ci.yml`** ejecuta `npm run typecheck` y
`npm run build` en cada push o pull request a `main`. No despliega: Render y
Netlify hacen el deploy automático por su cuenta al detectar el push en GitHub.

### Primer push a GitHub

Si el repo aún no tiene remoto:

```bash
git remote add origin https://github.com/TU-USUARIO/costa-bus-tracker.git
git push -u origin main
```

---

### Archivos de despliegue incluidos

| Archivo                     | Para qué sirve                                        |
| --------------------------- | ----------------------------------------------------- |
| `render.yaml`               | Blueprint de Render (backend + simulador juntos)      |
| `backend/render.yaml`       | Variante por-servicio (referencia)                    |
| `simulator/render.yaml`     | Variante por-servicio (referencia)                    |
| `backend/railway.json`      | Build/start del backend en Railway                    |
| `simulator/railway.json`    | Build/start del simulador en Railway                  |
| `backend/Procfile`          | `web: node dist/index.js` (Railway/Heroku)            |
| `simulator/Procfile`        | `worker: node dist/index.js`                          |
| `Dockerfile` + `.dockerignore` | Hosts de contenedores (Fly.io, Cloud Run)          |
| `netlify.toml` (raíz)       | Build y publish del frontend en Netlify               |
| `.github/workflows/ci.yml`  | GitHub Actions: typecheck + build en cada push/PR      |

---

## Migración a GPS real (fase 2)

El backend no sabe de dónde vienen los datos: solo escucha `bus-position` con un
payload `BusPosition`. Para pasar a producción se reemplaza el workspace `simulator`
por un servicio que reciba la telemetría del dispositivo **Teltonika** (Codec 8/8E vía
TCP, o HTTP) y emita exactamente el mismo evento con los mismos campos. El frontend y el
panel lateral siguen funcionando sin cambios.
