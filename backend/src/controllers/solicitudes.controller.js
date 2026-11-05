const path = require('path');
const service = require('../services/solicitudes.service');

const id = (req) => Number(req.params.id);

async function listar(req, res) {
  res.json(await service.listar(req.user, req.validQuery));
}

async function obtener(req, res) {
  res.json(await service.obtenerDetalle(req.user, id(req)));
}

async function crear(req, res) {
  const s = await service.crear(req.user, req.body, req.files || []);
  res.status(201).location(`/api/solicitudes/${s.id}`).json(s);
}

async function cambiarEstado(req, res) {
  res.json(await service.cambiarEstado(req.user, id(req), req.body));
}

async function asignar(req, res) {
  res.status(201).json(await service.asignar(req.user, id(req), req.body));
}

async function tecnicosSugeridos(req, res) {
  res.json(await service.tecnicosSugeridos(id(req)));
}

async function historial(req, res) {
  res.json(await service.historial(req.user, id(req)));
}

async function reabrir(req, res) {
  res.json(await service.reabrir(req.user, id(req), req.body, req.ip));
}

async function comentar(req, res) {
  res.status(201).json(await service.comentar(req.user, id(req), req.body));
}

async function agregarAdjuntos(req, res) {
  res.status(201).json(await service.agregarAdjuntos(req.user, id(req), req.files));
}

async function descargarAdjunto(req, res) {
  const adj = await service.obtenerAdjunto(req.user, id(req), Number(req.params.adjuntoId));
  res.download(path.resolve(adj.ruta), adj.nombre_original);
}

module.exports = {
  listar,
  obtener,
  crear,
  cambiarEstado,
  asignar,
  tecnicosSugeridos,
  historial,
  reabrir,
  comentar,
  agregarAdjuntos,
  descargarAdjunto,
};
