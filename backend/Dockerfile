FROM node:22-slim
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

# Pour exécuter des scripts Python depuis « Scripts & Tâches », décommentez :
# RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    PORT=4000 \
    DATA_DIR=/data \
    SCRIPTS_DIR=/app/scripts

RUN mkdir -p /data && chown -R node:node /data /app
VOLUME /data
EXPOSE 4000
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://localhost:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
