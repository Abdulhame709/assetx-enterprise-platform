using System;
using System.Data;
using System.Data.SqlClient;
using System.Text;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// حماية الأصول المرتبطة - يمنع التعديل/الحذف إلا لمدير النظام
    /// </summary>
    public static class AssetProtectionHelper
    {
        /// <summary>
        /// فحص هل الأصل مرتبط بجداول أخرى
        /// </summary>
        /// <param name="assetId">رقم الأصل</param>
        /// <param name="details">تفاصيل الارتباطات</param>
        /// <returns>true إذا كان مرتبطاً</returns>
        public static bool IsAssetLinked(int assetId, out string details)
        {
            StringBuilder sb = new StringBuilder();
            bool isLinked = false;

            try
            {
                // ═══ 1. فحص حركة الأصول ═══
                object movementCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetMovements WHERE AssetID = @AssetID",
                    new SqlParameter[] { new SqlParameter("@AssetID", assetId) });

                int movements = Convert.ToInt32(movementCount);
                if (movements > 0)
                {
                    isLinked = true;
                    sb.AppendLine(string.Format("• مرتبط بـ {0} حركة أصول", movements));
                }

                // ═══ 2. فحص سجلات الجرد ═══
                object inventoryCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblInventoryRecords WHERE AssetID = @AssetID",
                    new SqlParameter[] { new SqlParameter("@AssetID", assetId) });

                int inventories = Convert.ToInt32(inventoryCount);
                if (inventories > 0)
                {
                    isLinked = true;
                    sb.AppendLine(string.Format("• مرتبط بـ {0} سجل جرد", inventories));
                }

                // ═══ 3. فحص سجلات الصيانة ═══
                object maintenanceCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblMaintenance WHERE AssetID = @AssetID",
                    new SqlParameter[] { new SqlParameter("@AssetID", assetId) });

                int maintenances = Convert.ToInt32(maintenanceCount);
                if (maintenances > 0)
                {
                    isLinked = true;
                    sb.AppendLine(string.Format("• مرتبط بـ {0} سجل صيانة", maintenances));
                }

                // ═══ 4. فحص الجرد النشط (دورة قيد التنفيذ) ═══
                object activeInventory = DatabaseHelper.ExecuteScalar(
                    @"SELECT COUNT(*) FROM tblInventoryRecords ir
                      INNER JOIN tblInventoryCycles ic ON ir.CycleID = ic.CycleID
                      WHERE ir.AssetID = @AssetID 
                      AND ic.CycleStatus IN (N'جديدة', N'قيد التنفيذ')",
                    new SqlParameter[] { new SqlParameter("@AssetID", assetId) });

                int activeInv = Convert.ToInt32(activeInventory);
                if (activeInv > 0)
                {
                    isLinked = true;
                    sb.AppendLine("• مرتبط بدورة جرد نشطة حالياً ⚠️");
                }
            }
            catch (Exception ex)
            {
                sb.AppendLine("خطأ في فحص الارتباطات: " + ex.Message);
            }

            details = sb.ToString();
            return isLinked;
        }

        /// <summary>
        /// التحقق من إمكانية تعديل الأصل
        /// يسمح فقط لمدير النظام بتعديل الأصول المرتبطة
        /// </summary>
        /// <param name="assetId">رقم الأصل</param>
        /// <returns>true إذا مسموح بالتعديل</returns>
        public static bool CanEditAsset(int assetId)
        {
            string details;
            bool isLinked = IsAssetLinked(assetId, out details);

            if (!isLinked)
            {
                // الأصل غير مرتبط - مسموح للجميع
                return true;
            }

            // الأصل مرتبط - فقط مدير النظام
            if (CurrentUser.IsAdmin)
            {
                // عرض تنبيه لمدير النظام
                System.Windows.MessageBoxResult result = System.Windows.MessageBox.Show(
                    "⚠️ تنبيه: هذا الأصل مرتبط بسجلات أخرى!\n\n" +
                    details + "\n" +
                    "التعديل قد يؤثر على:\n" +
                    "• سجلات الجرد السابقة\n" +
                    "• تاريخ حركة الأصل\n" +
                    "• سجلات الصيانة\n\n" +
                    "هل أنت متأكد من المتابعة؟\n" +
                    "(أنت تملك صلاحية مدير النظام)",
                    "تنبيه - تعديل أصل مرتبط",
                    System.Windows.MessageBoxButton.YesNo,
                    System.Windows.MessageBoxImage.Warning);

                return result == System.Windows.MessageBoxResult.Yes;
            }
            else
            {
                // مستخدم عادي - ممنوع
                System.Windows.MessageBox.Show(
                    "❌ لا يمكن تعديل هذا الأصل!\n\n" +
                    "السبب: الأصل مرتبط بسجلات أخرى:\n" +
                    details + "\n" +
                    "فقط مدير النظام يمكنه تعديل الأصول المرتبطة.\n\n" +
                    "تواصل مع مدير النظام إذا كنت تحتاج تعديله.",
                    "غير مسموح بالتعديل",
                    System.Windows.MessageBoxButton.OK,
                    System.Windows.MessageBoxImage.Stop);

                return false;
            }
        }

        /// <summary>
        /// التحقق من إمكانية حذف الأصل
        /// </summary>
        public static bool CanDeleteAsset(int assetId)
        {
            string details;
            bool isLinked = IsAssetLinked(assetId, out details);

            if (!isLinked)
            {
                return true;
            }

            if (CurrentUser.IsAdmin)
            {
                System.Windows.MessageBoxResult result = System.Windows.MessageBox.Show(
                    "⚠️ تحذير شديد: هذا الأصل مرتبط بسجلات أخرى!\n\n" +
                    details + "\n" +
                    "حذف هذا الأصل سيؤدي إلى:\n" +
                    "• فقدان تاريخ الحركات المرتبطة\n" +
                    "• تأثير على نتائج الجرد\n" +
                    "• فقدان سجلات الصيانة\n\n" +
                    "هل أنت متأكد تماماً من الحذف؟\n" +
                    "(هذا الإجراء لا يمكن التراجع عنه!)",
                    "تحذير - حذف أصل مرتبط",
                    System.Windows.MessageBoxButton.YesNo,
                    System.Windows.MessageBoxImage.Error);

                return result == System.Windows.MessageBoxResult.Yes;
            }
            else
            {
                System.Windows.MessageBox.Show(
                    "❌ لا يمكن حذف هذا الأصل!\n\n" +
                    "السبب: الأصل مرتبط بسجلات أخرى:\n" +
                    details + "\n" +
                    "فقط مدير النظام يمكنه حذف الأصول المرتبطة.\n\n" +
                    "تواصل مع مدير النظام.",
                    "غير مسموح بالحذف",
                    System.Windows.MessageBoxButton.OK,
                    System.Windows.MessageBoxImage.Stop);

                return false;
            }
        }

        /// <summary>
        /// الحصول على ملخص ارتباطات الأصل (للعرض في الشاشة)
        /// </summary>
        public static string GetAssetLinksSummary(int assetId)
        {
            try
            {
                StringBuilder sb = new StringBuilder();

                object movCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetMovements WHERE AssetID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", assetId) });

                object invCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblInventoryRecords WHERE AssetID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", assetId) });

                object maintCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblMaintenance WHERE AssetID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", assetId) });

                int m = Convert.ToInt32(movCount);
                int i = Convert.ToInt32(invCount);
                int mt = Convert.ToInt32(maintCount);

                if (m + i + mt == 0)
                    return "غير مرتبط";

                if (m > 0) sb.Append(string.Format("حركات:{0} ", m));
                if (i > 0) sb.Append(string.Format("جرد:{0} ", i));
                if (mt > 0) sb.Append(string.Format("صيانة:{0} ", mt));

                return sb.ToString().Trim();
            }
            catch
            {
                return "غير معروف";
            }
        }
    }
}