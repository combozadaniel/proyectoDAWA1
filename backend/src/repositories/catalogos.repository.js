/**
 * Catálogos: especialidades, categorías de servicio, prioridades, estados y parámetros operativos.
 */
const { query } = require('../config/db');

// ---------- Especialidades ----------
async function listarEspecialidades({ soloActivas } = {}) {
  const { rows } = await query(
    `SELECT e.*, (SELECT COUNT(*) FROM tecnico_especialidades te WHERE te.especialidad_id = e.id) AS total_tecnicos
       FROM especialidades e
      ${soloActivas ? 'WHERE e.activo' : ''}
      ORDER BY e.nombre`,
  );
  return rows;
}

async function obtenerEspecialidad(id, client) {
  const { rows } = await query('SELECT * FROM especialidades WHERE id = $1', [id], client);
  return rows[0] || null;
}

async function crearEspecialidad({ nombre, descripcion }, client) {
  const { rows } = await query(
    'INSERT INTO especialidades (nombre, descripcion) VALUES ($1, $2) RETURNING *',
    [nombre, descripcion ?? null],
    client,
  );
  return rows[0];
}

async function actualizarEspecialidad(id, { nombre, descripcion, activo }, client) {
  const { rows } = await query(
    `UPDATE especialidades SET
        nombre = COALESCE($2, nombre),
        descripcion = COALESCE($3, descripcion),
        activo = COALESCE($4, activo),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, nombre ?? null, descripcion ?? null, activo ?? null],
    client,
  );
  return rows[0] || null;
}

async function usoEspecialidad(id, client) {
  const { rows } = await query(
    `SELECT
        (SELECT COUNT(*) FROM categorias_servicio WHERE especialidad_id = $1) AS categorias,
        (SELECT COUNT(*) FROM tecnico_especialidades WHERE especialidad_id = $1) AS tecnicos`,
    [id],
    client,
  );
  return rows[0];
}

async function eliminarEspecialidad(id, client) {
  await query('DELETE FROM especialidades WHERE id = $1', [id], client);
}

// ---------- Categorías ----------
async function listarCategorias({ soloActivas } = {}) {
  const { rows } = await query(
    `SELECT c.*, e.nombre AS especialidad_nombre
       FROM categorias_servicio c JOIN especialidades e ON e.id = c.especialidad_id
      ${soloActivas ? 'WHERE c.activo' : ''}
      ORDER BY c.nombre`,
  );
  return rows;
}

async function obtenerCategoria(id, client) {
  const { rows } = await query('SELECT * FROM categorias_servicio WHERE id = $1', [id], client);
  return rows[0] || null;
}

async function crearCategoria({ nombre, descripcion, especialidad_id }, client) {
  const { rows } = await query(
    `INSERT INTO categorias_servicio (nombre, descripcion, especialidad_id) VALUES ($1, $2, $3) RETURNING *`,
    [nombre, descripcion ?? null, especialidad_id],
    client,
  );
  return rows[0];
}

async function actualizarCategoria(id, { nombre, descripcion, especialidad_id, activo }, client) {
  const { rows } = await query(
    `UPDATE categorias_servicio SET
        nombre = COALESCE($2, nombre),
        descripcion = COALESCE($3, descripcion),
        especialidad_id = COALESCE($4, especialidad_id),
        activo = COALESCE($5, activo),
        updated_at = NOW()
      WHERE id = $1 RETURNING *`,
    [id, nombre ?? null, descripcion ?? null, especialidad_id ?? null, activo ?? null],
    client,
  );
  return rows[0] || null;
}

async function usoCategoria(id, client) {
  const { rows } = await query('SELECT COUNT(*) AS solicitudes FROM solicitudes WHERE categoria_id = $1', [id], client);
  return rows[0];
}

async function eliminarCategoria(id, client) {
  await query('DELETE FROM categorias_servicio WHERE id = $1', [id], client);
}

// ---------- Prioridades / estados ----------
async function listarPrioridades() {
  const { rows } = await query('SELECT * FROM prioridades ORDER BY orden');
  return rows;
}

async function obtenerPrioridad(id, client) {
  const { rows } = await query('SELECT * FROM prioridades WHERE id = $1', [id], client);
  return rows[0] || null;
}

async function actualizarPrioridad(id, { nombre, horas_plazo }, client) {
  const { rows } = await query(
    `UPDATE prioridades SET nombre = COALESCE($2, nombre), horas_plazo = COALESCE($3, horas_plazo)
      WHERE id = $1 RETURNING *`,
    [id, nombre ?? null, horas_plazo ?? null],
    client,
  );
  return rows[0] || null;
}

async function listarEstados() {
  const { rows } = await query('SELECT * FROM estados ORDER BY orden');
  return rows;
}

async function obtenerEstadoPorCodigo(codigo, client) {
  const { rows } = await query('SELECT * FROM estados WHERE codigo = $1', [codigo], client);
  return rows[0] || null;
}

// ---------- Parámetros ----------
async function listarParametros() {
  const { rows } = await query('SELECT * FROM parametros ORDER BY clave');
  return rows;
}

async function obtenerParametro(clave, porDefecto, client) {
  const { rows } = await query('SELECT valor FROM parametros WHERE clave = $1', [clave], client);
  return rows[0]?.valor ?? porDefecto;
}

async function actualizarParametro(clave, valor, client) {
  const { rows } = await query(
    'UPDATE parametros SET valor = $2, updated_at = NOW() WHERE clave = $1 RETURNING *',
    [clave, valor],
    client,
  );
  return rows[0] || null;
}

module.exports = {
  listarEspecialidades,
  obtenerEspecialidad,
  crearEspecialidad,
  actualizarEspecialidad,
  usoEspecialidad,
  eliminarEspecialidad,
  listarCategorias,
  obtenerCategoria,
  crearCategoria,
  actualizarCategoria,
  usoCategoria,
  eliminarCategoria,
  listarPrioridades,
  obtenerPrioridad,
  actualizarPrioridad,
  listarEstados,
  obtenerEstadoPorCodigo,
  listarParametros,
  obtenerParametro,
  actualizarParametro,
};
