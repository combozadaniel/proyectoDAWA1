const { app, request, pool, query, reiniciarBD, tokensPorRol, referencias, nuevaSolicitud, auth } = require('../helpers/setup');

let t;
let ref;

beforeAll(async () => {
  await reiniciarBD();
  t = await tokensPorRol();
  ref = await referencias();
});
afterAll(() => pool.end());

describe('POST /api/solicitudes', () => {
  test('201: el cliente registra una solicitud; se calcula código y fecha límite', async () => {
    const res = await request(app).post('/api/solicitudes').set(auth(t.CLIENTE)).send(nuevaSolicitud(ref));
    expect(res.status).toBe(201);
    expect(res.headers.location).toBe(`/api/solicitudes/${res.body.id}`);
    expect(res.body.codigo).toMatch(/^SOL-\d{4}-\d{6}$/);
    expect(res.body.estado).toBe('REGISTRADA');
    expect(res.body.cliente_id).toBe(ref.cliente.id);
    const horas = (new Date(res.body.fecha_limite) - new Date(res.body.created_at)) / 3600000;
    expect(horas).toBe(24); // prioridad ALTA
  });

  test('el cliente no puede registrar para otro cliente (se ignora cliente_id)', async () => {
    const res = await request(app).post('/api/solicitudes').set(auth(t.CLIENTE)).send(nuevaSolicitud(ref, { cliente_id: 999 }));
    expect(res.status).toBe(201);
    expect(res.body.cliente_id).toBe(ref.cliente.id);
  });

  test('422: sede que no pertenece al cliente', async () => {
    const otra = (await query('SELECT id FROM sedes WHERE cliente_id <> $1 LIMIT 1', [ref.cliente.id])).rows[0];
    const res = await request(app).post('/api/solicitudes').set(auth(t.CLIENTE)).send(nuevaSolicitud(ref, { sede_id: otra.id }));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('REGLA_NEGOCIO');
  });

  test('422: campos obligatorios y longitudes', async () => {
    const res = await request(app)
      .post('/api/solicitudes')
      .set(auth(t.CLIENTE))
      .send({ titulo: 'abc', descripcion: 'corta', sede_id: 'x' });
    expect(res.status).toBe(422);
    const campos = res.body.error.details.map((d) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['titulo', 'descripcion', 'sede_id', 'categoria_id', 'prioridad_id', 'equipo_afectado']));
  });

  test('422: coordinador debe indicar cliente_id', async () => {
    const res = await request(app).post('/api/solicitudes').set(auth(t.COORDINADOR)).send(nuevaSolicitud(ref));
    expect(res.status).toBe(422);
  });

  test('403: el técnico no registra solicitudes', async () => {
    const res = await request(app).post('/api/solicitudes').set(auth(t.TECNICO)).send(nuevaSolicitud(ref));
    expect(res.status).toBe(403);
  });

  test('201 con adjunto multipart; 400 con tipo no permitido', async () => {
    const d = nuevaSolicitud(ref);
    const ok = await request(app)
      .post('/api/solicitudes')
      .set(auth(t.CLIENTE))
      .field(d)
      .attach('adjuntos', Buffer.from('detalle del error'), { filename: 'error.txt', contentType: 'text/plain' });
    expect(ok.status).toBe(201);
    const detalle = await request(app).get(`/api/solicitudes/${ok.body.id}`).set(auth(t.CLIENTE));
    expect(detalle.body.adjuntos).toHaveLength(1);
    const descarga = await request(app).get(`/api/solicitudes/${ok.body.id}/adjuntos/${detalle.body.adjuntos[0].id}`).set(auth(t.CLIENTE));
    expect(descarga.status).toBe(200);
    expect(descarga.text).toBe('detalle del error');

    const mal = await request(app)
      .post('/api/solicitudes')
      .set(auth(t.CLIENTE))
      .field(d)
      .attach('adjuntos', Buffer.from('MZ'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
    expect(mal.status).toBe(400);
  });
});

describe('GET /api/solicitudes (paginación, filtros y alcance)', () => {
  test('paginación con meta', async () => {
    const res = await request(app).get('/api/solicitudes?page=2&limit=5').set(auth(t.COORDINADOR));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(5);
    expect(res.body.meta).toMatchObject({ page: 2, limit: 5 });
    expect(res.body.meta.total).toBeGreaterThan(70);
  });

  test('filtro por estado múltiple y prioridad', async () => {
    const res = await request(app).get('/api/solicitudes?estado=CERRADA,RESUELTA&prioridad=ALTA&limit=100').set(auth(t.COORDINADOR));
    expect(res.status).toBe(200);
    for (const s of res.body.data) {
      expect(['CERRADA', 'RESUELTA']).toContain(s.estado);
      expect(s.prioridad).toBe('ALTA');
    }
  });

  test('filtro de vencidas usa el cálculo del backend', async () => {
    const res = await request(app).get('/api/solicitudes?vencimiento=vencida&limit=100').set(auth(t.COORDINADOR));
    expect(res.status).toBe(200);
    for (const s of res.body.data) expect(s.estado_plazo).toBe('VENCIDA');
  });

  test('búsqueda por texto', async () => {
    const res = await request(app).get('/api/solicitudes?q=impresora').set(auth(t.COORDINADOR));
    expect(res.body.data.every((s) => /impresora/i.test(s.titulo) || /impresora/i.test(s.codigo))).toBe(true);
  });

  test('el cliente solo ve sus solicitudes (regla 3)', async () => {
    const res = await request(app).get('/api/solicitudes?limit=100').set(auth(t.CLIENTE));
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((s) => s.cliente_id === ref.cliente.id)).toBe(true);
  });

  test('422 con filtros inválidos', async () => {
    const res = await request(app).get('/api/solicitudes?estado=INVENTADO&limit=1000').set(auth(t.COORDINADOR));
    expect(res.status).toBe(422);
  });
});

describe('Detalle, historial e inmutabilidad', () => {
  test('404 para id inexistente y 422 para id inválido', async () => {
    expect((await request(app).get('/api/solicitudes/999999').set(auth(t.ADMIN))).status).toBe(404);
    expect((await request(app).get('/api/solicitudes/abc').set(auth(t.ADMIN))).status).toBe(422);
  });

  test('el historial no puede modificarse ni borrarse en la BD', async () => {
    await expect(query('UPDATE historial_solicitudes SET comentario = $1', ['hack'])).rejects.toThrow(/inalterable/);
    await expect(query('DELETE FROM historial_solicitudes')).rejects.toThrow(/inalterable/);
  });

  test('ruta inexistente responde 404 JSON', async () => {
    const res = await request(app).get('/api/no-existe').set(auth(t.ADMIN));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('RUTA_NO_ENCONTRADA');
  });
});
