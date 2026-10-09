using System;

namespace AssetManagement.Models
{
    /// <summary>
    /// كلاس يمثل حركة أصل (نقل، تسليم، استلام، إتلاف، استغناء)
    /// </summary>
    public class AssetMovement
    {
        public int MovementID { get; set; }
        public int AssetID { get; set; }
        public string AssetName { get; set; }
        public string BaseAssetCode { get; set; }

        public DateTime MovementDate { get; set; }
        public string MovementType { get; set; }

        // من
        public int? FromMainLocationID { get; set; }
        public int? FromSubLocationID { get; set; }
        public int? FromEmployeeID { get; set; }
        public string FromMainLocName { get; set; }
        public string FromSubLocName { get; set; }
        public string FromEmployeeName { get; set; }

        // إلى
        public int? ToMainLocationID { get; set; }
        public int? ToSubLocationID { get; set; }
        public int? ToEmployeeID { get; set; }
        public string ToMainLocName { get; set; }
        public string ToSubLocName { get; set; }
        public string ToEmployeeName { get; set; }

        // تفاصيل
        public int? OldStatusID { get; set; }
        public int? NewStatusID { get; set; }
        public string OldStatusName { get; set; }
        public string NewStatusName { get; set; }
        public int Quantity { get; set; }
        public string Reason { get; set; }
        public string ReferenceNo { get; set; }
        public string ApprovedBy { get; set; }
        public string Notes { get; set; }
        public string CreatedBy { get; set; }
        public DateTime CreatedDate { get; set; }
    }
}