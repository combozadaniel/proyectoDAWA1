const { query } = require('../config/db');
const { paginacion } = require('../utils/http');
const { ESTADOS_ACTIVOS_TECNICO } = require('../domain/estados');

/** Carga actual = solicitudes en estados activos asignadas al técnico. */
const SELECT = `
  SELECT t.*, u.nombre, u.email, u.activo AS usuario_activo,
         COALESCE((
           SELECT COUNT(*) FROM solicitudes s JOIN estados e ON e.id = s.estado_id
            WHERE s.tecnico_id = t.id AND e.codigo = ANY($1)
         ), 0)::int AS carga_actual,
         COALESCE((
           SELECT json_agg(json_build_object('id', es.id, 'nombre', es.nombre) ORDER BY es.nombre)
             FROM tecnico_especialidades te JOIN especialidades es ON es.id = te.especialidad_id
            WHERE te.tecnico_id = t.id
         ), '[]'::json) AS especialidades
    FROM tecnicos t
    JOIN usuarios u ON u.id = t.usuario_id`;

async function listar(filtros) {
  const { page, limit, offset } = paginacion(filtros);
  const params = [ESTADOS_ACTIVOS_TECNICO];
  const cond = [];
  if (filtros.q) {
    params.push(`%${filtros.q.toLowerCase()}%`);
    cond.push(`(LOWER(u.nombre) LIKE $${params.length} OR t.cedula LIKE $${params.length})`);
  }
  if (filtros.especialidad_id) {
    params.push(filtros.especialidad_id);
    cond.push(
      `EXISTS (SELECT 1 FROM tecnico_especialidades te WHERE te.tecnico_id = t.id AND te.especialidad_id = $${params.length})`,
    );
  }
  if (filtros.disponible !== undefined) {
    params.push(filtros.disponible);
    cond.push(`t.disponible = $${params.length}`);
  }
  if (filtros.activo !== undefined) {
    params.push(filtros.activo);
    cond.push(`t.activo = $${params.length}`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const countParams = params.slice(1);
  const whereCount = where.replace(/\$(\d+)/g, (_m, n) => `$${Number(n) - 1}`);
  const total = (
    await query(`SELECT COUNT(*) AS n FROM tecnicos t JOIN usuarios u ON u.id = t.usuario_id ${whereCount}`, countParams)
  ).rows[0].n;
  params.push(limit, offset);
  const { rows } = await query(
    `${SELECT} ${where} ORDER BY u.nombre LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total, page, limit };
}

async function obtener(id, client) {
  const { rows } = await query(`${SELECT} WHERE t.id = $2`, [ESTADOS_ACTIVOS_TECNICO, id], client);
  return rows[0] || null;
}

/** Bloquea la fila del técnico (evita sobreasignación concurrente) y devuelve sus datos con carga. */
async function obtenerParaAsignar(id, client) {
  await query('SELECT id FROM tecnicos WHERE id = $1 FOR UPDATE', [id], client);
  return obtener(id, client);
}

/** Técnicos activos con la especialidad indicada (para sugerir candidatos). */
async function listarPorEspecialidad(especialidadId) {
  const { rows } = await query(
    `${SELECT}
      WHERE t.activo AND u.activo
        AND EXISTS (SELECT 1 FROM tecnico_especialidades te WHERE te.tecnico_id = t.id AND te.especialidad_id = $2)
      ORDER BY u.nombre`,
    [ESTADOS_ACTIVOS_TECNICO, especialidadId],
  );
  return rows;
}

async function existeCedula(cedula, excluirId, client) {
  const { rowCount } = await query(
    'SELECT 1 FROM tecnicos WHERE cedula = $1 AND ($2::int IS NULL OR id <> $2)',
    [cedula, excluirId ?? null],
    client,
  );
  return rowCount > 0;
}

async function crear({ usuario_id, cedula, telefono, max_solicitudes_activas }, client) {
  const { rows } = await query(
    `INSERT INTO tecnicos (usuario_id, cedula, telefono, max_solicitudes_activas)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [usuario_id, cedula, telefono ?? null, max_solicitudes_activas],
    client,
  );
  return rows[0].id;
}

async function actualizar(id, datos, client) {
  await query(
    `UPDATE tecnicos SET
        cedula = COALESCE($2, cedula),
        telefono = COALESCE($3, telefono),
        disponible = COALESCE($4, disponible),
        max_solicitudes_activas = COALESCE($5, max_solicitudes_activas),
        activo = COALESCE($6, activo),
        updated_at = NOW()
      WHERE id = $1`,
    [
      id,
      datos.cedula ?? null,
      datos.telefono ?? null,
      datos.disponible ?? null,
      datos.max_solicitudes_activas ?? null,
      datos.activo ?? null,
    ],
    client,
  );
}

async function reemplazarEspecialidades(id, especialidadIds, client) {
  await query('DELETE FROM tecnico_especialidades WHERE tecnico_id = $1', [id], client);
  for (const espId of especialidadIds) {
    await query(
      'INSERT INTO tecnico_especialidades (tecnico_id, especialidad_id) VALUES ($1, $2)',
      [id, espId],
      client,
    );
  }
}

async function contarAsignaciones(id, client) {
  const { rows } = await query(
    `SELECT (SELECT COUNT(*) FROM asignaciones WHERE tecnico_id = $1) +
            (SELECT COUNT(*) FROM solicitudes WHERE tecnico_id = $1) AS n`,
    [id],
    client,
  );
  return rows[0].n;
}

async function eliminar(id, client) {
  const { rows } = await query('DELETE FROM tecnicos WHERE id = $1 RETURNING usuario_id', [id], client);
  return rows[0]?.usuario_id;
}

module.exports = {
  listar,
  obtener,
  obtenerParaAsignar,
  listarPorEspecialidad,
  existeCedula,
  crear,
  actualizar,
  reemplazarEspecialidades,
  contarAsignaciones,
  eliminar,
};
