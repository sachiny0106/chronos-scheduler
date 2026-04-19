FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Default: start the API server
# Override with: command: ["node", "dist/scheduler.js"] or ["node", "dist/worker.js"]
CMD ["node", "dist/index.js"]
