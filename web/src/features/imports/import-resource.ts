import { DataImportResource } from './asset-import-api';

export const IMPORT_RESOURCE_COLUMNS: Record<DataImportResource, Array<{ key: string; labelKey: string }>> = {
  assets: [
    { key: 'name', labelKey: 'common.name' }, { key: 'category', labelKey: 'common.type' }, { key: 'location', labelKey: 'common.location' }, { key: 'status', labelKey: 'common.status' }, { key: 'quantity', labelKey: 'common.quantity' },
  ],
  locations: [{ key: 'name', labelKey: 'common.name' }, { key: 'parent', labelKey: 'importData.parentLocation' }, { key: 'location_type', labelKey: 'importData.locationType' }],
  categories: [{ key: 'name', labelKey: 'common.name' }, { key: 'parent', labelKey: 'importData.parentCategory' }],
  statuses: [{ key: 'name', labelKey: 'common.name' }, { key: 'color', labelKey: 'importData.color' }],
  employees: [{ key: 'name', labelKey: 'employees.name' }, { key: 'department', labelKey: 'employees.department' }, { key: 'phone', labelKey: 'importData.phone' }, { key: 'email', labelKey: 'importData.email' }],
};

export const IMPORT_RESOURCE_LABELS: Record<DataImportResource, string> = {
  assets: 'importData.resourceAssets', locations: 'importData.resourceLocations', categories: 'importData.resourceCategories', statuses: 'importData.resourceStatuses', employees: 'importData.resourceEmployees',
};
