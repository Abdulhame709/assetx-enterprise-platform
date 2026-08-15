using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    public partial class AssetMovementHistoryForm : Window
    {
        private DataTable _allMovements;
        private bool _isLoading = false;

        public AssetMovementHistoryForm()
        {
            InitializeComponent();
            _isLoading = true;
            LoadMainLocations();
            LoadEmployees();
            _isLoading = false;
            LoadMovements();
        }

        // ═══════════════════════════════════════════
        //  تحميل المواقع الرئيسية
        // ═══════════════════════════════════════════
        private void LoadMainLocations()
        {
            try
            {
                string query = @"SELECT MainLocationID, MainLocationName 
                                 FROM tblMainLocations 
                                 WHERE IsActive = 1 
                                 ORDER BY MainLocationName";

                DataTable dt = DatabaseHelper.GetData(query);

                // إضافة خيار "الكل"
                DataRow allRow = dt.NewRow();
                allRow["MainLocationID"] = 0;
                allRow["MainLocationName"] = "-- الكل --";
                dt.Rows.InsertAt(allRow, 0);

                cmbMainLocation.ItemsSource = dt.DefaultView;
                cmbMainLocation.SelectedIndex = 0;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل المواقع الرئيسية:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════
        //  تحميل المواقع الفرعية حسب الموقع الرئيسي
        // ═══════════════════════════════════════════
        private void LoadSubLocations(int mainLocationID)
        {
            try
            {
                cmbSubLocation.ItemsSource = null;
                cmbSubLocation.IsEnabled = false;

                if (mainLocationID <= 0)
                    return;

                string query = @"SELECT SubLocationID, SubLocationName 
                                 FROM tblSubLocations 
                                 WHERE MainLocationID = @MainLocationID 
                                   AND IsActive = 1 
                                 ORDER BY SubLocationName";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@MainLocationID", mainLocationID)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                if (dt.Rows.Count == 0)
                    return;

                // إضافة خيار "الكل"
                DataRow allRow = dt.NewRow();
                allRow["SubLocationID"] = 0;
                allRow["SubLocationName"] = "-- الكل --";
                dt.Rows.InsertAt(allRow, 0);

                cmbSubLocation.ItemsSource = dt.DefaultView;
                cmbSubLocation.SelectedIndex = 0;
                cmbSubLocation.IsEnabled = true;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل المواقع الفرعية:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════
        //  تحميل قائمة الموظفين
        // ═══════════════════════════════════════════
        private void LoadEmployees()
        {
            try
            {
                string query = @"SELECT EmployeeID, 
                                        EmployeeName + ISNULL(' - ' + Department, '') AS DisplayName
                                 FROM tblEmployees 
                                 WHERE IsActive = 1 
                                 ORDER BY EmployeeName";

                DataTable dt = DatabaseHelper.GetData(query);

                // إضافة خيار "الكل"
                DataRow allRow = dt.NewRow();
                allRow["EmployeeID"] = 0;
                allRow["DisplayName"] = "-- الكل --";
                dt.Rows.InsertAt(allRow, 0);

                cmbEmployee.ItemsSource = dt.DefaultView;
                cmbEmployee.SelectedIndex = 0;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل الموظفين:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════
        //  حدث تغيير الموقع الرئيسي → تحميل الفرعية
        // ═══════════════════════════════════════════
        private void cmbMainLocation_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (cmbMainLocation.SelectedValue == null)
                return;

            int mainLocID = 0;
            int.TryParse(cmbMainLocation.SelectedValue.ToString(), out mainLocID);

            LoadSubLocations(mainLocID);

            if (!_isLoading)
                ApplyFilters();
        }

        // ═══════════════════════════════════════════
        //  تحميل جميع الحركات
        // ═══════════════════════════════════════════
        private void LoadMovements()
        {
            try
            {
                string query = @"
                    SELECT 
                        m.MovementID,
                        m.MovementDate,
                        m.MovementType,
                        m.Quantity,
                        m.Reason,
                        m.ReferenceNo,
                        m.ApprovedBy,
                        m.Notes,
                        m.CreatedBy,
                        m.CreatedDate,

                        -- بيانات الأصل
                        a.AssetName,
                        a.FullAssetCode,
                        a.AssetID,

                        -- من موقع
                        ml1.MainLocationName AS FromMainLocation,
                        sl1.SubLocationName AS FromSubLocation,

                        -- إلى موقع
                        ml2.MainLocationName AS ToMainLocation,
                        sl2.SubLocationName AS ToSubLocation,

                        -- من/إلى موظف
                        e1.EmployeeName AS FromEmployeeName,
                        e2.EmployeeName AS ToEmployeeName,

                        -- الحالة
                        s1.StatusName AS OldStatus,
                        s2.StatusName AS NewStatus,

                        -- حقول للفلترة
                        m.FromMainLocationID,
                        m.ToMainLocationID,
                        m.FromSubLocationID,
                        m.ToSubLocationID,
                        m.FromEmployeeID,
                        m.ToEmployeeID

                    FROM tblAssetMovements m
                    INNER JOIN tblAssets a ON m.AssetID = a.AssetID
                    LEFT JOIN tblMainLocations ml1 ON m.FromMainLocationID = ml1.MainLocationID
                    LEFT JOIN tblSubLocations sl1 ON m.FromSubLocationID = sl1.SubLocationID
                    LEFT JOIN tblMainLocations ml2 ON m.ToMainLocationID = ml2.MainLocationID
                    LEFT JOIN tblSubLocations sl2 ON m.ToSubLocationID = sl2.SubLocationID
                    LEFT JOIN tblEmployees e1 ON m.FromEmployeeID = e1.EmployeeID
                    LEFT JOIN tblEmployees e2 ON m.ToEmployeeID = e2.EmployeeID
                    LEFT JOIN tblStatus s1 ON m.OldStatusID = s1.StatusID
                    LEFT JOIN tblStatus s2 ON m.NewStatusID = s2.StatusID

                    ORDER BY m.MovementDate DESC, m.MovementID DESC";

                _allMovements = DatabaseHelper.GetData(query);

                AddComputedColumns(_allMovements);

                dgMovements.ItemsSource = _allMovements.DefaultView;

                UpdateStatistics(_allMovements);
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل سجل الحركات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════
        //  إضافة أعمدة محسوبة
        // ═══════════════════════════════════════════
        private void AddComputedColumns(DataTable dt)
        {
            if (!dt.Columns.Contains("FromLocation"))
                dt.Columns.Add("FromLocation", typeof(string));

            if (!dt.Columns.Contains("ToLocation"))
                dt.Columns.Add("ToLocation", typeof(string));

            if (!dt.Columns.Contains("FromEmployee"))
                dt.Columns.Add("FromEmployee", typeof(string));

            if (!dt.Columns.Contains("ToEmployee"))
                dt.Columns.Add("ToEmployee", typeof(string));

            if (!dt.Columns.Contains("MovementTypeColor"))
                dt.Columns.Add("MovementTypeColor", typeof(string));

            foreach (DataRow row in dt.Rows)
            {
                // دمج الموقع المصدر
                string fromMain = row["FromMainLocation"] != DBNull.Value
                    ? row["FromMainLocation"].ToString() : "";
                string fromSub = row["FromSubLocation"] != DBNull.Value
                    ? row["FromSubLocation"].ToString() : "";

                if (!string.IsNullOrEmpty(fromSub))
                    row["FromLocation"] = fromMain + " / " + fromSub;
                else
                    row["FromLocation"] = fromMain;

                // دمج الموقع الهدف
                string toMain = row["ToMainLocation"] != DBNull.Value
                    ? row["ToMainLocation"].ToString() : "";
                string toSub = row["ToSubLocation"] != DBNull.Value
                    ? row["ToSubLocation"].ToString() : "";

                if (!string.IsNullOrEmpty(toSub))
                    row["ToLocation"] = toMain + " / " + toSub;
                else
                    row["ToLocation"] = toMain;

                // الموظفين
                row["FromEmployee"] = row["FromEmployeeName"] != DBNull.Value
                    ? row["FromEmployeeName"].ToString() : "";
                row["ToEmployee"] = row["ToEmployeeName"] != DBNull.Value
                    ? row["ToEmployeeName"].ToString() : "";

                // لون نوع الحركة
                string movementType = row["MovementType"] != DBNull.Value
                    ? row["MovementType"].ToString() : "";
                row["MovementTypeColor"] = GetMovementTypeColor(movementType);
            }
        }

        // ═══════════════════════════════════════════
        //  ألوان أنواع الحركات
        // ═══════════════════════════════════════════
        private string GetMovementTypeColor(string type)
        {
            switch (type)
            {
                case "نقل": return "#3498DB";
                case "تسليم": return "#F39C12";
                case "استلام": return "#27AE60";
                case "إتلاف": return "#E74C3C";
                case "استغناء": return "#95A5A6";
                case "إضافة": return "#2ECC71";
                default: return "#7F8C8D";
            }
        }

        // ═══════════════════════════════════════════
        //  تحديث الإحصائيات
        // ═══════════════════════════════════════════
        private void UpdateStatistics(DataTable dt)
        {
            int total = dt.DefaultView.Count;
            int transfers = 0;
            int deliveries = 0;
            int receives = 0;
            int disposals = 0;

            foreach (DataRowView rowView in dt.DefaultView)
            {
                string type = rowView["MovementType"] != DBNull.Value
                    ? rowView["MovementType"].ToString() : "";

                switch (type)
                {
                    case "نقل":
                        transfers++;
                        break;
                    case "تسليم":
                        deliveries++;
                        break;
                    case "استلام":
                        receives++;
                        break;
                    case "إتلاف":
                    case "استغناء":
                        disposals++;
                        break;
                }
            }

            txtTotalCount.Text = total.ToString();
            txtTransferCount.Text = transfers.ToString();
            txtDeliveryCount.Text = deliveries.ToString();
            txtReceiveCount.Text = receives.ToString();
            txtDisposalCount.Text = disposals.ToString();

            txtStatusMessage.Text = string.Format(
                "تم تحميل {0} حركة | آخر تحديث: {1}",
                total, DateTime.Now.ToString("HH:mm:ss"));
        }

        // ═══════════════════════════════════════════
        //  الفلترة الشاملة
        // ═══════════════════════════════════════════
        private void ApplyFilters()
        {
            if (_allMovements == null) return;

            try
            {
                List<string> conditions = new List<string>();

                // ── فلتر النص (بحث) ──
                string searchText = txtSearch.Text.Trim();
                if (!string.IsNullOrEmpty(searchText))
                {
                    searchText = searchText.Replace("'", "''");
                    conditions.Add(string.Format(
                        "(AssetName LIKE '%{0}%' OR FullAssetCode LIKE '%{0}%')",
                        searchText));
                }

                // ── فلتر نوع الحركة ──
                if (cmbMovementType.SelectedIndex > 0)
                {
                    ComboBoxItem selectedItem = cmbMovementType.SelectedItem as ComboBoxItem;
                    if (selectedItem != null)
                    {
                        string selectedType = selectedItem.Content.ToString();
                        conditions.Add(string.Format("MovementType = '{0}'", selectedType));
                    }
                }

                // ── فلتر التاريخ (من) ──
                if (dpFromDate.SelectedDate.HasValue)
                {
                    conditions.Add(string.Format(
                        "MovementDate >= '{0}'",
                        dpFromDate.SelectedDate.Value.ToString("yyyy-MM-dd")));
                }

                // ── فلتر التاريخ (إلى) ──
                if (dpToDate.SelectedDate.HasValue)
                {
                    conditions.Add(string.Format(
                        "MovementDate <= '{0} 23:59:59'",
                        dpToDate.SelectedDate.Value.ToString("yyyy-MM-dd")));
                }

                // ── فلتر الموقع الرئيسي ──
                if (cmbMainLocation.SelectedValue != null)
                {
                    int mainLocID = 0;
                    int.TryParse(cmbMainLocation.SelectedValue.ToString(), out mainLocID);

                    if (mainLocID > 0)
                    {
                        conditions.Add(string.Format(
                            "(FromMainLocationID = {0} OR ToMainLocationID = {0})",
                            mainLocID));
                    }
                }

                // ── فلتر الموقع الفرعي ──
                if (cmbSubLocation.IsEnabled && cmbSubLocation.SelectedValue != null)
                {
                    int subLocID = 0;
                    int.TryParse(cmbSubLocation.SelectedValue.ToString(), out subLocID);

                    if (subLocID > 0)
                    {
                        conditions.Add(string.Format(
                            "(FromSubLocationID = {0} OR ToSubLocationID = {0})",
                            subLocID));
                    }
                }

                // ── فلتر الموظف (عهدة) ──
                if (cmbEmployee.SelectedValue != null)
                {
                    int empID = 0;
                    int.TryParse(cmbEmployee.SelectedValue.ToString(), out empID);

                    if (empID > 0)
                    {
                        conditions.Add(string.Format(
                            "(FromEmployeeID = {0} OR ToEmployeeID = {0})",
                            empID));
                    }
                }

                // ── تجميع الشروط ──
                string filter = "";
                if (conditions.Count > 0)
                    filter = string.Join(" AND ", conditions);

                _allMovements.DefaultView.RowFilter = filter;

                // تحديث العداد والإحصائيات
                UpdateStatistics(_allMovements);

                int filteredCount = _allMovements.DefaultView.Count;
                txtStatusMessage.Text = string.Format(
                    "عرض {0} من أصل {1} حركة",
                    filteredCount, _allMovements.Rows.Count);
            }
            catch (Exception ex)
            {
                _allMovements.DefaultView.RowFilter = "";
                txtStatusMessage.Text = "خطأ في الفلترة: " + ex.Message;
            }
        }

        // ═══════════════════════════════════════════
        //  أحداث الفلترة
        // ═══════════════════════════════════════════
        private void txtSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (!_isLoading)
                ApplyFilters();
        }

        private void Filter_Changed(object sender, EventArgs e)
        {
            if (!_isLoading)
                ApplyFilters();
        }

        private void btnFilter_Click(object sender, RoutedEventArgs e)
        {
            ApplyFilters();
        }

        private void btnReset_Click(object sender, RoutedEventArgs e)
        {
            _isLoading = true;

            txtSearch.Text = "";
            cmbMovementType.SelectedIndex = 0;
            dpFromDate.SelectedDate = null;
            dpToDate.SelectedDate = null;
            cmbMainLocation.SelectedIndex = 0;
            cmbSubLocation.ItemsSource = null;
            cmbSubLocation.IsEnabled = false;
            cmbEmployee.SelectedIndex = 0;

            _isLoading = false;

            if (_allMovements != null)
            {
                _allMovements.DefaultView.RowFilter = "";
                UpdateStatistics(_allMovements);
            }

            txtStatusMessage.Text = "تم إعادة تعيين جميع الفلاتر";
        }

        // ═══════════════════════════════════════════
        //  عرض تفاصيل حركة
        // ═══════════════════════════════════════════
        private void dgMovements_MouseDoubleClick(object sender,
            System.Windows.Input.MouseButtonEventArgs e)
        {
            ShowMovementDetails();
        }

        private void btnViewDetail_Click(object sender, RoutedEventArgs e)
        {
            ShowMovementDetails();
        }

        private void ShowMovementDetails()
        {
            if (dgMovements.SelectedItem == null)
            {
                MessageBox.Show("الرجاء اختيار حركة لعرض تفاصيلها",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            DataRowView row = dgMovements.SelectedItem as DataRowView;
            if (row == null) return;

            string details = string.Format(
                "═══════════ تفاصيل الحركة ═══════════\n\n" +
                "📋 رقم الحركة: {0}\n" +
                "📅 التاريخ: {1}\n" +
                "📦 نوع الحركة: {2}\n\n" +
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                "🏷️ الأصل: {3}\n" +
                "🔢 الكود: {4}\n" +
                "📊 الكمية: {5}\n\n" +
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                "📍 من موقع: {6}\n" +
                "📍 إلى موقع: {7}\n\n" +
                "👤 من موظف: {8}\n" +
                "👤 إلى موظف: {9}\n\n" +
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                "🔄 الحالة القديمة: {10}\n" +
                "🔄 الحالة الجديدة: {11}\n\n" +
                "📝 السبب: {12}\n" +
                "📎 رقم المرجع: {13}\n" +
                "✅ اعتمد بواسطة: {14}\n\n" +
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
                "👤 سجّل بواسطة: {15}\n" +
                "📅 تاريخ التسجيل: {16}\n\n" +
                "💬 ملاحظات:\n{17}",

                GetValue(row, "MovementID"),
                row["MovementDate"] != DBNull.Value
                    ? Convert.ToDateTime(row["MovementDate"]).ToString("yyyy/MM/dd HH:mm") : "-",
                GetValue(row, "MovementType"),
                GetValue(row, "AssetName"),
                GetValue(row, "FullAssetCode"),
                GetValue(row, "Quantity"),
                GetValue(row, "FromLocation"),
                GetValue(row, "ToLocation"),
                GetValueOrDash(row, "FromEmployee"),
                GetValueOrDash(row, "ToEmployee"),
                GetValueOrDash(row, "OldStatus"),
                GetValueOrDash(row, "NewStatus"),
                GetValueOrDash(row, "Reason"),
                GetValueOrDash(row, "ReferenceNo"),
                GetValueOrDash(row, "ApprovedBy"),
                GetValueOrDash(row, "CreatedBy"),
                row["CreatedDate"] != DBNull.Value
                    ? Convert.ToDateTime(row["CreatedDate"]).ToString("yyyy/MM/dd HH:mm") : "-",
                GetValueOrDefault(row, "Notes", "لا توجد ملاحظات")
            );

            MessageBox.Show(details,
                "تفاصيل الحركة رقم " + GetValue(row, "MovementID"),
                MessageBoxButton.OK, MessageBoxImage.Information);
        }

        // ═══════════════════════════════════════════
        //  دوال مساعدة لقراءة القيم بأمان
        // ═══════════════════════════════════════════
        private string GetValue(DataRowView row, string column)
        {
            if (row[column] != null && row[column] != DBNull.Value)
                return row[column].ToString();
            return "";
        }

        private string GetValueOrDash(DataRowView row, string column)
        {
            string val = GetValue(row, column);
            return string.IsNullOrEmpty(val) ? "-" : val;
        }

        private string GetValueOrDefault(DataRowView row, string column, string defaultVal)
        {
            string val = GetValue(row, column);
            return string.IsNullOrEmpty(val) ? defaultVal : val;
        }

        // ═══════════════════════════════════════════
        //  تصدير إلى Excel (CSV)
        // ═══════════════════════════════════════════
        private void btnExportExcel_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (_allMovements == null || _allMovements.DefaultView.Count == 0)
                {
                    MessageBox.Show("لا توجد بيانات للتصدير",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                Microsoft.Win32.SaveFileDialog dialog = new Microsoft.Win32.SaveFileDialog();
                dialog.FileName = "سجل_حركة_الأصول_" + DateTime.Now.ToString("yyyyMMdd");
                dialog.DefaultExt = ".csv";
                dialog.Filter = "CSV Files (*.csv)|*.csv|All Files (*.*)|*.*";

                if (dialog.ShowDialog() == true)
                {
                    System.Text.StringBuilder sb = new System.Text.StringBuilder();

                    // العناوين
                    sb.AppendLine(
                        "رقم الحركة,التاريخ,نوع الحركة,اسم الأصل,الكود," +
                        "الكمية,من موقع,إلى موقع,من موظف,إلى موظف,السبب,بواسطة");

                    // البيانات
                    foreach (DataRowView row in _allMovements.DefaultView)
                    {
                        sb.AppendLine(string.Format(
                            "{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11}",
                            GetValue(row, "MovementID"),
                            row["MovementDate"] != DBNull.Value
                                ? Convert.ToDateTime(row["MovementDate"]).ToString("yyyy/MM/dd") : "",
                            GetValue(row, "MovementType"),
                            CleanCsvField(GetValue(row, "AssetName")),
                            GetValue(row, "FullAssetCode"),
                            GetValue(row, "Quantity"),
                            CleanCsvField(GetValue(row, "FromLocation")),
                            CleanCsvField(GetValue(row, "ToLocation")),
                            CleanCsvField(GetValue(row, "FromEmployee")),
                            CleanCsvField(GetValue(row, "ToEmployee")),
                            CleanCsvField(GetValue(row, "Reason")),
                            GetValue(row, "CreatedBy")
                        ));
                    }

                    System.IO.File.WriteAllText(dialog.FileName, sb.ToString(),
                        new System.Text.UTF8Encoding(true));

                    MessageBox.Show(
                        string.Format("تم تصدير {0} سجل بنجاح!\n\nالملف: {1}",
                            _allMovements.DefaultView.Count, dialog.FileName),
                        "نجح التصدير", MessageBoxButton.OK, MessageBoxImage.Information);

                    System.Diagnostics.Process.Start(dialog.FileName);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في التصدير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private string CleanCsvField(string field)
        {
            if (string.IsNullOrEmpty(field)) return "";
            if (field.Contains(",") || field.Contains("\n") || field.Contains("\""))
            {
                field = field.Replace("\"", "\"\"");
                return "\"" + field + "\"";
            }
            return field;
        }

        // ═══════════════════════════════════════════
        //  طباعة
        // ═══════════════════════════════════════════
        private void btnPrint_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                PrintDialog printDialog = new PrintDialog();
                if (printDialog.ShowDialog() == true)
                {
                    printDialog.PrintVisual(dgMovements, "سجل حركة الأصول");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الطباعة:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }
}