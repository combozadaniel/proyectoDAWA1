/**
 * CRUD de catálogos, clientes y técnicos: duplicidad, integridad referencial,
 * vigencia y restricciones al eliminar.
 */
const { app, request, pool, query, reiniciarBD, tokensPorRol, auth } = require('../helpers/setup');

let t;
beforeAll(async () => {
  await reiniciarBD();
  t = await tokensPorRol();
});
afterAll(() => pool.end());

describe('Especialidades y categorías', () => {
  let espId;

  test('crear especialidad y rechazar duplicado (sin distinguir mayúsculas)', async () => {
    const r = await request(app).post('/api/especialidades').set(auth(t.ADMIN)).send({ nombre: 'Cámaras CCTV' });
    expect(r.status).toBe(201);
    espId = r.body.id;
    const dup = await request(app).post('/api/especialidades').set(auth(t.ADMIN)).send({ nombre: 'cámaras cctv' });
    expect(dup.status).toBe(409);
  });

  test('categoría con especialidad inexistente es rechazada', async () => {
    const r = await request(app).post('/api/categorias').set(auth(t.ADMIN)).send({ nombre: 'Instalación de cámaras', especialidad_id: 9999 });
    expect(r.status).toBe(422);
  });

  test('no se elimina una especialidad con categorías asociadas', async () => {
    const cat = await request(app).post('/api/categorias').set(auth(t.ADMIN)).send({ nombre: 'Instalación de cámaras', especialidad_id: espId });
    expect(cat.status).toBe(201);
    const del = await request(app).delete(`/api/especialidades/${espId}`).set(auth(t.ADMIN));
    expect(del.status).toBe(409);
    expect((await request(app).delete(`/api/categorias/${cat.body.id}`).set(auth(t.ADMIN))).status).toBe(204);
    expect((await request(app).delete(`/api/especialidades/${espId}`).set(auth(t.ADMIN))).status).toBe(204);
  });

  test('no se elimina una categoría con solicitudes; sí se puede desactivar', async () => {
    const usada = (await query('SELECT categoria_id AS id FROM solicitudes LIMIT 1')).rows[0];
    expect((await request(app).delete(`/api/categorias/${usada.id}`).set(auth(t.ADMIN))).status).toBe(409);
    const des = await request(app).put(`/api/categorias/${usada.id}`).set(auth(t.ADMIN)).send({ activo: false });
    expect(des.status).toBe(200);
    expect(des.body.activo).toBe(false);
    const activas = await request(app).get('/api/categorias?activas=true').set(auth(t.CLIENTE));
    expect(activas.body.some((c) => c.id === usada.id)).toBe(false);
    await request(app).put(`/api/categorias/${usada.id}`).set(auth(t.ADMIN)).send({ activo: true });
  });

  test('parámetro operativo valida rango y queda auditado', async () => {
    expect((await request(app).put('/api/parametros/UMBRAL_POR_VENCER_PCT').set(auth(t.ADMIN)).send({ valor: 150 })).status).toBe(422);
    expect((await request(app).put('/api/parametros/UMBRAL_POR_VENCER_PCT').set(auth(t.ADMIN)).send({ valor: 80 })).status).toBe(200);
    const aud = await request(app).get('/api/auditoria?entidad=parametro').set(auth(t.ADMIN));
    expect(aud.body.data[0]).toMatchObject({ accion: 'ACTUALIZAR', entidad_id: 'UMBRAL_POR_VENCER_PCT' });
  });
});

describe('Clientes', () => {
  const nuevo = {
    identificacion: '0926687856001',
    razon_social: 'Ferretería Don Lucho',
    email: 'info@donlucho.ec',
    telefono: '042345678',
    sedes: [{ nombre: 'Local Sauces', direccion: 'Sauces 8, Mz 450' }],
    cuenta: { email: 'donlucho@servigest.ec', password: 'Lucho2026x' },
  };
  let id;

  test('crear cliente con sedes y cuenta de acceso', async () => {
    const r = await request(app).post('/api/clientes').set(auth(t.COORDINADOR)).send(nuevo);
    expect(r.status).toBe(201);
    expect(r.body.sedes).toHaveLength(1);
    expect(r.body.usuario_email).toBe('donlucho@servigest.ec');
    id = r.body.id;
    const login = await request(app).post('/api/auth/login').send({ email: 'donlucho@servigest.ec', password: 'Lucho2026x' });
    expect(login.body.usuario).toMatchObject({ rol: 'CLIENTE', clienteId: id });
  });

  test('rechaza identificación duplicada e inválida', async () => {
    expect((await request(app).post('/api/clientes').set(auth(t.COORDINADOR)).send({ ...nuevo, cuenta: undefined })).status).toBe(409);
    const inv = await request(app).post('/api/clientes').set(auth(t.COORDINADOR)).send({ ...nuevo, identificacion: '1234567890' });
    expect(inv.status).toBe(422);
  });

  test('desactivar cliente desactiva su cuenta (vigencia)', async () => {
    await request(app).put(`/api/clientes/${id}`).set(auth(t.COORDINADOR)).send({ activo: false });
    const login = await request(app).post('/api/auth/login').send({ email: 'donlucho@servigest.ec', password: 'Lucho2026x' });
    expect(login.status).toBe(403);
  });

  test('no se elimina un cliente con solicitudes; sí uno sin ellas', async () => {
    const conSolicitudes = (await query('SELECT cliente_id AS id FROM solicitudes LIMIT 1')).rows[0];
    expect((await request(app).delete(`/api/clientes/${conSolicitudes.id}`).set(auth(t.ADMIN))).status).toBe(409);
    expect((await request(app).delete(`/api/clientes/${id}`).set(auth(t.ADMIN))).status).toBe(204);
  });
});

