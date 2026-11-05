/**
 * Máquina de estados de la solicitud (reglas de negocio 1, 2, 4 y 7).
 *
 *  REGISTRADA ──► APROBADA ──(asignación)──► ASIGNADA ──► EN_PROCESO ◄──► PENDIENTE_INFO
 *      │              │                         │              │
 *      └──────────────┴────────► CANCELADA ◄────┘              ▼
 *                                                          RESUELTA ──► CERRADA
 *                                                              │           │
 *                                         (rechazo) EN_PROCESO ◄┘           └─(reapertura auditada)
 *
 * Funciones puras: no acceden a base de datos, por eso se prueban de forma unitaria.
 */
const AppError = require('../utils/AppError');
const { ROLES } = require('./roles');

const ESTADOS = Object.freeze({
  REGISTRADA: 'REGISTRADA',
  APROBADA: 'APROBADA',
  ASIGNADA: 'ASIGNADA',
  EN_PROCESO: 'EN_PROCESO',
  PENDIENTE_INFO: 'PENDIENTE_INFO',
  RESUELTA: 'RESUELTA',
  CERRADA: 'CERRADA',
  CANCELADA: 'CANCELADA',
});

/** Estados en los que la solicitud ocupa capacidad del técnico. */
const ESTADOS_ACTIVOS_TECNICO = [ESTADOS.ASIGNADA, ESTADOS.EN_PROCESO, ESTADOS.PENDIENTE_INFO];
/** Estados en los que el plazo sigue corriendo. */
const ESTADOS_ABIERTOS = [
  ESTADOS.REGISTRADA, ESTADOS.APROBADA, ESTADOS.ASIGNADA, ESTADOS.EN_PROCESO, ESTADOS.PENDIENTE_INFO,
];
const ESTADOS_FINALES = [ESTADOS.CERRADA, ESTADOS.CANCELADA];

const { ADMIN, COORDINADOR, TECNICO, CLIENTE } = ROLES;

/**
 * Transiciones permitidas mediante PATCH /solicitudes/:id/estado.
 * Clave: "ORIGEN>DESTINO" -> roles autorizados.
 * - ASIGNADA solo se alcanza con POST /asignaciones (no está aquí).
 * - Salir de CERRADA solo es posible con POST /reapertura (no está aquí).
 */
const TRANSICIONES = Object.freeze({
  'REGISTRADA>APROBADA': [ADMIN, COORDINADOR],
  'REGISTRADA>CANCELADA': [ADMIN, COORDINADOR, CLIENTE],
  'APROBADA>CANCELADA': [ADMIN, COORDINADOR, CLIENTE],
  'ASIGNADA>EN_PROCESO': [TECNICO, ADMIN, COORDINADOR],
  'ASIGNADA>CANCELADA': [ADMIN, COORDINADOR],
  'EN_PROCESO>PENDIENTE_INFO': [TECNICO, ADMIN, COORDINADOR],
  'EN_PROCESO>RESUELTA': [TECNICO, ADMIN, COORDINADOR],
  'PENDIENTE_INFO>EN_PROCESO': [TECNICO, ADMIN, COORDINADOR],
  'PENDIENTE_INFO>CANCELADA': [ADMIN, COORDINADOR],
  'RESUELTA>CERRADA': [ADMIN, COORDINADOR, CLIENTE],
  'RESUELTA>EN_PROCESO': [ADMIN, COORDINADOR, CLIENTE],
});

/** Lista de estados destino posibles desde `origen` para un rol (usado por el frontend). */
function transicionesDisponibles(origen, rol) {
  return Object.entries(TRANSICIONES)
    .filter(([clave, roles]) => clave.startsWith(`${origen}>`) && roles.includes(rol))
    .map(([clave]) => clave.split('>')[1]);
}

/**
 * Valida una transición. Lanza AppError si no es válida.
 * @param {object} p
 * @param {string} p.origen estado actual
 * @param {string} p.destino estado solicitado
 * @param {string} p.rol rol del usuario
 * @param {string} [p.resolucion] texto de resolución (obligatorio para RESUELTA)
 * @param {string} [p.comentario] comentario (obligatorio en PENDIENTE_INFO, CANCELADA y rechazo)
 */
function validarTransicion({ origen, destino, rol, resolucion, comentario }) {
  if (!ESTADOS[destino]) {
    throw AppError.badRequest(`Estado destino desconocido: ${destino}`);
  }
  if (origen === destino) {
    throw AppError.businessRule(`La solicitud ya se encuentra en estado ${origen}`);
  }
  if (origen === ESTADOS.CERRADA) {
    throw AppError.businessRule(
      'Una solicitud cerrada no puede cambiar de estado sin una reapertura autorizada',
    );
  }
  if (origen === ESTADOS.CANCELADA) {
    throw AppError.businessRule('Una solicitud cancelada no puede cambiar de estado');
  }
  if (destino === ESTADOS.ASIGNADA) {
    throw AppError.businessRule('El estado ASIGNADA se obtiene únicamente asignando un técnico');
  }

  const roles = TRANSICIONES[`${origen}>${destino}`];
  if (!roles) {
    throw AppError.businessRule(`Transición no permitida: ${origen} → ${destino}`, {
      permitidas: Object.keys(TRANSICIONES).filter((k) => k.startsWith(`${origen}>`)),
    });
  }
  if (!roles.includes(rol)) {
    throw AppError.forbidden(`El rol ${rol} no puede cambiar el estado de ${origen} a ${destino}`);
  }

  // Regla 1: no cerrar (ni resolver) sin resolución documentada.
  if (destino === ESTADOS.RESUELTA && !textoValido(resolucion, 20)) {
    throw AppError.businessRule('Para resolver la solicitud debe documentar la resolución (mínimo 20 caracteres)');
  }
  if (
    [ESTADOS.PENDIENTE_INFO, ESTADOS.CANCELADA].includes(destino) ||
    (origen === ESTADOS.RESUELTA && destino === ESTADOS.EN_PROCESO)
  ) {
    if (!textoValido(comentario, 5)) {
      throw AppError.businessRule('Debe indicar un comentario que justifique el cambio de estado');
    }
  }
  return true;
}

/** Regla 1 aplicada sobre la solicitud persistida antes de cerrarla. */
function validarCierre(solicitud) {
  if (!textoValido(solicitud.resolucion, 20) || !solicitud.fecha_resolucion) {
    throw AppError.businessRule('No se puede cerrar una solicitud sin resolución documentada');
  }
  return true;
}

/** Regla 4: la reapertura solo la autorizan ADMIN o COORDINADOR, con motivo, desde CERRADA. */
function validarReapertura({ estadoActual, rol, motivo }) {
  if (estadoActual !== ESTADOS.CERRADA) {
    throw AppError.businessRule('Solo se pueden reabrir solicitudes cerradas');
  }
  if (![ADMIN, COORDINADOR].includes(rol)) {
    throw AppError.forbidden('Solo un administrador o coordinador puede autorizar la reapertura');
  }
  if (!textoValido(motivo, 10)) {
    throw AppError.businessRule('La reapertura requiere un motivo (mínimo 10 caracteres)');
  }
  return true;
}

function textoValido(texto, min) {
  return typeof texto === 'string' && texto.trim().length >= min;
}

module.exports = {
  ESTADOS,
  ESTADOS_ACTIVOS_TECNICO,
  ESTADOS_ABIERTOS,
  ESTADOS_FINALES,
  TRANSICIONES,
  transicionesDisponibles,
  validarTransicion,
  validarCierre,
  validarReapertura,
};
