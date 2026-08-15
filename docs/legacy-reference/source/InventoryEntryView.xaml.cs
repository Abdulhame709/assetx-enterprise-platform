using System;
using System.Data;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;
using AssetManagement.Services;

namespace AssetManagement.Views
{
    public partial class InventoryEntryView : Window
    {
        private int _cycleId;
        private string _cycleName;
        private int _selectedRecordId = -1;
        private int _expectedQuantity = 0;
        private int? _expectedMainLocId = null;
        private int? _expectedSubLocId = null;
        private bool _isLoading = false;
        private DataTable _currentData;

        public InventoryEntryView(int cycleId, string cycleName)
        {
            InitializeComponent();
            _cycleId = cycleId;
            _cycleName = cycleName;
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            txtCycleName.Text = _cycleName;
            _isLoading = true;
            LoadDropdowns();
            _isLoading = false;
            LoadRecords();
            LoadProgress();
            ClearEntryForm();
        }

        // ═══════════════════════════════════════════════════
        // تحميل القوائم
        // ═══════════════════════════════════════════════════
        private void LoadDropdowns()
        {
            try
            {
                // المواقع الرئيسية (فلتر)
                DataTable locations = InventoryRecordService.GetMainLocations();
                DataTable filterLoc = locations.Copy();
                DataRow allLoc = filterLoc.NewRow();
                allLoc["MainLocationID"] = 0;
                allLoc["MainLocationName"] = "الكل";
                filterLoc.Rows.InsertAt(allLoc, 0);
                cmbFilterLocation.ItemsSource = filterLoc.DefaultView;
                cmbFilterLocation.DisplayMemberPath = "MainLocationName";
                cmbFilterLocation.SelectedValuePath = "MainLocationID";
                cmbFilterLocation.SelectedIndex = 0;

                // المواقع الفرعية (فلتر - فارغ مبدئياً)
                SetEmptySubLocationFilter();

                // الموظفين (فلتر)
                DataTable employees = InventoryRecordService.GetEmployees();
                DataTable filterEmp = employees.Copy();
                DataRow allEmp = filterEmp.NewRow();
                allEmp["EmployeeID"] = 0;
                allEmp["EmployeeName"] = "الكل";
                filterEmp.Rows.InsertAt(allEmp, 0);
                cmbFilterEmployee.ItemsSource = filterEmp.DefaultView;
                cmbFilterEmployee.DisplayMemberPath = "EmployeeName";
                cmbFilterEmployee.SelectedValuePath = "EmployeeID";
                cmbFilterEmployee.SelectedIndex = 0;

                // النوع الفرعي (فلتر)
                DataTable subTypes = InventoryRecordService.GetSubTypes();
                DataTable filterST = subTypes.Copy();
                DataRow allST = filterST.NewRow();
                allST["SubTypeID"] = 0;
                allST["SubTypeName"] = "الكل";
                filterST.Rows.InsertAt(allST, 0);
                cmbFilterSubType.ItemsSource = filterST.DefaultView;
                cmbFilterSubType.DisplayMemberPath = "SubTypeName";
                cmbFilterSubType.SelectedValuePath = "SubTypeID";
                cmbFilterSubType.SelectedIndex = 0;

                // النتيجة (فلتر)
                cmbFilterResult.Items.Clear();
                string[] results = { "الكل", "لم يُجرد", "مطابق", "عجز", "زيادة", "منقول", "مفقود" };
                foreach (string r in results) cmbFilterResult.Items.Add(r);
                cmbFilterResult.SelectedIndex = 0;

                // الموقع الفعلي (إدخال)
                cmbActualMainLoc.ItemsSource = locations.DefaultView;
                cmbActualMainLoc.DisplayMemberPath = "MainLocationName";
                cmbActualMainLoc.SelectedValuePath = "MainLocationID";

                // الحالة (إدخال)
                DataTable statuses = InventoryRecordService.GetStatuses();
                cmbActualStatus.ItemsSource = statuses.DefaultView;
                cmbActualStatus.DisplayMemberPath = "StatusName";
                cmbActualStatus.SelectedValuePath = "StatusID";

                // الموظف الفعلي (إدخال)
                cmbActualEmployee.ItemsSource = employees.DefaultView;
                cmbActualEmployee.DisplayMemberPath = "EmployeeName";
                cmbActualEmployee.SelectedValuePath = "EmployeeID";
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void SetEmptySubLocationFilter()
        {
            DataTable empty = new DataTable();
            empty.Columns.Add("SubLocationID", typeof(int));
            empty.Columns.Add("DisplayName", typeof(string));
            DataRow r = empty.NewRow();
            r["SubLocationID"] = 0;
            r["DisplayName"] = "الكل";
            empty.Rows.Add(r);
            cmbFilterSubLocation.ItemsSource = empty.DefaultView;
            cmbFilterSubLocation.DisplayMemberPath = "DisplayName";
            cmbFilterSubLocation.SelectedValuePath = "SubLocationID";
            cmbFilterSubLocation.SelectedIndex = 0;
        }

        // ═══════════════════════════════════════════════════
        // تحميل السجلات (مع فلتر هرمي)
        // ═══════════════════════════════════════════════════
        private void LoadRecords()
        {
            try
            {
                string filterResult = cmbFilterResult.SelectedItem != null ?
                    cmbFilterResult.SelectedItem.ToString() : "الكل";

                int? filterLocId = GetFilterId(cmbFilterLocation);
                int? filterSubLocId = GetFilterId(cmbFilterSubLocation);
                int? filterEmpId = GetFilterId(cmbFilterEmployee);
                int? filterSubTypeId = GetFilterId(cmbFilterSubType);

                // استخدام الدالة الهرمية الجديدة
                _currentData = InventoryRecordService.GetFullInventoryRecordsHierarchical(
                    _cycleId, filterResult, filterLocId, filterSubLocId,
                    filterEmpId, "", txtSearch.Text.Trim(), filterSubTypeId);

                dgRecords.ItemsSource = _currentData.DefaultView;
                txtRecordCount.Text = "عدد: " + _currentData.Rows.Count;
                txtStatusBar.Text = "تم تحميل " + _currentData.Rows.Count + " سجل";
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private int? GetFilterId(ComboBox cmb)
        {
            if (cmb.SelectedValue == null) return null;
            int id;
            if (int.TryParse(cmb.SelectedValue.ToString(), out id) && id > 0)
                return id;
            return null;
        }

        private void LoadProgress()
        {
            try
            {
                DataTable dt = InventoryRecordService.GetCycleProgress(_cycleId);
                if (dt != null && dt.Rows.Count > 0)
                {
                    DataRow r = dt.Rows[0];
                    int total = Convert.ToInt32(r["TotalAssets"]);
                    int done = Convert.ToInt32(r["Inventoried"]);
                    lblSTotal.Text = total.ToString();
                    lblSMatched.Text = r["Matched"].ToString();
                    lblSDeficit.Text = r["Deficit"].ToString();
                    lblSSurplus.Text = r["Surplus"].ToString();
                    lblSTransferred.Text = r["Transferred"].ToString();
                    lblSMissing.Text = r["Missing"].ToString();
                    lblSNotDone.Text = r["NotInventoried"].ToString();
                    double pct = total > 0 ? (double)done / total * 100 : 0;
                    txtProgress.Text = string.Format("الإنجاز: {0} من {1} ({2:F1}%)",
                        done, total, pct);
                }
            }
            catch { }
        }

        // ═══════════════════════════════════════════════════
        // تحديد سجل
        // ═══════════════════════════════════════════════════
        private void dgRecords_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgRecords.SelectedItem == null)
            {
                _selectedRecordId = -1;
                ClearEntryForm();
                return;
            }

            DataRowView row = dgRecords.SelectedItem as DataRowView;
            if (row == null) return;

            _selectedRecordId = Convert.ToInt32(row["RecordID"]);

            string emp = row["EmployeeName"].ToString();
            txtSelectedAsset.Text = string.Format("[{0}] {1}{2}",
                row["BaseAssetCode"], row["AssetName"],
                string.IsNullOrEmpty(emp) ? "" : " - عهدة: " + emp);

            _expectedQuantity = Convert.ToInt32(row["ExpectedQuantity"]);
            _expectedMainLocId = row["ExpectedMainLocID"] != DBNull.Value ?
                (int?)Convert.ToInt32(row["ExpectedMainLocID"]) : null;
            _expectedSubLocId = row["ExpectedSubLocID"] != DBNull.Value ?
                (int?)Convert.ToInt32(row["ExpectedSubLocID"]) : null;

            txtExpectedInfo.Text = string.Format(
                "الموقع: {0}/{1} | الكمية: {2} | الحالة: {3} | العهدة: {4}",
                row["ExpectedMainLocName"], row["ExpectedSubLocName"],
                row["ExpectedQuantity"], row["ExpectedStatusName"],
                string.IsNullOrEmpty(emp) ? "-" : emp);

            string result = row["InventoryResult"].ToString();

            if (result == "لم يُجرد")
            {
                SetComboValue(cmbActualMainLoc, row, "ExpectedMainLocID");
                txtActualQty.Text = row["ExpectedQuantity"].ToString();
                SetComboValue(cmbActualStatus, row, "ExpectedStatusID");
                SetComboValue(cmbActualEmployee, row, "ExpectedEmployeeID");

                if (row["ExpectedMainLocID"] != DBNull.Value)
                {
                    LoadActualSubLocations(Convert.ToInt32(row["ExpectedMainLocID"]));
                    SetComboValue(cmbActualSubLoc, row, "ExpectedSubLocID");
                }
                txtEntryNotes.Text = "";
            }
            else
            {
                SetComboValue(cmbActualMainLoc, row, "ActualMainLocID");
                if (row["ActualMainLocID"] != DBNull.Value)
                {
                    LoadActualSubLocations(Convert.ToInt32(row["ActualMainLocID"]));
                    SetComboValue(cmbActualSubLoc, row, "ActualSubLocID");
                }
                txtActualQty.Text = row["ActualQuantity"] != DBNull.Value ?
                    row["ActualQuantity"].ToString() : "";
                SetComboValue(cmbActualStatus, row, "ActualStatusID");
                SetComboValue(cmbActualEmployee, row, "ActualEmployeeID");
                txtEntryNotes.Text = row["Notes"] != DBNull.Value ?
                    row["Notes"].ToString() : "";
            }
        }

        private void SetComboValue(ComboBox cmb, DataRowView row, string field)
        {
            if (row[field] != DBNull.Value)
                cmb.SelectedValue = Convert.ToInt32(row[field]);
            else
                cmb.SelectedIndex = -1;
        }

        // ═══════════════════════════════════════════════════
        // المواقع الفرعية - لوحة الإدخال (هرمي)
        // ═══════════════════════════════════════════════════
        private void cmbActualMainLoc_SelectionChanged(object sender,
            SelectionChangedEventArgs e)
        {
            if (cmbActualMainLoc.SelectedValue != null)
                LoadActualSubLocations(Convert.ToInt32(cmbActualMainLoc.SelectedValue));
            else
                cmbActualSubLoc.ItemsSource = null;
        }

        private void LoadActualSubLocations(int mainLocationId)
        {
            try
            {
                // عرض هرمي في قائمة الإدخال أيضاً
                DataTable subs = InventoryRecordService.GetSubLocationsHierarchical(mainLocationId);
                cmbActualSubLoc.ItemsSource = subs.DefaultView;
                cmbActualSubLoc.DisplayMemberPath = "DisplayName";
                cmbActualSubLoc.SelectedValuePath = "SubLocationID";
            }
            catch { }
        }

        // ═══════════════════════════════════════════════════
        // المواقع الفرعية - الفلتر (هرمي مع شامل للأبناء)
        // ═══════════════════════════════════════════════════
        private void cmbFilterLocation_SelectionChanged(object sender,
            SelectionChangedEventArgs e)
        {
            if (_isLoading || !IsLoaded) return;
            _isLoading = true;

            try
            {
                int? locId = GetFilterId(cmbFilterLocation);
                if (locId.HasValue)
                {
                    // جلب المواقع الفرعية بشكل هرمي
                    DataTable subs = InventoryRecordService
                        .GetSubLocationsHierarchical(locId.Value);

                    // إضافة "الكل" في الأعلى
                    DataRow allRow = subs.NewRow();
                    allRow["SubLocationID"] = 0;
                    allRow["DisplayName"] = "الكل";
                    allRow["SubLocationName"] = "الكل";
                    allRow["FullPath"] = "الكل";
                    allRow["TreeLevel"] = 0;
                    subs.Rows.InsertAt(allRow, 0);

                    cmbFilterSubLocation.ItemsSource = subs.DefaultView;
                    cmbFilterSubLocation.DisplayMemberPath = "DisplayName";
                    cmbFilterSubLocation.SelectedValuePath = "SubLocationID";
                    cmbFilterSubLocation.SelectedIndex = 0;
                }
                else
                {
                    SetEmptySubLocationFilter();
                }
            }
            catch { }

            _isLoading = false;
            LoadRecords();
        }

        // ═══════════════════════════════════════════════════
        // حفظ الجرد (مع الموظف الفعلي)
        // ═══════════════════════════════════════════════════
        private void btnSaveRecord_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedRecordId <= 0)
            {
                MessageBox.Show("اختر أصلاً أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            int actualQty;
            if (!int.TryParse(txtActualQty.Text.Trim(), out actualQty) || actualQty < 0)
            {
                MessageBox.Show("كمية غير صحيحة!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                txtActualQty.Focus();
                return;
            }

            int? mainLocId = cmbActualMainLoc.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbActualMainLoc.SelectedValue) : null;
            int? subLocId = cmbActualSubLoc.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbActualSubLoc.SelectedValue) : null;
            int? statusId = cmbActualStatus.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbActualStatus.SelectedValue) : null;
            int? empId = cmbActualEmployee.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbActualEmployee.SelectedValue) : null;

