/**
 * Políticas de acceso a solicitudes (reglas de negocio 2 y 3).
 * `usuario` es el objeto req.user: { id, rol, clienteId, tecnicoId }.
 */
const { ROLES } = require('./roles');

/** Regla 3: un cliente solo consulta sus propios registros. Técnico: las asignadas a él. */
function puedeVerSolicitud(usuario, solicitud) {
  switch (usuario.rol) {
    case ROLES.ADMIN:
    case ROLES.COORDINADOR:
      return true;
    case ROLES.CLIENTE:
      return usuario.clienteId != null && solicitud.cliente_id === usuario.clienteId;
    case ROLES.TECNICO:
      return usuario.tecnicoId != null && solicitud.tecnico_id === usuario.tecnicoId;
    default:
      return false;
  }
}

/** Regla 2: un técnico solo modifica solicitudes asignadas a su cargo. */
function puedeModificarSolicitud(usuario, solicitud) {
  if (usuario.rol === ROLES.TECNICO) {
    return usuario.tecnicoId != null && solicitud.tecnico_id === usuario.tecnicoId;
  }
  return puedeVerSolicitud(usuario, solicitud);
}

/** Filtro de alcance para listados y dashboard según rol. */
function alcancePorRol(usuario) {
  if (usuario.rol === ROLES.CLIENTE) return { clienteId: usuario.clienteId ?? -1 };
  if (usuario.rol === ROLES.TECNICO) return { tecnicoId: usuario.tecnicoId ?? -1 };
  return {};
}

module.exports = { puedeVerSolicitud, puedeModificarSolicitud, alcancePorRol };
