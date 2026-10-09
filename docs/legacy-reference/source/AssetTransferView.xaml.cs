using System;
using System.Data;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using AssetManagement.Services;

namespace AssetManagement.Views
{
    public partial class AssetTransferView : Window
    {
        private int _selectedAssetId = -1;
        private int? _currentMainLocId = null;
        private int? _currentSubLocId = null;
        private int? _currentEmployeeId = null;
        private int? _currentStatusId = null;

        public AssetTransferView()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadDropdowns();
            ClearForm();
        }

        private void LoadDropdowns()
        {
            try
            {
                // نوع الحركة
                cmbMovementType.Items.Clear();
                string[] types = { "نقل", "تسليم", "استلام", "إتلاف", "استغناء" };
                foreach (string t in types) cmbMovementType.Items.Add(t);
                cmbMovementType.SelectedIndex = 0;

                // المواقع الرئيسية
                DataTable locations = InventoryRecordService.GetMainLocations();
                cmbToMainLoc.ItemsSource = locations.DefaultView;
                cmbToMainLoc.DisplayMemberPath = "MainLocationName";
                cmbToMainLoc.SelectedValuePath = "MainLocationID";

                // الموظفين
                DataTable employees = InventoryRecordService.GetEmployees();
                cmbToEmployee.ItemsSource = employees.DefaultView;
                cmbToEmployee.DisplayMemberPath = "EmployeeName";
                cmbToEmployee.SelectedValuePath = "EmployeeID";

                // الحالات
                DataTable statuses = InventoryRecordService.GetStatuses();
                cmbToStatus.ItemsSource = statuses.DefaultView;
                cmbToStatus.DisplayMemberPath = "StatusName";
                cmbToStatus.SelectedValuePath = "StatusID";
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══ البحث عن أصل ═══
        private void txtSearchAsset_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter) SearchAsset();
        }

        private void btnSearchAsset_Click(object sender, RoutedEventArgs e)
        {
            SearchAsset();
        }

        private void SearchAsset()
        {
            string search = txtSearchAsset.Text.Trim();
            if (string.IsNullOrEmpty(search))
            {
                MessageBox.Show("اكتب اسم الأصل أو الكود للبحث!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            DataTable results = AssetMovementService.SearchAssets(search);

            if (results.Rows.Count == 0)
            {
                MessageBox.Show("لم يتم العثور على أصول!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                pnlSearchResults.Visibility = Visibility.Collapsed;
                return;
            }

            if (results.Rows.Count == 1)
            {
                SelectAsset(results.Rows[0]);
                pnlSearchResults.Visibility = Visibility.Collapsed;
            }
            else
            {
                dgSearchResults.ItemsSource = results.DefaultView;
                pnlSearchResults.Visibility = Visibility.Visible;
            }
        }

        private void dgSearchResults_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgSearchResults.SelectedItem == null) return;
            DataRowView row = dgSearchResults.SelectedItem as DataRowView;
            if (row == null) return;
            SelectAsset(row.Row);
            pnlSearchResults.Visibility = Visibility.Collapsed;
        }

        private void SelectAsset(DataRow row)
        {
            _selectedAssetId = Convert.ToInt32(row["AssetID"]);

            txtAssetInfo.Text = string.Format("[{0}] {1} - {2}",
                row["BaseAssetCode"], row["AssetName"], row["SubTypeName"]);

            // ملء بيانات "من" (الحالي)
            txtFromMainLoc.Text = row["MainLocationName"].ToString();
            txtFromSubLoc.Text = row["SubLocationName"].ToString();
            txtFromEmployee.Text = row["EmployeeName"].ToString();
            txtFromStatus.Text = row["StatusName"].ToString();

            _currentMainLocId = row["MainLocationID"] != DBNull.Value ?
                (int?)Convert.ToInt32(row["MainLocationID"]) : null;
            _currentSubLocId = row["SubLocationID"] != DBNull.Value ?
                (int?)Convert.ToInt32(row["SubLocationID"]) : null;
            _currentEmployeeId = row["EmployeeID"] != DBNull.Value ?
                (int?)Convert.ToInt32(row["EmployeeID"]) : null;
            _currentStatusId = row["StatusID"] != DBNull.Value ?
                (int?)Convert.ToInt32(row["StatusID"]) : null;

            // ملء "إلى" بنفس القيم الحالية كافتراضي
            if (_currentMainLocId.HasValue)
                cmbToMainLoc.SelectedValue = _currentMainLocId.Value;
            if (_currentStatusId.HasValue)
                cmbToStatus.SelectedValue = _currentStatusId.Value;
            if (_currentEmployeeId.HasValue)
                cmbToEmployee.SelectedValue = _currentEmployeeId.Value;
        }

        // ═══ تحميل المواقع الفرعية ═══
        private void cmbToMainLoc_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (cmbToMainLoc.SelectedValue != null)
            {
                int mainLocId = Convert.ToInt32(cmbToMainLoc.SelectedValue);
                DataTable subs = InventoryRecordService.GetSubLocationsHierarchical(mainLocId);
                cmbToSubLoc.ItemsSource = subs.DefaultView;
                cmbToSubLoc.DisplayMemberPath = "DisplayName";
                cmbToSubLoc.SelectedValuePath = "SubLocationID";

                if (_currentSubLocId.HasValue)
                    cmbToSubLoc.SelectedValue = _currentSubLocId.Value;
            }
            else
            {
                cmbToSubLoc.ItemsSource = null;
            }
        }

