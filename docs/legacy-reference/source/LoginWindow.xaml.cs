using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Input;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    public partial class LoginWindow : Window
    {
        private int _loginAttempts = 0;
        private const int MAX_ATTEMPTS = 5;

        public LoginWindow()
        {
            InitializeComponent();
            txtUsername.Focus();

            // اختبار الاتصال بقاعدة البيانات عند بدء التشغيل
            string error;
            if (!DatabaseHelper.TestConnection(out error))
            {
                MessageBox.Show(
                    "فشل الاتصال بقاعدة البيانات!\n\n" + error +
                    "\n\nتأكد من أن SQL Server يعمل.",
                    "خطأ في الاتصال",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// زر تسجيل الدخول
        /// </summary>
        private void BtnLogin_Click(object sender, RoutedEventArgs e)
        {
            PerformLogin();
        }

        /// <summary>
        /// الضغط على Enter في حقل كلمة المرور
        /// </summary>
        private void TxtPassword_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                PerformLogin();
            }
        }

        /// <summary>
        /// تنفيذ عملية تسجيل الدخول
        /// </summary>
        private void PerformLogin()
        {
            HideError();

            // التحقق من عدد المحاولات
            if (_loginAttempts >= MAX_ATTEMPTS)
            {
                ShowError("تم تجاوز الحد الأقصى لمحاولات الدخول.\nالرجاء الانتظار أو التواصل مع مدير النظام.");
                btnLogin.IsEnabled = false;
                return;
            }

            string username = txtUsername.Text.Trim();
            string password = txtPassword.Password;

            // التحقق من الحقول الفارغة
            if (string.IsNullOrEmpty(username))
            {
                ShowError("الرجاء إدخال اسم المستخدم");
                txtUsername.Focus();
                return;
            }

            if (string.IsNullOrEmpty(password))
            {
                ShowError("الرجاء إدخال كلمة المرور");
                txtPassword.Focus();
                return;
            }

            try
            {
                progressLogin.Visibility = Visibility.Visible;
                btnLogin.IsEnabled = false;

                // البحث عن المستخدم
                string query = @"SELECT UserID, Username, PasswordHash, FullName, 
                                       UserRole, EmployeeID, Department, Email, IsActive 
                                FROM tblUsers 
                                WHERE Username = @Username";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@Username", username)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                if (dt.Rows.Count == 0)
                {
                    _loginAttempts++;
                    ShowError(string.Format("اسم المستخدم غير صحيح\n(المحاولة {0} من {1})",
                        _loginAttempts, MAX_ATTEMPTS));
                    txtUsername.Focus();
                    txtUsername.SelectAll();
                    return;
                }

                DataRow user = dt.Rows[0];

                // التحقق من أن الحساب نشط
                if (!Convert.ToBoolean(user["IsActive"]))
                {
                    ShowError("هذا الحساب معطل.\nتواصل مع مدير النظام لتفعيله.");
                    return;
                }

                // التحقق من كلمة المرور
                string storedHash = user["PasswordHash"].ToString();
                string inputHash = SecurityHelper.HashPassword(password);
                bool passwordValid = false;

                if (string.Equals(storedHash, inputHash, StringComparison.OrdinalIgnoreCase))
                {
                    // كلمة المرور المشفرة مطابقة
                    passwordValid = true;
                }
                else if (storedHash == password)
                {
                    // كلمة المرور بنص عادي (قديمة) - نقوم بتحديثها تلقائياً
                    passwordValid = true;
                    string updateQuery = "UPDATE tblUsers SET PasswordHash = @Hash WHERE UserID = @UserID";
                    DatabaseHelper.ExecuteNonQuery(updateQuery, new SqlParameter[]
                    {
                        new SqlParameter("@Hash", inputHash),
                        new SqlParameter("@UserID", Convert.ToInt32(user["UserID"]))
                    });
                }

                if (!passwordValid)
                {
                    _loginAttempts++;
                    ShowError(string.Format("كلمة المرور غير صحيحة\n(المحاولة {0} من {1})",
                        _loginAttempts, MAX_ATTEMPTS));
                    txtPassword.Clear();
                    txtPassword.Focus();
                    return;
                }

                // ═══ تسجيل الدخول ناجح ═══

                // تعبئة بيانات المستخدم الحالي
                CurrentUser.UserID = Convert.ToInt32(user["UserID"]);
                CurrentUser.Username = user["Username"].ToString();
                CurrentUser.FullName = user["FullName"].ToString();
                CurrentUser.UserRole = user["UserRole"].ToString();
                CurrentUser.LoginTime = DateTime.Now;

                if (user["EmployeeID"] != DBNull.Value)
                    CurrentUser.EmployeeID = Convert.ToInt32(user["EmployeeID"]);
                if (user["Department"] != DBNull.Value)
                    CurrentUser.Department = user["Department"].ToString();
                if (user["Email"] != DBNull.Value)
                    CurrentUser.Email = user["Email"].ToString();

                // تحميل الصلاحيات
                CurrentUser.LoadPermissions();

                // تحديث آخر دخول
                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tblUsers SET LastLogin = GETDATE() WHERE UserID = @UserID",
                    new SqlParameter[] { new SqlParameter("@UserID", CurrentUser.UserID) });

                // تسجيل الدخول في سجل التدقيق
                AuditLogHelper.LogLogin(CurrentUser.Username);

                // فتح النافذة الرئيسية
                MainWindow mainWindow = new MainWindow();
                mainWindow.Show();
                this.Close();
            }
            catch (Exception ex)
            {
                ShowError("خطأ في الاتصال:\n" + ex.Message);
            }
            finally
            {
                progressLogin.Visibility = Visibility.Collapsed;
                btnLogin.IsEnabled = true;
            }
        }

        /// <summary>
        /// عرض رسالة خطأ
        /// </summary>
        private void ShowError(string message)
        {
            txtError.Text = message;
            borderError.Visibility = Visibility.Visible;
        }

        /// <summary>
        /// إخفاء رسالة الخطأ
        /// </summary>
        private void HideError()
        {
            borderError.Visibility = Visibility.Collapsed;
        }

        /// <summary>
        /// إغلاق التطبيق
        /// </summary>
        private void BtnClose_Click(object sender, RoutedEventArgs e)
        {
            Application.Current.Shutdown();
        }

        /// <summary>
        /// السماح بسحب النافذة
        /// </summary>
        protected override void OnMouseLeftButtonDown(MouseButtonEventArgs e)
        {
            base.OnMouseLeftButtonDown(e);
            if (e.ButtonState == MouseButtonState.Pressed)
            {
                DragMove();
            }
        }
    }
}