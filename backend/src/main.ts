/**
 * AssetX Backend — application bootstrap.
 * Boots the NestJS application and (in local/bootstrap mode) applies the
 * verified database migration so the runtime is connected to a real schema.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';
import { loadLocalEnvironment } from './bootstrap/local-environment';

function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  const weakDefaults = ['change-me', 'assetx-local-', 'dev-only'];
  const weak = required.filter((key) =>
    weakDefaults.some((marker) => (process.env[key] ?? '').includes(marker)),
  );

  if (missing.length || weak.length) {
    throw new Error(
      `PRODUCTION_CONFIG_INVALID: missing=${missing.join(',') || 'none'} weak=${weak.join(',') || 'none'}`,
    );
  }

  if (process.env.CORS_ORIGIN?.trim() === '*') {
    throw new Error('PRODUCTION_CONFIG_INVALID: CORS_ORIGIN cannot be *');
  }
}

async function bootstrap() {
  loadLocalEnvironment();
  assertProductionConfig();
  const app = await NestFactory.create(AppModule, { logger: false });
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
  // Match the web proxy target (next.config.mjs -> 127.0.0.1:3001) and the
  // documented PORT=3001 in .env.example. Previously defaulted to 3000, which
  // made the web app get ECONNREFUSED whenever backend/.env was absent.
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
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
