const { query } = require('../config/db');

async function buscarPorEmail(email) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.nombre, u.password_hash, u.activo, r.codigo AS rol
       FROM usuarios u JOIN roles r ON r.id = u.rol_id
      WHERE u.email = $1`,
    [email],
  );
  return rows[0] || null;
}

/** Datos mínimos del usuario autenticado + su cliente/técnico asociado. */
async function buscarContextoUsuario(id) {
  const { rows } = await query(
    `SELECT u.id, u.email, u.nombre, u.activo, r.codigo AS rol,
            c.id AS cliente_id, t.id AS tecnico_id, t.disponible AS tecnico_disponible
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       LEFT JOIN clientes c ON c.usuario_id = u.id
       LEFT JOIN tecnicos t ON t.usuario_id = u.id
      WHERE u.id = $1`,
    [id],
  );
  return rows[0] || null;
}

async function buscarPasswordHash(id) {
  const { rows } = await query('SELECT password_hash FROM usuarios WHERE id = $1', [id]);
  return rows[0]?.password_hash || null;
}

async function registrarAcceso(id) {
  await query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = $1', [id]);
}

async function revocarToken(jti, usuarioId, expiraEn) {
  await query(
    `INSERT INTO tokens_revocados (jti, usuario_id, expira_en) VALUES ($1, $2, $3)
     ON CONFLICT (jti) DO NOTHING`,
    [jti, usuarioId, expiraEn],
  );
  // Limpieza oportunista de tokens ya expirados.
  await query('DELETE FROM tokens_revocados WHERE expira_en < NOW()');
}

async function tokenRevocado(jti) {
  const { rowCount } = await query('SELECT 1 FROM tokens_revocados WHERE jti = $1', [jti]);
  return rowCount > 0;
}

async function crearRestablecimiento(usuarioId, tokenHash, expiraEn) {
  await query(
    `UPDATE restablecimientos_password SET usado_en = NOW()
      WHERE usuario_id = $1 AND usado_en IS NULL`,
    [usuarioId],
  );
  await query(
    `INSERT INTO restablecimientos_password (usuario_id, token_hash, expira_en) VALUES ($1, $2, $3)`,
    [usuarioId, tokenHash, expiraEn],
  );
}

async function buscarRestablecimientoVigente(tokenHash, client) {
  const { rows } = await query(
    `SELECT id, usuario_id FROM restablecimientos_password
      WHERE token_hash = $1 AND usado_en IS NULL AND expira_en > NOW()
      FOR UPDATE`,
    [tokenHash],
    client,
  );
  return rows[0] || null;
}

async function marcarRestablecimientoUsado(id, client) {
  await query('UPDATE restablecimientos_password SET usado_en = NOW() WHERE id = $1', [id], client);
}

async function actualizarPassword(usuarioId, hash, client) {
  await query('UPDATE usuarios SET password_hash = $2, updated_at = NOW() WHERE id = $1', [usuarioId, hash], client);
}

module.exports = {
  buscarPorEmail,
  buscarContextoUsuario,
  buscarPasswordHash,
  registrarAcceso,
  revocarToken,
  tokenRevocado,
  crearRestablecimiento,
  buscarRestablecimientoVigente,
  marcarRestablecimientoUsado,
  actualizarPassword,
};
