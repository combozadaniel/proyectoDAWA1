const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { respuestaPaginada } = require('../utils/http');
const repo = require('../repositories/tecnicos.repository');
const usuariosRepo = require('../repositories/usuarios.repository');
const catalogosRepo = require('../repositories/catalogos.repository');
const auditoria = require('../repositories/auditoria.repository');
const { hashPassword } = require('./auth.service');
const { ROLES } = require('../domain/roles');

async function listar(filtros) {
  const { rows, total, page, limit } = await repo.listar(filtros);
  return respuestaPaginada(rows, total, { page, limit });
}

async function obtener(id) {
  const t = await repo.obtener(id);
  if (!t) throw AppError.notFound('Técnico');
  return t;
}

async function validarEspecialidades(ids, client) {
  for (const id of ids) {
    const esp = await catalogosRepo.obtenerEspecialidad(id, client);
    if (!esp || !esp.activo) throw AppError.businessRule(`La especialidad ${id} no existe o está inactiva`);
  }
}

/** Crea el usuario (rol TECNICO) y su ficha técnica en una transacción. */
async function crear(usuario, datos, ip) {
  return withTransaction(async (client) => {
    if (await usuariosRepo.existeEmail(datos.email, null, client)) {
      throw AppError.conflict('Ya existe un usuario con ese correo');
    }
    if (await repo.existeCedula(datos.cedula, null, client)) {
      throw AppError.conflict('Ya existe un técnico con esa cédula');
    }
    await validarEspecialidades(datos.especialidades, client);
    const u = await usuariosRepo.crear(
      { email: datos.email, nombre: datos.nombre, passwordHash: await hashPassword(datos.password), rol: ROLES.TECNICO },
      client,
    );
    const maxDefault = Number(await catalogosRepo.obtenerParametro('MAX_CARGA_DEFAULT', '5', client));
    const id = await repo.crear(
      {
        usuario_id: u.id,
        cedula: datos.cedula,
        telefono: datos.telefono,
        max_solicitudes_activas: datos.max_solicitudes_activas ?? maxDefault,
      },
      client,
    );
    await repo.reemplazarEspecialidades(id, datos.especialidades, client);
    const creado = await repo.obtener(id, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'tecnico', entidadId: id, accion: 'CREAR', despues: creado, ip },
      client,
    );
    return creado;
  });
}

async function actualizar(usuario, id, datos, ip) {
  return withTransaction(async (client) => {
    const antes = await repo.obtener(id, client);
    if (!antes) throw AppError.notFound('Técnico');
    if (datos.cedula && (await repo.existeCedula(datos.cedula, id, client))) {
      throw AppError.conflict('Ya existe otro técnico con esa cédula');
    }
    if (datos.email && (await usuariosRepo.existeEmail(datos.email, antes.usuario_id, client))) {
      throw AppError.conflict('Ya existe otro usuario con ese correo');
    }
    if (datos.max_solicitudes_activas != null && datos.max_solicitudes_activas < antes.carga_actual) {
      throw AppError.businessRule(
        `El máximo no puede ser menor a la carga actual del técnico (${antes.carga_actual})`,
      );
    }
    if (datos.especialidades) {
      await validarEspecialidades(datos.especialidades, client);
      await repo.reemplazarEspecialidades(id, datos.especialidades, client);
    }
    await repo.actualizar(id, datos, client);
    if (datos.nombre || datos.email || datos.activo !== undefined) {
      await usuariosRepo.actualizar(
        antes.usuario_id,
        { nombre: datos.nombre, email: datos.email, activo: datos.activo },
        client,
      );
    }
    const despues = await repo.obtener(id, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'tecnico', entidadId: id, accion: 'ACTUALIZAR', antes, despues, ip },
      client,
    );
    return despues;
  });
}

/** El propio técnico cambia su disponibilidad. */
async function cambiarDisponibilidad(usuario, disponible, ip) {
  if (!usuario.tecnicoId) throw AppError.forbidden();
  return actualizar(usuario, usuario.tecnicoId, { disponible }, ip);
}

async function eliminar(usuario, id, ip) {
  await withTransaction(async (client) => {
    const antes = await repo.obtener(id, client);
    if (!antes) throw AppError.notFound('Técnico');
    if ((await repo.contarAsignaciones(id, client)) > 0) {
      throw AppError.conflict(
        'No se puede eliminar el técnico porque tiene asignaciones registradas. Puede desactivarlo.',
      );
    }
    const usuarioId = await repo.eliminar(id, client);
    await usuariosRepo.actualizar(usuarioId, { activo: false }, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'tecnico', entidadId: id, accion: 'ELIMINAR', antes, ip },
      client,
    );
  });
}

module.exports = { listar, obtener, crear, actualizar, cambiarDisponibilidad, eliminar };
