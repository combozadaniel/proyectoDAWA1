/**
 * Reglas de asignación de técnicos (regla de negocio 5).
 * Un técnico es elegible si:
 *  1. Está activo.
 *  2. Está marcado como disponible.
 *  3. Tiene la especialidad requerida por la categoría de la solicitud.
 *  4. Su carga actual (solicitudes ASIGNADA / EN_PROCESO / PENDIENTE_INFO) es menor a su máximo.
 */
const AppError = require('../utils/AppError');
const { ESTADOS } = require('./estados');

const ESTADOS_ASIGNABLES = [ESTADOS.APROBADA];
const ESTADOS_REASIGNABLES = [ESTADOS.ASIGNADA, ESTADOS.EN_PROCESO, ESTADOS.PENDIENTE_INFO];

/** Devuelve la lista de motivos por los que un técnico NO es elegible (vacía si es elegible). */
function motivosNoElegible(tecnico, especialidadRequeridaId) {
  const motivos = [];
  if (!tecnico.activo) motivos.push('El técnico está inactivo');
  if (!tecnico.disponible) motivos.push('El técnico no está disponible');
  const especialidades = (tecnico.especialidades || []).map((e) => (typeof e === 'object' ? e.id : e));
  if (!especialidades.includes(especialidadRequeridaId)) {
    motivos.push('El técnico no tiene la especialidad requerida por la categoría');
  }
  if (tecnico.carga_actual >= tecnico.max_solicitudes_activas) {
    motivos.push(
      `El técnico alcanzó su carga máxima (${tecnico.carga_actual}/${tecnico.max_solicitudes_activas})`,
    );
  }
  return motivos;
}

/**
 * Valida una asignación o reasignación. Lanza AppError si no procede.
 * @returns {{ esReasignacion: boolean }}
 */
function validarAsignacion({ solicitud, tecnico, especialidadRequeridaId, motivo }) {
  const esReasignacion = ESTADOS_REASIGNABLES.includes(solicitud.estado);
  if (!ESTADOS_ASIGNABLES.includes(solicitud.estado) && !esReasignacion) {
    throw AppError.businessRule(
      `No se puede asignar un técnico a una solicitud en estado ${solicitud.estado}. Debe estar APROBADA (o asignada para reasignar).`,
    );
  }
  if (esReasignacion) {
    if (solicitud.tecnico_id === tecnico.id) {
      throw AppError.businessRule('La solicitud ya está asignada a ese técnico');
    }
    if (typeof motivo !== 'string' || motivo.trim().length < 10) {
      throw AppError.businessRule('La reasignación debe justificarse con un motivo (mínimo 10 caracteres)');
    }
  }
  const motivos = motivosNoElegible(tecnico, especialidadRequeridaId);
  if (motivos.length) {
    throw AppError.businessRule('El técnico no cumple las condiciones de asignación', { motivos });
  }
  return { esReasignacion };
}

/** Ordena candidatos: primero menor porcentaje de carga, luego menor carga absoluta. */
function ordenarCandidatos(tecnicos) {
  return [...tecnicos].sort((a, b) => {
    const pa = a.carga_actual / a.max_solicitudes_activas;
    const pb = b.carga_actual / b.max_solicitudes_activas;
    return pa - pb || a.carga_actual - b.carga_actual || a.id - b.id;
  });
}

module.exports = { motivosNoElegible, validarAsignacion, ordenarCandidatos };
