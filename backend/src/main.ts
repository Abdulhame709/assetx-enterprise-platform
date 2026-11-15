/**
 * AssetX Backend — application bootstrap.
 * Boots the NestJS application and (in local/bootstrap mode) applies the
 * verified database migration so the runtime is connected to a real schema.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { loadLocalEnvironment } from './bootstrap/local-environment';
import { assertProductionConfig } from './bootstrap/production-config';

async function bootstrap() {
  loadLocalEnvironment();
  assertProductionConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
  // The web app proxies API calls (Next.js rewrite), so the socket address is the
  // proxy. Trust one hop so rate limits and lockout logs use the real client IP.
  // Set TRUST_PROXY_HOPS=0 if the backend is exposed directly to the internet.
  const proxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
  if (proxyHops > 0) app.getHttpAdapter().getInstance().set('trust proxy', proxyHops);
  // The API is JSON-only, so avoid advertising the framework.
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  // Logo uploads arrive as base64 JSON (max 300 KB image), above express's 100 KB default.
  app.useBodyParser('json', { limit: '600kb' });
  app.useBodyParser('urlencoded', { extended: false, limit: '100kb' });
  app.use(helmet());

  const origins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  // Let SIGTERM/SIGINT (docker stop, rolling deploys) drain in-flight requests and
  // close the database pool instead of cutting connections mid-query.
  app.enableShutdownHooks();
  // Match the web proxy target (next.config.mjs -> 127.0.0.1:3001) and the
  // documented PORT=3001 in .env.example. Previously defaulted to 3000, which
  // made the web app get ECONNREFUSED whenever backend/.env was absent.
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  // Connection hygiene under load. Keep-alive must outlive typical proxy/LB idle
  // timeouts (60s) or the proxy reuses sockets we already closed (502s);
  // headersTimeout must be larger than keepAliveTimeout. requestTimeout bounds slow
  // clients (slowloris) and is generous enough for report exports.
  const server = app.getHttpServer();
  server.keepAliveTimeout = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS ?? 65_000);
  server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS ?? 66_000);
  server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS ?? 120_000);

  // eslint-disable-next-line no-console
  console.log(`AssetX Backend listening on :${port}`);
}

if (require.main === module) {
  bootstrap().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('FATAL', err);
    process.exit(1);
  });
}

export { bootstrap };
