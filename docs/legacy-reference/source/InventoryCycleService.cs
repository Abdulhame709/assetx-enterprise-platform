using System;
using System.Data;
using System.Data.SqlClient;
using AssetManagement.Helpers;

namespace AssetManagement.Services
{
    /// <summary>
    /// خدمة إدارة دورات الجرد السنوي
    /// تتعامل مع جدول tblInventoryCycles و tblInventoryRecords
    /// </summary>
    public static class InventoryCycleService
    {
        // ══════════════════════════════════════════════════════
        // 1. جلب جميع دورات الجرد مع الإحصائيات
        // ══════════════════════════════════════════════════════
        public static DataTable GetAllCycles()
        {
            string query = @"
                SELECT 
                    c.CycleID,
                    c.CycleName,
                    c.CycleYear,
                    c.StartDate,
                    c.EndDate,
                    c.CycleStatus,
                    c.Notes,
                    c.CreatedBy,
                    c.CreatedDate,
                    c.ClosedDate,
                    ISNULL(stats.TotalAssets, 0) AS TotalAssets,
                    ISNULL(stats.InventoriedAssets, 0) AS InventoriedAssets,
                    CASE 
                        WHEN ISNULL(stats.TotalAssets, 0) > 0 
                        THEN CAST(ISNULL(stats.InventoriedAssets, 0) * 100.0 / stats.TotalAssets AS DECIMAL(5,1))
                        ELSE 0 
                    END AS CompletionPct
                FROM tblInventoryCycles c
                OUTER APPLY (
                    SELECT 
                        COUNT(*) AS TotalAssets,
                        SUM(CASE WHEN ir.InventoryResult != N'لم يُجرد' THEN 1 ELSE 0 END) AS InventoriedAssets
                    FROM tblInventoryRecords ir 
                    WHERE ir.CycleID = c.CycleID
                ) stats
                ORDER BY c.CycleYear DESC";

            return DatabaseHelper.GetData(query);
        }

        // ══════════════════════════════════════════════════════
        // 2. إنشاء دورة جرد جديدة (مُحدّث: نسخ الموظف + إعادة استخدام ID)
        // ══════════════════════════════════════════════════════
        public static int CreateNewCycle(int year, string cycleName, DateTime startDate,
            string createdBy, out int assetCount, out string errorMessage)
        {
            errorMessage = "";
            assetCount = 0;

            try
            {
                // ── التحقق: هل توجد دورة لنفس السنة؟ ──
                string checkQuery = "SELECT COUNT(*) FROM tblInventoryCycles WHERE CycleYear = @Year";
                SqlParameter[] checkParams = { new SqlParameter("@Year", year) };
                int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                if (exists > 0)
                {
                    errorMessage = "توجد دورة جرد مسجلة لسنة " + year + " بالفعل!";
                    return -1;
                }

                // ── التحقق: هل توجد أصول نشطة؟ ──
                string countAssetsQuery = "SELECT COUNT(*) FROM tblAssets WHERE IsActive = 1";
                int activeAssets = Convert.ToInt32(DatabaseHelper.ExecuteScalar(countAssetsQuery));

                if (activeAssets == 0)
                {
                    errorMessage = "لا توجد أصول نشطة في النظام!";
                    return -1;
                }

                // ── البحث عن أول ID متاح (إعادة استخدام المحذوف) ──
                string findIdQuery = @"
                    DECLARE @NextID INT = 1
                    WHILE EXISTS (SELECT 1 FROM tblInventoryCycles WHERE CycleID = @NextID)
                        SET @NextID = @NextID + 1
                    SELECT @NextID";
                int nextId = Convert.ToInt32(DatabaseHelper.ExecuteScalar(findIdQuery));

                // ── التحقق: هل نحتاج IDENTITY_INSERT ──
                string maxIdQuery = "SELECT ISNULL(MAX(CycleID), 0) FROM tblInventoryCycles";
                int maxId = Convert.ToInt32(DatabaseHelper.ExecuteScalar(maxIdQuery));

                int cycleId;

                if (nextId <= maxId)
                {
                    // إعادة استخدام ID محذوف
                    string insertQuery = @"
                        SET IDENTITY_INSERT tblInventoryCycles ON;
                        INSERT INTO tblInventoryCycles 
                            (CycleID, CycleName, CycleYear, StartDate, CycleStatus, CreatedBy, CreatedDate)
                        VALUES 
                            (@CycleID, @CycleName, @CycleYear, @StartDate, N'جديدة', @CreatedBy, GETDATE());
                        SET IDENTITY_INSERT tblInventoryCycles OFF;";

                    SqlParameter[] insertParams = {
                        new SqlParameter("@CycleID", nextId),
                        new SqlParameter("@CycleName", cycleName),
                        new SqlParameter("@CycleYear", year),
                        new SqlParameter("@StartDate", startDate),
                        new SqlParameter("@CreatedBy", (object)createdBy ?? DBNull.Value)
                    };
                    DatabaseHelper.ExecuteNonQuery(insertQuery, insertParams);
                    cycleId = nextId;
                }
                else
                {
                    // إدراج عادي
                    string insertQuery = @"
                        INSERT INTO tblInventoryCycles 
                            (CycleName, CycleYear, StartDate, CycleStatus, CreatedBy, CreatedDate)
                        VALUES 
                            (@CycleName, @CycleYear, @StartDate, N'جديدة', @CreatedBy, GETDATE());
                        SELECT CAST(SCOPE_IDENTITY() AS INT);";

                    SqlParameter[] insertParams = {
                        new SqlParameter("@CycleName", cycleName),
                        new SqlParameter("@CycleYear", year),
                        new SqlParameter("@StartDate", startDate),
                        new SqlParameter("@CreatedBy", (object)createdBy ?? DBNull.Value)
                    };
                    object result = DatabaseHelper.ExecuteScalar(insertQuery, insertParams);
                    cycleId = Convert.ToInt32(result);
                }

                if (cycleId <= 0)
                {
                    errorMessage = "فشل في إنشاء الدورة!";
                    return -1;
                }

                // ── نسخ الأصول مع الموظف (العهدة) ──
                string copyQuery = @"
                    INSERT INTO tblInventoryRecords 
                        (CycleID, AssetID, ExpectedMainLocID, ExpectedSubLocID, 
                         ExpectedQuantity, ExpectedStatusID, ExpectedEmployeeID, InventoryResult)
                    SELECT 
                        @CycleID, 
                        AssetID, 
                        MainLocationID, 
                        SubLocationID, 
                        ISNULL(Quantity, 1), 
                        StatusID,
                        EmployeeID,
                        N'لم يُجرد'
                    FROM tblAssets 
                    WHERE IsActive = 1";

                SqlParameter[] copyParams = { new SqlParameter("@CycleID", cycleId) };
                assetCount = DatabaseHelper.ExecuteNonQuery(copyQuery, copyParams);

                return cycleId;
            }
            catch (Exception ex)
            {
                errorMessage = "خطأ: " + ex.Message;
                return -1;
            }
        }

