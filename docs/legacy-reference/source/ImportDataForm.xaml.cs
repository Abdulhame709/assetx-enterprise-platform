using System;
using System.Collections.Generic;
using System.Data;
using System.Data.OleDb;
using System.Data.SqlClient;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AssetManagement.Helpers;
using Microsoft.Win32;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة استيراد البيانات من Microsoft Access إلى SQL Server
    /// مع اختيار الجداول وتتبع الأخطاء والتصدير إلى Excel/PDF
    /// </summary>
    public partial class ImportDataForm : Window
    {
        // ═══════════════════════════════════════════════════════════
        //  المتغيرات
        // ═══════════════════════════════════════════════════════════

        #region Fields

        private string accessFilePath = "";
        private string accessConnectionString = "";
        private int totalImported = 0;
        private int totalSkipped = 0;
        private int totalUpdated = 0;

        /// <summary>هل نستخدم وضع التحديث (Update) بدلاً من التخطي</summary>
        private bool _updateMode = false;

        /// <summary>قائمة الأخطاء والأصناف المتخطاة</summary>
        private List<ImportError> _errorsList;

        /// <summary>ملخص كل جدول</summary>
        private Dictionary<string, TableImportResult> _tableResults;

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  كلاسات مساعدة
        // ═══════════════════════════════════════════════════════════

        #region Helper Classes

        /// <summary>
        /// كلاس يمثل خطأ أو تخطي أثناء الاستيراد
        /// </summary>
        public class ImportError
        {
            public int RowNumber { get; set; }
            public string TableName { get; set; }
            public string ItemName { get; set; }
            public string ItemID { get; set; }
            public string ErrorType { get; set; }
            public string ErrorDetail { get; set; }
        }

        /// <summary>
        /// نتيجة استيراد جدول واحد
        /// </summary>
        public class TableImportResult
        {
            public string TableName { get; set; }
            public string DisplayName { get; set; }
            public string Icon { get; set; }
            public int TotalInAccess { get; set; }
            public int Imported { get; set; }
            public int Updated { get; set; }
            public int Skipped { get; set; }
            public int Errors { get; set; }
            public int AlreadyExists { get; set; }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  التهيئة
        // ═══════════════════════════════════════════════════════════

        #region Initialization

        public ImportDataForm()
        {
            InitializeComponent();
            _errorsList = new List<ImportError>();
            _tableResults = new Dictionary<string, TableImportResult>();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            AddLog("مرحباً! اختر ملف قاعدة بيانات الأكسس للبدء.");
            AddLog("");
            AddLog("📌 ميزات هذه النسخة:");
            AddLog("  ✅ اختيار الجداول المراد استيرادها");
            AddLog("  ✅ وضع التحديث (تحديث الموجود + إضافة الجديد)");
            AddLog("  ✅ عرض الأصناف المتخطاة والمكررة والأخطاء");
            AddLog("  ✅ تصدير النتائج إلى Excel أو PDF");
            AddLog("");
            AddLog("سيتم استيراد البيانات بالترتيب التالي:");
            AddLog("  1️⃣ حالات الأصول (tblStatus)");
            AddLog("  2️⃣ أنواع الأصول الرئيسية (tblAssetTypes)");
            AddLog("  3️⃣ الأنواع الفرعية (tblSubTypeAssets)");
            AddLog("  4️⃣ المواقع الرئيسية (tblMainLocations)");
            AddLog("  5️⃣ المواقع الفرعية (tblSubLocations)");
            AddLog("  6️⃣ الموديلات (tblAssetModels)");
            AddLog("  7️⃣ الموظفين (tblEmployees)");
            AddLog("  8️⃣ الأصول (tblAssets)");
            AddLog("");
            AddLog("─────────────────────────────────────────");
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  دوال مساعدة للسجل
        // ═══════════════════════════════════════════════════════════

        #region Logging

        private void AddLog(string message)
        {
            txtLog.AppendText(message + "\n");
            txtLog.ScrollToEnd();
        }

        /// <summary>إضافة خطأ إلى قائمة الأخطاء</summary>
        private void AddError(string tableName, string itemName, string itemID,
            string errorType, string errorDetail)
        {
            totalSkipped++;

            _errorsList.Add(new ImportError
            {
                RowNumber = _errorsList.Count + 1,
                TableName = tableName,
                ItemName = itemName,
                ItemID = itemID,
                ErrorType = errorType,
                ErrorDetail = errorDetail
            });

            tabErrors.Header = string.Format("⚠️ أصناف متخطاة ({0})", _errorsList.Count);
        }

        /// <summary>تحديث شريط التقدم</summary>
        private void UpdateProgress(int value, string statusText)
        {
            progressBar.Value = value;
            txtProgressPercent.Text = value + "%";
            txtStatus.Text = statusText;

            Dispatcher.Invoke(System.Windows.Threading.DispatcherPriority.Background,
                new Action(delegate { }));
        }

        /// <summary>تصنيف نوع الخطأ</summary>
        private string ClassifyError(string errorMessage)
        {
            string msg = errorMessage.ToLower();
            if (msg.Contains("foreign key") || msg.Contains("reference"))
                return "مفتاح أجنبي";
            if (msg.Contains("duplicate") || msg.Contains("unique") || msg.Contains("violation"))
                return "تكرار";
            if (msg.Contains("identity_insert"))
                return "خطأ Identity";
            if (msg.Contains("null") || msg.Contains("not null"))
                return "قيمة فارغة";
            if (msg.Contains("truncat") || msg.Contains("string or binary"))
                return "نص طويل";
            if (msg.Contains("convert") || msg.Contains("cast"))
                return "نوع بيانات";
            return "خطأ آخر";
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  اختيار ملف الأكسس
        // ═══════════════════════════════════════════════════════════

        #region Browse File

        private void btnBrowse_Click(object sender, RoutedEventArgs e)
        {
            OpenFileDialog dlg = new OpenFileDialog();
            dlg.Title = "اختر ملف قاعدة بيانات الأكسس";
            dlg.Filter = "Access Database|*.accdb;*.mdb|All Files|*.*";

            if (dlg.ShowDialog() != true) return;

            accessFilePath = dlg.FileName;
            txtAccessFilePath.Text = accessFilePath;
            txtAccessFilePath.Foreground = new SolidColorBrush(Color.FromRgb(30, 41, 59));

            if (accessFilePath.EndsWith(".accdb", StringComparison.OrdinalIgnoreCase))
                accessConnectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=" + accessFilePath + ";";
            else
                accessConnectionString = "Provider=Microsoft.Jet.OLEDB.4.0;Data Source=" + accessFilePath + ";";

            try
            {
                using (OleDbConnection conn = new OleDbConnection(accessConnectionString))
                {
                    conn.Open();
                    ShowAvailableTables(conn);
                    conn.Close();
                }

                AddLog("");
                AddLog("✅ تم الاتصال بملف الأكسس بنجاح!");
                AddLog("📁 " + accessFilePath);

                // تفعيل الأزرار وإظهار لوحة اختيار الجداول
                btnImportSelected.IsEnabled = true;
                btnClearAndImport.IsEnabled = true;
                btnUpdateImport.IsEnabled = true;
                pnlTableSelection.Visibility = Visibility.Visible;
                txtStatus.Text = "جاهز للاستيراد - حدد الجداول واضغط زر الاستيراد";
            }
            catch (Exception ex)
            {
                AddLog("");
                AddLog("❌ فشل الاتصال بملف الأكسس!");
                AddLog("الخطأ: " + ex.Message);
                AddLog("");
                AddLog("💡 تأكد من:");
                AddLog("  • الملف غير مفتوح في الأكسس");
                AddLog("  • تثبيت Microsoft Access Database Engine");
                AddLog("  • صلاحية الوصول للملف");

                btnImportSelected.IsEnabled = false;
                btnClearAndImport.IsEnabled = false;
                btnUpdateImport.IsEnabled = false;
                pnlTableSummary.Visibility = Visibility.Collapsed;
                pnlTableSelection.Visibility = Visibility.Collapsed;
                txtStatus.Text = "❌ فشل الاتصال بالأكسس";
            }
        }

        /// <summary>عرض الجداول المتوفرة في ملف الأكسس</summary>
        private void ShowAvailableTables(OleDbConnection conn)
        {
            pnlTableTags.Children.Clear();

            DataTable schema = conn.GetOleDbSchemaTable(OleDbSchemaGuid.Tables, null);

            string[] expectedTables = {
                "tblStatus", "tblAssetTypes", "tblSubTypeAssets",
                "tblMainLocations", "tblSubLocations",
                "tblAssetModels", "tblEmployees", "tblAssets"
            };

            // ربط CheckBox بالجداول الموجودة
            CheckBox[] checkBoxes = {
                chkStatus, chkAssetTypes, chkSubTypes,
                chkMainLocations, chkSubLocations,
                chkModels, chkEmployees, chkAssets
            };

            AddLog("");
            AddLog("📋 الجداول المكتشفة:");

            for (int i = 0; i < expectedTables.Length; i++)
            {
                string tableName = expectedTables[i];
                bool found = false;
                int rowCount = 0;

                foreach (DataRow row in schema.Rows)
                {
                    string tblName = row["TABLE_NAME"].ToString();
                    if (tblName.Equals(tableName, StringComparison.OrdinalIgnoreCase))
                    {
                        found = true;
                        try
                        {
                            using (OleDbCommand cmd = new OleDbCommand(
                                "SELECT COUNT(*) FROM [" + tableName + "]", conn))
                            {
                                rowCount = Convert.ToInt32(cmd.ExecuteScalar());
                            }
                        }
                        catch { }
                        break;
                    }
                }

                // إنشاء بطاقة
                Border tag = new Border();
                tag.CornerRadius = new CornerRadius(6);
                tag.Padding = new Thickness(10, 5, 10, 5);
                tag.Margin = new Thickness(3);

                TextBlock tagText = new TextBlock();
                tagText.FontSize = 12;

                if (found)
                {
                    tag.Background = new SolidColorBrush(Color.FromRgb(220, 252, 231));
                    tagText.Foreground = new SolidColorBrush(Color.FromRgb(22, 101, 52));
                    tagText.Text = string.Format("✅ {0} ({1})", tableName, rowCount);
                    AddLog(string.Format("  ✅ {0} - {1} سجل", tableName, rowCount));

                    checkBoxes[i].IsChecked = true;
                    checkBoxes[i].IsEnabled = true;
                }
                else
                {
                    tag.Background = new SolidColorBrush(Color.FromRgb(254, 226, 226));
                    tagText.Foreground = new SolidColorBrush(Color.FromRgb(153, 27, 27));
                    tagText.Text = string.Format("❌ {0} (غير موجود)", tableName);
                    AddLog(string.Format("  ❌ {0} - غير موجود!", tableName));

                    checkBoxes[i].IsChecked = false;
                    checkBoxes[i].IsEnabled = false;
                }

                tag.Child = tagText;
                pnlTableTags.Children.Add(tag);
            }

            pnlTableSummary.Visibility = Visibility.Visible;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  اختيار الجداول (تحديد الكل / إلغاء الكل)
        // ═══════════════════════════════════════════════════════════

        #region Table Selection

        private void btnSelectAll_Click(object sender, RoutedEventArgs e)
        {
            SetAllCheckBoxes(true);
        }

        private void btnDeselectAll_Click(object sender, RoutedEventArgs e)
        {
            SetAllCheckBoxes(false);
        }

        private void SetAllCheckBoxes(bool isChecked)
        {
            CheckBox[] boxes = { chkStatus, chkAssetTypes, chkSubTypes,
                                 chkMainLocations, chkSubLocations,
                                 chkModels, chkEmployees, chkAssets };
            foreach (CheckBox cb in boxes)
            {
                if (cb.IsEnabled)
                    cb.IsChecked = isChecked;
            }
        }

        /// <summary>الحصول على قائمة الجداول المحددة</summary>
        private List<string> GetSelectedTables()
        {
            List<string> selected = new List<string>();

            if (chkStatus.IsChecked == true) selected.Add("tblStatus");
            if (chkAssetTypes.IsChecked == true) selected.Add("tblAssetTypes");
            if (chkSubTypes.IsChecked == true) selected.Add("tblSubTypeAssets");
            if (chkMainLocations.IsChecked == true) selected.Add("tblMainLocations");
            if (chkSubLocations.IsChecked == true) selected.Add("tblSubLocations");
            if (chkModels.IsChecked == true) selected.Add("tblAssetModels");
            if (chkEmployees.IsChecked == true) selected.Add("tblEmployees");
            if (chkAssets.IsChecked == true) selected.Add("tblAssets");

            return selected;
        }

        /// <summary>فحص التبعيات وعرض التحذيرات</summary>
        private bool CheckDependencies()
        {
            List<string> warnings = new List<string>();

            if (chkAssets.IsChecked == true)
            {
                if (chkAssetTypes.IsChecked != true)
                    warnings.Add("• الأصول تعتمد على أنواع الأصول (تأكد من وجودها في SQL Server)");
                if (chkMainLocations.IsChecked != true)
                    warnings.Add("• الأصول تعتمد على المواقع الرئيسية");
                if (chkStatus.IsChecked != true)
                    warnings.Add("• الأصول تعتمد على حالات الأصول");
            }
            if (chkSubTypes.IsChecked == true && chkAssetTypes.IsChecked != true)
                warnings.Add("• الأنواع الفرعية تعتمد على الأنواع الرئيسية");
            if (chkSubLocations.IsChecked == true && chkMainLocations.IsChecked != true)
                warnings.Add("• المواقع الفرعية تعتمد على المواقع الرئيسية");

            if (warnings.Count > 0)
            {
                string msg = "⚠️ تحذيرات التبعيات:\n\n" + string.Join("\n", warnings) +
                    "\n\nهل تريد المتابعة رغم ذلك؟";
                MessageBoxResult result = MessageBox.Show(msg, "تحذير التبعيات",
                    MessageBoxButton.YesNo, MessageBoxImage.Warning);
                return result == MessageBoxResult.Yes;
            }

            return true;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  قراءة بيانات من الأكسس (دوال مساعدة)
        // ═══════════════════════════════════════════════════════════

        #region Access Helpers

        private DataTable ReadAccessTable(string tableName)
        {
            DataTable dt = new DataTable();
            try
            {
                using (OleDbConnection conn = new OleDbConnection(accessConnectionString))
                {
                    conn.Open();
                    using (OleDbDataAdapter adapter = new OleDbDataAdapter(
                        "SELECT * FROM [" + tableName + "]", conn))
                    {
                        adapter.Fill(dt);
                    }
                }
            }
            catch (Exception ex)
            {
                AddLog("⚠️ خطأ في قراءة جدول " + tableName + ": " + ex.Message);
            }
            return dt;
        }

        private bool AccessTableExists(string tableName)
        {
            try
            {
                using (OleDbConnection conn = new OleDbConnection(accessConnectionString))
                {
                    conn.Open();
                    DataTable schema = conn.GetOleDbSchemaTable(OleDbSchemaGuid.Tables, null);
                    foreach (DataRow row in schema.Rows)
                    {
                        if (row["TABLE_NAME"].ToString().Equals(
                            tableName, StringComparison.OrdinalIgnoreCase))
                            return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private string SafeString(DataRow row, string columnName)
        {
            if (!row.Table.Columns.Contains(columnName)) return "";
            if (row[columnName] == DBNull.Value) return "";
            return row[columnName].ToString().Trim();
        }

        private int SafeInt(DataRow row, string columnName)
        {
            if (!row.Table.Columns.Contains(columnName)) return 0;
            if (row[columnName] == DBNull.Value) return 0;
            int result;
            return int.TryParse(row[columnName].ToString(), out result) ? result : 0;
        }

        private bool SafeBool(DataRow row, string columnName)
        {
            if (!row.Table.Columns.Contains(columnName)) return true;
            if (row[columnName] == DBNull.Value) return true;
            string val = row[columnName].ToString().Trim().ToLower();
            if (val == "false" || val == "0") return false;
            return true;
        }

        private object SafeValue(DataRow row, string columnName)
        {
            if (!row.Table.Columns.Contains(columnName)) return DBNull.Value;
            if (row[columnName] == DBNull.Value) return DBNull.Value;
            string val = row[columnName].ToString().Trim();
            return string.IsNullOrEmpty(val) ? DBNull.Value : (object)val;
        }

        /// <summary>تهيئة نتيجة جدول</summary>
        private void InitTableResult(string tableName, string displayName, string icon, int totalRows)
        {
            _tableResults[tableName] = new TableImportResult
            {
                TableName = tableName,
                DisplayName = displayName,
                Icon = icon,
                TotalInAccess = totalRows,
                Imported = 0,
                Updated = 0,
                Skipped = 0,
                Errors = 0,
                AlreadyExists = 0
            };
        }

        /// <summary>التحقق من وجود مفتاح أجنبي</summary>
        private bool FKExists(string tableName, string idField, int idValue)
        {
            try
            {
                object result = DatabaseHelper.ExecuteScalar(
                    string.Format("SELECT COUNT(*) FROM {0} WHERE {1} = @ID", tableName, idField),
                    new SqlParameter[] { new SqlParameter("@ID", idValue) });
                return Convert.ToInt32(result) > 0;
            }
            catch { return false; }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  أزرار الاستيراد
        // ═══════════════════════════════════════════════════════════

        #region Import Buttons

        /// <summary>استيراد الجداول المحددة فقط (تخطي الموجود)</summary>
        private void btnImportSelected_Click(object sender, RoutedEventArgs e)
        {
            List<string> selected = GetSelectedTables();
            if (selected.Count == 0)
            {
                MessageBox.Show("لم تحدد أي جدول للاستيراد!\nاختر جدول واحد على الأقل.",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!CheckDependencies()) return;

            string tablesList = string.Join("\n  • ", selected);
            MessageBoxResult result = MessageBox.Show(
                string.Format("سيتم استيراد الجداول التالية:\n  • {0}\n\n" +
                "⚠️ السجلات الموجودة مسبقاً سيتم تخطيها.\n" +
                "سيتم إضافة السجلات الجديدة فقط.\n\n" +
                "هل تريد المتابعة؟", tablesList),
                "تأكيد الاستيراد",
                MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                _updateMode = false;
                RunImport(false, selected);
            }
        }

        /// <summary>مسح وإعادة استيراد</summary>
        private void btnClearAndImport_Click(object sender, RoutedEventArgs e)
        {
            List<string> selected = GetSelectedTables();
            if (selected.Count == 0)
            {
                MessageBox.Show("لم تحدد أي جدول!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MessageBoxResult result = MessageBox.Show(
                "⚠️ تحذير خطير!\n\n" +
                "سيتم حذف جميع البيانات الحالية واستبدالها ببيانات الأكسس!\n\n" +
                "❌ لا يمكن التراجع عن هذا الإجراء!\n\n" +
                "هل أنت متأكد تماماً؟",
                "⚠️ تحذير - مسح وإعادة استيراد",
                MessageBoxButton.YesNo, MessageBoxImage.Warning);

            if (result == MessageBoxResult.Yes)
            {
                _updateMode = false;
                RunImport(true, selected);
            }
        }

        /// <summary>تحديث الموجود + إضافة الجديد</summary>
        private void btnUpdateImport_Click(object sender, RoutedEventArgs e)
        {
            List<string> selected = GetSelectedTables();
            if (selected.Count == 0)
            {
                MessageBox.Show("لم تحدد أي جدول!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!CheckDependencies()) return;

            MessageBoxResult result = MessageBox.Show(
                "سيتم تحديث السجلات الموجودة + إضافة الجديدة.\n\n" +
                "🔃 السجل الموجود: يتم تحديث بياناته\n" +
                "➕ السجل الجديد: يتم إضافته\n\n" +
                "هل تريد المتابعة؟",
                "تأكيد التحديث والاستيراد",
                MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                _updateMode = true;
                RunImport(false, selected);
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  تنفيذ الاستيراد الرئيسي
        // ═══════════════════════════════════════════════════════════

        #region Run Import

        private void RunImport(bool clearFirst, List<string> selectedTables)
        {
            btnImportSelected.IsEnabled = false;
            btnClearAndImport.IsEnabled = false;
            btnUpdateImport.IsEnabled = false;
            totalImported = 0;
            totalSkipped = 0;
            totalUpdated = 0;

            _errorsList.Clear();
            _tableResults.Clear();
            tabErrors.Header = "⚠️ أصناف متخطاة (0)";

            try
            {
                AddLog("");
                AddLog("═══════════════════════════════════════════════");
                AddLog("  بدء الاستيراد: " + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
                if (_updateMode)
                    AddLog("  📌 الوضع: تحديث الموجود + إضافة الجديد");
                else
                    AddLog("  📌 الوضع: إضافة الجديد فقط (تخطي الموجود)");
                AddLog("  📋 الجداول المحددة: " + selectedTables.Count);
                AddLog("═══════════════════════════════════════════════");

                if (clearFirst)
                {
                    AddLog("");
                    AddLog("🗑️ حذف البيانات الحالية...");
                    ClearExistingData();
                    AddLog("✅ تم حذف البيانات القديمة");
                }

                int step = 0;
                int totalSteps = selectedTables.Count;

                // الاستيراد بالترتيب الصحيح
                if (selectedTables.Contains("tblStatus"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد حالات الأصول...", step, totalSteps));
                    ImportStatus();
                }

                if (selectedTables.Contains("tblAssetTypes"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد أنواع الأصول...", step, totalSteps));
                    ImportAssetTypes();
                }

                if (selectedTables.Contains("tblSubTypeAssets"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد الأنواع الفرعية...", step, totalSteps));
                    ImportSubTypes();
                }

                if (selectedTables.Contains("tblMainLocations"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد المواقع الرئيسية...", step, totalSteps));
                    ImportMainLocations();
                }

                if (selectedTables.Contains("tblSubLocations"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد المواقع الفرعية...", step, totalSteps));
                    ImportSubLocations();
                }

                if (selectedTables.Contains("tblAssetModels"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد الموديلات...", step, totalSteps));
                    ImportModels();
                }

                if (selectedTables.Contains("tblEmployees"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد الموظفين...", step, totalSteps));
                    ImportEmployees();
                }

                if (selectedTables.Contains("tblAssets"))
                {
                    step++;
                    UpdateProgress(step * 100 / totalSteps,
                        string.Format("({0}/{1}) جاري استيراد الأصول...", step, totalSteps));
                    ImportAssets();
                }

                UpdateProgress(100, "✅ اكتمل الاستيراد!");
                ShowFinalResults();
            }
            catch (Exception ex)
            {
                AddLog("");
                AddLog("❌ خطأ عام: " + ex.Message);
                txtStatus.Text = "❌ حدث خطأ أثناء الاستيراد";
                MessageBox.Show("حدث خطأ:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }

            btnImportSelected.IsEnabled = true;
            btnClearAndImport.IsEnabled = true;
            btnUpdateImport.IsEnabled = true;
            EnableExportButtons(_errorsList.Count > 0 || totalImported > 0);
        }

        /// <summary>تفعيل/تعطيل أزرار التصدير</summary>
        private void EnableExportButtons(bool enable)
        {
            btnExportErrorsExcel.IsEnabled = _errorsList.Count > 0;
            btnExportSummaryExcel.IsEnabled = enable;
            btnExportFullExcel.IsEnabled = enable;
            btnExportErrorsPDF.IsEnabled = _errorsList.Count > 0;
            btnExportFullPDF.IsEnabled = enable;
            btnExportTxt.IsEnabled = _errorsList.Count > 0;
        }

        /// <summary>عرض النتائج النهائية</summary>
        private void ShowFinalResults()
        {
            AddLog("");
            AddLog("═══════════════════════════════════════════════");
            AddLog("  📊 نتائج الاستيراد");
            AddLog("═══════════════════════════════════════════════");
            AddLog(string.Format("  ✅ تم استيراد: {0} سجل", totalImported));
            if (totalUpdated > 0)
                AddLog(string.Format("  🔃 تم تحديث: {0} سجل", totalUpdated));
            AddLog(string.Format("  ⚠️ تم تخطي: {0} سجل", totalSkipped));
            AddLog("═══════════════════════════════════════════════");

            string countText = string.Format("مستورد: {0}", totalImported);
            if (totalUpdated > 0) countText += string.Format(" | محدّث: {0}", totalUpdated);
            countText += string.Format(" | متخطى: {0}", totalSkipped);
            txtImportCount.Text = countText;

            dgErrors.ItemsSource = _errorsList;
            BuildSummaryPanel();

            string msg = string.Format(
                "اكتمل الاستيراد!\n\n" +
                "✅ سجلات مستوردة: {0}\n", totalImported);
            if (totalUpdated > 0)
                msg += string.Format("🔃 سجلات محدّثة: {0}\n", totalUpdated);
            msg += string.Format("⚠️ سجلات متخطاة: {0}\n", totalSkipped);

            if (totalSkipped > 0)
            {
                msg += "\n📋 راجع تبويب \"أصناف متخطاة\" لمعرفة التفاصيل";
                tabResults.SelectedItem = tabErrors;
            }

            MessageBox.Show(msg, "نتائج الاستيراد",
                MessageBoxButton.OK,
                totalSkipped > 0 ? MessageBoxImage.Warning : MessageBoxImage.Information);
            // ══════════════════════════════════════════════════
            // ✅ أضف كود التحقق هنا - قبل إغلاق الدالة
            // ══════════════════════════════════════════════════
            try
            {
                object assetCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssets");
                object typeCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetTypes");
                object locCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblMainLocations");
                object statusCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblStatus");
                object empCount = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblEmployees");

                AddLog("");
                AddLog("═══════════════════════════════════════════════");
                AddLog("  🔍 التحقق من قاعدة البيانات SQL Server:");
                AddLog("═══════════════════════════════════════════════");
                AddLog(string.Format("  📦 tblAssets:        {0} سجل",
                    assetCount));
                AddLog(string.Format("  📂 tblAssetTypes:    {0} سجل",
                    typeCount));
                AddLog(string.Format("  🏢 tblMainLocations: {0} سجل",
                    locCount));
                AddLog(string.Format("  📊 tblStatus:        {0} سجل",
                    statusCount));
                AddLog(string.Format("  👥 tblEmployees:     {0} سجل",
                    empCount));
                AddLog("═══════════════════════════════════════════════");

                DataTable testData = DatabaseHelper.GetData(
                    "SELECT TOP 3 AssetID, AssetName, FullAssetCode, " +
                    "IsActive FROM tblAssets ORDER BY AssetID");

                if (testData.Rows.Count > 0)
                {
                    AddLog("  📋 عينة من الأصول المستوردة:");
                    foreach (DataRow r in testData.Rows)
                    {
                        AddLog(string.Format(
                            "    ID:{0} | {1} | {2} | Active:{3}",
                            r["AssetID"], r["AssetName"],
                            r["FullAssetCode"], r["IsActive"]));
                    }
                }
                else
                {
                    AddLog("  ❌ لا توجد أصول في قاعدة البيانات!");
                }
                AddLog("═══════════════════════════════════════════════");
            }
            catch (Exception ex)
            {
                AddLog("  ❌ خطأ في التحقق: " + ex.Message);
            }

        }
    

        /// <summary>بناء لوحة الملخص المرئية</summary>
        private void BuildSummaryPanel()
        {
            pnlSummary.Children.Clear();

            TextBlock title = new TextBlock();
            title.Text = "📊 ملخص الاستيراد - " + DateTime.Now.ToString("yyyy/MM/dd HH:mm");
            title.FontSize = 16;
            title.FontWeight = FontWeights.Bold;
            title.Foreground = new SolidColorBrush(Color.FromRgb(30, 64, 175));
            title.Margin = new Thickness(0, 0, 0, 15);
            pnlSummary.Children.Add(title);

            foreach (var kvp in _tableResults)
            {
                Border card = CreateSummaryCard(kvp.Value);
                pnlSummary.Children.Add(card);
            }

            // الإجمالي
            Border totalCard = new Border();
            totalCard.Background = new SolidColorBrush(Color.FromRgb(30, 58, 138));
            totalCard.CornerRadius = new CornerRadius(10);
            totalCard.Padding = new Thickness(15, 12, 15, 12);
            totalCard.Margin = new Thickness(0, 10, 0, 0);

            Grid totalGrid = new Grid();
            totalGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            totalGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            totalGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            totalGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });

            TextBlock totalLabel = new TextBlock
            {
                Text = "📊 الإجمالي",
                FontSize = 16,
                FontWeight = FontWeights.Bold,
                Foreground = Brushes.White,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(totalLabel, 0);
            totalGrid.Children.Add(totalLabel);

            TextBlock impText = new TextBlock
            {
                Text = string.Format("✅ {0}", totalImported),
                FontSize = 18,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(134, 239, 172)),
                Margin = new Thickness(15, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(impText, 1);
            totalGrid.Children.Add(impText);

            if (totalUpdated > 0)
            {
                TextBlock updText = new TextBlock
                {
                    Text = string.Format("🔃 {0}", totalUpdated),
                    FontSize = 18,
                    FontWeight = FontWeights.Bold,
                    Foreground = new SolidColorBrush(Color.FromRgb(147, 197, 253)),
                    Margin = new Thickness(15, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center
                };
                Grid.SetColumn(updText, 2);
                totalGrid.Children.Add(updText);
            }

            TextBlock skipText = new TextBlock
            {
                Text = string.Format("⚠️ {0}", totalSkipped),
                FontSize = 18,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(253, 224, 71)),
                Margin = new Thickness(15, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(skipText, 3);
            totalGrid.Children.Add(skipText);

            totalCard.Child = totalGrid;
            pnlSummary.Children.Add(totalCard);
        }

        /// <summary>إنشاء بطاقة ملخص لجدول واحد</summary>
        private Border CreateSummaryCard(TableImportResult tr)
        {
            Border card = new Border
            {
                Background = Brushes.White,
                CornerRadius = new CornerRadius(8),
                Padding = new Thickness(12, 10, 12, 10),
                Margin = new Thickness(0, 0, 0, 6),
                BorderBrush = new SolidColorBrush(Color.FromRgb(226, 232, 240)),
                BorderThickness = new Thickness(1)
            };

            Grid grid = new Grid();
            for (int i = 0; i < 6; i++)
                grid.ColumnDefinitions.Add(
                    i == 0 ? new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) }
                           : new ColumnDefinition { Width = GridLength.Auto });

            // اسم الجدول
            TextBlock nameText = new TextBlock
            {
                Text = string.Format("{0} {1}", tr.Icon, tr.DisplayName),
                FontSize = 14,
                FontWeight = FontWeights.SemiBold,
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(nameText, 0);
            grid.Children.Add(nameText);

            // في الأكسس
            TextBlock accessText = new TextBlock
            {
                Text = string.Format("في الأكسس: {0}", tr.TotalInAccess),
                FontSize = 12,
                Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
                Margin = new Thickness(15, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(accessText, 1);
            grid.Children.Add(accessText);

            // مستورد
            TextBlock importedText = new TextBlock
            {
                Text = string.Format("✅ {0}", tr.Imported),
                FontSize = 13,
                FontWeight = FontWeights.Bold,
                Foreground = new SolidColorBrush(Color.FromRgb(22, 163, 74)),
                Margin = new Thickness(15, 0, 0, 0),
                VerticalAlignment = VerticalAlignment.Center
            };
            Grid.SetColumn(importedText, 2);
            grid.Children.Add(importedText);

            // محدّث
            if (tr.Updated > 0)
            {
                TextBlock updatedText = new TextBlock
                {
                    Text = string.Format("🔃 {0}", tr.Updated),
                    FontSize = 12,
                    Foreground = new SolidColorBrush(Color.FromRgb(59, 130, 246)),
                    Margin = new Thickness(10, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center,
                    ToolTip = "تم تحديثه"
                };
                Grid.SetColumn(updatedText, 3);
                grid.Children.Add(updatedText);
            }

            // موجود مسبقاً
            if (tr.AlreadyExists > 0)
            {
                TextBlock existsText = new TextBlock
                {
                    Text = string.Format("🔄 {0}", tr.AlreadyExists),
                    FontSize = 12,
                    Foreground = new SolidColorBrush(Color.FromRgb(100, 116, 139)),
                    Margin = new Thickness(10, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center,
                    ToolTip = "موجود مسبقاً (تم تخطيه)"
                };
                Grid.SetColumn(existsText, 4);
                grid.Children.Add(existsText);
            }

            // أخطاء
            if (tr.Errors > 0)
            {
                TextBlock errorText = new TextBlock
                {
                    Text = string.Format("❌ {0}", tr.Errors),
                    FontSize = 13,
                    FontWeight = FontWeights.Bold,
                    Foreground = new SolidColorBrush(Color.FromRgb(220, 38, 38)),
                    Margin = new Thickness(10, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center
                };
                Grid.SetColumn(errorText, 5);
                grid.Children.Add(errorText);
            }

            card.Child = grid;
            return card;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  فلتر الأخطاء
        // ═══════════════════════════════════════════════════════════

        #region Error Filter

        private void cmbErrorFilter_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgErrors == null || _errorsList == null) return;

            ComboBoxItem selected = cmbErrorFilter.SelectedItem as ComboBoxItem;
            if (selected == null) return;

            string filter = selected.Content.ToString();

            if (filter == "الكل")
            {
                dgErrors.ItemsSource = _errorsList;
                txtFilterCount.Text = string.Format("عرض الكل ({0})", _errorsList.Count);
            }
            else
            {
                var filtered = _errorsList.Where(er => er.TableName == filter).ToList();
                dgErrors.ItemsSource = filtered;
                txtFilterCount.Text = string.Format("عرض {0} من {1}", filtered.Count, _errorsList.Count);
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  حذف البيانات الحالية
        // ═══════════════════════════════════════════════════════════

        #region Clear Data

        private void ClearExistingData()
        {
            string[] deleteOrder = {
                "DELETE FROM tblInventoryRecords",
                "DELETE FROM tblInventoryTeam",
                "DELETE FROM tblInventoryCycles",
                "DELETE FROM tblAssetMovements",
                "DELETE FROM tblMaintenance",
                "DELETE FROM tblAssets",
                "DELETE FROM tblSubLocations",
                "DELETE FROM tblMainLocations",
                "DELETE FROM tblAssetModels",
                "DELETE FROM tblSubTypeAssets",
                "DELETE FROM tblAssetTypes",
                "DELETE FROM tblEmployees"
            };

            foreach (string sql in deleteOrder)
            {
                try { DatabaseHelper.ExecuteNonQuery(sql); }
                catch { }
            }

            string[] resetTables = {
                "tblAssets", "tblAssetTypes", "tblSubTypeAssets",
                "tblMainLocations", "tblSubLocations",
                "tblAssetModels", "tblEmployees"
            };

            foreach (string table in resetTables)
            {
                try
                {
                    DatabaseHelper.ExecuteNonQuery(
                        string.Format("DBCC CHECKIDENT ('{0}', RESEED, 0)", table));
                }
                catch { }
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  دوال الاستيراد لكل جدول
        // ═══════════════════════════════════════════════════════════

        #region Import Functions

        // ──────────────────────────────────────────────────────────
        //  1. حالات الأصول (tblStatus)
        // ──────────────────────────────────────────────────────────
        private void ImportStatus()
        {
            string tbl = "tblStatus";
            AddLog("");
            AddLog("📊 استيراد حالات الأصول...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود - تم تخطيه");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "حالات الأصول", "📊", dt.Rows.Count);
            int count = 0;

            foreach (DataRow row in dt.Rows)
            {
                string name = SafeString(row, "StatusName");
                int id = SafeInt(row, "StatusID");

                if (string.IsNullOrEmpty(name))
                {
                    AddError(tbl, "(فارغ)", id.ToString(), "قيمة فارغة", "اسم الحالة فارغ");
                    _tableResults[tbl].Errors++;
                    continue;
                }

                // فحص التكرار بالاسم
                object existsByName = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblStatus WHERE StatusName = @Name",
                    new SqlParameter[] { new SqlParameter("@Name", name) });

                bool nameExists = Convert.ToInt32(existsByName) > 0;

                // فحص التكرار بالـ ID
                object existsByID = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblStatus WHERE StatusID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                bool idExists = Convert.ToInt32(existsByID) > 0;

                if (nameExists || idExists)
                {
                    if (_updateMode && idExists)
                    {
                        // تحديث السجل الموجود
                        try
                        {
                            DatabaseHelper.ExecuteNonQuery(@"
                                UPDATE tblStatus SET 
                                    StatusCode = @Code,
                                    StatusName = @Name,
                                    Description = @Desc,
                                    IsActive = @Active
                                WHERE StatusID = @ID",
                                new SqlParameter[] {
                                    new SqlParameter("@ID", id),
                                    new SqlParameter("@Code", SafeValue(row, "StatusCode")),
                                    new SqlParameter("@Name", name),
                                    new SqlParameter("@Desc", SafeValue(row, "Description")),
                                    new SqlParameter("@Active", SafeBool(row, "IsActive") ? 1 : 0)
                                });
                            totalUpdated++;
                            _tableResults[tbl].Updated++;
                            continue;
                        }
                        catch (Exception ex)
                        {
                            AddError(tbl, name, id.ToString(), "خطأ تحديث", ex.Message);
                            _tableResults[tbl].Errors++;
                            continue;
                        }
                    }
                    else
                    {
                        _tableResults[tbl].AlreadyExists++;
                        continue;
                    }
                }

                try
                {
                    DatabaseHelper.ExecuteWithIdentityInsert(
    "tblStatus",
    @"INSERT INTO tblStatus
        (StatusID, StatusCode, StatusName,
         Description, IsActive)
      VALUES
        (@ID, @Code, @Name, @Desc, @Active)",
    new SqlParameter[] {
        new SqlParameter("@ID",   id),
        new SqlParameter("@Code",
            SafeValue(row, "StatusCode")),
        new SqlParameter("@Name", name),
        new SqlParameter("@Desc",
            SafeValue(row, "Description")),
        new SqlParameter("@Active",
            SafeBool(row, "IsActive") ? 1 : 0)
    });
                    count++;
                    _tableResults[tbl].Imported++;
                }
                catch (Exception ex)
                {
                    AddLog("  ⚠️ تخطي: " + name + " - " + ex.Message);
                    AddError(tbl, name, id.ToString(), ClassifyError(ex.Message), ex.Message);
                    _tableResults[tbl].Errors++;
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} حالة", count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0} حالة", _tableResults[tbl].Updated));
            if (_tableResults[tbl].AlreadyExists > 0)
                AddLog(string.Format("  🔄 موجود مسبقاً {0}", _tableResults[tbl].AlreadyExists));
            totalImported += count;
        }

        // ──────────────────────────────────────────────────────────
        //  2. أنواع الأصول (tblAssetTypes)
        // ──────────────────────────────────────────────────────────
        private void ImportAssetTypes()
        {
            string tbl = "tblAssetTypes";
            AddLog("");
            AddLog("📂 استيراد أنواع الأصول الرئيسية...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "أنواع الأصول", "📂", dt.Rows.Count);
            int count = 0;

            foreach (DataRow row in dt.Rows)
            {
                string name = SafeString(row, "AssetTypeName");
                int id = SafeInt(row, "AssetTypeID");

                if (string.IsNullOrEmpty(name))
                {
                    AddError(tbl, "(فارغ)", id.ToString(), "قيمة فارغة", "اسم النوع فارغ");
                    _tableResults[tbl].Errors++;
                    continue;
                }

                object existsByName = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetTypes WHERE AssetTypeName = @Name",
                    new SqlParameter[] { new SqlParameter("@Name", name) });

                object existsByID = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetTypes WHERE AssetTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                bool nameExists = Convert.ToInt32(existsByName) > 0;
                bool idExists = Convert.ToInt32(existsByID) > 0;

                if (nameExists || idExists)
                {
                    if (_updateMode && idExists)
                    {
                        try
                        {
                            DatabaseHelper.ExecuteNonQuery(@"
                                UPDATE tblAssetTypes SET 
                                    AssetTypeCode = @Code,
                                    AssetTypeName = @Name,
                                    Description = @Desc,
                                    IsActive = @Active,
                                    ModifiedDate = GETDATE()
                                WHERE AssetTypeID = @ID",
                                new SqlParameter[] {
                                    new SqlParameter("@ID", id),
                                    new SqlParameter("@Code", SafeValue(row, "AssetTypeCode")),
                                    new SqlParameter("@Name", name),
                                    new SqlParameter("@Desc", SafeValue(row, "Description")),
                                    new SqlParameter("@Active", SafeBool(row, "IsActive") ? 1 : 0)
                                });
                            totalUpdated++;
                            _tableResults[tbl].Updated++;
                            continue;
                        }
                        catch (Exception ex)
                        {
                            AddError(tbl, name, id.ToString(), "خطأ تحديث", ex.Message);
                            _tableResults[tbl].Errors++;
                            continue;
                        }
                    }
                    else
                    {
                        _tableResults[tbl].AlreadyExists++;
                        continue;
                    }
                }

                try
                {
                    DatabaseHelper.ExecuteWithIdentityInsert(
    "tblAssetTypes",
    @"INSERT INTO tblAssetTypes
        (AssetTypeID, AssetTypeCode, AssetTypeName,
         Description, IsActive, CreatedDate)
      VALUES
        (@ID, @Code, @Name, @Desc, @Active, GETDATE())",
    new SqlParameter[] {
        new SqlParameter("@ID",   id),
        new SqlParameter("@Code",
            SafeValue(row, "AssetTypeCode")),
        new SqlParameter("@Name", name),
        new SqlParameter("@Desc",
            SafeValue(row, "Description")),
        new SqlParameter("@Active",
            SafeBool(row, "IsActive") ? 1 : 0)
    });
                    count++;
                    _tableResults[tbl].Imported++;
                }
                catch (Exception ex)
                {
                    AddLog("  ⚠️ تخطي: " + name + " - " + ex.Message);
                    AddError(tbl, name, id.ToString(), ClassifyError(ex.Message), ex.Message);
                    _tableResults[tbl].Errors++;
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} نوع", count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0}", _tableResults[tbl].Updated));
            totalImported += count;
        }

        // ──────────────────────────────────────────────────────────
        //  3. الأنواع الفرعية (tblSubTypeAssets)
        // ──────────────────────────────────────────────────────────
        private void ImportSubTypes()
        {
            string tbl = "tblSubTypeAssets";
            AddLog("");
            AddLog("📋 استيراد الأنواع الفرعية...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "الأنواع الفرعية", "📋", dt.Rows.Count);
            int count = 0;

            foreach (DataRow row in dt.Rows)
            {
                string name = SafeString(row, "SubTypeName");
                int id = SafeInt(row, "SubTypeID");
                int typeID = SafeInt(row, "AssetTypeID");

                if (string.IsNullOrEmpty(name))
                {
                    AddError(tbl, "(فارغ)", id.ToString(), "قيمة فارغة", "اسم النوع الفرعي فارغ");
                    _tableResults[tbl].Errors++;
                    continue;
                }

                // التحقق من النوع الرئيسي
                if (typeID > 0 && !FKExists("tblAssetTypes", "AssetTypeID", typeID))
                {
                    AddError(tbl, name, id.ToString(), "مفتاح أجنبي",
                        string.Format("نوع الأصل الرئيسي (AssetTypeID={0}) غير موجود", typeID));
                    _tableResults[tbl].Errors++;
                    continue;
                }

                object existsByID = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblSubTypeAssets WHERE SubTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                object existsByName = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblSubTypeAssets WHERE SubTypeName = @Name AND AssetTypeID = @TypeID",
                    new SqlParameter[] {
                        new SqlParameter("@Name", name),
                        new SqlParameter("@TypeID", typeID)
                    });

                bool idExists = Convert.ToInt32(existsByID) > 0;
                bool nameExists = Convert.ToInt32(existsByName) > 0;

                if (idExists || nameExists)
                {
                    if (_updateMode && idExists)
                    {
                        try
                        {
                            int parentID = SafeInt(row, "ParentSubTypeID");
                            DatabaseHelper.ExecuteNonQuery(@"
                                UPDATE tblSubTypeAssets SET 
                                    AssetTypeID = @TypeID,
                                    ParentSubTypeID = @ParentID,
                                    SubTypeCode = @Code,
                                    SubTypeName = @Name,
                                    Description = @Desc,
                                    LevelNumber = @Level,
                                    FullPath = @Path,
                                    IsActive = @Active,
                                    ModifiedDate = GETDATE()
                                WHERE SubTypeID = @ID",
                                new SqlParameter[] {
                                    new SqlParameter("@ID", id),
                                    new SqlParameter("@TypeID", typeID),
                                    new SqlParameter("@ParentID", parentID > 0 ? (object)parentID : DBNull.Value),
                                    new SqlParameter("@Code", SafeValue(row, "SubTypeCode")),
                                    new SqlParameter("@Name", name),
                                    new SqlParameter("@Desc", SafeValue(row, "Description")),
                                    new SqlParameter("@Level", SafeInt(row, "LevelNumber") > 0 ? SafeInt(row, "LevelNumber") : 1),
                                    new SqlParameter("@Path", SafeValue(row, "FullPath")),
                                    new SqlParameter("@Active", SafeBool(row, "IsActive") ? 1 : 0)
                                });
                            totalUpdated++;
                            _tableResults[tbl].Updated++;
                            continue;
                        }
                        catch (Exception ex)
                        {
                            AddError(tbl, name, id.ToString(), "خطأ تحديث", ex.Message);
                            _tableResults[tbl].Errors++;
                            continue;
                        }
                    }
                    else
                    {
                        _tableResults[tbl].AlreadyExists++;
                        continue;
                    }
                }

                try
                {
                    int parentID = SafeInt(row, "ParentSubTypeID");

                    DatabaseHelper.ExecuteWithIdentityInsert(
    "tblSubTypeAssets",
    @"INSERT INTO tblSubTypeAssets
        (SubTypeID, AssetTypeID, ParentSubTypeID,
         SubTypeCode, SubTypeName, Description,
         LevelNumber, FullPath, IsActive, CreatedDate)
      VALUES
        (@ID, @TypeID, @ParentID, @Code, @Name,
         @Desc, @Level, @Path, @Active, GETDATE())",
    new SqlParameter[] {
        new SqlParameter("@ID",     id),
        new SqlParameter("@TypeID", typeID),
        new SqlParameter("@ParentID",
            parentID > 0
                ? (object)parentID : DBNull.Value),
        new SqlParameter("@Code",
            SafeValue(row, "SubTypeCode")),
        new SqlParameter("@Name",   name),
        new SqlParameter("@Desc",
            SafeValue(row, "Description")),
        new SqlParameter("@Level",
            SafeInt(row, "LevelNumber") > 0
                ? SafeInt(row, "LevelNumber") : 1),
        new SqlParameter("@Path",
            SafeValue(row, "FullPath")),
        new SqlParameter("@Active",
            SafeBool(row, "IsActive") ? 1 : 0)
    });
                    count++;
                    _tableResults[tbl].Imported++;
                }
                catch (Exception ex)
                {
                    AddLog("  ⚠️ تخطي: " + name + " - " + ex.Message);
                    AddError(tbl, name, id.ToString(), ClassifyError(ex.Message), ex.Message);
                    _tableResults[tbl].Errors++;
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} نوع فرعي", count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0}", _tableResults[tbl].Updated));
            totalImported += count;
        }

        // ──────────────────────────────────────────────────────────
        //  4. المواقع الرئيسية (tblMainLocations)
        // ──────────────────────────────────────────────────────────
        private void ImportMainLocations()
        {
            string tbl = "tblMainLocations";
            AddLog("");
            AddLog("🏢 استيراد المواقع الرئيسية...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "المواقع الرئيسية", "🏢", dt.Rows.Count);
            int count = 0;

            foreach (DataRow row in dt.Rows)
            {
                string name = SafeString(row, "MainLocationName");
                int id = SafeInt(row, "MainLocationID");

                if (string.IsNullOrEmpty(name))
                {
                    AddError(tbl, "(فارغ)", id.ToString(), "قيمة فارغة", "اسم الموقع فارغ");
                    _tableResults[tbl].Errors++;
                    continue;
                }

                object existsByID = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblMainLocations WHERE MainLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                object existsByName = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblMainLocations WHERE MainLocationName = @Name",
                    new SqlParameter[] { new SqlParameter("@Name", name) });

                bool idExists = Convert.ToInt32(existsByID) > 0;
                bool nameExists = Convert.ToInt32(existsByName) > 0;

                if (idExists || nameExists)
                {
                    if (_updateMode && idExists)
                    {
                        try
                        {
                            DatabaseHelper.ExecuteNonQuery(@"
                                UPDATE tblMainLocations SET 
                                    MainLocationCode = @Code,
                                    MainLocationName = @Name,
                                    Description = @Desc,
                                    ResponsiblePerson = @Person,
                                    ContactInfo = @Contact,
                                    IsActive = @Active,
                                    ModifiedDate = GETDATE()
                                WHERE MainLocationID = @ID",
                                new SqlParameter[] {
                                    new SqlParameter("@ID", id),
                                    new SqlParameter("@Code", SafeValue(row, "MainLocationCode")),
                                    new SqlParameter("@Name", name),
                                    new SqlParameter("@Desc", SafeValue(row, "Description")),
                                    new SqlParameter("@Person", SafeValue(row, "ResponsiblePerson")),
                                    new SqlParameter("@Contact", SafeValue(row, "ContactInfo")),
                                    new SqlParameter("@Active", SafeBool(row, "IsActive") ? 1 : 0)
                                });
                            totalUpdated++;
                            _tableResults[tbl].Updated++;
                            continue;
                        }
                        catch (Exception ex)
                        {
                            AddError(tbl, name, id.ToString(), "خطأ تحديث", ex.Message);
                            _tableResults[tbl].Errors++;
                            continue;
                        }
                    }
                    else
                    {
                        _tableResults[tbl].AlreadyExists++;
                        continue;
                    }
                }

                try
                {
                    DatabaseHelper.ExecuteWithIdentityInsert(
     "tblMainLocations",
     @"INSERT INTO tblMainLocations
        (MainLocationID, MainLocationCode,
         MainLocationName, Description,
         ResponsiblePerson, ContactInfo,
         IsActive, CreatedDate)
      VALUES
        (@ID, @Code, @Name, @Desc,
         @Person, @Contact, @Active, GETDATE())",
     new SqlParameter[] {
        new SqlParameter("@ID",   id),
        new SqlParameter("@Code",
            SafeValue(row, "MainLocationCode")),
        new SqlParameter("@Name", name),
        new SqlParameter("@Desc",
            SafeValue(row, "Description")),
        new SqlParameter("@Person",
            SafeValue(row, "ResponsiblePerson")),
        new SqlParameter("@Contact",
            SafeValue(row, "ContactInfo")),
        new SqlParameter("@Active",
            SafeBool(row, "IsActive") ? 1 : 0)
     });
                    count++;
                    _tableResults[tbl].Imported++;
                }
                catch (Exception ex)
                {
                    AddLog("  ⚠️ تخطي: " + name + " - " + ex.Message);
                    AddError(tbl, name, id.ToString(), ClassifyError(ex.Message), ex.Message);
                    _tableResults[tbl].Errors++;
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} موقع", count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0}", _tableResults[tbl].Updated));
            totalImported += count;
        }

        // ──────────────────────────────────────────────────────────
        //  5. المواقع الفرعية (tblSubLocations)
        // ──────────────────────────────────────────────────────────
        private void ImportSubLocations()
        {
            string tbl = "tblSubLocations";
            AddLog("");
            AddLog("🚪 استيراد المواقع الفرعية...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "المواقع الفرعية", "🚪", dt.Rows.Count);
            int count = 0;

            foreach (DataRow row in dt.Rows)
            {
                string name = SafeString(row, "SubLocationName");
                int id = SafeInt(row, "SubLocationID");
                int mainLocID = SafeInt(row, "MainLocationID");

                if (string.IsNullOrEmpty(name))
                {
                    AddError(tbl, "(فارغ)", id.ToString(), "قيمة فارغة", "اسم الموقع الفرعي فارغ");
                    _tableResults[tbl].Errors++;
                    continue;
                }

                // التحقق من الموقع الرئيسي
                if (mainLocID > 0 && !FKExists("tblMainLocations", "MainLocationID", mainLocID))
                {
                    AddError(tbl, name, id.ToString(), "مفتاح أجنبي",
                        string.Format("الموقع الرئيسي (MainLocationID={0}) غير موجود", mainLocID));
                    _tableResults[tbl].Errors++;
                    continue;
                }

                object existsByID = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblSubLocations WHERE SubLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                bool idExists = Convert.ToInt32(existsByID) > 0;

                if (idExists)
                {
                    if (_updateMode)
                    {
                        try
                        {
                            int parentID = SafeInt(row, "ParentSubLocationID");
                            DatabaseHelper.ExecuteNonQuery(@"
                                UPDATE tblSubLocations SET 
                                    MainLocationID = @MainID,
                                    ParentSubLocationID = @ParentID,
                                    SubLocationCode = @Code,
                                    SubLocationName = @Name,
                                    FullPath = @Path,
                                    LevelNumber = @Level,
                                    Description = @Desc,
                                    IsActive = @Active,
                                    ModifiedDate = GETDATE()
                                WHERE SubLocationID = @ID",
                                new SqlParameter[] {
                                    new SqlParameter("@ID", id),
                                    new SqlParameter("@MainID", mainLocID),
                                    new SqlParameter("@ParentID", parentID > 0 ? (object)parentID : DBNull.Value),
                                    new SqlParameter("@Code", SafeValue(row, "SubLocationCode")),
                                    new SqlParameter("@Name", name),
                                    new SqlParameter("@Path", SafeValue(row, "FullPath")),
                                    new SqlParameter("@Level", SafeInt(row, "LevelNumber") > 0 ? SafeInt(row, "LevelNumber") : 1),
                                    new SqlParameter("@Desc", SafeValue(row, "Description")),
                                    new SqlParameter("@Active", SafeBool(row, "IsActive") ? 1 : 0)
                                });
                            totalUpdated++;
                            _tableResults[tbl].Updated++;
                            continue;
                        }
                        catch (Exception ex)
                        {
                            AddError(tbl, name, id.ToString(), "خطأ تحديث", ex.Message);
                            _tableResults[tbl].Errors++;
                            continue;
                        }
                    }
                    else
                    {
                        _tableResults[tbl].AlreadyExists++;
                        continue;
                    }
                }

                try
                {
                    int parentID = SafeInt(row, "ParentSubLocationID");

                    DatabaseHelper.ExecuteWithIdentityInsert(
    "tblSubLocations",
    @"INSERT INTO tblSubLocations
        (SubLocationID, MainLocationID,
         ParentSubLocationID, SubLocationCode,
         SubLocationName, FullPath, LevelNumber,
         Description, IsActive, CreatedDate)
      VALUES
        (@ID, @MainID, @ParentID, @Code, @Name,
         @Path, @Level, @Desc, @Active, GETDATE())",
    new SqlParameter[] {
        new SqlParameter("@ID",     id),
        new SqlParameter("@MainID", mainLocID),
        new SqlParameter("@ParentID",
            parentID > 0
                ? (object)parentID : DBNull.Value),
        new SqlParameter("@Code",
            SafeValue(row, "SubLocationCode")),
        new SqlParameter("@Name",   name),
        new SqlParameter("@Path",
            SafeValue(row, "FullPath")),
        new SqlParameter("@Level",
            SafeInt(row, "LevelNumber") > 0
                ? SafeInt(row, "LevelNumber") : 1),
        new SqlParameter("@Desc",
            SafeValue(row, "Description")),
        new SqlParameter("@Active",
            SafeBool(row, "IsActive") ? 1 : 0)
    });
                    count++;
                    _tableResults[tbl].Imported++;
                }
                catch (Exception ex)
                {
                    AddLog("  ⚠️ تخطي: " + name + " - " + ex.Message);
                    AddError(tbl, name, id.ToString(), ClassifyError(ex.Message), ex.Message);
                    _tableResults[tbl].Errors++;
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} موقع فرعي", count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0}", _tableResults[tbl].Updated));
            totalImported += count;
        }

        // ──────────────────────────────────────────────────────────
        //  6. الموديلات (tblAssetModels)
        // ──────────────────────────────────────────────────────────
        private void ImportModels()
        {
            string tbl = "tblAssetModels";
            AddLog("");
            AddLog("🔧 استيراد الموديلات...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "الموديلات", "🔧", dt.Rows.Count);
            int count = 0;

            foreach (DataRow row in dt.Rows)
            {
                string name = SafeString(row, "ModelName");
                int id = SafeInt(row, "ModelID");

                if (string.IsNullOrEmpty(name))
                {
                    AddError(tbl, "(فارغ)", id.ToString(), "قيمة فارغة", "اسم الموديل فارغ");
                    _tableResults[tbl].Errors++;
                    continue;
                }

                object existsByID = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetModels WHERE ModelID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                object existsByName = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetModels WHERE ModelName = @Name",
                    new SqlParameter[] { new SqlParameter("@Name", name) });

                bool idExists = Convert.ToInt32(existsByID) > 0;
                bool nameExists = Convert.ToInt32(existsByName) > 0;

                if (idExists || nameExists)
                {
                    if (_updateMode && idExists)
                    {
                        try
                        {
                            int typeID = SafeInt(row, "AssetTypeID");
                            int subTypeID = SafeInt(row, "SubTypeID");

                            DatabaseHelper.ExecuteNonQuery(@"
                                UPDATE tblAssetModels SET 
                                    ModelCode = @Code,
                                    ModelName = @Name,
                                    AssetTypeID = @TypeID,
                                    SubTypeID = @SubTypeID,
                                    Description = @Desc,
                                    Manufacturer = @Manu,
                                    Supplier = @Supp,
                                    IsActive = @Active,
                                    ModifiedDate = GETDATE()
                                WHERE ModelID = @ID",
                                new SqlParameter[] {
                                    new SqlParameter("@ID", id),
                                    new SqlParameter("@Code", SafeValue(row, "ModelCode")),
                                    new SqlParameter("@Name", name),
                                    new SqlParameter("@TypeID", typeID > 0 ? (object)typeID : DBNull.Value),
                                    new SqlParameter("@SubTypeID", subTypeID > 0 ? (object)subTypeID : DBNull.Value),
                                    new SqlParameter("@Desc", SafeValue(row, "Description")),
                                    new SqlParameter("@Manu", SafeValue(row, "Manufacturer")),
                                    new SqlParameter("@Supp", SafeValue(row, "Supplier")),
                                    new SqlParameter("@Active", SafeBool(row, "IsActive") ? 1 : 0)
                                });
                            totalUpdated++;
                            _tableResults[tbl].Updated++;
                            continue;
                        }
                        catch (Exception ex)
                        {
                            AddError(tbl, name, id.ToString(), "خطأ تحديث", ex.Message);
                            _tableResults[tbl].Errors++;
                            continue;
                        }
                    }
                    else
                    {
                        _tableResults[tbl].AlreadyExists++;
                        continue;
                    }
                }

                try
                {
                    int typeID = SafeInt(row, "AssetTypeID");
                    int subTypeID = SafeInt(row, "SubTypeID");

                    DatabaseHelper.ExecuteWithIdentityInsert(
    "tblAssetModels",
    @"INSERT INTO tblAssetModels
        (ModelID, ModelCode, ModelName,
         AssetTypeID, SubTypeID, Description,
         Manufacturer, Supplier,
         IsActive, CreatedDate)
      VALUES
        (@ID, @Code, @Name, @TypeID, @SubTypeID,
         @Desc, @Manu, @Supp, @Active, GETDATE())",
    new SqlParameter[] {
        new SqlParameter("@ID",   id),
        new SqlParameter("@Code",
            SafeValue(row, "ModelCode")),
        new SqlParameter("@Name", name),
        new SqlParameter("@TypeID",
            typeID > 0
                ? (object)typeID : DBNull.Value),
        new SqlParameter("@SubTypeID",
            subTypeID > 0
                ? (object)subTypeID : DBNull.Value),
        new SqlParameter("@Desc",
            SafeValue(row, "Description")),
        new SqlParameter("@Manu",
            SafeValue(row, "Manufacturer")),
        new SqlParameter("@Supp",
            SafeValue(row, "Supplier")),
        new SqlParameter("@Active",
            SafeBool(row, "IsActive") ? 1 : 0)
    });
                    count++;
                    _tableResults[tbl].Imported++;
                }
                catch (Exception ex)
                {
                    AddLog("  ⚠️ تخطي: " + name + " - " + ex.Message);
                    AddError(tbl, name, id.ToString(), ClassifyError(ex.Message), ex.Message);
                    _tableResults[tbl].Errors++;
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} موديل", count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0}", _tableResults[tbl].Updated));
            totalImported += count;
        }

        // ──────────────────────────────────────────────────────────
        //  7. الموظفين (tblEmployees)
        // ──────────────────────────────────────────────────────────
        private void ImportEmployees()
        {
            string tbl = "tblEmployees";
            AddLog("");
            AddLog("👥 استيراد الموظفين...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "الموظفين", "👥", dt.Rows.Count);
            int count = 0;

            foreach (DataRow row in dt.Rows)
            {
                string name = SafeString(row, "EmployeeName");
                int id = SafeInt(row, "EmployeeID");

                if (string.IsNullOrEmpty(name))
                {
                    AddError(tbl, "(فارغ)", id.ToString(), "قيمة فارغة", "اسم الموظف فارغ");
                    _tableResults[tbl].Errors++;
                    continue;
                }

                // معالجة اختلاف أسماء الحقول
                string phone = SafeString(row, "Contact");
                if (string.IsNullOrEmpty(phone)) phone = SafeString(row, "Phone");

                bool isActive = true;
                if (row.Table.Columns.Contains("Active"))
                    isActive = SafeBool(row, "Active");
                else if (row.Table.Columns.Contains("IsActive"))
                    isActive = SafeBool(row, "IsActive");

                object existsByID = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblEmployees WHERE EmployeeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                object existsByName = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblEmployees WHERE EmployeeName = @Name",
                    new SqlParameter[] { new SqlParameter("@Name", name) });

                bool idExists = Convert.ToInt32(existsByID) > 0;
                bool nameExists = Convert.ToInt32(existsByName) > 0;

                if (idExists || nameExists)
                {
                    if (_updateMode && idExists)
                    {
                        try
                        {
                            DatabaseHelper.ExecuteNonQuery(@"
                                UPDATE tblEmployees SET 
                                    EmployeeCode = @Code,
                                    EmployeeName = @Name,
                                    JobTitle = @Job,
                                    Department = @Dept,
                                    Phone = @Phone,
                                    IsActive = @Active,
                                    ModifiedDate = GETDATE()
                                WHERE EmployeeID = @ID",
                                new SqlParameter[] {
                                    new SqlParameter("@ID", id),
                                    new SqlParameter("@Code", SafeValue(row, "EmployeeCode")),
                                    new SqlParameter("@Name", name),
                                    new SqlParameter("@Job", SafeValue(row, "JobTitle")),
                                    new SqlParameter("@Dept", SafeValue(row, "Department")),
                                    new SqlParameter("@Phone", string.IsNullOrEmpty(phone) ? DBNull.Value : (object)phone),
                                    new SqlParameter("@Active", isActive ? 1 : 0)
                                });
                            totalUpdated++;
                            _tableResults[tbl].Updated++;
                            continue;
                        }
                        catch (Exception ex)
                        {
                            AddError(tbl, name, id.ToString(), "خطأ تحديث", ex.Message);
                            _tableResults[tbl].Errors++;
                            continue;
                        }
                    }
                    else
                    {
                        _tableResults[tbl].AlreadyExists++;
                        continue;
                    }
                }

                try
                {
                    DatabaseHelper.ExecuteWithIdentityInsert(
    "tblEmployees",
    @"INSERT INTO tblEmployees
        (EmployeeID, EmployeeCode, EmployeeName,
         JobTitle, Department, Phone,
         IsActive, CreatedDate)
      VALUES
        (@ID, @Code, @Name, @Job, @Dept,
         @Phone, @Active, GETDATE())",
    new SqlParameter[] {
        new SqlParameter("@ID",   id),
        new SqlParameter("@Code",
            SafeValue(row, "EmployeeCode")),
        new SqlParameter("@Name", name),
        new SqlParameter("@Job",
            SafeValue(row, "JobTitle")),
        new SqlParameter("@Dept",
            SafeValue(row, "Department")),
        new SqlParameter("@Phone",
            string.IsNullOrEmpty(phone)
                ? DBNull.Value : (object)phone),
        new SqlParameter("@Active",
            isActive ? 1 : 0)
    });
                    count++;
                    _tableResults[tbl].Imported++;
                }
                catch (Exception ex)
                {
                    AddLog("  ⚠️ تخطي: " + name + " - " + ex.Message);
                    AddError(tbl, name, id.ToString(), ClassifyError(ex.Message), ex.Message);
                    _tableResults[tbl].Errors++;
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} موظف", count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0}", _tableResults[tbl].Updated));
            totalImported += count;
        }

        // ──────────────────────────────────────────────────────────
        //  8. الأصول ⭐ - نسخة محسّنة باتصال واحد
        // ──────────────────────────────────────────────────────────
        private void ImportAssets()
        {
            string tbl = "tblAssets";
            AddLog("");
            AddLog("📦 استيراد الأصول...");

            if (!AccessTableExists(tbl))
            {
                AddLog("  ⚠️ جدول " + tbl + " غير موجود");
                return;
            }

            DataTable dt = ReadAccessTable(tbl);
            InitTableResult(tbl, "الأصول", "📦", dt.Rows.Count);
            int count = 0;

            AddLog(string.Format("  📊 إجمالي الأصول في الأكسس: {0}",
                dt.Rows.Count));

            // ✅ فتح اتصال واحد لكل عملية الاستيراد
            SqlConnection importConn = null;

            try
            {
                importConn = DatabaseHelper.CreateOpenConnection();

                // تشغيل IDENTITY_INSERT مرة واحدة فقط
                DatabaseHelper.ExecuteNonQueryWithConnection(
                    importConn,
                    "SET IDENTITY_INSERT tblAssets ON");

                AddLog("  ✅ تم تفعيل IDENTITY_INSERT");

                int rowIndex = 0;

                foreach (DataRow row in dt.Rows)
                {
                    rowIndex++;

                    string name = SafeString(row, "AssetName");
                    int assetID = SafeInt(row, "AssetID");

                    // عرض التقدم كل 100 صف
                    if (rowIndex % 100 == 0)
                    {
                        AddLog(string.Format(
                            "  ⏳ معالجة {0} من {1}...",
                            rowIndex, dt.Rows.Count));
                        UpdateProgress(
                            (int)(80 + (20.0 * rowIndex / dt.Rows.Count)),
                            string.Format("جاري استيراد الأصول... {0}/{1}",
                                rowIndex, dt.Rows.Count));
                    }

                    // ── التحقق من اسم الأصل ──
                    if (string.IsNullOrEmpty(name))
                    {
                        AddError(tbl, "(فارغ)", assetID.ToString(),
                            "قيمة فارغة", "اسم الأصل فارغ");
                        _tableResults[tbl].Errors++;
                        continue;
                    }

                    // ── تجهيز الأكواد ──
                    string fullCode = SafeString(row, "FullAssetCode");
                    if (string.IsNullOrEmpty(fullCode))
                        fullCode = SafeString(row, "AssetCode");
                    if (string.IsNullOrEmpty(fullCode))
                        fullCode = "AUTO-" + assetID;

                    string baseCode = SafeString(row, "BaseAssetCode");
                    if (string.IsNullOrEmpty(baseCode))
                        baseCode = fullCode;

                    // ── استخراج المفاتيح الأجنبية ──
                    int typeID = SafeInt(row, "AssetTypeID");
                    int subTypeID = SafeInt(row, "SubTypeID");
                    int modelID = SafeInt(row, "ModelID");
                    int mainLocID = SafeInt(row, "MainLocationID");
                    int subLocID = SafeInt(row, "SubLocationID");
                    int statusID = SafeInt(row, "StatusID");
                    int empID = SafeInt(row, "EmployeeID");

                    // ── فحص المفاتيح الإلزامية ──
                    if (typeID > 0 &&
                        !FKExistsWithConn(importConn,
                            "tblAssetTypes", "AssetTypeID", typeID))
                    {
                        AddError(tbl, name, assetID.ToString(),
                            "مفتاح أجنبي",
                            string.Format(
                                "نوع الأصل (AssetTypeID={0}) غير موجود",
                                typeID));
                        _tableResults[tbl].Errors++;
                        continue;
                    }

                    if (mainLocID > 0 &&
                        !FKExistsWithConn(importConn,
                            "tblMainLocations", "MainLocationID", mainLocID))
                    {
                        AddError(tbl, name, assetID.ToString(),
                            "مفتاح أجنبي",
                            string.Format(
                                "الموقع الرئيسي (MainLocationID={0}) " +
                                "غير موجود", mainLocID));
                        _tableResults[tbl].Errors++;
                        continue;
                    }

                    // ── تحويل المفاتيح الاختيارية ──
                    if (subTypeID > 0 && !FKExistsWithConn(importConn,
                        "tblSubTypeAssets", "SubTypeID", subTypeID))
                        subTypeID = 0;
                    if (subLocID > 0 && !FKExistsWithConn(importConn,
                        "tblSubLocations", "SubLocationID", subLocID))
                        subLocID = 0;
                    if (modelID > 0 && !FKExistsWithConn(importConn,
                        "tblAssetModels", "ModelID", modelID))
                        modelID = 0;
                    if (statusID > 0 && !FKExistsWithConn(importConn,
                        "tblStatus", "StatusID", statusID))
                        statusID = 0;
                    if (empID > 0 && !FKExistsWithConn(importConn,
                        "tblEmployees", "EmployeeID", empID))
                        empID = 0;

                    // ── فحص التكرار ──
                    object existsByID =
                        DatabaseHelper.ExecuteScalarWithConnection(
                            importConn,
                            "SELECT COUNT(*) FROM tblAssets " +
                            "WHERE AssetID = @ID",
                            new SqlParameter[] {
                        new SqlParameter("@ID", assetID) });

                    object existsByCode =
                        DatabaseHelper.ExecuteScalarWithConnection(
                            importConn,
                            "SELECT COUNT(*) FROM tblAssets " +
                            "WHERE FullAssetCode = @Code",
                            new SqlParameter[] {
                        new SqlParameter("@Code", fullCode) });

                    bool idExists = Convert.ToInt32(existsByID) > 0;
                    bool codeExists = Convert.ToInt32(existsByCode) > 0;

                    // ── تحضير الحقول المالية ──
                    object purchasePrice = DBNull.Value;
                    if (row.Table.Columns.Contains("PurchaseValue") &&
                        row["PurchaseValue"] != DBNull.Value)
                        purchasePrice = row["PurchaseValue"];
                    else if (row.Table.Columns.Contains("PurchasePrice") &&
                        row["PurchasePrice"] != DBNull.Value)
                        purchasePrice = row["PurchasePrice"];

                    object purchaseDate = DBNull.Value;
                    if (row.Table.Columns.Contains("PurchaseDate") &&
                        row["PurchaseDate"] != DBNull.Value)
                        purchaseDate = row["PurchaseDate"];

                    object depRate = DBNull.Value;
                    if (row.Table.Columns.Contains("DepreciationRate") &&
                        row["DepreciationRate"] != DBNull.Value)
                        depRate = row["DepreciationRate"];

                    // ══ موجود مسبقاً ══
                    if (idExists || codeExists)
                    {
                        if (_updateMode && idExists)
                        {
                            try
                            {
                                DatabaseHelper.ExecuteNonQueryWithConnection(
                                    importConn,
                                    @"UPDATE tblAssets SET
                                AssetName       = @Name,
                                BaseAssetCode   = @BaseCode,
                                FullAssetCode   = @FullCode,
                                Description     = @Desc,
                                AssetTypeID     = @TypeID,
                                SubTypeID       = @SubTypeID,
                                ModelID         = @ModelID,
                                MainLocationID  = @MainLocID,
                                SubLocationID   = @SubLocID,
                                Quantity        = @Qty,
                                StatusID        = @StatusID,
                                EmployeeID      = @EmpID,
                                PurchasePrice   = @Price,
                                PurchaseDate    = @PDate,
                                DepreciationRate = @DepRate,
                                UsefulLife      = @Life,
                                SerialNumber    = @Serial,
                                Barcode         = @Barcode,
                                ReferenceNumber = @RefNo,
                                InventoryYear   = @InvYear,
                                Notes           = @Notes,
                                IsActive        = @Active,
                                ModifiedDate    = GETDATE()
                            WHERE AssetID = @ID",
                                    BuildAssetParams(row, assetID, name,
                                        baseCode, fullCode,
                                        typeID, subTypeID, modelID,
                                        mainLocID, subLocID, statusID, empID,
                                        purchasePrice, purchaseDate, depRate));

                                totalUpdated++;
                                _tableResults[tbl].Updated++;
                                continue;
                            }
                            catch (Exception ex)
                            {
                                AddError(tbl, name, assetID.ToString(),
                                    "خطأ تحديث", ex.Message);
                                _tableResults[tbl].Errors++;
                                continue;
                            }
                        }
                        else
                        {
                            _tableResults[tbl].AlreadyExists++;
                            continue;
                        }
                    }

                    // ══ إدراج جديد ══
                    try
                    {
                        DatabaseHelper.ExecuteNonQueryWithConnection(
                            importConn,
                            @"INSERT INTO tblAssets
                        (AssetID, AssetName, BaseAssetCode,
                         FullAssetCode, Description,
                         AssetTypeID, SubTypeID, ModelID,
                         MainLocationID, SubLocationID,
                         Quantity, StatusID, EmployeeID,
                         PurchasePrice, PurchaseDate,
                         DepreciationRate, UsefulLife,
                         SerialNumber, Barcode, ReferenceNumber,
                         InventoryYear, Notes, IsActive, DateEntered)
                    VALUES
                        (@ID, @Name, @BaseCode, @FullCode, @Desc,
                         @TypeID, @SubTypeID, @ModelID,
                         @MainLocID, @SubLocID,
                         @Qty, @StatusID, @EmpID,
                         @Price, @PDate,
                         @DepRate, @Life,
                         @Serial, @Barcode, @RefNo,
                         @InvYear, @Notes, @Active, GETDATE())",
                            BuildAssetParams(row, assetID, name,
                                baseCode, fullCode,
                                typeID, subTypeID, modelID,
                                mainLocID, subLocID, statusID, empID,
                                purchasePrice, purchaseDate, depRate));

                        count++;
                        _tableResults[tbl].Imported++;
                    }
                    catch (Exception ex)
                    {
                        AddLog("  ⚠️ تخطي: " + name +
                            " (ID:" + assetID + ") - " + ex.Message);
                        AddError(tbl, name, assetID.ToString(),
                            ClassifyError(ex.Message), ex.Message);
                        _tableResults[tbl].Errors++;
                    }
                }

                // إيقاف IDENTITY_INSERT
                try
                {
                    DatabaseHelper.ExecuteNonQueryWithConnection(
                        importConn,
                        "SET IDENTITY_INSERT tblAssets OFF");
                }
                catch { }

                AddLog("  ✅ تم إيقاف IDENTITY_INSERT");
            }
            catch (Exception ex)
            {
                AddLog("  ❌ خطأ عام في استيراد الأصول: " + ex.Message);
                AddError(tbl, "خطأ عام", "0", "خطأ آخر", ex.Message);
            }
            finally
            {
                // ✅ إغلاق الاتصال في كل الحالات
                if (importConn != null)
                {
                    try
                    {
                        DatabaseHelper.ExecuteNonQueryWithConnection(
                            importConn,
                            "SET IDENTITY_INSERT tblAssets OFF");
                    }
                    catch { }

                    try { importConn.Close(); } catch { }
                    try { importConn.Dispose(); } catch { }
                }
            }

            AddLog(string.Format("  ✅ تم استيراد {0} أصل من {1}",
                count, dt.Rows.Count));
            if (_tableResults[tbl].Updated > 0)
                AddLog(string.Format("  🔃 تم تحديث {0} أصل",
                    _tableResults[tbl].Updated));
            if (_tableResults[tbl].AlreadyExists > 0)
                AddLog(string.Format("  🔄 موجود مسبقاً: {0}",
                    _tableResults[tbl].AlreadyExists));
            if (_tableResults[tbl].Errors > 0)
                AddLog(string.Format("  ⚠️ أخطاء: {0}",
                    _tableResults[tbl].Errors));
            totalImported += count;
        }

        /// <summary>
        /// فحص المفتاح الأجنبي باستخدام اتصال مفتوح
        /// </summary>
        private bool FKExistsWithConn(SqlConnection conn,
            string tableName, string idField, int idValue)
        {
            try
            {
                object result =
                    DatabaseHelper.ExecuteScalarWithConnection(
                        conn,
                        string.Format(
                            "SELECT COUNT(*) FROM {0} WHERE {1} = @ID",
                            tableName, idField),
                        new SqlParameter[] {
                    new SqlParameter("@ID", idValue) });
                return Convert.ToInt32(result) > 0;
            }
            catch { return false; }
        }

        #endregion
        // ═══════════════════════════════════════════════════════════
        //  دالة مساعدة لبناء بارامترات الأصول
        // ═══════════════════════════════════════════════════════════

        #region Asset Params Builder

        /// <summary>
        /// بناء مصفوفة البارامترات للأصول
        /// تُستخدم في INSERT و UPDATE لتجنب تكرار الكود
        /// </summary>
        private SqlParameter[] BuildAssetParams(
            DataRow row,
            int assetID,
            string name,
            string baseCode,
            string fullCode,
            int typeID,
            int subTypeID,
            int modelID,
            int mainLocID,
            int subLocID,
            int statusID,
            int empID,
            object purchasePrice,
            object purchaseDate,
            object depRate)
        {
            return new SqlParameter[]
            {
        new SqlParameter("@ID",
            assetID),

        new SqlParameter("@Name",
            name),

        new SqlParameter("@BaseCode",
            baseCode),

        new SqlParameter("@FullCode",
            fullCode),

        new SqlParameter("@Desc",
            SafeValue(row, "Description")),

        new SqlParameter("@TypeID",
            typeID > 0
                ? (object)typeID
                : DBNull.Value),

        new SqlParameter("@SubTypeID",
            subTypeID > 0
                ? (object)subTypeID
                : DBNull.Value),

        new SqlParameter("@ModelID",
            modelID > 0
                ? (object)modelID
                : DBNull.Value),

        new SqlParameter("@MainLocID",
            mainLocID > 0
                ? (object)mainLocID
                : DBNull.Value),

        new SqlParameter("@SubLocID",
            subLocID > 0
                ? (object)subLocID
                : DBNull.Value),

        new SqlParameter("@Qty",
            SafeInt(row, "Quantity") > 0
                ? (object)SafeInt(row, "Quantity")
                : (object)1),

        new SqlParameter("@StatusID",
            statusID > 0
                ? (object)statusID
                : DBNull.Value),

        new SqlParameter("@EmpID",
            empID > 0
                ? (object)empID
                : DBNull.Value),

        new SqlParameter("@Price",
            purchasePrice),

        new SqlParameter("@PDate",
            purchaseDate),

        new SqlParameter("@DepRate",
            depRate),

        new SqlParameter("@Life",
            SafeInt(row, "UsefulLife") > 0
                ? (object)SafeInt(row, "UsefulLife")
                : DBNull.Value),

        new SqlParameter("@Serial",
            SafeValue(row, "SerialNumber")),

        new SqlParameter("@Barcode",
            SafeValue(row, "Barcode")),

        new SqlParameter("@RefNo",
            SafeValue(row, "ReferenceNumber")),

        new SqlParameter("@InvYear",
            SafeInt(row, "InventoryYear") > 0
                ? (object)SafeInt(row, "InventoryYear")
                : DBNull.Value),

        new SqlParameter("@Notes",
            SafeValue(row, "Notes")),

        new SqlParameter("@Active",
            SafeBool(row, "IsActive") ? 1 : 0)
            };
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  تصدير إلى Excel
        // ═══════════════════════════════════════════════════════════

        #region Export To Excel

        /// <summary>تصدير الأخطاء إلى Excel</summary>
        private void btnExportErrorsExcel_Click(object sender, RoutedEventArgs e)
        {
            if (_errorsList.Count == 0)
            {
                MessageBox.Show("لا توجد أخطاء للتصدير.", "معلومات",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            SaveFileDialog dlg = new SaveFileDialog();
            dlg.Filter = "Excel Files (*.xls)|*.xls";
            dlg.FileName = "ImportErrors_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".xls";

            if (dlg.ShowDialog() != true) return;

            try
            {
                StringBuilder html = new StringBuilder();
                html.AppendLine("<html dir='rtl'>");
                html.AppendLine("<head><meta charset='utf-8'>");
                html.AppendLine("<style>");
                html.AppendLine("body { font-family: 'Segoe UI', Tahoma; }");
                html.AppendLine("table { border-collapse: collapse; width: 100%; }");
                html.AppendLine("th { background: #1E40AF; color: white; padding: 10px; border: 1px solid #ccc; }");
                html.AppendLine("td { padding: 8px; border: 1px solid #ddd; }");
                html.AppendLine("tr:nth-child(even) { background: #F0F9FF; }");
                html.AppendLine(".error { color: #DC2626; font-weight: bold; }");
                html.AppendLine("</style></head><body>");
                html.AppendLine("<h2>⚠️ تقرير الأصناف المتخطاة أثناء الاستيراد</h2>");
                html.AppendLine("<p>التاريخ: " + DateTime.Now.ToString("yyyy/MM/dd HH:mm") + "</p>");
                html.AppendLine("<p>الملف: " + accessFilePath + "</p>");
                html.AppendLine("<p>عدد الأخطاء: <strong>" + _errorsList.Count + "</strong></p>");
                html.AppendLine("<table>");
                html.AppendLine("<tr><th>#</th><th>الجدول</th><th>الاسم</th><th>المعرف</th><th>نوع المشكلة</th><th>التفاصيل</th></tr>");

                foreach (ImportError err in _errorsList)
                {
                    html.AppendLine(string.Format(
                        "<tr><td>{0}</td><td>{1}</td><td>{2}</td><td>{3}</td><td class='error'>{4}</td><td>{5}</td></tr>",
                        err.RowNumber, err.TableName, err.ItemName,
                        err.ItemID, err.ErrorType, err.ErrorDetail));
                }

                html.AppendLine("</table></body></html>");

                File.WriteAllText(dlg.FileName, html.ToString(), Encoding.UTF8);

                MessageBox.Show("✅ تم التصدير بنجاح إلى:\n" + dlg.FileName,
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                try { System.Diagnostics.Process.Start(dlg.FileName); }
                catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في التصدير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>تصدير ملخص الاستيراد إلى Excel</summary>
        private void btnExportSummaryExcel_Click(object sender, RoutedEventArgs e)
        {
            if (_tableResults.Count == 0)
            {
                MessageBox.Show("لا يوجد ملخص للتصدير.", "معلومات",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            SaveFileDialog dlg = new SaveFileDialog();
            dlg.Filter = "Excel Files (*.xls)|*.xls";
            dlg.FileName = "ImportSummary_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".xls";

            if (dlg.ShowDialog() != true) return;

            try
            {
                StringBuilder html = new StringBuilder();
                html.AppendLine("<html dir='rtl'>");
                html.AppendLine("<head><meta charset='utf-8'>");
                html.AppendLine("<style>");
                html.AppendLine("body { font-family: 'Segoe UI', Tahoma; }");
                html.AppendLine("table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }");
                html.AppendLine("th { background: #1E40AF; color: white; padding: 10px; border: 1px solid #ccc; }");
                html.AppendLine("td { padding: 8px; border: 1px solid #ddd; text-align: center; }");
                html.AppendLine("tr:nth-child(even) { background: #F0F9FF; }");
                html.AppendLine(".success { color: #16A34A; font-weight: bold; }");
                html.AppendLine(".updated { color: #3B82F6; font-weight: bold; }");
                html.AppendLine(".error { color: #DC2626; font-weight: bold; }");
                html.AppendLine(".total { background: #1E3A8A; color: white; font-weight: bold; font-size: 14px; }");
                html.AppendLine("</style></head><body>");
                html.AppendLine("<h2>📊 ملخص الاستيراد</h2>");
                html.AppendLine("<p>التاريخ: " + DateTime.Now.ToString("yyyy/MM/dd HH:mm") + "</p>");
                html.AppendLine("<table>");
                html.AppendLine("<tr><th>الجدول</th><th>في الأكسس</th><th>مستورد ✅</th><th>محدّث 🔃</th><th>موجود 🔄</th><th>أخطاء ❌</th></tr>");

                foreach (var kvp in _tableResults)
                {
                    TableImportResult tr = kvp.Value;
                    html.AppendLine(string.Format(
                        "<tr><td><strong>{0} {1}</strong></td><td>{2}</td><td class='success'>{3}</td><td class='updated'>{4}</td><td>{5}</td><td class='error'>{6}</td></tr>",
                        tr.Icon, tr.DisplayName, tr.TotalInAccess,
                        tr.Imported, tr.Updated, tr.AlreadyExists, tr.Errors));
                }

                html.AppendLine(string.Format(
                    "<tr class='total'><td>📊 الإجمالي</td><td></td><td>{0}</td><td>{1}</td><td></td><td>{2}</td></tr>",
                    totalImported, totalUpdated, totalSkipped));

                html.AppendLine("</table></body></html>");

                File.WriteAllText(dlg.FileName, html.ToString(), Encoding.UTF8);

                MessageBox.Show("✅ تم التصدير بنجاح إلى:\n" + dlg.FileName,
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                try { System.Diagnostics.Process.Start(dlg.FileName); }
                catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في التصدير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>تصدير التقرير الكامل إلى Excel (ملخص + أخطاء)</summary>
        private void btnExportFullExcel_Click(object sender, RoutedEventArgs e)
        {
            SaveFileDialog dlg = new SaveFileDialog();
            dlg.Filter = "Excel Files (*.xls)|*.xls";
            dlg.FileName = "FullImportReport_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".xls";

            if (dlg.ShowDialog() != true) return;

            try
            {
                string htmlContent = BuildFullReportHTML();
                File.WriteAllText(dlg.FileName, htmlContent, Encoding.UTF8);

                MessageBox.Show("✅ تم التصدير بنجاح إلى:\n" + dlg.FileName,
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                try { System.Diagnostics.Process.Start(dlg.FileName); }
                catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في التصدير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  تصدير إلى PDF (عبر HTML)
        // ═══════════════════════════════════════════════════════════

        #region Export To PDF

        /// <summary>تصدير الأخطاء كـ PDF (HTML يُفتح في المتصفح)</summary>
        private void btnExportErrorsPDF_Click(object sender, RoutedEventArgs e)
        {
            if (_errorsList.Count == 0)
            {
                MessageBox.Show("لا توجد أخطاء للتصدير.", "معلومات",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            SaveFileDialog dlg = new SaveFileDialog();
            dlg.Filter = "HTML Files (*.html)|*.html";
            dlg.FileName = "ImportErrors_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".html";

            if (dlg.ShowDialog() != true) return;

            try
            {
                StringBuilder html = new StringBuilder();
                html.AppendLine("<!DOCTYPE html><html dir='rtl' lang='ar'>");
                html.AppendLine("<head><meta charset='utf-8'>");
                html.AppendLine("<title>تقرير الأخطاء</title>");
                html.AppendLine("<style>");
                html.AppendLine("@media print { body { margin: 10mm; } .no-print { display: none; } }");
                html.AppendLine("body { font-family: 'Segoe UI', Tahoma, Arial; font-size: 12px; direction: rtl; }");
                html.AppendLine("h1 { color: #1E40AF; border-bottom: 3px solid #1E40AF; padding-bottom: 10px; }");
                html.AppendLine(".info { background: #F0F9FF; padding: 10px; border-radius: 8px; margin: 10px 0; }");
                html.AppendLine("table { border-collapse: collapse; width: 100%; margin-top: 15px; }");
                html.AppendLine("th { background: #DC2626; color: white; padding: 10px; border: 1px solid #ccc; font-size: 13px; }");
                html.AppendLine("td { padding: 8px; border: 1px solid #ddd; }");
                html.AppendLine("tr:nth-child(even) { background: #FEF2F2; }");
                html.AppendLine(".btn { background: #3B82F6; color: white; padding: 10px 20px; border: none; " +
                    "border-radius: 6px; cursor: pointer; font-size: 14px; margin: 10px 0; }");
                html.AppendLine("</style></head><body>");
                html.AppendLine("<button class='btn no-print' onclick='window.print()'>🖨️ طباعة / حفظ كـ PDF</button>");
                html.AppendLine("<h1>⚠️ تقرير الأصناف المتخطاة أثناء الاستيراد</h1>");
                html.AppendLine("<div class='info'>");
                html.AppendLine("<strong>التاريخ:</strong> " + DateTime.Now.ToString("yyyy/MM/dd HH:mm") + "<br/>");
                html.AppendLine("<strong>الملف:</strong> " + accessFilePath + "<br/>");
                html.AppendLine("<strong>عدد الأخطاء:</strong> " + _errorsList.Count);
                html.AppendLine("</div>");

                // تجميع حسب الجدول
                var grouped = _errorsList.GroupBy(er => er.TableName);
                foreach (var group in grouped)
                {
                    html.AppendLine(string.Format("<h3>{0} ({1} خطأ)</h3>", group.Key, group.Count()));
                    html.AppendLine("<table>");
                    html.AppendLine("<tr><th>#</th><th>الاسم</th><th>المعرف</th><th>نوع المشكلة</th><th>التفاصيل</th></tr>");

                    foreach (ImportError err in group)
                    {
                        html.AppendLine(string.Format(
                            "<tr><td>{0}</td><td>{1}</td><td>{2}</td><td><strong>{3}</strong></td><td>{4}</td></tr>",
                            err.RowNumber, err.ItemName, err.ItemID, err.ErrorType, err.ErrorDetail));
                    }
                    html.AppendLine("</table>");
                }

                html.AppendLine("</body></html>");

                File.WriteAllText(dlg.FileName, html.ToString(), Encoding.UTF8);

                MessageBox.Show("✅ تم إنشاء التقرير!\n\n" +
                    "سيتم فتحه في المتصفح.\n" +
                    "استخدم Ctrl+P للطباعة أو الحفظ كـ PDF.",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                try { System.Diagnostics.Process.Start(dlg.FileName); }
                catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>تصدير التقرير الكامل كـ PDF (HTML)</summary>
        private void btnExportFullPDF_Click(object sender, RoutedEventArgs e)
        {
            SaveFileDialog dlg = new SaveFileDialog();
            dlg.Filter = "HTML Files (*.html)|*.html";
            dlg.FileName = "FullImportReport_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".html";

            if (dlg.ShowDialog() != true) return;

            try
            {
                string htmlContent = BuildFullReportHTML();

                // إضافة زر طباعة وتنسيق PDF
                htmlContent = htmlContent.Replace("<body>",
                    "<body><button class='btn no-print' onclick='window.print()' " +
                    "style='background:#3B82F6;color:white;padding:10px 20px;border:none;" +
                    "border-radius:6px;cursor:pointer;font-size:14px;margin:10px 0;'>" +
                    "🖨️ طباعة / حفظ كـ PDF</button>");

                // إضافة CSS للطباعة
                htmlContent = htmlContent.Replace("</style>",
                    "@media print { .no-print { display: none; } body { margin: 10mm; } }</style>");

                File.WriteAllText(dlg.FileName, htmlContent, Encoding.UTF8);

                MessageBox.Show("✅ تم إنشاء التقرير!\n\n" +
                    "سيتم فتحه في المتصفح.\n" +
                    "استخدم Ctrl+P للطباعة أو الحفظ كـ PDF.",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                try { System.Diagnostics.Process.Start(dlg.FileName); }
                catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>بناء HTML للتقرير الكامل (ملخص + أخطاء)</summary>
        private string BuildFullReportHTML()
        {
            StringBuilder html = new StringBuilder();
            html.AppendLine("<!DOCTYPE html><html dir='rtl' lang='ar'>");
            html.AppendLine("<head><meta charset='utf-8'>");
            html.AppendLine("<title>تقرير الاستيراد الكامل</title>");
            html.AppendLine("<style>");
            html.AppendLine("body { font-family: 'Segoe UI', Tahoma, Arial; font-size: 12px; direction: rtl; }");
            html.AppendLine("h1 { color: #1E40AF; border-bottom: 3px solid #1E40AF; padding-bottom: 10px; }");
            html.AppendLine("h2 { color: #1E3A8A; margin-top: 25px; }");
            html.AppendLine(".info-box { background: #F0F9FF; padding: 15px; border-radius: 10px; " +
                "margin: 15px 0; border-left: 4px solid #3B82F6; }");
            html.AppendLine(".stats { display: flex; gap: 15px; margin: 15px 0; flex-wrap: wrap; }");
            html.AppendLine(".stat-card { padding: 15px 20px; border-radius: 10px; text-align: center; min-width: 120px; }");
            html.AppendLine(".stat-imported { background: #DCFCE7; color: #166534; }");
            html.AppendLine(".stat-updated { background: #DBEAFE; color: #1E40AF; }");
            html.AppendLine(".stat-skipped { background: #FEF3C7; color: #92400E; }");
            html.AppendLine("table { border-collapse: collapse; width: 100%; margin-top: 10px; }");
            html.AppendLine("th { background: #1E40AF; color: white; padding: 10px; border: 1px solid #ccc; }");
            html.AppendLine("td { padding: 8px; border: 1px solid #ddd; }");
            html.AppendLine("tr:nth-child(even) { background: #F8FAFC; }");
            html.AppendLine(".success { color: #16A34A; font-weight: bold; }");
            html.AppendLine(".updated-text { color: #3B82F6; font-weight: bold; }");
            html.AppendLine(".error-text { color: #DC2626; font-weight: bold; }");
            html.AppendLine(".total-row { background: #1E3A8A !important; color: white; font-weight: bold; }");
            html.AppendLine(".section-break { border-top: 2px solid #E2E8F0; margin: 30px 0; }");
            html.AppendLine("</style></head><body>");

            // العنوان
            html.AppendLine("<h1>📊 تقرير الاستيراد الكامل</h1>");

            // معلومات عامة
            html.AppendLine("<div class='info-box'>");
            html.AppendLine("<strong>📅 التاريخ:</strong> " + DateTime.Now.ToString("yyyy/MM/dd HH:mm:ss") + "<br/>");
            html.AppendLine("<strong>📁 الملف:</strong> " + accessFilePath + "<br/>");
            html.AppendLine("<strong>📌 الوضع:</strong> " + (_updateMode ? "تحديث + إضافة" : "إضافة فقط"));
            html.AppendLine("</div>");

            // إحصائيات سريعة
            html.AppendLine("<div class='stats'>");
            html.AppendLine(string.Format("<div class='stat-card stat-imported'><div style='font-size:24px;font-weight:bold;'>{0}</div><div>مستورد ✅</div></div>", totalImported));
            if (totalUpdated > 0)
                html.AppendLine(string.Format("<div class='stat-card stat-updated'><div style='font-size:24px;font-weight:bold;'>{0}</div><div>محدّث 🔃</div></div>", totalUpdated));
            html.AppendLine(string.Format("<div class='stat-card stat-skipped'><div style='font-size:24px;font-weight:bold;'>{0}</div><div>متخطى ⚠️</div></div>", totalSkipped));
            html.AppendLine("</div>");

            // جدول الملخص
            html.AppendLine("<h2>📋 ملخص الجداول</h2>");
            html.AppendLine("<table>");
            html.AppendLine("<tr><th>الجدول</th><th>في الأكسس</th><th>مستورد ✅</th><th>محدّث 🔃</th><th>موجود 🔄</th><th>أخطاء ❌</th></tr>");

            foreach (var kvp in _tableResults)
            {
                TableImportResult tr = kvp.Value;
                html.AppendLine(string.Format(
                    "<tr><td><strong>{0} {1}</strong></td><td style='text-align:center'>{2}</td>" +
                    "<td style='text-align:center' class='success'>{3}</td>" +
                    "<td style='text-align:center' class='updated-text'>{4}</td>" +
                    "<td style='text-align:center'>{5}</td>" +
                    "<td style='text-align:center' class='error-text'>{6}</td></tr>",
                    tr.Icon, tr.DisplayName, tr.TotalInAccess,
                    tr.Imported, tr.Updated, tr.AlreadyExists, tr.Errors));
            }

            html.AppendLine(string.Format(
                "<tr class='total-row'><td>📊 الإجمالي</td><td></td><td style='text-align:center'>{0}</td>" +
                "<td style='text-align:center'>{1}</td><td></td><td style='text-align:center'>{2}</td></tr>",
                totalImported, totalUpdated, totalSkipped));
            html.AppendLine("</table>");

            // الأخطاء (إن وجدت)
            if (_errorsList.Count > 0)
            {
                html.AppendLine("<div class='section-break'></div>");
                html.AppendLine(string.Format("<h2>⚠️ الأصناف المتخطاة ({0})</h2>", _errorsList.Count));

                var grouped = _errorsList.GroupBy(er => er.TableName);
                foreach (var group in grouped)
                {
                    html.AppendLine(string.Format("<h3>{0} ({1})</h3>", group.Key, group.Count()));
                    html.AppendLine("<table>");
                    html.AppendLine("<tr><th>#</th><th>الاسم</th><th>المعرف</th><th>نوع المشكلة</th><th>التفاصيل</th></tr>");

                    foreach (ImportError err in group)
                    {
                        html.AppendLine(string.Format(
                            "<tr><td>{0}</td><td>{1}</td><td>{2}</td><td class='error-text'>{3}</td><td>{4}</td></tr>",
                            err.RowNumber, err.ItemName, err.ItemID, err.ErrorType, err.ErrorDetail));
                    }
                    html.AppendLine("</table>");
                }
            }

            html.AppendLine("<div class='section-break'></div>");
            html.AppendLine("<p style='color:#94A3B8;text-align:center;'>تم إنشاء هذا التقرير بواسطة نظام إدارة الأصول الثابتة</p>");
            html.AppendLine("</body></html>");

            return html.ToString();
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        //  تصدير نصي وحافظة
        // ═══════════════════════════════════════════════════════════

        #region Export Text & Clipboard

        /// <summary>تصدير الأخطاء كملف نصي</summary>
        private void btnExportErrors_Click(object sender, RoutedEventArgs e)
        {
            if (_errorsList.Count == 0)
            {
                MessageBox.Show("لا توجد أخطاء للتصدير.", "معلومات",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            SaveFileDialog dlg = new SaveFileDialog();
            dlg.Filter = "ملف نصي (*.txt)|*.txt";
            dlg.FileName = "ImportErrors_" + DateTime.Now.ToString("yyyyMMdd_HHmm") + ".txt";

            if (dlg.ShowDialog() != true) return;

            try
            {
                StringBuilder report = new StringBuilder();
                report.AppendLine("═══════════════════════════════════════════════");
                report.AppendLine("  تقرير الأصناف المتخطاة أثناء الاستيراد");
                report.AppendLine("  التاريخ: " + DateTime.Now.ToString("yyyy/MM/dd HH:mm"));
                report.AppendLine("  الملف: " + accessFilePath);
                report.AppendLine("═══════════════════════════════════════════════");
                report.AppendLine();

                // ملخص
                report.AppendLine(string.Format("  ✅ مستورد: {0} | 🔃 محدّث: {1} | ⚠️ متخطى: {2}",
                    totalImported, totalUpdated, totalSkipped));
                report.AppendLine();

                var grouped = _errorsList.GroupBy(er => er.TableName);
                foreach (var group in grouped)
                {
                    report.AppendLine(string.Format("── {0} ({1} خطأ) ──", group.Key, group.Count()));
                    foreach (ImportError err in group)
                    {
                        report.AppendLine(string.Format(
                            "  [{0}] ID:{1} | {2} | {3}",
                            err.RowNumber, err.ItemID, err.ItemName, err.ErrorType));
                        report.AppendLine("        " + err.ErrorDetail);
                    }
                    report.AppendLine();
                }

                report.AppendLine("═══════════════════════════════════════════════");
                report.AppendLine(string.Format("  الإجمالي: {0} خطأ", _errorsList.Count));

                File.WriteAllText(dlg.FileName, report.ToString(), Encoding.UTF8);

                MessageBox.Show("✅ تم التصدير إلى:\n" + dlg.FileName,
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                try { System.Diagnostics.Process.Start(dlg.FileName); }
                catch { }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>نسخ أخطاء الجدول المعروض</summary>
        private void btnCopyErrors_Click(object sender, RoutedEventArgs e)
        {
            if (_errorsList.Count == 0) return;

            StringBuilder sb = new StringBuilder();
            sb.AppendLine("الجدول\tالاسم\tالمعرف\tنوع الخطأ\tالتفاصيل");

            foreach (ImportError err in _errorsList)
            {
                sb.AppendLine(string.Format("{0}\t{1}\t{2}\t{3}\t{4}",
                    err.TableName, err.ItemName, err.ItemID,
                    err.ErrorType, err.ErrorDetail));
            }

            try
            {
                Clipboard.SetText(sb.ToString());
                MessageBox.Show("✅ تم النسخ إلى الحافظة (يمكن لصقه في Excel)",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch { }
        }

        /// <summary>نسخ كل شيء (السجل الكامل) إلى الحافظة</summary>
        private void btnCopyAllToClipboard_Click(object sender, RoutedEventArgs e)
        {
            StringBuilder sb = new StringBuilder();

            // الملخص
            sb.AppendLine("═══ ملخص الاستيراد ═══");
            sb.AppendLine(string.Format("مستورد: {0} | محدّث: {1} | متخطى: {2}",
                totalImported, totalUpdated, totalSkipped));
            sb.AppendLine();

            // تفاصيل كل جدول
            foreach (var kvp in _tableResults)
            {
                TableImportResult tr = kvp.Value;
                sb.AppendLine(string.Format("{0} {1}: في الأكسس={2} | مستورد={3} | محدّث={4} | موجود={5} | أخطاء={6}",
                    tr.Icon, tr.DisplayName, tr.TotalInAccess,
                    tr.Imported, tr.Updated, tr.AlreadyExists, tr.Errors));
            }

            // الأخطاء
            if (_errorsList.Count > 0)
            {
                sb.AppendLine();
                sb.AppendLine("═══ الأخطاء ═══");
                sb.AppendLine("الجدول\tالاسم\tالمعرف\tالنوع\tالتفاصيل");
                foreach (ImportError err in _errorsList)
                {
                    sb.AppendLine(string.Format("{0}\t{1}\t{2}\t{3}\t{4}",
                        err.TableName, err.ItemName, err.ItemID, err.ErrorType, err.ErrorDetail));
                }
            }

            try
            {
                Clipboard.SetText(sb.ToString());
                MessageBox.Show("✅ تم نسخ التقرير الكامل إلى الحافظة",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ: " + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        #endregion


    }
}