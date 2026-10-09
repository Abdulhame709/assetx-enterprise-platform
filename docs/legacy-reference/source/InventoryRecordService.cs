using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using AssetManagement.Helpers;

namespace AssetManagement.Services
{
    public static class InventoryRecordService
    {
        // ══════════════════════════════════════════════════════
        // 1. جلب سجلات الجرد لدورة محددة (أساسي)
        // ══════════════════════════════════════════════════════
        public static DataTable GetInventoryRecords(int cycleId,
            string filterResult = "", int? filterMainLocId = null, string searchText = "")
        {
            string query = BuildBaseQuery() + " WHERE ir.CycleID = @CycleID";

            if (!string.IsNullOrEmpty(filterResult) && filterResult != "الكل")
                query += " AND ir.InventoryResult = @FilterResult";
            if (filterMainLocId.HasValue && filterMainLocId.Value > 0)
                query += " AND ir.ExpectedMainLocID = @FilterMainLocID";
            if (!string.IsNullOrEmpty(searchText))
                query += " AND (a.AssetName LIKE @Search OR a.BaseAssetCode LIKE @Search)";

            query += " ORDER BY ir.InventoryResult, a.AssetName";

            List<SqlParameter> p = new List<SqlParameter>();
            p.Add(new SqlParameter("@CycleID", cycleId));
            if (!string.IsNullOrEmpty(filterResult) && filterResult != "الكل")
                p.Add(new SqlParameter("@FilterResult", filterResult));
            if (filterMainLocId.HasValue && filterMainLocId.Value > 0)
                p.Add(new SqlParameter("@FilterMainLocID", filterMainLocId.Value));
            if (!string.IsNullOrEmpty(searchText))
                p.Add(new SqlParameter("@Search", "%" + searchText + "%"));

            return DatabaseHelper.GetData(query, p.ToArray());
        }

        // ══════════════════════════════════════════════════════
        // 2. تحديث سجل جرد واحد (مع الموظف الفعلي)
        // ══════════════════════════════════════════════════════
        public static bool UpdateInventoryRecord(
            int recordId, int? actualMainLocId, int? actualSubLocId,
            int actualQuantity, int? actualStatusId, int? actualEmployeeId,
            int expectedQuantity, int? expectedMainLocId, int? expectedSubLocId,
            string inventoryBy, string notes,
            out string inventoryResult, out string errorMessage)
        {
            inventoryResult = "";
            errorMessage = "";
            try
            {
                if (actualQuantity == 0)
                    inventoryResult = "مفقود";
                else if (actualQuantity < expectedQuantity)
                    inventoryResult = "عجز";
                else if (actualQuantity > expectedQuantity)
                    inventoryResult = "زيادة";
                else if ((actualMainLocId != expectedMainLocId) || (actualSubLocId != expectedSubLocId))
                    inventoryResult = "منقول";
                else
                    inventoryResult = "مطابق";

                string query = @"
                    UPDATE tblInventoryRecords 
                    SET ActualMainLocID=@ActualMainLocID, ActualSubLocID=@ActualSubLocID,
                        ActualQuantity=@ActualQuantity, ActualStatusID=@ActualStatusID,
                        ActualEmployeeID=@ActualEmployeeID,
                        InventoryResult=@Result, InventoryDate=GETDATE(),
                        InventoryBy=@InventoryBy, Notes=@Notes
                    WHERE RecordID=@RecordID";

                SqlParameter[] parameters = {
                    new SqlParameter("@ActualMainLocID", actualMainLocId.HasValue ? (object)actualMainLocId.Value : DBNull.Value),
                    new SqlParameter("@ActualSubLocID", actualSubLocId.HasValue ? (object)actualSubLocId.Value : DBNull.Value),
                    new SqlParameter("@ActualQuantity", actualQuantity),
                    new SqlParameter("@ActualStatusID", actualStatusId.HasValue ? (object)actualStatusId.Value : DBNull.Value),
                    new SqlParameter("@ActualEmployeeID", actualEmployeeId.HasValue ? (object)actualEmployeeId.Value : DBNull.Value),
                    new SqlParameter("@Result", inventoryResult),
                    new SqlParameter("@InventoryBy", (object)inventoryBy ?? DBNull.Value),
                    new SqlParameter("@Notes", (object)notes ?? DBNull.Value),
                    new SqlParameter("@RecordID", recordId)
                };
                return DatabaseHelper.ExecuteNonQuery(query, parameters) > 0;
            }
            catch (Exception ex) { errorMessage = ex.Message; return false; }
        }

