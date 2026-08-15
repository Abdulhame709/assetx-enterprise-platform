using System;
using System.Data;
using System.Data.SqlClient;
using AssetManagement.Helpers;

namespace AssetManagement.Services
{
    /// <summary>
    /// خدمة حركة الأصول: نقل، تسليم، استلام، إتلاف، استغناء
    /// </summary>
    public static class AssetMovementService
    {
        // ══════════════════════════════════════════════════════
        // 1. البحث عن أصل بالاسم أو الكود
        // ══════════════════════════════════════════════════════
        public static DataTable SearchAssets(string searchText)
        {
            string query = @"
                SELECT 
                    a.AssetID, a.BaseAssetCode, a.AssetName,
                    ISNULL(st.SubTypeName, ISNULL(at.AssetTypeName,'')) AS SubTypeName,
                    ISNULL(ml.MainLocationName,'') AS MainLocationName,
                    ISNULL(sl.SubLocationName,'') AS SubLocationName,
                    ISNULL(emp.EmployeeName,'') AS EmployeeName,
                    ISNULL(s.StatusName,'') AS StatusName,
                    a.MainLocationID, a.SubLocationID, a.EmployeeID, a.StatusID,
                    ISNULL(a.Quantity, 1) AS Quantity
                FROM tblAssets a
                LEFT JOIN tblAssetTypes at ON a.AssetTypeID = at.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblEmployees emp ON a.EmployeeID = emp.EmployeeID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                WHERE a.IsActive = 1 
                  AND (a.AssetName LIKE @Search 
                       OR a.BaseAssetCode LIKE @Search 
                       OR a.FullAssetCode LIKE @Search)
                ORDER BY a.AssetName";

            return DatabaseHelper.GetData(query,
                new[] { new SqlParameter("@Search", "%" + searchText + "%") });
        }

        // ══════════════════════════════════════════════════════
        // 2. جلب بيانات أصل واحد
        // ══════════════════════════════════════════════════════
        public static DataTable GetAssetDetails(int assetId)
        {
            string query = @"
                SELECT 
                    a.AssetID, a.BaseAssetCode, a.AssetName, a.FullAssetCode,
                    ISNULL(st.SubTypeName, ISNULL(at.AssetTypeName,'')) AS SubTypeName,
                    ISNULL(ml.MainLocationName,'') AS MainLocationName,
                    ISNULL(sl.SubLocationName,'') AS SubLocationName,
                    ISNULL(emp.EmployeeName,'') AS EmployeeName,
                    ISNULL(s.StatusName,'') AS StatusName,
                    a.MainLocationID, a.SubLocationID, a.EmployeeID, a.StatusID,
                    ISNULL(a.Quantity, 1) AS Quantity,
                    a.SerialNumber
                FROM tblAssets a
                LEFT JOIN tblAssetTypes at ON a.AssetTypeID = at.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblEmployees emp ON a.EmployeeID = emp.EmployeeID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                WHERE a.AssetID = @AssetID";

            return DatabaseHelper.GetData(query,
                new[] { new SqlParameter("@AssetID", assetId) });
        }

