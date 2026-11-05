/**
 * Runner de migraciones SQL reproducibles.
 * Aplica en orden los archivos de db/migrations que aún no estén registrados
 * en la tabla schema_migrations. Uso:
 *   npm run migrate            -> aplica pendientes
 *   npm run migrate -- --reset -> borra el esquema public y aplica todo
 */
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db');

const DIR = path.resolve(__dirname, '../db/migrations');

async function migrate({ reset = false, silent = false } = {}) {
  const log = silent ? () => {} : console.log;
  const client = await pool.connect();
  try {
    if (reset) {
      log('⚠  Reiniciando esquema public...');
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    }
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre VARCHAR(255) PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW())`);

    const { rows } = await client.query('SELECT nombre FROM schema_migrations');
    const aplicadas = new Set(rows.map((r) => r.nombre));
    const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

    for (const archivo of archivos) {
      if (aplicadas.has(archivo)) continue;
      const sql = fs.readFileSync(path.join(DIR, archivo), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        log(`✔  ${archivo}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Error en migración ${archivo}: ${err.message}`);
      }
    }
    log('Migraciones al día.');
  } finally {
    client.release();
  }
}

module.exports = { migrate };

if (require.main === module) {
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => pool.end())
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
