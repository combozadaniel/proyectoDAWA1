const {
  validarTransicion,
  validarCierre,
  validarReapertura,
  transicionesDisponibles,
} = require('../../src/domain/estados');

const RES = 'Se reemplazó el disco duro y se restauró el respaldo del usuario.';

describe('Regla 1 - no cerrar/resolver sin resolución documentada', () => {
  test('resolver sin resolución lanza error de regla de negocio', () => {
    expect(() => validarTransicion({ origen: 'EN_PROCESO', destino: 'RESUELTA', rol: 'TECNICO' })).toThrow(
      /documentar la resolución/,
    );
  });

  test('resolver con resolución muy corta es rechazado', () => {
    expect(() =>
      validarTransicion({ origen: 'EN_PROCESO', destino: 'RESUELTA', rol: 'TECNICO', resolucion: 'listo' }),
    ).toThrow(/mínimo 20/);
  });

  test('resolver con resolución válida es aceptado', () => {
    expect(validarTransicion({ origen: 'EN_PROCESO', destino: 'RESUELTA', rol: 'TECNICO', resolucion: RES })).toBe(true);
  });

  test('cerrar una solicitud sin resolución persistida es rechazado', () => {
    expect(() => validarCierre({ resolucion: null, fecha_resolucion: null })).toThrow(/sin resolución/);
  });

  test('cerrar una solicitud con resolución persistida es aceptado', () => {
    expect(validarCierre({ resolucion: RES, fecha_resolucion: new Date() })).toBe(true);
  });
});

describe('Regla 4 - una solicitud cerrada no retrocede sin reapertura', () => {
  test.each(['EN_PROCESO', 'RESUELTA', 'REGISTRADA', 'CANCELADA'])('CERRADA → %s es rechazado', (destino) => {
    expect(() =>
      validarTransicion({ origen: 'CERRADA', destino, rol: 'ADMIN', comentario: 'cambio forzado' }),
    ).toThrow(/reapertura autorizada/);
  });

  test('la reapertura exige rol de gestión', () => {
    expect(() => validarReapertura({ estadoActual: 'CERRADA', rol: 'TECNICO', motivo: 'El problema reapareció hoy' })).toThrow(
      /administrador o coordinador/,
    );
    expect(() => validarReapertura({ estadoActual: 'CERRADA', rol: 'CLIENTE', motivo: 'El problema reapareció hoy' })).toThrow();
  });

  test('la reapertura exige motivo', () => {
    expect(() => validarReapertura({ estadoActual: 'CERRADA', rol: 'COORDINADOR', motivo: 'corto' })).toThrow(/motivo/);
  });

  test('solo se reabren solicitudes cerradas', () => {
    expect(() =>
      validarReapertura({ estadoActual: 'RESUELTA', rol: 'COORDINADOR', motivo: 'El problema reapareció hoy' }),
    ).toThrow(/Solo se pueden reabrir/);
  });

  test('reapertura válida', () => {
    expect(validarReapertura({ estadoActual: 'CERRADA', rol: 'COORDINADOR', motivo: 'El problema reapareció hoy' })).toBe(true);
  });
});

describe('Máquina de estados y roles', () => {
  test('ASIGNADA no se alcanza por cambio de estado directo', () => {
    expect(() => validarTransicion({ origen: 'APROBADA', destino: 'ASIGNADA', rol: 'ADMIN' })).toThrow(/asignando un técnico/);
  });

  test('transición inexistente es rechazada', () => {
    expect(() => validarTransicion({ origen: 'REGISTRADA', destino: 'EN_PROCESO', rol: 'ADMIN' })).toThrow(/no permitida/);
  });

  test('un cliente no puede aprobar', () => {
    expect(() => validarTransicion({ origen: 'REGISTRADA', destino: 'APROBADA', rol: 'CLIENTE' })).toThrow(/no puede cambiar/);
  });

  test('un técnico no puede cerrar', () => {
    expect(() => validarTransicion({ origen: 'RESUELTA', destino: 'CERRADA', rol: 'TECNICO' })).toThrow(/no puede cambiar/);
  });

  test('pedir información exige comentario', () => {
    expect(() => validarTransicion({ origen: 'EN_PROCESO', destino: 'PENDIENTE_INFO', rol: 'TECNICO' })).toThrow(/comentario/);
  });

  test('transiciones disponibles dependen del rol', () => {
    expect(transicionesDisponibles('REGISTRADA', 'COORDINADOR').sort()).toEqual(['APROBADA', 'CANCELADA']);
    expect(transicionesDisponibles('REGISTRADA', 'CLIENTE')).toEqual(['CANCELADA']);
    expect(transicionesDisponibles('REGISTRADA', 'TECNICO')).toEqual([]);
    expect(transicionesDisponibles('CERRADA', 'ADMIN')).toEqual([]);
  });
});
