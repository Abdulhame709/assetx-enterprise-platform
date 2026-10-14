/**
 * SettingsService — organization-wide settings kept in the key/value `settings` table:
 * official name, logo (PNG/JPEG), and report defaults. Everything here is read by the
 * report generators and the web shell, so a change applies across the whole system.
 */
import { Inject, Injectable } from '@nestjs/common';
import { DatabasePort } from '../core/ports/database.port';
import { DATABASE_PORT } from '../core/ports/tokens';
import { DomainError } from '../common/http/domain-error';

export const SETTING_KEYS = {
  name: 'organization_name',
  logo: 'organization_logo',
  signatures: 'report_signatures',
  orientation: 'report_orientation',
} as const;

export type ReportOrientation = 'auto' | 'portrait' | 'landscape';
const ORIENTATIONS: ReportOrientation[] = ['auto', 'portrait', 'landscape'];
const MAX_NAME = 120;
export const MAX_LOGO_BYTES = 300 * 1024;

export interface OrganizationSettings {
  organization_name: string;
  logo: string | null;
  report_signatures: boolean;
  report_orientation: ReportOrientation;
}

export interface OrganizationSettingsPatch {
  organization_name?: string;
  report_signatures?: boolean;
  report_orientation?: string;
}

/** Returns the image bytes when `value` is a PNG/JPEG data URI (or raw base64) of an allowed size. */
export function decodeLogo(value: string): { bytes: Buffer; mime: 'image/png' | 'image/jpeg' } | null {
  const base64 = value.replace(/^data:image\/(png|jpe?g);base64,/i, '').trim();
  if (!base64 || !/^[A-Za-z0-9+/=\s]+$/.test(base64)) return null;
  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { bytes, mime: 'image/png' };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, mime: 'image/jpeg' };
  return null;
}

@Injectable()
export class SettingsService {
  constructor(@Inject(DATABASE_PORT) private readonly db: DatabasePort) {}

  async get(tenantId: string): Promise<OrganizationSettings> {
    const { rows } = await this.db.queryAsTenant<{ setting_key: string; setting_value: string | null }>(
      tenantId,
      `SELECT setting_key, setting_value FROM settings WHERE tenant_id = $1 AND setting_key = ANY($2::text[])`,
      [tenantId, Object.values(SETTING_KEYS)],
    );
    const map = new Map(rows.map((r) => [r.setting_key, r.setting_value ?? '']));
    let name = (map.get(SETTING_KEYS.name) ?? '').trim();
    if (!name) {
      const tenant = await this.db.query<{ name: string }>(`SELECT name FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]);
      name = tenant.rows[0]?.name ?? '';
    }
    const logoRaw = map.get(SETTING_KEYS.logo) ?? '';
    const orientation = map.get(SETTING_KEYS.orientation) as ReportOrientation;
    return {
      organization_name: name,
      logo: logoRaw && decodeLogo(logoRaw) ? this.toDataUri(logoRaw) : null,
      report_signatures: (map.get(SETTING_KEYS.signatures) ?? 'false') === 'true',
      report_orientation: ORIENTATIONS.includes(orientation) ? orientation : 'auto',
    };
  }

  async update(tenantId: string, patch: OrganizationSettingsPatch): Promise<OrganizationSettings> {
    const entries: [string, string][] = [];
    if (patch.organization_name !== undefined) {
      const name = String(patch.organization_name).trim();
      if (name.length < 2 || name.length > MAX_NAME) throw new DomainError('ORGANIZATION_NAME_INVALID');
      entries.push([SETTING_KEYS.name, name]);
    }
    if (patch.report_signatures !== undefined) {
      if (typeof patch.report_signatures !== 'boolean') throw new DomainError('SETTING_VALUE_INVALID');
      entries.push([SETTING_KEYS.signatures, String(patch.report_signatures)]);
    }
    if (patch.report_orientation !== undefined) {
      if (!ORIENTATIONS.includes(patch.report_orientation as ReportOrientation)) throw new DomainError('SETTING_VALUE_INVALID');
      entries.push([SETTING_KEYS.orientation, patch.report_orientation]);
    }
    for (const [key, value] of entries) await this.upsert(tenantId, key, value);
    return this.get(tenantId);
  }

  async setLogo(tenantId: string, dataUri: unknown): Promise<OrganizationSettings> {
    if (typeof dataUri !== 'string') throw new DomainError('LOGO_INVALID');
    const decoded = decodeLogo(dataUri);
    if (!decoded) throw new DomainError('LOGO_INVALID', { max_kb: MAX_LOGO_BYTES / 1024 });
    await this.upsert(tenantId, SETTING_KEYS.logo, `data:${decoded.mime};base64,${decoded.bytes.toString('base64')}`);
    return this.get(tenantId);
  }

  async clearLogo(tenantId: string): Promise<OrganizationSettings> {
    await this.upsert(tenantId, SETTING_KEYS.logo, '');
    return this.get(tenantId);
  }

  private toDataUri(stored: string): string {
    const decoded = decodeLogo(stored);
    return decoded ? `data:${decoded.mime};base64,${decoded.bytes.toString('base64')}` : '';
  }

  private async upsert(tenantId: string, key: string, value: string): Promise<void> {
    await this.db.queryAsTenant(
      tenantId,
      `INSERT INTO settings (tenant_id, setting_key, setting_value) VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
      [tenantId, key, value],
    );
  }
}
