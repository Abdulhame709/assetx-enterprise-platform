/**
 * AssetX Backend — application bootstrap.
 * Boots the NestJS application and (in dev/bootstrap mode) applies the verified
 * database migration so the running backend is connected to a real, migrated schema.
 */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? '*' });
  app.useGlobalFilters(new HttpExceptionFilter());
  const port = Number(process.env.PORT ?? 3000);
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
