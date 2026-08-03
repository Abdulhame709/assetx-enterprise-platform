/**
 * User entity — ENT-USER (BC-IDENTITY)
 * Reference: Entity Spec (DOC-21) §5.3 · Data Dictionary (DOC-24) TB-USER
 */
export interface User {
  id: string;
  tenant_id: string;
  employee_id: string | null;
  username: string;
  email: string | null;
  /** bcrypt/argon2 hash (never plaintext) — BR-SEC-005 */
  password_hash: string;
  last_login: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Role entity — ENT-ROLE */
export interface Role {
  id: string;
  tenant_id: string;
  name: string;
  role_type: string | null;
  is_active: boolean;
}

/** Permission entity — ENT-PERMISSION (5 permissions, ADL-005) */
export interface Permission {
  id: string;
  tenant_id: string;
  module_name: string;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_print: boolean;
}

export interface Tenant {
  id: string;
  tenant_code: string;
  name: string;
  status: string;
  created_at: Date;
}
