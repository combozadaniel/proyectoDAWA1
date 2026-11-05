const { validarAsignacion, motivosNoElegible, ordenarCandidatos } = require('../../src/domain/asignacion');

const tecnico = (extra = {}) => ({
  id: 1,
  activo: true,
  disponible: true,
  especialidades: [{ id: 10 }],
  carga_actual: 1,
  max_solicitudes_activas: 3,
  ...extra,
});
const solicitud = (estado, extra = {}) => ({ estado, tecnico_id: null, ...extra });

describe('Regla 5 - asignación valida especialidad, disponibilidad y carga', () => {
  test('técnico elegible en solicitud APROBADA', () => {
    expect(
      validarAsignacion({ solicitud: solicitud('APROBADA'), tecnico: tecnico(), especialidadRequeridaId: 10 }),
    ).toEqual({ esReasignacion: false });
  });

  test('rechaza técnico sin la especialidad', () => {
    expect(() =>
      validarAsignacion({ solicitud: solicitud('APROBADA'), tecnico: tecnico(), especialidadRequeridaId: 99 }),
    ).toThrow(/no cumple/);
    expect(motivosNoElegible(tecnico(), 99)).toContain('El técnico no tiene la especialidad requerida por la categoría');
  });

  test('rechaza técnico no disponible', () => {
    expect(motivosNoElegible(tecnico({ disponible: false }), 10)).toEqual(['El técnico no está disponible']);
  });

  test('rechaza técnico inactivo', () => {
    expect(motivosNoElegible(tecnico({ activo: false }), 10)).toEqual(['El técnico está inactivo']);
  });

  test('rechaza técnico con carga máxima alcanzada', () => {
    expect(motivosNoElegible(tecnico({ carga_actual: 3 }), 10)[0]).toMatch(/carga máxima \(3\/3\)/);
  });

  test('no se asigna una solicitud REGISTRADA (debe aprobarse antes)', () => {
    expect(() =>
      validarAsignacion({ solicitud: solicitud('REGISTRADA'), tecnico: tecnico(), especialidadRequeridaId: 10 }),
    ).toThrow(/Debe estar APROBADA/);
  });

  test('la reasignación exige motivo y otro técnico', () => {
    const s = solicitud('EN_PROCESO', { tecnico_id: 2 });
    expect(() => validarAsignacion({ solicitud: s, tecnico: tecnico(), especialidadRequeridaId: 10 })).toThrow(/motivo/);
    expect(() =>
      validarAsignacion({ solicitud: s, tecnico: tecnico({ id: 2 }), especialidadRequeridaId: 10, motivo: 'Cambio de turno del técnico' }),
    ).toThrow(/ya está asignada/);
    expect(
      validarAsignacion({ solicitud: s, tecnico: tecnico(), especialidadRequeridaId: 10, motivo: 'Cambio de turno del técnico' }),
    ).toEqual({ esReasignacion: true });
  });

  test('candidatos ordenados por porcentaje de carga', () => {
    const lista = ordenarCandidatos([
      tecnico({ id: 1, carga_actual: 2, max_solicitudes_activas: 4 }),
      tecnico({ id: 2, carga_actual: 0, max_solicitudes_activas: 3 }),
      tecnico({ id: 3, carga_actual: 3, max_solicitudes_activas: 4 }),
    ]);
    expect(lista.map((t) => t.id)).toEqual([2, 1, 3]);
  });
});
