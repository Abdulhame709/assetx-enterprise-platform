using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    public partial class UsersForm : Window
    {
        private int _selectedUserID = 0;
        private bool _isEditMode = false;

        public UsersForm()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadEmployees();
            LoadUsers();
            ClearForm();
        }

        // ═══════════════════════════════════════
        // تحميل البيانات
        // ═══════════════════════════════════════

        private void LoadUsers(string searchText = "")
        {
            string query = @"SELECT UserID, Username, FullName, UserRole, 
                                   Department, Email, Phone, IsActive, LastLogin,
                                   EmployeeID
                            FROM tblUsers 
                            WHERE 1=1";

            if (!string.IsNullOrEmpty(searchText))
            {
                query += " AND (Username LIKE @Search OR FullName LIKE @Search OR Department LIKE @Search)";
            }
            query += " ORDER BY UserID";

            SqlParameter[] parameters = null;
            if (!string.IsNullOrEmpty(searchText))
            {
                parameters = new SqlParameter[]
                {
                    new SqlParameter("@Search", "%" + searchText + "%")
                };
            }

            DataTable dt = DatabaseHelper.GetData(query, parameters);
            dgUsers.ItemsSource = dt.DefaultView;
            txtRecordCount.Text = string.Format("عدد المستخدمين: {0}", dt.Rows.Count);
        }

        private void LoadEmployees()
        {
            DataTable dt = DatabaseHelper.GetData(
                "SELECT EmployeeID, EmployeeName FROM tblEmployees WHERE IsActive = 1 ORDER BY EmployeeName");

            // إضافة خيار فارغ
            DataRow emptyRow = dt.NewRow();
            emptyRow["EmployeeID"] = DBNull.Value;
            emptyRow["EmployeeName"] = "-- بدون ربط --";
            dt.Rows.InsertAt(emptyRow, 0);

            cmbEmployee.ItemsSource = dt.DefaultView;
        }

        // ═══════════════════════════════════════
        // أحداث الأزرار
        // ═══════════════════════════════════════

        private void BtnNew_Click(object sender, RoutedEventArgs e)
        {
            ClearForm();
        }

        private void BtnSave_Click(object sender, RoutedEventArgs e)
        {
            if (!ValidateForm()) return;

            try
            {
                if (_isEditMode)
                {
                    UpdateUser();
                }
                else
                {
                    InsertUser();
                }

                LoadUsers();
                ClearForm();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الحفظ:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void BtnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedUserID == 0)
            {
                MessageBox.Show("الرجاء اختيار مستخدم أولاً",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            // لا يمكن حذف المستخدم الحالي
            if (_selectedUserID == CurrentUser.UserID)
            {
                MessageBox.Show("لا يمكنك حذف حسابك الحالي!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            MessageBoxResult result = MessageBox.Show(
                "هل أنت متأكد من حذف هذا المستخدم؟",
                "تأكيد الحذف", MessageBoxButton.YesNo, MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                try
                {
                    // حذف الصلاحيات أولاً
                    DatabaseHelper.ExecuteNonQuery(
                        "DELETE FROM tblUserPermissions WHERE UserID = @UserID",
                        new SqlParameter[] { new SqlParameter("@UserID", _selectedUserID) });

                    // حذف المستخدم (أو تعطيله)
                    DatabaseHelper.ExecuteNonQuery(
                        "UPDATE tblUsers SET IsActive = 0 WHERE UserID = @UserID",
                        new SqlParameter[] { new SqlParameter("@UserID", _selectedUserID) });

                    AuditLogHelper.LogDelete("tblUsers", _selectedUserID,
                        "حذف مستخدم: " + txtUsername.Text);

                    MessageBox.Show("تم تعطيل المستخدم بنجاح",
                        "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                    LoadUsers();
                    ClearForm();
                }
                catch (Exception ex)
                {
                    MessageBox.Show("خطأ في الحذف:\n" + ex.Message,
                        "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private void BtnPermissions_Click(object sender, RoutedEventArgs e)
        {
            if (_selectedUserID == 0)
            {
                MessageBox.Show("الرجاء اختيار مستخدم أولاً",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            PermissionsDialog dlg = new PermissionsDialog(_selectedUserID, txtFullName.Text);
            dlg.Owner = this;
            dlg.ShowDialog();
        }

        // ═══════════════════════════════════════
        // أحداث الجدول والبحث
        // ═══════════════════════════════════════

        private void DgUsers_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgUsers.SelectedItem == null) return;

            DataRowView row = dgUsers.SelectedItem as DataRowView;
            if (row == null) return;

            _selectedUserID = Convert.ToInt32(row["UserID"]);
            _isEditMode = true;

            txtUsername.Text = row["Username"].ToString();
            txtFullName.Text = row["FullName"].ToString();
            txtDepartment.Text = row["Department"] != DBNull.Value ?
                row["Department"].ToString() : "";
            txtEmail.Text = row["Email"] != DBNull.Value ?
                row["Email"].ToString() : "";
            txtPhone.Text = row["Phone"] != DBNull.Value ?
                row["Phone"].ToString() : "";
            chkIsActive.IsChecked = Convert.ToBoolean(row["IsActive"]);

            // تحديد الدور
            string role = row["UserRole"].ToString();
            for (int i = 0; i < cmbRole.Items.Count; i++)
            {
                ComboBoxItem item = cmbRole.Items[i] as ComboBoxItem;
                if (item != null && item.Content.ToString() == role)
                {
                    cmbRole.SelectedIndex = i;
                    break;
                }
            }

            // تحديد الموظف
            if (row["EmployeeID"] != DBNull.Value)
            {
                cmbEmployee.SelectedValue = Convert.ToInt32(row["EmployeeID"]);
            }
            else
            {
                cmbEmployee.SelectedIndex = 0;
            }

            // مسح حقول كلمة المرور (للأمان)
            txtPassword.Clear();
            txtConfirmPassword.Clear();

            // تعطيل تعديل اسم المستخدم في وضع التعديل
            txtUsername.IsEnabled = false;
        }

        private void TxtSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            LoadUsers(txtSearch.Text.Trim());
        }

        // ═══════════════════════════════════════
        // العمليات
        // ═══════════════════════════════════════

        private void InsertUser()
        {
            // التحقق من عدم تكرار اسم المستخدم
            object exists = DatabaseHelper.ExecuteScalar(
                "SELECT COUNT(*) FROM tblUsers WHERE Username = @Username",
                new SqlParameter[] { new SqlParameter("@Username", txtUsername.Text.Trim()) });

            if (Convert.ToInt32(exists) > 0)
            {
                MessageBox.Show("اسم المستخدم موجود مسبقاً!",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string hashedPassword = SecurityHelper.HashPassword(txtPassword.Password);

            string query = @"INSERT INTO tblUsers 
                (Username, PasswordHash, FullName, UserRole, EmployeeID, 
                 Department, Email, Phone, IsActive, CreatedDate, CreatedBy)
                VALUES 
                (@Username, @PasswordHash, @FullName, @UserRole, @EmployeeID,
                 @Department, @Email, @Phone, @IsActive, GETDATE(), @CreatedBy)";

            SqlParameter[] parameters = GetFormParameters(hashedPassword);

            int newId = DatabaseHelper.ExecuteInsertAndGetID(query + "; SELECT SCOPE_IDENTITY();",
                parameters);

            // إنشاء صلاحيات افتراضية
            CreateDefaultPermissions(newId);

            AuditLogHelper.LogInsert("tblUsers", newId,
                "إضافة مستخدم: " + txtUsername.Text.Trim());

            MessageBox.Show("تم إضافة المستخدم بنجاح",
                "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void UpdateUser()
        {
            string query = @"UPDATE tblUsers SET 
                FullName = @FullName, 
                UserRole = @UserRole, 
                EmployeeID = @EmployeeID,
                Department = @Department, 
                Email = @Email, 
                Phone = @Phone, 
                IsActive = @IsActive";

            // تحديث كلمة المرور فقط إذا تم إدخالها
            if (!string.IsNullOrEmpty(txtPassword.Password))
            {
                query += ", PasswordHash = @PasswordHash";
            }

            query += " WHERE UserID = @UserID";

            string hashedPassword = "";
            if (!string.IsNullOrEmpty(txtPassword.Password))
            {
                hashedPassword = SecurityHelper.HashPassword(txtPassword.Password);
            }

            SqlParameter[] parameters = GetFormParameters(hashedPassword);
            // إضافة UserID
            SqlParameter[] allParams = new SqlParameter[parameters.Length + 1];
            Array.Copy(parameters, allParams, parameters.Length);
            allParams[parameters.Length] = new SqlParameter("@UserID", _selectedUserID);

            DatabaseHelper.ExecuteNonQuery(query, allParams);

            AuditLogHelper.LogUpdate("tblUsers", _selectedUserID,
                null, "تعديل مستخدم: " + txtUsername.Text);

            MessageBox.Show("تم تحديث بيانات المستخدم بنجاح",
                "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private SqlParameter[] GetFormParameters(string hashedPassword)
        {
            ComboBoxItem selectedRole = cmbRole.SelectedItem as ComboBoxItem;
            string role = selectedRole != null ? selectedRole.Content.ToString() : "مستخدم";

            object employeeId = DBNull.Value;
            if (cmbEmployee.SelectedValue != null && cmbEmployee.SelectedIndex > 0)
            {
                employeeId = cmbEmployee.SelectedValue;
            }

            return new SqlParameter[]
            {
                new SqlParameter("@Username", txtUsername.Text.Trim()),
                new SqlParameter("@PasswordHash",
                    string.IsNullOrEmpty(hashedPassword) ? (object)DBNull.Value : hashedPassword),
                new SqlParameter("@FullName", txtFullName.Text.Trim()),
                new SqlParameter("@UserRole", role),
                new SqlParameter("@EmployeeID", employeeId),
                new SqlParameter("@Department",
                    string.IsNullOrEmpty(txtDepartment.Text.Trim()) ?
                    (object)DBNull.Value : txtDepartment.Text.Trim()),
                new SqlParameter("@Email",
                    string.IsNullOrEmpty(txtEmail.Text.Trim()) ?
                    (object)DBNull.Value : txtEmail.Text.Trim()),
                new SqlParameter("@Phone",
                    string.IsNullOrEmpty(txtPhone.Text.Trim()) ?
                    (object)DBNull.Value : txtPhone.Text.Trim()),
                new SqlParameter("@IsActive", chkIsActive.IsChecked == true),
                new SqlParameter("@CreatedBy", CurrentUser.Username)
            };
        }

        private void CreateDefaultPermissions(int userId)
        {
            var modules = PermissionHelper.GetSystemModules();

            foreach (var module in modules)
            {
                string query = @"INSERT INTO tblUserPermissions
            (UserID, ModuleName, CanView, CanAdd, CanEdit, CanDelete, CanPrint)
            VALUES (@UserID, @Module, 0, 0, 0, 0, 0)";

                DatabaseHelper.ExecuteNonQuery(query, new SqlParameter[]
                {
            new SqlParameter("@UserID", userId),
            new SqlParameter("@Module", module.Key)
                });
            }
        }

        // ═══════════════════════════════════════
        // التحقق والمساعدات
        // ═══════════════════════════════════════

        private bool ValidateForm()
        {
            if (string.IsNullOrEmpty(txtUsername.Text.Trim()))
            {
                MessageBox.Show("الرجاء إدخال اسم المستخدم",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtUsername.Focus();
                return false;
            }

            if (string.IsNullOrEmpty(txtFullName.Text.Trim()))
            {
                MessageBox.Show("الرجاء إدخال الاسم الكامل",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtFullName.Focus();
                return false;
            }

            // كلمة المرور مطلوبة فقط عند الإضافة الجديدة
            if (!_isEditMode)
            {
                if (string.IsNullOrEmpty(txtPassword.Password))
                {
                    MessageBox.Show("الرجاء إدخال كلمة المرور",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                    txtPassword.Focus();
                    return false;
                }
            }

            // التأكد من تطابق كلمتي المرور
            if (!string.IsNullOrEmpty(txtPassword.Password))
            {
                if (txtPassword.Password != txtConfirmPassword.Password)
                {
                    MessageBox.Show("كلمتا المرور غير متطابقتين!",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                    txtConfirmPassword.Focus();
                    return false;
                }

                if (txtPassword.Password.Length < 6)
                {
                    MessageBox.Show("كلمة المرور يجب أن تكون 6 أحرف على الأقل",
                        "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                    txtPassword.Focus();
                    return false;
                }
            }

            if (cmbRole.SelectedIndex < 0)
            {
                MessageBox.Show("الرجاء اختيار الدور",
                    "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return false;
            }

            return true;
        }

        private void ClearForm()
        {
            _selectedUserID = 0;
            _isEditMode = false;

            txtUsername.Text = "";
            txtPassword.Clear();
            txtConfirmPassword.Clear();
            txtFullName.Text = "";
            cmbRole.SelectedIndex = 2; // مستخدم
            cmbEmployee.SelectedIndex = 0;
            txtDepartment.Text = "";
            txtEmail.Text = "";
            txtPhone.Text = "";
            chkIsActive.IsChecked = true;

            txtUsername.IsEnabled = true;
            txtUsername.Focus();

            dgUsers.SelectedItem = null;
        }
    }
}