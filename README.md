# ServiGest Ecuador

Plataforma web para la **gestión de solicitudes de servicios técnicos, asignación de técnicos y seguimiento operativo**.
Proyecto integrador — Desarrollo de Aplicaciones Web Avanzado (Universidad de Guayaquil, 2026).

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite, React Router, React Bootstrap, React Hook Form, Recharts, Socket.IO client |
| Backend | Node.js 20 + Express 4, Zod, JWT, bcrypt, Multer, Socket.IO |
| Datos | PostgreSQL 16 (migraciones SQL versionadas) |
| Pruebas | Jest + Supertest (unitarias, integración y E2E de API) |
| Despliegue | Docker Compose (PostgreSQL + API + Nginx) |
| Documentación API | OpenAPI 3 / Swagger UI en `/api/docs` |

## Arquitectura

```
┌──────────────┐  HTTP/JSON + WebSocket  ┌───────────────────────────────────────────────────────┐   SQL   ┌────────────┐
│ React (SPA)  │ ──────────────────────▶ │ Express                                               │ ──────▶ │ PostgreSQL │
│ presentación │ ◀────────────────────── │ routes → controllers → services → repositories        │         │            │
└──────────────┘                         │   (API)      (HTTP)      (negocio)   (acceso a datos) │         └────────────┘
                                         │ domain/: reglas puras (estados, SLA, asignación, ...)│
                                         └───────────────────────────────────────────────────────┘
```

- El frontend **nunca** accede a la base de datos: solo consume la API REST.
- Toda regla de negocio y control de acceso se ejecuta en el servidor (`backend/src/domain` y `backend/src/services`).
- Las operaciones que modifican solicitudes usan transacciones con bloqueo de fila (`SELECT … FOR UPDATE`).
- El historial de solicitudes y la auditoría son **inalterables** (un trigger de PostgreSQL bloquea `UPDATE`/`DELETE`).

```
backend/
  db/migrations/        esquema y catálogos base (SQL reproducible)
  scripts/              migrate.js, seed.js (datos de prueba deterministas)
  src/
    config/             variables por ambiente y pool de PostgreSQL
    routes/             definición de endpoints + middlewares (auth, roles, validación)
    controllers/        traducen HTTP ⇄ servicio
    services/           lógica de negocio y transacciones
    repositories/       consultas SQL parametrizadas
    domain/             reglas puras: estados, sla, asignacion, politicas
    validators/         esquemas Zod
    sockets/            Socket.IO autenticado con JWT
    docs/openapi.yaml   especificación OpenAPI
  tests/unit | tests/integration
frontend/
  src/api               cliente axios (token, errores)
  src/context           AuthContext, SocketContext (tiempo real)
  src/hooks             useApi, useMutacion, useDebounce
  src/components        Layout, RutaProtegida, badges, estados de carga/error/vacío
  src/pages             Dashboard, Solicitudes, Detalle, Nueva, Notificaciones, Perfil, admin/*
```

## Ejecución local (desarrollo)

Requisitos: Node.js 20+, PostgreSQL 14+.

```bash
createdb servigest
```

```bash
cd backend
cp .env.example .env.development   # ajuste DATABASE_URL y JWT_SECRET
npm install
npm run db:reset                   # migraciones + datos de prueba
npm run dev                        # API en http://localhost:4000 · Swagger en /api/docs
```

En otra terminal:

```bash
cd frontend
npm install
npm run dev                        # http://localhost:5173 (Vite redirige /api y /socket.io al backend)
```

### Usuarios de prueba

Contraseña de todos: **`Servigest2026`**

| Rol | Correo |
|---|---|
| Administrador | admin@servigest.ec |
| Coordinador | coordinador@servigest.ec |
| Técnico | tecnico@servigest.ec (y tecnico2…tecnico7) |
| Cliente | cliente@servigest.ec (y cliente2…cliente5) |

## Despliegue con Docker Compose

```bash
cp .env.example .env               # cambie POSTGRES_PASSWORD y JWT_SECRET
docker compose up -d --build
```