        // ═══ تغيير نوع الحركة ═══
        private void cmbMovementType_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (cmbMovementType.SelectedItem == null) return;
            string type = cmbMovementType.SelectedItem.ToString();

            bool isDisposal = (type == "إتلاف" || type == "استغناء");
            cmbToMainLoc.IsEnabled = !isDisposal;
            cmbToSubLoc.IsEnabled = !isDisposal;
            cmbToEmployee.IsEnabled = !isDisposal;

            if (isDisposal)
            {
                // اختيار حالة "مستغنى عنه" أو "تالف" تلقائياً
                foreach (var item in cmbToStatus.Items)
                {
                    DataRowView row = item as DataRowView;
                    if (row != null)
                    {
                        string statusName = row["StatusName"].ToString();
                        if ((type == "إتلاف" && statusName.Contains("تالف")) ||
                            (type == "استغناء" && statusName.Contains("مستغنى")))
                        {
                            cmbToStatus.SelectedItem = item;
                            break;
                        }
                    }
                }
            }
        }

        // ═══ تنفيذ النقل ═══
        private void btnExecuteTransfer_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedAssetId <= 0)
            {
                MessageBox.Show("يرجى اختيار أصل أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (cmbMovementType.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار نوع الحركة!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string movementType = cmbMovementType.SelectedItem.ToString();
            bool isDisposal = (movementType == "إتلاف" || movementType == "استغناء");

            // التحقق
            if (!isDisposal && cmbToMainLoc.SelectedValue == null)
            {
                MessageBox.Show("يرجى اختيار الموقع الجديد!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // تأكيد
            string confirmMsg = "";
            if (isDisposal)
                confirmMsg = "سيتم " + movementType + " الأصل وتعطيله.\n\nهل أنت متأكد؟";
            else
                confirmMsg = "سيتم نقل الأصل إلى الموقع والموظف الجديد.\n\nهل تريد المتابعة؟";

            if (MessageBox.Show(confirmMsg, "تأكيد " + movementType,
                MessageBoxButton.YesNo, MessageBoxImage.Question) != MessageBoxResult.Yes)
                return;

            // جمع البيانات
            int? toMainLocId = cmbToMainLoc.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbToMainLoc.SelectedValue) : null;
            int? toSubLocId = cmbToSubLoc.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbToSubLoc.SelectedValue) : null;
            int? toEmpId = cmbToEmployee.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbToEmployee.SelectedValue) : null;
            int? toStatusId = cmbToStatus.SelectedValue != null ?
                (int?)Convert.ToInt32(cmbToStatus.SelectedValue) : null;

            // تنفيذ
            string errorMessage;
            bool success = AssetMovementService.TransferAsset(
                _selectedAssetId, movementType,
                _currentMainLocId, _currentSubLocId, _currentEmployeeId,
                isDisposal ? null : toMainLocId,
                isDisposal ? null : toSubLocId,
                isDisposal ? null : toEmpId,
                _currentStatusId, toStatusId,
                1,
                txtReason.Text.Trim(),
                txtReferenceNo.Text.Trim(),
                txtApprovedBy.Text.Trim(),
                txtNotes.Text.Trim(),
                "admin",
                out errorMessage);

            if (success)
            {
                string msg = "تم تنفيذ " + movementType + " بنجاح!";
                if (isDisposal) msg += "\n\nتم تعطيل الأصل من النظام.";

                MessageBox.Show(msg, "تم", MessageBoxButton.OK, MessageBoxImage.Information);
                ClearForm();
            }
            else
            {
                MessageBox.Show("فشل في التنفيذ:\n" + errorMessage, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void ClearForm()
        {
            _selectedAssetId = -1;
            _currentMainLocId = null;
            _currentSubLocId = null;
            _currentEmployeeId = null;
            _currentStatusId = null;

            txtSearchAsset.Text = "";
            txtAssetInfo.Text = "";
            txtFromMainLoc.Text = "";
            txtFromSubLoc.Text = "";
            txtFromEmployee.Text = "";
            txtFromStatus.Text = "";

            cmbToMainLoc.SelectedIndex = -1;
            cmbToSubLoc.ItemsSource = null;
            cmbToEmployee.SelectedIndex = -1;
            cmbToStatus.SelectedIndex = -1;
            cmbMovementType.SelectedIndex = 0;

            txtReason.Text = "";
            txtReferenceNo.Text = "";
            txtApprovedBy.Text = "";
            txtNotes.Text = "";

            pnlSearchResults.Visibility = Visibility.Collapsed;
            txtSearchAsset.Focus();
        }

        private void btnClear_Click(object sender, RoutedEventArgs e) { ClearForm(); }
        private void btnClose_Click(object sender, RoutedEventArgs e) { this.Close(); }
    }
}