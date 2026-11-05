/**
 * Datos de prueba representativos y reproducibles (generador pseudoaleatorio con semilla fija).
 * Simula el ciclo de vida real de ~70 solicitudes de los últimos 45 días respetando
 * las reglas de negocio (especialidad, carga máxima, historial de cada transición).
 *
 * Uso: npm run seed   (requiere haber ejecutado npm run migrate)
 * Contraseña de todos los usuarios de prueba: Servigest2026
 */
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('../src/config/db');
const env = require('../src/config/env');

const PASSWORD = 'Servigest2026';
const HORA = 3600 * 1000;

// ---------- Generador determinista ----------
let semilla = 20260405;
function rnd() {
  semilla = (semilla * 1103515245 + 12345) % 2147483648;
  return semilla / 2147483648;
}
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];

/** Genera una cédula ecuatoriana válida (provincia 09 - Guayas). */
function cedula() {
  const base = `09${String(entre(0, 9999999)).padStart(7, '0')}`.slice(0, 9);
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const suma = coef.reduce((acc, k, i) => {
    let v = Number(base[i]) * k;
    if (v > 9) v -= 9;
    return acc + v;
  }, 0);
  return base + ((10 - (suma % 10)) % 10);
}

// ---------- Datos maestros ----------
const ESPECIALIDADES = [
  ['Redes y conectividad', 'Cableado estructurado, switches, routers y WiFi'],
  ['Electricidad', 'Instalaciones eléctricas, tableros y UPS'],
  ['Climatización', 'Aire acondicionado y ventilación'],
  ['Soporte de hardware', 'Computadores, impresoras y periféricos'],
  ['Sistemas y software', 'Sistemas operativos, aplicaciones y respaldos'],
];

const CATEGORIAS = [
  ['Falla de red', 'Pérdida de conectividad o lentitud', 0],
  ['Instalación de punto de red', 'Nuevos puntos de red o WiFi', 0],
  ['Falla eléctrica', 'Cortes, breakers o tomas sin energía', 1],
  ['Mantenimiento de UPS', 'Revisión y cambio de baterías', 1],
  ['Aire acondicionado', 'Reparación o mantenimiento de A/C', 2],
  ['Reparación de equipo', 'Computadores o impresoras con fallas', 3],
  ['Mantenimiento preventivo', 'Limpieza y revisión periódica de equipos', 3],
  ['Soporte de software', 'Errores de aplicaciones o sistema operativo', 4],
];

const CLIENTES = [
  ['Comercial El Puerto S.A.', 'contacto@elpuerto.ec', [['Matriz Centro', 'Av. 9 de Octubre 1204'], ['Bodega Norte', 'Km 7.5 vía a Daule']]],
  ['Clínica Santa Lucía', 'sistemas@santalucia.ec', [['Edificio principal', 'Av. del Bombero km 6.5'], ['Laboratorio', 'Cdla. Kennedy Norte, Mz 109']]],
  ['Colegio Bilingüe Las Orquídeas', 'admin@orquideas.edu.ec', [['Campus Samborondón', 'Km 2.5 vía Samborondón']]],
  ['Logística Andina Cía. Ltda.', 'ti@logandina.ec', [['Centro de distribución', 'Parque Industrial Inmaconsa'], ['Oficina Urdesa', 'Víctor Emilio Estrada 520']]],
  ['Banco Cooperativo Guayas', 'soporte@bancoguayas.ec', [['Agencia Malecón', 'Malecón Simón Bolívar 300'], ['Agencia Alborada', 'Av. Rodolfo Baquerizo, Alborada 6ta etapa'], ['Agencia Sur', 'Av. 25 de Julio, Mall del Sur']]],
];

const TECNICOS = [
  ['Carlos Mendoza', [0, 4], 5],
  ['Andrea Villacís', [0], 4],
  ['Luis Paredes', [1], 5],
  ['María José Torres', [1, 2], 4],
  ['Jorge Alvarado', [2], 3],
  ['Diana Cedeño', [3, 4], 6],
  ['Fernando Rizzo', [3], 5],
];

