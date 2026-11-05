/**
 * Reglas explícitas de plazos y cumplimiento (regla de negocio 6).
 * Todo se calcula en el backend:
 *  - fecha_limite = fecha de registro + horas_plazo de la prioridad vigente.
 *  - "Próxima a vencer": solicitud abierta que consumió >= UMBRAL_POR_VENCER_PCT % del plazo
 *    y todavía no supera la fecha límite.
 *  - "Vencida": solicitud abierta cuya fecha límite ya pasó.
 *  - "Cumplida a tiempo": fecha_resolucion <= fecha_limite.
 */
const { ESTADOS_ABIERTOS } = require('./estados');

const HORA_MS = 3600 * 1000;

function calcularFechaLimite(fechaRegistro, horasPlazo) {
  if (!(horasPlazo > 0)) throw new Error('horasPlazo debe ser positivo');
  return new Date(new Date(fechaRegistro).getTime() + horasPlazo * HORA_MS);
}

/**
 * Devuelve el estado del plazo de una solicitud.
 * @returns {'A_TIEMPO'|'POR_VENCER'|'VENCIDA'|'CUMPLIDA'|'INCUMPLIDA'|'NO_APLICA'}
 */
function estadoPlazo(solicitud, umbralPct = 75, ahora = new Date()) {
  const { estado, created_at: creada, fecha_limite: limite, fecha_resolucion: resuelta } = solicitud;
  const tLimite = new Date(limite).getTime();

  if (resuelta) {
    return new Date(resuelta).getTime() <= tLimite ? 'CUMPLIDA' : 'INCUMPLIDA';
  }
  if (!ESTADOS_ABIERTOS.includes(estado)) return 'NO_APLICA';

  const tAhora = new Date(ahora).getTime();
  if (tAhora > tLimite) return 'VENCIDA';

  const tCreada = new Date(creada).getTime();
  const consumido = ((tAhora - tCreada) / (tLimite - tCreada)) * 100;
  return consumido >= umbralPct ? 'POR_VENCER' : 'A_TIEMPO';
}

/** Horas restantes (negativas si está vencida). */
function horasRestantes(fechaLimite, ahora = new Date()) {
  return Math.round(((new Date(fechaLimite) - new Date(ahora)) / HORA_MS) * 10) / 10;
}

/** Porcentaje de cumplimiento con 1 decimal; null si no hay resueltas. */
function porcentajeCumplimiento(aTiempo, fueraDePlazo) {
  const total = aTiempo + fueraDePlazo;
  if (total === 0) return null;
  return Math.round((aTiempo / total) * 1000) / 10;
}

module.exports = { calcularFechaLimite, estadoPlazo, horasRestantes, porcentajeCumplimiento };