        // ══════════════════════════════════════════════════════
        // 3. مطابقة سريعة لسجل واحد (مع نسخ الموظف)
        // ══════════════════════════════════════════════════════
        public static bool QuickMatchRecord(int recordId, string inventoryBy, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                string query = @"
                    UPDATE tblInventoryRecords 
                    SET ActualMainLocID=ExpectedMainLocID, ActualSubLocID=ExpectedSubLocID,
                        ActualQuantity=ExpectedQuantity, ActualStatusID=ExpectedStatusID,
                        ActualEmployeeID=ExpectedEmployeeID,
                        InventoryResult=N'مطابق', InventoryDate=GETDATE(), InventoryBy=@InventoryBy
                    WHERE RecordID=@RecordID";
                return DatabaseHelper.ExecuteNonQuery(query, new[] {
                    new SqlParameter("@InventoryBy", (object)inventoryBy ?? DBNull.Value),
                    new SqlParameter("@RecordID", recordId) }) > 0;
            }
            catch (Exception ex) { errorMessage = ex.Message; return false; }
        }

        // ══════════════════════════════════════════════════════
        // 4. مطابقة سريعة لموقع كامل
        // ══════════════════════════════════════════════════════
        public static int QuickMatchByLocation(int cycleId, int mainLocationId,
            string inventoryBy, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                string query = @"
                    UPDATE tblInventoryRecords 
                    SET ActualMainLocID=ExpectedMainLocID, ActualSubLocID=ExpectedSubLocID,
                        ActualQuantity=ExpectedQuantity, ActualStatusID=ExpectedStatusID,
                        ActualEmployeeID=ExpectedEmployeeID,
                        InventoryResult=N'مطابق', InventoryDate=GETDATE(), InventoryBy=@InventoryBy
                    WHERE CycleID=@CycleID AND ExpectedMainLocID=@MainLocID AND InventoryResult=N'لم يُجرد'";
                return DatabaseHelper.ExecuteNonQuery(query, new[] {
                    new SqlParameter("@InventoryBy", (object)inventoryBy ?? DBNull.Value),
                    new SqlParameter("@CycleID", cycleId),
                    new SqlParameter("@MainLocID", mainLocationId) });
            }
            catch (Exception ex) { errorMessage = ex.Message; return -1; }
        }

        // ══════════════════════════════════════════════════════
        // 5. إلغاء جرد سجل
        // ══════════════════════════════════════════════════════
        public static bool ResetRecord(int recordId, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                string query = @"
                    UPDATE tblInventoryRecords 
                    SET ActualMainLocID=NULL, ActualSubLocID=NULL, ActualQuantity=NULL,
                        ActualStatusID=NULL, ActualEmployeeID=NULL,
                        InventoryResult=N'لم يُجرد', InventoryDate=NULL, InventoryBy=NULL,
                        IsVerified=0, VerifiedBy=NULL, VerifiedDate=NULL, Notes=NULL
                    WHERE RecordID=@RecordID";
                return DatabaseHelper.ExecuteNonQuery(query, new[] { new SqlParameter("@RecordID", recordId) }) > 0;
            }
            catch (Exception ex) { errorMessage = ex.Message; return false; }
        }

        // ══════════════════════════════════════════════════════
        // 6. تحقق من سجل
        // ══════════════════════════════════════════════════════
        public static bool VerifyRecord(int recordId, string verifiedBy, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                string query = "UPDATE tblInventoryRecords SET IsVerified=1, VerifiedBy=@V, VerifiedDate=GETDATE() WHERE RecordID=@R";
                return DatabaseHelper.ExecuteNonQuery(query, new[] {
                    new SqlParameter("@V", (object)verifiedBy ?? DBNull.Value),
                    new SqlParameter("@R", recordId) }) > 0;
            }
            catch (Exception ex) { errorMessage = ex.Message; return false; }
        }

        // ══════════════════════════════════════════════════════
        // 7. إحصائيات التقدم
        // ══════════════════════════════════════════════════════
        public static DataTable GetCycleProgress(int cycleId)
        {
            string query = @"
                SELECT COUNT(*) AS TotalAssets,
                    SUM(CASE WHEN InventoryResult!=N'لم يُجرد' THEN 1 ELSE 0 END) AS Inventoried,
                    SUM(CASE WHEN InventoryResult=N'مطابق' THEN 1 ELSE 0 END) AS Matched,
                    SUM(CASE WHEN InventoryResult=N'عجز' THEN 1 ELSE 0 END) AS Deficit,
                    SUM(CASE WHEN InventoryResult=N'زيادة' THEN 1 ELSE 0 END) AS Surplus,
                    SUM(CASE WHEN InventoryResult=N'منقول' THEN 1 ELSE 0 END) AS Transferred,
                    SUM(CASE WHEN InventoryResult=N'مفقود' THEN 1 ELSE 0 END) AS Missing,
                    SUM(CASE WHEN InventoryResult=N'لم يُجرد' THEN 1 ELSE 0 END) AS NotInventoried
                FROM tblInventoryRecords WHERE CycleID=@CycleID";
            return DatabaseHelper.GetData(query, new[] { new SqlParameter("@CycleID", cycleId) });
        }

        // ══════════════════════════════════════════════════════
        // 8-10. جلب البيانات المرجعية
        // ══════════════════════════════════════════════════════
        public static DataTable GetMainLocations()
        {
            return DatabaseHelper.GetData("SELECT MainLocationID, MainLocationName FROM tblMainLocations WHERE IsActive=1 ORDER BY MainLocationName");
        }

        public static DataTable GetSubLocations(int mainLocationId)
        {
            return DatabaseHelper.GetData(
                "SELECT SubLocationID, SubLocationName FROM tblSubLocations WHERE MainLocationID=@M AND IsActive=1 ORDER BY SubLocationName",
                new[] { new SqlParameter("@M", mainLocationId) });
        }

        public static DataTable GetStatuses()
        {
            return DatabaseHelper.GetData("SELECT StatusID, StatusName FROM tblStatus WHERE IsActive=1 ORDER BY StatusID");
        }

        public static DataTable GetEmployees()
        {
            return DatabaseHelper.GetData("SELECT EmployeeID, EmployeeName FROM tblEmployees WHERE IsActive=1 ORDER BY EmployeeName");
        }

        public static DataTable GetSubTypes()
        {
            return DatabaseHelper.GetData(
                "SELECT SubTypeID, SubTypeName FROM tblSubTypeAssets WHERE IsActive=1 ORDER BY SubTypeName");
        }

        // ══════════════════════════════════════════════════════
        // 11. جلب سجلات الجرد الكاملة (مع كل الفلاتر)
        // ══════════════════════════════════════════════════════
        public static DataTable GetFullInventoryRecords(int cycleId,
            string filterResult, int? filterMainLocId, int? filterSubLocId,
            int? filterEmployeeId, string filterVerified, string searchText,
            int? filterSubTypeId = null)
        {
            string query = BuildBaseQuery() + " WHERE ir.CycleID = @CycleID";

            if (!string.IsNullOrEmpty(filterResult) && filterResult != "الكل")
                query += " AND ir.InventoryResult = N'" + filterResult.Replace("'", "''") + "'";
            if (filterMainLocId.HasValue && filterMainLocId.Value > 0)
                query += " AND ir.ExpectedMainLocID = " + filterMainLocId.Value;
            if (filterSubLocId.HasValue && filterSubLocId.Value > 0)
                query += " AND ir.ExpectedSubLocID = " + filterSubLocId.Value;
            if (filterEmployeeId.HasValue && filterEmployeeId.Value > 0)
                query += " AND ir.ExpectedEmployeeID = " + filterEmployeeId.Value;
            if (filterSubTypeId.HasValue && filterSubTypeId.Value > 0)
                query += " AND a.SubTypeID = " + filterSubTypeId.Value;
            if (filterVerified == "تم التحقق")
                query += " AND ir.IsVerified = 1";
            else if (filterVerified == "لم يُتحقق")
                query += " AND ir.IsVerified = 0";
            if (!string.IsNullOrEmpty(searchText))
                query += " AND (a.AssetName LIKE N'%" + searchText.Replace("'", "''") + "%' OR a.BaseAssetCode LIKE N'%" + searchText.Replace("'", "''") + "%')";

            query += " ORDER BY ir.InventoryResult, a.AssetName";
            return DatabaseHelper.GetData(query, new[] { new SqlParameter("@CycleID", cycleId) });
        }

        // ══════════════════════════════════════════════════════
        // 12. بيانات النموذج الفارغ
        // ══════════════════════════════════════════════════════
        public static DataTable GetBlankFormData(int cycleId, int? mainLocationId = null)
        {
            string query = @"
                SELECT ir.RecordID, a.BaseAssetCode, a.AssetName,
                    ISNULL(ml.MainLocationName,'') AS ExpectedMainLocName,
                    ISNULL(sl.SubLocationName,'') AS ExpectedSubLocName,
                    ISNULL(ir.ExpectedQuantity,0) AS ExpectedQuantity,
                    ISNULL(s.StatusName,'') AS ExpectedStatusName,
                    ISNULL(emp.EmployeeName,'') AS EmployeeName
                FROM tblInventoryRecords ir
                INNER JOIN tblAssets a ON ir.AssetID=a.AssetID
                LEFT JOIN tblMainLocations ml ON ir.ExpectedMainLocID=ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON ir.ExpectedSubLocID=sl.SubLocationID
                LEFT JOIN tblStatus s ON ir.ExpectedStatusID=s.StatusID
                LEFT JOIN tblEmployees emp ON ir.ExpectedEmployeeID=emp.EmployeeID
                WHERE ir.CycleID=@CycleID";
            if (mainLocationId.HasValue && mainLocationId.Value > 0)
                query += " AND ir.ExpectedMainLocID=" + mainLocationId.Value;
            query += " ORDER BY ml.MainLocationName, sl.SubLocationName, a.AssetName";
            return DatabaseHelper.GetData(query, new[] { new SqlParameter("@CycleID", cycleId) });
        }

        // ══════════════════════════════════════════════════════
        // الاستعلام الأساسي المشترك
        // ══════════════════════════════════════════════════════
        private static string BuildBaseQuery()
        {
            return @"
                SELECT 
                    ir.RecordID, ir.CycleID, ir.AssetID,
                    a.AssetName, a.BaseAssetCode, a.FullAssetCode,
                    ISNULL(st.SubTypeName, ISNULL(at.AssetTypeName,'')) AS SubTypeName,
                    ir.ExpectedMainLocID, ir.ExpectedSubLocID,
                    ISNULL(ml1.MainLocationName,'') AS ExpectedMainLocName,
                    ISNULL(sl1.SubLocationName,'') AS ExpectedSubLocName,
                    ISNULL(ir.ExpectedQuantity,0) AS ExpectedQuantity,
                    ir.ExpectedStatusID,
                    ISNULL(s1.StatusName,'') AS ExpectedStatusName,
                    ir.ExpectedEmployeeID,
                    ISNULL(empExp.EmployeeName,'') AS EmployeeName,
                    ir.ActualMainLocID, ir.ActualSubLocID,
                    ISNULL(ml2.MainLocationName,'') AS ActualMainLocName,
                    ISNULL(sl2.SubLocationName,'') AS ActualSubLocName,
                    ir.ActualQuantity, ir.ActualStatusID,
                    ISNULL(s2.StatusName,'') AS ActualStatusName,
                    ir.ActualEmployeeID,
                    ISNULL(empAct.EmployeeName,'') AS ActualEmployeeName,
                    ir.InventoryResult, ir.InventoryDate,
                    ISNULL(ir.InventoryBy,'') AS InventoryBy,
                    ir.IsVerified, ISNULL(ir.VerifiedBy,'') AS VerifiedBy,
                    ir.VerifiedDate, ISNULL(ir.Notes,'') AS Notes
                FROM tblInventoryRecords ir
                INNER JOIN tblAssets a ON ir.AssetID=a.AssetID
                LEFT JOIN tblAssetTypes at ON a.AssetTypeID=at.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID=st.SubTypeID
                LEFT JOIN tblMainLocations ml1 ON ir.ExpectedMainLocID=ml1.MainLocationID
                LEFT JOIN tblSubLocations sl1 ON ir.ExpectedSubLocID=sl1.SubLocationID
                LEFT JOIN tblStatus s1 ON ir.ExpectedStatusID=s1.StatusID
                LEFT JOIN tblEmployees empExp ON ir.ExpectedEmployeeID=empExp.EmployeeID
                LEFT JOIN tblMainLocations ml2 ON ir.ActualMainLocID=ml2.MainLocationID
                LEFT JOIN tblSubLocations sl2 ON ir.ActualSubLocID=sl2.SubLocationID
                LEFT JOIN tblStatus s2 ON ir.ActualStatusID=s2.StatusID
                LEFT JOIN tblEmployees empAct ON ir.ActualEmployeeID=empAct.EmployeeID";
        }        // ══════════════════════════════════════════════════════
        // جلب المواقع الفرعية بشكل هرمي (مع مسافات بادئة)
        // ══════════════════════════════════════════════════════
        public static DataTable GetSubLocationsHierarchical(int mainLocationId)
        {
            string query = @"
                ;WITH SubLocTree AS (
                    -- المستوى الأول: المواقع التي ليس لها أب (الجذور)
                    SELECT 
                        SubLocationID,
                        SubLocationName,
                        ParentSubLocationID,
                        MainLocationID,
                        CAST(SubLocationName AS NVARCHAR(500)) AS DisplayName,
                        CAST(SubLocationName AS NVARCHAR(500)) AS FullPath,
                        0 AS TreeLevel,
                        CAST(RIGHT('000' + CAST(SubLocationID AS VARCHAR), 4) AS VARCHAR(500)) AS SortKey
                    FROM tblSubLocations
                    WHERE MainLocationID = @MainLocID 
                      AND (ParentSubLocationID IS NULL OR ParentSubLocationID = 0)
                      AND IsActive = 1
                    
                    UNION ALL
                    
                    -- المستويات التالية: الأبناء
                    SELECT 
                        c.SubLocationID,
                        c.SubLocationName,
                        c.ParentSubLocationID,
                        c.MainLocationID,
                        CAST(REPLICATE(N'    ', p.TreeLevel + 1) + N'└─ ' + c.SubLocationName AS NVARCHAR(500)),
                        CAST(p.FullPath + N' / ' + c.SubLocationName AS NVARCHAR(500)),
                        p.TreeLevel + 1,
                        CAST(p.SortKey + '-' + RIGHT('000' + CAST(c.SubLocationID AS VARCHAR), 4) AS VARCHAR(500))
                    FROM tblSubLocations c
                    INNER JOIN SubLocTree p ON c.ParentSubLocationID = p.SubLocationID
                    WHERE c.IsActive = 1
                )
                SELECT 
                    SubLocationID,
                    SubLocationName,
                    DisplayName,
                    FullPath,
                    TreeLevel,
                    ParentSubLocationID
                FROM SubLocTree
                ORDER BY SortKey";

            return DatabaseHelper.GetData(query,
                new[] { new SqlParameter("@MainLocID", mainLocationId) });
        }

        // ══════════════════════════════════════════════════════
        // جلب كل أرقام المواقع الفرعية (الأبناء والأحفاد) لموقع فرعي محدد
        // ══════════════════════════════════════════════════════
        public static string GetAllDescendantSubLocationIds(int subLocationId)
        {
            string query = @"
                ;WITH SubLocTree AS (
                    -- الموقع المحدد نفسه
                    SELECT SubLocationID
                    FROM tblSubLocations
                    WHERE SubLocationID = @SubLocID AND IsActive = 1
                    
                    UNION ALL
                    
                    -- كل الأبناء والأحفاد
                    SELECT c.SubLocationID
                    FROM tblSubLocations c
                    INNER JOIN SubLocTree p ON c.ParentSubLocationID = p.SubLocationID
                    WHERE c.IsActive = 1
                )
                SELECT SubLocationID FROM SubLocTree";

            DataTable dt = DatabaseHelper.GetData(query,
                new[] { new SqlParameter("@SubLocID", subLocationId) });

            if (dt == null || dt.Rows.Count == 0) return subLocationId.ToString();

            string ids = "";
            foreach (DataRow row in dt.Rows)
            {
                if (ids != "") ids += ",";
                ids += row["SubLocationID"].ToString();
            }
            return ids;
        }

        // ══════════════════════════════════════════════════════
        // جلب سجلات الجرد مع فلتر هرمي للمواقع الفرعية
        // ══════════════════════════════════════════════════════
        public static DataTable GetFullInventoryRecordsHierarchical(int cycleId,
            string filterResult, int? filterMainLocId, int? filterSubLocId,
            int? filterEmployeeId, string filterVerified, string searchText,
            int? filterSubTypeId = null)
        {
            string query = BuildBaseQuery() + " WHERE ir.CycleID = @CycleID";

            if (!string.IsNullOrEmpty(filterResult) && filterResult != "الكل")
                query += " AND ir.InventoryResult = N'" + filterResult.Replace("'", "''") + "'";

            if (filterMainLocId.HasValue && filterMainLocId.Value > 0)
                query += " AND ir.ExpectedMainLocID = " + filterMainLocId.Value;

            // فلتر هرمي: يشمل الموقع المحدد + كل أبنائه وأحفاده
            if (filterSubLocId.HasValue && filterSubLocId.Value > 0)
            {
                string allIds = GetAllDescendantSubLocationIds(filterSubLocId.Value);
                query += " AND ir.ExpectedSubLocID IN (" + allIds + ")";
            }

            if (filterEmployeeId.HasValue && filterEmployeeId.Value > 0)
                query += " AND ir.ExpectedEmployeeID = " + filterEmployeeId.Value;

            if (filterSubTypeId.HasValue && filterSubTypeId.Value > 0)
                query += " AND a.SubTypeID = " + filterSubTypeId.Value;

            if (filterVerified == "تم التحقق")
                query += " AND ir.IsVerified = 1";
            else if (filterVerified == "لم يُتحقق")
                query += " AND ir.IsVerified = 0";

            if (!string.IsNullOrEmpty(searchText))
                query += " AND (a.AssetName LIKE N'%" + searchText.Replace("'", "''") +
                         "%' OR a.BaseAssetCode LIKE N'%" + searchText.Replace("'", "''") + "%')";

            query += " ORDER BY sl1.SubLocationName, ir.InventoryResult, a.AssetName";

            return DatabaseHelper.GetData(query,
                new[] { new SqlParameter("@CycleID", cycleId) });
        }
    }
}