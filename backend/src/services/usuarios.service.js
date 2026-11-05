/**
 * Administración de usuarios (solo ADMIN).
 * Los usuarios TECNICO y CLIENTE se crean preferentemente desde sus módulos,
 * porque requieren ficha técnica o datos de cliente.
 */
const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { respuestaPaginada } = require('../utils/http');
const repo = require('../repositories/usuarios.repository');
const authRepo = require('../repositories/auth.repository');
const auditoria = require('../repositories/auditoria.repository');
const { hashPassword } = require('./auth.service');
const { ROLES } = require('../domain/roles');

async function listar(filtros) {
  const { rows, total, page, limit } = await repo.listar(filtros);
  return respuestaPaginada(rows, total, { page, limit });
}

async function obtener(id) {
  const u = await repo.obtener(id);
  if (!u) throw AppError.notFound('Usuario');
  return u;
}

async function crear(admin, datos, ip) {
  if (![ROLES.ADMIN, ROLES.COORDINADOR].includes(datos.rol)) {
    throw AppError.businessRule('Los técnicos y clientes se registran desde sus módulos respectivos');
  }
  return withTransaction(async (client) => {
    if (await repo.existeEmail(datos.email, null, client)) throw AppError.conflict('Ya existe un usuario con ese correo');
    const u = await repo.crear(
      { email: datos.email, nombre: datos.nombre, passwordHash: await hashPassword(datos.password), rol: datos.rol },
      client,
    );
    await auditoria.registrar(
      { usuarioId: admin.id, entidad: 'usuario', entidadId: u.id, accion: 'CREAR', despues: u, ip },
      client,
    );
    return u;
  });
}

async function actualizar(admin, id, datos, ip) {
  if (id === admin.id && datos.activo === false) {
    throw AppError.businessRule('No puede desactivar su propio usuario');
  }
  return withTransaction(async (client) => {
    const antes = await repo.obtener(id, client);
    if (!antes) throw AppError.notFound('Usuario');
    if (datos.email && (await repo.existeEmail(datos.email, id, client))) {
      throw AppError.conflict('Ya existe otro usuario con ese correo');
    }
    const u = await repo.actualizar(id, datos, client);
    await auditoria.registrar(
      { usuarioId: admin.id, entidad: 'usuario', entidadId: id, accion: 'ACTUALIZAR', antes, despues: u, ip },
      client,
    );
    return u;
  });
}

/** Restablecimiento controlado por el administrador (asigna una contraseña temporal). */
async function restablecerPassword(admin, id, password, ip) {
  await withTransaction(async (client) => {
    const u = await repo.obtener(id, client);
    if (!u) throw AppError.notFound('Usuario');
    await authRepo.actualizarPassword(id, await hashPassword(password), client);
    await auditoria.registrar(
      { usuarioId: admin.id, entidad: 'usuario', entidadId: id, accion: 'RESET_PASSWORD_ADMIN', ip },
      client,
    );
  });
}

module.exports = { listar, obtener, crear, actualizar, restablecerPassword };
