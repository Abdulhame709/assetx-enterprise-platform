using System;
using System.Data.SqlClient;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// مساعد سجل التدقيق - يسجل جميع العمليات تلقائياً
    /// </summary>
    public static class AuditLogHelper
    {
        /// <summary>
        /// تسجيل عملية في سجل التدقيق
        /// </summary>
        /// <param name="actionType">نوع العملية: إضافة | تعديل | حذف | دخول | خروج</param>
        /// <param name="tableName">اسم الجدول</param>
        /// <param name="recordId">رقم السجل</param>
        /// <param name="oldValues">القيم القديمة</param>
        /// <param name="newValues">القيم الجديدة</param>
        public static void Log(string actionType, string tableName = null,
    int? recordId = null, string oldValues = null, string newValues = null)
        {
            try
            {
                string query = @"INSERT INTO tblAuditLog 
            (UserID, TableName, RecordID, ActionType, OldValues, NewValues, 
             ActionDate, Workstation)
            VALUES 
            (@UserID, @TableName, @RecordID, @ActionType, @OldValues, @NewValues, 
             GETDATE(), @Workstation)";

                SqlParameter[] parameters = new SqlParameter[]
                {
            new SqlParameter("@UserID",
                CurrentUser.UserID > 0 ? (object)CurrentUser.UserID : DBNull.Value),
            new SqlParameter("@TableName",
                tableName != null ? (object)tableName : DBNull.Value),
            new SqlParameter("@RecordID",
                recordId.HasValue ? (object)recordId.Value : DBNull.Value),
            new SqlParameter("@ActionType",
                actionType != null ? (object)actionType : DBNull.Value),
            new SqlParameter("@OldValues",
                oldValues != null ? (object)oldValues : DBNull.Value),
            new SqlParameter("@NewValues",
                newValues != null ? (object)newValues : DBNull.Value),
            new SqlParameter("@Workstation",
                Environment.MachineName != null ? (object)Environment.MachineName : DBNull.Value)
                };

                DatabaseHelper.ExecuteNonQuery(query, parameters);
            }
            catch
            {
                // لا نرمي استثناء
            }
        }

        /// <summary>
        /// تسجيل دخول مستخدم
        /// </summary>
        public static void LogLogin(string username)
        {
            Log("دخول", "tblUsers", CurrentUser.UserID, null,
                "تسجيل دخول: " + username);
        }

        /// <summary>
        /// تسجيل خروج مستخدم
        /// </summary>
        public static void LogLogout()
        {
            Log("خروج", "tblUsers", CurrentUser.UserID, null,
                "تسجيل خروج: " + CurrentUser.Username);
        }

        /// <summary>
        /// تسجيل إضافة سجل
        /// </summary>
        public static void LogInsert(string tableName, int recordId, string details)
        {
            Log("إضافة", tableName, recordId, null, details);
        }

        /// <summary>
        /// تسجيل تعديل سجل
        /// </summary>
        public static void LogUpdate(string tableName, int recordId,
            string oldValues, string newValues)
        {
            Log("تعديل", tableName, recordId, oldValues, newValues);
        }

        /// <summary>
        /// تسجيل حذف سجل
        /// </summary>
        public static void LogDelete(string tableName, int recordId, string details)
        {
            Log("حذف", tableName, recordId, details, null);
        }
    }
}