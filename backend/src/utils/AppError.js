/**
 * Error de aplicación con código HTTP y código de negocio.
 * El middleware de errores lo traduce a una respuesta JSON segura.
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new AppError(400, 'SOLICITUD_INVALIDA', message, details);
  }
  static validation(details) {
    return new AppError(422, 'VALIDACION', 'Los datos enviados no son válidos', details);
  }
  static unauthorized(message = 'Autenticación requerida') {
    return new AppError(401, 'NO_AUTENTICADO', message);
  }
  static forbidden(message = 'No tiene permisos para realizar esta operación') {
    return new AppError(403, 'PROHIBIDO', message);
  }
  static notFound(recurso = 'Recurso') {
    return new AppError(404, 'NO_ENCONTRADO', `${recurso} no encontrado`);
  }
  static conflict(message, details) {
    return new AppError(409, 'CONFLICTO', message, details);
  }
  static businessRule(message, details) {
    return new AppError(422, 'REGLA_NEGOCIO', message, details);
  }
}

module.exports = AppError;
