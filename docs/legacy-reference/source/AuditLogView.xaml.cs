using System;
using System.Data;
using System.Data.SqlClient;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    public partial class AuditLogView : UserControl
    {
        public AuditLogView()
        {
            InitializeComponent();
        }

        private void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            // تحديد الفترة الافتراضية: آخر شهر
            dpFrom.SelectedDate = DateTime.Today.AddMonths(-1);
            dpTo.SelectedDate = DateTime.Today;

            LoadUsers();
            LoadAuditLog();
        }

        private void LoadUsers()
        {
            DataTable dt = DatabaseHelper.GetData(
                "SELECT UserID, FullName FROM tblUsers ORDER BY FullName");

            DataRow allRow = dt.NewRow();
            allRow["UserID"] = 0;
            allRow["FullName"] = "الكل";
            dt.Rows.InsertAt(allRow, 0);

            cmbUser.ItemsSource = dt.DefaultView;
            cmbUser.SelectedIndex = 0;
        }

        private void LoadAuditLog()
        {
            try
            {
                StringBuilder query = new StringBuilder();
                query.Append(@"SELECT al.AuditID, al.ActionDate, 
                              ISNULL(u.FullName, N'النظام') AS FullName,
                              al.ActionType, al.TableName, al.RecordID,
                              al.OldValues, al.NewValues, al.Workstation
                          FROM tblAuditLog al
                          LEFT JOIN tblUsers u ON al.UserID = u.UserID
                          WHERE 1=1");

                var paramList = new System.Collections.Generic.List<SqlParameter>();

                // فلتر التاريخ
                if (dpFrom.SelectedDate.HasValue)
                {
                    query.Append(" AND al.ActionDate >= @FromDate");
                    paramList.Add(new SqlParameter("@FromDate", dpFrom.SelectedDate.Value));
                }
                if (dpTo.SelectedDate.HasValue)
                {
                    query.Append(" AND al.ActionDate < @ToDate");
                    paramList.Add(new SqlParameter("@ToDate",
                        dpTo.SelectedDate.Value.AddDays(1)));
                }

                // فلتر نوع العملية
                ComboBoxItem selectedAction = cmbActionType.SelectedItem as ComboBoxItem;
                if (selectedAction != null && selectedAction.Content.ToString() != "الكل")
                {
                    query.Append(" AND al.ActionType = @ActionType");
                    paramList.Add(new SqlParameter("@ActionType",
                        selectedAction.Content.ToString()));
                }

                // فلتر المستخدم
                if (cmbUser.SelectedValue != null &&
                    Convert.ToInt32(cmbUser.SelectedValue) > 0)
                {
                    query.Append(" AND al.UserID = @UserID");
                    paramList.Add(new SqlParameter("@UserID", cmbUser.SelectedValue));
                }

                // بحث نصي
                if (!string.IsNullOrEmpty(txtSearchAudit.Text.Trim()))
                {
                    query.Append(@" AND (al.OldValues LIKE @Search 
                                   OR al.NewValues LIKE @Search 
                                   OR al.TableName LIKE @Search)");
                    paramList.Add(new SqlParameter("@Search",
                        "%" + txtSearchAudit.Text.Trim() + "%"));
                }

                query.Append(" ORDER BY al.ActionDate DESC");

                DataTable dt = DatabaseHelper.GetData(query.ToString(),
                    paramList.Count > 0 ? paramList.ToArray() : null);

                dgAuditLog.ItemsSource = dt.DefaultView;
                txtAuditCount.Text = string.Format("عدد السجلات: {0}", dt.Rows.Count);
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل سجل التدقيق:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        private void BtnSearch_Click(object sender, RoutedEventArgs e)
        {
            LoadAuditLog();
        }

        private void BtnRefresh_Click(object sender, RoutedEventArgs e)
        {
            dpFrom.SelectedDate = DateTime.Today.AddMonths(-1);
            dpTo.SelectedDate = DateTime.Today;
            cmbActionType.SelectedIndex = 0;
            cmbUser.SelectedIndex = 0;
            txtSearchAudit.Text = "";
            LoadAuditLog();
        }
    }
}