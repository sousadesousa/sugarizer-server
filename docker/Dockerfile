# Sugarizer Server image, see docker-compose.yml
# The Sugarizer client is mounted at /sugarizer-client (see env/docker.ini)

FROM node:22-bookworm-slim AS dependencies
WORKDIR /sugarizer-server
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim
ENV NODE_ENV=docker
# curl is used by add-admin.sh
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
WORKDIR /sugarizer-server
COPY --from=dependencies /sugarizer-server/node_modules ./node_modules
COPY . .
# the server writes uploaded CSV files in tmp/ and its generated secret in env/
RUN mkdir -p tmp/csv && chown -R node:node tmp env
USER node
EXPOSE 8080 8039
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:8080/api').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "sugarizer.js"]
