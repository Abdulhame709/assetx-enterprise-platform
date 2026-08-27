import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../application/auth.service';

function loadLocalEnvironment(): void {
  const environmentPath = resolve(process.cwd(), '.env');
  if (!existsSync(environmentPath)) return;
  for (const line of readFileSync(environmentPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const [, key, rawValue] = match;
    const value = rawValue.length >= 2 && ((rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'")))
      ? rawValue.slice(1, -1)
      : rawValue;
    process.env[key] = value;
  }
}

function promptHidden(label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) {
      reject(new Error('INTERACTIVE_TERMINAL_REQUIRED'));
      return;
    }
    let value = '';
    const cleanup = () => {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    };
    const onData = (chunk: Buffer) => {
      for (const input of chunk.toString('utf8')) {
      if (input === '\u0003') {
        cleanup();
        reject(new Error('PASSWORD_RESET_CANCELLED'));
        return;
      }
      if (input === '\r' || input === '\n') {
        cleanup();
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (input === '\u007f' || input === '\b') {
        value = value.slice(0, -1);
        process.stdout.write('\b \b');
        return;
      }
      if (!/[\x00-\x1f]/.test(input)) {
        value += input;
        process.stdout.write('•');
      }
      }
    };
    process.stdout.write(label);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}

async function main(): Promise<void> {
  loadLocalEnvironment();
  const username = process.argv[2]?.trim();
  if (!username) throw new Error('USERNAME_REQUIRED: npm run users:reset-local-password -- <username>');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    const auth = app.get(AuthService);
    const reset = await auth.requestPasswordReset(username);
    if (!reset.resetToken) throw new Error('LOCAL_USER_NOT_FOUND');

    const password = await promptHidden('كلمة المرور الجديدة (لن تظهر أثناء الكتابة): ');
    const confirmation = await promptHidden('اكتب كلمة المرور نفسها مرة ثانية: ');
    if (password !== confirmation) throw new Error('PASSWORD_CONFIRMATION_MISMATCH');

    await auth.completePasswordReset(reset.resetToken, password);
    console.log(`تمت إعادة تعيين كلمة مرور المستخدم المحلي: ${username}`);
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('تعذر إكمال إعادة تعيين كلمة المرور:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
