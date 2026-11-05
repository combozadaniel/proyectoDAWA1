/**
 * Valida req.body / req.query / req.params con un esquema Zod.
 * Reemplaza el objeto por la versión validada y normalizada.
 */
const AppError = require('../utils/AppError');

function validar(schema, origen = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[origen]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        campo: i.path.join('.') || origen,
        mensaje: i.message,
      }));
      return next(AppError.validation(details));
    }
    if (origen === 'query') {
      // Se guarda en una propiedad propia para no depender de la reasignación de req.query.
      req.validQuery = result.data;
    } else if (origen === 'params') {
      // Se fusiona: el esquema puede validar solo algunos parámetros de la ruta.
      Object.assign(req.params, result.data);
    } else {
      req[origen] = result.data;
    }
    next();
  };
}

module.exports = { validar };
