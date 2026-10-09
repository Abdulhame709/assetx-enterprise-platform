using System;
using System.Data;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Services;

namespace AssetManagement.Views
{
    public partial class InventoryCyclesView : Window
    {
        // ═══ متغيرات على مستوى النافذة ═══
        private int _selectedCycleID = -1;     // رقم الدورة المحددة حالياً
        private bool _isNewMode = false;        // هل نحن في وضع إنشاء دورة جديدة؟

        // ═══════════════════════════════════════════════════
        // المُنشئ
        // ═══════════════════════════════════════════════════
        public InventoryCyclesView()
        {
            InitializeComponent();
        }

        // ═══════════════════════════════════════════════════
        // عند تحميل النافذة
        // ═══════════════════════════════════════════════════
        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadCycles();
            SetNewMode(false);
            ClearForm();
        }

        // ═══════════════════════════════════════════════════
        // تحميل جميع الدورات في الجدول
        // ═══════════════════════════════════════════════════
        private void LoadCycles()
        {
            try
            {
                DataTable dt = InventoryCycleService.GetAllCycles();
                dgCycles.ItemsSource = dt.DefaultView;

                // تحديث معلومات الشريط العلوي
                txtCurrentInfo.Text = "إجمالي الدورات: " + dt.Rows.Count;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل البيانات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // تنظيف حقول النموذج
        // ═══════════════════════════════════════════════════
        private void ClearForm()
        {
            txtYear.Text = "";
            txtCycleName.Text = "";
            txtStatus.Text = "جديدة";
            dpStartDate.SelectedDate = null;
            dpEndDate.SelectedDate = null;
            txtNotes.Text = "";
            _selectedCycleID = -1;

            // تصفير الإحصائيات
            lblTotal.Text = "0";
            lblInventoried.Text = "0";
            lblMatched.Text = "0";
            lblDeficit.Text = "0";
            lblSurplus.Text = "0";
            lblTransferred.Text = "0";
            lblMissing.Text = "0";
            lblNotInventoried.Text = "0";
        }

        // ═══════════════════════════════════════════════════
        // التحكم في وضع الأزرار (جديد / تعديل)
        // ═══════════════════════════════════════════════════
        private void SetNewMode(bool isNew)
        {
            _isNewMode = isNew;

            // في وضع الجديد: فعّل زر الإنشاء، عطّل الباقي
            btnCreate.IsEnabled = isNew;
            btnSave.IsEnabled = !isNew && _selectedCycleID > 0;
            btnDelete.IsEnabled = !isNew && _selectedCycleID > 0;
            btnStart.IsEnabled = !isNew && _selectedCycleID > 0;
            btnClose.IsEnabled = !isNew && _selectedCycleID > 0;
            btnOpenEntry.IsEnabled = !isNew && _selectedCycleID > 0;
            btnSummary.IsEnabled = !isNew && _selectedCycleID > 0;

            // في وضع الجديد: السنة والاسم قابلان للتعديل
            txtYear.IsReadOnly = !isNew;
        }

        // ═══════════════════════════════════════════════════
        // زر: جديد - تجهيز النموذج لإنشاء دورة جديدة
        // ═══════════════════════════════════════════════════
        private void btnNew_Click(object sender, RoutedEventArgs e)
        {
            ClearForm();
            SetNewMode(true);

            // ملء القيم الافتراضية
            txtYear.Text = DateTime.Now.Year.ToString();
            txtCycleName.Text = "جرد الأصول " + DateTime.Now.Year;
            dpStartDate.SelectedDate = DateTime.Today;
            txtStatus.Text = "جديدة";

            // وضع المؤشر في حقل السنة
            txtYear.Focus();
            txtYear.SelectAll();
        }

        // ═══════════════════════════════════════════════════
        // زر: إنشاء دورة جديدة + نسخ الأصول
        // ═══════════════════════════════════════════════════
        private void btnCreate_Click(object sender, RoutedEventArgs e)
        {
            // ── التحقق من الإدخال ──
            if (string.IsNullOrWhiteSpace(txtYear.Text))
            {
                MessageBox.Show("يرجى إدخال سنة الجرد!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                txtYear.Focus();
                return;
            }

            int year;
            if (!int.TryParse(txtYear.Text.Trim(), out year) || year < 2000 || year > 2100)
            {
                MessageBox.Show("سنة الجرد غير صحيحة!\nيجب أن تكون بين 2000 و 2100",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtYear.Focus();
                return;
            }

            if (string.IsNullOrWhiteSpace(txtCycleName.Text))
            {
                MessageBox.Show("يرجى إدخال اسم الدورة!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                txtCycleName.Focus();
                return;
            }

            if (dpStartDate.SelectedDate == null)
            {
                MessageBox.Show("يرجى تحديد تاريخ البداية!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // ── تأكيد الإنشاء ──
            MessageBoxResult confirm = MessageBox.Show(
                "سيتم إنشاء دورة جرد جديدة لسنة " + year + "\n" +
                "وسيتم نسخ جميع الأصول النشطة تلقائياً.\n\n" +
                "هل تريد المتابعة؟",
                "تأكيد الإنشاء",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (confirm != MessageBoxResult.Yes) return;

            // ── تنفيذ الإنشاء ──
            string errorMessage;
            int assetCount;
            int cycleId = InventoryCycleService.CreateNewCycle(
                year,
                txtCycleName.Text.Trim(),
                dpStartDate.SelectedDate.Value,
                "admin",  // يمكنك تغييره لاسم المستخدم الحالي
                out assetCount,
                out errorMessage);

            if (cycleId > 0)
            {
                MessageBox.Show(
                    "✅ تم إنشاء دورة الجرد بنجاح!\n\n" +
                    "رقم الدورة: " + cycleId + "\n" +
                    "عدد الأصول المنسوخة: " + assetCount + " أصل\n\n" +
                    "يمكنك الآن بدء الجرد الميداني.",
                    "تم بنجاح",
                    MessageBoxButton.OK,
                    MessageBoxImage.Information);

                LoadCycles();
                SetNewMode(false);

                // تحديد الدورة الجديدة في الجدول
                SelectCycleInGrid(cycleId);
            }
            else
            {
                MessageBox.Show("❌ فشل في إنشاء الدورة:\n" + errorMessage,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // زر: حفظ التعديلات على الدورة المحددة
        // ═══════════════════════════════════════════════════
        private void btnSave_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedCycleID <= 0)
            {
                MessageBox.Show("يرجى تحديد دورة من الجدول أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (string.IsNullOrWhiteSpace(txtCycleName.Text))
            {
                MessageBox.Show("اسم الدورة مطلوب!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string errorMessage;
            bool success = InventoryCycleService.UpdateCycle(
                _selectedCycleID,
                txtCycleName.Text.Trim(),
                dpEndDate.SelectedDate,
                txtNotes.Text.Trim(),
                out errorMessage);

            if (success)
            {
                MessageBox.Show("✅ تم حفظ التعديلات بنجاح!", "تم",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                LoadCycles();
                SelectCycleInGrid(_selectedCycleID);
            }
            else
            {
                MessageBox.Show("❌ فشل في الحفظ:\n" + errorMessage,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // زر: بدء الجرد - تغيير الحالة إلى "قيد التنفيذ"
        // ═══════════════════════════════════════════════════
        private void btnStartInventory_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedCycleID <= 0) return;

            string currentStatus = txtStatus.Text;

            if (currentStatus == "مغلقة")
            {
                MessageBox.Show("هذه الدورة مغلقة ولا يمكن تعديلها!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (currentStatus == "قيد التنفيذ")
            {
                MessageBox.Show("الدورة قيد التنفيذ بالفعل!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            MessageBoxResult confirm = MessageBox.Show(
                "سيتم تغيير حالة الدورة إلى 'قيد التنفيذ'.\nهل تريد المتابعة؟",
                "تأكيد", MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (confirm != MessageBoxResult.Yes) return;

            string errorMessage;
            bool success = InventoryCycleService.UpdateCycleStatus(
                _selectedCycleID, "قيد التنفيذ", out errorMessage);

            if (success)
            {
                MessageBox.Show("✅ تم بدء الجرد! الحالة: قيد التنفيذ", "تم",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                txtStatus.Text = "قيد التنفيذ";
                LoadCycles();
                SelectCycleInGrid(_selectedCycleID);
            }
            else
            {
                MessageBox.Show("خطأ: " + errorMessage, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // زر: إغلاق الدورة
        // ═══════════════════════════════════════════════════
        private void btnCloseCycle_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedCycleID <= 0) return;

            if (txtStatus.Text == "مغلقة")
            {
                MessageBox.Show("الدورة مغلقة بالفعل!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            MessageBoxResult confirm = MessageBox.Show(
                "⚠ هل أنت متأكد من إغلاق هذه الدورة؟\n\n" +
                "بعد الإغلاق لن تتمكن من إجراء أي تعديلات على سجلات الجرد.",
                "تأكيد الإغلاق",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (confirm != MessageBoxResult.Yes) return;

            string errorMessage;
            bool success = InventoryCycleService.UpdateCycleStatus(
                _selectedCycleID, "مغلقة", out errorMessage);

            if (success)
            {
                MessageBox.Show("✅ تم إغلاق الدورة بنجاح.", "تم",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                LoadCycles();
                SelectCycleInGrid(_selectedCycleID);
            }
            else
            {
                MessageBox.Show("خطأ: " + errorMessage, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // زر: حذف الدورة
        // ═══════════════════════════════════════════════════
        private void btnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedCycleID <= 0)
            {
                MessageBox.Show("يرجى تحديد دورة من الجدول أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MessageBoxResult confirm = MessageBox.Show(
                "⚠ هل أنت متأكد من حذف هذه الدورة؟\n\n" +
                "سيتم حذف الدورة وجميع سجلات الجرد المرتبطة بها!\n" +
                "هذا الإجراء لا يمكن التراجع عنه.",
                "تأكيد الحذف",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (confirm != MessageBoxResult.Yes) return;

            string errorMessage;
            bool success = InventoryCycleService.DeleteCycle(_selectedCycleID, out errorMessage);

            if (success)
            {
                MessageBox.Show("✅ تم حذف الدورة وسجلاتها بنجاح.", "تم",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                ClearForm();
                LoadCycles();
                SetNewMode(false);
            }
            else
            {
                MessageBox.Show("❌ فشل في الحذف:\n" + errorMessage,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // زر: تحديث البيانات
        // ═══════════════════════════════════════════════════
        private void btnRefresh_Click(object sender, RoutedEventArgs e)
        {
            LoadCycles();
            if (_selectedCycleID > 0)
            {
                LoadCycleStats(_selectedCycleID);
            }
        }

        // ═══════════════════════════════════════════════════
        // عند تحديد دورة في الجدول → عرض بياناتها
        // ═══════════════════════════════════════════════════
        private void dgCycles_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgCycles.SelectedItem == null)
            {
                _selectedCycleID = -1;
                SetNewMode(false);
                return;
            }

            DataRowView row = dgCycles.SelectedItem as DataRowView;
            if (row == null) return;

            // ── ملء الحقول من السطر المحدد ──
            _selectedCycleID = Convert.ToInt32(row["CycleID"]);
            txtYear.Text = row["CycleYear"].ToString();
            txtCycleName.Text = row["CycleName"].ToString();
            txtStatus.Text = row["CycleStatus"].ToString();
            txtNotes.Text = row["Notes"] != DBNull.Value ? row["Notes"].ToString() : "";

            // التواريخ
            if (row["StartDate"] != DBNull.Value)
                dpStartDate.SelectedDate = Convert.ToDateTime(row["StartDate"]);
            else
                dpStartDate.SelectedDate = null;

            if (row["EndDate"] != DBNull.Value)
                dpEndDate.SelectedDate = Convert.ToDateTime(row["EndDate"]);
            else
                dpEndDate.SelectedDate = null;

            // ── تحميل الإحصائيات ──
            LoadCycleStats(_selectedCycleID);

            // ── تفعيل الأزرار ──
            SetNewMode(false);
            _selectedCycleID = Convert.ToInt32(row["CycleID"]); // إعادة التعيين بعد SetNewMode
            btnSave.IsEnabled = true;
            btnDelete.IsEnabled = true;
            btnStart.IsEnabled = true;
            btnClose.IsEnabled = true;
            btnOpenEntry.IsEnabled = true;
            btnSummary.IsEnabled = true;

            // تعطيل بعض الأزرار حسب الحالة
            string status = txtStatus.Text;
            if (status == "مغلقة")
            {
                btnSave.IsEnabled = false;
                btnStart.IsEnabled = false;
                btnClose.IsEnabled = false;
                btnDelete.IsEnabled = false;
            }
        }

        // ═══════════════════════════════════════════════════
        // تحميل إحصائيات دورة محددة
        // ═══════════════════════════════════════════════════
        private void LoadCycleStats(int cycleId)
        {
            try
            {
                DataTable dt = InventoryCycleService.GetQuickStats(cycleId);

                if (dt != null && dt.Rows.Count > 0)
                {
                    DataRow row = dt.Rows[0];
                    lblTotal.Text = row["TotalAssets"].ToString();
                    lblInventoried.Text = row["Inventoried"].ToString();
                    lblMatched.Text = row["Matched"].ToString();
                    lblDeficit.Text = row["Deficit"].ToString();
                    lblSurplus.Text = row["Surplus"].ToString();
                    lblTransferred.Text = row["Transferred"].ToString();
                    lblMissing.Text = row["Missing"].ToString();
                    lblNotInventoried.Text = row["NotInventoried"].ToString();
                }
                else
                {
                    // تصفير
                    lblTotal.Text = "0";
                    lblInventoried.Text = "0";
                    lblMatched.Text = "0";
                    lblDeficit.Text = "0";
                    lblSurplus.Text = "0";
                    lblTransferred.Text = "0";
                    lblMissing.Text = "0";
                    lblNotInventoried.Text = "0";
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل الإحصائيات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // عند تغيير السنة → تحديث اسم الدورة تلقائياً
        // ═══════════════════════════════════════════════════
        private void txtYear_TextChanged(object sender, TextChangedEventArgs e)
        {
            if (_isNewMode && !string.IsNullOrWhiteSpace(txtYear.Text))
            {
                txtCycleName.Text = "جرد الأصول " + txtYear.Text.Trim();
            }
        }

        // ═══════════════════════════════════════════════════
        // زر: فتح شاشة الجرد الميداني
        // (سيتم تفعيله في الخطوة 7.2)
        // ═══════════════════════════════════════════════════
        private void btnOpenInventoryEntry_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedCycleID <= 0)
            {
                MessageBox.Show("يرجى تحديد دورة أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string status = txtStatus.Text;
            if (status != "قيد التنفيذ" && status != "جديدة")
            {
                MessageBox.Show("لا يمكن إجراء جرد على دورة بحالة: " + status,
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // فتح شاشة الجرد الميداني
            var entryForm = new InventoryEntryView(_selectedCycleID, txtCycleName.Text);
            entryForm.ShowDialog();

            // بعد إغلاق شاشة الجرد، تحديث البيانات
            LoadCycles();
            if (_selectedCycleID > 0)
                LoadCycleStats(_selectedCycleID);
        }

        // ═══════════════════════════════════════════════════
        // زر: عرض تقرير ملخص الجرد
        // ═══════════════════════════════════════════════════
        private void btnShowSummary_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedCycleID <= 0)
            {
                MessageBox.Show("يرجى تحديد دورة أولاً!", "تنبيه",
                    MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                DataTable summary = InventoryCycleService.GetCycleSummary(_selectedCycleID);

                if (summary == null || summary.Rows.Count == 0)
                {
                    MessageBox.Show("لا توجد بيانات جرد لهذه الدورة بعد.",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Information);
                    return;
                }

                // عرض التقرير في رسالة (مؤقتاً حتى بناء نافذة التقارير)
                string report = "═══ تقرير ملخص الجرد ═══\n";
                report += "الدورة: " + txtCycleName.Text + "\n";
                report += "────────────────────────────\n\n";

                foreach (DataRow row in summary.Rows)
                {
                    report += string.Format("  {0}: {1} أصل | متوقع: {2} | فعلي: {3} | الفرق: {4}\n",
                        row[0], row[1], row[2], row[3], row[4]);
                }

                MessageBox.Show(report, "تقرير ملخص الجرد",
                    MessageBoxButton.OK, MessageBoxImage.Information);
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في عرض التقرير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // زر: إغلاق النافذة
        // ═══════════════════════════════════════════════════
        private void btnCloseWindow_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }

        // ═══════════════════════════════════════════════════
        // دالة مساعدة: تحديد دورة في الجدول بواسطة ID
        // ═══════════════════════════════════════════════════
        private void SelectCycleInGrid(int cycleId)
        {
            foreach (var item in dgCycles.Items)
            {
                DataRowView row = item as DataRowView;
                if (row != null && Convert.ToInt32(row["CycleID"]) == cycleId)
                {
                    dgCycles.SelectedItem = item;
                    dgCycles.ScrollIntoView(item);
                    break;
                }
            }
        }
    }
}