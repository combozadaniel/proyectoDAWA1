const { query } = require('../config/db');
const { paginacion } = require('../utils/http');

const SELECT = `
  SELECT u.id, u.email, u.nombre, u.activo, u.ultimo_acceso, u.created_at, u.updated_at,
         r.codigo AS rol, c.id AS cliente_id, t.id AS tecnico_id
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    LEFT JOIN clientes c ON c.usuario_id = u.id
    LEFT JOIN tecnicos t ON t.usuario_id = u.id`;

async function listar(filtros) {
  const { page, limit, offset } = paginacion(filtros);
  const cond = [];
  const params = [];
  if (filtros.rol) {
    params.push(filtros.rol);
    cond.push(`r.codigo = $${params.length}`);
  }
  if (filtros.q) {
    params.push(`%${filtros.q.toLowerCase()}%`);
    cond.push(`(LOWER(u.nombre) LIKE $${params.length} OR u.email LIKE $${params.length})`);
  }
  if (filtros.activo !== undefined) {
    params.push(filtros.activo);
    cond.push(`u.activo = $${params.length}`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = (
    await query(`SELECT COUNT(*) AS n FROM usuarios u JOIN roles r ON r.id = u.rol_id ${where}`, params)
  ).rows[0].n;
  params.push(limit, offset);
  const { rows } = await query(
    `${SELECT} ${where} ORDER BY u.nombre LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total, page, limit };
}

async function obtener(id, client) {
  const { rows } = await query(`${SELECT} WHERE u.id = $1`, [id], client);
  return rows[0] || null;
}

async function existeEmail(email, excluirId, client) {
  const { rowCount } = await query(
    'SELECT 1 FROM usuarios WHERE email = $1 AND ($2::int IS NULL OR id <> $2)',
    [email, excluirId ?? null],
    client,
  );
  return rowCount > 0;
}

async function crear({ email, nombre, passwordHash, rol }, client) {
  const { rows } = await query(
    `INSERT INTO usuarios (email, nombre, password_hash, rol_id)
     VALUES ($1, $2, $3, (SELECT id FROM roles WHERE codigo = $4))
     RETURNING id`,
    [email, nombre, passwordHash, rol],
    client,
  );
  return obtener(rows[0].id, client);
}

async function actualizar(id, { email, nombre, activo }, client) {
  await query(
    `UPDATE usuarios SET email = COALESCE($2, email), nombre = COALESCE($3, nombre),
            activo = COALESCE($4, activo), updated_at = NOW()
      WHERE id = $1`,
    [id, email ?? null, nombre ?? null, activo ?? null],
    client,
  );
  return obtener(id, client);
}

async function idsPorRol(roles, client) {
  const { rows } = await query(
    `SELECT u.id FROM usuarios u JOIN roles r ON r.id = u.rol_id
      WHERE r.codigo = ANY($1) AND u.activo`,
    [roles],
    client,
  );
  return rows.map((r) => r.id);
}

module.exports = { listar, obtener, existeEmail, crear, actualizar, idsPorRol };
