/**
 * Flujos completos de extremo a extremo vía API (con persistencia real):
 *  1. registro → aprobación → asignación → atención → resolución
 *  2. consulta → seguimiento (pendiente de información, respuesta) → cierre → reapertura auditada
 */
const { app, request, pool, query, reiniciarBD, tokensPorRol, referencias, nuevaSolicitud, auth, login } = require('../helpers/setup');

let t;
let ref;
let tecToken;
let solicitudId;

beforeAll(async () => {
  await reiniciarBD();
  t = await tokensPorRol();
  ref = await referencias();
  tecToken = await login(ref.tecnicoHardware.email);
});
afterAll(() => pool.end());

const estado = (id, token, body) => request(app).patch(`/api/solicitudes/${id}/estado`).set(auth(token)).send(body);

describe('Flujo 1: registro – asignación – atención', () => {
  test('1. el cliente registra la solicitud', async () => {
    const res = await request(app).post('/api/solicitudes').set(auth(t.CLIENTE)).send(nuevaSolicitud(ref));
    expect(res.status).toBe(201);
    solicitudId = res.body.id;
  });

  test('2. no se puede asignar antes de aprobar', async () => {
    const res = await request(app)
      .post(`/api/solicitudes/${solicitudId}/asignaciones`)
      .set(auth(t.COORDINADOR))
      .send({ tecnico_id: ref.tecnicoHardware.id });
    expect(res.status).toBe(422);
  });

  test('3. el coordinador aprueba y ajusta la prioridad (plazo recalculado)', async () => {
    const critica = (await query("SELECT id FROM prioridades WHERE codigo = 'CRITICA'")).rows[0];
    const res = await estado(solicitudId, t.COORDINADOR, { estado: 'APROBADA', prioridad_id: critica.id });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('APROBADA');
    expect(res.body.prioridad).toBe('CRITICA');
    expect(res.body.prioridad_solicitada).toBe('ALTA');
    expect((new Date(res.body.fecha_limite) - new Date(res.body.created_at)) / 3600000).toBe(8);
  });

  test('4. técnicos sugeridos indican elegibilidad', async () => {
    const res = await request(app).get(`/api/solicitudes/${solicitudId}/tecnicos-sugeridos`).set(auth(t.COORDINADOR));
    expect(res.status).toBe(200);
    expect(res.body.find((x) => x.id === ref.tecnicoHardware.id).elegible).toBe(true);
  });

  test('5. se rechaza un técnico sin la especialidad requerida (regla 5)', async () => {
    const res = await request(app)
      .post(`/api/solicitudes/${solicitudId}/asignaciones`)
      .set(auth(t.COORDINADOR))
      .send({ tecnico_id: ref.tecnicoSinEspecialidad.id });
    expect(res.status).toBe(422);
    expect(res.body.error.details.motivos).toContain('El técnico no tiene la especialidad requerida por la categoría');
  });

  test('6. se rechaza un técnico no disponible', async () => {
    await query('UPDATE tecnicos SET disponible = FALSE WHERE id = $1', [ref.tecnicoHardware.id]);
    const res = await request(app)
      .post(`/api/solicitudes/${solicitudId}/asignaciones`)
      .set(auth(t.COORDINADOR))
      .send({ tecnico_id: ref.tecnicoHardware.id });
    expect(res.status).toBe(422);
    await query('UPDATE tecnicos SET disponible = TRUE WHERE id = $1', [ref.tecnicoHardware.id]);
  });

  test('7. el coordinador asigna al técnico correcto y se notifica', async () => {
    const res = await request(app)
      .post(`/api/solicitudes/${solicitudId}/asignaciones`)
      .set(auth(t.COORDINADOR))
      .send({ tecnico_id: ref.tecnicoHardware.id });
    expect(res.status).toBe(201);
    expect(res.body.estado).toBe('ASIGNADA');
    expect(res.body.tecnico_id).toBe(ref.tecnicoHardware.id);

    const notif = await request(app).get('/api/notificaciones?no_leidas=true').set(auth(tecToken));
    expect(notif.body.data.some((n) => n.tipo === 'ASIGNACION' && n.solicitud_id === solicitudId)).toBe(true);
  });

  test('8. otro técnico no puede ver ni modificar la solicitud (regla 2)', async () => {
    const otro = await login('tecnico@servigest.ec');
    expect((await request(app).get(`/api/solicitudes/${solicitudId}`).set(auth(otro))).status).toBe(404);
    expect((await estado(solicitudId, otro, { estado: 'EN_PROCESO' })).status).toBe(404);
  });

  test('9. el técnico asignado inicia la atención', async () => {
    const res = await estado(solicitudId, tecToken, { estado: 'EN_PROCESO' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('EN_PROCESO');
  });

  test('10. no puede resolver sin documentar la resolución (regla 1)', async () => {
    const res = await estado(solicitudId, tecToken, { estado: 'RESUELTA' });
    expect(res.status).toBe(422);
  });

  test('11. el técnico resuelve con resolución documentada', async () => {
    const res = await estado(solicitudId, tecToken, {
      estado: 'RESUELTA',
      resolucion: 'Se reemplazó la unidad fusora y se imprimieron páginas de prueba correctamente.',
    });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('RESUELTA');
    expect(res.body.fecha_resolucion).not.toBeNull();
    expect(res.body.estado_plazo).toBe('CUMPLIDA');
  });

  test('12. el historial registra cada transición con usuario y fecha (regla 7)', async () => {
    const res = await request(app).get(`/api/solicitudes/${solicitudId}/historial`).set(auth(t.CLIENTE));
    expect(res.status).toBe(200);
    const pasos = res.body.map((h) => `${h.accion}:${h.estado_nuevo ?? ''}`);
    expect(pasos).toEqual([
      'CREACION:REGISTRADA',
      'CAMBIO_ESTADO:APROBADA',
      'ASIGNACION:ASIGNADA',
      'CAMBIO_ESTADO:EN_PROCESO',
      'CAMBIO_ESTADO:RESUELTA',
    ]);
    for (const h of res.body) {
      expect(h.usuario_nombre).toBeTruthy();
      expect(h.fecha).toBeTruthy();
    }
  });
});

describe('Flujo 2: consulta – seguimiento – cierre', () => {
  let id;

  test('1. preparación: solicitud aprobada y asignada', async () => {
    const r = await request(app).post('/api/solicitudes').set(auth(t.CLIENTE)).send(nuevaSolicitud(ref, { titulo: 'Monitor con líneas' }));
    id = r.body.id;
    await estado(id, t.COORDINADOR, { estado: 'APROBADA' });
    await request(app).post(`/api/solicitudes/${id}/asignaciones`).set(auth(t.COORDINADOR)).send({ tecnico_id: ref.tecnicoHardware.id });
    expect((await estado(id, tecToken, { estado: 'EN_PROCESO' })).status).toBe(200);
  });

  test('2. el cliente consulta su solicitud y ve el técnico asignado', async () => {
    const res = await request(app).get(`/api/solicitudes/${id}`).set(auth(t.CLIENTE));
    expect(res.status).toBe(200);
    expect(res.body.tecnico_nombre).toBeTruthy();
    expect(res.body.estado_plazo).toMatch(/A_TIEMPO|POR_VENCER/);
    expect(res.body.acciones.transiciones).toEqual([]);
  });

  test('3. el técnico pide información al cliente', async () => {
    const res = await estado(id, tecToken, { estado: 'PENDIENTE_INFO', comentario: 'Indique el modelo exacto del monitor.' });
    expect(res.status).toBe(200);
    const n = await request(app).get('/api/notificaciones').set(auth(t.CLIENTE));
    expect(n.body.data[0]).toMatchObject({ tipo: 'SOLICITUD_INFO', solicitud_id: id });
  });

  test('4. el cliente responde con un comentario', async () => {
    const res = await request(app).post(`/api/solicitudes/${id}/comentarios`).set(auth(t.CLIENTE)).send({ comentario: 'Es un LG 24MK430H.' });
    expect(res.status).toBe(201);
    expect(res.body.at(-1)).toMatchObject({ accion: 'COMENTARIO', comentario: 'Es un LG 24MK430H.' });
  });

  test('5. el técnico retoma y resuelve', async () => {
    expect((await estado(id, tecToken, { estado: 'EN_PROCESO' })).status).toBe(200);
    const res = await estado(id, tecToken, { estado: 'RESUELTA', resolucion: 'Se reemplazó el cable de video y se recalibró la pantalla.' });
    expect(res.status).toBe(200);
  });

  test('6. el técnico no puede cerrar; el cliente sí', async () => {
    expect((await estado(id, tecToken, { estado: 'CERRADA' })).status).toBe(403);
    const res = await estado(id, t.CLIENTE, { estado: 'CERRADA' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('CERRADA');
    expect(res.body.fecha_cierre).not.toBeNull();
  });

  test('7. una solicitud cerrada no retrocede por cambio de estado (regla 4)', async () => {
    const res = await estado(id, t.ADMIN, { estado: 'EN_PROCESO', comentario: 'reabrir' });
    expect(res.status).toBe(422);
  });

  test('8. reapertura: el cliente no puede, el coordinador sí y queda auditada', async () => {
    const neg = await request(app).post(`/api/solicitudes/${id}/reapertura`).set(auth(t.CLIENTE)).send({ motivo: 'El monitor volvió a fallar.' });
    expect(neg.status).toBe(403);
    const res = await request(app).post(`/api/solicitudes/${id}/reapertura`).set(auth(t.COORDINADOR)).send({ motivo: 'El monitor volvió a fallar.' });
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ASIGNADA');
    expect(res.body.fecha_cierre).toBeNull();
    const aud = await query("SELECT * FROM auditoria WHERE entidad = 'solicitud' AND entidad_id = $1 AND accion = 'REAPERTURA'", [String(id)]);
    expect(aud.rowCount).toBe(1);
  });

  test('9. control de concurrencia optimista: versión desactualizada → 409', async () => {
    const det = await request(app).get(`/api/solicitudes/${id}`).set(auth(t.COORDINADOR));
    const res = await estado(id, tecToken, { estado: 'EN_PROCESO', version: det.body.version - 1 });
    expect(res.status).toBe(409);
  });

  test('10. reasignación exige motivo y queda en historial', async () => {
    const otro = (
      await query(
        `SELECT t.id FROM tecnicos t JOIN tecnico_especialidades te ON te.tecnico_id = t.id
          WHERE te.especialidad_id = $1 AND t.id <> $2 LIMIT 1`,
        [ref.categoria.especialidad_id, ref.tecnicoHardware.id],
      )
    ).rows[0];
    await query('UPDATE tecnicos SET max_solicitudes_activas = 20, disponible = TRUE WHERE id = $1', [otro.id]);
    const sinMotivo = await request(app).post(`/api/solicitudes/${id}/asignaciones`).set(auth(t.COORDINADOR)).send({ tecnico_id: otro.id });
    expect(sinMotivo.status).toBe(422);
    const ok = await request(app)
      .post(`/api/solicitudes/${id}/asignaciones`)
      .set(auth(t.COORDINADOR))
      .send({ tecnico_id: otro.id, motivo: 'El técnico anterior está de vacaciones.' });
    expect(ok.status).toBe(201);
    const hist = await request(app).get(`/api/solicitudes/${id}/historial`).set(auth(t.COORDINADOR));
    expect(hist.body.at(-1)).toMatchObject({ accion: 'REASIGNACION', comentario: 'El técnico anterior está de vacaciones.' });
    // El técnico anterior pierde el acceso
    expect((await request(app).get(`/api/solicitudes/${id}`).set(auth(tecToken))).status).toBe(404);
  });
});
