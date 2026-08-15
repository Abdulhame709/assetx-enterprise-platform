using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// صلاحية مستخدم لوحدة/نافذة معينة
    /// </summary>
    public class UserPermission
    {
        public bool CanView { get; set; }
        public bool CanAdd { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
        public bool CanPrint { get; set; }
    }

    /// <summary>
    /// بيانات المستخدم الحالي (جلسة العمل)
    /// </summary>
    public static class CurrentUser
    {
        public static int UserID { get; set; }
        public static string Username { get; set; }
        public static string FullName { get; set; }
        public static string UserRole { get; set; }
        public static int? EmployeeID { get; set; }
        public static string Department { get; set; }
        public static string Email { get; set; }
        public static DateTime LoginTime { get; set; }

        public static Dictionary<string, UserPermission> Permissions { get; set; }

        /// <summary>
        /// هل المستخدم مدير نظام؟
        /// </summary>
        public static bool IsAdmin
        {
            get { return string.Equals(UserRole, "مدير النظام", StringComparison.OrdinalIgnoreCase); }
        }

        /// <summary>
        /// تحميل صلاحيات المستخدم من قاعدة البيانات
        /// </summary>
        public static void LoadPermissions()
        {
            Permissions = new Dictionary<string, UserPermission>(StringComparer.OrdinalIgnoreCase);

            string query = @"SELECT ModuleName, CanView, CanAdd, CanEdit, CanDelete, CanPrint
                             FROM tblUserPermissions
                             WHERE UserID = @UserID";

            SqlParameter[] parameters = new SqlParameter[]
            {
                new SqlParameter("@UserID", UserID)
            };

            DataTable dt = DatabaseHelper.GetData(query, parameters);

            foreach (DataRow row in dt.Rows)
            {
                string module = row["ModuleName"].ToString();

                Permissions[module] = new UserPermission
                {
                    CanView = row["CanView"] != DBNull.Value && Convert.ToBoolean(row["CanView"]),
                    CanAdd = row["CanAdd"] != DBNull.Value && Convert.ToBoolean(row["CanAdd"]),
                    CanEdit = row["CanEdit"] != DBNull.Value && Convert.ToBoolean(row["CanEdit"]),
                    CanDelete = row["CanDelete"] != DBNull.Value && Convert.ToBoolean(row["CanDelete"]),
                    CanPrint = row["CanPrint"] != DBNull.Value && Convert.ToBoolean(row["CanPrint"])
                };
            }
        }

        /// <summary>
        /// الحصول على صلاحية وحدة محددة
        /// </summary>
        public static UserPermission GetPermission(string moduleName)
        {
            if (IsAdmin)
            {
                return new UserPermission
                {
                    CanView = true,
                    CanAdd = true,
                    CanEdit = true,
                    CanDelete = true,
                    CanPrint = true
                };
            }

            if (string.IsNullOrWhiteSpace(moduleName))
                return new UserPermission();

            if (Permissions != null && Permissions.ContainsKey(moduleName))
                return Permissions[moduleName];

            return new UserPermission();
        }

        /// <summary>
        /// التحقق من صلاحية معينة
        /// action = view/add/edit/delete/print
        /// </summary>
        public static bool HasPermission(string moduleName, string action)
        {
            if (IsAdmin) return true;

            if (string.IsNullOrWhiteSpace(moduleName) || string.IsNullOrWhiteSpace(action))
                return false;

            UserPermission perm = GetPermission(moduleName);

            switch (action.Trim().ToLower())
            {
                case "view":
                    return perm.CanView;
                case "add":
                    return perm.CanAdd;
                case "edit":
                    return perm.CanEdit;
                case "delete":
                    return perm.CanDelete;
                case "print":
                    return perm.CanPrint;
                default:
                    return false;
            }
        }

        /// <summary>
        /// مسح بيانات الجلسة عند تسجيل الخروج
        /// </summary>
        public static void Clear()
        {
            UserID = 0;
            Username = null;
            FullName = null;
            UserRole = null;
            EmployeeID = null;
            Department = null;
            Email = null;
            LoginTime = DateTime.MinValue;
            Permissions = null;
        }
    }
}