/**
 * Action-type → badge tone mapping for the audit stream (presentation only).
 */
import { BadgeTone } from '@/components/ui/Badge';

export function actionTone(action: string): BadgeTone {
  if (/FAILED|DENIED/.test(action)) return 'danger';
  if (/DELETED|REJECTED/.test(action)) return 'danger';
  if (/WARNING/.test(action)) return 'warning';
  if (/GRANTED|SUCCESS|CREATED|APPROVED|VERIFIED|CLOSED|COMPLETED/.test(action)) return 'success';
  if (/UPDATED|CHANGED|STARTED|EXECUTED/.test(action)) return 'info';
  if (/API_REQUEST/.test(action)) return 'neutral';
  return 'neutral';
}
