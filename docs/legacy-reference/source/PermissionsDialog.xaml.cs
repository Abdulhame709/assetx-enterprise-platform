using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Windows;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    /// <summary>
    /// كلاس بيانات الصلاحية للربط مع DataGrid
    /// </summary>
    public class PermissionItem : INotifyPropertyChanged
    {
        public string ModuleName { get; set; }
        public string ModuleArabic { get; set; }

        private bool _canView;
        public bool CanView
        {
            get { return _canView; }
            set { _canView = value; OnPropertyChanged("CanView"); }
        }

        private bool _canAdd;
        public bool CanAdd
        {
            get { return _canAdd; }
            set { _canAdd = value; OnPropertyChanged("CanAdd"); }
        }

        private bool _canEdit;
        public bool CanEdit
        {
            get { return _canEdit; }
            set { _canEdit = value; OnPropertyChanged("CanEdit"); }
        }

        private bool _canDelete;
        public bool CanDelete
        {
            get { return _canDelete; }
            set { _canDelete = value; OnPropertyChanged("CanDelete"); }
        }

        private bool _canPrint;
        public bool CanPrint
        {
            get { return _canPrint; }
            set { _canPrint = value; OnPropertyChanged("CanPrint"); }
        }

        public event PropertyChangedEventHandler PropertyChanged;
        protected void OnPropertyChanged(string name)
        {
            if (PropertyChanged != null)
                PropertyChanged(this, new PropertyChangedEventArgs(name));
        }
    }

    public partial class PermissionsDialog : Window
    {
        private readonly int _userId;
        private readonly string _userFullName;
        private List<PermissionItem> _permissions;

        public PermissionsDialog(int userId, string userFullName)
        {
            InitializeComponent();
            _userId = userId;
            _userFullName = userFullName;
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            txtUserInfo.Text = string.Format("صلاحيات المستخدم: {0}", _userFullName);
            LoadPermissions();
        }

        private void LoadPermissions()
        {
            _permissions = new List<PermissionItem>();

            Dictionary<string, string> modules = PermissionHelper.GetSystemModules();

            DataTable dt = DatabaseHelper.GetData(
                "SELECT * FROM tblUserPermissions WHERE UserID = @UserID",
                new SqlParameter[] { new SqlParameter("@UserID", _userId) });

            foreach (var module in modules)
            {
                PermissionItem item = new PermissionItem
                {
                    ModuleName = module.Key,
                    ModuleArabic = module.Value,
                    CanView = false,
                    CanAdd = false,
                    CanEdit = false,
                    CanDelete = false,
                    CanPrint = false
                };

                DataRow row = dt.AsEnumerable()
                    .FirstOrDefault(r => r["ModuleName"].ToString() == module.Key);

                if (row != null)
                {
                    item.CanView = row["CanView"] != DBNull.Value && Convert.ToBoolean(row["CanView"]);
                    item.CanAdd = row["CanAdd"] != DBNull.Value && Convert.ToBoolean(row["CanAdd"]);
                    item.CanEdit = row["CanEdit"] != DBNull.Value && Convert.ToBoolean(row["CanEdit"]);
                    item.CanDelete = row["CanDelete"] != DBNull.Value && Convert.ToBoolean(row["CanDelete"]);
                    item.CanPrint = row["CanPrint"] != DBNull.Value && Convert.ToBoolean(row["CanPrint"]);
                }

                _permissions.Add(item);
            }

            dgPermissions.ItemsSource = _permissions;
        }

        private void BtnSave_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                DatabaseHelper.ExecuteNonQuery(
                    "DELETE FROM tblUserPermissions WHERE UserID = @UserID",
                    new SqlParameter[] { new SqlParameter("@UserID", _userId) });

                foreach (PermissionItem item in _permissions)
                {
                    string query = @"INSERT INTO tblUserPermissions
                                     (UserID, ModuleName, CanView, CanAdd, CanEdit, CanDelete, CanPrint)
                                     VALUES
                                     (@UserID, @ModuleName, @CanView, @CanAdd, @CanEdit, @CanDelete, @CanPrint)";

                    DatabaseHelper.ExecuteNonQuery(query, new SqlParameter[]
                    {
                        new SqlParameter("@UserID", _userId),
                        new SqlParameter("@ModuleName", item.ModuleName),
                        new SqlParameter("@CanView", item.CanView),
                        new SqlParameter("@CanAdd", item.CanAdd),
                        new SqlParameter("@CanEdit", item.CanEdit),
                        new SqlParameter("@CanDelete", item.CanDelete),
                        new SqlParameter("@CanPrint", item.CanPrint)
                    });
                }

                AuditLogHelper.LogUpdate("tblUserPermissions", _userId,
                    null, "تحديث صلاحيات المستخدم: " + _userFullName);

                MessageBox.Show("تم حفظ الصلاحيات بنجاح",
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                this.DialogResult = true;
                this.Close();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في حفظ الصلاحيات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void BtnSelectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (PermissionItem item in _permissions)
            {
                item.CanView = true;
                item.CanAdd = true;
                item.CanEdit = true;
                item.CanDelete = true;
                item.CanPrint = true;
            }

            dgPermissions.Items.Refresh();
        }

        private void BtnDeselectAll_Click(object sender, RoutedEventArgs e)
        {
            foreach (PermissionItem item in _permissions)
            {
                item.CanView = false;
                item.CanAdd = false;
                item.CanEdit = false;
                item.CanDelete = false;
                item.CanPrint = false;
            }

            dgPermissions.Items.Refresh();
        }

        private void BtnCancel_Click(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}