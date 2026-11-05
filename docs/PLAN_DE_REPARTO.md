# Plan de reparto — ServiGest Ecuador

Equipo de 4 integrantes. Cada persona es **dueña de un módulo vertical** (base de datos → API → interfaz → pruebas),
para que pueda explicar y modificar en vivo su parte completa durante la defensa individual. Reemplace "Integrante N" por los nombres reales.

> El documento del proyecto exige que las contribuciones individuales sean verificables en Git.
> Cada integrante debe trabajar en su propia rama (`feature/<modulo>`), hacer commits con su cuenta
> y abrir un Pull Request revisado por otro miembro antes de integrarlo a `main`.

## Asignación de módulos

### Integrante 1 — Seguridad, usuarios y arquitectura base
| Capa | Archivos |
|---|---|
| BD | tablas `usuarios`, `roles`, `tokens_revocados`, `restablecimientos_password`, `auditoria`; `scripts/migrate.js` |
| Backend | `config/*`, `app.js`, `server.js`, `middlewares/*`, `utils/*`, `services/auth.service.js`, `services/usuarios.service.js`, rutas `/auth` y `/usuarios`, `/auditoria` |
| Frontend | `api/client.js`, `context/AuthContext.jsx`, `components/RutaProtegida.jsx`, `components/Layout.jsx`, `pages/Login.jsx`, `pages/RecuperarPassword.jsx`, `pages/Perfil.jsx`, `pages/admin/Usuarios.jsx`, `pages/admin/Auditoria.jsx` |
| Pruebas | `tests/integration/auth.test.js`, `tests/integration/autorizacion.test.js` |
| Entregables | Docker Compose, README (ejecución local/despliegue), manual técnico |
| Debe dominar | JWT y revocación, bcrypt, middleware de roles, manejo centralizado de errores, CORS/Helmet, variables por ambiente |

### Integrante 2 — Clientes, técnicos y catálogos
| Capa | Archivos |
|---|---|
| BD | `clientes`, `sedes`, `tecnicos`, `tecnico_especialidades`, `especialidades`, `categorias_servicio`, `prioridades`, `parametros`; `scripts/seed.js` |
| Backend | `services/clientes|tecnicos|catalogos.service.js`, sus repositorios, `validators/schemas.js` (cédula/RUC), `routes/gestion.routes.js` (catálogos) |
| Frontend | `pages/admin/Clientes.jsx`, `pages/admin/Tecnicos.jsx`, `pages/admin/Catalogos.jsx`, `components/Confirmar.jsx` |
| Pruebas | `tests/integration/catalogos.test.js`, `tests/unit/politicas.test.js` (cédula) |
| Entregables | Diagramas lógico y físico de la BD, manual de usuario del Administrador |
| Debe dominar | Integridad referencial, restricciones al eliminar (409), vigencia (activar/desactivar), validación de duplicados |

### Integrante 3 — Ciclo de vida de solicitudes y asignación
| Capa | Archivos |
|---|---|
| BD | `solicitudes`, `asignaciones`, `historial_solicitudes` (trigger inalterable), `adjuntos`, `estados` |
| Backend | `domain/estados.js`, `domain/asignacion.js`, `domain/politicas.js`, `domain/sla.js`, `services/solicitudes.service.js`, `repositories/solicitudes.repository.js`, `routes/solicitudes.routes.js`, `middlewares/upload.js` |
| Frontend | `pages/Solicitudes.jsx`, `pages/SolicitudNueva.jsx`, `pages/SolicitudDetalle.jsx`, `components/ui.jsx` |
| Pruebas | `tests/unit/estados|sla|asignacion.test.js`, `tests/integration/solicitudes.test.js`, `tests/integration/flujos.e2e.test.js` |
| Entregables | Especificación OpenAPI (`src/docs/openapi.yaml`), manuales de usuario del Coordinador y del Técnico |
| Debe dominar | Máquina de estados, reglas 1‑8, transacciones y `FOR UPDATE`, control de versión optimista, cálculo de plazos |

### Integrante 4 — Notificaciones, tiempo real y dashboard
| Capa | Archivos |
|---|---|
| BD | `notificaciones`; consultas agregadas del dashboard |
| Backend | `sockets/io.js`, `services/notificaciones.service.js`, `services/dashboard.service.js`, `repositories/dashboard.repository.js`, `repositories/notificaciones.repository.js` |
| Frontend | `context/SocketContext.jsx`, `hooks/useApi.js`, `pages/Dashboard.jsx`, `pages/Notificaciones.jsx`, campana y avisos en `Layout.jsx`, `styles.css` (diseño responsivo) |
| Pruebas | sección Dashboard de `catalogos.test.js`; verificación responsiva y de estados de carga/error/vacío |
| Entregables | Informe de pruebas con evidencias, manual de usuario del Cliente, guion del video |
| Debe dominar | Socket.IO (salas por usuario/rol, autenticación del socket), SQL de agregación (`FILTER`, `generate_series`), Recharts, Hooks |

## Responsabilidades compartidas
- Diagrama de arquitectura: todos (cada uno explica su capa).
- Revisión cruzada de Pull Requests: 1 ↔ 3, 2 ↔ 4.
- Video: cada integrante graba la demostración de su módulo.

## Calendario (según la planificación sugerida)

| Semana | Hito | Responsables principales | Evidencia |
|---|---|---|---|
| 1 | Análisis, modelo de datos y arquitectura | Todos (liderado por 2 y 3) | Migración 001, diagramas, backlog |
| 2 | Backend, autenticación y API REST | 1, 2, 3 | Endpoints operativos + Swagger — **revisión formativa 1** |
| 3 | React, formularios y flujos | 1, 2, 3 | Frontend integrado |
| 4 | Reglas avanzadas, notificaciones y dashboard | 3, 4 | Incremento funcional — **revisión formativa 2** |
| 5 | Pruebas, despliegue, documentación y defensa | Todos | Entrega final, informe de pruebas, video |

## Preparación para la defensa (modificación en vivo)
Cambios típicos que cada integrante debe poder hacer en minutos:
- **1:** agregar un rol nuevo a una ruta; cambiar la expiración del token; agregar un campo al perfil.
- **2:** agregar un campo obligatorio a técnicos (migración + validación + formulario); impedir eliminar una sede con reglas nuevas.
- **3:** agregar una transición de estado (p. ej. `PENDIENTE_INFO → RESUELTA`) con su prueba; cambiar la regla de carga máxima.
- **4:** agregar un indicador al dashboard (p. ej. solicitudes por categoría); emitir una notificación nueva en tiempo real.
