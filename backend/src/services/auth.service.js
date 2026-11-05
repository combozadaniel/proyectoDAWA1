const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const authRepo = require('../repositories/auth.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');
const catalogosRepo = require('../repositories/catalogos.repository');

function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_ROUNDS);
}

function firmarToken(usuario) {
  return jwt.sign({ sub: usuario.id, rol: usuario.rol, jti: crypto.randomUUID() }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

let hashFicticio = null;

async function login(email, password, ip) {
  const usuario = await authRepo.buscarPorEmail(email);
  // Se compara siempre contra un hash para no revelar si el correo existe (mismo tiempo de respuesta).
  hashFicticio ??= bcrypt.hashSync(crypto.randomUUID(), env.BCRYPT_ROUNDS);
  const hash = usuario?.password_hash || hashFicticio;
  const ok = await bcrypt.compare(password, hash);

  if (!usuario || !ok) {
    await auditoriaRepo.registrar({
      usuarioId: usuario?.id,
      entidad: 'sesion',
      accion: 'LOGIN_FALLIDO',
      despues: { email },
      ip,
    });
    throw AppError.unauthorized('Credenciales incorrectas');
  }
  if (!usuario.activo) throw AppError.forbidden('El usuario está inactivo. Contacte al administrador.');

  await authRepo.registrarAcceso(usuario.id);
  await auditoriaRepo.registrar({ usuarioId: usuario.id, entidad: 'sesion', accion: 'LOGIN', ip });

  const perfil = await authRepo.buscarContextoUsuario(usuario.id);
  return { token: firmarToken(usuario), usuario: perfilPublico(perfil) };
}

async function logout(usuarioId, { jti, exp }, ip) {
  await authRepo.revocarToken(jti, usuarioId, new Date(exp * 1000));
  await auditoriaRepo.registrar({ usuarioId, entidad: 'sesion', accion: 'LOGOUT', ip });
}

async function perfil(usuarioId) {
  return perfilPublico(await authRepo.buscarContextoUsuario(usuarioId));
}

function perfilPublico(u) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    clienteId: u.cliente_id,
    tecnicoId: u.tecnico_id,
  };
}

async function cambiarPassword(usuarioId, actual, nueva, ip) {
  const hash = await authRepo.buscarPasswordHash(usuarioId);
  if (!(await bcrypt.compare(actual, hash))) {
    throw AppError.businessRule('La contraseña actual es incorrecta');
  }
  if (actual === nueva) throw AppError.businessRule('La nueva contraseña debe ser distinta a la actual');
  await authRepo.actualizarPassword(usuarioId, await hashPassword(nueva));
  await auditoriaRepo.registrar({ usuarioId, entidad: 'usuario', entidadId: usuarioId, accion: 'CAMBIO_PASSWORD', ip });
}

/**
 * Recuperación controlada: genera un token de un solo uso con vigencia limitada.
 * Solo se guarda su hash SHA-256. Como el proyecto no integra un servidor de correo,
 * en desarrollo/pruebas el token se devuelve en la respuesta y se muestra en consola;
 * en producción solo se registra en el log del servidor.
 * Siempre responde igual, exista o no el correo (evita enumeración de usuarios).
 */
async function solicitarRestablecimiento(email, ip) {
  const usuario = await authRepo.buscarPorEmail(email);
  if (!usuario || !usuario.activo) return { token: null };

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const horas = Number(await catalogosRepo.obtenerParametro('HORAS_EXPIRACION_RESET', '1'));
  await authRepo.crearRestablecimiento(usuario.id, tokenHash, new Date(Date.now() + horas * 3600 * 1000));
  await auditoriaRepo.registrar({
    usuarioId: usuario.id,
    entidad: 'usuario',
    entidadId: usuario.id,
    accion: 'SOLICITUD_RESET',
    ip,
  });

  const enlace = `${env.FRONTEND_URL}/restablecer?token=${token}`;
  if (!env.isTest) console.info(`[RESET PASSWORD] ${email}: ${enlace}`);
  return { token: env.isProduction ? null : token };
}

async function restablecerPassword(token, nueva, ip) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const hash = await hashPassword(nueva);
  await withTransaction(async (client) => {
    const reset = await authRepo.buscarRestablecimientoVigente(tokenHash, client);
    if (!reset) throw AppError.businessRule('El enlace de restablecimiento es inválido o expiró');
    await authRepo.actualizarPassword(reset.usuario_id, hash, client);
    await authRepo.marcarRestablecimientoUsado(reset.id, client);
    await auditoriaRepo.registrar(
      { usuarioId: reset.usuario_id, entidad: 'usuario', entidadId: reset.usuario_id, accion: 'RESET_PASSWORD', ip },
      client,
    );
  });
}

module.exports = {
  hashPassword,
  login,
  logout,
  perfil,
  cambiarPassword,
  solicitarRestablecimiento,
  restablecerPassword,
};
