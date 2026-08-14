# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY backend/tsconfig.json backend/tsconfig.test.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY --from=dependencies /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/package.json
COPY db ./db
USER node
EXPOSE 3001
CMD ["node", "backend/dist/main.js"]
