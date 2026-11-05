/**
 * Tiempo real con Socket.IO.
 * Cada socket se autentica con el mismo JWT de la API y se une a:
 *   - sala "usuario:<id>"  -> notificaciones personales
 *   - sala "rol:<ROL>"     -> eventos para un rol (p. ej. coordinadores)
 * Eventos emitidos:
 *   - "notificacion"           { notificación persistida }
 *   - "solicitud:actualizada"  { id, codigo, estado, accion }
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const authRepo = require('../repositories/auth.repository');

let io = null;

function iniciarSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (await authRepo.tokenRevocado(payload.jti)) return next(new Error('Sesión cerrada'));
      const usuario = await authRepo.buscarContextoUsuario(payload.sub);
      if (!usuario?.activo) return next(new Error('Usuario inactivo'));
      socket.data.usuario = usuario;
      next();
    } catch {
      next(new Error('No autenticado'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.data.usuario;
    socket.join(`usuario:${u.id}`);
    socket.join(`rol:${u.rol}`);
  });

  return io;
}

/** Emite a una lista de usuarios. Si no hay servidor (pruebas) no hace nada. */
function emitirAUsuarios(usuarioIds, evento, payload) {
  if (!io) return;
  for (const id of new Set(usuarioIds)) io.to(`usuario:${id}`).emit(evento, payload);
}

function emitirARoles(roles, evento, payload) {
  if (!io) return;
  io.to(roles.map((r) => `rol:${r}`)).emit(evento, payload);
}

module.exports = { iniciarSockets, emitirAUsuarios, emitirARoles };
