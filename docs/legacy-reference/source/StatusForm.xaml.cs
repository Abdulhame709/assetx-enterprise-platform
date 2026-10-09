using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة إدارة حالات الأصول
    /// إضافة - تعديل - حذف - عرض
    /// مع توليد أكواد تلقائية وإعادة استخدام المحذوفة
    /// </summary>
    public partial class StatusForm : Window
    {
        // ═══════════════════════════════════════════════════
        // متغيرات التحكم
        // ═══════════════════════════════════════════════════
        private bool isNewRecord = false;
        private bool isEditMode = false;

        // ═══════════════════════════════════════════════════
        // المُنشئ وتحميل النافذة
        // ═══════════════════════════════════════════════════
        public StatusForm()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadData();
            SetReadMode();
        }

        // ═══════════════════════════════════════════════════
        // توليد الكود التلقائي مع إعادة استخدام المحذوف
        // ═══════════════════════════════════════════════════

        /// <summary>
        /// يبحث عن أول رقم فارغ (فجوة) في الأكواد
        /// إذا لم توجد فجوات يرجع الرقم التالي بعد آخر كود
        /// </summary>
        private int GenerateNextCode()
        {
            try
            {
                // البحث عن أول فجوة في الأرقام
                // الفكرة: نجلب كل الأكواد الرقمية ونبحث عن أول رقم مفقود
                string query = @"
                    SELECT MIN(GapCode) AS NextCode
                    FROM (
                        -- نولّد أرقام من 1 إلى أكبر كود + 1
                        -- ونبحث عن أول رقم غير موجود
                        SELECT TOP 1000 
                            ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS GapCode
                        FROM sys.objects
                    ) AS Numbers
                    WHERE GapCode NOT IN (
                        SELECT CAST(StatusCode AS INT) 
                        FROM tblStatus 
                        WHERE ISNUMERIC(StatusCode) = 1
                    )
                    AND GapCode >= 1";

                object result = DatabaseHelper.ExecuteScalar(query);

                if (result != null && result != DBNull.Value)
                {
                    return Convert.ToInt32(result);
                }

                // إذا فشل الاستعلام أعلاه، نستخدم طريقة بديلة
                return GetNextCodeSimple();
            }
            catch
            {
                // طريقة بديلة بسيطة في حال حدوث أي خطأ
                return GetNextCodeSimple();
            }
        }

        /// <summary>
        /// طريقة بديلة بسيطة: جلب كل الأكواد والبحث عن أول فجوة
        /// </summary>
        private int GetNextCodeSimple()
        {
            try
            {
                // جلب كل الأكواد الرقمية مرتبة
                string query = @"
                    SELECT CAST(StatusCode AS INT) AS CodeNum 
                    FROM tblStatus 
                    WHERE ISNUMERIC(StatusCode) = 1 
                    ORDER BY CodeNum";

                DataTable dt = DatabaseHelper.GetData(query);

                if (dt.Rows.Count == 0)
                    return 1; // أول كود

                // البحث عن أول فجوة
                int expectedCode = 1;
                foreach (DataRow row in dt.Rows)
                {
                    int currentCode = Convert.ToInt32(row["CodeNum"]);
                    if (currentCode != expectedCode)
                    {
                        // وجدنا فجوة!
                        return expectedCode;
                    }
                    expectedCode++;
                }

                // لا توجد فجوات - نرجع الرقم التالي
                return expectedCode;
            }
            catch
            {
                return 1;
            }
        }

        // ═══════════════════════════════════════════════════
        // تحميل البيانات
        // ═══════════════════════════════════════════════════
        private void LoadData()
        {
            try
            {
                string query = @"
                    SELECT StatusID, StatusCode, StatusName, 
                           Description, StatusColor, IsActive 
                    FROM tblStatus 
                    ORDER BY 
                        CASE WHEN ISNUMERIC(StatusCode) = 1 
                             THEN CAST(StatusCode AS INT) 
                             ELSE 99999 END, 
                        StatusID";

                DataTable dt = DatabaseHelper.GetData(query);
                dgStatus.ItemsSource = dt.DefaultView;

                txtRecordCount.Text = "عدد السجلات: " + dt.Rows.Count;
                txtFormStatus.Text = "تم تحميل البيانات بنجاح";
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل البيانات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                txtFormStatus.Text = "خطأ في تحميل البيانات";
            }
        }

        // ═══════════════════════════════════════════════════
        // أوضاع النافذة
        // ═══════════════════════════════════════════════════
        private void SetReadMode()
        {
            isNewRecord = false;
            isEditMode = false;

            txtStatusCode.IsEnabled = false;
            txtStatusName.IsEnabled = false;
            txtDescription.IsEnabled = false;
            txtStatusColor.IsEnabled = false;
            chkIsActive.IsEnabled = false;

            btnNew.IsEnabled = true;
            btnSave.IsEnabled = false;
            btnEdit.IsEnabled = (dgStatus.SelectedItem != null);
            btnDelete.IsEnabled = (dgStatus.SelectedItem != null);
            btnCancel.IsEnabled = false;

            dgStatus.IsEnabled = true;
        }

        private void SetInputMode()
        {
            // الكود لا يمكن تعديله - يتولد تلقائياً
            txtStatusCode.IsEnabled = false;

            txtStatusName.IsEnabled = true;
            txtDescription.IsEnabled = true;
            txtStatusColor.IsEnabled = true;
            chkIsActive.IsEnabled = true;

            btnNew.IsEnabled = false;
            btnSave.IsEnabled = true;
            btnEdit.IsEnabled = false;
            btnDelete.IsEnabled = false;
            btnCancel.IsEnabled = true;

            dgStatus.IsEnabled = false;

            txtStatusName.Focus();
        }

        private void ClearFields()
        {
            txtStatusID.Text = "";
            txtStatusCode.Text = "";
            txtStatusName.Text = "";
            txtDescription.Text = "";
            txtStatusColor.Text = "#000000";
            chkIsActive.IsChecked = true;
            UpdateColorPreview();
        }

        private void UpdateColorPreview()
        {
            try
            {
                string colorText = txtStatusColor.Text.Trim();
                if (!string.IsNullOrEmpty(colorText))
                {
                    Color color = (Color)ColorConverter.ConvertFromString(colorText);
                    brdColorPreview.Background = new SolidColorBrush(color);
                }
            }
            catch
            {
                brdColorPreview.Background = new SolidColorBrush(Colors.Gray);
            }
        }

        // ═══════════════════════════════════════════════════
        // أحداث الأزرار
        // ═══════════════════════════════════════════════════

        /// <summary>
        /// زر جديد - توليد كود تلقائي وتحضير الحقول
        /// </summary>
        private void btnNew_Click(object sender, RoutedEventArgs e)
        {
            isNewRecord = true;
            isEditMode = false;
            ClearFields();

            // توليد الكود التلقائي
            int nextCode = GenerateNextCode();
            txtStatusCode.Text = nextCode.ToString();

            SetInputMode();
            txtFormStatus.Text = "إدخال حالة جديدة - الكود: " + nextCode;
        }

        /// <summary>
        /// زر حفظ
        /// </summary>
        private void btnSave_Click(object sender, RoutedEventArgs e)
        {
            // التحقق من صحة البيانات
            if (string.IsNullOrWhiteSpace(txtStatusName.Text))
            {
                MessageBox.Show("يرجى إدخال اسم الحالة!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtStatusName.Focus();
                return;
            }

            try
            {
                if (isNewRecord)
                {
                    // ─── التحقق من عدم تكرار الاسم ───
                    string checkQuery = "SELECT COUNT(*) FROM tblStatus WHERE StatusName = @Name";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtStatusName.Text.Trim())
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الحالة موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtStatusName.Focus();
                        return;
                    }

                    // ─── التحقق من عدم تكرار الكود ───
                    string checkCodeQuery = "SELECT COUNT(*) FROM tblStatus WHERE StatusCode = @Code";
                    SqlParameter[] checkCodeParams = {
                        new SqlParameter("@Code", txtStatusCode.Text.Trim())
                    };
                    int codeExists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkCodeQuery, checkCodeParams));

                    if (codeExists > 0)
                    {
                        // الكود موجود (ربما أُضيف بين لحظة التوليد والحفظ)
                        // نولّد كود جديد
                        int newCode = GenerateNextCode();
                        txtStatusCode.Text = newCode.ToString();
                    }

                    // ─── تنفيذ الإضافة ───
                    string insertQuery = @"
                        INSERT INTO tblStatus (StatusCode, StatusName, Description, StatusColor, IsActive) 
                        VALUES (@Code, @Name, @Desc, @Color, @Active)";

                    SqlParameter[] insertParams = {
                        new SqlParameter("@Code", txtStatusCode.Text.Trim()),
                        new SqlParameter("@Name", txtStatusName.Text.Trim()),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Color", string.IsNullOrWhiteSpace(txtStatusColor.Text) ?
                            "#000000" : txtStatusColor.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0)
                    };

                    DatabaseHelper.ExecuteNonQuery(insertQuery, insertParams);

                    txtFormStatus.Text = "✅ تم إضافة الحالة بنجاح - الكود: " + txtStatusCode.Text;
                    MessageBox.Show("تم إضافة الحالة بنجاح!\n\nالكود: " + txtStatusCode.Text,
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (isEditMode)
                {
                    // ─── التحقق من عدم تكرار الاسم (مع استثناء السجل الحالي) ───
                    string checkQuery = "SELECT COUNT(*) FROM tblStatus WHERE StatusName = @Name AND StatusID <> @ID";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtStatusName.Text.Trim()),
                        new SqlParameter("@ID", Convert.ToInt32(txtStatusID.Text))
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الحالة موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtStatusName.Focus();
                        return;
                    }

                    // ─── تنفيذ التحديث (بدون تغيير الكود) ───
                    string updateQuery = @"
                        UPDATE tblStatus SET 
                            StatusName = @Name, 
                            Description = @Desc, 
                            StatusColor = @Color, 
                            IsActive = @Active 
                        WHERE StatusID = @ID";

                    SqlParameter[] updateParams = {
                        new SqlParameter("@Name", txtStatusName.Text.Trim()),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Color", string.IsNullOrWhiteSpace(txtStatusColor.Text) ?
                            "#000000" : txtStatusColor.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0),
                        new SqlParameter("@ID", Convert.ToInt32(txtStatusID.Text))
                    };

                    DatabaseHelper.ExecuteNonQuery(updateQuery, updateParams);

                    txtFormStatus.Text = "✅ تم تحديث الحالة بنجاح";
                    MessageBox.Show("تم تحديث الحالة بنجاح!",
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }

                LoadData();
                ClearFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في حفظ البيانات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                txtFormStatus.Text = "خطأ في الحفظ";
            }
        }

        /// <summary>
        /// زر تعديل
        /// </summary>
        private void btnEdit_Click(object sender, RoutedEventArgs e)
        {
            if (dgStatus.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            isNewRecord = false;
            isEditMode = true;
            SetInputMode();

            // الكود لا يمكن تعديله أبداً
            txtStatusCode.IsEnabled = false;

            txtFormStatus.Text = "تعديل الحالة: " + txtStatusName.Text;
        }

        /// <summary>
        /// زر حذف
        /// </summary>
        private void btnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (dgStatus.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MessageBoxResult result = MessageBox.Show(
                "هل أنت متأكد من حذف الحالة: " + txtStatusName.Text + "؟\n" +
                "الكود: " + txtStatusCode.Text + "\n\n" +
                "📝 ملاحظة: الكود سيُعاد استخدامه تلقائياً عند الإضافة القادمة.",
                "تأكيد الحذف",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result != MessageBoxResult.Yes) return;

            try
            {
                int statusID = Convert.ToInt32(txtStatusID.Text);

                // التحقق من عدم استخدام الحالة في الأصول
                string checkQuery = "SELECT COUNT(*) FROM tblAssets WHERE StatusID = @ID";
                SqlParameter[] checkParams = {
                    new SqlParameter("@ID", statusID)
                };
                int usedCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                if (usedCount > 0)
                {
                    MessageBox.Show(
                        "لا يمكن حذف هذه الحالة!\n\n" +
                        "السبب: مستخدمة في " + usedCount + " أصل.\n" +
                        "يمكنك تعطيلها بدلاً من حذفها (إزالة علامة نشط).",
                        "لا يمكن الحذف",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // تنفيذ الحذف
                string deleteQuery = "DELETE FROM tblStatus WHERE StatusID = @ID";
                SqlParameter[] deleteParams = {
                    new SqlParameter("@ID", statusID)
                };

                DatabaseHelper.ExecuteNonQuery(deleteQuery, deleteParams);

                txtFormStatus.Text = "✅ تم حذف الحالة - الكود " + txtStatusCode.Text + " متاح للاستخدام";
                MessageBox.Show("تم حذف الحالة بنجاح!\n\nالكود " + txtStatusCode.Text + " سيُعاد استخدامه تلقائياً.",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                LoadData();
                ClearFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في حذف السجل:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                txtFormStatus.Text = "خطأ في الحذف";
            }
        }

        /// <summary>
        /// زر إلغاء
        /// </summary>
        private void btnCancel_Click(object sender, RoutedEventArgs e)
        {
            ClearFields();
            SetReadMode();
            dgStatus.SelectedItem = null;
            txtFormStatus.Text = "تم الإلغاء";
        }

        // ═══════════════════════════════════════════════════
        // حدث اختيار سجل من الجدول
        // ═══════════════════════════════════════════════════
        private void dgStatus_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgStatus.SelectedItem == null) return;

            DataRowView row = dgStatus.SelectedItem as DataRowView;
            if (row == null) return;

            txtStatusID.Text = row["StatusID"].ToString();
            txtStatusCode.Text = row["StatusCode"] != DBNull.Value ? row["StatusCode"].ToString() : "";
            txtStatusName.Text = row["StatusName"].ToString();
            txtDescription.Text = row["Description"] != DBNull.Value ? row["Description"].ToString() : "";
            txtStatusColor.Text = row["StatusColor"] != DBNull.Value ? row["StatusColor"].ToString() : "#000000";
            chkIsActive.IsChecked = row["IsActive"] != DBNull.Value && Convert.ToBoolean(row["IsActive"]);

            UpdateColorPreview();

            btnEdit.IsEnabled = true;
            btnDelete.IsEnabled = true;

            txtFormStatus.Text = "تم اختيار: " + txtStatusName.Text + " (كود: " + txtStatusCode.Text + ")";
        }
    }
}