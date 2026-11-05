/**
 * Autenticación (JWT Bearer) y autorización por roles.
 * El backend verifica las autorizaciones en cada operación protegida.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const authRepo = require('../repositories/auth.repository');

async function autenticar(req, _res, next) {
  try {
    const header = req.headers.authorization || '';
    const [tipo, token] = header.split(' ');
    if (tipo !== 'Bearer' || !token) throw AppError.unauthorized();

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw AppError.unauthorized('Token inválido o expirado');
    }

    if (await authRepo.tokenRevocado(payload.jti)) {
      throw AppError.unauthorized('La sesión fue cerrada');
    }

    // Se consulta el usuario en cada petición: si fue desactivado o cambió de rol, aplica de inmediato.
    const usuario = await authRepo.buscarContextoUsuario(payload.sub);
    if (!usuario || !usuario.activo) throw AppError.unauthorized('Usuario inactivo o inexistente');

    req.user = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      clienteId: usuario.cliente_id,
      tecnicoId: usuario.tecnico_id,
    };
    req.token = { jti: payload.jti, exp: payload.exp };
    next();
  } catch (err) {
    next(err);
  }
}

/** Restringe la ruta a los roles indicados. */
function autorizar(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.rol)) return next(AppError.forbidden());
    next();
  };
}

module.exports = { autenticar, autorizar };