        // ══════════════════════════════════════════════════════
        // 3. تنفيذ حركة نقل أصل
        // ══════════════════════════════════════════════════════
        public static bool TransferAsset(
            int assetId,
            string movementType,
            int? fromMainLocId, int? fromSubLocId, int? fromEmployeeId,
            int? toMainLocId, int? toSubLocId, int? toEmployeeId,
            int? oldStatusId, int? newStatusId,
            int quantity,
            string reason, string referenceNo, string approvedBy,
            string notes, string createdBy,
            out string errorMessage)
        {
            errorMessage = "";
            try
            {
                // ── 1. تسجيل الحركة في tblAssetMovements ──
                string insertQuery = @"
                    INSERT INTO tblAssetMovements 
                        (AssetID, MovementDate, MovementType,
                         FromMainLocationID, FromSubLocationID, FromEmployeeID,
                         ToMainLocationID, ToSubLocationID, ToEmployeeID,
                         OldStatusID, NewStatusID, Quantity,
                         Reason, ReferenceNo, ApprovedBy, Notes,
                         CreatedDate, CreatedBy)
                    VALUES 
                        (@AssetID, GETDATE(), @MovementType,
                         @FromMainLocID, @FromSubLocID, @FromEmpID,
                         @ToMainLocID, @ToSubLocID, @ToEmpID,
                         @OldStatusID, @NewStatusID, @Quantity,
                         @Reason, @ReferenceNo, @ApprovedBy, @Notes,
                         GETDATE(), @CreatedBy)";

                SqlParameter[] insertParams = {
                    new SqlParameter("@AssetID", assetId),
                    new SqlParameter("@MovementType", movementType),
                    new SqlParameter("@FromMainLocID", (object)fromMainLocId ?? DBNull.Value),
                    new SqlParameter("@FromSubLocID", (object)fromSubLocId ?? DBNull.Value),
                    new SqlParameter("@FromEmpID", (object)fromEmployeeId ?? DBNull.Value),
                    new SqlParameter("@ToMainLocID", (object)toMainLocId ?? DBNull.Value),
                    new SqlParameter("@ToSubLocID", (object)toSubLocId ?? DBNull.Value),
                    new SqlParameter("@ToEmpID", (object)toEmployeeId ?? DBNull.Value),
                    new SqlParameter("@OldStatusID", (object)oldStatusId ?? DBNull.Value),
                    new SqlParameter("@NewStatusID", (object)newStatusId ?? DBNull.Value),
                    new SqlParameter("@Quantity", quantity),
                    new SqlParameter("@Reason", (object)reason ?? DBNull.Value),
                    new SqlParameter("@ReferenceNo", (object)referenceNo ?? DBNull.Value),
                    new SqlParameter("@ApprovedBy", (object)approvedBy ?? DBNull.Value),
                    new SqlParameter("@Notes", (object)notes ?? DBNull.Value),
                    new SqlParameter("@CreatedBy", (object)createdBy ?? DBNull.Value)
                };

                int rows = DatabaseHelper.ExecuteNonQuery(insertQuery, insertParams);
                if (rows <= 0)
                {
                    errorMessage = "فشل في تسجيل الحركة!";
                    return false;
                }

                // ── 2. تحديث بيانات الأصل في tblAssets ──
                string updateQuery = @"
                    UPDATE tblAssets SET 
                        ModifiedDate = GETDATE(),
                        ModifiedBy = @CreatedBy";

                // تحديث الموقع إذا تم تحديده
                if (toMainLocId.HasValue)
                    updateQuery += ", MainLocationID = @ToMainLocID";
                if (toSubLocId.HasValue)
                    updateQuery += ", SubLocationID = @ToSubLocID";
                // تحديث الموظف
                if (movementType == "نقل" || movementType == "تسليم" || movementType == "استلام")
                {
                    updateQuery += ", EmployeeID = @ToEmpID";
                }
                // تحديث الحالة
                if (newStatusId.HasValue)
                    updateQuery += ", StatusID = @NewStatusID";

                // إذا كان استغناء أو إتلاف → تعطيل الأصل
                if (movementType == "إتلاف" || movementType == "استغناء")
                    updateQuery += ", IsActive = 0";

                updateQuery += " WHERE AssetID = @AssetID";

                SqlParameter[] updateParams = {
                    new SqlParameter("@CreatedBy", (object)createdBy ?? DBNull.Value),
                    new SqlParameter("@ToMainLocID", (object)toMainLocId ?? DBNull.Value),
                    new SqlParameter("@ToSubLocID", (object)toSubLocId ?? DBNull.Value),
                    new SqlParameter("@ToEmpID", (object)toEmployeeId ?? DBNull.Value),
                    new SqlParameter("@NewStatusID", (object)newStatusId ?? DBNull.Value),
                    new SqlParameter("@AssetID", assetId)
                };

                DatabaseHelper.ExecuteNonQuery(updateQuery, updateParams);

                return true;
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return false;
            }
        }

