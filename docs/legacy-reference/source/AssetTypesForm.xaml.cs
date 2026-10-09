using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة مدمجة لإدارة أنواع الأصول الرئيسية والفرعية
    /// القسم العلوي: إضافة/تعديل/حذف الأنواع الرئيسية (tblAssetTypes)
    /// القسم السفلي: إدارة الأنواع الفرعية الهرمية (tblSubTypeAssets)
    /// </summary>
    public partial class AssetTypesForm : Window
    {
        private bool isNewSubType = false;
        private bool isEditSubType = false;
        private bool isLoadingData = false;
        private bool isEditingMainType = false; // لتعديل النوع الرئيسي

        public AssetTypesForm()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadMainTypes();
            BuildTree();
            SetReadMode();
        }

        // ╔══════════════════════════════════════════════════════╗
        // ║     القسم 1: إدارة الأنواع الرئيسية                 ║
        // ╚══════════════════════════════════════════════════════╝

        /// <summary>
        /// تحميل الأنواع الرئيسية في القوائم
        /// </summary>
        private void LoadMainTypes()
        {
            try
            {
                string query = @"
                    SELECT AssetTypeID, 
                           AssetTypeCode + ' - ' + AssetTypeName AS DisplayText,
                           AssetTypeName, AssetTypeCode
                    FROM tblAssetTypes 
                    WHERE IsActive = 1 
                    ORDER BY CASE WHEN ISNUMERIC(AssetTypeCode) = 1 
                                  THEN CAST(AssetTypeCode AS INT) ELSE 99999 END";

                DataTable dt = DatabaseHelper.GetData(query);
                cmbMainType.ItemsSource = dt.DefaultView;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل الأنواع الرئيسية:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// توليد كود تلقائي للنوع الرئيسي
        /// </summary>
        private int GenerateMainTypeCode()
        {
            try
            {
                DataTable dt = DatabaseHelper.GetData(@"
                    SELECT CAST(AssetTypeCode AS INT) AS CodeNum 
                    FROM tblAssetTypes WHERE ISNUMERIC(AssetTypeCode) = 1 
                    ORDER BY CodeNum");

                if (dt.Rows.Count == 0) return 1;

                int expected = 1;
                foreach (DataRow row in dt.Rows)
                {
                    if (Convert.ToInt32(row["CodeNum"]) != expected) return expected;
                    expected++;
                }
                return expected;
            }
            catch { return 1; }
        }

        /// <summary>
        /// زر إضافة نوع رئيسي جديد
        /// </summary>
        private void btnAddMainType_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(txtMainTypeName.Text))
            {
                // تحضير للإضافة
                isEditingMainType = false;
                txtMainTypeID.Text = "";
                txtMainTypeName.Text = "";
                int nextCode = GenerateMainTypeCode();
                txtMainTypeCode.Text = nextCode.ToString();
                txtMainTypeName.Focus();
                txtFormStatus.Text = "أدخل اسم النوع الرئيسي ثم اضغط ➕ مرة أخرى";
                return;
            }

            // تنفيذ الإضافة
            try
            {
                // التحقق من التكرار
                int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetTypes WHERE AssetTypeName = @Name",
                    new SqlParameter[] { new SqlParameter("@Name", txtMainTypeName.Text.Trim()) }));

                if (exists > 0)
                {
                    MessageBox.Show("اسم النوع موجود مسبقاً!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // التحقق من الكود
                int codeExists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetTypes WHERE AssetTypeCode = @Code",
                    new SqlParameter[] { new SqlParameter("@Code", txtMainTypeCode.Text.Trim()) }));

                if (codeExists > 0)
                    txtMainTypeCode.Text = GenerateMainTypeCode().ToString();

                DatabaseHelper.ExecuteNonQuery(@"
                    INSERT INTO tblAssetTypes (AssetTypeCode, AssetTypeName, IsActive, CreatedDate) 
                    VALUES (@Code, @Name, 1, GETDATE())",
                    new SqlParameter[] {
                        new SqlParameter("@Code", txtMainTypeCode.Text.Trim()),
                        new SqlParameter("@Name", txtMainTypeName.Text.Trim())
                    });

                txtFormStatus.Text = "✅ تم إضافة النوع الرئيسي: " + txtMainTypeName.Text;
                MessageBox.Show("تم إضافة النوع الرئيسي بنجاح!\nالكود: " + txtMainTypeCode.Text,
                    "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                txtMainTypeName.Text = "";
                txtMainTypeCode.Text = "";
                txtMainTypeID.Text = "";
                isEditingMainType = false;
                btnEditMainType.IsEnabled = false;
                btnDeleteMainType.IsEnabled = false;

                LoadMainTypes();
                BuildTree();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// زر تعديل النوع الرئيسي
        /// </summary>
        private void btnEditMainType_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(txtMainTypeID.Text))
            {
                MessageBox.Show("اختر نوعاً رئيسياً من الشجرة أولاً!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (!isEditingMainType)
            {
                // تفعيل وضع التعديل
                isEditingMainType = true;
                txtMainTypeName.Focus();
                txtFormStatus.Text = "عدّل الاسم ثم اضغط ✏️ مرة أخرى للحفظ";
                return;
            }

            // حفظ التعديل
            try
            {
                if (string.IsNullOrWhiteSpace(txtMainTypeName.Text))
                {
                    MessageBox.Show("أدخل الاسم!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                int typeID = Convert.ToInt32(txtMainTypeID.Text);

                int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssetTypes WHERE AssetTypeName = @Name AND AssetTypeID <> @ID",
                    new SqlParameter[] {
                        new SqlParameter("@Name", txtMainTypeName.Text.Trim()),
                        new SqlParameter("@ID", typeID)
                    }));

                if (exists > 0)
                {
                    MessageBox.Show("الاسم موجود مسبقاً!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tblAssetTypes SET AssetTypeName = @Name, ModifiedDate = GETDATE() WHERE AssetTypeID = @ID",
                    new SqlParameter[] {
                        new SqlParameter("@Name", txtMainTypeName.Text.Trim()),
                        new SqlParameter("@ID", typeID)
                    });

                txtFormStatus.Text = "✅ تم تحديث النوع الرئيسي";
                isEditingMainType = false;
                LoadMainTypes();
                BuildTree();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// زر حذف النوع الرئيسي
        /// </summary>
        private void btnDeleteMainType_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrEmpty(txtMainTypeID.Text))
            {
                MessageBox.Show("اختر نوعاً رئيسياً أولاً!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                int typeID = Convert.ToInt32(txtMainTypeID.Text);

                // التحقق من الأنواع الفرعية
                int subCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblSubTypeAssets WHERE AssetTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", typeID) }));

                if (subCount > 0)
                {
                    MessageBox.Show("لا يمكن الحذف!\n\nيحتوي على " + subCount + " نوع فرعي.\nاحذف الفرعيات أولاً.",
                        "لا يمكن الحذف", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // التحقق من الأصول
                int assetCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssets WHERE AssetTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", typeID) }));

                if (assetCount > 0)
                {
                    MessageBox.Show("لا يمكن الحذف!\n\nمستخدم في " + assetCount + " أصل.",
                        "لا يمكن الحذف", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                MessageBoxResult result = MessageBox.Show(
                    "حذف النوع الرئيسي: " + txtMainTypeName.Text + "؟",
                    "تأكيد", MessageBoxButton.YesNo, MessageBoxImage.Warning);

                if (result != MessageBoxResult.Yes) return;

                DatabaseHelper.ExecuteNonQuery(
                    "DELETE FROM tblAssetTypes WHERE AssetTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", typeID) });

                txtFormStatus.Text = "✅ تم حذف النوع الرئيسي";
                txtMainTypeName.Text = "";
                txtMainTypeCode.Text = "";
                txtMainTypeID.Text = "";
                btnEditMainType.IsEnabled = false;
                btnDeleteMainType.IsEnabled = false;

                LoadMainTypes();
                BuildTree();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ╔══════════════════════════════════════════════════════╗
        // ║     القسم 2: بناء الشجرة الهرمية                    ║
        // ╚══════════════════════════════════════════════════════╝

        private void BuildTree()
        {
            try
            {
                treeTypes.Items.Clear();

                DataTable mainTypes = DatabaseHelper.GetData(@"
                    SELECT AssetTypeID, AssetTypeCode, AssetTypeName 
                    FROM tblAssetTypes WHERE IsActive = 1
                    ORDER BY CASE WHEN ISNUMERIC(AssetTypeCode) = 1 
                                  THEN CAST(AssetTypeCode AS INT) ELSE 99999 END");

                foreach (DataRow mainRow in mainTypes.Rows)
                {
                    int typeID = Convert.ToInt32(mainRow["AssetTypeID"]);
                    string code = mainRow["AssetTypeCode"].ToString();
                    string name = mainRow["AssetTypeName"].ToString();

                    TreeViewItem mainItem = new TreeViewItem();
                    mainItem.Header = "📁 " + code + " - " + name;
                    mainItem.Tag = "MAIN_" + typeID;
                    mainItem.IsExpanded = true;
                    mainItem.FontWeight = FontWeights.Bold;

                    AddSubTypeNodes(mainItem, typeID, 0);
                    treeTypes.Items.Add(mainItem);
                }

                txtFormStatus.Text = "تم تحميل الشجرة - " + mainTypes.Rows.Count + " نوع رئيسي";
            }
            catch (Exception ex)
            {
                txtFormStatus.Text = "خطأ في بناء الشجرة: " + ex.Message;
            }
        }

        private void AddSubTypeNodes(TreeViewItem parentItem, int assetTypeID, int parentSubTypeID)
        {
            string query;
            SqlParameter[] parameters;

            if (parentSubTypeID == 0)
            {
                query = @"SELECT SubTypeID, SubTypeCode, SubTypeName, LevelNumber, IsActive
                          FROM tblSubTypeAssets
                          WHERE AssetTypeID = @TypeID 
                            AND (ParentSubTypeID IS NULL OR ParentSubTypeID = 0)
                          ORDER BY SubTypeCode";
                parameters = new SqlParameter[] { new SqlParameter("@TypeID", assetTypeID) };
            }
            else
            {
                query = @"SELECT SubTypeID, SubTypeCode, SubTypeName, LevelNumber, IsActive
                          FROM tblSubTypeAssets
                          WHERE ParentSubTypeID = @ParentID
                          ORDER BY SubTypeCode";
                parameters = new SqlParameter[] { new SqlParameter("@ParentID", parentSubTypeID) };
            }

            DataTable dt = DatabaseHelper.GetData(query, parameters);

            foreach (DataRow row in dt.Rows)
            {
                int subID = Convert.ToInt32(row["SubTypeID"]);
                string code = row["SubTypeCode"] != DBNull.Value ? row["SubTypeCode"].ToString() : "";
                string name = row["SubTypeName"].ToString();
                int level = row["LevelNumber"] != DBNull.Value ? Convert.ToInt32(row["LevelNumber"]) : 1;
                bool isActive = Convert.ToBoolean(row["IsActive"]);

                TreeViewItem childItem = new TreeViewItem();
                string icon = level == 1 ? "📂" : "📄";
                string activeText = isActive ? "" : " ⛔";
                childItem.Header = icon + " " + code + " - " + name + activeText;
                childItem.Tag = "SUB_" + subID;
                childItem.IsExpanded = true;
                childItem.FontWeight = FontWeights.Normal;

                AddSubTypeNodes(childItem, assetTypeID, subID);
                parentItem.Items.Add(childItem);
            }
        }

        /// <summary>
        /// عند اختيار عنصر من الشجرة
        /// </summary>
        private void treeTypes_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            if (isEditSubType || isNewSubType) return;

            TreeViewItem selected = treeTypes.SelectedItem as TreeViewItem;
            if (selected == null) return;

            string tag = selected.Tag as string;
            if (tag == null) return;

            if (tag.StartsWith("MAIN_"))
            {
                // اختار نوع رئيسي
                int typeID = int.Parse(tag.Replace("MAIN_", ""));
                DataTable dt = DatabaseHelper.GetData(
                    "SELECT AssetTypeID, AssetTypeCode, AssetTypeName FROM tblAssetTypes WHERE AssetTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", typeID) });

                if (dt.Rows.Count > 0)
                {
                    txtMainTypeID.Text = dt.Rows[0]["AssetTypeID"].ToString();
                    txtMainTypeCode.Text = dt.Rows[0]["AssetTypeCode"].ToString();
                    txtMainTypeName.Text = dt.Rows[0]["AssetTypeName"].ToString();
                    btnEditMainType.IsEnabled = true;
                    btnDeleteMainType.IsEnabled = true;
                    isEditingMainType = false;

                    // تحميل الفرعيات لهذا النوع
                    LoadSubTypesGrid(typeID);
                    txtGridTitle.Text = "📋 الأنواع الفرعية لـ: " + dt.Rows[0]["AssetTypeName"].ToString();
                }
            }
            else if (tag.StartsWith("SUB_"))
            {
                // اختار نوع فرعي - حدده في الجدول
                int subID = int.Parse(tag.Replace("SUB_", ""));
                foreach (var item in dgSubTypes.Items)
                {
                    DataRowView row = item as DataRowView;
                    if (row != null && Convert.ToInt32(row["SubTypeID"]) == subID)
                    {
                        dgSubTypes.SelectedItem = item;
                        dgSubTypes.ScrollIntoView(item);
                        break;
                    }
                }
            }
        }

        // ╔══════════════════════════════════════════════════════╗
        // ║     القسم 3: إدارة الأنواع الفرعية                  ║
        // ╚══════════════════════════════════════════════════════╝

        private void LoadSubTypesGrid(int assetTypeID)
        {
            try
            {
                DataTable dt = DatabaseHelper.GetData(@"
                    SELECT SubTypeID, SubTypeCode, SubTypeName, FullPath, LevelNumber, IsActive
                    FROM tblSubTypeAssets
                    WHERE AssetTypeID = @TypeID
                    ORDER BY LevelNumber, SubTypeCode",
                    new SqlParameter[] { new SqlParameter("@TypeID", assetTypeID) });

                dgSubTypes.ItemsSource = dt.DefaultView;
                txtRecordCount.Text = "عدد الفرعيات: " + dt.Rows.Count;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void LoadParentSubTypes(int assetTypeID, int excludeID = 0)
        {
            try
            {
                isLoadingData = true;
                string query = @"
                    SELECT SubTypeID, SubTypeCode + ' - ' + SubTypeName AS DisplayText
                    FROM tblSubTypeAssets 
                    WHERE AssetTypeID = @TypeID AND IsActive = 1";

                if (excludeID > 0) query += " AND SubTypeID <> @ExID";
                query += " ORDER BY LevelNumber, SubTypeCode";

                SqlParameter[] parms = excludeID > 0
                    ? new SqlParameter[] { new SqlParameter("@TypeID", assetTypeID), new SqlParameter("@ExID", excludeID) }
                    : new SqlParameter[] { new SqlParameter("@TypeID", assetTypeID) };

                cmbParentSubType.ItemsSource = DatabaseHelper.GetData(query, parms).DefaultView;
                cmbParentSubType.SelectedValue = null;
                isLoadingData = false;
            }
            catch { isLoadingData = false; }
        }

        private string GenerateSubTypeCode(int assetTypeID, int? parentSubTypeID)
        {
            try
            {
                string baseCode;

                if (parentSubTypeID == null || parentSubTypeID == 0)
                {
                    object mainCodeObj = DatabaseHelper.ExecuteScalar(
                        "SELECT AssetTypeCode FROM tblAssetTypes WHERE AssetTypeID = @ID",
                        new SqlParameter[] { new SqlParameter("@ID", assetTypeID) });
                    baseCode = mainCodeObj != null ? mainCodeObj.ToString() : assetTypeID.ToString();

                    int nextNum = GetNextSubTypeNumber(assetTypeID, 0);
                    return baseCode + "-" + nextNum.ToString("D3");
                }
                else
                {
                    object parentCodeObj = DatabaseHelper.ExecuteScalar(
                        "SELECT SubTypeCode FROM tblSubTypeAssets WHERE SubTypeID = @ID",
                        new SqlParameter[] { new SqlParameter("@ID", parentSubTypeID.Value) });
                    baseCode = parentCodeObj != null ? parentCodeObj.ToString() : "";

                    int nextNum = GetNextSubTypeNumber(assetTypeID, parentSubTypeID.Value);
                    return baseCode + "-" + nextNum.ToString("D3");
                }
            }
            catch { return assetTypeID + "-001"; }
        }

        private int GetNextSubTypeNumber(int assetTypeID, int parentSubTypeID)
        {
            try
            {
                string query;
                SqlParameter[] parms;

                if (parentSubTypeID == 0)
                {
                    query = @"SELECT SubTypeCode FROM tblSubTypeAssets 
                              WHERE AssetTypeID = @TypeID 
                                AND (ParentSubTypeID IS NULL OR ParentSubTypeID = 0)
                              ORDER BY SubTypeCode";
                    parms = new SqlParameter[] { new SqlParameter("@TypeID", assetTypeID) };
                }
                else
                {
                    query = @"SELECT SubTypeCode FROM tblSubTypeAssets 
                              WHERE ParentSubTypeID = @ParentID ORDER BY SubTypeCode";
                    parms = new SqlParameter[] { new SqlParameter("@ParentID", parentSubTypeID) };
                }

                DataTable dt = DatabaseHelper.GetData(query, parms);
                if (dt.Rows.Count == 0) return 1;

                int expected = 1;
                foreach (DataRow row in dt.Rows)
                {
                    int lastNum = ExtractLastNumber(row["SubTypeCode"].ToString());
                    if (lastNum != expected) return expected;
                    expected++;
                }
                return expected;
            }
            catch { return 1; }
        }

        private int ExtractLastNumber(string code)
        {
            if (string.IsNullOrEmpty(code)) return 0;
            int lastDash = code.LastIndexOf('-');
            if (lastDash >= 0 && lastDash < code.Length - 1)
            {
                int num;
                if (int.TryParse(code.Substring(lastDash + 1), out num)) return num;
            }
            return 0;
        }

        private int CalculateLevel(int? parentSubTypeID)
        {
            if (parentSubTypeID == null || parentSubTypeID == 0) return 1;
            try
            {
                object lvl = DatabaseHelper.ExecuteScalar(
                    "SELECT LevelNumber FROM tblSubTypeAssets WHERE SubTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", parentSubTypeID.Value) });
                return lvl != null && lvl != DBNull.Value ? Convert.ToInt32(lvl) + 1 : 1;
            }
            catch { return 1; }
        }

        private string BuildFullPath(int assetTypeID, int? parentSubTypeID, string currentName)
        {
            try
            {
                object mainNameObj = DatabaseHelper.ExecuteScalar(
                    "SELECT AssetTypeName FROM tblAssetTypes WHERE AssetTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", assetTypeID) });
                string path = mainNameObj != null ? mainNameObj.ToString() : "";

                if (parentSubTypeID != null && parentSubTypeID > 0)
                {
                    string parentPath = GetParentPath(parentSubTypeID.Value);
                    if (!string.IsNullOrEmpty(parentPath)) path += " / " + parentPath;
                }
                if (!string.IsNullOrEmpty(currentName)) path += " / " + currentName;
                return path;
            }
            catch { return currentName; }
        }

        private string GetParentPath(int subTypeID)
        {
            string path = ""; int currentID = subTypeID; int counter = 0;
            while (currentID > 0 && counter < 10)
            {
                DataTable dt = DatabaseHelper.GetData(
                    "SELECT SubTypeName, ParentSubTypeID FROM tblSubTypeAssets WHERE SubTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", currentID) });
                if (dt.Rows.Count == 0) break;
                string name = dt.Rows[0]["SubTypeName"].ToString();
                path = string.IsNullOrEmpty(path) ? name : name + " / " + path;
                object parentObj = dt.Rows[0]["ParentSubTypeID"];
                currentID = parentObj != DBNull.Value ? Convert.ToInt32(parentObj) : 0;
                counter++;
            }
            return path;
        }

        // ═══ أوضاع النافذة ═══
        private void SetReadMode()
        {
            isNewSubType = false; isEditSubType = false;
            cmbMainType.IsEnabled = false; cmbParentSubType.IsEnabled = false;
            txtSubTypeCode.IsEnabled = false; txtSubTypeName.IsEnabled = false;
            txtSubTypeDescription.IsEnabled = false; chkSubTypeActive.IsEnabled = false;

            btnNewSubType.IsEnabled = true; btnSaveSubType.IsEnabled = false;
            btnEditSubType.IsEnabled = (dgSubTypes.SelectedItem != null);
            btnDeleteSubType.IsEnabled = (dgSubTypes.SelectedItem != null);
            btnCancelSubType.IsEnabled = false;

            dgSubTypes.IsEnabled = true;
            txtFormMode.Text = "وضع العرض";
        }

        private void SetSubTypeInputMode()
        {
            cmbMainType.IsEnabled = isNewSubType; cmbParentSubType.IsEnabled = true;
            txtSubTypeCode.IsEnabled = false; txtSubTypeName.IsEnabled = true;
            txtSubTypeDescription.IsEnabled = true; chkSubTypeActive.IsEnabled = true;

            btnNewSubType.IsEnabled = false; btnSaveSubType.IsEnabled = true;
            btnEditSubType.IsEnabled = false; btnDeleteSubType.IsEnabled = false;
            btnCancelSubType.IsEnabled = true;

            dgSubTypes.IsEnabled = false;
            txtFormMode.Text = isNewSubType ? "إضافة فرعي" : "تعديل فرعي";
            txtSubTypeName.Focus();
        }

        private void ClearSubTypeFields()
        {
            isLoadingData = true;
            txtSubTypeID.Text = ""; txtSubTypeCode.Text = "";
            txtSubTypeName.Text = ""; txtSubTypeDescription.Text = "";
            txtLevelNumber.Text = "1"; chkSubTypeActive.IsChecked = true;
            cmbMainType.SelectedValue = null; cmbParentSubType.SelectedValue = null;
            cmbParentSubType.ItemsSource = null;
            isLoadingData = false;
        }

        // ═══ أحداث القوائم ═══
        private void cmbMainType_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (isLoadingData || cmbMainType.SelectedValue == null) return;
            int typeID = Convert.ToInt32(cmbMainType.SelectedValue);
            int exID = 0; int.TryParse(txtSubTypeID.Text, out exID);
            LoadParentSubTypes(typeID, exID);

            if (isNewSubType)
            {
                txtSubTypeCode.Text = GenerateSubTypeCode(typeID, null);
                txtLevelNumber.Text = "1";
            }
        }

        private void cmbParentSubType_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (isLoadingData || cmbMainType.SelectedValue == null) return;
            int typeID = Convert.ToInt32(cmbMainType.SelectedValue);
            int? parentID = cmbParentSubType.SelectedValue != null ? (int?)Convert.ToInt32(cmbParentSubType.SelectedValue) : null;

            if (isNewSubType) txtSubTypeCode.Text = GenerateSubTypeCode(typeID, parentID);
            txtLevelNumber.Text = CalculateLevel(parentID).ToString();
        }

        // ═══ أزرار الأنواع الفرعية ═══
        private void btnNewSubType_Click(object sender, RoutedEventArgs e)
        {
            isNewSubType = true; isEditSubType = false;
            ClearSubTypeFields();
            SetSubTypeInputMode();

            // اختيار النوع الرئيسي المحدد في الشجرة
            if (!string.IsNullOrEmpty(txtMainTypeID.Text))
            {
                isLoadingData = true;
                cmbMainType.SelectedValue = Convert.ToInt32(txtMainTypeID.Text);
                isLoadingData = false;

                int typeID = Convert.ToInt32(txtMainTypeID.Text);
                LoadParentSubTypes(typeID);
                txtSubTypeCode.Text = GenerateSubTypeCode(typeID, null);
            }

            txtFormStatus.Text = "إدخال نوع فرعي جديد...";
        }

        private void btnSaveSubType_Click(object sender, RoutedEventArgs e)
        {
            if (cmbMainType.SelectedValue == null)
            { MessageBox.Show("اختر النوع الرئيسي!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning); return; }
            if (string.IsNullOrWhiteSpace(txtSubTypeName.Text))
            { MessageBox.Show("أدخل اسم النوع الفرعي!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning); txtSubTypeName.Focus(); return; }

            try
            {
                int typeID = Convert.ToInt32(cmbMainType.SelectedValue);
                int? parentID = cmbParentSubType.SelectedValue != null ? (int?)Convert.ToInt32(cmbParentSubType.SelectedValue) : null;
                int level = CalculateLevel(parentID);
                string fullPath = BuildFullPath(typeID, parentID, txtSubTypeName.Text.Trim());

                if (isNewSubType)
                {
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                        "SELECT COUNT(*) FROM tblSubTypeAssets WHERE SubTypeName = @Name AND AssetTypeID = @TypeID",
                        new SqlParameter[] {
                            new SqlParameter("@Name", txtSubTypeName.Text.Trim()),
                            new SqlParameter("@TypeID", typeID) }));

                    if (exists > 0) { MessageBox.Show("الاسم موجود!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning); return; }

                    // التحقق من الكود
                    int codeEx = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                        "SELECT COUNT(*) FROM tblSubTypeAssets WHERE SubTypeCode = @Code",
                        new SqlParameter[] { new SqlParameter("@Code", txtSubTypeCode.Text.Trim()) }));
                    if (codeEx > 0) txtSubTypeCode.Text = GenerateSubTypeCode(typeID, parentID);

                    DatabaseHelper.ExecuteNonQuery(@"
                        INSERT INTO tblSubTypeAssets 
                            (AssetTypeID, ParentSubTypeID, SubTypeCode, SubTypeName, 
                             FullPath, LevelNumber, Description, IsActive, CreatedDate) 
                        VALUES (@TypeID, @ParentID, @Code, @Name, @Path, @Level, @Desc, @Active, GETDATE())",
                        new SqlParameter[] {
                            new SqlParameter("@TypeID", typeID),
                            new SqlParameter("@ParentID", parentID.HasValue ? (object)parentID.Value : DBNull.Value),
                            new SqlParameter("@Code", txtSubTypeCode.Text.Trim()),
                            new SqlParameter("@Name", txtSubTypeName.Text.Trim()),
                            new SqlParameter("@Path", fullPath),
                            new SqlParameter("@Level", level),
                            new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtSubTypeDescription.Text) ? (object)DBNull.Value : txtSubTypeDescription.Text.Trim()),
                            new SqlParameter("@Active", chkSubTypeActive.IsChecked == true ? 1 : 0)
                        });

                    txtFormStatus.Text = "✅ تم الإضافة - " + txtSubTypeCode.Text;
                    MessageBox.Show("تم الإضافة!\nالكود: " + txtSubTypeCode.Text, "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (isEditSubType)
                {
                    int subID = Convert.ToInt32(txtSubTypeID.Text);

                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                        "SELECT COUNT(*) FROM tblSubTypeAssets WHERE SubTypeName = @Name AND AssetTypeID = @TypeID AND SubTypeID <> @ID",
                        new SqlParameter[] {
                            new SqlParameter("@Name", txtSubTypeName.Text.Trim()),
                            new SqlParameter("@TypeID", typeID),
                            new SqlParameter("@ID", subID) }));
                    if (exists > 0) { MessageBox.Show("الاسم موجود!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning); return; }

                    DatabaseHelper.ExecuteNonQuery(@"
                        UPDATE tblSubTypeAssets SET 
                            ParentSubTypeID = @ParentID, SubTypeName = @Name, FullPath = @Path,
                            LevelNumber = @Level, Description = @Desc, IsActive = @Active, ModifiedDate = GETDATE()
                        WHERE SubTypeID = @ID",
                        new SqlParameter[] {
                            new SqlParameter("@ParentID", parentID.HasValue ? (object)parentID.Value : DBNull.Value),
                            new SqlParameter("@Name", txtSubTypeName.Text.Trim()),
                            new SqlParameter("@Path", fullPath),
                            new SqlParameter("@Level", level),
                            new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtSubTypeDescription.Text) ? (object)DBNull.Value : txtSubTypeDescription.Text.Trim()),
                            new SqlParameter("@Active", chkSubTypeActive.IsChecked == true ? 1 : 0),
                            new SqlParameter("@ID", subID)
                        });

                    txtFormStatus.Text = "✅ تم التحديث";
                    MessageBox.Show("تم التحديث!", "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }

                RefreshAll();
                ClearSubTypeFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnEditSubType_Click(object sender, RoutedEventArgs e)
        {
            if (dgSubTypes.SelectedItem == null) { MessageBox.Show("اختر سجلاً!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning); return; }
            isNewSubType = false; isEditSubType = true;
            SetSubTypeInputMode();
            txtFormStatus.Text = "تعديل: " + txtSubTypeName.Text;
        }

        private void btnDeleteSubType_Click(object sender, RoutedEventArgs e)
        {
            if (dgSubTypes.SelectedItem == null) return;
            try
            {
                int subID = Convert.ToInt32(txtSubTypeID.Text);

                int childCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblSubTypeAssets WHERE ParentSubTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", subID) }));
                if (childCount > 0) { MessageBox.Show("لا يمكن الحذف! يحتوي على " + childCount + " فرعي.", "خطأ", MessageBoxButton.OK, MessageBoxImage.Warning); return; }

                int assetCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssets WHERE SubTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", subID) }));
                if (assetCount > 0) { MessageBox.Show("لا يمكن الحذف! مستخدم في " + assetCount + " أصل.", "خطأ", MessageBoxButton.OK, MessageBoxImage.Warning); return; }

                if (MessageBox.Show("حذف: " + txtSubTypeName.Text + "؟", "تأكيد", MessageBoxButton.YesNo, MessageBoxImage.Warning) != MessageBoxResult.Yes) return;

                DatabaseHelper.ExecuteNonQuery("DELETE FROM tblSubTypeAssets WHERE SubTypeID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", subID) });

                txtFormStatus.Text = "✅ تم الحذف";
                RefreshAll(); ClearSubTypeFields(); SetReadMode();
            }
            catch (Exception ex) { MessageBox.Show("خطأ:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error); }
        }

        private void btnCancelSubType_Click(object sender, RoutedEventArgs e)
        {
            ClearSubTypeFields(); SetReadMode();
            dgSubTypes.SelectedItem = null;
            txtFormStatus.Text = "تم الإلغاء";
        }

        // ═══ حدث اختيار من الجدول ═══
        private void dgSubTypes_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgSubTypes.SelectedItem == null) return;
            DataRowView row = dgSubTypes.SelectedItem as DataRowView;
            if (row == null) return;

            isLoadingData = true;
            txtSubTypeID.Text = row["SubTypeID"].ToString();
            txtSubTypeCode.Text = row["SubTypeCode"] != DBNull.Value ? row["SubTypeCode"].ToString() : "";
            txtSubTypeName.Text = row["SubTypeName"].ToString();
            txtLevelNumber.Text = row["LevelNumber"].ToString();
            chkSubTypeActive.IsChecked = row["IsActive"] != DBNull.Value && Convert.ToBoolean(row["IsActive"]);

            int subID = Convert.ToInt32(txtSubTypeID.Text);
            DataTable dtFull = DatabaseHelper.GetData(
                "SELECT AssetTypeID, ParentSubTypeID, Description, FullPath FROM tblSubTypeAssets WHERE SubTypeID = @ID",
                new SqlParameter[] { new SqlParameter("@ID", subID) });

            if (dtFull.Rows.Count > 0)
            {
                DataRow fr = dtFull.Rows[0];
                int typeID = Convert.ToInt32(fr["AssetTypeID"]);
                cmbMainType.SelectedValue = typeID;
                LoadParentSubTypes(typeID, subID);
                if (fr["ParentSubTypeID"] != DBNull.Value)
                    cmbParentSubType.SelectedValue = Convert.ToInt32(fr["ParentSubTypeID"]);
                txtSubTypeDescription.Text = fr["Description"] != DBNull.Value ? fr["Description"].ToString() : "";
            }

            isLoadingData = false;
            btnEditSubType.IsEnabled = true; btnDeleteSubType.IsEnabled = true;
            txtFormStatus.Text = "تم اختيار: " + txtSubTypeCode.Text + " - " + txtSubTypeName.Text;
        }

        private void RefreshAll()
        {
            BuildTree();
            if (!string.IsNullOrEmpty(txtMainTypeID.Text))
                LoadSubTypesGrid(Convert.ToInt32(txtMainTypeID.Text));
            LoadMainTypes();
        }
    }
}