const PROBLEMAS = {
  0: [['Sin internet en el área de ventas', 'Switch piso 2'], ['WiFi intermitente en sala de reuniones', 'Access point AP-03'], ['Lentitud general de la red', 'Router principal']],
  1: [['Nuevo punto de red para recepción', 'Rack de comunicaciones'], ['Ampliar cobertura WiFi a bodega', 'Access point nuevo']],
  2: [['Breaker se dispara constantemente', 'Tablero eléctrico TD-1'], ['Tomas sin energía en oficina contable', 'Circuito C-12']],
  3: [['UPS emite alarma de batería', 'UPS APC 3kVA'], ['Mantenimiento semestral de UPS', 'UPS servidor']],
  4: [['A/C no enfría en sala de servidores', 'Split 24000 BTU'], ['Goteo de agua en equipo de A/C', 'Split 18000 BTU oficina']],
  5: [['Computador no enciende', 'PC Dell OptiPlex 7090'], ['Impresora atasca papel', 'HP LaserJet M404'], ['Pantalla con líneas', 'Monitor LG 24"']],
  6: [['Mantenimiento preventivo de equipos de oficina', '15 computadores'], ['Limpieza de impresoras', '4 impresoras']],
  7: [['Error al abrir sistema contable', 'PC contabilidad'], ['Correo no sincroniza', 'Outlook gerencia'], ['Actualización de antivirus fallida', 'Servidor de archivos']],
};

const RESOLUCIONES = [
  'Se reemplazó el componente defectuoso y se verificó el funcionamiento correcto con el usuario.',
  'Se reconfiguró el equipo, se actualizaron controladores y se realizaron pruebas satisfactorias.',
  'Se realizó mantenimiento completo, limpieza y ajuste de conexiones. El equipo opera con normalidad.',
  'Se identificó un cable dañado, se reemplazó y se certificó el punto de red.',
  'Se restableció el servicio y se documentó la causa raíz para prevención.',
];

