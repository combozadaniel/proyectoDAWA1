const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const c = require('../controllers/auth.controller');
const { autenticar } = require('../middlewares/auth');
const { validar } = require('../middlewares/validate');
const s = require('../validators/schemas');
const { asyncHandler: h } = require('../utils/http');
const env = require('../config/env');

const router = Router();

// Protección contra fuerza bruta en endpoints públicos.
const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.isTest ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'DEMASIADOS_INTENTOS', message: 'Demasiados intentos. Espere unos minutos.' } },
});

router.post('/login', limitador, validar(s.login), h(c.login));
router.post('/olvide-password', limitador, validar(s.olvidePassword), h(c.olvidePassword));
router.post('/restablecer-password', limitador, validar(s.restablecerPassword), h(c.restablecerPassword));

router.post('/logout', autenticar, h(c.logout));
router.get('/me', autenticar, h(c.perfil));
router.patch('/me/password', autenticar, validar(s.cambiarPassword), h(c.cambiarPassword));

module.exports = router;
