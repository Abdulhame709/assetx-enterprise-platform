using System;
using System.IO;
using System.Windows;
using AssetManagement.Helpers;
using Microsoft.Win32;

namespace AssetManagement.Views
{
    public partial class BackupForm : Window
    {
        public BackupForm()
        {
            InitializeComponent();

            // تحديد المسار الافتراضي
            string defaultPath = BackupHelper.GetBackupPath();
            string fileName = BackupHelper.GenerateBackupFileName();
            txtBackupPath.Text = Path.Combine(defaultPath, fileName);

            AddLog("جاهز للنسخ الاحتياطي...");
        }

        // ═══ النسخ الاحتياطي ═══

        private void BtnBrowseBackup_Click(object sender, RoutedEventArgs e)
        {
            SaveFileDialog dialog = new SaveFileDialog();
            dialog.Filter = "ملفات النسخ الاحتياطي (*.bak)|*.bak";
            dialog.FileName = BackupHelper.GenerateBackupFileName();
            dialog.Title = "حفظ النسخة الاحتياطية";

            if (dialog.ShowDialog() == true)
            {
                txtBackupPath.Text = dialog.FileName;
            }
        }

        private void BtnBackup_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(txtBackupPath.Text))
            {
                MessageBox.Show("الرجاء تحديد مسار الحفظ",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                btnBackup.IsEnabled = false;
                progressBackup.Visibility = Visibility.Visible;
                AddLog("جاري إنشاء النسخة الاحتياطية...");

                string errorMessage;
                bool success = BackupHelper.BackupDatabase(
                    txtBackupPath.Text, out errorMessage);

                if (success)
                {
                    // حساب حجم الملف
                    FileInfo fi = new FileInfo(txtBackupPath.Text);
                    string size = string.Format("{0:N2} MB", fi.Length / 1024.0 / 1024.0);

                    AddLog(string.Format("✅ تم إنشاء النسخة الاحتياطية بنجاح! الحجم: {0}", size));
                    AddLog("المسار: " + txtBackupPath.Text);

                    MessageBox.Show(
                        string.Format("تم إنشاء النسخة الاحتياطية بنجاح!\n\nالمسار: {0}\nالحجم: {1}",
                        txtBackupPath.Text, size),
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                    // تحديث اسم الملف للنسخة القادمة
                    string dir = Path.GetDirectoryName(txtBackupPath.Text);
                    txtBackupPath.Text = Path.Combine(dir,
                        BackupHelper.GenerateBackupFileName());
                }
                else
                {
                    AddLog("❌ فشل النسخ الاحتياطي: " + errorMessage);
                    MessageBox.Show("فشل النسخ الاحتياطي:\n" + errorMessage,
                        "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                AddLog("❌ خطأ: " + ex.Message);
                MessageBox.Show("خطأ:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
            finally
            {
                btnBackup.IsEnabled = true;
                progressBackup.Visibility = Visibility.Collapsed;
            }
        }

        // ═══ الاستعادة ═══

        private void BtnBrowseRestore_Click(object sender, RoutedEventArgs e)
        {
            OpenFileDialog dialog = new OpenFileDialog();
            dialog.Filter = "ملفات النسخ الاحتياطي (*.bak)|*.bak";
            dialog.Title = "اختيار ملف النسخة الاحتياطية";

            if (dialog.ShowDialog() == true)
            {
                txtRestorePath.Text = dialog.FileName;
            }
        }

        private void BtnRestore_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(txtRestorePath.Text))
            {
                MessageBox.Show("الرجاء اختيار ملف النسخة الاحتياطية",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // تأكيد الاستعادة
            MessageBoxResult confirm = MessageBox.Show(
                "⚠️ تحذير هام!\n\n" +
                "استعادة النسخة الاحتياطية ستستبدل جميع البيانات الحالية.\n" +
                "هل تريد إنشاء نسخة احتياطية من البيانات الحالية أولاً؟",
                "تأكيد الاستعادة",
                MessageBoxButton.YesNoCancel,
                MessageBoxImage.Warning);

            if (confirm == MessageBoxResult.Cancel) return;

            if (confirm == MessageBoxResult.Yes)
            {
                // إنشاء نسخة احتياطية أولاً
                string autoBackup = Path.Combine(
                    BackupHelper.GetBackupPath(),
                    string.Format("AutoBackup_BeforeRestore_{0}.bak",
                        DateTime.Now.ToString("yyyyMMdd_HHmmss")));

                string error;
                if (!BackupHelper.BackupDatabase(autoBackup, out error))
                {
                    MessageBox.Show("فشل إنشاء النسخة الاحتياطية التلقائية:\n" + error +
                        "\n\nلن يتم الاستعادة.",
                        "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                    return;
                }
                AddLog("✅ تم إنشاء نسخة احتياطية تلقائية: " + autoBackup);
            }

            // التأكيد النهائي
            MessageBoxResult finalConfirm = MessageBox.Show(
                "هل أنت متأكد تماماً من استعادة النسخة الاحتياطية؟\n\n" +
                "الملف: " + txtRestorePath.Text,
                "تأكيد نهائي",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (finalConfirm != MessageBoxResult.Yes) return;

            try
            {
                AddLog("جاري استعادة النسخة الاحتياطية...");

                string errorMessage;
                bool success = BackupHelper.RestoreDatabase(
                    txtRestorePath.Text, out errorMessage);

                if (success)
                {
                    AddLog("✅ تم استعادة النسخة الاحتياطية بنجاح!");
                    MessageBox.Show(
                        "تم استعادة النسخة الاحتياطية بنجاح!\n\n" +
                        "سيتم إعادة تشغيل التطبيق.",
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                    // إعادة تشغيل التطبيق
                    System.Diagnostics.Process.Start(
                        System.Reflection.Assembly.GetExecutingAssembly().Location);
                    Application.Current.Shutdown();
                }
                else
                {
                    AddLog("❌ فشل الاستعادة: " + errorMessage);
                    MessageBox.Show("فشل استعادة النسخة الاحتياطية:\n" + errorMessage,
                        "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                AddLog("❌ خطأ: " + ex.Message);
                MessageBox.Show("خطأ:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══ مساعد ═══

        private void AddLog(string message)
        {
            txtLog.Text += string.Format("[{0}] {1}\n",
                DateTime.Now.ToString("HH:mm:ss"), message);
            txtLog.ScrollToEnd();
        }
    }
}