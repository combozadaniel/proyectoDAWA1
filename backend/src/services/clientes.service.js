const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { respuestaPaginada } = require('../utils/http');
const repo = require('../repositories/clientes.repository');
const usuariosRepo = require('../repositories/usuarios.repository');
const auditoria = require('../repositories/auditoria.repository');
const { hashPassword } = require('./auth.service');
const { ROLES } = require('../domain/roles');

async function listar(filtros) {
  const { rows, total, page, limit } = await repo.listar(filtros);
  return respuestaPaginada(rows, total, { page, limit });
}

async function obtener(usuario, id) {
  if (usuario.rol === ROLES.CLIENTE && usuario.clienteId !== id) throw AppError.notFound('Cliente');
  const c = await repo.obtener(id);
  if (!c) throw AppError.notFound('Cliente');
  return c;
}

/**
 * Crea un cliente con sus sedes y, opcionalmente, su cuenta de acceso (rol CLIENTE).
 * Todo en una sola transacción.
 */
async function crear(usuario, datos, ip) {
  const { cuenta, sedes = [], ...cliente } = datos;
  return withTransaction(async (client) => {
    if (await repo.existeIdentificacion(cliente.identificacion, null, client)) {
      throw AppError.conflict('Ya existe un cliente con esa identificación');
    }
    if (cuenta) {
      if (await usuariosRepo.existeEmail(cuenta.email, null, client)) {
        throw AppError.conflict('Ya existe un usuario con ese correo');
      }
      const u = await usuariosRepo.crear(
        { email: cuenta.email, nombre: cliente.razon_social, passwordHash: await hashPassword(cuenta.password), rol: ROLES.CLIENTE },
        client,
      );
      cliente.usuario_id = u.id;
    }
    const id = await repo.crear(cliente, client);
    for (const sede of sedes) await repo.crearSede(id, sede, client);
    const creado = await repo.obtener(id, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'cliente', entidadId: id, accion: 'CREAR', despues: creado, ip },
      client,
    );
    return creado;
  });
}

async function actualizar(usuario, id, datos, ip) {
  return withTransaction(async (client) => {
    const antes = await repo.obtener(id, client);
    if (!antes) throw AppError.notFound('Cliente');
    if (datos.identificacion && (await repo.existeIdentificacion(datos.identificacion, id, client))) {
      throw AppError.conflict('Ya existe otro cliente con esa identificación');
    }
    await repo.actualizar(id, datos, client);
    // Vigencia: desactivar el cliente desactiva también su cuenta de acceso.
    if (datos.activo !== undefined && antes.usuario_id) {
      await usuariosRepo.actualizar(antes.usuario_id, { activo: datos.activo }, client);
    }
    const despues = await repo.obtener(id, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'cliente', entidadId: id, accion: 'ACTUALIZAR', antes, despues, ip },
      client,
    );
    return despues;
  });
}

async function eliminar(usuario, id, ip) {
  await withTransaction(async (client) => {
    const antes = await repo.obtener(id, client);
    if (!antes) throw AppError.notFound('Cliente');
    const n = await repo.contarSolicitudes(id, client);
    if (n > 0) {
      throw AppError.conflict(
        `No se puede eliminar el cliente porque tiene ${n} solicitud(es) registradas. Puede desactivarlo.`,
      );
    }
    await repo.eliminar(id, client);
    if (antes.usuario_id) await usuariosRepo.actualizar(antes.usuario_id, { activo: false }, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'cliente', entidadId: id, accion: 'ELIMINAR', antes, ip },
      client,
    );
  });
}

// ---------- Sedes ----------
async function listarSedes(usuario, clienteId) {
  if (usuario.rol === ROLES.CLIENTE && usuario.clienteId !== clienteId) throw AppError.notFound('Cliente');
  return repo.listarSedes(clienteId);
}

async function crearSede(usuario, clienteId, datos, ip) {
  return withTransaction(async (client) => {
    const c = await repo.obtener(clienteId, client);
    if (!c) throw AppError.notFound('Cliente');
    const sede = await repo.crearSede(clienteId, datos, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'sede', entidadId: sede.id, accion: 'CREAR', despues: sede, ip },
      client,
    );
    return sede;
  });
}

async function actualizarSede(usuario, clienteId, sedeId, datos, ip) {
  return withTransaction(async (client) => {
    const antes = await repo.obtenerSede(sedeId, client);
    if (!antes || antes.cliente_id !== clienteId) throw AppError.notFound('Sede');
    const sede = await repo.actualizarSede(sedeId, datos, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'sede', entidadId: sedeId, accion: 'ACTUALIZAR', antes, despues: sede, ip },
      client,
    );
    return sede;
  });
}

async function eliminarSede(usuario, clienteId, sedeId, ip) {
  await withTransaction(async (client) => {
    const antes = await repo.obtenerSede(sedeId, client);
    if (!antes || antes.cliente_id !== clienteId) throw AppError.notFound('Sede');
    if ((await repo.contarSolicitudesSede(sedeId, client)) > 0) {
      throw AppError.conflict('No se puede eliminar la sede porque tiene solicitudes. Puede desactivarla.');
    }
    await repo.eliminarSede(sedeId, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'sede', entidadId: sedeId, accion: 'ELIMINAR', antes, ip },
      client,
    );
  });
}

module.exports = { listar, obtener, crear, actualizar, eliminar, listarSedes, crearSede, actualizarSede, eliminarSede };
