using System;
using System.Data;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using System.Windows;
using System.Windows.Threading;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// مدير النسخ الاحتياطي التلقائي
    /// </summary>
    public class AutoBackupManager
    {
        private DispatcherTimer _backupTimer;
        private static AutoBackupManager _instance;

        // الإعدادات
        public bool IsEnabled { get; private set; }
        public string Schedule { get; private set; }
        public string BackupPath { get; private set; }
        public DateTime LastRunDate { get; private set; }
        public int KeepCount { get; private set; }

        /// <summary>
        /// الحصول على النسخة الوحيدة (Singleton)
        /// </summary>
        public static AutoBackupManager Instance
        {
            get
            {
                if (_instance == null)
                    _instance = new AutoBackupManager();
                return _instance;
            }
        }

        private AutoBackupManager()
        {
            LoadSettings();
        }

        /// <summary>
        /// تحميل إعدادات النسخ الاحتياطي من قاعدة البيانات
        /// </summary>
        public void LoadSettings()
        {
            try
            {
                DataTable dt = DatabaseHelper.GetData(
                    "SELECT SettingKey, SettingValue FROM tblSettings WHERE SettingKey LIKE 'AutoBackup%' OR SettingKey = 'BackupPath'");

                foreach (DataRow row in dt.Rows)
                {
                    string key = row["SettingKey"].ToString();
                    string value = row["SettingValue"] != DBNull.Value ?
                        row["SettingValue"].ToString() : "";

                    switch (key)
                    {
                        case "AutoBackupEnabled":
                            IsEnabled = value == "1";
                            break;
                        case "AutoBackupSchedule":
                            Schedule = string.IsNullOrEmpty(value) ? "OnClose" : value;
                            break;
                        case "BackupPath":
                            BackupPath = string.IsNullOrEmpty(value) ? @"C:\AssetBackups" : value;
                            break;
                        case "AutoBackupLastRun":
                            DateTime parsed;
                            if (DateTime.TryParse(value, out parsed))
                                LastRunDate = parsed;
                            else
                                LastRunDate = DateTime.MinValue;
                            break;
                        case "AutoBackupKeepCount":
                            int count;
                            KeepCount = int.TryParse(value, out count) ? count : 10;
                            break;
                    }
                }
            }
            catch
            {
                IsEnabled = false;
                Schedule = "OnClose";
                BackupPath = @"C:\AssetBackups";
                KeepCount = 10;
            }
        }

        /// <summary>
        /// بدء المراقبة التلقائية (تُستدعى عند فتح البرنامج)
        /// </summary>
        public void StartMonitoring()
        {
            if (!IsEnabled) return;

            // ═══ النسخ عند فتح البرنامج ═══
            if (Schedule == "OnOpen")
            {
                PerformAutoBackup("عند فتح البرنامج");
            }

            // ═══ النسخ كل ساعة ═══
            if (Schedule == "Hourly")
            {
                StartTimer(TimeSpan.FromHours(1));
            }

            // ═══ النسخ يومي (نتحقق هل مر يوم) ═══
            if (Schedule == "Daily")
            {
                if ((DateTime.Now - LastRunDate).TotalHours >= 24)
                {
                    PerformAutoBackup("يومي");
                }
                StartTimer(TimeSpan.FromHours(1)); // نتحقق كل ساعة
            }

            // ═══ النسخ أسبوعي ═══
            if (Schedule == "Weekly")
            {
                if ((DateTime.Now - LastRunDate).TotalDays >= 7)
                {
                    PerformAutoBackup("أسبوعي");
                }
                StartTimer(TimeSpan.FromHours(6)); // نتحقق كل 6 ساعات
            }

            // ═══ النسخ شهري ═══
            if (Schedule == "Monthly")
            {
                if ((DateTime.Now - LastRunDate).TotalDays >= 30)
                {
                    PerformAutoBackup("شهري");
                }
                StartTimer(TimeSpan.FromHours(12)); // نتحقق كل 12 ساعة
            }
        }

        /// <summary>
        /// إيقاف المراقبة (تُستدعى عند إغلاق البرنامج)
        /// </summary>
        public void StopMonitoring()
        {
            if (_backupTimer != null)
            {
                _backupTimer.Stop();
                _backupTimer = null;
            }

            // النسخ عند إغلاق البرنامج
            if (IsEnabled && Schedule == "OnClose")
            {
                PerformAutoBackup("عند إغلاق البرنامج");
            }
        }

        /// <summary>
        /// بدء المؤقت للنسخ الدوري
        /// </summary>
        private void StartTimer(TimeSpan interval)
        {
            _backupTimer = new DispatcherTimer();
            _backupTimer.Interval = interval;
            _backupTimer.Tick += delegate
            {
                if (ShouldRunNow())
                {
                    PerformAutoBackup("مجدول");
                }
            };
            _backupTimer.Start();
        }

        /// <summary>
        /// هل يجب تنفيذ النسخ الآن؟
        /// </summary>
        private bool ShouldRunNow()
        {
            LoadSettings(); // إعادة تحميل الإعدادات

            if (!IsEnabled) return false;

            switch (Schedule)
            {
                case "Hourly":
                    return (DateTime.Now - LastRunDate).TotalMinutes >= 55;
                case "Daily":
                    return (DateTime.Now - LastRunDate).TotalHours >= 23;
                case "Weekly":
                    return (DateTime.Now - LastRunDate).TotalDays >= 6.5;
                case "Monthly":
                    return (DateTime.Now - LastRunDate).TotalDays >= 29;
                default:
                    return false;
            }
        }

        /// <summary>
        /// تنفيذ النسخ الاحتياطي التلقائي
        /// </summary>
        public bool PerformAutoBackup(string reason)
        {
            try
            {
                // التأكد من وجود المجلد
                if (!Directory.Exists(BackupPath))
                {
                    Directory.CreateDirectory(BackupPath);
                }

                // إنشاء اسم الملف
                string fileName = string.Format("AutoBackup_{0}.bak",
                    DateTime.Now.ToString("yyyy-MM-dd_HHmmss"));
                string fullPath = Path.Combine(BackupPath, fileName);

                // تنفيذ النسخ
                string errorMessage;
                bool success = BackupHelper.BackupDatabase(fullPath, out errorMessage);

                if (success)
                {
                    // تحديث تاريخ آخر نسخ
                    UpdateLastRunDate();

                    // حذف النسخ القديمة
                    CleanupOldBackups();

                    // تسجيل في سجل التدقيق
                    try
                    {
                        AuditLogHelper.Log("نسخ احتياطي", "Database", null, null,
                            string.Format("نسخ احتياطي تلقائي ({0}): {1}", reason, fileName));
                    }
                    catch { }

                    return true;
                }

                return false;
            }
            catch
            {
                return false;
            }
        }

        /// <summary>
        /// تحديث تاريخ آخر نسخ احتياطي
        /// </summary>
        private void UpdateLastRunDate()
        {
            try
            {
                string modifiedBy = "System";
                if (CurrentUser.Username != null)
                    modifiedBy = CurrentUser.Username;

                DatabaseHelper.ExecuteNonQuery(
                    @"UPDATE tblSettings 
                      SET SettingValue = @Value, ModifiedDate = GETDATE(), ModifiedBy = @By
                      WHERE SettingKey = 'AutoBackupLastRun'",
                    new SqlParameter[]
                    {
                        new SqlParameter("@Value", DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")),
                        new SqlParameter("@By", modifiedBy)
                    });

                LastRunDate = DateTime.Now;
            }
            catch { }
        }

        /// <summary>
        /// حذف النسخ الاحتياطية القديمة (الاحتفاظ بآخر N نسخة)
        /// </summary>
        private void CleanupOldBackups()
        {
            try
            {
                if (!Directory.Exists(BackupPath)) return;

                var files = Directory.GetFiles(BackupPath, "AutoBackup_*.bak")
                    .Select(f => new FileInfo(f))
                    .OrderByDescending(f => f.CreationTime)
                    .ToArray();

                // حذف الملفات الزائدة
                if (files.Length > KeepCount)
                {
                    for (int i = KeepCount; i < files.Length; i++)
                    {
                        try
                        {
                            files[i].Delete();
                        }
                        catch { }
                    }
                }
            }
            catch { }
        }

        /// <summary>
        /// حفظ الإعدادات في قاعدة البيانات
        /// </summary>
        public void SaveSettings(bool enabled, string schedule, string path, int keepCount)
        {
            try
            {
                string modifiedBy = "System";
                if (CurrentUser.Username != null)
                    modifiedBy = CurrentUser.Username;

                SaveOneSetting("AutoBackupEnabled", enabled ? "1" : "0", modifiedBy);
                SaveOneSetting("AutoBackupSchedule", schedule, modifiedBy);
                SaveOneSetting("BackupPath", path, modifiedBy);
                SaveOneSetting("AutoBackupKeepCount", keepCount.ToString(), modifiedBy);

                // إعادة تحميل
                IsEnabled = enabled;
                Schedule = schedule;
                BackupPath = path;
                KeepCount = keepCount;

                // إعادة تشغيل المراقبة
                StopMonitoring();
                if (enabled)
                {
                    StartMonitoring();
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في حفظ إعدادات النسخ التلقائي:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void SaveOneSetting(string key, string value, string modifiedBy)
        {
            // تحقق هل الإعداد موجود
            object exists = DatabaseHelper.ExecuteScalar(
                "SELECT COUNT(*) FROM tblSettings WHERE SettingKey = @Key",
                new SqlParameter[] { new SqlParameter("@Key", key) });

            if (Convert.ToInt32(exists) > 0)
            {
                DatabaseHelper.ExecuteNonQuery(
                    @"UPDATE tblSettings SET SettingValue = @Value, 
                      ModifiedDate = GETDATE(), ModifiedBy = @By 
                      WHERE SettingKey = @Key",
                    new SqlParameter[]
                    {
                        new SqlParameter("@Key", key),
                        new SqlParameter("@Value", value),
                        new SqlParameter("@By", modifiedBy)
                    });
            }
            else
            {
                DatabaseHelper.ExecuteNonQuery(
                    @"INSERT INTO tblSettings (SettingKey, SettingValue, ModifiedBy, ModifiedDate) 
                      VALUES (@Key, @Value, @By, GETDATE())",
                    new SqlParameter[]
                    {
                        new SqlParameter("@Key", key),
                        new SqlParameter("@Value", value),
                        new SqlParameter("@By", modifiedBy)
                    });
            }
        }
    }
}