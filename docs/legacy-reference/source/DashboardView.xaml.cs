using System;
using System.Collections.Generic;
using System.Data;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    public partial class DashboardView : UserControl
    {
        public DashboardView()
        {
            InitializeComponent();
        }

        private void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            LoadDashboardData();
        }

        /// <summary>
        /// تحميل جميع بيانات لوحة المعلومات
        /// </summary>
        public void LoadDashboardData()
        {
            try
            {
                txtWelcome.Text = string.Format("مرحباً {0}  |  {1}",
                    CurrentUser.FullName, DateTime.Now.ToString("dddd، dd MMMM yyyy"));

                LoadSummaryCards();
                LoadInventoryCycleInfo();
                LoadRecentMovements();
                LoadAssetsByType();
                LoadAssetsByStatus();
                LoadRecentAudit();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل لوحة المعلومات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }

        /// <summary>
        /// تحميل البطاقات الإحصائية
        /// </summary>
        private void LoadSummaryCards()
        {
            // إجمالي الأصول
            object total = DatabaseHelper.ExecuteScalar(
                "SELECT COUNT(*) FROM tblAssets WHERE IsActive = 1");
            txtTotalAssets.Text = Convert.ToInt32(total).ToString("N0");

            // الأصول النشطة (جديد أو جيد أو مستعمل)
            object active = DatabaseHelper.ExecuteScalar(
                @"SELECT COUNT(*) FROM tblAssets a 
                  INNER JOIN tblStatus s ON a.StatusID = s.StatusID
                  WHERE a.IsActive = 1 
                  AND s.StatusName IN (N'جديد', N'جيد', N'مستعمل')");
            txtActiveAssets.Text = Convert.ToInt32(active).ToString("N0");

            // تحتاج صيانة
            object maint = DatabaseHelper.ExecuteScalar(
                @"SELECT COUNT(*) FROM tblAssets a 
                  INNER JOIN tblStatus s ON a.StatusID = s.StatusID
                  WHERE a.IsActive = 1 
                  AND s.StatusName IN (N'يحتاج صيانة', N'تحت الصيانة')");
            txtMaintenanceAssets.Text = Convert.ToInt32(maint).ToString("N0");

            // تالفة ومفقودة
            object damaged = DatabaseHelper.ExecuteScalar(
                @"SELECT COUNT(*) FROM tblAssets a 
                  INNER JOIN tblStatus s ON a.StatusID = s.StatusID
                  WHERE a.IsActive = 1 
                  AND s.StatusName IN (N'تالف', N'مفقود', N'مُستغنى عنه')");
            txtDamagedAssets.Text = Convert.ToInt32(damaged).ToString("N0");

            // إجمالي القيمة
            object totalValue = DatabaseHelper.ExecuteScalar(
                "SELECT ISNULL(SUM(PurchasePrice * Quantity), 0) FROM tblAssets WHERE IsActive = 1");
            decimal value = Convert.ToDecimal(totalValue);
            if (value >= 1000000)
                txtTotalValue.Text = string.Format("{0:N1}M", value / 1000000);
            else if (value >= 1000)
                txtTotalValue.Text = string.Format("{0:N1}K", value / 1000);
            else
                txtTotalValue.Text = value.ToString("N0");
        }

        /// <summary>
        /// تحميل معلومات دورة الجرد الحالية
        /// </summary>
        private void LoadInventoryCycleInfo()
        {
            DataTable dt = DatabaseHelper.GetData(
                @"SELECT TOP 1 c.CycleID, c.CycleName, c.CycleStatus, c.CycleYear,
                         (SELECT COUNT(*) FROM tblInventoryRecords WHERE CycleID = c.CycleID) AS TotalRecords,
                         (SELECT COUNT(*) FROM tblInventoryRecords 
                          WHERE CycleID = c.CycleID AND InventoryResult <> N'لم يُجرد') AS Inventoried,
                         (SELECT COUNT(*) FROM tblInventoryRecords 
                          WHERE CycleID = c.CycleID 
                          AND InventoryResult IN (N'عجز', N'مفقود', N'زيادة')) AS Issues
                  FROM tblInventoryCycles c
                  WHERE c.CycleStatus IN (N'جديدة', N'قيد التنفيذ')
                  ORDER BY c.CycleYear DESC");

            if (dt.Rows.Count > 0)
            {
                DataRow row = dt.Rows[0];
                panelNoCycle.Visibility = Visibility.Collapsed;
                panelCycleInfo.Visibility = Visibility.Visible;

                txtCycleName.Text = row["CycleName"].ToString();
                txtCycleStatus.Text = row["CycleStatus"].ToString();

                int totalRecords = Convert.ToInt32(row["TotalRecords"]);
                int inventoried = Convert.ToInt32(row["Inventoried"]);
                int issues = Convert.ToInt32(row["Issues"]);
                int notInventoried = totalRecords - inventoried;

                double percentage = totalRecords > 0 ?
                    (double)inventoried / totalRecords * 100 : 0;

                txtCycleProgress.Text = string.Format("{0:F1}%", percentage);
                progressCycle.Value = percentage;
                txtInventoried.Text = inventoried.ToString();
                txtNotInventoried.Text = notInventoried.ToString();
                txtIssues.Text = issues.ToString();
            }
            else
            {
                panelNoCycle.Visibility = Visibility.Visible;
                panelCycleInfo.Visibility = Visibility.Collapsed;
            }
        }

        /// <summary>
        /// تحميل آخر الحركات
        /// </summary>
        private void LoadRecentMovements()
        {
            DataTable dt = DatabaseHelper.GetData(
                @"SELECT TOP 8 m.MovementDate, a.AssetName, m.MovementType
                  FROM tblAssetMovements m
                  INNER JOIN tblAssets a ON m.AssetID = a.AssetID
                  ORDER BY m.MovementDate DESC");

            if (dt.Rows.Count > 0)
            {
                dgRecentMovements.ItemsSource = dt.DefaultView;
                dgRecentMovements.Visibility = Visibility.Visible;
                txtNoMovements.Visibility = Visibility.Collapsed;
            }
            else
            {
                dgRecentMovements.Visibility = Visibility.Collapsed;
                txtNoMovements.Visibility = Visibility.Visible;
            }
        }

        /// <summary>
        /// تحميل الأصول حسب النوع
        /// </summary>
        private void LoadAssetsByType()
        {
            DataTable dt = DatabaseHelper.GetData(
                @"SELECT t.AssetTypeName AS TypeName, COUNT(a.AssetID) AS AssetCount
                  FROM tblAssetTypes t
                  LEFT JOIN tblAssets a ON t.AssetTypeID = a.AssetTypeID AND a.IsActive = 1
                  WHERE t.IsActive = 1
                  GROUP BY t.AssetTypeName
                  ORDER BY AssetCount DESC");

            int maxCount = 0;
            if (dt.Rows.Count > 0)
            {
                maxCount = Convert.ToInt32(dt.Rows[0]["AssetCount"]);
                if (maxCount == 0) maxCount = 1;
            }

            string[] colors = { "#2196F3", "#4CAF50", "#FF9800", "#9C27B0",
                               "#F44336", "#00BCD4", "#795548", "#607D8B" };

            List<object> items = new List<object>();
            for (int i = 0; i < dt.Rows.Count && i < 8; i++)
            {
                DataRow row = dt.Rows[i];
                int count = Convert.ToInt32(row["AssetCount"]);
                items.Add(new
                {
                    TypeName = row["TypeName"].ToString(),
                    Count = count,
                    Percentage = (double)count / maxCount * 100,
                    Color = new BrushConverter().ConvertFromString(
                        colors[i % colors.Length]) as Brush
                });
            }
            icAssetsByType.ItemsSource = items;
        }

        /// <summary>
        /// تحميل الأصول حسب الحالة
        /// </summary>
        private void LoadAssetsByStatus()
        {
            DataTable dt = DatabaseHelper.GetData(
                @"SELECT s.StatusName, s.StatusColor, COUNT(a.AssetID) AS AssetCount
                  FROM tblStatus s
                  LEFT JOIN tblAssets a ON s.StatusID = a.StatusID AND a.IsActive = 1
                  WHERE s.IsActive = 1
                  GROUP BY s.StatusName, s.StatusColor
                  ORDER BY AssetCount DESC");

            List<object> items = new List<object>();
            foreach (DataRow row in dt.Rows)
            {
                string colorStr = row["StatusColor"].ToString();
                if (string.IsNullOrEmpty(colorStr)) colorStr = "#757575";

                Brush colorBrush;
                try
                {
                    colorBrush = new BrushConverter().ConvertFromString(colorStr) as Brush;
                }
                catch
                {
                    colorBrush = Brushes.Gray;
                }

                items.Add(new
                {
                    StatusName = row["StatusName"].ToString(),
                    Count = Convert.ToInt32(row["AssetCount"]),
                    Color = colorBrush
                });
            }
            icAssetsByStatus.ItemsSource = items;
        }

        /// <summary>
        /// تحميل آخر سجلات التدقيق
        /// </summary>
        private void LoadRecentAudit()
        {
            DataTable dt = DatabaseHelper.GetData(
                @"SELECT TOP 10 al.ActionDate, 
                         ISNULL(u.FullName, N'النظام') AS FullName,
                         al.ActionType, al.NewValues
                  FROM tblAuditLog al
                  LEFT JOIN tblUsers u ON al.UserID = u.UserID
                  ORDER BY al.ActionDate DESC");

            dgRecentAudit.ItemsSource = dt.DefaultView;
        }
    }
}