async function seed() {
  const hash = await bcrypt.hash(PASSWORD, env.BCRYPT_ROUNDS);
  const ahora = Date.now();

  await withTransaction(async (c) => {
    const q = (sql, p) => c.query(sql, p);
    const yaSembrado = (await q("SELECT 1 FROM usuarios WHERE email = 'admin@servigest.ec'")).rowCount;
    if (yaSembrado) {
      console.log('La base ya contiene datos de prueba. Use npm run db:reset para regenerarlos.');
      return;
    }

    const rol = async (codigo) => (await q('SELECT id FROM roles WHERE codigo = $1', [codigo])).rows[0].id;
    const estados = Object.fromEntries((await q('SELECT codigo, id FROM estados')).rows.map((r) => [r.codigo, r.id]));
    const prioridades = (await q('SELECT * FROM prioridades ORDER BY orden')).rows;

    const crearUsuario = async (email, nombre, codigoRol) =>
      (
        await q(
          'INSERT INTO usuarios (email, nombre, password_hash, rol_id, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [email, nombre, hash, await rol(codigoRol), new Date(ahora - 60 * 24 * HORA)],
        )
      ).rows[0].id;

    // Usuarios de gestión
    await crearUsuario('admin@servigest.ec', 'Administrador General', 'ADMIN');
    const coordinadores = [
      await crearUsuario('coordinador@servigest.ec', 'Patricia Salazar', 'COORDINADOR'),
      await crearUsuario('coordinador2@servigest.ec', 'Ricardo Gómez', 'COORDINADOR'),
    ];

    // Especialidades y categorías
    const espIds = [];
    for (const [nombre, desc] of ESPECIALIDADES) {
      espIds.push((await q('INSERT INTO especialidades (nombre, descripcion) VALUES ($1, $2) RETURNING id', [nombre, desc])).rows[0].id);
    }
    const categorias = [];
    for (const [nombre, desc, esp] of CATEGORIAS) {
      const id = (
        await q('INSERT INTO categorias_servicio (nombre, descripcion, especialidad_id) VALUES ($1, $2, $3) RETURNING id', [nombre, desc, espIds[esp]])
      ).rows[0].id;
      categorias.push({ id, especialidad: espIds[esp] });
    }

    // Técnicos
    const tecnicos = [];
    for (let i = 0; i < TECNICOS.length; i++) {
      const [nombre, esps, max] = TECNICOS[i];
      const email = i === 0 ? 'tecnico@servigest.ec' : `tecnico${i + 1}@servigest.ec`;
      const usuarioId = await crearUsuario(email, nombre, 'TECNICO');
      const id = (
        await q(
          'INSERT INTO tecnicos (usuario_id, cedula, telefono, max_solicitudes_activas) VALUES ($1, $2, $3, $4) RETURNING id',
          [usuarioId, cedula(), `09${entre(80000000, 99999999)}`, max],
        )
      ).rows[0].id;
      for (const e of esps) await q('INSERT INTO tecnico_especialidades VALUES ($1, $2)', [id, espIds[e]]);
      tecnicos.push({ id, usuarioId, especialidades: esps.map((e) => espIds[e]), max, activas: 0 });
    }

    // Clientes con cuenta y sedes
    const clientes = [];
    for (let i = 0; i < CLIENTES.length; i++) {
      const [razon, email, sedes] = CLIENTES[i];
      const loginEmail = i === 0 ? 'cliente@servigest.ec' : `cliente${i + 1}@servigest.ec`;
      const usuarioId = await crearUsuario(loginEmail, razon, 'CLIENTE');
      const id = (
        await q(
          `INSERT INTO clientes (usuario_id, identificacion, razon_social, email, telefono, direccion)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [usuarioId, `${cedula()}001`, razon, email, `04${entre(2000000, 2999999)}`, sedes[0][1]],
        )
      ).rows[0].id;
      const sedeIds = [];
      for (const [n, d] of sedes) {
        sedeIds.push((await q('INSERT INTO sedes (cliente_id, nombre, direccion) VALUES ($1, $2, $3) RETURNING id', [id, n, d])).rows[0].id);
      }
      clientes.push({ id, usuarioId, sedeIds });
    }

    // ---------- Solicitudes con ciclo de vida simulado ----------
    const TOTAL = 70;
    const creaciones = Array.from({ length: TOTAL }, () => ahora - entre(1, 45 * 24) * HORA).sort((a, b) => a - b);

    for (let n = 0; n < TOTAL; n++) {
      const creada = creaciones[n];
      const cliente = elegir(clientes);
      const catIdx = entre(0, categorias.length - 1);
      const categoria = categorias[catIdx];
      const prioridad = elegir([prioridades[0], prioridades[1], prioridades[1], prioridades[2], prioridades[2], prioridades[3]]);
      const [titulo, equipo] = elegir(PROBLEMAS[catIdx]);
      const limite = creada + prioridad.horas_plazo * HORA;
      const codigo = `SOL-${new Date(creada).getFullYear()}-${String(n + 1).padStart(6, '0')}`;
      await q("SELECT setval('solicitudes_codigo_seq', $1)", [n + 1]);

      const id = (
        await q(
          `INSERT INTO solicitudes (codigo, cliente_id, sede_id, categoria_id, prioridad_solicitada_id, prioridad_id,
             estado_id, titulo, descripcion, equipo_afectado, fecha_limite, creado_por, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,$10,$11,$12,$12) RETURNING id`,
          [
            codigo, cliente.id, elegir(cliente.sedeIds), categoria.id, prioridad.id, estados.REGISTRADA,
            titulo, `${titulo}. Reportado por el personal de la sede; se requiere revisión técnica en sitio.`,
            equipo, new Date(limite), cliente.usuarioId, new Date(creada),
          ],
        )
      ).rows[0].id;

      const hist = (usuario, accion, de, a, fecha, comentario, detalle) =>
        q(
          `INSERT INTO historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior_id, estado_nuevo_id, comentario, detalle, fecha)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id, usuario, accion, de ? estados[de] : null, a ? estados[a] : null, comentario ?? null, detalle ? JSON.stringify(detalle) : null, new Date(fecha)],
        );
      await hist(cliente.usuarioId, 'CREACION', null, 'REGISTRADA', creada, null, { prioridad_solicitada: prioridad.codigo });

      // Las solicitudes más recientes tienden a quedar en estados tempranos.
      const edadHoras = (ahora - creada) / HORA;
      let t = creada;
      let estado = 'REGISTRADA';
      const campos = {};
      const avanzar = (horas) => {
        const siguiente = t + horas * HORA;
        if (siguiente >= ahora) return false;
        t = siguiente;
        return true;
      };
      const coord = elegir(coordinadores);

      if (rnd() < 0.07 && avanzar(entre(1, 6))) {
        await hist(cliente.usuarioId, 'CAMBIO_ESTADO', estado, 'CANCELADA', t, 'El cliente resolvió el problema por su cuenta.');
        estado = 'CANCELADA';
      } else if (edadHoras > 3 && rnd() < 0.95 && avanzar(entre(1, 3))) {
        await hist(coord, 'CAMBIO_ESTADO', estado, 'APROBADA', t, null);
        estado = 'APROBADA';

        const candidatos = tecnicos
          .filter((x) => x.especialidades.includes(categoria.especialidad) && x.activas < x.max)
          .sort((a, b) => a.activas / a.max - b.activas / b.max);
        if (candidatos.length && edadHoras > 6 && avanzar(entre(1, 4))) {
          const tec = candidatos[0];
          await q('INSERT INTO asignaciones (solicitud_id, tecnico_id, asignado_por, fecha_asignacion) VALUES ($1,$2,$3,$4)', [id, tec.id, coord, new Date(t)]);
          await hist(coord, 'ASIGNACION', estado, 'ASIGNADA', t, null, { tecnico: { id: tec.id } });
          estado = 'ASIGNADA';
          campos.tecnico_id = tec.id;
          tec.activas++;

          if (avanzar(entre(1, 8))) {
            await hist(tec.usuarioId, 'CAMBIO_ESTADO', estado, 'EN_PROCESO', t, null);
            estado = 'EN_PROCESO';

            if (rnd() < 0.2 && avanzar(entre(1, 5))) {
              await hist(tec.usuarioId, 'CAMBIO_ESTADO', estado, 'PENDIENTE_INFO', t, 'Por favor confirme el horario de acceso a la sede.');
              estado = 'PENDIENTE_INFO';
              if (avanzar(entre(2, 12))) {
                await hist(cliente.usuarioId, 'COMENTARIO', null, null, t, 'Pueden acudir de 08:00 a 17:00, preguntar por seguridad.');
                await hist(tec.usuarioId, 'CAMBIO_ESTADO', estado, 'EN_PROCESO', t, null);
                estado = 'EN_PROCESO';
              }
            }

            // Duración de atención: ~75 % dentro del plazo.
            const factor = rnd() < 0.75 ? 0.2 + rnd() * 0.6 : 1.05 + rnd() * 0.8;
            const objetivo = creada + prioridad.horas_plazo * factor * HORA;
            if (estado === 'EN_PROCESO' && objetivo > t && objetivo < ahora) {
              t = objetivo;
              const resolucion = elegir(RESOLUCIONES);
              await hist(tec.usuarioId, 'CAMBIO_ESTADO', estado, 'RESUELTA', t, resolucion);
              estado = 'RESUELTA';
              campos.resolucion = resolucion;
              campos.fecha_resolucion = new Date(t);
              tec.activas--;

              if (rnd() < 0.8 && avanzar(entre(2, 24))) {
                await hist(elegir([coord, cliente.usuarioId]), 'CAMBIO_ESTADO', estado, 'CERRADA', t, 'Conforme con la atención.');
                estado = 'CERRADA';
                campos.fecha_cierre = new Date(t);
              }
            }
          }
        }
      }

      const sets = ['estado_id = $2', 'updated_at = $3'];
      const params = [id, estados[estado], new Date(t)];
      for (const [k, v] of Object.entries(campos)) {
        params.push(v);
        sets.push(`${k} = $${params.length}`);
      }
      await q(`UPDATE solicitudes SET ${sets.join(', ')} WHERE id = $1`, params);

      // Notificaciones de ejemplo para las solicitudes recientes
      if (n >= TOTAL - 12) {
        await q(
          `INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, solicitud_id, leida, created_at)
           VALUES ($1, 'REGISTRO', $2, $3, $4, $5, $6)`,
          [coordinadores[0], `Nueva solicitud ${codigo}`, `Se registró "${titulo}".`, id, n < TOTAL - 5, new Date(creada)],
        );
      }
    }

    console.log(`✔  Datos de prueba creados: ${TOTAL} solicitudes, ${tecnicos.length} técnicos, ${clientes.length} clientes.`);
    console.log(`   Contraseña de todos los usuarios: ${PASSWORD}`);
    console.log('   admin@servigest.ec | coordinador@servigest.ec | tecnico@servigest.ec | cliente@servigest.ec');
  });
}

module.exports = { seed, PASSWORD };

if (require.main === module) {
  seed()
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
