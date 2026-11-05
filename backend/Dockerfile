FROM node:26.13.0-alpine@sha256:c6ad9e9c1d80f6eb607c26b4b0a132ff7a2344fad1c78ea3baa2a7d4c8de6d94 AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
RUN addgroup -S parksaas && adduser -S parksaas -G parksaas
RUN mkdir -p /app/logs && chown -R parksaas:parksaas /app
USER parksaas
EXPOSE 8000
CMD ["node", "src/server.js"]
