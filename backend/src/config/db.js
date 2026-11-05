/**
 * Capa de persistencia: pool de conexiones PostgreSQL y helper de transacciones.
 */
const { Pool, types } = require('pg');
const env = require('./env');

// COUNT(*) y BIGINT llegan como texto; los convertimos a número.
types.setTypeParser(20, (v) => parseInt(v, 10));
// NUMERIC -> número (promedios del dashboard)
types.setTypeParser(1700, (v) => parseFloat(v));

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

/** Ejecuta una consulta con el pool (o con un cliente de transacción si se pasa). */
function query(text, params, client) {
  return (client || pool).query(text, params);
}

/**
 * Ejecuta `fn` dentro de una transacción. Si `fn` lanza un error se hace ROLLBACK.
 * Garantiza la coherencia transaccional exigida por la regla de negocio 8.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
