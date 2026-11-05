/** Carga de adjuntos: tamaño máximo y lista blanca de tipos MIME. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const TIPOS_PERMITIDOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  // Nombre aleatorio: evita path traversal y colisiones; el nombre original se guarda en BD.
  filename: (_req, file, cb) =>
    cb(null, `${crypto.randomUUID()}${TIPOS_PERMITIDOS[file.mimetype] || ''}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
      return cb(AppError.badRequest('Tipo de archivo no permitido (solo JPG, PNG, PDF o TXT)'));
    }
    cb(null, true);
  },
});

function rutaAdjunto(nombreArchivo) {
  return path.join(env.UPLOAD_DIR, path.basename(nombreArchivo));
}

module.exports = { upload, rutaAdjunto };
