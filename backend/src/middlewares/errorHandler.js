/**
 * Manejo centralizado de errores.
 * Formato de respuesta: { error: { code, message, details? } }
 * Nunca expone trazas ni detalles internos de la base de datos al cliente.
 */
const multer = require('multer');
const AppError = require('../utils/AppError');
const env = require('../config/env');

// Traducción de errores de PostgreSQL a errores de negocio legibles.
function traducirErrorPg(err) {
  switch (err.code) {
    case '23505':
      return AppError.conflict('Ya existe un registro con esos datos únicos', {
        restriccion: err.constraint,
      });
    case '23503':
      return AppError.conflict(
        'La operación viola la integridad referencial (el registro está relacionado con otros datos o la referencia no existe)',
        { restriccion: err.constraint },
      );
    case '23514':
      return AppError.validation([{ campo: err.constraint, mensaje: 'Restricción de datos no cumplida' }]);
    case '22P02':
      return AppError.badRequest('Formato de dato inválido');
    case 'P0001':
      return AppError.businessRule(err.message);
    default:
      return null;
  }
}

function notFound(req, _res, next) {
  next(new AppError(404, 'RUTA_NO_ENCONTRADA', `Ruta ${req.method} ${req.originalUrl} no existe`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  if (!(error instanceof AppError)) {
    if (err instanceof multer.MulterError) {
      error = AppError.badRequest(
        err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido' : err.message,
      );
    } else if (err.type === 'entity.parse.failed') {
      error = AppError.badRequest('El cuerpo de la petición no es un JSON válido');
    } else if (err.code && typeof err.code === 'string') {
      error = traducirErrorPg(err);
    }
  }

  if (!(error instanceof AppError)) {
    if (!env.isTest) console.error('[ERROR NO CONTROLADO]', err);
    error = new AppError(500, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Intente nuevamente.');
  }

  const body = { error: { code: error.code, message: error.message } };
  if (error.details) body.error.details = error.details;
  res.status(error.status).json(body);
}

module.exports = { errorHandler, notFound };
