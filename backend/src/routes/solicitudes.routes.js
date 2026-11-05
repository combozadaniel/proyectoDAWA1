const { Router } = require('express');
const c = require('../controllers/solicitudes.controller');
const { autenticar, autorizar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validate');
const { upload } = require('../middlewares/upload');
const s = require('../validators/schemas');
const { asyncHandler: h } = require('../utils/http');
const { ROLES, GESTION } = require('../domain/roles');

const router = Router();
const { ADMIN, COORDINADOR, CLIENTE } = ROLES;

router.use(autenticar);
// Todas las rutas con :id validan que sea un entero positivo.
router.param('id', (req, res, next) => validar(s.paramsId, 'params')(req, res, next));

router.get('/', validar(s.listarSolicitudes, 'query'), h(c.listar));
router.post(
  '/',
  autorizar(ADMIN, COORDINADOR, CLIENTE),
  upload.array('adjuntos', 5),
  validar(s.crearSolicitud),
  h(c.crear),
);
router.get('/:id', h(c.obtener));
router.patch('/:id/estado', validar(s.cambiarEstado), h(c.cambiarEstado));
router.post('/:id/asignaciones', autorizar(...GESTION), validar(s.asignar), h(c.asignar));
router.get('/:id/tecnicos-sugeridos', autorizar(...GESTION), h(c.tecnicosSugeridos));
router.get('/:id/historial', h(c.historial));
router.post('/:id/reapertura', autorizar(...GESTION), validar(s.reabrir), h(c.reabrir));
router.post('/:id/comentarios', validar(s.comentario), h(c.comentar));
router.post('/:id/adjuntos', upload.array('adjuntos', 5), h(c.agregarAdjuntos));
router.get('/:id/adjuntos/:adjuntoId', h(c.descargarAdjunto));

module.exports = router;
