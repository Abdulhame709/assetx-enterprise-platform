'use client';

import { Boxes, Wrench, AlertTriangle, Activity } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Badge, LifecycleStateBadge, StatusIndicator } from '@/components/ui/Badge';
import { SearchInput, FilterBar } from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/lib/auth/session-context';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { PERMISSIONS } from '@/lib/auth/permissions';

interface SampleAsset {
  id: string;
  code: string;
  name: string;
  state: string;
  location: string;
  custodian: string;
  value: string;
}

const SAMPLE: SampleAsset[] = [
  { id: '1', code: '2024-0001', name: 'Dell Latitude 5420', state: 'assigned', location: 'HQ / IT', custodian: 'A. Rahman', value: '$1,200' },
  { id: '2', code: '2024-0002', name: 'HP LaserJet M428', state: 'active', location: 'HQ / Ops', custodian: '—', value: '$450' },
  { id: '3', code: '2024-0003', name: 'Forklift Toyota 8F', state: 'in_maintenance', location: 'Warehouse', custodian: '—', value: '$18,500' },
  { id: '4', code: '2023-0011', name: 'Server Rack R550', state: 'active', location: 'DC / Rack 3', custodian: 'IT Dept', value: '$9,200' },
];

const columns: Column<SampleAsset>[] = [
  { key: 'code', header: 'Code', width: '110px' },
  { key: 'name', header: 'Asset' },
  { key: 'state', header: 'Lifecycle', render: (r) => <LifecycleStateBadge state={r.state} /> },
  { key: 'location', header: 'Location' },
  { key: 'custodian', header: 'Custodian' },
  { key: 'value', header: 'Value', align: 'right' },
];

export default function DashboardPage() {
  const { session } = useSession();

  return (
    <div>
      <PageHeader
        title={`Welcome, ${session?.user.displayName?.split(' ')[0] ?? 'there'}`}
        subtitle="Executive overview of your asset estate"
        actions={
          <PermissionGate permission={PERMISSIONS.REPORT_EXPORT}>
            <Button variant="secondary">Export</Button>
          </PermissionGate>
        }
      />

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Assets" value="12,480" icon={Boxes} tone="info" delta={3.2} deltaLabel="vs last month" />
        <KpiCard label="In Maintenance" value="86" icon={Wrench} tone="warning" />
        <KpiCard label="Needs Attention" value="23" icon={AlertTriangle} tone="danger" delta={-1.4} deltaLabel="overdue" />
        <KpiCard label="Utilization" value="74%" icon={Activity} tone="success" delta={0.6} deltaLabel="this quarter" />
      </div>

      {/* Filters + table (design system demo) */}
      <Card>
        <CardHeader
          title="Recent assets"
          subtitle="Sample data demonstrating the table, filters and status components"
          actions={<StatusIndicator tone="success" label="Live" />}
        />
        <div className="mb-4">
          <FilterBar>
            <SearchInput value="" onChange={() => undefined} placeholder="Search assets…" className="w-64" />
            <Button variant="secondary" size="sm">Filter</Button>
          </FilterBar>
        </div>
        <DataTable columns={columns} rows={SAMPLE} rowKey={(r) => r.id} />
      </Card>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone="brand">Design System</Badge>
        <Badge tone="success">Tokens</Badge>
        <Badge tone="warning">Components</Badge>
        <Badge tone="danger">Guard</Badge>
      </div>
    </div>
  );
}
