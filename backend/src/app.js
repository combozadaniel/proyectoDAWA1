/**
 * Aplicación Express (capa de API). Se exporta sin escuchar puerto para poder probarla con Supertest.
 *
 * Capas:  routes -> controllers -> services (negocio) -> repositories (acceso a datos) -> PostgreSQL
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const YAML = require('yaml');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const { errorHandler, notFound } = require('./middlewares/errorHandler');

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

// Documentación OpenAPI
const openapi = YAML.parse(fs.readFileSync(path.join(__dirname, 'docs/openapi.yaml'), 'utf8'));
app.get('/api/docs/openapi.json', (_req, res) => res.json(openapi));
app.use(
  '/api/docs',
  helmet({ contentSecurityPolicy: false }),
  swaggerUi.serve,
  swaggerUi.setup(openapi, { customSiteTitle: 'ServiGest API' }),
);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ambiente: env.NODE_ENV }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/solicitudes', require('./routes/solicitudes.routes'));
app.use('/api', require('./routes/gestion.routes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
