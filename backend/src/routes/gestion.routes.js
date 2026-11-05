/**
 * Rutas de catálogos, clientes, técnicos, usuarios, notificaciones, dashboard y auditoría.
 */
const { Router } = require('express');
const c = require('../controllers/gestion.controller');
const { autenticar, autorizar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validate');
const s = require('../validators/schemas');
const { asyncHandler: h } = require('../utils/http');
const { ROLES, GESTION } = require('../domain/roles');

const { ADMIN, TECNICO } = ROLES;
const router = Router();
router.use(autenticar);

const soloAdmin = autorizar(ADMIN);
const gestion = autorizar(...GESTION);
const idParam = validar(s.paramsId, 'params');

// ---------- Catálogos (lectura: todos los autenticados; escritura: ADMIN) ----------
router.get('/especialidades', h(c.listarEspecialidades));
router.post('/especialidades', soloAdmin, validar(s.especialidad), h(c.crearEspecialidad));
router.put('/especialidades/:id', soloAdmin, idParam, validar(s.especialidadUpdate), h(c.actualizarEspecialidad));
router.delete('/especialidades/:id', soloAdmin, idParam, h(c.eliminarEspecialidad));

router.get('/categorias', h(c.listarCategorias));
router.post('/categorias', soloAdmin, validar(s.categoria), h(c.crearCategoria));
router.put('/categorias/:id', soloAdmin, idParam, validar(s.categoriaUpdate), h(c.actualizarCategoria));
router.delete('/categorias/:id', soloAdmin, idParam, h(c.eliminarCategoria));

router.get('/prioridades', h(c.listarPrioridades));
router.put('/prioridades/:id', soloAdmin, idParam, validar(s.prioridad), h(c.actualizarPrioridad));
router.get('/estados', h(c.listarEstados));
router.get('/parametros', gestion, h(c.listarParametros));
router.put('/parametros/:clave', soloAdmin, validar(s.parametro), h(c.actualizarParametro));

// ---------- Clientes y sedes ----------
router.get('/clientes', gestion, validar(s.listadoGenerico, 'query'), h(c.listarClientes));
router.post('/clientes', gestion, validar(s.cliente), h(c.crearCliente));
router.get('/clientes/:id', idParam, h(c.obtenerCliente)); // el cliente solo ve el suyo (servicio)
router.put('/clientes/:id', gestion, idParam, validar(s.clienteUpdate), h(c.actualizarCliente));
router.delete('/clientes/:id', soloAdmin, idParam, h(c.eliminarCliente));
router.get('/clientes/:id/sedes', idParam, h(c.listarSedes));
router.post('/clientes/:id/sedes', gestion, idParam, validar(s.sede), h(c.crearSede));
router.put('/clientes/:id/sedes/:sedeId', gestion, validar(s.sedeUpdate), h(c.actualizarSede));
router.delete('/clientes/:id/sedes/:sedeId', gestion, h(c.eliminarSede));

// ---------- Técnicos ----------
router.get('/tecnicos', gestion, validar(s.listadoGenerico, 'query'), h(c.listarTecnicos));
router.post('/tecnicos', soloAdmin, validar(s.tecnico), h(c.crearTecnico));
router.patch('/tecnicos/me/disponibilidad', autorizar(TECNICO), validar(s.disponibilidad), h(c.miDisponibilidad));
router.get('/tecnicos/:id', gestion, idParam, h(c.obtenerTecnico));
router.put('/tecnicos/:id', gestion, idParam, validar(s.tecnicoUpdate), h(c.actualizarTecnico));
router.delete('/tecnicos/:id', soloAdmin, idParam, h(c.eliminarTecnico));

// ---------- Usuarios ----------
router.get('/usuarios', soloAdmin, validar(s.listadoGenerico, 'query'), h(c.listarUsuarios));
router.post('/usuarios', soloAdmin, validar(s.usuario), h(c.crearUsuario));
router.get('/usuarios/:id', soloAdmin, idParam, h(c.obtenerUsuario));
router.put('/usuarios/:id', soloAdmin, idParam, validar(s.usuarioUpdate), h(c.actualizarUsuario));
router.post('/usuarios/:id/reset-password', soloAdmin, idParam, validar(s.resetAdmin), h(c.resetPasswordUsuario));

// ---------- Notificaciones (del usuario autenticado) ----------
router.get('/notificaciones', h(c.listarNotificaciones));
router.patch('/notificaciones/leer-todas', h(c.marcarTodasNotificaciones));
router.patch('/notificaciones/:id/leida', idParam, h(c.marcarNotificacion));

// ---------- Dashboard (alcance según rol) ----------
router.get('/dashboard/indicadores', validar(s.dashboard, 'query'), h(c.indicadores));

// ---------- Auditoría ----------
router.get('/auditoria', soloAdmin, validar(s.listadoGenerico, 'query'), h(c.listarAuditoria));

module.exports = router;
