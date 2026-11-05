const { query } = require('../config/db');

const SELECT = `
  SELECT s.id, s.codigo, s.titulo, s.descripcion, s.equipo_afectado, s.resolucion,
         s.cliente_id, cl.razon_social AS cliente_nombre,
         s.sede_id, se.nombre AS sede_nombre, se.direccion AS sede_direccion,
         s.categoria_id, ca.nombre AS categoria_nombre, ca.especialidad_id,
         s.prioridad_solicitada_id, ps.codigo AS prioridad_solicitada,
         s.prioridad_id, p.codigo AS prioridad, p.nombre AS prioridad_nombre, p.horas_plazo,
         e.codigo AS estado, e.nombre AS estado_nombre,
         s.tecnico_id, ut.nombre AS tecnico_nombre,
         s.fecha_limite, s.fecha_resolucion, s.fecha_cierre,
         s.creado_por, uc.nombre AS creado_por_nombre,
         s.version, s.created_at, s.updated_at
    FROM solicitudes s
    JOIN clientes cl ON cl.id = s.cliente_id
    JOIN sedes se ON se.id = s.sede_id
    JOIN categorias_servicio ca ON ca.id = s.categoria_id
    JOIN prioridades ps ON ps.id = s.prioridad_solicitada_id
    JOIN prioridades p ON p.id = s.prioridad_id
    JOIN estados e ON e.id = s.estado_id
    JOIN usuarios uc ON uc.id = s.creado_por
    LEFT JOIN tecnicos t ON t.id = s.tecnico_id
    LEFT JOIN usuarios ut ON ut.id = t.usuario_id`;

const ORDENES = {
  recientes: 's.created_at DESC',
  antiguas: 's.created_at ASC',
  vencimiento: 's.fecha_limite ASC',
  prioridad: 'p.orden DESC, s.created_at ASC',
};

/**
 * Construye el WHERE dinámico de listados. Todos los valores van como parámetros ($n)
 * para evitar inyección SQL.
 */
function construirFiltros(f, umbralPct) {
  const cond = [];
  const params = [];
  const add = (sql, valor) => {
    params.push(valor);
    cond.push(sql.replaceAll('?', `$${params.length}`));
  };

  if (f.clienteId != null) add('s.cliente_id = ?', f.clienteId);
  if (f.tecnicoId != null) add('s.tecnico_id = ?', f.tecnicoId);
  if (f.estado?.length) add('e.codigo = ANY(?)', f.estado);
  if (f.prioridad?.length) add('p.codigo = ANY(?)', f.prioridad);
  if (f.categoria_id) add('s.categoria_id = ?', f.categoria_id);
  if (f.sede_id) add('s.sede_id = ?', f.sede_id);
  if (f.desde) add('s.created_at >= ?', f.desde);
  if (f.hasta) add("s.created_at < (?::date + INTERVAL '1 day')", f.hasta);
  if (f.q) add('(LOWER(s.codigo) LIKE ? OR LOWER(s.titulo) LIKE ?)', `%${f.q.toLowerCase()}%`);

  const abiertos = `e.codigo IN ('REGISTRADA','APROBADA','ASIGNADA','EN_PROCESO','PENDIENTE_INFO')`;
  if (f.vencimiento === 'vencida') {
    cond.push(`${abiertos} AND s.fecha_limite < NOW()`);
  } else if (f.vencimiento === 'por_vencer') {
    params.push(umbralPct / 100);
    cond.push(
      `${abiertos} AND s.fecha_limite >= NOW()
       AND NOW() >= s.created_at + (s.fecha_limite - s.created_at) * $${params.length}`,
    );
  }
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

async function listar(filtros, { limit, offset }, umbralPct) {
  const { where, params } = construirFiltros(filtros, umbralPct);
  const base = `FROM solicitudes s JOIN estados e ON e.id = s.estado_id JOIN prioridades p ON p.id = s.prioridad_id`;
  const total = (await query(`SELECT COUNT(*) AS n ${base} ${where}`, params)).rows[0].n;
  const orden = ORDENES[filtros.orden] || ORDENES.recientes;
  const { rows } = await query(
    `${SELECT} ${where} ORDER BY ${orden} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { rows, total };
}

async function obtener(id, client) {
  const { rows } = await query(`${SELECT} WHERE s.id = $1`, [id], client);
  return rows[0] || null;
}

/** Bloquea la fila (SELECT ... FOR UPDATE) para cambios concurrentes coherentes. */
async function obtenerParaActualizar(id, client) {
  await query('SELECT id FROM solicitudes WHERE id = $1 FOR UPDATE', [id], client);
  return obtener(id, client);
}

async function siguienteCodigo(client) {
  const { rows } = await query(
    `SELECT 'SOL-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('solicitudes_codigo_seq')::text, 6, '0') AS codigo`,
    [],
    client,
  );
  return rows[0].codigo;
}

async function crear(d, client) {
  const { rows } = await query(
    `INSERT INTO solicitudes (codigo, cliente_id, sede_id, categoria_id, prioridad_solicitada_id, prioridad_id,
                              estado_id, titulo, descripcion, equipo_afectado, fecha_limite, creado_por, created_at)
     VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
    [
      d.codigo,
      d.cliente_id,
      d.sede_id,
      d.categoria_id,
      d.prioridad_id,
      d.estado_id,
      d.titulo,
      d.descripcion,
      d.equipo_afectado,
      d.fecha_limite,
      d.creado_por,
      d.created_at,
    ],
    client,
  );
  return rows[0].id;
}

/** Actualiza campos de la solicitud e incrementa su versión. */
async function actualizarCampos(id, campos, client) {
  const sets = [];
  const params = [id];
  for (const [col, valor] of Object.entries(campos)) {
    params.push(valor);
    sets.push(`${col} = $${params.length}`);
  }
  sets.push('version = version + 1', 'updated_at = NOW()');
  await query(`UPDATE solicitudes SET ${sets.join(', ')} WHERE id = $1`, params, client);
}

// ---------- Historial (solo INSERT y SELECT: la tabla es inalterable) ----------
async function registrarHistorial(h, client) {
  await query(
    `INSERT INTO historial_solicitudes
       (solicitud_id, usuario_id, accion, estado_anterior_id, estado_nuevo_id, comentario, detalle)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      h.solicitudId,
      h.usuarioId,
      h.accion,
      h.estadoAnteriorId ?? null,
      h.estadoNuevoId ?? null,
      h.comentario ?? null,
      h.detalle ? JSON.stringify(h.detalle) : null,
    ],
    client,
  );
}

