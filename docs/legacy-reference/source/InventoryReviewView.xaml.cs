using System;
using System.Data;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using AssetManagement.Helpers;
using AssetManagement.Services;

namespace AssetManagement.Views
{
    public partial class InventoryReviewView : Window
    {
        private int _selectedCycleId = -1;
        private int _selectedRecordId = -1;
        private DataTable _currentData;

        public InventoryReviewView()
        {
            InitializeComponent();
        }

        // ═══════════════════════════════════════════════════
        // تحميل النافذة
        // ═══════════════════════════════════════════════════
        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadCyclesList();
            LoadFilterDropdowns();
            ClearReviewPanel();
        }

        // ═══ تحميل الدورات ═══
        private void LoadCyclesList()
        {
            try
            {
                string query = @"SELECT CycleID, 
                                CycleName + ' (' + CycleStatus + ')' AS DisplayName,
                                CycleStatus
                         FROM tblInventoryCycles ORDER BY CycleYear DESC";
                DataTable dt = DatabaseHelper.GetData(query);
                cmbCycles.ItemsSource = dt.DefaultView;
                cmbCycles.DisplayMemberPath = "DisplayName";
                cmbCycles.SelectedValuePath = "CycleID";
                if (dt.Rows.Count > 0) cmbCycles.SelectedIndex = 0;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══ تحميل الفلاتر ═══
        private void LoadFilterDropdowns()
        {
            try
            {
                // النتيجة
                cmbFilterResult.Items.Clear();
                cmbFilterResult.Items.Add("الكل");
                cmbFilterResult.Items.Add("لم يُجرد");
                cmbFilterResult.Items.Add("مطابق");
                cmbFilterResult.Items.Add("عجز");
                cmbFilterResult.Items.Add("زيادة");
                cmbFilterResult.Items.Add("منقول");
                cmbFilterResult.Items.Add("مفقود");
                cmbFilterResult.SelectedIndex = 0;

                // التحقق
                cmbFilterVerified.Items.Clear();
                cmbFilterVerified.Items.Add("الكل");
                cmbFilterVerified.Items.Add("تم التحقق");
                cmbFilterVerified.Items.Add("لم يُتحقق");
                cmbFilterVerified.SelectedIndex = 0;

                // الموقع الرئيسي
                DataTable locations = InventoryRecordService.GetMainLocations();
                DataTable filterLoc = locations.Copy();
                DataRow allRow = filterLoc.NewRow();
                allRow["MainLocationID"] = 0;
                allRow["MainLocationName"] = "الكل";
                filterLoc.Rows.InsertAt(allRow, 0);
                cmbFilterLocation.ItemsSource = filterLoc.DefaultView;
                cmbFilterLocation.DisplayMemberPath = "MainLocationName";
                cmbFilterLocation.SelectedValuePath = "MainLocationID";
                cmbFilterLocation.SelectedIndex = 0;

                // الموقع الفرعي - مبدئياً فارغ
                DataTable emptySubsInit = new DataTable();
                emptySubsInit.Columns.Add("SubLocationID", typeof(int));
                emptySubsInit.Columns.Add("DisplayName", typeof(string));
                DataRow allSubInit = emptySubsInit.NewRow();
                allSubInit["SubLocationID"] = 0;
                allSubInit["DisplayName"] = "الكل";
                emptySubsInit.Rows.Add(allSubInit);
                cmbFilterSubLocation.ItemsSource = emptySubsInit.DefaultView;
                cmbFilterSubLocation.DisplayMemberPath = "DisplayName";
                cmbFilterSubLocation.SelectedValuePath = "SubLocationID";
                cmbFilterSubLocation.SelectedIndex = 0;
                // الموظف
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
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══ تغيير الدورة ═══
        private void cmbCycles_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (cmbCycles.SelectedValue == null) return;
            _selectedCycleId = Convert.ToInt32(cmbCycles.SelectedValue);

            DataRowView selectedRow = cmbCycles.SelectedItem as DataRowView;
            if (selectedRow != null)
            {
                string status = selectedRow["CycleStatus"].ToString();
                txtCycleStatus.Text = "الحالة: " + status;
            }

            LoadRecords();
            LoadStats();
            ClearReviewPanel();
        }

        // ═══════════════════════════════════════════════════
        // تحميل السجلات
        // ═══════════════════════════════════════════════════
        private void LoadRecords()
        {
            if (_selectedCycleId <= 0) return;
            try
            {
                string filterResult = cmbFilterResult.SelectedItem != null ?
                    cmbFilterResult.SelectedItem.ToString() : "الكل";

                int? filterLocId = null;
                if (cmbFilterLocation.SelectedValue != null)
                {
                    int locId = Convert.ToInt32(cmbFilterLocation.SelectedValue);
                    if (locId > 0) filterLocId = locId;
                }

                int? filterSubLocId = null;
                if (cmbFilterSubLocation.SelectedValue != null)
                {
                    int subId;
                    if (int.TryParse(cmbFilterSubLocation.SelectedValue.ToString(), out subId) && subId > 0)
                        filterSubLocId = subId;
                }

                int? filterEmpId = null;
                if (cmbFilterEmployee.SelectedValue != null)
                {
                    int empId = Convert.ToInt32(cmbFilterEmployee.SelectedValue);
                    if (empId > 0) filterEmpId = empId;
                }

                string filterVerified = cmbFilterVerified.SelectedItem != null ?
                    cmbFilterVerified.SelectedItem.ToString() : "الكل";

                string searchText = txtSearch.Text.Trim();

                _currentData = InventoryRecordService.GetFullInventoryRecordsHierarchical(
    _selectedCycleId, filterResult, filterLocId, filterSubLocId,
    filterEmpId, filterVerified, searchText);

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

        // ═══ تحميل الإحصائيات ═══
        private void LoadStats()
        {
            if (_selectedCycleId <= 0) return;
            try
            {
                DataTable dt = InventoryRecordService.GetCycleProgress(_selectedCycleId);
                if (dt != null && dt.Rows.Count > 0)
                {
                    DataRow r = dt.Rows[0];
                    lblTotal.Text = r["TotalAssets"].ToString();
                    lblInventoried.Text = r["Inventoried"].ToString();
                    lblMatched.Text = r["Matched"].ToString();
                    lblDeficit.Text = r["Deficit"].ToString();
                    lblSurplus.Text = r["Surplus"].ToString();
                    lblTransferred.Text = r["Transferred"].ToString();
                    lblMissing.Text = r["Missing"].ToString();
                    lblNotDone.Text = r["NotInventoried"].ToString();
                }

                string vQuery = "SELECT COUNT(*) FROM tblInventoryRecords WHERE CycleID = @CycleID AND IsVerified = 1";
                object vCount = DatabaseHelper.ExecuteScalar(vQuery,
                    new[] { new System.Data.SqlClient.SqlParameter("@CycleID", _selectedCycleId) });
                lblVerified.Text = vCount != null ? vCount.ToString() : "0";
            }
            catch { }
        }

        // ═══════════════════════════════════════════════════
        // تحديد سجل في الجدول
        // ═══════════════════════════════════════════════════
        private void dgRecords_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgRecords.SelectedItem == null)
            {
                _selectedRecordId = -1;
                ClearReviewPanel();
                return;
            }

            DataRowView row = dgRecords.SelectedItem as DataRowView;
            if (row == null) return;

            _selectedRecordId = Convert.ToInt32(row["RecordID"]);

            txtSelectedAsset.Text = string.Format("[{0}] {1}",
                row["BaseAssetCode"], row["AssetName"]);

            string emp = row["EmployeeName"].ToString();
            txtComparison.Text = string.Format(
                "المتوقع: الموقع={0}/{1} | الكمية={2} | الحالة={3} | العهدة={4}\n" +
                "الفعلي:  الموقع={5}/{6} | الكمية={7} | الحالة={8}\n" +
                "النتيجة: {9}",
                row["ExpectedMainLocName"], row["ExpectedSubLocName"],
                row["ExpectedQuantity"], row["ExpectedStatusName"],
                string.IsNullOrEmpty(emp) ? "-" : emp,
                row["ActualMainLocName"], row["ActualSubLocName"],
                row["ActualQuantity"] != DBNull.Value ? row["ActualQuantity"].ToString() : "-",
                row["ActualStatusName"],
                row["InventoryResult"]);

            txtReviewNotes.Text = row["Notes"].ToString();
        }

        private void ClearReviewPanel()
        {
            _selectedRecordId = -1;
            txtSelectedAsset.Text = "اختر سجلاً من الجدول";
            txtComparison.Text = "";
            txtReviewNotes.Text = "";
        }

        // ═══════════════════════════════════════════════════
        // أزرار التحقق والمراجعة
        // ═══════════════════════════════════════════════════
        private void btnVerify_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedRecordId <= 0)
            {
                MessageBox.Show("اختر سجلاً أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            DataRowView row = dgRecords.SelectedItem as DataRowView;
            if (row != null && row["InventoryResult"].ToString() == "لم يُجرد")
            {
                MessageBox.Show("لا يمكن التحقق من سجل لم يتم جرده!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!string.IsNullOrWhiteSpace(txtReviewNotes.Text))
                SaveReviewNotes(_selectedRecordId, txtReviewNotes.Text.Trim());

            string err;
            if (InventoryRecordService.VerifyRecord(_selectedRecordId, "admin", out err))
            {
                txtStatusBar.Text = "تم التحقق بنجاح";
                int savedId = _selectedRecordId;
                LoadRecords();
                LoadStats();
                SelectNextRecord(savedId);
            }
            else
            {
                MessageBox.Show("خطأ: " + err, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnUnverify_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedRecordId <= 0) return;
            try
            {
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tblInventoryRecords SET IsVerified=0, VerifiedBy=NULL, VerifiedDate=NULL WHERE RecordID=@R",
                    new[] { new System.Data.SqlClient.SqlParameter("@R", _selectedRecordId) });
                txtStatusBar.Text = "تم إلغاء التحقق";
                LoadRecords();
                LoadStats();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ: " + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnResetRecord_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedRecordId <= 0) return;

            if (MessageBox.Show("إلغاء جرد هذا السجل؟", "تأكيد",
                MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes)
                return;

            string err;
            if (InventoryRecordService.ResetRecord(_selectedRecordId, out err))
            {
                txtStatusBar.Text = "تم إلغاء الجرد";
                ClearReviewPanel();
                LoadRecords();
                LoadStats();
            }
            else
            {
                MessageBox.Show("خطأ: " + err, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnVerifyAll_Click(object sender, RoutedEventArgs e)
        {
            if (_currentData == null || _currentData.Rows.Count == 0) return;

            int eligible = 0;
            foreach (DataRow row in _currentData.Rows)
            {
                if (row["InventoryResult"].ToString() != "لم يُجرد" &&
                    !(row["IsVerified"] != DBNull.Value && Convert.ToBoolean(row["IsVerified"])))
                    eligible++;
            }

            if (eligible == 0)
            {
                MessageBox.Show("لا توجد سجلات للتحقق.", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            if (MessageBox.Show("تحقق من " + eligible + " سجل؟", "تأكيد",
                MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
                return;

            int count = 0;
            foreach (DataRow row in _currentData.Rows)
            {
                if (row["InventoryResult"].ToString() != "لم يُجرد" &&
                    !(row["IsVerified"] != DBNull.Value && Convert.ToBoolean(row["IsVerified"])))
                {
                    string err;
                    if (InventoryRecordService.VerifyRecord(
                        Convert.ToInt32(row["RecordID"]), "admin", out err))
                        count++;
                }
            }

            MessageBox.Show("تم التحقق من " + count + " سجل.", "تم",
                MessageBoxButton.OK, MessageBoxImage.Information);
            LoadRecords();
            LoadStats();
        }

        private void SaveReviewNotes(int recordId, string notes)
        {
            try
            {
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tblInventoryRecords SET Notes=@N WHERE RecordID=@R",
                    new[] {
                        new System.Data.SqlClient.SqlParameter("@N", (object)notes ?? DBNull.Value),
                        new System.Data.SqlClient.SqlParameter("@R", recordId)
                    });
            }
            catch { }
        }

        // ═══════════════════════════════════════════════════
        // البطاقات القابلة للنقر
        // ═══════════════════════════════════════════════════
        private void StatCard_MouseDown(object sender, MouseButtonEventArgs e)
        {
            Border card = sender as Border;
            if (card == null || card.Tag == null) return;

            string filterValue = card.Tag.ToString();
            for (int i = 0; i < cmbFilterResult.Items.Count; i++)
            {
                if (cmbFilterResult.Items[i].ToString() == filterValue)
                {
                    cmbFilterResult.SelectedIndex = i;
                    break;
                }
            }
        }

        // ═══════════════════════════════════════════════════
        // التصدير والطباعة
        // ═══════════════════════════════════════════════════
        private string[] GetColumnHeaders()
        {
            return new[] { "الكود", "اسم الأصل", "العهدة",
                "الموقع المتوقع", "الفرعي المتوقع",
                "كمية م", "حالة م",
                "الموقع الفعلي", "كمية ف", "حالة ف",
                "النتيجة", "الجارد", "تحقق", "ملاحظات" };
        }

        private string[] GetColumnFields()
        {
            return new[] { "BaseAssetCode", "AssetName", "EmployeeName",
                "ExpectedMainLocName", "ExpectedSubLocName",
                "ExpectedQuantity", "ExpectedStatusName",
                "ActualMainLocName", "ActualQuantity", "ActualStatusName",
                "InventoryResult", "InventoryBy", "IsVerified", "Notes" };
        }

        private void btnExportExcel_Click(object sender, RoutedEventArgs e)
        {
            if (_currentData == null || _currentData.Rows.Count == 0)
            {
                MessageBox.Show("لا توجد بيانات للتصدير!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string info = "إجمالي: " + lblTotal.Text +
                " | مطابق: " + lblMatched.Text +
                " | عجز: " + lblDeficit.Text +
                " | مفقود: " + lblMissing.Text;

            ReportHelper.ExportToExcel(_currentData, "تقرير مراجعة الجرد",
                GetColumnHeaders(), GetColumnFields(), info);
        }

        private void btnPrint_Click(object sender, RoutedEventArgs e)
        {
            if (_currentData == null || _currentData.Rows.Count == 0)
            {
                MessageBox.Show("لا توجد بيانات للطباعة!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string info = cmbCycles.Text + " | عدد: " + _currentData.Rows.Count;
            ReportHelper.PrintReport(_currentData, "تقرير مراجعة الجرد",
                GetColumnHeaders(), GetColumnFields(), info);
        }

        private void btnPrintBlankForm_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedCycleId <= 0)
            {
                MessageBox.Show("اختر دورة أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            int? locId = null;
            if (cmbFilterLocation.SelectedValue != null)
            {
                int lid = Convert.ToInt32(cmbFilterLocation.SelectedValue);
                if (lid > 0) locId = lid;
            }

            DataTable formData = InventoryRecordService.GetBlankFormData(_selectedCycleId, locId);
            if (formData.Rows.Count == 0)
            {
                MessageBox.Show("لا توجد بيانات للطباعة!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string cycleName = cmbCycles.Text;
            ReportHelper.PrintBlankInventoryForm(formData, cycleName);
        }

        // ═══════════════════════════════════════════════════
        // تحميل المواقع الفرعية عند تغيير الرئيسي
        // ═══════════════════════════════════════════════════
        private void cmbFilterLocation_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (!IsLoaded) return;
            try
            {
                if (cmbFilterLocation.SelectedValue != null)
                {
                    int locId = Convert.ToInt32(cmbFilterLocation.SelectedValue);
                    if (locId > 0)
                    {
                        // هرمي
                        DataTable subs = InventoryRecordService
                            .GetSubLocationsHierarchical(locId);

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
                        DataTable empty = new DataTable();
                        empty.Columns.Add("SubLocationID", typeof(int));
                        empty.Columns.Add("DisplayName", typeof(string));
                        DataRow allRow = empty.NewRow();
                        allRow["SubLocationID"] = 0;
                        allRow["DisplayName"] = "الكل";
                        empty.Rows.Add(allRow);
                        cmbFilterSubLocation.ItemsSource = empty.DefaultView;
                        cmbFilterSubLocation.DisplayMemberPath = "DisplayName";
                        cmbFilterSubLocation.SelectedValuePath = "SubLocationID";
                        cmbFilterSubLocation.SelectedIndex = 0;
                    }
                }
            }
            catch { }
            LoadRecords();
        }

        // ═══════════════════════════════════════════════════
        // أحداث الفلاتر
        // ═══════════════════════════════════════════════════
        private void txtSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (IsLoaded) LoadRecords();
        }

        private void cmbFilterResult_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (IsLoaded) LoadRecords();
        }

        private void cmbFilterVerified_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (IsLoaded) LoadRecords();
        }

        private void cmbFilterSubLocation_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (IsLoaded) LoadRecords();
        }

        private void cmbFilterEmployee_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (IsLoaded) LoadRecords();
        }

        private void btnRefresh_Click(object sender, RoutedEventArgs e)
        {
            LoadRecords();
            LoadStats();
        }

        private void btnCloseWindow_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        // ═══ الانتقال للسجل التالي ═══
        private void SelectNextRecord(int currentRecordId)
        {
            bool found = false;
            foreach (var item in dgRecords.Items)
            {
                DataRowView row = item as DataRowView;
                if (row == null) continue;
                if (found)
                {
                    dgRecords.SelectedItem = item;
                    dgRecords.ScrollIntoView(item);
                    return;
                }
                if (Convert.ToInt32(row["RecordID"]) == currentRecordId)
                    found = true;
            }
            if (dgRecords.Items.Count > 0)
            {
                dgRecords.SelectedItem = dgRecords.Items[0];
                dgRecords.ScrollIntoView(dgRecords.Items[0]);
            }
        }
    }
}