            string inventoryResult, errorMessage;
            bool success = InventoryRecordService.UpdateInventoryRecord(
                _selectedRecordId, mainLocId, subLocId, actualQty, statusId, empId,
                _expectedQuantity, _expectedMainLocId, _expectedSubLocId,
                "admin", txtEntryNotes.Text.Trim(),
                out inventoryResult, out errorMessage);

            if (success)
            {
                txtStatusBar.Text = "تم حفظ | النتيجة: " + inventoryResult;
                int saved = _selectedRecordId;
                LoadRecords();
                LoadProgress();
                SelectNextRecord(saved);
            }
            else
            {
                MessageBox.Show("خطأ:\n" + errorMessage, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // مطابقة سريعة
        // ═══════════════════════════════════════════════════
        private void btnQuickMatch_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedRecordId <= 0)
            {
                MessageBox.Show("اختر أصلاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string err;
            if (InventoryRecordService.QuickMatchRecord(_selectedRecordId, "admin", out err))
            {
                int s = _selectedRecordId;
                LoadRecords();
                LoadProgress();
                SelectNextRecord(s);
            }
            else
                MessageBox.Show("خطأ: " + err, "خطأ",
               MessageBoxButton.OK, MessageBoxImage.Error);
        }

        private void btnQuickMatchLocation_Click(object sender, RoutedEventArgs e)
        {
            int? locId = GetFilterId(cmbFilterLocation);
            if (!locId.HasValue)
            {
                MessageBox.Show("اختر موقعاً محدداً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            DataRowView sel = cmbFilterLocation.SelectedItem as DataRowView;
            string locName = sel != null ? sel["MainLocationName"].ToString() : "";

            if (MessageBox.Show("مطابقة كل أصول " + locName +
                " التي لم تُجرد؟", "تأكيد",
                MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
                return;

            string err;
            int count = InventoryRecordService.QuickMatchByLocation(
                _cycleId, locId.Value, "admin", out err);
            if (count >= 0)
            {
                MessageBox.Show("تم مطابقة " + count + " أصل.", "تم",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                LoadRecords();
                LoadProgress();
            }
            else
                MessageBox.Show("خطأ: " + err, "خطأ",
               MessageBoxButton.OK, MessageBoxImage.Error);
        }

        // ═══════════════════════════════════════════════════
        // إلغاء وتنظيف
        // ═══════════════════════════════════════════════════
        private void btnResetRecord_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedRecordId <= 0) return;
            if (MessageBox.Show("إلغاء جرد هذا الأصل؟", "تأكيد",
                MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
                return;

            string err;
            if (InventoryRecordService.ResetRecord(_selectedRecordId, out err))
            {
                ClearEntryForm();
                LoadRecords();
                LoadProgress();
            }
            else
                MessageBox.Show("خطأ: " + err, "خطأ",
               MessageBoxButton.OK, MessageBoxImage.Error);
        }

        private void btnClearEntry_Click(object sender, RoutedEventArgs e)
        {
            ClearEntryForm();
            dgRecords.SelectedItem = null;
        }

        private void ClearEntryForm()
        {
            _selectedRecordId = -1;
            txtSelectedAsset.Text = "اختر أصلاً من الجدول";
            txtExpectedInfo.Text = "";
            cmbActualMainLoc.SelectedIndex = -1;
            cmbActualSubLoc.ItemsSource = null;
            txtActualQty.Text = "";
            cmbActualStatus.SelectedIndex = -1;
            cmbActualEmployee.SelectedIndex = -1;
            txtEntryNotes.Text = "";
        }

        // ═══════════════════════════════════════════════════
        // التصدير والطباعة
        // ═══════════════════════════════════════════════════
        private void btnExportExcel_Click(object sender, RoutedEventArgs e)
        {
            if (_currentData == null || _currentData.Rows.Count == 0)
            {
                MessageBox.Show("لا توجد بيانات!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            ReportHelper.ExportToExcel(_currentData, "تقرير الجرد - " + _cycleName,
                new[] { "الكود", "الأصل", "النوع", "العهدة", "الموقع م", "الفرعي م",
                    "كمية م", "الموقع ف", "الفرعي ف", "كمية ف", "العهدة ف", "النتيجة" },
                new[] { "BaseAssetCode", "AssetName", "SubTypeName", "EmployeeName",
                    "ExpectedMainLocName", "ExpectedSubLocName", "ExpectedQuantity",
                    "ActualMainLocName", "ActualSubLocName", "ActualQuantity",
                    "ActualEmployeeName", "InventoryResult" });
        }

        private void btnPrint_Click(object sender, RoutedEventArgs e)
        {
            if (_currentData == null || _currentData.Rows.Count == 0)
            {
                MessageBox.Show("لا توجد بيانات!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            ReportHelper.PrintReport(_currentData, "تقرير الجرد - " + _cycleName,
                new[] { "الكود", "الأصل", "النوع", "العهدة", "الموقع م", "الفرعي م",
                    "كمية م", "الموقع ف", "كمية ف", "العهدة ف", "النتيجة" },
                new[] { "BaseAssetCode", "AssetName", "SubTypeName", "EmployeeName",
                    "ExpectedMainLocName", "ExpectedSubLocName", "ExpectedQuantity",
                    "ActualMainLocName", "ActualQuantity",
                    "ActualEmployeeName", "InventoryResult" });
        }

        private void btnPrintBlankForm_Click(object sender, RoutedEventArgs e)
        {
            int? locId = GetFilterId(cmbFilterLocation);
            DataTable data = InventoryRecordService.GetBlankFormData(_cycleId, locId);
            if (data.Rows.Count == 0)
            {
                MessageBox.Show("لا توجد بيانات!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }
            ReportHelper.PrintBlankInventoryForm(data, _cycleName);
        }

        // ═══════════════════════════════════════════════════
        // التنقل والفلاتر
        // ═══════════════════════════════════════════════════
        private void SelectNextRecord(int currentId)
        {
            bool found = false;
            foreach (var item in dgRecords.Items)
            {
                DataRowView r = item as DataRowView;
                if (r == null) continue;
                if (found)
                {
                    dgRecords.SelectedItem = item;
                    dgRecords.ScrollIntoView(item);
                    return;
                }
                if (Convert.ToInt32(r["RecordID"]) == currentId) found = true;
            }
            if (dgRecords.Items.Count > 0)
            {
                dgRecords.SelectedItem = dgRecords.Items[0];
                dgRecords.ScrollIntoView(dgRecords.Items[0]);
            }
        }

        private void txtSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (IsLoaded && !_isLoading) LoadRecords();
        }

        private void cmbFilterResult_SelectionChanged(object sender,
            SelectionChangedEventArgs e)
        {
            if (IsLoaded && !_isLoading) LoadRecords();
        }

        private void cmbFilterSubLocation_SelectionChanged(object sender,
            SelectionChangedEventArgs e)
        {
            if (IsLoaded && !_isLoading) LoadRecords();
        }

        private void cmbFilterEmployee_SelectionChanged(object sender,
            SelectionChangedEventArgs e)
        {
            if (IsLoaded && !_isLoading) LoadRecords();
        }

        private void cmbFilterSubType_SelectionChanged(object sender,
            SelectionChangedEventArgs e)
        {
            if (IsLoaded && !_isLoading) LoadRecords();
        }

        private void btnRefresh_Click(object sender, RoutedEventArgs e)
        {
            LoadRecords();
            LoadProgress();
        }

        private void btnCloseWindow_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}