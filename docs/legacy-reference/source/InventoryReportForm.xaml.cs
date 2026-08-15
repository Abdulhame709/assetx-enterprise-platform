using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    public partial class InventoryReportForm : Window
    {
        private DataTable _inventoryData;
        private bool _isLoading = false;

        public InventoryReportForm()
        {
            InitializeComponent();
            _isLoading = true;
            LoadCycles();
            LoadLocations();
            _isLoading = false;
        }

        // ═══════════════════════════════════════════
        //  تحميل دورات الجرد
        // ═══════════════════════════════════════════
        private void LoadCycles()
        {
            try
            {
                string query = @"SELECT CycleID, 
                                        CycleName + ' (' + CycleStatus + ')' AS CycleName,
                                        CycleYear, CycleStatus
                                 FROM tblInventoryCycles 
                                 ORDER BY CycleYear DESC";

                DataTable dt = DatabaseHelper.GetData(query);

                if (dt.Rows.Count == 0)
                {
                    MessageBox.Show("لا توجد دورات جرد مسجلة.\nيرجى إنشاء دورة جرد أولاً.",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Information);
                }

                cmbCycle.ItemsSource = dt.DefaultView;

                if (dt.Rows.Count > 0)
                    cmbCycle.SelectedIndex = 0;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل دورات الجرد:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void LoadLocations()
        {
            try
            {
                DataTable dt = DatabaseHelper.GetData(
                    "SELECT MainLocationID, MainLocationName FROM tblMainLocations WHERE IsActive = 1 ORDER BY MainLocationName");
                DataRow allRow = dt.NewRow();
                allRow["MainLocationID"] = 0;
                allRow["MainLocationName"] = "-- الكل --";
                dt.Rows.InsertAt(allRow, 0);
                cmbInvLocation.ItemsSource = dt.DefaultView;
                cmbInvLocation.SelectedIndex = 0;
            }
            catch { }
        }

        // ═══════════════════════════════════════════
        //  تغيير الدورة
        // ═══════════════════════════════════════════
        private void cmbCycle_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            // لا نفعل شيئاً تلقائياً - ننتظر زر "إنشاء التقرير"
        }

        // ═══════════════════════════════════════════
        //  إنشاء تقرير الجرد
        // ═══════════════════════════════════════════
        private void btnGenerate_Click(object sender, RoutedEventArgs e)
        {
            if (cmbCycle.SelectedValue == null)
            {
                MessageBox.Show("يرجى اختيار دورة الجرد أولاً",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                int cycleID = Convert.ToInt32(cmbCycle.SelectedValue);
                txtInvStatus.Text = "جاري إنشاء تقرير الجرد...";

                string query = @"
                    SELECT 
                        r.RecordID,
                        r.CycleID,
                        a.AssetName,
                        a.FullAssetCode,
                        a.AssetID,

                        -- المتوقع
                        r.ExpectedQuantity,
                        ISNULL(ml1.MainLocationName, '-') AS ExpectedMainLoc,
                        ISNULL(sl1.SubLocationName, '') AS ExpectedSubLoc,
                        ISNULL(ml1.MainLocationName + ISNULL(' / ' + sl1.SubLocationName, ''), '-') AS ExpectedLocation,
                        ISNULL(s1.StatusName, '-') AS ExpectedStatus,

                        -- الفعلي
                        r.ActualQuantity,
                        ISNULL(ml2.MainLocationName, '-') AS ActualMainLoc,
                        ISNULL(sl2.SubLocationName, '') AS ActualSubLoc,
                        ISNULL(ml2.MainLocationName + ISNULL(' / ' + sl2.SubLocationName, ''), '-') AS ActualLocation,
                        ISNULL(s2.StatusName, '-') AS ActualStatus,

                        -- النتيجة
                        r.InventoryResult,
                        ISNULL(r.ExpectedQuantity, 0) - ISNULL(r.ActualQuantity, 0) AS Difference,
                        r.InventoryDate,
                        r.InventoryBy,
                        r.IsVerified,
                        r.VerifiedBy,
                        r.Notes,

                        -- للفلترة
                        r.ExpectedMainLocID,
                        r.ActualMainLocID

                    FROM tblInventoryRecords r
                    INNER JOIN tblAssets a ON r.AssetID = a.AssetID
                    LEFT JOIN tblMainLocations ml1 ON r.ExpectedMainLocID = ml1.MainLocationID
                    LEFT JOIN tblSubLocations sl1 ON r.ExpectedSubLocID = sl1.SubLocationID
                    LEFT JOIN tblMainLocations ml2 ON r.ActualMainLocID = ml2.MainLocationID
                    LEFT JOIN tblSubLocations sl2 ON r.ActualSubLocID = sl2.SubLocationID
                    LEFT JOIN tblStatus s1 ON r.ExpectedStatusID = s1.StatusID
                    LEFT JOIN tblStatus s2 ON r.ActualStatusID = s2.StatusID
                    WHERE r.CycleID = @CycleID
                    ORDER BY r.InventoryResult, a.AssetName";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@CycleID", cycleID)
                };

                _inventoryData = DatabaseHelper.GetData(query, parameters);

                dgInventory.ItemsSource = _inventoryData.DefaultView;

                // تحديث البطاقات
                UpdateInventoryCards();

                // تطبيق فلتر النتيجة إن وُجد
                ApplyInventoryFilter();

                txtInvStatus.Text = string.Format(
                    "تم إنشاء التقرير - {0} سجل | {1}",
                    _inventoryData.Rows.Count,
                    DateTime.Now.ToString("hh:mm:ss tt"));
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في إنشاء التقرير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                txtInvStatus.Text = "حدث خطأ";
            }
        }

        // ═══════════════════════════════════════════
        //  تحديث بطاقات الملخص
        // ═══════════════════════════════════════════
        private void UpdateInventoryCards()
        {
            if (_inventoryData == null) return;

            int matched = 0, deficit = 0, surplus = 0;
            int moved = 0, missing = 0, notDone = 0, total = 0;

            total = _inventoryData.Rows.Count;

            foreach (DataRow row in _inventoryData.Rows)
            {
                string result = row["InventoryResult"] != DBNull.Value
                    ? row["InventoryResult"].ToString() : "";

                switch (result)
                {
                    case "مطابق": matched++; break;
                    case "عجز": deficit++; break;
                    case "زيادة": surplus++; break;
                    case "منقول": moved++; break;
                    case "مفقود": missing++; break;
                    case "لم يُجرد": notDone++; break;
                    default: notDone++; break;
                }
            }

            txtMatched.Text = matched.ToString();
            txtDeficit.Text = deficit.ToString();
            txtSurplus.Text = surplus.ToString();
            txtMoved.Text = moved.ToString();
            txtMissing.Text = missing.ToString();
            txtNotDone.Text = notDone.ToString();
            txtTotal.Text = total.ToString();

            // نسبة الإنجاز
            int done = total - notDone;
            double rate = total > 0 ? (double)done / total * 100 : 0;
            txtCompletionRate.Text = rate.ToString("F1") + "%";
        }

        // ═══════════════════════════════════════════
        //  فلترة النتائج
        // ═══════════════════════════════════════════
        private void ApplyInventoryFilter()
        {
            if (_inventoryData == null) return;

            try
            {
                List<string> conditions = new List<string>();

                // فلتر النتيجة
                if (cmbResultFilter.SelectedIndex > 0)
                {
                    ComboBoxItem item = cmbResultFilter.SelectedItem as ComboBoxItem;
                    if (item != null)
                    {
                        conditions.Add(string.Format("InventoryResult = '{0}'",
                            item.Content.ToString()));
                    }
                }

                // فلتر الموقع
                if (cmbInvLocation.SelectedValue != null)
                {
                    int locID = 0;
                    int.TryParse(cmbInvLocation.SelectedValue.ToString(), out locID);
                    if (locID > 0)
                    {
                        conditions.Add(string.Format(
                            "(ExpectedMainLocID = {0} OR ActualMainLocID = {0})",
                            locID));
                    }
                }

                string filter = "";
                if (conditions.Count > 0)
                    filter = string.Join(" AND ", conditions);

                _inventoryData.DefaultView.RowFilter = filter;

                int filtered = _inventoryData.DefaultView.Count;
                txtInvStatus.Text = string.Format("عرض {0} من أصل {1} سجل",
                    filtered, _inventoryData.Rows.Count);
            }
            catch (Exception ex)
            {
                _inventoryData.DefaultView.RowFilter = "";
                txtInvStatus.Text = "خطأ في الفلترة: " + ex.Message;
            }
        }

        private void cmbResultFilter_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (!_isLoading)
                ApplyInventoryFilter();
        }

        // ═══════════════════════════════════════════
        //  النقر على بطاقة النتيجة للفلترة
        // ═══════════════════════════════════════════
        private void Card_Click(object sender, MouseButtonEventArgs e)
        {
            Border card = sender as Border;
            if (card == null || card.Tag == null) return;

            string resultType = card.Tag.ToString();

            // البحث عن العنصر المناسب في ComboBox
            for (int i = 0; i < cmbResultFilter.Items.Count; i++)
            {
                ComboBoxItem item = cmbResultFilter.Items[i] as ComboBoxItem;
                if (item != null && item.Content.ToString() == resultType)
                {
                    cmbResultFilter.SelectedIndex = i;
                    break;
                }
            }
        }

        // ═══════════════════════════════════════════
        //  إعادة تعيين
        // ═══════════════════════════════════════════
        private void btnInvReset_Click(object sender, RoutedEventArgs e)
        {
            _isLoading = true;
            cmbResultFilter.SelectedIndex = 0;
            cmbInvLocation.SelectedIndex = 0;
            _isLoading = false;

            if (_inventoryData != null)
            {
                _inventoryData.DefaultView.RowFilter = "";
                txtInvStatus.Text = string.Format("عرض الكل - {0} سجل", _inventoryData.Rows.Count);
            }
        }

        // ═══════════════════════════════════════════
        //  التصدير
        // ═══════════════════════════════════════════
        private void btnInvExport_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (_inventoryData == null || _inventoryData.DefaultView.Count == 0)
                {
                    MessageBox.Show("لا توجد بيانات للتصدير. أنشئ التقرير أولاً.",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                Microsoft.Win32.SaveFileDialog dlg = new Microsoft.Win32.SaveFileDialog();
                dlg.FileName = "تقرير_الجرد_" + DateTime.Now.ToString("yyyyMMdd_HHmm");
                dlg.DefaultExt = ".csv";
                dlg.Filter = "CSV (*.csv)|*.csv";

                if (dlg.ShowDialog() == true)
                {
                    System.Text.StringBuilder sb = new System.Text.StringBuilder();

                    sb.AppendLine("رقم,كود الأصل,اسم الأصل,الموقع المتوقع,الموقع الفعلي," +
                                  "الكمية المتوقعة,الكمية الفعلية,الفرق,الحالة المتوقعة," +
                                  "الحالة الفعلية,النتيجة,تاريخ الجرد,جرد بواسطة,ملاحظات");

                    foreach (DataRowView row in _inventoryData.DefaultView)
                    {
                        sb.AppendLine(string.Format(
                            "{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},{13}",
                            row["RecordID"],
                            row["FullAssetCode"],
                            CleanCsv(row["AssetName"]),
                            CleanCsv(row["ExpectedLocation"]),
                            CleanCsv(row["ActualLocation"]),
                            row["ExpectedQuantity"],
                            row["ActualQuantity"] != DBNull.Value ? row["ActualQuantity"].ToString() : "",
                            row["Difference"],
                            row["ExpectedStatus"],
                            row["ActualStatus"],
                            row["InventoryResult"],
                            row["InventoryDate"] != DBNull.Value
                                ? Convert.ToDateTime(row["InventoryDate"]).ToString("yyyy/MM/dd") : "",
                            CleanCsv(row["InventoryBy"]),
                            CleanCsv(row["Notes"])
                        ));
                    }

                    System.IO.File.WriteAllText(dlg.FileName, sb.ToString(),
                        new System.Text.UTF8Encoding(true));

                    MessageBox.Show(string.Format("تم تصدير {0} سجل بنجاح!",
                        _inventoryData.DefaultView.Count),
                        "نجح", MessageBoxButton.OK, MessageBoxImage.Information);

                    System.Diagnostics.Process.Start(dlg.FileName);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في التصدير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private string CleanCsv(object val)
        {
            if (val == null || val == DBNull.Value) return "";
            string s = val.ToString();
            if (s.Contains(",") || s.Contains("\""))
                return "\"" + s.Replace("\"", "\"\"") + "\"";
            return s;
        }

        // ═══════════════════════════════════════════
        //  الطباعة
        // ═══════════════════════════════════════════
        private void btnInvPrint_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (_inventoryData == null || _inventoryData.Rows.Count == 0)
                {
                    MessageBox.Show("لا توجد بيانات للطباعة.",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                PrintDialog printDialog = new PrintDialog();
                if (printDialog.ShowDialog() == true)
                {
                    printDialog.PrintVisual(dgInventory, "تقرير ملخص الجرد");
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