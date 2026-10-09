using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;
using Microsoft.Win32;

namespace AssetManagement.Views
{
    public partial class SettingsForm : Window
    {
        public SettingsForm()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadSettings();
        }

        // ═══════════════════════════════════════════════════════════
        // تحميل الإعدادات
        // ═══════════════════════════════════════════════════════════

        private void LoadSettings()
        {
            try
            {
                DataTable dt = DatabaseHelper.GetData(
                    "SELECT SettingKey, SettingValue FROM tblSettings");

                foreach (DataRow row in dt.Rows)
                {
                    string key = row["SettingKey"].ToString();
                    string value = row["SettingValue"] != DBNull.Value ?
                        row["SettingValue"].ToString() : "";

                    switch (key)
                    {
                        case "OrganizationName":
                            txtOrgName.Text = value;
                            break;
                        case "OrganizationLogo":
                            txtLogoPath.Text = value;
                            break;
                        case "ReportTitle":
                            txtReportTitle.Text = value;
                            break;
                        case "ReportFooter":
                            txtReportFooter.Text = value;
                            break;
                        case "BackupPath":
                            txtBackupDir.Text = value;
                            break;
                        case "DepreciationMethod":
                            cmbDepMethod.SelectedIndex = value == "القسط المتناقص" ? 1 : 0;
                            break;
                        case "FiscalYearStart":
                            int month;
                            if (int.TryParse(value, out month) && month >= 1 && month <= 12)
                                cmbFiscalMonth.SelectedIndex = month - 1;
                            else
                                cmbFiscalMonth.SelectedIndex = 0;
                            break;
                    }
                }

                // تحميل إعدادات النسخ التلقائي
                LoadAutoBackupSettings();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل الإعدادات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // إعدادات النسخ الاحتياطي التلقائي
        // ═══════════════════════════════════════════════════════════

        private void LoadAutoBackupSettings()
        {
            try
            {
                AutoBackupManager mgr = AutoBackupManager.Instance;
                mgr.LoadSettings();

                chkAutoBackup.IsChecked = mgr.IsEnabled;

                // تحديد الجدولة
                string schedule = mgr.Schedule;
                for (int i = 0; i < cmbBackupSchedule.Items.Count; i++)
                {
                    ComboBoxItem item = cmbBackupSchedule.Items[i] as ComboBoxItem;
                    if (item != null && item.Tag != null && item.Tag.ToString() == schedule)
                    {
                        cmbBackupSchedule.SelectedIndex = i;
                        break;
                    }
                }
                if (cmbBackupSchedule.SelectedIndex < 0)
                    cmbBackupSchedule.SelectedIndex = 1; // افتراضي: عند الإغلاق

                // تحديد عدد النسخ
                string keepStr = mgr.KeepCount.ToString();
                for (int i = 0; i < cmbKeepCount.Items.Count; i++)
                {
                    ComboBoxItem item = cmbKeepCount.Items[i] as ComboBoxItem;
                    if (item != null && item.Tag != null && item.Tag.ToString() == keepStr)
                    {
                        cmbKeepCount.SelectedIndex = i;
                        break;
                    }
                }
                if (cmbKeepCount.SelectedIndex < 0)
                    cmbKeepCount.SelectedIndex = 1; // افتراضي: 10

                // آخر نسخ
                if (mgr.LastRunDate > DateTime.MinValue)
                {
                    txtLastBackup.Text = "آخر نسخ: " +
                        mgr.LastRunDate.ToString("yyyy/MM/dd HH:mm");
                }
                else
                {
                    txtLastBackup.Text = "آخر نسخ: لم يتم بعد";
                }

                // تحديث حالة العناصر
                UpdateAutoBackupUI();
            }
            catch
            {
                // إعدادات افتراضية
                chkAutoBackup.IsChecked = false;
                cmbBackupSchedule.SelectedIndex = 1;
                cmbKeepCount.SelectedIndex = 1;
                txtLastBackup.Text = "آخر نسخ: لم يتم بعد";
                UpdateAutoBackupUI();
            }
        }

        private void ChkAutoBackup_Changed(object sender, RoutedEventArgs e)
        {
            UpdateAutoBackupUI();
        }

        private void UpdateAutoBackupUI()
        {
            if (pnlAutoBackupOptions != null)
            {
                pnlAutoBackupOptions.IsEnabled = chkAutoBackup.IsChecked == true;
                pnlAutoBackupOptions.Opacity = chkAutoBackup.IsChecked == true ? 1.0 : 0.5;
            }
        }

        // ═══════════════════════════════════════════════════════════
        // حفظ الإعدادات
        // ═══════════════════════════════════════════════════════════

        private void BtnSave_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // حفظ الإعدادات الأساسية
                SaveSetting("OrganizationName", txtOrgName.Text.Trim());
                SaveSetting("OrganizationLogo", txtLogoPath.Text.Trim());
                SaveSetting("ReportTitle", txtReportTitle.Text.Trim());
                SaveSetting("ReportFooter", txtReportFooter.Text.Trim());
                SaveSetting("BackupPath", txtBackupDir.Text.Trim());

                string depMethod = cmbDepMethod.SelectedIndex == 1 ?
                    "القسط المتناقص" : "القسط الثابت";
                SaveSetting("DepreciationMethod", depMethod);

                string fiscalMonth = (cmbFiscalMonth.SelectedIndex + 1).ToString();
                SaveSetting("FiscalYearStart", fiscalMonth);

                // حفظ إعدادات النسخ التلقائي
                SaveAutoBackupSettings();

                // تسجيل في سجل التدقيق
                try
                {
                    AuditLogHelper.Log("تعديل", "tblSettings", null, null,
                        "تحديث إعدادات النظام");
                }
                catch { }

                MessageBox.Show("تم حفظ الإعدادات بنجاح ✅",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في حفظ الإعدادات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// حفظ إعداد واحد بشكل آمن
        /// </summary>
        private void SaveSetting(string key, string value)
        {
            // تحديد اسم المستخدم بشكل آمن
            string modifiedBy = "System";
            if (CurrentUser.Username != null)
            {
                modifiedBy = CurrentUser.Username;
            }

            string query = @"UPDATE tblSettings 
                           SET SettingValue = @Value, 
                               ModifiedDate = GETDATE(), 
                               ModifiedBy = @ModifiedBy
                           WHERE SettingKey = @Key";

            DatabaseHelper.ExecuteNonQuery(query, new SqlParameter[]
            {
                new SqlParameter("@Key", key),
                new SqlParameter("@Value", value != null ? (object)value : DBNull.Value),
                new SqlParameter("@ModifiedBy", modifiedBy)
            });
        }

        /// <summary>
        /// حفظ إعدادات النسخ الاحتياطي التلقائي
        /// </summary>
        private void SaveAutoBackupSettings()
        {
            try
            {
                bool enabled = chkAutoBackup.IsChecked == true;

                string schedule = "OnClose";
                ComboBoxItem schedItem = cmbBackupSchedule.SelectedItem as ComboBoxItem;
                if (schedItem != null && schedItem.Tag != null)
                    schedule = schedItem.Tag.ToString();

                int keepCount = 10;
                ComboBoxItem keepItem = cmbKeepCount.SelectedItem as ComboBoxItem;
                if (keepItem != null && keepItem.Tag != null)
                {
                    int parsed;
                    if (int.TryParse(keepItem.Tag.ToString(), out parsed))
                        keepCount = parsed;
                }

                string path = txtBackupDir.Text.Trim();
                if (string.IsNullOrEmpty(path))
                    path = @"C:\AssetBackups";

                AutoBackupManager.Instance.SaveSettings(enabled, schedule, path, keepCount);
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في حفظ إعدادات النسخ التلقائي:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // أزرار التصفح
        // ═══════════════════════════════════════════════════════════

        private void BtnBrowseBackupDir_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new System.Windows.Forms.FolderBrowserDialog();
            dialog.Description = "اختيار مجلد النسخ الاحتياطي";

            if (!string.IsNullOrEmpty(txtBackupDir.Text))
                dialog.SelectedPath = txtBackupDir.Text;

            if (dialog.ShowDialog() == System.Windows.Forms.DialogResult.OK)
            {
                txtBackupDir.Text = dialog.SelectedPath;
            }
        }

        private void BtnBrowseLogo_Click(object sender, RoutedEventArgs e)
        {
            OpenFileDialog dialog = new OpenFileDialog();
            dialog.Filter = "ملفات الصور (*.png;*.jpg;*.jpeg;*.bmp)|*.png;*.jpg;*.jpeg;*.bmp";
            dialog.Title = "اختيار شعار المنشأة";

            if (dialog.ShowDialog() == true)
            {
                txtLogoPath.Text = dialog.FileName;
            }
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}