- Aplicación: http://localhost:8080 · API docs: http://localhost:8080/api/docs
- Al iniciar, el backend aplica las migraciones pendientes y, si `SEED_DEMO=true`, carga los datos de prueba (solo la primera vez).
- Nginx sirve el frontend y redirige `/api` y `/socket.io` (WebSocket) al backend.
- Los datos y adjuntos persisten en los volúmenes `pgdata` y `uploads`.

## Pruebas

```bash
createdb servigest_test
```

```bash
cd backend
cp .env.example .env.test          # DATABASE_URL apuntando a servigest_test
npm test                           # unitarias + integración + E2E (reinicia la BD de pruebas)
```

| Suite | Contenido |
|---|---|
| `tests/unit/estados.test.js` | Reglas 1 y 4: resolución obligatoria, cierre, reapertura, transiciones por rol |
| `tests/unit/sla.test.js` | Regla 6: fecha límite, por vencer, vencida, cumplimiento |
| `tests/unit/asignacion.test.js` | Regla 5: especialidad, disponibilidad, carga máxima, reasignación |
| `tests/unit/politicas.test.js` | Reglas 2 y 3: alcance de cliente y técnico; validación de cédula |
| `tests/integration/auth.test.js` | Login, logout con revocación, recuperación y cambio de contraseña |
| `tests/integration/solicitudes.test.js` | Registro, adjuntos, paginación, filtros, entradas inválidas, historial inalterable |
| `tests/integration/autorizacion.test.js` | Matriz de permisos por rol y acceso a recursos ajenos |
| `tests/integration/catalogos.test.js` | CRUD, duplicidad, integridad referencial, vigencia, dashboard |
| `tests/integration/flujos.e2e.test.js` | Flujo 1: registro–asignación–atención · Flujo 2: consulta–seguimiento–cierre |

## Reglas de negocio implementadas

| # | Regla | Dónde |
|---|---|---|
| 1 | No cerrar sin resolución documentada | `domain/estados.js` (`validarTransicion`, `validarCierre`) |
| 2 | El técnico solo modifica solicitudes asignadas a él | `domain/politicas.js`, `services/solicitudes.service.js` |
| 3 | El cliente solo consulta sus registros | `domain/politicas.js` (`alcancePorRol`, `puedeVerSolicitud`) |
| 4 | Cerrada no retrocede sin reapertura autorizada y auditada | `validarTransicion`, `validarReapertura`, `POST /reapertura` |
| 5 | Asignación valida especialidad, disponibilidad y carga | `domain/asignacion.js` + bloqueo de fila del técnico |
| 6 | Plazos y cumplimiento calculados en el backend | `domain/sla.js`, `repositories/dashboard.repository.js` |
| 7 | Toda transición genera auditoría (usuario, fecha, cambio) | tabla `historial_solicitudes` (inalterable) |
| 8 | Validación de existencia, estado y coherencia transaccional | `withTransaction` + `FOR UPDATE` + control de versión optimista |

**Plazos (SLA):** fecha límite = fecha de registro + horas de la prioridad (Baja 120 h, Media 72 h, Alta 24 h, Crítica 8 h; configurables).
Una solicitud abierta está *por vencer* cuando consumió ≥ `UMBRAL_POR_VENCER_PCT` (75 %) de su plazo, y *vencida* al superar la fecha límite.

**Tiempo real:** Socket.IO autenticado con JWT. Las notificaciones (campana y aviso emergente), el listado de solicitudes, el detalle y el dashboard se actualizan sin recargar.

**Recuperación de contraseña:** token aleatorio de un solo uso (solo se guarda su hash SHA‑256) con vigencia configurable. Como no hay servidor de correo, fuera de producción la API devuelve el enlace para pruebas; en producción solo se registra en el log del servidor. El administrador también puede asignar una contraseña temporal.

Ver [`docs/PLAN_DE_REPARTO.md`](docs/PLAN_DE_REPARTO.md) para la división del trabajo entre los integrantes.
