/**
 * Especialidades, categorías, prioridades y parámetros operativos.
 * Valida duplicidad, integridad referencial y restricciones al eliminar.
 */
const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const repo = require('../repositories/catalogos.repository');
const auditoria = require('../repositories/auditoria.repository');

// ---------- Especialidades ----------
const listarEspecialidades = (f) => repo.listarEspecialidades({ soloActivas: f.activas === 'true' });

async function crearEspecialidad(usuario, datos, ip) {
  return withTransaction(async (client) => {
    const e = await repo.crearEspecialidad(datos, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'especialidad', entidadId: e.id, accion: 'CREAR', despues: e, ip },
      client,
    );
    return e;
  });
}

async function actualizarEspecialidad(usuario, id, datos, ip) {
  return withTransaction(async (client) => {
    const antes = await repo.obtenerEspecialidad(id, client);
    if (!antes) throw AppError.notFound('Especialidad');
    const e = await repo.actualizarEspecialidad(id, datos, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'especialidad', entidadId: id, accion: 'ACTUALIZAR', antes, despues: e, ip },
      client,
    );
    return e;
  });
}

async function eliminarEspecialidad(usuario, id, ip) {
  await withTransaction(async (client) => {
    const antes = await repo.obtenerEspecialidad(id, client);
    if (!antes) throw AppError.notFound('Especialidad');
    const uso = await repo.usoEspecialidad(id, client);
    if (uso.categorias > 0 || uso.tecnicos > 0) {
      throw AppError.conflict(
        'No se puede eliminar la especialidad porque tiene categorías o técnicos asociados. Puede desactivarla.',
        uso,
      );
    }
    await repo.eliminarEspecialidad(id, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'especialidad', entidadId: id, accion: 'ELIMINAR', antes, ip },
      client,
    );
  });
}

// ---------- Categorías ----------
const listarCategorias = (f) => repo.listarCategorias({ soloActivas: f.activas === 'true' });

async function validarEspecialidadActiva(id, client) {
  const esp = await repo.obtenerEspecialidad(id, client);
  if (!esp) throw AppError.businessRule('La especialidad indicada no existe');
  if (!esp.activo) throw AppError.businessRule('La especialidad indicada está inactiva');
}

async function crearCategoria(usuario, datos, ip) {
  return withTransaction(async (client) => {
    await validarEspecialidadActiva(datos.especialidad_id, client);
    const c = await repo.crearCategoria(datos, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'categoria', entidadId: c.id, accion: 'CREAR', despues: c, ip },
      client,
    );
    return c;
  });
}

async function actualizarCategoria(usuario, id, datos, ip) {
  return withTransaction(async (client) => {
    const antes = await repo.obtenerCategoria(id, client);
    if (!antes) throw AppError.notFound('Categoría');
    if (datos.especialidad_id) await validarEspecialidadActiva(datos.especialidad_id, client);
    const c = await repo.actualizarCategoria(id, datos, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'categoria', entidadId: id, accion: 'ACTUALIZAR', antes, despues: c, ip },
      client,
    );
    return c;
  });
}

async function eliminarCategoria(usuario, id, ip) {
  await withTransaction(async (client) => {
    const antes = await repo.obtenerCategoria(id, client);
    if (!antes) throw AppError.notFound('Categoría');
    const uso = await repo.usoCategoria(id, client);
    if (uso.solicitudes > 0) {
      throw AppError.conflict(
        'No se puede eliminar la categoría porque tiene solicitudes registradas. Puede desactivarla.',
        uso,
      );
    }
    await repo.eliminarCategoria(id, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'categoria', entidadId: id, accion: 'ELIMINAR', antes, ip },
      client,
    );
  });
}

// ---------- Prioridades / estados / parámetros ----------
const listarPrioridades = () => repo.listarPrioridades();
const listarEstados = () => repo.listarEstados();
const listarParametros = () => repo.listarParametros();

async function actualizarPrioridad(usuario, id, datos, ip) {
  return withTransaction(async (client) => {
    const antes = await repo.obtenerPrioridad(id, client);
    if (!antes) throw AppError.notFound('Prioridad');
    const p = await repo.actualizarPrioridad(id, datos, client);
    await auditoria.registrar(
      { usuarioId: usuario.id, entidad: 'prioridad', entidadId: id, accion: 'ACTUALIZAR', antes, despues: p, ip },
      client,
    );
    return p;
  });
}

const VALIDADORES_PARAMETRO = {
  UMBRAL_POR_VENCER_PCT: (v) => Number.isInteger(+v) && +v >= 1 && +v <= 99,
  MAX_CARGA_DEFAULT: (v) => Number.isInteger(+v) && +v >= 1 && +v <= 50,
  MAX_ADJUNTO_MB: (v) => Number.isInteger(+v) && +v >= 1 && +v <= 20,
  HORAS_EXPIRACION_RESET: (v) => Number.isInteger(+v) && +v >= 1 && +v <= 72,
};

async function actualizarParametro(usuario, clave, valor, ip) {
  const validar = VALIDADORES_PARAMETRO[clave];
  if (validar && !validar(valor)) {
    throw AppError.validation([{ campo: 'valor', mensaje: `Valor fuera de rango para ${clave}` }]);
  }
  return withTransaction(async (client) => {
    const antes = await repo.obtenerParametro(clave, null, client);
    if (antes === null) throw AppError.notFound('Parámetro');
    const p = await repo.actualizarParametro(clave, String(valor), client);
    await auditoria.registrar(
      {
        usuarioId: usuario.id,
        entidad: 'parametro',
        entidadId: clave,
        accion: 'ACTUALIZAR',
        antes: { valor: antes },
        despues: { valor: p.valor },
        ip,
      },
      client,
    );
    return p;
  });
}

module.exports = {
  listarEspecialidades,
  crearEspecialidad,
  actualizarEspecialidad,
  eliminarEspecialidad,
  listarCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
  listarPrioridades,
  actualizarPrioridad,
  listarEstados,
  listarParametros,
  actualizarParametro,
};
