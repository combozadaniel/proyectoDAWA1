FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY db ./db
COPY scripts ./scripts
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 4000
# Aplica migraciones pendientes, carga datos demo si SEED_DEMO=true (idempotente) e inicia la API.
CMD ["sh", "-c", "node scripts/migrate.js && if [ \"$SEED_DEMO\" = \"true\" ]; then node scripts/seed.js; fi && node src/server.js"]
