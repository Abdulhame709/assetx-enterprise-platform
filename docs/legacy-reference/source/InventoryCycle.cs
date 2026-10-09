using System;

namespace AssetManagement.Models
{
    /// <summary>
    /// نموذج دورة الجرد السنوي
    /// يمثل جدول tblInventoryCycles في قاعدة البيانات
    /// </summary>
    public class InventoryCycle
    {
        // معرف الدورة
        public int CycleID { get; set; }

        // اسم الدورة (مثل: جرد الأصول 2025)
        public string CycleName { get; set; }

        // سنة الجرد
        public int CycleYear { get; set; }

        // تاريخ البداية
        public DateTime StartDate { get; set; }

        // تاريخ النهاية (اختياري)
        public DateTime? EndDate { get; set; }

        // حالة الدورة: جديدة | قيد التنفيذ | مكتملة | مغلقة
        public string CycleStatus { get; set; }

        // ملاحظات
        public string Notes { get; set; }

        // من أنشأ الدورة
        public string CreatedBy { get; set; }

        // تاريخ الإنشاء
        public DateTime? CreatedDate { get; set; }

        // تاريخ الإغلاق
        public DateTime? ClosedDate { get; set; }

        // ─── حقول إضافية للعرض (ليست في قاعدة البيانات) ───

        // عدد الأصول في هذه الدورة
        public int TotalAssets { get; set; }

        // عدد الأصول التي تم جردها
        public int InventoriedAssets { get; set; }

        // نسبة الإنجاز
        public double CompletionPercentage
        {
            get
            {
                if (TotalAssets == 0) return 0;
                return Math.Round((double)InventoriedAssets / TotalAssets * 100, 1);
            }
        }

        // لون الحالة للعرض
        public string StatusColor
        {
            get
            {
                switch (CycleStatus)
                {
                    case "جديدة": return "#2196F3";        // أزرق
                    case "قيد التنفيذ": return "#FF9800";  // برتقالي
                    case "مكتملة": return "#4CAF50";       // أخضر
                    case "مغلقة": return "#9E9E9E";        // رمادي
                    default: return "#000000";
                }
            }
        }
    }
}