async function listarHistorial(solicitudId) {
  const { rows } = await query(
    `SELECT h.id, h.accion, h.comentario, h.detalle, h.fecha,
            h.usuario_id, u.nombre AS usuario_nombre, r.codigo AS usuario_rol,
            ea.codigo AS estado_anterior, en.codigo AS estado_nuevo
       FROM historial_solicitudes h
       JOIN usuarios u ON u.id = h.usuario_id
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN estados ea ON ea.id = h.estado_anterior_id
       LEFT JOIN estados en ON en.id = h.estado_nuevo_id
      WHERE h.solicitud_id = $1
      ORDER BY h.fecha ASC, h.id ASC`,
    [solicitudId],
  );
  return rows;
}

// ---------- Asignaciones ----------
async function cerrarAsignacionActiva(solicitudId, client) {
  const { rows } = await query(
    `UPDATE asignaciones SET activa = FALSE, fecha_fin = NOW()
      WHERE solicitud_id = $1 AND activa RETURNING tecnico_id`,
    [solicitudId],
    client,
  );
  return rows[0] || null;
}

async function crearAsignacion({ solicitudId, tecnicoId, asignadoPor, motivo }, client) {
  const { rows } = await query(
    `INSERT INTO asignaciones (solicitud_id, tecnico_id, asignado_por, motivo)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [solicitudId, tecnicoId, asignadoPor, motivo ?? null],
    client,
  );
  return rows[0];
}

async function listarAsignaciones(solicitudId) {
  const { rows } = await query(
    `SELECT a.*, ut.nombre AS tecnico_nombre, ua.nombre AS asignado_por_nombre
       FROM asignaciones a
       JOIN tecnicos t ON t.id = a.tecnico_id
       JOIN usuarios ut ON ut.id = t.usuario_id
       JOIN usuarios ua ON ua.id = a.asignado_por
      WHERE a.solicitud_id = $1
      ORDER BY a.fecha_asignacion DESC`,
    [solicitudId],
  );
  return rows;
}

// ---------- Adjuntos ----------
async function crearAdjunto(a, client) {
  const { rows } = await query(
    `INSERT INTO adjuntos (solicitud_id, nombre_original, nombre_archivo, mime_type, tamano_bytes, subido_por)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre_original, mime_type, tamano_bytes, created_at`,
    [a.solicitudId, a.nombreOriginal, a.nombreArchivo, a.mimeType, a.tamano, a.subidoPor],
    client,
  );
  return rows[0];
}

async function listarAdjuntos(solicitudId) {
  const { rows } = await query(
    `SELECT a.id, a.nombre_original, a.mime_type, a.tamano_bytes, a.created_at, u.nombre AS subido_por_nombre
       FROM adjuntos a JOIN usuarios u ON u.id = a.subido_por
      WHERE a.solicitud_id = $1 ORDER BY a.created_at`,
    [solicitudId],
  );
  return rows;
}

async function obtenerAdjunto(solicitudId, adjuntoId) {
  const { rows } = await query('SELECT * FROM adjuntos WHERE id = $1 AND solicitud_id = $2', [
    adjuntoId,
    solicitudId,
  ]);
  return rows[0] || null;
}

module.exports = {
  listar,
  obtener,
  obtenerParaActualizar,
  siguienteCodigo,
  crear,
  actualizarCampos,
  registrarHistorial,
  listarHistorial,
  cerrarAsignacionActiva,
  crearAsignacion,
  listarAsignaciones,
  crearAdjunto,
  listarAdjuntos,
  obtenerAdjunto,
};
