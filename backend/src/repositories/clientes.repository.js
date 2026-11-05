const { query } = require('../config/db');
const { paginacion } = require('../utils/http');

const SELECT = `
  SELECT c.*, u.email AS usuario_email, u.activo AS usuario_activo,
         (SELECT COUNT(*) FROM solicitudes s WHERE s.cliente_id = c.id) AS total_solicitudes
    FROM clientes c
    LEFT JOIN usuarios u ON u.id = c.usuario_id`;

async function listar(filtros) {
  const { page, limit, offset } = paginacion(filtros);
  const cond = [];
  const params = [];
  if (filtros.q) {
    params.push(`%${filtros.q.toLowerCase()}%`);
    cond.push(`(LOWER(c.razon_social) LIKE $${params.length} OR c.identificacion LIKE $${params.length})`);
  }
  if (filtros.activo !== undefined) {
    params.push(filtros.activo);
    cond.push(`c.activo = $${params.length}`);
  }
  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
  const total = (await query(`SELECT COUNT(*) AS n FROM clientes c ${where}`, params)).rows[0].n;
  params.push(limit, offset);
  const { rows } = await query(
    `${SELECT} ${where} ORDER BY c.razon_social LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { rows, total, page, limit };
}

async function obtener(id, client) {
  const { rows } = await query(`${SELECT} WHERE c.id = $1`, [id], client);
  if (!rows[0]) return null;
  const sedes = await listarSedes(id, client);
  return { ...rows[0], sedes };
}

async function existeIdentificacion(identificacion, excluirId, client) {
  const { rowCount } = await query(
    'SELECT 1 FROM clientes WHERE identificacion = $1 AND ($2::int IS NULL OR id <> $2)',
    [identificacion, excluirId ?? null],
    client,
  );
  return rowCount > 0;
}

async function crear(datos, client) {
  const { rows } = await query(
    `INSERT INTO clientes (usuario_id, identificacion, razon_social, email, telefono, direccion)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [
      datos.usuario_id ?? null,
      datos.identificacion,
      datos.razon_social,
      datos.email,
      datos.telefono ?? null,
      datos.direccion ?? null,
    ],
    client,
  );
  return rows[0].id;
}

async function actualizar(id, datos, client) {
  await query(
    `UPDATE clientes SET
        identificacion = COALESCE($2, identificacion),
        razon_social = COALESCE($3, razon_social),
        email = COALESCE($4, email),
        telefono = COALESCE($5, telefono),
        direccion = COALESCE($6, direccion),
        activo = COALESCE($7, activo),
        updated_at = NOW()
      WHERE id = $1`,
    [
      id,
      datos.identificacion ?? null,
      datos.razon_social ?? null,
      datos.email ?? null,
      datos.telefono ?? null,
      datos.direccion ?? null,
      datos.activo ?? null,
    ],
    client,
  );
}

async function contarSolicitudes(id, client) {
  const { rows } = await query('SELECT COUNT(*) AS n FROM solicitudes WHERE cliente_id = $1', [id], client);
  return rows[0].n;
}

async function eliminar(id, client) {
  await query('DELETE FROM sedes WHERE cliente_id = $1', [id], client);
  await query('DELETE FROM clientes WHERE id = $1', [id], client);
}

// ---------- Sedes ----------
async function listarSedes(clienteId, client) {
  const { rows } = await query(
    'SELECT * FROM sedes WHERE cliente_id = $1 ORDER BY nombre',
    [clienteId],
    client,
  );
  return rows;
}

async function obtenerSede(id, client) {
  const { rows } = await query('SELECT * FROM sedes WHERE id = $1', [id], client);
  return rows[0] || null;
}

async function crearSede(clienteId, { nombre, direccion }, client) {
  const { rows } = await query(
    'INSERT INTO sedes (cliente_id, nombre, direccion) VALUES ($1, $2, $3) RETURNING *',
    [clienteId, nombre, direccion],
    client,
  );
  return rows[0];
}

async function actualizarSede(id, { nombre, direccion, activo }, client) {
  const { rows } = await query(
    `UPDATE sedes SET nombre = COALESCE($2, nombre), direccion = COALESCE($3, direccion),
            activo = COALESCE($4, activo)
      WHERE id = $1 RETURNING *`,
    [id, nombre ?? null, direccion ?? null, activo ?? null],
    client,
  );
  return rows[0] || null;
}

async function contarSolicitudesSede(id, client) {
  const { rows } = await query('SELECT COUNT(*) AS n FROM solicitudes WHERE sede_id = $1', [id], client);
  return rows[0].n;
}

async function eliminarSede(id, client) {
  await query('DELETE FROM sedes WHERE id = $1', [id], client);
}

module.exports = {
  listar,
  obtener,
  existeIdentificacion,
  crear,
  actualizar,
  contarSolicitudes,
  eliminar,
  listarSedes,
  obtenerSede,
  crearSede,
  actualizarSede,
  contarSolicitudesSede,
  eliminarSede,
};
