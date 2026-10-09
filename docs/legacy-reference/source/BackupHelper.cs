using System;
using System.Data.SqlClient;
using System.IO;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// مساعد النسخ الاحتياطي واستعادة قاعدة البيانات
    /// </summary>
    public static class BackupHelper
    {
        /// <summary>
        /// إنشاء نسخة احتياطية
        /// </summary>
        /// <param name="backupPath">مسار حفظ النسخة</param>
        /// <param name="errorMessage">رسالة الخطأ إن وجد</param>
        /// <returns>true إذا نجح</returns>
        public static bool BackupDatabase(string backupPath, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                string directory = Path.GetDirectoryName(backupPath);
                if (!Directory.Exists(directory))
                {
                    Directory.CreateDirectory(directory);
                }

                string query = string.Format(
                    @"BACKUP DATABASE [AssetsDB] 
              TO DISK = '{0}' 
              WITH FORMAT, 
                   MEDIANAME = 'AssetsDB_Backup',
                   NAME = N'AssetsDB - Full Backup - {1}'",
                    backupPath.Replace("'", "''"),
                    DateTime.Now.ToString("yyyy-MM-dd HH:mm"));

                DatabaseHelper.ExecuteNonQuery(query);

                // تسجيل في سجل التدقيق بشكل آمن
                try
                {
                    AuditLogHelper.Log("نسخ احتياطي", "Database", null, null,
                        "نسخة احتياطية: " + backupPath);
                }
                catch { }

                return true;
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return false;
            }
        }

        /// <summary>
        /// استعادة نسخة احتياطية
        /// </summary>
        public static bool RestoreDatabase(string backupPath, out string errorMessage)
        {
            errorMessage = "";
            try
            {
                if (!File.Exists(backupPath))
                {
                    errorMessage = "ملف النسخة الاحتياطية غير موجود";
                    return false;
                }

                // ═══════════════════════════════════════════════════════
                // ✅ الحل: الاتصال بقاعدة master بدلاً من AssetsDB
                // ═══════════════════════════════════════════════════════
                string masterConnectionString = GetMasterConnectionString();

                using (SqlConnection masterConn = new SqlConnection(masterConnectionString))
                {
                    masterConn.Open();

                    // ═══ الخطوة 1: قطع جميع الاتصالات بقاعدة AssetsDB ═══
                    string killConnections = @"
                DECLARE @kill varchar(8000) = '';
                SELECT @kill = @kill + 'KILL ' + CONVERT(varchar(5), session_id) + ';'
                FROM sys.dm_exec_sessions
                WHERE database_id = DB_ID('AssetsDB')
                AND session_id <> @@SPID;
                EXEC(@kill);";

                    using (SqlCommand cmdKill = new SqlCommand(killConnections, masterConn))
                    {
                        cmdKill.ExecuteNonQuery();
                    }

                    // ═══ الخطوة 2: تحويل القاعدة إلى وضع المستخدم الواحد ═══
                    string singleUser = @"
                ALTER DATABASE [AssetsDB] 
                SET SINGLE_USER 
                WITH ROLLBACK IMMEDIATE";

                    using (SqlCommand cmdSingle = new SqlCommand(singleUser, masterConn))
                    {
                        cmdSingle.ExecuteNonQuery();
                    }

                    // ═══ الخطوة 3: استعادة النسخة الاحتياطية ═══
                    string restoreQuery = string.Format(
                        @"RESTORE DATABASE [AssetsDB] 
                  FROM DISK = '{0}' 
                  WITH REPLACE",
                        backupPath.Replace("'", "''"));

                    using (SqlCommand cmdRestore = new SqlCommand(restoreQuery, masterConn))
                    {
                        cmdRestore.CommandTimeout = 300; // 5 دقائق
                        cmdRestore.ExecuteNonQuery();
                    }

                    // ═══ الخطوة 4: إعادة القاعدة إلى الوضع الطبيعي ═══
                    string multiUser = @"
                ALTER DATABASE [AssetsDB] 
                SET MULTI_USER";

                    using (SqlCommand cmdMulti = new SqlCommand(multiUser, masterConn))
                    {
                        cmdMulti.ExecuteNonQuery();
                    }
                }

                return true;
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;

                // محاولة إعادة القاعدة إلى الوضع الطبيعي في حالة الفشل
                try
                {
                    string masterConn = GetMasterConnectionString();
                    using (SqlConnection conn = new SqlConnection(masterConn))
                    {
                        conn.Open();
                        using (SqlCommand cmd = new SqlCommand(
                            "ALTER DATABASE [AssetsDB] SET MULTI_USER", conn))
                        {
                            cmd.ExecuteNonQuery();
                        }
                    }
                }
                catch { }

                return false;
            }
        }

        /// <summary>
        /// ✅ الحصول على سلسلة الاتصال بقاعدة master
        /// يأخذ سلسلة الاتصال الحالية ويغير اسم القاعدة إلى master
        /// </summary>
        private static string GetMasterConnectionString()
        {
            // ✅ نأخذ سلسلة الاتصال الأصلية
            string originalConnStr = DatabaseHelper.GetConnectionString();

            // ✅ نغير اسم القاعدة إلى master فقط
            SqlConnectionStringBuilder builder =
                new SqlConnectionStringBuilder(originalConnStr);

            builder.InitialCatalog = "master";

            return builder.ConnectionString;
        }

        /// <summary>
        /// إنشاء اسم ملف النسخة الاحتياطية التلقائي
        /// </summary>
        public static string GenerateBackupFileName()
        {
            return string.Format("AssetsDB_Backup_{0}.bak",
                DateTime.Now.ToString("yyyy-MM-dd_HHmmss"));
        }

        /// <summary>
        /// الحصول على مسار النسخ الاحتياطي من الإعدادات
        /// </summary>
        public static string GetBackupPath()
        {
            try
            {
                object result = DatabaseHelper.ExecuteScalar(
                    "SELECT SettingValue FROM tblSettings WHERE SettingKey = 'BackupPath'");
                if (result != null && result != DBNull.Value)
                {
                    return result.ToString();
                }
            }
            catch { }
            return @"C:\AssetBackups";
        }
    }
}