using System.Collections.Generic;
using System.Windows;
using System.Windows.Controls;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// مساعد موحد للتعامل مع الصلاحيات
    /// </summary>
    public static class PermissionHelper
    {
        /// <summary>
        /// تعريف جميع الصفحات/الوحدات الموجودة في النظام
        /// المفتاح = الاسم الداخلي في قاعدة البيانات
        /// القيمة = الاسم العربي الظاهر للمستخدم
        /// </summary>
        public static Dictionary<string, string> GetSystemModules()
        {
            return new Dictionary<string, string>
            {
                { "Assets", "سجل الأصول" },
                { "AssetTypes", "أنواع الأصول" },
                { "MainLocations", "المواقع الرئيسية" },
                { "SubLocations", "المواقع الفرعية" },
                { "AssetStatus", "حالات الأصول" },
                { "AssetModels", "الموديلات" },
                { "Employees", "الموظفين" },

                { "InventoryCycles", "دورات الجرد" },
                { "InventoryEntry", "الجرد الميداني" },
                { "InventoryReview", "مراجعة الجرد" },

                { "TransferAsset", "نقل أصل" },
                { "MovementHistory", "سجل الحركات" },

                { "ReportInventory", "تقرير الجرد" },
                { "ReportAssets", "تقرير الأصول" },
                { "ReportMovement", "تقرير الحركة" },

                { "Users", "إدارة المستخدمين" },
                { "Backup", "النسخ الاحتياطي" },
                { "SystemSettings", "إعدادات النظام" },
                { "AuditLog", "سجل التدقيق" },
                { "ImportData", "استيراد البيانات" }
            };
        }

        /// <summary>
        /// التحقق من صلاحية العرض مع رسالة جاهزة
        /// </summary>
        public static bool CheckViewPermission(string moduleName, string arabicName = null)
        {
            if (CurrentUser.HasPermission(moduleName, "view"))
                return true;

            if (string.IsNullOrWhiteSpace(arabicName))
            {
                var modules = GetSystemModules();
                if (modules.ContainsKey(moduleName))
                    arabicName = modules[moduleName];
                else
                    arabicName = moduleName;
            }

            MessageBox.Show(
                "ليس لديك صلاحية لفتح هذه الصفحة:\n" + arabicName,
                "منع الوصول",
                MessageBoxButton.OK,
                MessageBoxImage.Warning);

            return false;
        }

        /// <summary>
        /// تطبيق صلاحيات النافذة على الأزرار الأساسية
        /// استخدمها لاحقاً داخل كل شاشة
        /// </summary>
        public static void ApplyFormPermissions(
            string moduleName,
            Button btnAdd = null,
            Button btnSave = null,
            Button btnEdit = null,
            Button btnDelete = null,
            Button btnPrint = null,
            Control rootControl = null)
        {
            if (CurrentUser.IsAdmin) return;

            UserPermission perm = CurrentUser.GetPermission(moduleName);

            if (btnAdd != null)
                btnAdd.IsEnabled = perm.CanAdd;

            if (btnSave != null)
                btnSave.IsEnabled = perm.CanAdd || perm.CanEdit;

            if (btnEdit != null)
                btnEdit.IsEnabled = perm.CanEdit;

            if (btnDelete != null)
                btnDelete.IsEnabled = perm.CanDelete;

            if (btnPrint != null)
                btnPrint.IsEnabled = perm.CanPrint;

            if (rootControl != null && !perm.CanView)
            {
                rootControl.IsEnabled = false;
            }
        }
    }
}