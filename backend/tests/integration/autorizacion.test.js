/**
 * Pruebas de autorización por roles: cada rol solo accede a lo que le corresponde.
 */
const { app, request, pool, query, reiniciarBD, tokensPorRol, auth } = require('../helpers/setup');

let t;
beforeAll(async () => {
  await reiniciarBD();
  t = await tokensPorRol();
});
afterAll(() => pool.end());

// [método, ruta, roles permitidos]
const MATRIZ = [
  ['get', '/api/usuarios', ['ADMIN']],
  ['get', '/api/auditoria', ['ADMIN']],
  ['get', '/api/clientes', ['ADMIN', 'COORDINADOR']],
  ['get', '/api/tecnicos', ['ADMIN', 'COORDINADOR']],
  ['get', '/api/parametros', ['ADMIN', 'COORDINADOR']],
  ['get', '/api/especialidades', ['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE']],
  ['get', '/api/dashboard/indicadores', ['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE']],
  ['get', '/api/solicitudes/1/tecnicos-sugeridos', ['ADMIN', 'COORDINADOR']],
  ['post', '/api/especialidades', ['ADMIN']],
];

describe.each(MATRIZ)('%s %s', (metodo, ruta, permitidos) => {
  test.each(['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE'])('rol %s', async (rol) => {
    const res = await request(app)[metodo](ruta).set(auth(t[rol])).send({});
    if (permitidos.includes(rol)) {
      expect(res.status).not.toBe(403);
      expect(res.status).not.toBe(401);
    } else {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('PROHIBIDO');
    }
  });
});

describe('Acceso a recursos ajenos', () => {
  test('un cliente no ve la solicitud de otro cliente (404, no revela existencia)', async () => {
    const ajena = (
      await query(
        `SELECT s.id FROM solicitudes s JOIN clientes c ON c.id = s.cliente_id JOIN usuarios u ON u.id = c.usuario_id
          WHERE u.email <> 'cliente@servigest.ec' LIMIT 1`,
      )
    ).rows[0];
    const res = await request(app).get(`/api/solicitudes/${ajena.id}`).set(auth(t.CLIENTE));
    expect(res.status).toBe(404);
    expect((await request(app).get(`/api/solicitudes/${ajena.id}/historial`).set(auth(t.CLIENTE))).status).toBe(404);
  });

  test('un cliente no ve los datos de otro cliente', async () => {
    const me = await request(app).get('/api/auth/me').set(auth(t.CLIENTE));
    const otro = (await query('SELECT id FROM clientes WHERE id <> $1 LIMIT 1', [me.body.clienteId])).rows[0];
    expect((await request(app).get(`/api/clientes/${otro.id}`).set(auth(t.CLIENTE))).status).toBe(404);
    expect((await request(app).get(`/api/clientes/${me.body.clienteId}`).set(auth(t.CLIENTE))).status).toBe(200);
  });

  test('el dashboard del técnico solo cuenta sus solicitudes', async () => {
    const me = await request(app).get('/api/auth/me').set(auth(t.TECNICO));
    const res = await request(app).get('/api/dashboard/indicadores?desde=2000-01-01').set(auth(t.TECNICO));
    expect(res.status).toBe(200);
    expect(res.body.cargaPorTecnico.every((c) => c.id === me.body.tecnicoId)).toBe(true);
    const propias = (
      await query("SELECT COUNT(*) AS n FROM solicitudes WHERE tecnico_id = $1 AND created_at::date <= CURRENT_DATE", [me.body.tecnicoId])
    ).rows[0].n;
    expect(res.body.resumen.total).toBe(propias);
  });

  test('un usuario desactivado pierde el acceso inmediatamente', async () => {
    const me = await request(app).get('/api/auth/me').set(auth(t.CLIENTE));
    await request(app).put(`/api/usuarios/${me.body.id}`).set(auth(t.ADMIN)).send({ activo: false });
    expect((await request(app).get('/api/auth/me').set(auth(t.CLIENTE))).status).toBe(401);
    await request(app).put(`/api/usuarios/${me.body.id}`).set(auth(t.ADMIN)).send({ activo: true });
  });
});
