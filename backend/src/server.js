const http = require('http');
const env = require('./config/env');
const app = require('./app');
const { iniciarSockets } = require('./sockets/io');
const { pool } = require('./config/db');

const server = http.createServer(app);
iniciarSockets(server);

server.listen(env.PORT, () => {
  console.log(`ServiGest API (${env.NODE_ENV}) en http://localhost:${env.PORT}`);
  console.log(`Documentación: http://localhost:${env.PORT}/api/docs`);
});

function apagar() {
  server.close(() => pool.end().then(() => process.exit(0)));
}
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
