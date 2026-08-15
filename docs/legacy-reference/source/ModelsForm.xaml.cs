using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة إدارة الموديلات
    /// </summary>
    public partial class ModelsForm : Window
    {
        private bool isNewRecord = false;
        private bool isEditMode = false;

        public ModelsForm()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadData();
            SetReadMode();
        }

        // ═══════════════════════════════════════════════════
        // توليد الكود التلقائي
        // ═══════════════════════════════════════════════════
        private int GenerateNextCode()
        {
            try
            {
                string query = @"
                    SELECT CAST(ModelCode AS INT) AS CodeNum 
                    FROM tblAssetModels 
                    WHERE ISNUMERIC(ModelCode) = 1 
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
        // تحميل البيانات
        // ═══════════════════════════════════════════════════
        private void LoadData()
        {
            try
            {
                string query = @"
                    SELECT ModelID, ModelCode, ModelName, 
                           Manufacturer, Supplier, Description, IsActive 
                    FROM tblAssetModels 
                    ORDER BY 
                        CASE WHEN ISNUMERIC(ModelCode) = 1 
                             THEN CAST(ModelCode AS INT) 
                             ELSE 99999 END, 
                        ModelID";

                DataTable dt = DatabaseHelper.GetData(query);
                dgModels.ItemsSource = dt.DefaultView;

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

            txtModelCode.IsEnabled = false;
            txtModelName.IsEnabled = false;
            txtManufacturer.IsEnabled = false;
            txtSupplier.IsEnabled = false;
            txtDescription.IsEnabled = false;
            chkIsActive.IsEnabled = false;

            btnNew.IsEnabled = true;
            btnSave.IsEnabled = false;
            btnEdit.IsEnabled = (dgModels.SelectedItem != null);
            btnDelete.IsEnabled = (dgModels.SelectedItem != null);
            btnCancel.IsEnabled = false;

            dgModels.IsEnabled = true;
        }

        private void SetInputMode()
        {
            txtModelCode.IsEnabled = false;
            txtModelName.IsEnabled = true;
            txtManufacturer.IsEnabled = true;
            txtSupplier.IsEnabled = true;
            txtDescription.IsEnabled = true;
            chkIsActive.IsEnabled = true;

            btnNew.IsEnabled = false;
            btnSave.IsEnabled = true;
            btnEdit.IsEnabled = false;
            btnDelete.IsEnabled = false;
            btnCancel.IsEnabled = true;

            dgModels.IsEnabled = false;

            txtModelName.Focus();
        }

        private void ClearFields()
        {
            txtModelID.Text = "";
            txtModelCode.Text = "";
            txtModelName.Text = "";
            txtManufacturer.Text = "";
            txtSupplier.Text = "";
            txtDescription.Text = "";
            chkIsActive.IsChecked = true;
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
            txtModelCode.Text = nextCode.ToString();

            SetInputMode();
            txtFormStatus.Text = "إدخال موديل جديد - الكود: " + nextCode;
        }

        private void btnSave_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtModelName.Text))
            {
                MessageBox.Show("يرجى إدخال اسم الموديل!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtModelName.Focus();
                return;
            }

            try
            {
                if (isNewRecord)
                {
                    // التحقق من عدم تكرار الاسم
                    string checkQuery = "SELECT COUNT(*) FROM tblAssetModels WHERE ModelName = @Name";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtModelName.Text.Trim())
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموديل موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtModelName.Focus();
                        return;
                    }

                    // التحقق من الكود
                    string checkCodeQuery = "SELECT COUNT(*) FROM tblAssetModels WHERE ModelCode = @Code";
                    SqlParameter[] checkCodeParams = {
                        new SqlParameter("@Code", txtModelCode.Text.Trim())
                    };
                    int codeExists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkCodeQuery, checkCodeParams));

                    if (codeExists > 0)
                    {
                        int newCode = GenerateNextCode();
                        txtModelCode.Text = newCode.ToString();
                    }

                    // تنفيذ الإضافة
                    string insertQuery = @"
                        INSERT INTO tblAssetModels 
                            (ModelCode, ModelName, Manufacturer, Supplier, Description, IsActive, CreatedDate) 
                        VALUES 
                            (@Code, @Name, @Manu, @Supp, @Desc, @Active, GETDATE())";

                    SqlParameter[] insertParams = {
                        new SqlParameter("@Code", txtModelCode.Text.Trim()),
                        new SqlParameter("@Name", txtModelName.Text.Trim()),
                        new SqlParameter("@Manu", string.IsNullOrWhiteSpace(txtManufacturer.Text) ?
                            (object)DBNull.Value : txtManufacturer.Text.Trim()),
                        new SqlParameter("@Supp", string.IsNullOrWhiteSpace(txtSupplier.Text) ?
                            (object)DBNull.Value : txtSupplier.Text.Trim()),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0)
                    };

                    DatabaseHelper.ExecuteNonQuery(insertQuery, insertParams);

                    txtFormStatus.Text = "✅ تم إضافة الموديل بنجاح - الكود: " + txtModelCode.Text;
                    MessageBox.Show("تم إضافة الموديل بنجاح!\n\nالكود: " + txtModelCode.Text,
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (isEditMode)
                {
                    // التحقق من عدم تكرار الاسم
                    string checkQuery = "SELECT COUNT(*) FROM tblAssetModels WHERE ModelName = @Name AND ModelID <> @ID";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtModelName.Text.Trim()),
                        new SqlParameter("@ID", Convert.ToInt32(txtModelID.Text))
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموديل موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtModelName.Focus();
                        return;
                    }

                    // تنفيذ التحديث
                    string updateQuery = @"
                        UPDATE tblAssetModels SET 
                            ModelName = @Name, 
                            Manufacturer = @Manu, 
                            Supplier = @Supp, 
                            Description = @Desc, 
                            IsActive = @Active,
                            ModifiedDate = GETDATE()
                        WHERE ModelID = @ID";

                    SqlParameter[] updateParams = {
                        new SqlParameter("@Name", txtModelName.Text.Trim()),
                        new SqlParameter("@Manu", string.IsNullOrWhiteSpace(txtManufacturer.Text) ?
                            (object)DBNull.Value : txtManufacturer.Text.Trim()),
                        new SqlParameter("@Supp", string.IsNullOrWhiteSpace(txtSupplier.Text) ?
                            (object)DBNull.Value : txtSupplier.Text.Trim()),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0),
                        new SqlParameter("@ID", Convert.ToInt32(txtModelID.Text))
                    };

                    DatabaseHelper.ExecuteNonQuery(updateQuery, updateParams);

                    txtFormStatus.Text = "✅ تم تحديث الموديل بنجاح";
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
            if (dgModels.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            isNewRecord = false;
            isEditMode = true;
            SetInputMode();
            txtModelCode.IsEnabled = false;
            txtFormStatus.Text = "تعديل الموديل: " + txtModelName.Text;
        }

        private void btnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (dgModels.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MessageBoxResult result = MessageBox.Show(
                "هل أنت متأكد من حذف الموديل: " + txtModelName.Text + "؟\n" +
                "الكود: " + txtModelCode.Text + "\n\n" +
                "📝 الكود سيُعاد استخدامه تلقائياً.",
                "تأكيد الحذف",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result != MessageBoxResult.Yes) return;

            try
            {
                int modelID = Convert.ToInt32(txtModelID.Text);

                // التحقق من عدم الاستخدام في الأصول
                string checkQuery = "SELECT COUNT(*) FROM tblAssets WHERE ModelID = @ID";
                SqlParameter[] checkParams = {
                    new SqlParameter("@ID", modelID)
                };
                int usedCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                if (usedCount > 0)
                {
                    MessageBox.Show(
                        "لا يمكن حذف هذا الموديل!\n\n" +
                        "السبب: مستخدم في " + usedCount + " أصل.\n" +
                        "يمكنك تعطيله بدلاً من حذفه.",
                        "لا يمكن الحذف",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                string deleteQuery = "DELETE FROM tblAssetModels WHERE ModelID = @ID";
                SqlParameter[] deleteParams = {
                    new SqlParameter("@ID", modelID)
                };

                DatabaseHelper.ExecuteNonQuery(deleteQuery, deleteParams);

                txtFormStatus.Text = "✅ تم حذف الموديل - الكود " + txtModelCode.Text + " متاح";
                MessageBox.Show("تم حذف الموديل بنجاح!",
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

        private void btnCancel_Click(object sender, RoutedEventArgs e)
        {
            ClearFields();
            SetReadMode();
            dgModels.SelectedItem = null;
            txtFormStatus.Text = "تم الإلغاء";
        }

        // ═══════════════════════════════════════════════════
        // حدث اختيار سجل من الجدول
        // ═══════════════════════════════════════════════════
        private void dgModels_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgModels.SelectedItem == null) return;

            DataRowView row = dgModels.SelectedItem as DataRowView;
            if (row == null) return;

            txtModelID.Text = row["ModelID"].ToString();
            txtModelCode.Text = row["ModelCode"] != DBNull.Value ? row["ModelCode"].ToString() : "";
            txtModelName.Text = row["ModelName"].ToString();
            txtManufacturer.Text = row["Manufacturer"] != DBNull.Value ? row["Manufacturer"].ToString() : "";
            txtSupplier.Text = row["Supplier"] != DBNull.Value ? row["Supplier"].ToString() : "";
            txtDescription.Text = row["Description"] != DBNull.Value ? row["Description"].ToString() : "";
            chkIsActive.IsChecked = row["IsActive"] != DBNull.Value && Convert.ToBoolean(row["IsActive"]);

            btnEdit.IsEnabled = true;
            btnDelete.IsEnabled = true;

            txtFormStatus.Text = "تم اختيار: " + txtModelName.Text + " (كود: " + txtModelCode.Text + ")";
        }
    }
}