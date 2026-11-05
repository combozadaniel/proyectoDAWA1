/**
 * Controladores de catálogos, clientes, técnicos, usuarios, notificaciones, dashboard y auditoría.
 * Son deliberadamente delgados: traducen HTTP <-> servicio.
 */
const catalogos = require('../services/catalogos.service');
const clientes = require('../services/clientes.service');
const tecnicos = require('../services/tecnicos.service');
const usuarios = require('../services/usuarios.service');
const notificaciones = require('../services/notificaciones.service');
const dashboard = require('../services/dashboard.service');
const auditoriaRepo = require('../repositories/auditoria.repository');
const { respuestaPaginada } = require('../utils/http');

const id = (req, p = 'id') => Number(req.params[p]);
const ok = (res, data) => res.json(data);
const creado = (res, data) => res.status(201).json(data);
const sinContenido = (res) => res.status(204).end();

module.exports = {
  // Especialidades
  listarEspecialidades: async (req, res) => ok(res, await catalogos.listarEspecialidades(req.query)),
  crearEspecialidad: async (req, res) => creado(res, await catalogos.crearEspecialidad(req.user, req.body, req.ip)),
  actualizarEspecialidad: async (req, res) =>
    ok(res, await catalogos.actualizarEspecialidad(req.user, id(req), req.body, req.ip)),
  eliminarEspecialidad: async (req, res) => {
    await catalogos.eliminarEspecialidad(req.user, id(req), req.ip);
    sinContenido(res);
  },

  // Categorías
  listarCategorias: async (req, res) => ok(res, await catalogos.listarCategorias(req.query)),
  crearCategoria: async (req, res) => creado(res, await catalogos.crearCategoria(req.user, req.body, req.ip)),
  actualizarCategoria: async (req, res) =>
    ok(res, await catalogos.actualizarCategoria(req.user, id(req), req.body, req.ip)),
  eliminarCategoria: async (req, res) => {
    await catalogos.eliminarCategoria(req.user, id(req), req.ip);
    sinContenido(res);
  },

  // Prioridades, estados y parámetros
  listarPrioridades: async (_req, res) => ok(res, await catalogos.listarPrioridades()),
  actualizarPrioridad: async (req, res) =>
    ok(res, await catalogos.actualizarPrioridad(req.user, id(req), req.body, req.ip)),
  listarEstados: async (_req, res) => ok(res, await catalogos.listarEstados()),
  listarParametros: async (_req, res) => ok(res, await catalogos.listarParametros()),
  actualizarParametro: async (req, res) =>
    ok(res, await catalogos.actualizarParametro(req.user, req.params.clave, req.body.valor, req.ip)),

  // Clientes y sedes
  listarClientes: async (req, res) => ok(res, await clientes.listar(req.validQuery)),
  obtenerCliente: async (req, res) => ok(res, await clientes.obtener(req.user, id(req))),
  crearCliente: async (req, res) => creado(res, await clientes.crear(req.user, req.body, req.ip)),
  actualizarCliente: async (req, res) => ok(res, await clientes.actualizar(req.user, id(req), req.body, req.ip)),
  eliminarCliente: async (req, res) => {
    await clientes.eliminar(req.user, id(req), req.ip);
    sinContenido(res);
  },
  listarSedes: async (req, res) => ok(res, await clientes.listarSedes(req.user, id(req))),
  crearSede: async (req, res) => creado(res, await clientes.crearSede(req.user, id(req), req.body, req.ip)),
  actualizarSede: async (req, res) =>
    ok(res, await clientes.actualizarSede(req.user, id(req), id(req, 'sedeId'), req.body, req.ip)),
  eliminarSede: async (req, res) => {
    await clientes.eliminarSede(req.user, id(req), id(req, 'sedeId'), req.ip);
    sinContenido(res);
  },

  // Técnicos
  listarTecnicos: async (req, res) => ok(res, await tecnicos.listar(req.validQuery)),
  obtenerTecnico: async (req, res) => ok(res, await tecnicos.obtener(id(req))),
  crearTecnico: async (req, res) => creado(res, await tecnicos.crear(req.user, req.body, req.ip)),
  actualizarTecnico: async (req, res) => ok(res, await tecnicos.actualizar(req.user, id(req), req.body, req.ip)),
  eliminarTecnico: async (req, res) => {
    await tecnicos.eliminar(req.user, id(req), req.ip);
    sinContenido(res);
  },
  miDisponibilidad: async (req, res) =>
    ok(res, await tecnicos.cambiarDisponibilidad(req.user, req.body.disponible, req.ip)),

  // Usuarios
  listarUsuarios: async (req, res) => ok(res, await usuarios.listar(req.validQuery)),
  obtenerUsuario: async (req, res) => ok(res, await usuarios.obtener(id(req))),
  crearUsuario: async (req, res) => creado(res, await usuarios.crear(req.user, req.body, req.ip)),
  actualizarUsuario: async (req, res) => ok(res, await usuarios.actualizar(req.user, id(req), req.body, req.ip)),
  resetPasswordUsuario: async (req, res) => {
    await usuarios.restablecerPassword(req.user, id(req), req.body.password, req.ip);
    sinContenido(res);
  },

  // Notificaciones
  listarNotificaciones: async (req, res) => ok(res, await notificaciones.listar(req.user.id, req.query)),
  marcarNotificacion: async (req, res) => {
    await notificaciones.marcarLeida(id(req), req.user.id);
    sinContenido(res);
  },
  marcarTodasNotificaciones: async (req, res) => ok(res, await notificaciones.marcarTodasLeidas(req.user.id)),

  // Dashboard
  indicadores: async (req, res) => ok(res, await dashboard.indicadores(req.user, req.validQuery)),

  // Auditoría
  listarAuditoria: async (req, res) => {
    const { rows, total, page, limit } = await auditoriaRepo.listar(req.validQuery);
    ok(res, respuestaPaginada(rows, total, { page, limit }));
  },
};
