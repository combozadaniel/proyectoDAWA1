const { query } = require('../config/db');
const { paginacion } = require('../utils/http');

async function registrar({ usuarioId, entidad, entidadId, accion, antes, despues, ip }, client) {
  await query(
    `INSERT INTO auditoria (usuario_id, entidad, entidad_id, accion, datos_antes, datos_despues, ip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      usuarioId ?? null,
      entidad,
      entidadId != null ? String(entidadId) : null,
      accion,
      antes ? JSON.stringify(sinSecretos(antes)) : null,
      despues ? JSON.stringify(sinSecretos(despues)) : null,
      ip ?? null,
    ],
    client,
  );
}

function sinSecretos(obj) {
  const { password_hash: _h, password: _p, ...resto } = obj;
  return resto;
}

async function listar(filtros) {
  const { page, limit, offset } = paginacion(filtros);
  const cond = [];
  const params = [];
  if (filtros.entidad) {
    params.push(filtros.entidad);
    cond.push(`a.entidad = $${params.length}`);
  }
  if (filtros.usuario_id) {
    params.push(filtros.usuario_id);
    cond.push(`a.usuario_id = $${params.length}`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) AS n FROM auditoria a ${where}`, params)).rows[0].n;
  params.push(limit, offset);
  const { rows } = await query(
    `SELECT a.*, u.nombre AS usuario_nombre FROM auditoria a
       LEFT JOIN usuarios u ON u.id = a.usuario_id
       ${where} ORDER BY a.fecha DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total, page, limit };
}

module.exports = { registrar, listar };
