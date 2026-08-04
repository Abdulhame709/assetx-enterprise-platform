'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/states';

/**
 * PlaceholderPage — temporary stand-in for module routes not yet implemented.
 * Establishes the shell + navigation; business screens land in later phases.
 */
export function PlaceholderPage({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <CardBody>
          <EmptyState
            title={`${title} module`}
            description="This module is part of the AssetX product roadmap and will be implemented in a later phase. The shell and design system are ready."
          />
        </CardBody>
      </Card>
    </div>
  );
}