        // ══════════════════════════════════════════════════════
        // 4. جلب سجل حركة أصل محدد
        // ══════════════════════════════════════════════════════
        public static DataTable GetAssetMovements(int? assetId = null,
            DateTime? fromDate = null, DateTime? toDate = null,
            string movementType = "")
        {
            string query = @"
                SELECT 
                    m.MovementID, m.AssetID,
                    a.BaseAssetCode, a.AssetName,
                    m.MovementDate, m.MovementType,
                    ISNULL(ml1.MainLocationName,'') AS FromMainLocName,
                    ISNULL(sl1.SubLocationName,'') AS FromSubLocName,
                    ISNULL(emp1.EmployeeName,'') AS FromEmployeeName,
                    ISNULL(ml2.MainLocationName,'') AS ToMainLocName,
                    ISNULL(sl2.SubLocationName,'') AS ToSubLocName,
                    ISNULL(emp2.EmployeeName,'') AS ToEmployeeName,
                    ISNULL(s1.StatusName,'') AS OldStatusName,
                    ISNULL(s2.StatusName,'') AS NewStatusName,
                    m.Quantity, m.Reason, m.ReferenceNo,
                    m.ApprovedBy, m.Notes,
                    m.CreatedDate, ISNULL(m.CreatedBy,'') AS CreatedBy
                FROM tblAssetMovements m
                INNER JOIN tblAssets a ON m.AssetID = a.AssetID
                LEFT JOIN tblMainLocations ml1 ON m.FromMainLocationID = ml1.MainLocationID
                LEFT JOIN tblSubLocations sl1 ON m.FromSubLocationID = sl1.SubLocationID
                LEFT JOIN tblEmployees emp1 ON m.FromEmployeeID = emp1.EmployeeID
                LEFT JOIN tblMainLocations ml2 ON m.ToMainLocationID = ml2.MainLocationID
                LEFT JOIN tblSubLocations sl2 ON m.ToSubLocationID = sl2.SubLocationID
                LEFT JOIN tblEmployees emp2 ON m.ToEmployeeID = emp2.EmployeeID
                LEFT JOIN tblStatus s1 ON m.OldStatusID = s1.StatusID
                LEFT JOIN tblStatus s2 ON m.NewStatusID = s2.StatusID
                WHERE 1=1";

            var paramList = new System.Collections.Generic.List<SqlParameter>();

            if (assetId.HasValue && assetId.Value > 0)
            {
                query += " AND m.AssetID = @AssetID";
                paramList.Add(new SqlParameter("@AssetID", assetId.Value));
            }

            if (fromDate.HasValue)
            {
                query += " AND m.MovementDate >= @FromDate";
                paramList.Add(new SqlParameter("@FromDate", fromDate.Value.Date));
            }

            if (toDate.HasValue)
            {
                query += " AND m.MovementDate <= @ToDate";
                paramList.Add(new SqlParameter("@ToDate", toDate.Value.Date.AddDays(1)));
            }

            if (!string.IsNullOrEmpty(movementType) && movementType != "الكل")
            {
                query += " AND m.MovementType = @MovementType";
                paramList.Add(new SqlParameter("@MovementType", movementType));
            }

            query += " ORDER BY m.MovementDate DESC, m.MovementID DESC";

            return DatabaseHelper.GetData(query, paramList.ToArray());
        }

        // ══════════════════════════════════════════════════════
        // 5. جلب آخر حركات (للوحة المعلومات)
        // ══════════════════════════════════════════════════════
        public static DataTable GetRecentMovements(int count = 10)
        {
            string query = @"
                SELECT TOP (@Count)
                    m.MovementID, a.BaseAssetCode, a.AssetName,
                    m.MovementType, m.MovementDate,
                    ISNULL(ml2.MainLocationName,'') AS ToMainLocName,
                    ISNULL(emp2.EmployeeName,'') AS ToEmployeeName,
                    ISNULL(m.CreatedBy,'') AS CreatedBy
                FROM tblAssetMovements m
                INNER JOIN tblAssets a ON m.AssetID = a.AssetID
                LEFT JOIN tblMainLocations ml2 ON m.ToMainLocationID = ml2.MainLocationID
                LEFT JOIN tblEmployees emp2 ON m.ToEmployeeID = emp2.EmployeeID
                ORDER BY m.MovementDate DESC, m.MovementID DESC";

            return DatabaseHelper.GetData(query,
                new[] { new SqlParameter("@Count", count) });
        }

        // ══════════════════════════════════════════════════════
        // 6. عدد الحركات لفترة محددة
        // ══════════════════════════════════════════════════════
        public static int GetMovementCount(DateTime? fromDate = null, DateTime? toDate = null)
        {
            string query = "SELECT COUNT(*) FROM tblAssetMovements WHERE 1=1";
            var paramList = new System.Collections.Generic.List<SqlParameter>();

            if (fromDate.HasValue)
            {
                query += " AND MovementDate >= @FromDate";
                paramList.Add(new SqlParameter("@FromDate", fromDate.Value.Date));
            }
            if (toDate.HasValue)
            {
                query += " AND MovementDate <= @ToDate";
                paramList.Add(new SqlParameter("@ToDate", toDate.Value.Date.AddDays(1)));
            }

            object result = DatabaseHelper.ExecuteScalar(query, paramList.ToArray());
            return result != null ? Convert.ToInt32(result) : 0;
        }
    }
}