# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS dependencies
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app/web
ARG API_PROXY_TARGET=http://127.0.0.1:3001
ENV API_PROXY_TARGET=${API_PROXY_TARGET}
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV API_PROXY_TARGET=http://backend:3001
WORKDIR /app
COPY --from=build /app/web/public ./public
COPY --from=build /app/web/.next/standalone ./
COPY --from=build /app/web/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
