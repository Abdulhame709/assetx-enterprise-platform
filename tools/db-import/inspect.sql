-- AssetX: DB inspection script. Safe: read-only queries (no data is changed).
-- Run with: sqlcmd -S <server> -E -d master -W -s"|" -i inspect.sql -o report.txt
SET NOCOUNT ON;

PRINT '===== 1) DATABASES ON THIS SERVER =====';
DECLARE @stmt NVARCHAR(MAX) = N'';
SELECT @stmt = @stmt + N'SELECT ''' + REPLACE(name, '''', '''''') + N''' AS [database], CONVERT(varchar(19), create_date, 120) AS [created], state_desc AS [state];'
FROM sys.databases WHERE database_id > 4;
IF LEN(@stmt) > 0 EXEC sp_executesql @stmt;

PRINT '';
PRINT '===== 2) ALL TABLES WITH ROW COUNTS =====';
SET @stmt = N'';
SELECT @stmt = @stmt + N'BEGIN TRY SELECT ''' + REPLACE(name, '''', '''''') + N''' AS [database], s.name AS [schema], t.name AS [table], SUM(p.rows) AS [rows] FROM [' + name + N'].sys.tables t JOIN [' + name + N'].sys.schemas s ON s.schema_id = t.schema_id JOIN [' + name + N'].sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1) GROUP BY s.name, t.name END TRY BEGIN CATCH SELECT ''' + REPLACE(name, '''', '''''') + N''' AS [database], ''<no access>'' AS [schema], ''<no access>'' AS [table], -1 AS [rows] END CATCH;'
FROM sys.databases WHERE database_id > 4 AND state = 0;
IF LEN(@stmt) > 0 EXEC sp_executesql @stmt;

PRINT '';
PRINT '===== 3) COLUMNS OF ASSET/LOCATION/EMPLOYEE TABLES =====';
SET @stmt = N'';
SELECT @stmt = @stmt + N'BEGIN TRY SELECT ''' + REPLACE(name, '''', '''''') + N''' AS [database], c.TABLE_NAME AS [table], c.ORDINAL_POSITION AS [pos], c.COLUMN_NAME AS [column], c.DATA_TYPE AS [type], c.CHARACTER_MAXIMUM_LENGTH AS [len], c.IS_NULLABLE AS [nullable] FROM [' + name + N'].INFORMATION_SCHEMA.COLUMNS c WHERE c.TABLE_NAME LIKE ''tbl%'' OR c.TABLE_NAME LIKE ''%sset%'' OR c.TABLE_NAME LIKE ''%ocation%'' OR c.TABLE_NAME LIKE ''%mploye%'' END TRY BEGIN CATCH SELECT ''' + REPLACE(name, '''', '''''') + N''' AS [database], ''<no access>'' AS [table], 0 AS [pos], ''<no access>'' AS [column], '''' AS [type], 0 AS [len], '''' AS [nullable] END CATCH;'
FROM sys.databases WHERE database_id > 4 AND state = 0;
IF LEN(@stmt) > 0 EXEC sp_executesql @stmt;

PRINT '';
PRINT '===== 4) RELATIONSHIPS (FOREIGN KEYS) =====';
SET @stmt = N'';
SELECT @stmt = @stmt + N'BEGIN TRY SELECT ''' + REPLACE(name, '''', '''''') + N''' AS [database], o1.name AS [child_table], c1.name AS [child_column], o2.name AS [parent_table], c2.name AS [parent_column] FROM [' + name + N'].sys.foreign_keys fk JOIN [' + name + N'].sys.objects o1 ON o1.object_id = fk.parent_object_id JOIN [' + name + N'].sys.objects o2 ON o2.object_id = fk.referenced_object_id JOIN [' + name + N'].sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id JOIN [' + name + N'].sys.columns c1 ON c1.object_id = fkc.parent_object_id AND c1.column_id = fkc.parent_column_id JOIN [' + name + N'].sys.columns c2 ON c2.object_id = fkc.referenced_object_id AND c2.column_id = fkc.referenced_column_id END TRY BEGIN CATCH SELECT ''' + REPLACE(name, '''', '''''') + N''' AS [database], ''<no access>'' AS [child_table], '''' AS [child_column], '''' AS [parent_table], '''' AS [parent_column] END CATCH;'
FROM sys.databases WHERE database_id > 4 AND state = 0;
IF LEN(@stmt) > 0 EXEC sp_executesql @stmt;

PRINT '';
PRINT '===== 5) SAMPLE ROWS FROM THE MAIN TABLES =====';
IF OBJECT_ID('tempdb..#tbls') IS NOT NULL DROP TABLE #tbls;
CREATE TABLE #tbls ([db] SYSNAME, [sch] SYSNAME, [tbl] SYSNAME);

SET @stmt = N'';
SELECT @stmt = @stmt + N'BEGIN TRY INSERT INTO #tbls ([db], [sch], [tbl]) SELECT ''' + REPLACE(name, '''', '''''') + N''', s.name, t.name FROM [' + name + N'].sys.tables t JOIN [' + name + N'].sys.schemas s ON s.schema_id = t.schema_id WHERE t.name IN (N''tblMainlocations'', N''tblSubLocations'', N''tblAssetTypes'', N''tblSubTypeAssets'', N''tblStatus'', N''tblAssetModels'', N''tblEmployees'', N''tblAssets'') END TRY BEGIN CATCH PRINT ''skipped: no access''; END CATCH;'
FROM sys.databases WHERE database_id > 4 AND state = 0;
IF LEN(@stmt) > 0 EXEC sp_executesql @stmt;

DECLARE @samples NVARCHAR(MAX) = N'';
SELECT @samples = @samples + N'BEGIN TRY SELECT TOP 2 ''' + REPLACE([db], '''', '''''') + N''' AS [database], ''' + REPLACE([tbl], '''', '''''') + N''' AS [table], * FROM [' + [db] + N'].[' + [sch] + N'].[' + [tbl] + N'] END TRY BEGIN CATCH SELECT ''' + REPLACE([db], '''', '''''') + N''' AS [database], ''' + REPLACE([tbl], '''', '''''') + N''' AS [table] END CATCH;'
FROM #tbls ORDER BY [db], [tbl];
IF LEN(@samples) > 0 EXEC sp_executesql @samples;

PRINT '';
PRINT '===== END OF REPORT =====';
