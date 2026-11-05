const service = require('../services/auth.service');

async function login(req, res) {
  const { email, password } = req.body;
  res.json(await service.login(email, password, req.ip));
}

async function logout(req, res) {
  await service.logout(req.user.id, req.token, req.ip);
  res.status(204).end();
}

async function perfil(req, res) {
  res.json(await service.perfil(req.user.id));
}

async function cambiarPassword(req, res) {
  await service.cambiarPassword(req.user.id, req.body.actual, req.body.nueva, req.ip);
  res.status(204).end();
}

async function olvidePassword(req, res) {
  const { token } = await service.solicitarRestablecimiento(req.body.email, req.ip);
  const body = {
    message: 'Si el correo está registrado, se generó un enlace de restablecimiento válido por tiempo limitado.',
  };
  // Solo fuera de producción (no hay servidor de correo): facilita pruebas y demostración.
  if (token) body.tokenDesarrollo = token;
  res.status(202).json(body);
}

async function restablecerPassword(req, res) {
  await service.restablecerPassword(req.body.token, req.body.password, req.ip);
  res.status(204).end();
}

module.exports = { login, logout, perfil, cambiarPassword, olvidePassword, restablecerPassword };
