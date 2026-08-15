\set ON_ERROR_STOP on

BEGIN;

SELECT id AS trial_tenant_id
FROM tenants
WHERE tenant_code = 'trial'
LIMIT 1
\gset

INSERT INTO tenants (id, tenant_code, name, status)
VALUES (gen_random_uuid(), '__assetx_rls_probe__', 'AssetX RLS Probe', 'active')
RETURNING id AS probe_tenant_id
\gset

SET LOCAL ROLE authenticated;

SELECT set_config('app.tenant_id', :'trial_tenant_id', true);
SELECT 'trial_roles=' || count(*) AS result
FROM roles;

SELECT set_config('app.tenant_id', :'probe_tenant_id', true);
SELECT 'probe_roles=' || count(*) AS result
FROM roles;

ROLLBACK;
