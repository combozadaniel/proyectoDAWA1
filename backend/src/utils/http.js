/** Envuelve controladores async para enviar los errores al middleware central. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Normaliza parámetros de paginación. */
function paginacion(query, { maxLimit = 100, defaultLimit = 10 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, offset: (page - 1) * limit };
}

/** Respuesta paginada estándar. */
function respuestaPaginada(data, total, { page, limit }) {
  return {
    data,
    meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = { asyncHandler, paginacion, respuestaPaginada };
