const { puedeVerSolicitud, puedeModificarSolicitud, alcancePorRol } = require('../../src/domain/politicas');
const { cedulaValida } = require('../../src/validators/schemas');

const solicitud = { cliente_id: 5, tecnico_id: 7 };

describe('Regla 3 - un cliente solo consulta sus propios registros', () => {
  test('cliente dueño puede ver', () => {
    expect(puedeVerSolicitud({ rol: 'CLIENTE', clienteId: 5 }, solicitud)).toBe(true);
  });
  test('otro cliente no puede ver', () => {
    expect(puedeVerSolicitud({ rol: 'CLIENTE', clienteId: 6 }, solicitud)).toBe(false);
  });
  test('cliente sin vínculo no puede ver nada', () => {
    expect(puedeVerSolicitud({ rol: 'CLIENTE', clienteId: null }, solicitud)).toBe(false);
  });
  test('el alcance de listados filtra por cliente', () => {
    expect(alcancePorRol({ rol: 'CLIENTE', clienteId: 5 })).toEqual({ clienteId: 5 });
    expect(alcancePorRol({ rol: 'COORDINADOR' })).toEqual({});
  });
});

describe('Regla 2 - un técnico solo modifica solicitudes asignadas a su cargo', () => {
  test('técnico asignado puede modificar', () => {
    expect(puedeModificarSolicitud({ rol: 'TECNICO', tecnicoId: 7 }, solicitud)).toBe(true);
  });
  test('otro técnico no puede modificar ni ver', () => {
    expect(puedeModificarSolicitud({ rol: 'TECNICO', tecnicoId: 8 }, solicitud)).toBe(false);
    expect(puedeVerSolicitud({ rol: 'TECNICO', tecnicoId: 8 }, solicitud)).toBe(false);
  });
  test('coordinador y administrador pueden modificar', () => {
    expect(puedeModificarSolicitud({ rol: 'COORDINADOR' }, solicitud)).toBe(true);
    expect(puedeModificarSolicitud({ rol: 'ADMIN' }, solicitud)).toBe(true);
  });
  test('el alcance de listados filtra por técnico', () => {
    expect(alcancePorRol({ rol: 'TECNICO', tecnicoId: 7 })).toEqual({ tecnicoId: 7 });
  });
});

describe('Validación de cédula ecuatoriana', () => {
  test.each(['0926687856', '1710034065'])('%s es válida', (c) => expect(cedulaValida(c)).toBe(true));
  test.each(['0926687857', '123', '9926687856', 'abcdefghij'])('%s es inválida', (c) => expect(cedulaValida(c)).toBe(false));
});
