const { query } = require('../config/db');

async function crearVarias(usuarioIds, { tipo, titulo, mensaje, solicitudId }, client) {
  if (!usuarioIds.length) return [];
  const { rows } = await query(
    `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id)
     SELECT u, $2, $3, $4, $5 FROM UNNEST($1::int[]) AS u
     RETURNING *`,
    [usuarioIds, tipo, titulo, mensaje, solicitudId ?? null],
    client,
  );
  return rows;
}

async function listar(usuarioId, { soloNoLeidas, limit, offset }) {
  const cond = soloNoLeidas ? 'AND NOT leida' : '';
  const total = (
    await query(`SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = $1 ${cond}`, [usuarioId])
  ).rows[0].n;
  const noLeidas = (
    await query('SELECT COUNT(*) AS n FROM notificaciones WHERE usuario_id = $1 AND NOT leida', [usuarioId])
  ).rows[0].n;
  const { rows } = await query(
    `SELECT n.*, s.codigo AS solicitud_codigo FROM notificaciones n
       LEFT JOIN solicitudes s ON s.id = n.solicitud_id
      WHERE n.usuario_id = $1 ${cond}
      ORDER BY n.created_at DESC LIMIT $2 OFFSET $3`,
    [usuarioId, limit, offset],
  );
  return { rows, total, noLeidas };
}

async function marcarLeida(id, usuarioId) {
  const { rowCount } = await query(
    'UPDATE notificaciones SET leida = TRUE WHERE id = $1 AND usuario_id = $2',
    [id, usuarioId],
  );
  return rowCount > 0;
}

async function marcarTodasLeidas(usuarioId) {
  const { rowCount } = await query(
    'UPDATE notificaciones SET leida = TRUE WHERE usuario_id = $1 AND NOT leida',
    [usuarioId],
  );
  return rowCount;
}

module.exports = { crearVarias, listar, marcarLeida, marcarTodasLeidas };
