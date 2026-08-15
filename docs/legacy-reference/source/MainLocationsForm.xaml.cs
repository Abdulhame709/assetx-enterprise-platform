using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة إدارة المواقع الرئيسية (المباني)
    /// مع كل الوظائف: كود تلقائي، منع الحذف إذا مستخدم، تفعيل/تعطيل
    /// </summary>
    public partial class MainLocationsForm : Window
    {
        private bool isNewRecord = false;
        private bool isEditMode = false;

        public MainLocationsForm()
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
        private int GenerateNextCode()
        {
            try
            {
                string query = @"
                    SELECT CAST(MainLocationCode AS INT) AS CodeNum 
                    FROM tblMainLocations 
                    WHERE ISNUMERIC(MainLocationCode) = 1 
                    ORDER BY CodeNum";

                DataTable dt = DatabaseHelper.GetData(query);

                if (dt.Rows.Count == 0)
                    return 1;

                int expectedCode = 1;
                foreach (DataRow row in dt.Rows)
                {
                    int currentCode = Convert.ToInt32(row["CodeNum"]);
                    if (currentCode != expectedCode)
                    {
                        return expectedCode;
                    }
                    expectedCode++;
                }

                return expectedCode;
            }
            catch
            {
                return 1;
            }
        }

        // ═══════════════════════════════════════════════════
        // تحميل البيانات مع عدد المواقع الفرعية
        // ═══════════════════════════════════════════════════
        private void LoadData()
        {
            try
            {
                string query = @"
                    SELECT 
                        m.MainLocationID, 
                        m.MainLocationCode, 
                        m.MainLocationName,
                        m.ResponsiblePerson,
                        m.ContactInfo,
                        m.Description, 
                        m.IsActive,
                        (SELECT COUNT(*) FROM tblSubLocations s 
                         WHERE s.MainLocationID = m.MainLocationID) AS SubLocCount
                    FROM tblMainLocations m
                    ORDER BY 
                        CASE WHEN ISNUMERIC(m.MainLocationCode) = 1 
                             THEN CAST(m.MainLocationCode AS INT) 
                             ELSE 99999 END, 
                        m.MainLocationID";

                DataTable dt = DatabaseHelper.GetData(query);
                dgLocations.ItemsSource = dt.DefaultView;

                txtRecordCount.Text = "عدد السجلات: " + dt.Rows.Count;
                txtFormStatus.Text = "تم تحميل البيانات بنجاح";
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل البيانات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // أوضاع النافذة
        // ═══════════════════════════════════════════════════
        private void SetReadMode()
        {
            isNewRecord = false;
            isEditMode = false;

            txtLocationCode.IsEnabled = false;
            txtLocationName.IsEnabled = false;
            txtResponsiblePerson.IsEnabled = false;
            txtContactInfo.IsEnabled = false;
            txtDescription.IsEnabled = false;
            chkIsActive.IsEnabled = false;

            btnNew.IsEnabled = true;
            btnSave.IsEnabled = false;
            btnEdit.IsEnabled = (dgLocations.SelectedItem != null);
            btnDelete.IsEnabled = (dgLocations.SelectedItem != null);
            btnToggleActive.IsEnabled = (dgLocations.SelectedItem != null);
            btnCancel.IsEnabled = false;

            dgLocations.IsEnabled = true;

            txtFormMode.Text = "وضع العرض";
        }

        private void SetInputMode()
        {
            txtLocationCode.IsEnabled = false; // الكود لا يُعدّل
            txtLocationName.IsEnabled = true;
            txtResponsiblePerson.IsEnabled = true;
            txtContactInfo.IsEnabled = true;
            txtDescription.IsEnabled = true;
            chkIsActive.IsEnabled = true;

            btnNew.IsEnabled = false;
            btnSave.IsEnabled = true;
            btnEdit.IsEnabled = false;
            btnDelete.IsEnabled = false;
            btnToggleActive.IsEnabled = false;
            btnCancel.IsEnabled = true;

            dgLocations.IsEnabled = false;

            txtFormMode.Text = isNewRecord ? "وضع الإضافة" : "وضع التعديل";
            txtLocationName.Focus();
        }

        private void ClearFields()
        {
            txtLocationID.Text = "";
            txtLocationCode.Text = "";
            txtLocationName.Text = "";
            txtResponsiblePerson.Text = "";
            txtContactInfo.Text = "";
            txtDescription.Text = "";
            chkIsActive.IsChecked = true;
            txtSubLocationsCount.Text = "0";
        }

        // ═══════════════════════════════════════════════════
        // أحداث الأزرار
        // ═══════════════════════════════════════════════════

        private void btnNew_Click(object sender, RoutedEventArgs e)
        {
            isNewRecord = true;
            isEditMode = false;
            ClearFields();

            int nextCode = GenerateNextCode();
            txtLocationCode.Text = nextCode.ToString();

            SetInputMode();
            txtFormStatus.Text = "إدخال موقع جديد - الكود: " + nextCode;
        }

        private void btnSave_Click(object sender, RoutedEventArgs e)
        {
            // التحقق من صحة البيانات
            if (string.IsNullOrWhiteSpace(txtLocationName.Text))
            {
                MessageBox.Show("يرجى إدخال اسم الموقع!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtLocationName.Focus();
                return;
            }

            try
            {
                if (isNewRecord)
                {
                    // ─── التحقق من عدم تكرار الاسم ───
                    string checkQuery = "SELECT COUNT(*) FROM tblMainLocations WHERE MainLocationName = @Name";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtLocationName.Text.Trim())
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموقع موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtLocationName.Focus();
                        return;
                    }

                    // ─── التحقق من الكود ───
                    string checkCodeQuery = "SELECT COUNT(*) FROM tblMainLocations WHERE MainLocationCode = @Code";
                    SqlParameter[] checkCodeParams = {
                        new SqlParameter("@Code", txtLocationCode.Text.Trim())
                    };
                    int codeExists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkCodeQuery, checkCodeParams));

                    if (codeExists > 0)
                    {
                        int newCode = GenerateNextCode();
                        txtLocationCode.Text = newCode.ToString();
                    }

                    // ─── تنفيذ الإضافة ───
                    string insertQuery = @"
                        INSERT INTO tblMainLocations 
                            (MainLocationCode, MainLocationName, ResponsiblePerson, 
                             ContactInfo, Description, IsActive, CreatedDate) 
                        VALUES 
                            (@Code, @Name, @Person, @Contact, @Desc, @Active, GETDATE())";

                    SqlParameter[] insertParams = {
                        new SqlParameter("@Code", txtLocationCode.Text.Trim()),
                        new SqlParameter("@Name", txtLocationName.Text.Trim()),
                        new SqlParameter("@Person", string.IsNullOrWhiteSpace(txtResponsiblePerson.Text) ?
                            (object)DBNull.Value : txtResponsiblePerson.Text.Trim()),
                        new SqlParameter("@Contact", string.IsNullOrWhiteSpace(txtContactInfo.Text) ?
                            (object)DBNull.Value : txtContactInfo.Text.Trim()),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0)
                    };

                    DatabaseHelper.ExecuteNonQuery(insertQuery, insertParams);

                    txtFormStatus.Text = "✅ تم إضافة الموقع بنجاح - الكود: " + txtLocationCode.Text;
                    MessageBox.Show("تم إضافة الموقع بنجاح!\n\nالكود: " + txtLocationCode.Text,
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (isEditMode)
                {
                    // ─── التحقق من عدم تكرار الاسم ───
                    string checkQuery = "SELECT COUNT(*) FROM tblMainLocations WHERE MainLocationName = @Name AND MainLocationID <> @ID";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtLocationName.Text.Trim()),
                        new SqlParameter("@ID", Convert.ToInt32(txtLocationID.Text))
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموقع موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtLocationName.Focus();
                        return;
                    }

                    // ─── تنفيذ التحديث ───
                    string updateQuery = @"
                        UPDATE tblMainLocations SET 
                            MainLocationName = @Name, 
                            ResponsiblePerson = @Person, 
                            ContactInfo = @Contact, 
                            Description = @Desc, 
                            IsActive = @Active,
                            ModifiedDate = GETDATE()
                        WHERE MainLocationID = @ID";

                    SqlParameter[] updateParams = {
                        new SqlParameter("@Name", txtLocationName.Text.Trim()),
                        new SqlParameter("@Person", string.IsNullOrWhiteSpace(txtResponsiblePerson.Text) ?
                            (object)DBNull.Value : txtResponsiblePerson.Text.Trim()),
                        new SqlParameter("@Contact", string.IsNullOrWhiteSpace(txtContactInfo.Text) ?
                            (object)DBNull.Value : txtContactInfo.Text.Trim()),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0),
                        new SqlParameter("@ID", Convert.ToInt32(txtLocationID.Text))
                    };

                    DatabaseHelper.ExecuteNonQuery(updateQuery, updateParams);

                    txtFormStatus.Text = "✅ تم تحديث الموقع بنجاح";
                    MessageBox.Show("تم تحديث البيانات بنجاح!",
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
            }
        }

        private void btnEdit_Click(object sender, RoutedEventArgs e)
        {
            if (dgLocations.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            isNewRecord = false;
            isEditMode = true;
            SetInputMode();
            txtFormStatus.Text = "تعديل الموقع: " + txtLocationName.Text;
        }

        private void btnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (dgLocations.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                int locationID = Convert.ToInt32(txtLocationID.Text);

                // ─── التحقق من وجود مواقع فرعية ───
                string checkSubQuery = "SELECT COUNT(*) FROM tblSubLocations WHERE MainLocationID = @ID";
                SqlParameter[] checkSubParams = { new SqlParameter("@ID", locationID) };
                int subCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkSubQuery, checkSubParams));

                if (subCount > 0)
                {
                    MessageBox.Show(
                        "لا يمكن حذف هذا الموقع!\n\n" +
                        "السبب: يحتوي على " + subCount + " موقع فرعي.\n\n" +
                        "الحل: احذف المواقع الفرعية أولاً، أو قم بتعطيل الموقع.",
                        "لا يمكن الحذف",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // ─── التحقق من الاستخدام في الأصول ───
                string checkAssetsQuery = "SELECT COUNT(*) FROM tblAssets WHERE MainLocationID = @ID";
                SqlParameter[] checkAssetsParams = { new SqlParameter("@ID", locationID) };
                int assetsCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkAssetsQuery, checkAssetsParams));

                if (assetsCount > 0)
                {
                    MessageBox.Show(
                        "لا يمكن حذف هذا الموقع!\n\n" +
                        "السبب: مستخدم في " + assetsCount + " أصل.\n\n" +
                        "الحل: انقل الأصول لموقع آخر، أو قم بتعطيل الموقع.",
                        "لا يمكن الحذف",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // ─── تأكيد الحذف ───
                MessageBoxResult result = MessageBox.Show(
                    "هل أنت متأكد من حذف الموقع:\n\n" +
                    "🏢 " + txtLocationName.Text + "\n" +
                    "الكود: " + txtLocationCode.Text + "\n\n" +
                    "⚠️ لا يمكن التراجع عن هذا الإجراء!\n" +
                    "📝 الكود سيُعاد استخدامه تلقائياً.",
                    "تأكيد الحذف",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result != MessageBoxResult.Yes) return;

                // ─── تنفيذ الحذف ───
                string deleteQuery = "DELETE FROM tblMainLocations WHERE MainLocationID = @ID";
                SqlParameter[] deleteParams = { new SqlParameter("@ID", locationID) };

                DatabaseHelper.ExecuteNonQuery(deleteQuery, deleteParams);

                txtFormStatus.Text = "✅ تم حذف الموقع - الكود " + txtLocationCode.Text + " متاح";
                MessageBox.Show("تم حذف الموقع بنجاح!",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                LoadData();
                ClearFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الحذف:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// زر تغيير حالة التفعيل
        /// </summary>
        private void btnToggleActive_Click(object sender, RoutedEventArgs e)
        {
            if (dgLocations.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                int locationID = Convert.ToInt32(txtLocationID.Text);
                bool currentStatus = chkIsActive.IsChecked == true;
                bool newStatus = !currentStatus;
                string statusText = newStatus ? "تفعيل" : "تعطيل";

                MessageBoxResult result = MessageBox.Show(
                    "هل تريد " + statusText + " الموقع:\n\n" +
                    "🏢 " + txtLocationName.Text + "؟",
                    statusText + " الموقع",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question);

                if (result != MessageBoxResult.Yes) return;

                string updateQuery = @"
                    UPDATE tblMainLocations SET 
                        IsActive = @Active,
                        ModifiedDate = GETDATE()
                    WHERE MainLocationID = @ID";

                SqlParameter[] updateParams = {
                    new SqlParameter("@Active", newStatus ? 1 : 0),
                    new SqlParameter("@ID", locationID)
                };

                DatabaseHelper.ExecuteNonQuery(updateQuery, updateParams);

                txtFormStatus.Text = "✅ تم " + statusText + " الموقع بنجاح";
                MessageBox.Show("تم " + statusText + " الموقع بنجاح!",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                LoadData();
                ClearFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تغيير الحالة:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnCancel_Click(object sender, RoutedEventArgs e)
        {
            ClearFields();
            SetReadMode();
            dgLocations.SelectedItem = null;
            txtFormStatus.Text = "تم الإلغاء";
        }

        // ═══════════════════════════════════════════════════
        // حدث اختيار سجل من الجدول
        // ═══════════════════════════════════════════════════
        private void dgLocations_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgLocations.SelectedItem == null) return;

            DataRowView row = dgLocations.SelectedItem as DataRowView;
            if (row == null) return;

            txtLocationID.Text = row["MainLocationID"].ToString();
            txtLocationCode.Text = row["MainLocationCode"] != DBNull.Value ? row["MainLocationCode"].ToString() : "";
            txtLocationName.Text = row["MainLocationName"].ToString();
            txtResponsiblePerson.Text = row["ResponsiblePerson"] != DBNull.Value ? row["ResponsiblePerson"].ToString() : "";
            txtContactInfo.Text = row["ContactInfo"] != DBNull.Value ? row["ContactInfo"].ToString() : "";
            txtDescription.Text = row["Description"] != DBNull.Value ? row["Description"].ToString() : "";
            chkIsActive.IsChecked = row["IsActive"] != DBNull.Value && Convert.ToBoolean(row["IsActive"]);
            txtSubLocationsCount.Text = row["SubLocCount"].ToString();

            btnEdit.IsEnabled = true;
            btnDelete.IsEnabled = true;
            btnToggleActive.IsEnabled = true;

            txtFormStatus.Text = "تم اختيار: " + txtLocationName.Text + " (كود: " + txtLocationCode.Text +
                                 " | فرعية: " + txtSubLocationsCount.Text + ")";
        }
    }
}