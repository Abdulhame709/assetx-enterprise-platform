using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة إدارة الموظفين
    /// كود تلقائي مع إعادة استخدام الأكواد المحذوفة
    /// </summary>
    public partial class EmployeesForm : Window
    {
        private bool isNewRecord = false;
        private bool isEditMode = false;

        public EmployeesForm()
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
                    SELECT CAST(EmployeeCode AS INT) AS CodeNum 
                    FROM tblEmployees 
                    WHERE ISNUMERIC(EmployeeCode) = 1 
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
                    SELECT EmployeeID, EmployeeCode, EmployeeName, 
                           JobTitle, Department, Phone, Email, IsActive 
                    FROM tblEmployees 
                    ORDER BY 
                        CASE WHEN ISNUMERIC(EmployeeCode) = 1 
                             THEN CAST(EmployeeCode AS INT) 
                             ELSE 99999 END, 
                        EmployeeID";

                DataTable dt = DatabaseHelper.GetData(query);
                dgEmployees.ItemsSource = dt.DefaultView;

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

            txtEmployeeCode.IsEnabled = false;
            txtEmployeeName.IsEnabled = false;
            txtJobTitle.IsEnabled = false;
            txtDepartment.IsEnabled = false;
            txtPhone.IsEnabled = false;
            txtEmail.IsEnabled = false;
            chkIsActive.IsEnabled = false;

            btnNew.IsEnabled = true;
            btnSave.IsEnabled = false;
            btnEdit.IsEnabled = (dgEmployees.SelectedItem != null);
            btnDelete.IsEnabled = (dgEmployees.SelectedItem != null);
            btnCancel.IsEnabled = false;

            dgEmployees.IsEnabled = true;
        }

        private void SetInputMode()
        {
            txtEmployeeCode.IsEnabled = false;
            txtEmployeeName.IsEnabled = true;
            txtJobTitle.IsEnabled = true;
            txtDepartment.IsEnabled = true;
            txtPhone.IsEnabled = true;
            txtEmail.IsEnabled = true;
            chkIsActive.IsEnabled = true;

            btnNew.IsEnabled = false;
            btnSave.IsEnabled = true;
            btnEdit.IsEnabled = false;
            btnDelete.IsEnabled = false;
            btnCancel.IsEnabled = true;

            dgEmployees.IsEnabled = false;

            txtEmployeeName.Focus();
        }

        private void ClearFields()
        {
            txtEmployeeID.Text = "";
            txtEmployeeCode.Text = "";
            txtEmployeeName.Text = "";
            txtJobTitle.Text = "";
            txtDepartment.Text = "";
            txtPhone.Text = "";
            txtEmail.Text = "";
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
            txtEmployeeCode.Text = nextCode.ToString();

            SetInputMode();
            txtFormStatus.Text = "إدخال موظف جديد - الكود: " + nextCode;
        }

        private void btnSave_Click(object sender, RoutedEventArgs e)
        {
            // التحقق من صحة البيانات
            if (string.IsNullOrWhiteSpace(txtEmployeeName.Text))
            {
                MessageBox.Show("يرجى إدخال اسم الموظف!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtEmployeeName.Focus();
                return;
            }

            try
            {
                if (isNewRecord)
                {
                    // التحقق من عدم تكرار الاسم
                    string checkQuery = "SELECT COUNT(*) FROM tblEmployees WHERE EmployeeName = @Name";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtEmployeeName.Text.Trim())
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموظف موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtEmployeeName.Focus();
                        return;
                    }

                    // التحقق من الكود
                    string checkCodeQuery = "SELECT COUNT(*) FROM tblEmployees WHERE EmployeeCode = @Code";
                    SqlParameter[] checkCodeParams = {
                        new SqlParameter("@Code", txtEmployeeCode.Text.Trim())
                    };
                    int codeExists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkCodeQuery, checkCodeParams));

                    if (codeExists > 0)
                    {
                        int newCode = GenerateNextCode();
                        txtEmployeeCode.Text = newCode.ToString();
                    }

                    // تنفيذ الإضافة
                    string insertQuery = @"
                        INSERT INTO tblEmployees 
                            (EmployeeCode, EmployeeName, JobTitle, Department, Phone, Email, IsActive, CreatedDate) 
                        VALUES 
                            (@Code, @Name, @Job, @Dept, @Phone, @Email, @Active, GETDATE())";

                    SqlParameter[] insertParams = {
                        new SqlParameter("@Code", txtEmployeeCode.Text.Trim()),
                        new SqlParameter("@Name", txtEmployeeName.Text.Trim()),
                        new SqlParameter("@Job", string.IsNullOrWhiteSpace(txtJobTitle.Text) ?
                            (object)DBNull.Value : txtJobTitle.Text.Trim()),
                        new SqlParameter("@Dept", string.IsNullOrWhiteSpace(txtDepartment.Text) ?
                            (object)DBNull.Value : txtDepartment.Text.Trim()),
                        new SqlParameter("@Phone", string.IsNullOrWhiteSpace(txtPhone.Text) ?
                            (object)DBNull.Value : txtPhone.Text.Trim()),
                        new SqlParameter("@Email", string.IsNullOrWhiteSpace(txtEmail.Text) ?
                            (object)DBNull.Value : txtEmail.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0)
                    };

                    DatabaseHelper.ExecuteNonQuery(insertQuery, insertParams);

                    txtFormStatus.Text = "✅ تم إضافة الموظف بنجاح - الكود: " + txtEmployeeCode.Text;
                    MessageBox.Show("تم إضافة الموظف بنجاح!\n\nالكود: " + txtEmployeeCode.Text,
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (isEditMode)
                {
                    // التحقق من عدم تكرار الاسم
                    string checkQuery = "SELECT COUNT(*) FROM tblEmployees WHERE EmployeeName = @Name AND EmployeeID <> @ID";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtEmployeeName.Text.Trim()),
                        new SqlParameter("@ID", Convert.ToInt32(txtEmployeeID.Text))
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموظف موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtEmployeeName.Focus();
                        return;
                    }

                    // تنفيذ التحديث
                    string updateQuery = @"
                        UPDATE tblEmployees SET 
                            EmployeeName = @Name, 
                            JobTitle = @Job, 
                            Department = @Dept, 
                            Phone = @Phone, 
                            Email = @Email, 
                            IsActive = @Active,
                            ModifiedDate = GETDATE()
                        WHERE EmployeeID = @ID";

                    SqlParameter[] updateParams = {
                        new SqlParameter("@Name", txtEmployeeName.Text.Trim()),
                        new SqlParameter("@Job", string.IsNullOrWhiteSpace(txtJobTitle.Text) ?
                            (object)DBNull.Value : txtJobTitle.Text.Trim()),
                        new SqlParameter("@Dept", string.IsNullOrWhiteSpace(txtDepartment.Text) ?
                            (object)DBNull.Value : txtDepartment.Text.Trim()),
                        new SqlParameter("@Phone", string.IsNullOrWhiteSpace(txtPhone.Text) ?
                            (object)DBNull.Value : txtPhone.Text.Trim()),
                        new SqlParameter("@Email", string.IsNullOrWhiteSpace(txtEmail.Text) ?
                            (object)DBNull.Value : txtEmail.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0),
                        new SqlParameter("@ID", Convert.ToInt32(txtEmployeeID.Text))
                    };

                    DatabaseHelper.ExecuteNonQuery(updateQuery, updateParams);

                    txtFormStatus.Text = "✅ تم تحديث بيانات الموظف بنجاح";
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
            if (dgEmployees.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            isNewRecord = false;
            isEditMode = true;
            SetInputMode();
            txtEmployeeCode.IsEnabled = false;
            txtFormStatus.Text = "تعديل بيانات الموظف: " + txtEmployeeName.Text;
        }

        private void btnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (dgEmployees.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل من الجدول أولاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MessageBoxResult result = MessageBox.Show(
                "هل أنت متأكد من حذف الموظف: " + txtEmployeeName.Text + "؟\n" +
                "الكود: " + txtEmployeeCode.Text + "\n\n" +
                "📝 الكود سيُعاد استخدامه تلقائياً.",
                "تأكيد الحذف",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result != MessageBoxResult.Yes) return;

            try
            {
                int employeeID = Convert.ToInt32(txtEmployeeID.Text);

                // التحقق من عدم الاستخدام في الأصول
                string checkQuery = "SELECT COUNT(*) FROM tblAssets WHERE EmployeeID = @ID";
                SqlParameter[] checkParams = {
                    new SqlParameter("@ID", employeeID)
                };
                int usedCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                if (usedCount > 0)
                {
                    MessageBox.Show(
                        "لا يمكن حذف هذا الموظف!\n\n" +
                        "السبب: مرتبط بـ " + usedCount + " أصل.\n" +
                        "يمكنك تعطيله بدلاً من حذفه.",
                        "لا يمكن الحذف",
                        MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                string deleteQuery = "DELETE FROM tblEmployees WHERE EmployeeID = @ID";
                SqlParameter[] deleteParams = {
                    new SqlParameter("@ID", employeeID)
                };

                DatabaseHelper.ExecuteNonQuery(deleteQuery, deleteParams);

                txtFormStatus.Text = "✅ تم حذف الموظف - الكود " + txtEmployeeCode.Text + " متاح";
                MessageBox.Show("تم حذف الموظف بنجاح!",
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
            dgEmployees.SelectedItem = null;
            txtFormStatus.Text = "تم الإلغاء";
        }

        // ═══════════════════════════════════════════════════
        // حدث اختيار سجل من الجدول
        // ═══════════════════════════════════════════════════
        private void dgEmployees_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgEmployees.SelectedItem == null) return;

            DataRowView row = dgEmployees.SelectedItem as DataRowView;
            if (row == null) return;

            txtEmployeeID.Text = row["EmployeeID"].ToString();
            txtEmployeeCode.Text = row["EmployeeCode"] != DBNull.Value ? row["EmployeeCode"].ToString() : "";
            txtEmployeeName.Text = row["EmployeeName"].ToString();
            txtJobTitle.Text = row["JobTitle"] != DBNull.Value ? row["JobTitle"].ToString() : "";
            txtDepartment.Text = row["Department"] != DBNull.Value ? row["Department"].ToString() : "";
            txtPhone.Text = row["Phone"] != DBNull.Value ? row["Phone"].ToString() : "";
            txtEmail.Text = row["Email"] != DBNull.Value ? row["Email"].ToString() : "";
            chkIsActive.IsChecked = row["IsActive"] != DBNull.Value && Convert.ToBoolean(row["IsActive"]);

            btnEdit.IsEnabled = true;
            btnDelete.IsEnabled = true;

            txtFormStatus.Text = "تم اختيار: " + txtEmployeeName.Text + " (كود: " + txtEmployeeCode.Text + ")";
        }
    }
}