        // ══════════════════════════════════════════════════════
        // 3. تحديث بيانات الدورة (الاسم، التواريخ، الملاحظات)
        // ══════════════════════════════════════════════════════
        public static bool UpdateCycle(int cycleId, string cycleName,
            DateTime? endDate, string notes, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                string query = @"
                    UPDATE tblInventoryCycles 
                    SET CycleName = @CycleName, 
                        EndDate = @EndDate, 
                        Notes = @Notes
                    WHERE CycleID = @CycleID";

                SqlParameter[] parameters = {
                    new SqlParameter("@CycleName", cycleName),
                    new SqlParameter("@EndDate", (object)endDate ?? DBNull.Value),
                    new SqlParameter("@Notes", (object)notes ?? DBNull.Value),
                    new SqlParameter("@CycleID", cycleId)
                };

                return DatabaseHelper.ExecuteNonQuery(query, parameters) > 0;
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return false;
            }
        }

        // ══════════════════════════════════════════════════════
        // 4. تحديث حالة الدورة
        // ══════════════════════════════════════════════════════
        public static bool UpdateCycleStatus(int cycleId, string newStatus, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                string query;

                // إذا كانت الحالة "مغلقة" نسجل تاريخ الإغلاق
                if (newStatus == "مغلقة")
                {
                    query = @"UPDATE tblInventoryCycles 
                              SET CycleStatus = @Status, ClosedDate = GETDATE(), EndDate = GETDATE()
                              WHERE CycleID = @CycleID";
                }
                else
                {
                    query = @"UPDATE tblInventoryCycles 
                              SET CycleStatus = @Status 
                              WHERE CycleID = @CycleID";
                }

                SqlParameter[] parameters = {
                    new SqlParameter("@Status", newStatus),
                    new SqlParameter("@CycleID", cycleId)
                };

                return DatabaseHelper.ExecuteNonQuery(query, parameters) > 0;
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return false;
            }
        }

        // ══════════════════════════════════════════════════════
        // 5. حذف دورة جرد وجميع سجلاتها
        // ══════════════════════════════════════════════════════
        public static bool DeleteCycle(int cycleId, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                // التحقق من حالة الدورة - لا نحذف دورة مغلقة
                string checkQuery = "SELECT CycleStatus FROM tblInventoryCycles WHERE CycleID = @CycleID";
                SqlParameter[] checkParams = { new SqlParameter("@CycleID", cycleId) };
                object statusObj = DatabaseHelper.ExecuteScalar(checkQuery, checkParams);

                if (statusObj != null && statusObj.ToString() == "مغلقة")
                {
                    errorMessage = "لا يمكن حذف دورة مغلقة!";
                    return false;
                }

                // حذف أعضاء الفريق أولاً (بسبب العلاقات)
                string deleteTeam = "DELETE FROM tblInventoryTeam WHERE CycleID = @CycleID";
                DatabaseHelper.ExecuteNonQuery(deleteTeam, new[] { new SqlParameter("@CycleID", cycleId) });

                // حذف سجلات الجرد
                string deleteRecords = "DELETE FROM tblInventoryRecords WHERE CycleID = @CycleID";
                DatabaseHelper.ExecuteNonQuery(deleteRecords, new[] { new SqlParameter("@CycleID", cycleId) });

                // حذف الدورة نفسها
                string deleteCycle = "DELETE FROM tblInventoryCycles WHERE CycleID = @CycleID";
                int result = DatabaseHelper.ExecuteNonQuery(deleteCycle, new[] { new SqlParameter("@CycleID", cycleId) });

                return result > 0;
            }
            catch (Exception ex)
            {
                errorMessage = "خطأ أثناء الحذف: " + ex.Message;
                return false;
            }
        }

        // ══════════════════════════════════════════════════════
        // 6. جلب الإحصائيات السريعة لدورة محددة
        // ══════════════════════════════════════════════════════
        public static DataTable GetQuickStats(int cycleId)
        {
            string query = @"
                SELECT 
                    COUNT(*) AS TotalAssets,
                    SUM(CASE WHEN InventoryResult != N'لم يُجرد' THEN 1 ELSE 0 END) AS Inventoried,
                    SUM(CASE WHEN InventoryResult = N'مطابق' THEN 1 ELSE 0 END) AS Matched,
                    SUM(CASE WHEN InventoryResult = N'عجز' THEN 1 ELSE 0 END) AS Deficit,
                    SUM(CASE WHEN InventoryResult = N'زيادة' THEN 1 ELSE 0 END) AS Surplus,
                    SUM(CASE WHEN InventoryResult = N'منقول' THEN 1 ELSE 0 END) AS Transferred,
                    SUM(CASE WHEN InventoryResult = N'مفقود' THEN 1 ELSE 0 END) AS Missing,
                    SUM(CASE WHEN InventoryResult = N'لم يُجرد' THEN 1 ELSE 0 END) AS NotInventoried
                FROM tblInventoryRecords
                WHERE CycleID = @CycleID";

            SqlParameter[] parameters = { new SqlParameter("@CycleID", cycleId) };
            return DatabaseHelper.GetData(query, parameters);
        }

        // ══════════════════════════════════════════════════════
        // 7. جلب ملخص الجرد مجمّع حسب النتيجة
        // ══════════════════════════════════════════════════════
        public static DataTable GetCycleSummary(int cycleId)
        {
            string query = @"
                SELECT 
                    InventoryResult AS N'النتيجة',
                    COUNT(*) AS N'عدد_الأصول',
                    SUM(ISNULL(ExpectedQuantity, 0)) AS N'الكمية_المتوقعة',
                    SUM(ISNULL(ActualQuantity, 0)) AS N'الكمية_الفعلية',
                    SUM(ISNULL(ActualQuantity, 0)) - SUM(ISNULL(ExpectedQuantity, 0)) AS N'الفرق'
                FROM tblInventoryRecords
                WHERE CycleID = @CycleID
                GROUP BY InventoryResult
                ORDER BY 
                    CASE InventoryResult 
                        WHEN N'مطابق' THEN 1
                        WHEN N'عجز' THEN 2
                        WHEN N'زيادة' THEN 3
                        WHEN N'منقول' THEN 4
                        WHEN N'مفقود' THEN 5
                        WHEN N'لم يُجرد' THEN 6
                        ELSE 7
                    END";

            SqlParameter[] parameters = { new SqlParameter("@CycleID", cycleId) };
            return DatabaseHelper.GetData(query, parameters);
        }
    }
}