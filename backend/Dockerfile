FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
RUN addgroup -S parksaas && adduser -S parksaas -G parksaas
RUN mkdir -p /app/logs && chown -R parksaas:parksaas /app
USER parksaas
EXPOSE 8000
CMD ["node", "src/server.js"]
