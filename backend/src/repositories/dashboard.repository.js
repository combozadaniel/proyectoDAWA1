/**
 * Indicadores calculados directamente desde los datos persistidos.
 */
const { query } = require('../config/db');
const { ESTADOS_ABIERTOS, ESTADOS_ACTIVOS_TECNICO } = require('../domain/estados');

/** WHERE común sobre solicitudes (alias s) según filtros y alcance del rol. */
function filtros(f) {
  const cond = [];
  const params = [];
  const add = (sql, v) => {
    params.push(v);
    cond.push(sql.replaceAll('?', `$${params.length}`));
  };
  add('s.created_at >= ?::date', f.desde);
  add("s.created_at < (?::date + INTERVAL '1 day')", f.hasta);
  if (f.clienteId != null) add('s.cliente_id = ?', f.clienteId);
  if (f.tecnicoId != null) add('s.tecnico_id = ?', f.tecnicoId);
  if (f.categoria_id) add('s.categoria_id = ?', f.categoria_id);
  if (f.prioridad_id) add('s.prioridad_id = ?', f.prioridad_id);
  return { where: cond.join(' AND '), params };
}

async function resumen(f) {
  const { where, params } = filtros(f);
  const { rows } = await query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE e.codigo = ANY($${params.length + 1})) AS abiertas,
            COUNT(*) FILTER (WHERE e.codigo = 'RESUELTA') AS resueltas,
            COUNT(*) FILTER (WHERE e.codigo = 'CERRADA') AS cerradas,
            COUNT(*) FILTER (WHERE e.codigo = 'CANCELADA') AS canceladas
       FROM solicitudes s JOIN estados e ON e.id = s.estado_id
      WHERE ${where}`,
    [...params, ESTADOS_ABIERTOS],
  );
  return rows[0];
}

async function porEstado(f) {
  const { where, params } = filtros(f);
  const { rows } = await query(
    `SELECT e.codigo, e.nombre, COUNT(s.id) AS total
       FROM estados e
       LEFT JOIN solicitudes s ON s.estado_id = e.id AND ${where}
      GROUP BY e.id ORDER BY e.orden`,
    params,
  );
  return rows;
}

async function porPrioridad(f) {
  const { where, params } = filtros(f);
  const { rows } = await query(
    `SELECT p.codigo, p.nombre, COUNT(s.id) AS total
       FROM prioridades p
       LEFT JOIN solicitudes s ON s.prioridad_id = p.id AND ${where}
      GROUP BY p.id ORDER BY p.orden`,
    params,
  );
  return rows;
}

/** Carga por técnico: activas actuales (sin filtro de fechas) y resueltas en el periodo. */
async function cargaPorTecnico(f) {
  const { where, params } = filtros(f);
  const n = params.length;
  const condTecnico = f.tecnicoId != null ? `AND t.id = $${n + 2}` : '';
  const extra = f.tecnicoId != null ? [f.tecnicoId] : [];
  const { rows } = await query(
    `SELECT t.id, u.nombre, t.max_solicitudes_activas AS maximo, t.disponible,
            (SELECT COUNT(*) FROM solicitudes sa JOIN estados ea ON ea.id = sa.estado_id
              WHERE sa.tecnico_id = t.id AND ea.codigo = ANY($${n + 1})) AS activas,
            (SELECT COUNT(*) FROM solicitudes s
              WHERE s.tecnico_id = t.id AND s.fecha_resolucion IS NOT NULL AND ${where}) AS resueltas
       FROM tecnicos t JOIN usuarios u ON u.id = t.usuario_id
      WHERE t.activo ${condTecnico}
      ORDER BY activas DESC, u.nombre`,
    [...params, ESTADOS_ACTIVOS_TECNICO, ...extra],
  );
  return rows;
}

async function tiemposResolucion(f) {
  const { where, params } = filtros(f);
  const { rows } = await query(
    `SELECT p.codigo, p.nombre, p.horas_plazo,
            ROUND(AVG(EXTRACT(EPOCH FROM (s.fecha_resolucion - s.created_at)) / 3600)::numeric, 1) AS promedio_horas,
            COUNT(s.id) AS resueltas
       FROM prioridades p
       LEFT JOIN solicitudes s ON s.prioridad_id = p.id AND s.fecha_resolucion IS NOT NULL AND ${where}
      GROUP BY p.id ORDER BY p.orden`,
    params,
  );
  const global = await query(
    `SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s.fecha_resolucion - s.created_at)) / 3600)::numeric, 1) AS promedio_horas
       FROM solicitudes s WHERE s.fecha_resolucion IS NOT NULL AND ${where}`,
    params,
  );
  return { global: global.rows[0].promedio_horas, porPrioridad: rows };
}

async function cumplimiento(f) {
  const { where, params } = filtros(f);
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE s.fecha_resolucion <= s.fecha_limite) AS a_tiempo,
            COUNT(*) FILTER (WHERE s.fecha_resolucion > s.fecha_limite) AS fuera_de_plazo
       FROM solicitudes s WHERE s.fecha_resolucion IS NOT NULL AND ${where}`,
    params,
  );
  return rows[0];
}

/** Vencimientos de solicitudes abiertas (estado actual, sin filtro de fechas de registro). */
async function vencimientos(f, umbralPct) {
  const { where, params } = filtros({ ...f, desde: '1900-01-01', hasta: '2999-12-31' });
  const n = params.length;
  const { rows } = await query(
    `SELECT COUNT(*) FILTER (WHERE s.fecha_limite < NOW()) AS vencidas,
            COUNT(*) FILTER (WHERE s.fecha_limite >= NOW()
                               AND NOW() >= s.created_at + (s.fecha_limite - s.created_at) * $${n + 2}) AS por_vencer,
            COUNT(*) AS abiertas
       FROM solicitudes s JOIN estados e ON e.id = s.estado_id
      WHERE e.codigo = ANY($${n + 1}) AND ${where}`,
    [...params, ESTADOS_ABIERTOS, umbralPct / 100],
  );
  return rows[0];
}

async function evolucion(f) {
  const { where, params } = filtros(f);
  const n = params.length;
  const { rows } = await query(
    `WITH dias AS (
        SELECT generate_series($${n + 1}::date, $${n + 2}::date, INTERVAL '1 day')::date AS dia
     )
     SELECT TO_CHAR(d.dia, 'YYYY-MM-DD') AS fecha,
            (SELECT COUNT(*) FROM solicitudes s WHERE ${where} AND s.created_at::date = d.dia) AS creadas,
            (SELECT COUNT(*) FROM solicitudes s WHERE ${where} AND s.fecha_resolucion::date = d.dia) AS resueltas
       FROM dias d ORDER BY d.dia`,
    [...params, f.desde, f.hasta],
  );
  return rows;
}

module.exports = {
  resumen,
  porEstado,
  porPrioridad,
  cargaPorTecnico,
  tiemposResolucion,
  cumplimiento,
  vencimientos,
  evolucion,
};
