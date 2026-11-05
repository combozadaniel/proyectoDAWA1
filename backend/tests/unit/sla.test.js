const { calcularFechaLimite, estadoPlazo, horasRestantes, porcentajeCumplimiento } = require('../../src/domain/sla');

const H = 3600 * 1000;
const base = new Date('2026-05-01T08:00:00Z');

describe('Regla 6 - plazos y cumplimiento calculados con reglas explícitas', () => {
  test('fecha límite = registro + horas de la prioridad', () => {
    expect(calcularFechaLimite(base, 24).toISOString()).toBe('2026-05-02T08:00:00.000Z');
    expect(calcularFechaLimite(base, 8).toISOString()).toBe('2026-05-01T16:00:00.000Z');
  });

  test('horas de plazo inválidas lanzan error', () => {
    expect(() => calcularFechaLimite(base, 0)).toThrow();
  });

  const sol = (estado, extra = {}) => ({
    estado,
    created_at: base,
    fecha_limite: new Date(base.getTime() + 100 * H),
    fecha_resolucion: null,
    ...extra,
  });

  test('A_TIEMPO cuando consumió menos del umbral', () => {
    expect(estadoPlazo(sol('EN_PROCESO'), 75, new Date(base.getTime() + 50 * H))).toBe('A_TIEMPO');
  });

  test('POR_VENCER al alcanzar el umbral', () => {
    expect(estadoPlazo(sol('EN_PROCESO'), 75, new Date(base.getTime() + 75 * H))).toBe('POR_VENCER');
    expect(estadoPlazo(sol('ASIGNADA'), 75, new Date(base.getTime() + 99 * H))).toBe('POR_VENCER');
  });

  test('VENCIDA cuando se supera la fecha límite sin resolver', () => {
    expect(estadoPlazo(sol('APROBADA'), 75, new Date(base.getTime() + 101 * H))).toBe('VENCIDA');
  });

  test('CUMPLIDA / INCUMPLIDA según fecha de resolución', () => {
    const ahora = new Date(base.getTime() + 500 * H);
    expect(estadoPlazo(sol('CERRADA', { fecha_resolucion: new Date(base.getTime() + 90 * H) }), 75, ahora)).toBe('CUMPLIDA');
    expect(estadoPlazo(sol('RESUELTA', { fecha_resolucion: new Date(base.getTime() + 120 * H) }), 75, ahora)).toBe('INCUMPLIDA');
  });

  test('NO_APLICA para canceladas', () => {
    expect(estadoPlazo(sol('CANCELADA'), 75, new Date(base.getTime() + 200 * H))).toBe('NO_APLICA');
  });

  test('el umbral es configurable', () => {
    expect(estadoPlazo(sol('EN_PROCESO'), 50, new Date(base.getTime() + 60 * H))).toBe('POR_VENCER');
  });

  test('horas restantes y porcentaje de cumplimiento', () => {
    expect(horasRestantes(new Date(base.getTime() + 10 * H), base)).toBe(10);
    expect(horasRestantes(new Date(base.getTime() - 5 * H), base)).toBe(-5);
    expect(porcentajeCumplimiento(3, 1)).toBe(75);
    expect(porcentajeCumplimiento(0, 0)).toBeNull();
  });
});
