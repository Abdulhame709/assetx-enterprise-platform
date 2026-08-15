using System;

namespace AssetManagement.Models
{
    /// <summary>
    /// كلاس يمثل سجل جرد واحد لأصل في دورة محددة
    /// </summary>
    public class InventoryRecord
    {
        // بيانات السجل
        public int RecordID { get; set; }
        public int CycleID { get; set; }
        public int AssetID { get; set; }

        // بيانات الأصل
        public string AssetName { get; set; }
        public string FullAssetCode { get; set; }
        public string AssetTypeName { get; set; }

        // البيانات المتوقعة
        public int? ExpectedMainLocID { get; set; }
        public int? ExpectedSubLocID { get; set; }
        public string ExpectedMainLocName { get; set; }
        public string ExpectedSubLocName { get; set; }
        public int ExpectedQuantity { get; set; }
        public int? ExpectedStatusID { get; set; }
        public string ExpectedStatusName { get; set; }

        // البيانات الفعلية
        public int? ActualMainLocID { get; set; }
        public int? ActualSubLocID { get; set; }
        public int? ActualQuantity { get; set; }
        public int? ActualStatusID { get; set; }

        // النتيجة
        public string InventoryResult { get; set; }
        public DateTime? InventoryDate { get; set; }
        public string InventoryBy { get; set; }

        // التحقق
        public bool IsVerified { get; set; }
        public string VerifiedBy { get; set; }
        public string Notes { get; set; }
    }
}