/**
 * Human-friendly mapping of backend error codes (error-codes.ts domains).
 * Prevents raw codes like 'DUPLICATE_LOCATION' from leaking into the UI.
 * Used by forms/pages when surfacing ApiError messages.
 */

const MESSAGES: Record<string, string> = {
  // Master data
  NAME_INVALID: 'Name must be at least 2 characters.',
  COLOR_INVALID: 'Color must be a hex value like #27ae60.',
  DUPLICATE_LOCATION: 'A location with this name already exists in the same parent.',
  DUPLICATE_CATEGORY: 'An asset type with this name already exists.',
  DUPLICATE_STATUS: 'A status with this name already exists.',
  LOCATION_NOT_FOUND: 'Location not found.',
  CATEGORY_NOT_FOUND: 'Asset type not found.',
  STATUS_NOT_FOUND: 'Status not found.',
  PARENT_NOT_FOUND: 'The selected parent no longer exists.',
  LOCATION_HAS_CHILDREN: 'Cannot delete a location that has child locations.',
  // Assets
  ASSET_NAME_INVALID: 'Asset name must be at least 2 characters.',
  ASSET_NOT_FOUND: 'Asset not found.',
  CATEGORY_REQUIRED: 'Please choose an asset type.',
  LOCATION_REQUIRED: 'Please choose a location.',
  STATUS_REQUIRED: 'Please choose a status.',
  QUANTITY_INVALID: 'Quantity must be greater than zero.',
  PRICE_INVALID: 'Price cannot be negative.',
  DEPRECIATION_RATE_INVALID: 'Depreciation rate must be between 0 and 100.',
  // Movements / lifecycle
  MOVEMENT_NOT_FOUND: 'Movement not found.',
  MOVEMENT_NOT_PENDING: 'This movement was already processed.',
  TRANSFER_TARGET_REQUIRED: 'Choose a destination location or custodian for the transfer.',
  SAME_LOCATION: 'The asset is already at this location.',
  DUPLICATE_PENDING: 'A pending movement of this type already exists for this asset.',
  EMPLOYEE_INACTIVE: 'The selected employee is inactive.',
  ASSET_INACTIVE: 'This asset is inactive and cannot be moved.',
  INVALID_TRANSITION: 'This action is not allowed in the asset current state.',
  // Inventory
  INVALID_YEAR: 'Year must be between 2000 and 2100.',
  CYCLE_YEAR_EXISTS: 'An inventory cycle already exists for this year.',
  CYCLE_NOT_FOUND: 'Inventory cycle not found.',
  CYCLE_CLOSED: 'This cycle is closed — records are locked.',
  INVALID_CYCLE_TRANSITION: 'This action is not allowed in the current cycle state.',
  RECORD_NOT_FOUND: 'Inventory record not found.',
  ASSET_NOT_IN_CYCLE: 'This asset is not part of the cycle snapshot.',
  CANNOT_VERIFY_UNINVENTORIED: 'Only counted records can be verified.',
  // Auth
  INVALID_CREDENTIALS: 'Incorrect username or password.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission for this action.',
  SESSION_EXPIRED: 'Your session expired. Please sign in again.',
};

export function humanError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const anyErr = err as { message?: string; status?: number };
  if (anyErr?.status === 404) return 'The requested record was not found.';
  if (anyErr?.status === 403) return MESSAGES.FORBIDDEN;
  if (anyErr?.status === 401) return MESSAGES.SESSION_EXPIRED;
  const raw = typeof anyErr?.message === 'string' ? anyErr.message : null;
  if (!raw) return fallback;
  return MESSAGES[raw] ?? raw;
}
