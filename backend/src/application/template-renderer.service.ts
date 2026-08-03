/**
 * TemplateRenderer — renders notification templates with {{variable}} substitution.
 * Reference: Phase 11 Task 1 · seed templates use {{var}} syntax
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateRenderer {
  /**
   * Replace {{key}} placeholders in a template with values from the payload.
   * Unknown placeholders are left as-is.
   */
  render(template: string, payload: Record<string, unknown> = {}): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
      const value = this.resolve(payload, key);
      return value === undefined ? match : String(value);
    });
  }

  private resolve(obj: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((acc, part) => {
      if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[part];
      return undefined;
    }, obj);
  }
}
