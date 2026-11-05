/**
 * Utilidades de pruebas de integración: reinicia la BD de pruebas con datos semilla
 * y obtiene tokens por rol.
 */
const request = require('supertest');
const app = require('../../src/app');
const { pool, query } = require('../../src/config/db');
const { migrate } = require('../../scripts/migrate');
const { seed, PASSWORD } = require('../../scripts/seed');

const USUARIOS = {
  ADMIN: 'admin@servigest.ec',
  COORDINADOR: 'coordinador@servigest.ec',
  TECNICO: 'tecnico@servigest.ec',
  CLIENTE: 'cliente@servigest.ec',
  CLIENTE2: 'cliente2@servigest.ec',
};

async function reiniciarBD() {
  if (!process.env.DATABASE_URL?.includes('test') && !require('../../src/config/env').isTest) {
    throw new Error('Las pruebas solo se ejecutan contra la base de pruebas');
  }
  const log = console.log;
  console.log = () => {};
  try {
    await migrate({ reset: true, silent: true });
    await seed();
  } finally {
    console.log = log;
  }
}

async function login(email, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`Login fallido para ${email}: ${res.status}`);
  return res.body.token;
}

async function tokensPorRol() {
  const tokens = {};
  for (const [rol, email] of Object.entries(USUARIOS)) tokens[rol] = await login(email);
  return tokens;
}

/** Datos de referencia del cliente principal y una categoría de hardware. */
async function referencias() {
  const cliente = (await query("SELECT c.id FROM clientes c JOIN usuarios u ON u.id = c.usuario_id WHERE u.email = $1", [USUARIOS.CLIENTE])).rows[0];
  const sede = (await query('SELECT id FROM sedes WHERE cliente_id = $1 ORDER BY id LIMIT 1', [cliente.id])).rows[0];
  const categoria = (await query("SELECT id, especialidad_id FROM categorias_servicio WHERE nombre = 'Reparación de equipo'")).rows[0];
  const prioridadAlta = (await query("SELECT id FROM prioridades WHERE codigo = 'ALTA'")).rows[0];
  const tecnicoHardware = (
    await query(
      `SELECT t.id, u.email FROM tecnicos t JOIN usuarios u ON u.id = t.usuario_id
        JOIN tecnico_especialidades te ON te.tecnico_id = t.id
       WHERE te.especialidad_id = $1 ORDER BY t.id LIMIT 1`,
      [categoria.especialidad_id],
    )
  ).rows[0];
  const tecnicoSinEspecialidad = (
    await query(
      `SELECT t.id FROM tecnicos t WHERE NOT EXISTS
        (SELECT 1 FROM tecnico_especialidades te WHERE te.tecnico_id = t.id AND te.especialidad_id = $1)
       ORDER BY t.id LIMIT 1`,
      [categoria.especialidad_id],
    )
  ).rows[0];
  // Libera capacidad del técnico de hardware para que las pruebas sean deterministas.
  await query('UPDATE tecnicos SET max_solicitudes_activas = 20, disponible = TRUE WHERE id = $1', [tecnicoHardware.id]);
  return { cliente, sede, categoria, prioridadAlta, tecnicoHardware, tecnicoSinEspecialidad };
}

function nuevaSolicitud(ref, extra = {}) {
  return {
    sede_id: ref.sede.id,
    categoria_id: ref.categoria.id,
    prioridad_id: ref.prioridadAlta.id,
    titulo: 'Impresora no imprime',
    descripcion: 'La impresora del área contable muestra error de fusor desde esta mañana.',
    equipo_afectado: 'HP LaserJet M404',
    ...extra,
  };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, request, pool, query, reiniciarBD, login, tokensPorRol, referencias, nuevaSolicitud, auth, USUARIOS, PASSWORD };
