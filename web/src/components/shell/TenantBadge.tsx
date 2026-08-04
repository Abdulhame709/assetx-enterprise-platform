import { Badge } from '@/components/ui/Badge';

/** TenantBadge — displays the active tenant context. */
export function TenantBadge({ code }: { code?: string }) {
  if (!code) return null;
  return <Badge tone="brand">{code}</Badge>;
}
