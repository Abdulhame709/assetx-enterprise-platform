using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using AssetManagement.Helpers;
using Microsoft.Win32;

namespace AssetManagement.Views
{
    public partial class AssetsReportForm : Window
    {
        private DataTable _rawData;
        private DataTable _displayData;
        private DataTable _detailData;       // ✅ بيانات التقرير التفصيلي
        private bool _isLoading = false;
        private int _selectedSubLocationID = 0;
        private string _selectedSubLocationName = "";

        public AssetsReportForm()
        {
            InitializeComponent();
            _isLoading = true;
            LoadAllFilters();
            _isLoading = false;
        }

        // ═══════════════════════════════════════
        //  تحميل الفلاتر
        // ═══════════════════════════════════════
        private void LoadAllFilters()
        {
            try
            {
                LoadCombo(cmbFilterMainLoc, "MainLocationID",
                    "MainLocationName",
                    @"SELECT MainLocationID, MainLocationName 
              FROM tblMainLocations WHERE IsActive=1 
              ORDER BY MainLocationName");

                // ✅ تغيير إلى الأنواع الفرعية
                LoadCombo(cmbFilterType, "SubTypeID",
                    "SubTypeName",
                    @"SELECT st.SubTypeID, 
                     st.SubTypeName + ' (' + ISNULL(t.AssetTypeName,'') + ')' AS SubTypeName
              FROM tblSubTypeAssets st
              LEFT JOIN tblAssetTypes t ON st.AssetTypeID = t.AssetTypeID
              WHERE st.IsActive=1 
              ORDER BY st.SubTypeName");

                LoadCombo(cmbFilterStatus, "StatusID",
                    "StatusName",
                    @"SELECT StatusID, StatusName 
              FROM tblStatus WHERE IsActive=1 
              ORDER BY StatusName");

                LoadCombo(cmbFilterEmployee, "EmployeeID",
                    "DisplayName",
                    @"SELECT EmployeeID, 
              EmployeeName + ISNULL(' - '+Department,'') AS DisplayName 
              FROM tblEmployees WHERE IsActive=1 
              ORDER BY EmployeeName");

                LoadCombo(cmbFilterModel, "ModelID",
                    "ModelName",
                    @"SELECT ModelID, ModelName 
              FROM tblAssetModels WHERE IsActive=1 
              ORDER BY ModelName");
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ: " + ex.Message);
            }
        }

        private void LoadCombo(ComboBox cmb, string idCol,
            string nameCol, string query)
        {
            DataTable dt = DatabaseHelper.GetData(query);
            DataRow r = dt.NewRow();
            r[idCol] = 0;
            r[nameCol] = "-- الكل --";
            dt.Rows.InsertAt(r, 0);
            cmb.ItemsSource = dt.DefaultView;
            cmb.SelectedIndex = 0;
        }

        private int CV(ComboBox c)
        {
            if (c.SelectedValue == null) return 0;
            int v = 0;
            int.TryParse(c.SelectedValue.ToString(), out v);
            return v;
        }

        // ═══════════════════════════════════════
        //  المواقع الهرمية
        // ═══════════════════════════════════════
        private void cmbFilterMainLoc_SelectionChanged(
            object sender, SelectionChangedEventArgs e)
        {
            if (_isLoading) return;
            tvSubLocations.Items.Clear();
            tvSubLocations.IsEnabled = false;
            _selectedSubLocationID = 0;
            _selectedSubLocationName = "";
            btnClearSubLoc.Visibility = Visibility.Collapsed;
            pnlSelectedLocation.Visibility = Visibility.Collapsed;

            int id = CV(cmbFilterMainLoc);
            if (id <= 0) return;

            try
            {
                DataTable dt = DatabaseHelper.GetData(
                    @"SELECT SubLocationID, SubLocationName, 
                             ParentSubLocationID, LevelNumber
                      FROM tblSubLocations 
                      WHERE MainLocationID=@ID AND IsActive=1
                      ORDER BY LevelNumber, SubLocationName",
                    new SqlParameter[] { new SqlParameter("@ID", id) });

                if (dt.Rows.Count > 0)
                {
                    TreeViewItem allItem = new TreeViewItem();
                    allItem.Header = "📁 كل المواقع الفرعية";
                    allItem.Tag = 0;
                    allItem.FontWeight = FontWeights.Bold;
                    allItem.Foreground =
                        System.Windows.Media.Brushes.Gray;
                    allItem.IsExpanded = true;
                    tvSubLocations.Items.Add(allItem);
                    BuildTree(dt, tvSubLocations.Items, null);
                    tvSubLocations.IsEnabled = true;
                }
            }
            catch { }
        }

        private void BuildTree(DataTable dt, ItemCollection parent,
            object parentID)
        {
            string filter = parentID == null
                ? "ParentSubLocationID IS NULL"
                : "ParentSubLocationID=" + parentID;

            foreach (DataRow row in dt.Select(filter))
            {
                int id = Convert.ToInt32(row["SubLocationID"]);
                int lv = row["LevelNumber"] != DBNull.Value
                    ? Convert.ToInt32(row["LevelNumber"]) : 1;
                string icon = lv == 1 ? "🏢"
                    : lv == 2 ? "🏠"
                    : lv == 3 ? "🚪" : "📍";

                TreeViewItem item = new TreeViewItem();
                item.Header = icon + " " + row["SubLocationName"];
                item.Tag = id;
                item.IsExpanded = true;
                parent.Add(item);
                BuildTree(dt, item.Items, id);
            }
        }

        private void tvSubLocations_SelectedItemChanged(
            object sender,
            RoutedPropertyChangedEventArgs<object> e)
        {
            TreeViewItem sel =
                tvSubLocations.SelectedItem as TreeViewItem;
            if (sel == null) return;

            int id = 0;
            if (sel.Tag != null)
                int.TryParse(sel.Tag.ToString(), out id);
            _selectedSubLocationID = id;

            if (id > 0)
            {
                string h = sel.Header.ToString();
                _selectedSubLocationName =
                    h.Length > 2 ? h.Substring(2).Trim() : h;
                int cc = CountChildren(sel);
                pnlSelectedLocation.Visibility = Visibility.Visible;
                txtSelectedLocationInfo.Text = cc > 0
                    ? string.Format("📍 {0} (يشمل {1} فرعي)",
                        _selectedSubLocationName, cc)
                    : "📍 " + _selectedSubLocationName;
                btnClearSubLoc.Visibility = Visibility.Visible;
            }
            else
            {
                _selectedSubLocationName = "";
                pnlSelectedLocation.Visibility = Visibility.Collapsed;
                btnClearSubLoc.Visibility = Visibility.Collapsed;
            }
        }

        private int CountChildren(TreeViewItem item)
        {
            int c = 0;
            foreach (object child in item.Items)
            {
                TreeViewItem t = child as TreeViewItem;
                if (t != null) { c++; c += CountChildren(t); }
            }
            return c;
        }

        private void txtSearchSubLoc_TextChanged(
            object sender, TextChangedEventArgs e)
        {
            string s = txtSearchSubLoc.Text.Trim();
            txtSearchSubLocHint.Visibility =
                string.IsNullOrEmpty(s)
                    ? Visibility.Visible : Visibility.Collapsed;
            foreach (object item in tvSubLocations.Items)
            {
                TreeViewItem t = item as TreeViewItem;
                if (t != null) FilterTree(t, s);
            }
        }

        private bool FilterTree(TreeViewItem item, string search)
        {
            if (string.IsNullOrEmpty(search))
            {
                item.Visibility = Visibility.Visible;
                foreach (object c in item.Items)
                {
                    TreeViewItem t = c as TreeViewItem;
                    if (t != null) FilterTree(t, search);
                }
                return true;
            }

            bool cv = false;
            foreach (object c in item.Items)
            {
                TreeViewItem t = c as TreeViewItem;
                if (t != null && FilterTree(t, search)) cv = true;
            }
            bool m = item.Header.ToString().Contains(search);
            item.Visibility = (m || cv)
                ? Visibility.Visible : Visibility.Collapsed;
            if (m || cv) item.IsExpanded = true;
            return m || cv;
        }

        private void btnClearSubLoc_Click(
            object sender, RoutedEventArgs e)
        {
            _selectedSubLocationID = 0;
            _selectedSubLocationName = "";
            pnlSelectedLocation.Visibility = Visibility.Collapsed;
            btnClearSubLoc.Visibility = Visibility.Collapsed;
            ClearSel(tvSubLocations);
        }

        private void ClearSel(ItemsControl p)
        {
            foreach (object i in p.Items)
            {
                TreeViewItem t = i as TreeViewItem;
                if (t != null) { t.IsSelected = false; ClearSel(t); }
            }
        }

        private string GetChildIDs(int parentID)
        {
            try
            {
                DataTable dt = DatabaseHelper.GetData(
                    @";WITH T AS (
                        SELECT SubLocationID FROM tblSubLocations 
                        WHERE SubLocationID=@P
                        UNION ALL
                        SELECT c.SubLocationID FROM tblSubLocations c 
                        INNER JOIN T p 
                            ON c.ParentSubLocationID=p.SubLocationID)
                      SELECT SubLocationID FROM T",
                    new SqlParameter[] {
                        new SqlParameter("@P", parentID) });
                List<string> ids = new List<string>();
                foreach (DataRow r in dt.Rows) ids.Add(r[0].ToString());
                return string.Join(",", ids);
            }
            catch { return parentID.ToString(); }
        }

        // ═══════════════════════════════════════
        //  إنشاء التقرير
        // ═══════════════════════════════════════
        private void btnGenerateReport_Click(
            object sender, RoutedEventArgs e)
        {
            try
            {
                txtStatus.Text = "⏳ جارٍ إنشاء التقرير...";

                string where = BuildWhere();
                List<SqlParameter> pars = BuildParams();
                string groupTag = GetGroupTag();
                List<GroupCol> cols = GetGroupColumns(groupTag);

                if (cols.Count == 0)
                    GenerateDetailReport(where, pars);
                else
                    GenerateGroupedReport(where, pars, cols);

                // ✅ إنشاء التقرير التفصيلي (جميع الأعمدة)
                GenerateFullDetailReport(where, pars);

                UpdateStats();
                txtStatus.Text = string.Format(
                    "✅ {0} سجل | {1}",
                    _displayData != null
                        ? _displayData.Rows.Count : 0,
                    DateTime.Now.ToString("hh:mm:ss tt"));
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message);
                txtStatus.Text = "❌ خطأ";
            }
        }

        private string GetGroupTag()
        {
            ComboBoxItem s =
                cmbGroupField.SelectedItem as ComboBoxItem;
            return (s != null && s.Tag != null)
                ? s.Tag.ToString() : "";
        }

        // ═══════════════════════════════════════
        //  ✅ تقرير تفصيلي (مخصص)
        //  الترتيب: كود → اسم → كمية → ...
        // ═══════════════════════════════════════
        private void GenerateDetailReport(string where,
            List<SqlParameter> pars)
        {
            List<string> sc = new List<string>();

            sc.Add("a.FullAssetCode AS [الكود]");
            sc.Add("a.AssetName AS [اسم الأصل]");
            sc.Add("a.Quantity AS [الكمية]");
            sc.Add("ISNULL(t.AssetTypeName,'-') AS [النوع]");

            if (chkColSubType.IsChecked == true)
                sc.Add("ISNULL(st.SubTypeName,'-') AS [النوع الفرعي]");

            sc.Add("ISNULL(ml.MainLocationName,'-') AS [الموقع]");

            if (chkColSubLoc.IsChecked == true)
                sc.Add("ISNULL(sl.SubLocationName,'-') AS [الموقع الفرعي]");

            sc.Add("ISNULL(s.StatusName,'-') AS [الحالة]");

            if (chkColEmployee.IsChecked == true)
                sc.Add("ISNULL(e.EmployeeName,'-') AS [الموظف]");
            if (chkColModel.IsChecked == true)
                sc.Add("ISNULL(mo.ModelName,'-') AS [الموديل]");
            if (chkColPrice.IsChecked == true)
                sc.Add("ISNULL(a.PurchasePrice,0) AS [سعر الشراء]");
            if (chkColDate.IsChecked == true)
                sc.Add("CONVERT(VARCHAR(10),a.PurchaseDate,120) AS [تاريخ الشراء]");
            if (chkColNotes.IsChecked == true)
                sc.Add("ISNULL(a.Notes,'-') AS [الملاحظات]");

            string q = "SELECT " + string.Join(", ", sc) +
                @" FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID=t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID=st.SubTypeID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID=ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID=sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID=s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID=e.EmployeeID
                LEFT JOIN tblAssetModels mo ON a.ModelID=mo.ModelID
                WHERE " + where + " ORDER BY a.AssetName";

            _rawData = DatabaseHelper.GetData(q,
                pars.Count > 0 ? pars.ToArray() : null);
            _displayData = _rawData;
            dgReport.AutoGenerateColumns = true;
            dgReport.ItemsSource = _displayData.DefaultView;
            txtResultCount.Text = _displayData.Rows.Count + " سجل";
        }

        // ═══════════════════════════════════════
        //  ✅ تقرير تفصيلي كامل (جميع الأعمدة)
        // ═══════════════════════════════════════
        private void GenerateFullDetailReport(string where,
            List<SqlParameter> pars)
        {
            try
            {
                // ✅ استعلام بجميع الأعمدة - الكمية بعد اسم الأصل مباشرة
                string q = @"SELECT 
                    a.FullAssetCode AS [الكود],
                    a.AssetName AS [اسم الأصل],
                    a.Quantity AS [الكمية],
                    ISNULL(t.AssetTypeName,'-') AS [نوع الأصل],
                    ISNULL(st.SubTypeName,'-') AS [النوع الفرعي],
                    ISNULL(ml.MainLocationName,'-') AS [الموقع الرئيسي],
                    ISNULL(sl.SubLocationName,'-') AS [الموقع الفرعي],
                    ISNULL(s.StatusName,'-') AS [الحالة],
                    ISNULL(e.EmployeeName,'-') AS [الموظف],
                    ISNULL(mo.ModelName,'-') AS [الموديل],
                    ISNULL(a.PurchasePrice,0) AS [سعر الشراء],
                    CONVERT(VARCHAR(10),a.PurchaseDate,120) AS [تاريخ الشراء],
                    ISNULL(a.Barcode,'-') AS [الباركود],
                    ISNULL(a.SerialNumber,'-') AS [الرقم التسلسلي],
                    ISNULL(a.InventoryYear,0) AS [سنة الجرد],
                    ISNULL(a.Notes,'-') AS [الملاحظات]
                FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID=t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID=st.SubTypeID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID=ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID=sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID=s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID=e.EmployeeID
                LEFT JOIN tblAssetModels mo ON a.ModelID=mo.ModelID
                WHERE " + where + " ORDER BY a.AssetName";

                // ✅ استنساخ البارامترات
                List<SqlParameter> clonedPars = new List<SqlParameter>();
                foreach (SqlParameter p in pars)
                    clonedPars.Add(new SqlParameter(p.ParameterName, p.Value));

                _detailData = DatabaseHelper.GetData(q,
                    clonedPars.Count > 0 ? clonedPars.ToArray() : null);

                dgDetailReport.AutoGenerateColumns = true;
                dgDetailReport.ItemsSource = _detailData.DefaultView;
                txtDetailCount.Text = _detailData.Rows.Count + " سجل";
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في التقرير التفصيلي:\n" + ex.Message);
            }
        }

        // ═══════════════════════════════════════
        //  ✅ تقرير مجمّع
        // ═══════════════════════════════════════
        private void GenerateGroupedReport(string where,
            List<SqlParameter> pars, List<GroupCol> cols)
        {
            List<string> sel = new List<string>();
            List<string> grp = new List<string>();
            List<string> ord = new List<string>();

            foreach (GroupCol gc in cols)
            {
                sel.Add(gc.Source + " AS [" + gc.Alias + "]");
                grp.Add(gc.Source);
                ord.Add(gc.Source);
            }

            sel.Add("SUM(a.Quantity) AS [الكمية]");

            if (chkColPrice.IsChecked == true)
                sel.Add("SUM(ISNULL(a.PurchasePrice,0)) AS [إجمالي القيمة]");

            string q = "SELECT " + string.Join(", ", sel) +
                @" FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID=t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID=st.SubTypeID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID=ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID=sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID=s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID=e.EmployeeID
                LEFT JOIN tblAssetModels mo ON a.ModelID=mo.ModelID
                WHERE " + where +
                " GROUP BY " + string.Join(", ", grp) +
                " ORDER BY " + string.Join(", ", ord);

            List<SqlParameter> cl = new List<SqlParameter>();
            foreach (SqlParameter p in pars)
                cl.Add(new SqlParameter(p.ParameterName, p.Value));

            _rawData = DatabaseHelper.GetData(q,
                cl.Count > 0 ? cl.ToArray() : null);
            _displayData = _rawData.Copy();

            List<string> gcn = new List<string>();
            foreach (GroupCol gc in cols) gcn.Add(gc.Alias);
            ApplyVisualGrouping(_displayData, gcn);

            dgReport.AutoGenerateColumns = true;
            dgReport.ItemsSource = _displayData.DefaultView;
            txtResultCount.Text = _displayData.Rows.Count + " سجل";
        }

        private void ApplyVisualGrouping(DataTable dt,
            List<string> groupCols)
        {
            if (dt.Rows.Count <= 1) return;

            Dictionary<string, string> prev =
                new Dictionary<string, string>();
            foreach (string col in groupCols)
                if (dt.Columns.Contains(col)) prev[col] = "\x01";

            for (int r = 0; r < dt.Rows.Count; r++)
            {
                foreach (string col in groupCols)
                {
                    if (!dt.Columns.Contains(col)) continue;
                    string v = dt.Rows[r][col] != DBNull.Value
                        ? dt.Rows[r][col].ToString() : "-";
                    if (r == 0) prev[col] = v;
                    else
                    {
                        if (v == prev[col]) dt.Rows[r][col] = "";
                        else prev[col] = v;
                    }
                }
            }
        }

        // ═══════════════════════════════════════
        //  WHERE + Params
        // ═══════════════════════════════════════
        private string BuildWhere()
        {
            List<string> c = new List<string>();
            c.Add("a.IsActive=1");

            if (!string.IsNullOrWhiteSpace(txtFilterName.Text))
                c.Add("a.AssetName LIKE '%'+@N+'%'");
            if (CV(cmbFilterMainLoc) > 0)
                c.Add("a.MainLocationID=@ML");
            if (_selectedSubLocationID > 0)
            {
                string ids = GetChildIDs(_selectedSubLocationID);
                if (!string.IsNullOrEmpty(ids))
                    c.Add("a.SubLocationID IN(" + ids + ")");
            }
            // ✅ تغيير إلى SubTypeID
            if (CV(cmbFilterType) > 0) c.Add("a.SubTypeID=@T");
            if (CV(cmbFilterStatus) > 0) c.Add("a.StatusID=@S");
            if (CV(cmbFilterEmployee) > 0) c.Add("a.EmployeeID=@E");
            if (CV(cmbFilterModel) > 0) c.Add("a.ModelID=@M");

            decimal pf;
            if (!string.IsNullOrWhiteSpace(txtPriceFrom.Text)
                && decimal.TryParse(txtPriceFrom.Text, out pf))
                c.Add("ISNULL(a.PurchasePrice,0)>=@PF");

            decimal pt;
            if (!string.IsNullOrWhiteSpace(txtPriceTo.Text)
                && decimal.TryParse(txtPriceTo.Text, out pt))
                c.Add("ISNULL(a.PurchasePrice,0)<=@PT");

            if (dpDateFrom.SelectedDate.HasValue)
                c.Add("a.PurchaseDate>=@DF");
            if (dpDateTo.SelectedDate.HasValue)
                c.Add("a.PurchaseDate<=@DT");

            int iy;
            if (!string.IsNullOrWhiteSpace(txtInventoryYear.Text)
                && int.TryParse(txtInventoryYear.Text, out iy))
                c.Add("a.InventoryYear=@IY");

            if (!string.IsNullOrWhiteSpace(txtBarcode.Text))
                c.Add("(a.Barcode LIKE '%'+@BC+'%' OR a.SerialNumber LIKE '%'+@BC+'%')");

            return string.Join(" AND ", c);
        }

        private List<SqlParameter> BuildParams()
        {
            List<SqlParameter> p = new List<SqlParameter>();

            if (!string.IsNullOrWhiteSpace(txtFilterName.Text))
                p.Add(new SqlParameter("@N",
                    txtFilterName.Text.Trim()));
            if (CV(cmbFilterMainLoc) > 0)
                p.Add(new SqlParameter("@ML",
                    CV(cmbFilterMainLoc)));
            if (CV(cmbFilterType) > 0)
                p.Add(new SqlParameter("@T",
                    CV(cmbFilterType)));
            if (CV(cmbFilterStatus) > 0)
                p.Add(new SqlParameter("@S",
                    CV(cmbFilterStatus)));
            if (CV(cmbFilterEmployee) > 0)
                p.Add(new SqlParameter("@E",
                    CV(cmbFilterEmployee)));
            if (CV(cmbFilterModel) > 0)
                p.Add(new SqlParameter("@M",
                    CV(cmbFilterModel)));

            decimal pf;
            if (!string.IsNullOrWhiteSpace(txtPriceFrom.Text)
                && decimal.TryParse(txtPriceFrom.Text, out pf))
                p.Add(new SqlParameter("@PF", pf));

            decimal pt;
            if (!string.IsNullOrWhiteSpace(txtPriceTo.Text)
                && decimal.TryParse(txtPriceTo.Text, out pt))
                p.Add(new SqlParameter("@PT", pt));

            if (dpDateFrom.SelectedDate.HasValue)
                p.Add(new SqlParameter("@DF",
                    dpDateFrom.SelectedDate.Value));
            if (dpDateTo.SelectedDate.HasValue)
                p.Add(new SqlParameter("@DT",
                    dpDateTo.SelectedDate.Value));

            int iy;
            if (!string.IsNullOrWhiteSpace(txtInventoryYear.Text)
                && int.TryParse(txtInventoryYear.Text, out iy))
                p.Add(new SqlParameter("@IY", iy));

            if (!string.IsNullOrWhiteSpace(txtBarcode.Text))
                p.Add(new SqlParameter("@BC",
                    txtBarcode.Text.Trim()));

            return p;
        }

        // ═══════════════════════════════════════
        //  التجميع
        // ═══════════════════════════════════════
        private class GroupCol
        {
            public string Field, Alias, Source;
            public GroupCol(string f, string a, string s)
            { Field = f; Alias = a; Source = s; }
        }

        private List<GroupCol> GetGroupColumns(string primary)
        {
            List<GroupCol> cols = new List<GroupCol>();
            if (!string.IsNullOrEmpty(primary))
                cols.Add(new GroupCol(primary,
                    Alias(primary), Src(primary)));

            AddIf(cols, chkColAssetName, "AssetName", primary);
            AddIf(cols, chkColSubType, "SubTypeName", primary);
            AddIf(cols, chkColMainLoc, "MainLocationName", primary);
            AddIf(cols, chkColSubLoc, "SubLocationName", primary);
            AddIf(cols, chkColStatus, "StatusName", primary);
            AddIf(cols, chkColEmployee, "EmployeeName", primary);
            AddIf(cols, chkColModel, "ModelName", primary);
            return cols;
        }

        private void AddIf(List<GroupCol> cols, CheckBox chk,
            string field, string skip)
        {
            if (chk.IsChecked == true && field != skip)
            {
                foreach (GroupCol c in cols)
                    if (c.Field == field) return;
                cols.Add(new GroupCol(field,
                    Alias(field), Src(field)));
            }
        }

        private string Alias(string f)
        {
            switch (f)
            {
                case "AssetName": return "اسم الأصل";
                case "AssetTypeName": return "نوع الأصل";
                case "SubTypeName": return "النوع الفرعي";
                case "MainLocationName": return "الموقع الرئيسي";
                case "SubLocationName": return "الموقع الفرعي";
                case "StatusName": return "الحالة";
                case "EmployeeName": return "الموظف";
                case "ModelName": return "الموديل";
                default: return f;
            }
        }

        private string Src(string f)
        {
            switch (f)
            {
                case "AssetName": return "a.AssetName";
                case "AssetTypeName":
                    return "ISNULL(t.AssetTypeName,'-')";
                case "SubTypeName":
                    return "ISNULL(st.SubTypeName,'-')";
                case "MainLocationName":
                    return "ISNULL(ml.MainLocationName,'-')";
                case "SubLocationName":
                    return "ISNULL(sl.SubLocationName,'-')";
                case "StatusName":
                    return "ISNULL(s.StatusName,'-')";
                case "EmployeeName":
                    return "ISNULL(e.EmployeeName,'-')";
                case "ModelName":
                    return "ISNULL(mo.ModelName,'-')";
                default: return f;
            }
        }

        private List<string> GetSelectedGroupColumns(string primary)
        {
            List<GroupCol> cols = GetGroupColumns(primary);
            List<string> n = new List<string>();
            foreach (GroupCol c in cols) n.Add(c.Alias);
            return n;
        }

        // ═══════════════════════════════════════
        //  الإحصائيات
        // ═══════════════════════════════════════
        private void UpdateStats()
        {
            if (_rawData == null || _rawData.Rows.Count == 0)
            {
                txtSumCount.Text = "0";
                txtSumQty.Text = "0";
                txtSumValue.Text = "0";
                txtSumLocations.Text = "0";
                txtSumTypes.Text = "0";
                return;
            }

            int tq = 0;
            decimal tv = 0;
            HashSet<string> locs = new HashSet<string>();
            HashSet<string> typs = new HashSet<string>();

            foreach (DataRow r in _rawData.Rows)
            {
                foreach (DataColumn col in _rawData.Columns)
                {
                    string cn = col.ColumnName;

                    if (cn == "الكمية" && r[col] != DBNull.Value)
                    {
                        int v;
                        if (int.TryParse(r[col].ToString(), out v))
                            tq += v;
                    }

                    if ((cn.Contains("سعر") || cn.Contains("قيمة")
                        || cn.Contains("إجمالي"))
                        && r[col] != DBNull.Value)
                    {
                        decimal v;
                        if (decimal.TryParse(r[col].ToString(), out v))
                            tv += v;
                    }

                    if ((cn == "الموقع" || cn == "الموقع الرئيسي")
                        && r[col] != DBNull.Value)
                    {
                        string l = r[col].ToString().Trim();
                        if (l != "-" && l != "") locs.Add(l);
                    }

                    if ((cn == "النوع" || cn == "نوع الأصل")
                        && r[col] != DBNull.Value)
                    {
                        string t = r[col].ToString().Trim();
                        if (t != "-" && t != "") typs.Add(t);
                    }
                }
            }

            txtSumCount.Text = _rawData.Rows.Count.ToString("N0");
            txtSumQty.Text = tq.ToString("N0");
            txtSumValue.Text = tv.ToString("N2");
            txtSumLocations.Text = locs.Count.ToString();
            txtSumTypes.Text = typs.Count.ToString();
        }

        // ═══════════════════════════════════════
        //  بحث في النتائج (التقرير المخصص)
        // ═══════════════════════════════════════
        private void txtSearchResult_TextChanged(
            object sender, TextChangedEventArgs e)
        {
            if (_displayData == null) return;
            string s = txtSearchResult.Text.Trim();

            if (string.IsNullOrEmpty(s))
            {
                _displayData.DefaultView.RowFilter = "";
            }
            else
            {
                List<string> p = new List<string>();
                foreach (DataColumn col in _displayData.Columns)
                {
                    if (col.DataType == typeof(string))
                    {
                        p.Add(string.Format("[{0}] LIKE '%{1}%'",
                            col.ColumnName,
                            s.Replace("'", "''")));
                    }
                }
                if (p.Count > 0)
                    _displayData.DefaultView.RowFilter =
                        string.Join(" OR ", p);
            }
            txtResultCount.Text =
                _displayData.DefaultView.Count + " سجل";
        }

        // ═══════════════════════════════════════
        //  ✅ بحث في التقرير التفصيلي
        // ═══════════════════════════════════════
        private void txtSearchDetail_TextChanged(
            object sender, TextChangedEventArgs e)
        {
            if (_detailData == null) return;
            string s = txtSearchDetail.Text.Trim();

            if (string.IsNullOrEmpty(s))
            {
                _detailData.DefaultView.RowFilter = "";
            }
            else
            {
                List<string> p = new List<string>();
                foreach (DataColumn col in _detailData.Columns)
                {
                    if (col.DataType == typeof(string))
                    {
                        p.Add(string.Format("[{0}] LIKE '%{1}%'",
                            col.ColumnName,
                            s.Replace("'", "''")));
                    }
                }
                if (p.Count > 0)
                    _detailData.DefaultView.RowFilter =
                        string.Join(" OR ", p);
            }
            txtDetailCount.Text =
                _detailData.DefaultView.Count + " سجل";
        }

        // ═══════════════════════════════════════
        //  وصف الفلاتر
        // ═══════════════════════════════════════
        private string BuildFilterDescription()
        {
            List<string> p = new List<string>();

            if (!string.IsNullOrWhiteSpace(txtFilterName.Text))
                p.Add("الاسم: " + txtFilterName.Text.Trim());

            if (CV(cmbFilterMainLoc) > 0)
            {
                DataRowView d =
                    cmbFilterMainLoc.SelectedItem as DataRowView;
                if (d != null)
                    p.Add("الموقع: " + d["MainLocationName"]);
            }

            if (_selectedSubLocationID > 0)
                p.Add("الفرعي: " + _selectedSubLocationName
                    + " (وما تحته)");

            if (CV(cmbFilterType) > 0)
            {
                DataRowView d =
                    cmbFilterType.SelectedItem as DataRowView;
                if (d != null)
                    p.Add("النوع الفرعي: " + d["SubTypeName"]);
            }

            if (CV(cmbFilterStatus) > 0)
            {
                DataRowView d =
                    cmbFilterStatus.SelectedItem as DataRowView;
                if (d != null)
                    p.Add("الحالة: " + d["StatusName"]);
            }

            if (CV(cmbFilterEmployee) > 0)
            {
                DataRowView d =
                    cmbFilterEmployee.SelectedItem as DataRowView;
                if (d != null)
                    p.Add("الموظف: " + d["DisplayName"]);
            }

            if (CV(cmbFilterModel) > 0)
            {
                DataRowView d =
                    cmbFilterModel.SelectedItem as DataRowView;
                if (d != null)
                    p.Add("الموديل: " + d["ModelName"]);
            }

            if (!string.IsNullOrWhiteSpace(txtPriceFrom.Text))
                p.Add("السعر من: " + txtPriceFrom.Text);
            if (!string.IsNullOrWhiteSpace(txtPriceTo.Text))
                p.Add("السعر إلى: " + txtPriceTo.Text);
            if (dpDateFrom.SelectedDate.HasValue)
                p.Add("من: " + dpDateFrom.SelectedDate.Value
                    .ToString("yyyy/MM/dd"));
            if (dpDateTo.SelectedDate.HasValue)
                p.Add("إلى: " + dpDateTo.SelectedDate.Value
                    .ToString("yyyy/MM/dd"));

            return p.Count == 0 ? "جميع الأصول النشطة"
                : string.Join(" | ", p);
        }

        // ═══════════════════════════════════════
        //  معاينة وطباعة
        // ═══════════════════════════════════════
        // ═══════════════════════════════════════
        //  معاينة وطباعة
        // ═══════════════════════════════════════
        private void btnPrint_Click(
            object sender, RoutedEventArgs e)
        {
            try
            {
                if (_rawData == null || _rawData.Rows.Count == 0)
                {
                    MessageBox.Show(
                        "أنشئ التقرير أولاً.",
                        "تنبيه", MessageBoxButton.OK,
                        MessageBoxImage.Information);
                    return;
                }

                string groupTag = GetGroupTag();
                List<string> groupCols =
                    GetSelectedGroupColumns(groupTag);

                string subTitle = "";
                ComboBoxItem sel =
                    cmbGroupField.SelectedItem as ComboBoxItem;
                if (sel != null && !string.IsNullOrEmpty(groupTag))
                {
                    string content = sel.Content.ToString();
                    foreach (string ic in new[] {
                "📂 ", "📁 ", "🏢 ", "📍 ",
                "🔵 ", "👤 ", "📱 ", "📝 " })
                        content = content.Replace(ic, "");
                    subTitle = "تجميع حسب: " + content;
                }
                else
                    subTitle = "تقرير تفصيلي";

                ReportEngine engine = new ReportEngine();
                engine.ReportTitle = "تقرير الأصول الثابتة";
                engine.ReportSubTitle = subTitle;
                engine.FilterDescription =
                    BuildFilterDescription();
                engine.PrintedBy = "مدير النظام";

                // ✅ نمرر _displayData (التي فيها الإخفاء) بدلاً من _rawData
                // وأيضاً نمرر groupCols حتى يعرف ReportEngine أي أعمدة فيها تجميع
                FixedDocument doc =
                    engine.Generate(_displayData, groupCols);

                ReportPreviewWindow preview =
                    new ReportPreviewWindow();
                preview.Owner = this;
                preview.ReportTitle = engine.ReportTitle;
                preview.CompanyName = engine.CompanyName;
                preview.FilterDescription =
                    engine.FilterDescription;
                preview.PrintedBy = engine.PrintedBy;
                // ✅ نمرر _displayData للمعاينة أيضاً
                preview.LoadReport(doc, _displayData);
                preview.ShowDialog();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message);
            }
        }

        // ═══════════════════════════════════════
        //  تصدير
        // ═══════════════════════════════════════
        private void btnExport_Click(
            object sender, RoutedEventArgs e)
        {
            try
            {
                if (_rawData == null || _rawData.Rows.Count == 0)
                {
                    MessageBox.Show("أنشئ التقرير أولاً.");
                    return;
                }

                SaveFileDialog dlg = new SaveFileDialog();
                dlg.FileName = "تقرير_الأصول_"
                    + DateTime.Now.ToString("yyyyMMdd_HHmm");
                dlg.Filter =
                    "Excel (*.xls)|*.xls|CSV (*.csv)|*.csv";

                if (dlg.ShowDialog() == true)
                {
                    string ext = System.IO.Path
                        .GetExtension(dlg.FileName).ToLower();

                    if (ext == ".xls")
                    {
                        ExcelExporter exp = new ExcelExporter();
                        exp.ReportTitle = "تقرير الأصول الثابتة";
                        exp.FilterDescription =
                            BuildFilterDescription();

                        if (exp.Export(_rawData, dlg.FileName))
                        {
                            if (MessageBox.Show(
                                "✅ تم!\nفتح الملف؟",
                                "تم", MessageBoxButton.YesNo,
                                MessageBoxImage.Information)
                                == MessageBoxResult.Yes)
                                System.Diagnostics.Process.Start(
                                    dlg.FileName);
                        }
                    }
                    else
                    {
                        System.Text.StringBuilder sb =
                            new System.Text.StringBuilder();

                        List<string> h = new List<string>();
                        foreach (DataColumn c in _rawData.Columns)
                            h.Add("\"" + c.ColumnName + "\"");
                        sb.AppendLine(string.Join(",", h));

                        foreach (DataRow r in _rawData.Rows)
                        {
                            List<string> v = new List<string>();
                            foreach (DataColumn c in _rawData.Columns)
                            {
                                string s = r[c] != DBNull.Value
                                    ? r[c].ToString() : "";
                                v.Add("\"" + s.Replace("\"", "\"\"")
                                    + "\"");
                            }
                            sb.AppendLine(string.Join(",", v));
                        }

                        System.IO.File.WriteAllText(dlg.FileName,
                            sb.ToString(),
                            new System.Text.UTF8Encoding(true));

                        if (MessageBox.Show(
                            "✅ تم!\nفتح الملف؟",
                            "تم", MessageBoxButton.YesNo)
                            == MessageBoxResult.Yes)
                            System.Diagnostics.Process.Start(
                                dlg.FileName);
                    }
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message);
            }
        }

        // ═══════════════════════════════════════
        //  إعادة تعيين
        // ═══════════════════════════════════════
        private void btnReset_Click(
            object sender, RoutedEventArgs e)
        {
            _isLoading = true;

            txtFilterName.Text = "";
            cmbFilterMainLoc.SelectedIndex = 0;
            tvSubLocations.Items.Clear();
            tvSubLocations.IsEnabled = false;
            _selectedSubLocationID = 0;
            _selectedSubLocationName = "";
            btnClearSubLoc.Visibility = Visibility.Collapsed;
            pnlSelectedLocation.Visibility = Visibility.Collapsed;
            txtSearchSubLoc.Text = "";

            cmbFilterType.SelectedIndex = 0;
            cmbFilterStatus.SelectedIndex = 0;
            cmbFilterEmployee.SelectedIndex = 0;
            cmbFilterModel.SelectedIndex = 0;

            txtPriceFrom.Text = "";
            txtPriceTo.Text = "";
            dpDateFrom.SelectedDate = null;
            dpDateTo.SelectedDate = null;
            txtInventoryYear.Text = "";
            txtBarcode.Text = "";

            cmbGroupField.SelectedIndex = 0;

            chkColAssetName.IsChecked = true;
            chkColSubType.IsChecked = false;
            chkColMainLoc.IsChecked = false;
            chkColSubLoc.IsChecked = false;
            chkColStatus.IsChecked = false;
            chkColEmployee.IsChecked = false;
            chkColModel.IsChecked = false;
            chkColPrice.IsChecked = false;
            chkColDate.IsChecked = false;
            chkColNotes.IsChecked = false;

            txtSearchResult.Text = "";
            txtSearchDetail.Text = "";
            _isLoading = false;

            dgReport.ItemsSource = null;
            dgDetailReport.ItemsSource = null;
            _rawData = null;
            _displayData = null;
            _detailData = null;

            txtSumCount.Text = "0";
            txtSumQty.Text = "0";
            txtSumValue.Text = "0";
            txtSumLocations.Text = "0";
            txtSumTypes.Text = "0";
            txtResultCount.Text = "0 سجل";
            txtDetailCount.Text = "0 سجل";
            txtStatus.Text = "🔄 تم إعادة التعيين";

            // ✅ العودة للتبويب الأول
            tcReportView.SelectedIndex = 0;
        }
    }
}