describe('Técnicos', () => {
  test('crear técnico con usuario y especialidades', async () => {
    const r = await request(app)
      .post('/api/tecnicos')
      .set(auth(t.ADMIN))
      .send({ nombre: 'Pedro Bravo', email: 'pbravo@servigest.ec', password: 'Pedro2026x', cedula: '1710034065', especialidades: [1, 2] });
    expect(r.status).toBe(201);
    expect(r.body.especialidades).toHaveLength(2);
    expect(r.body.max_solicitudes_activas).toBe(5); // MAX_CARGA_DEFAULT
    expect(r.body.carga_actual).toBe(0);
  });

  test('rechaza cédula duplicada, cédula inválida y sin especialidades', async () => {
    const base = { nombre: 'Otro Técnico', email: 'otro@servigest.ec', password: 'Otro2026xx', especialidades: [1] };
    expect((await request(app).post('/api/tecnicos').set(auth(t.ADMIN)).send({ ...base, cedula: '1710034065' })).status).toBe(409);
    expect((await request(app).post('/api/tecnicos').set(auth(t.ADMIN)).send({ ...base, cedula: '1710034066' })).status).toBe(422);
    expect((await request(app).post('/api/tecnicos').set(auth(t.ADMIN)).send({ ...base, cedula: '0926687856', especialidades: [] })).status).toBe(422);
  });

  test('el máximo de carga no puede quedar por debajo de la carga actual', async () => {
    const cargado = (
      await query(
        `SELECT t.id FROM tecnicos t JOIN solicitudes s ON s.tecnico_id = t.id JOIN estados e ON e.id = s.estado_id
          WHERE e.codigo IN ('ASIGNADA','EN_PROCESO','PENDIENTE_INFO') GROUP BY t.id HAVING COUNT(*) >= 2 LIMIT 1`,
      )
    ).rows[0];
    const r = await request(app).put(`/api/tecnicos/${cargado.id}`).set(auth(t.COORDINADOR)).send({ max_solicitudes_activas: 1 });
    expect(r.status).toBe(422);
  });

  test('no se elimina un técnico con asignaciones', async () => {
    const asignado = (await query('SELECT tecnico_id AS id FROM asignaciones LIMIT 1')).rows[0];
    expect((await request(app).delete(`/api/tecnicos/${asignado.id}`).set(auth(t.ADMIN))).status).toBe(409);
  });

  test('el técnico cambia su propia disponibilidad', async () => {
    const r = await request(app).patch('/api/tecnicos/me/disponibilidad').set(auth(t.TECNICO)).send({ disponible: false });
    expect(r.status).toBe(200);
    expect(r.body.disponible).toBe(false);
  });
});

describe('Dashboard', () => {
  test('indicadores calculados desde la BD', async () => {
    const r = await request(app).get('/api/dashboard/indicadores?desde=2000-01-01').set(auth(t.COORDINADOR));
    expect(r.status).toBe(200);
    const total = (await query('SELECT COUNT(*) AS n FROM solicitudes WHERE created_at::date <= CURRENT_DATE')).rows[0].n;
    expect(r.body.resumen.total).toBe(total);
    expect(r.body.porEstado.reduce((a, e) => a + e.total, 0)).toBe(total);
    expect(r.body.porEstado).toHaveLength(8);
    const { aTiempo, fueraDePlazo, porcentaje } = r.body.cumplimiento;
    expect(porcentaje).toBeCloseTo((aTiempo / (aTiempo + fueraDePlazo)) * 100, 0);
    expect(r.body.cargaPorTecnico.length).toBeGreaterThan(0);
  });

  test('filtro de fechas devuelve una serie diaria', async () => {
    const r = await request(app).get('/api/dashboard/indicadores?desde=2026-01-01&hasta=2026-01-10').set(auth(t.ADMIN));
    expect(r.body.evolucion).toHaveLength(10);
  });

  test('422 con fecha inválida', async () => {
    const r = await request(app).get('/api/dashboard/indicadores?desde=01-01-2026').set(auth(t.ADMIN));
    expect(r.status).toBe(422);
  });
});
