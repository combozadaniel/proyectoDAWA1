/**
 * Notificaciones: se persisten en BD (dentro de la transacción del evento)
 * y, una vez confirmada la transacción, se emiten en tiempo real por Socket.IO.
 */
const notifRepo = require('../repositories/notificaciones.repository');
const usuariosRepo = require('../repositories/usuarios.repository');
const { emitirAUsuarios, emitirARoles } = require('../sockets/io');
const { paginacion, respuestaPaginada } = require('../utils/http');
const { ROLES } = require('../domain/roles');
const AppError = require('../utils/AppError');

const TIPOS = Object.freeze({
  REGISTRO: 'REGISTRO',
  ASIGNACION: 'ASIGNACION',
  CAMBIO_ESTADO: 'CAMBIO_ESTADO',
  SOLICITUD_INFO: 'SOLICITUD_INFO',
  CIERRE: 'CIERRE',
  COMENTARIO: 'COMENTARIO',
  REAPERTURA: 'REAPERTURA',
});

/** Usuarios con rol de gestión (coordinadores + administradores). */
function gestores(client) {
  return usuariosRepo.idsPorRol([ROLES.ADMIN, ROLES.COORDINADOR], client);
}

/**
 * Crea notificaciones en la transacción `client` y devuelve una función `emitir`
 * que debe llamarse tras el COMMIT.
 */
async function notificar(destinatarios, datos, client, excluirUsuarioId) {
  const ids = [...new Set(destinatarios.filter((id) => id != null && id !== excluirUsuarioId))];
  const creadas = await notifRepo.crearVarias(ids, datos, client);
  return () => {
    for (const n of creadas) emitirAUsuarios([n.usuario_id], 'notificacion', n);
  };
}

/** Evento de actualización de una solicitud para refrescar listados y dashboard sin recargar. */
function emitirCambioSolicitud(solicitud, accion, usuariosInteresados = []) {
  const payload = { id: solicitud.id, codigo: solicitud.codigo, estado: solicitud.estado, accion };
  emitirARoles([ROLES.ADMIN, ROLES.COORDINADOR], 'solicitud:actualizada', payload);
  emitirAUsuarios(usuariosInteresados, 'solicitud:actualizada', payload);
}

async function listar(usuarioId, filtros) {
  const pag = paginacion(filtros, { defaultLimit: 20 });
  const { rows, total, noLeidas } = await notifRepo.listar(usuarioId, {
    soloNoLeidas: filtros.no_leidas === 'true',
    ...pag,
  });
  return { ...respuestaPaginada(rows, total, pag), noLeidas };
}

async function marcarLeida(id, usuarioId) {
  const ok = await notifRepo.marcarLeida(id, usuarioId);
  if (!ok) throw AppError.notFound('Notificación');
}

async function marcarTodasLeidas(usuarioId) {
  return { actualizadas: await notifRepo.marcarTodasLeidas(usuarioId) };
}

module.exports = { TIPOS, gestores, notificar, emitirCambioSolicitud, listar, marcarLeida, marcarTodasLeidas };
