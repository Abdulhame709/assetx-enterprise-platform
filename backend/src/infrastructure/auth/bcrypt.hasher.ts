/**
 * BcryptHasher — PasswordHasher implementation (bcryptjs, cost factor 12).
 * Reference: Security Architecture (DOC-13) §4.1 · BR-SEC-005
 * Cost ≥ 12 per AAB §11B.
 */
import * as bcrypt from 'bcryptjs';
import { PasswordHasher } from '../../core/ports/auth.port';

const COST = 12;

export class BcryptHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, COST);
  }
  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
