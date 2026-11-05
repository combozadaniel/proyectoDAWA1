const { app, request, pool, reiniciarBD, login, auth, USUARIOS, PASSWORD } = require('../helpers/setup');

beforeAll(reiniciarBD);
afterAll(() => pool.end());

describe('POST /api/auth/login', () => {
  test('200 con credenciales válidas y no expone el hash', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: USUARIOS.ADMIN, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario).toMatchObject({ email: USUARIOS.ADMIN, rol: 'ADMIN' });
    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  test('401 con contraseña incorrecta (mensaje genérico)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: USUARIOS.ADMIN, password: 'incorrecta1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Credenciales incorrectas');
  });

  test('401 con correo inexistente (mismo mensaje)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nadie@x.ec', password: 'loquesea1' });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Credenciales incorrectas');
  });

  test('422 con datos inválidos', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'no-es-correo' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDACION');
    expect(res.body.error.details.map((d) => d.campo)).toEqual(expect.arrayContaining(['email', 'password']));
  });

  test('400 con JSON mal formado', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });
});

describe('Rutas protegidas y cierre de sesión', () => {
  test('401 sin token', async () => {
    const res = await request(app).get('/api/solicitudes');
    expect(res.status).toBe(401);
  });

  test('401 con token manipulado', async () => {
    const token = await login(USUARIOS.ADMIN);
    const res = await request(app).get('/api/auth/me').set(auth(`${token}x`));
    expect(res.status).toBe(401);
  });

  test('logout revoca el token', async () => {
    const token = await login(USUARIOS.COORDINADOR);
    expect((await request(app).get('/api/auth/me').set(auth(token))).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').set(auth(token))).status).toBe(204);
    const res = await request(app).get('/api/auth/me').set(auth(token));
    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/sesión fue cerrada/);
  });
});

describe('Recuperación y cambio de contraseña', () => {
  test('flujo olvidé contraseña → restablecer → login con nueva', async () => {
    const r1 = await request(app).post('/api/auth/olvide-password').send({ email: USUARIOS.CLIENTE2 });
    expect(r1.status).toBe(202);
    expect(r1.body.tokenDesarrollo).toHaveLength(64);

    const r2 = await request(app)
      .post('/api/auth/restablecer-password')
      .send({ token: r1.body.tokenDesarrollo, password: 'NuevaClave2026' });
    expect(r2.status).toBe(204);

    // El token es de un solo uso
    const r3 = await request(app)
      .post('/api/auth/restablecer-password')
      .send({ token: r1.body.tokenDesarrollo, password: 'OtraClave2026' });
    expect(r3.status).toBe(422);

    await expect(login(USUARIOS.CLIENTE2, 'NuevaClave2026')).resolves.toBeDefined();
  });

  test('correo inexistente responde igual (sin revelar existencia)', async () => {
    const res = await request(app).post('/api/auth/olvide-password').send({ email: 'noexiste@x.ec' });
    expect(res.status).toBe(202);
    expect(res.body.tokenDesarrollo).toBeUndefined();
  });

  test('cambio de contraseña valida la actual y la fortaleza', async () => {
    const token = await login(USUARIOS.TECNICO);
    const débil = await request(app).patch('/api/auth/me/password').set(auth(token)).send({ actual: PASSWORD, nueva: 'abc' });
    expect(débil.status).toBe(422);
    const mala = await request(app).patch('/api/auth/me/password').set(auth(token)).send({ actual: 'Equivocada1', nueva: 'Valida2026x' });
    expect(mala.status).toBe(422);
    const ok = await request(app).patch('/api/auth/me/password').set(auth(token)).send({ actual: PASSWORD, nueva: 'Valida2026x' });
    expect(ok.status).toBe(204);
  });
});
