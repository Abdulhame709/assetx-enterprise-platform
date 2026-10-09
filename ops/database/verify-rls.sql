\set ON_ERROR_STOP on

\if :{?tenant_code}
\else
\set tenant_code local_assetx
\endif

BEGIN;

SELECT id AS target_tenant_id
FROM tenants
WHERE tenant_code = :'tenant_code'
LIMIT 1
\gset

\if :{?target_tenant_id}
\else
\echo 'Target tenant was not found'
\quit 1
\endif

INSERT INTO tenants (id, tenant_code, name, status)
VALUES (gen_random_uuid(), '__assetx_rls_probe__', 'AssetX RLS Probe', 'active')
RETURNING id AS probe_tenant_id
\gset

SET LOCAL ROLE authenticated;

SELECT set_config('app.tenant_id', :'target_tenant_id', true);
SELECT 'target_roles=' || count(*) AS result
FROM roles;

SELECT set_config('app.tenant_id', :'probe_tenant_id', true);
SELECT 'probe_roles=' || count(*) AS result
FROM roles;

ROLLBACK;
