/**
 * Carga de configuración por ambiente.
 * Orden: variables del sistema > .env.<NODE_ENV> > .env
 * Los secretos nunca se versionan: ver .env.example
 */
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const NODE_ENV = process.env.NODE_ENV || 'development';
const root = path.resolve(__dirname, '../..');

for (const file of [`.env.${NODE_ENV}`, '.env']) {
  const full = path.join(root, file);
  if (fs.existsSync(full)) dotenv.config({ path: full });
}

function requerida(nombre, porDefecto) {
  const valor = process.env[nombre] ?? porDefecto;
  if (valor === undefined || valor === '') {
    throw new Error(`Falta la variable de entorno obligatoria ${nombre}`);
  }
  return valor;
}

const env = {
  NODE_ENV,
  isProduction: NODE_ENV === 'production',
  isTest: NODE_ENV === 'test',
  PORT: Number(process.env.PORT || 4000),
  DATABASE_URL: requerida('DATABASE_URL'),
  JWT_SECRET: requerida('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  CORS_ORIGIN: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  UPLOAD_DIR: path.resolve(root, process.env.UPLOAD_DIR || 'uploads'),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  BCRYPT_ROUNDS: Number(process.env.BCRYPT_ROUNDS || 10),
};

if (env.isProduction && env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción');
}

module.exports = env;
