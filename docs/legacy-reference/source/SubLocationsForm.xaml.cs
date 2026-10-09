using System;
using System.Data;
using System.Data.SqlClient;
using System.Windows;
using System.Windows.Controls;
using AssetManagement.Helpers;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة إدارة المواقع الفرعية الهرمية
    /// مع شجرة وتوليد أكواد هرمية تلقائية
    /// </summary>
    public partial class SubLocationsForm : Window
    {
        private bool isNewRecord = false;
        private bool isEditMode = false;
        private bool isLoadingData = false; // لمنع الأحداث أثناء التحميل

        public SubLocationsForm()
        {
            InitializeComponent();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            LoadMainLocations();
            SetReadMode();
        }

        // ═══════════════════════════════════════════════════
        // تحميل قوائم البيانات
        // ═══════════════════════════════════════════════════

        /// <summary>
        /// تحميل المواقع الرئيسية في القوائم المنسدلة
        /// </summary>
        private void LoadMainLocations()
        {
            try
            {
                string query = @"
                    SELECT MainLocationID, 
                           MainLocationCode + ' - ' + MainLocationName AS DisplayText,
                           MainLocationName,
                           MainLocationCode
                    FROM tblMainLocations 
                    WHERE IsActive = 1 
                    ORDER BY MainLocationCode";

                DataTable dt = DatabaseHelper.GetData(query);

                // قائمة المبنى في حقول الإدخال
                cmbMainLocation.ItemsSource = dt.DefaultView;

                // قائمة المبنى في الشجرة
                cmbTreeMainLocation.ItemsSource = dt.DefaultView;

                // اختيار أول مبنى تلقائياً في الشجرة
                if (dt.Rows.Count > 0)
                {
                    cmbTreeMainLocation.SelectedIndex = 0;
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل المواقع الرئيسية:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        /// <summary>
        /// تحميل المواقع الفرعية كأب محتمل (مفلترة حسب المبنى)
        /// </summary>
        private void LoadParentSubLocations(int mainLocationID, int excludeID = 0)
        {
            try
            {
                isLoadingData = true;

                string query = @"
                    SELECT SubLocationID, 
                           SubLocationCode + ' - ' + SubLocationName AS DisplayText
                    FROM tblSubLocations 
                    WHERE MainLocationID = @MainLocID 
                      AND IsActive = 1";

                if (excludeID > 0)
                {
                    query += " AND SubLocationID <> @ExcludeID";
                }

                query += " ORDER BY LevelNumber, SubLocationCode";

                SqlParameter[] parameters;
                if (excludeID > 0)
                {
                    parameters = new SqlParameter[] {
                        new SqlParameter("@MainLocID", mainLocationID),
                        new SqlParameter("@ExcludeID", excludeID)
                    };
                }
                else
                {
                    parameters = new SqlParameter[] {
                        new SqlParameter("@MainLocID", mainLocationID)
                    };
                }

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                cmbParentSubLocation.ItemsSource = dt.DefaultView;
                cmbParentSubLocation.SelectedValue = null;

                isLoadingData = false;
            }
            catch (Exception ex)
            {
                isLoadingData = false;
                MessageBox.Show("خطأ في تحميل المواقع الأب:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // تحميل البيانات في الجدول
        // ═══════════════════════════════════════════════════
        private void LoadGridData(int mainLocationID)
        {
            try
            {
                string query = @"
                    SELECT SubLocationID, SubLocationCode, SubLocationName,
                           FullPath, LevelNumber, IsActive
                    FROM tblSubLocations
                    WHERE MainLocationID = @MainLocID
                    ORDER BY LevelNumber, SubLocationCode";

                SqlParameter[] parameters = {
                    new SqlParameter("@MainLocID", mainLocationID)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);
                dgSubLocations.ItemsSource = dt.DefaultView;

                txtRecordCount.Text = "عدد السجلات: " + dt.Rows.Count;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في تحميل البيانات:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // بناء الشجرة الهرمية
        // ═══════════════════════════════════════════════════
        private void BuildTree(int mainLocationID)
        {
            try
            {
                treeLocations.Items.Clear();

                // جلب اسم المبنى
                string mainName = "";
                string mainCode = "";
                object result = DatabaseHelper.ExecuteScalar(
                    "SELECT MainLocationName FROM tblMainLocations WHERE MainLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", mainLocationID) });
                if (result != null) mainName = result.ToString();

                object codeResult = DatabaseHelper.ExecuteScalar(
                    "SELECT MainLocationCode FROM tblMainLocations WHERE MainLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", mainLocationID) });
                if (codeResult != null) mainCode = codeResult.ToString();

                // إنشاء عقدة الجذر (المبنى)
                TreeViewItem rootItem = new TreeViewItem();
                rootItem.Header = "🏢 " + mainCode + " - " + mainName;
                rootItem.IsExpanded = true;
                rootItem.Tag = "MAIN_" + mainLocationID;
                rootItem.FontWeight = FontWeights.Bold;

                // جلب المواقع الفرعية من المستوى الأول
                AddChildNodes(rootItem, mainLocationID, 0);

                treeLocations.Items.Add(rootItem);
            }
            catch (Exception ex)
            {
                txtFormStatus.Text = "خطأ في بناء الشجرة: " + ex.Message;
            }
        }

        /// <summary>
        /// إضافة العقد الفرعية بشكل متكرر (Recursive)
        /// </summary>
        private void AddChildNodes(TreeViewItem parentItem, int mainLocationID, int parentSubLocationID)
        {
            string query;
            SqlParameter[] parameters;

            if (parentSubLocationID == 0)
            {
                // المستوى الأول (بدون أب)
                query = @"
                    SELECT SubLocationID, SubLocationCode, SubLocationName, LevelNumber, IsActive
                    FROM tblSubLocations
                    WHERE MainLocationID = @MainLocID 
                      AND (ParentSubLocationID IS NULL OR ParentSubLocationID = 0)
                    ORDER BY SubLocationCode";
                parameters = new SqlParameter[] {
                    new SqlParameter("@MainLocID", mainLocationID)
                };
            }
            else
            {
                // المستويات التالية
                query = @"
                    SELECT SubLocationID, SubLocationCode, SubLocationName, LevelNumber, IsActive
                    FROM tblSubLocations
                    WHERE ParentSubLocationID = @ParentID
                    ORDER BY SubLocationCode";
                parameters = new SqlParameter[] {
                    new SqlParameter("@ParentID", parentSubLocationID)
                };
            }

            DataTable dt = DatabaseHelper.GetData(query, parameters);

            foreach (DataRow row in dt.Rows)
            {
                int subLocID = Convert.ToInt32(row["SubLocationID"]);
                string code = row["SubLocationCode"].ToString();
                string name = row["SubLocationName"].ToString();
                int level = Convert.ToInt32(row["LevelNumber"]);
                bool isActive = Convert.ToBoolean(row["IsActive"]);

                TreeViewItem childItem = new TreeViewItem();
                string icon = level == 1 ? "📁" : level == 2 ? "📂" : "📄";
                string activeText = isActive ? "" : " ⛔";
                childItem.Header = icon + " " + code + " - " + name + activeText;
                childItem.Tag = subLocID.ToString();
                childItem.IsExpanded = true;

                // إضافة الأحفاد بشكل متكرر
                AddChildNodes(childItem, mainLocationID, subLocID);

                parentItem.Items.Add(childItem);
            }
        }

        // ═══════════════════════════════════════════════════
        // توليد الكود الهرمي التلقائي
        // ═══════════════════════════════════════════════════

        /// <summary>
        /// توليد الكود التلقائي بناءً على المبنى والأب
        /// </summary>
        private string GenerateHierarchicalCode(int mainLocationID, int? parentSubLocationID)
        {
            try
            {
                string baseCode;

                if (parentSubLocationID == null || parentSubLocationID == 0)
                {
                    // المستوى الأول: كود المبنى + رقم تسلسلي
                    object mainCodeObj = DatabaseHelper.ExecuteScalar(
                        "SELECT MainLocationCode FROM tblMainLocations WHERE MainLocationID = @ID",
                        new SqlParameter[] { new SqlParameter("@ID", mainLocationID) });

                    baseCode = mainCodeObj != null ? mainCodeObj.ToString() : mainLocationID.ToString();

                    int nextNum = GetNextChildNumber(mainLocationID, 0);
                    return baseCode + "-" + nextNum.ToString("D3");
                }
                else
                {
                    // المستويات التالية: كود الأب + رقم تسلسلي
                    object parentCodeObj = DatabaseHelper.ExecuteScalar(
                        "SELECT SubLocationCode FROM tblSubLocations WHERE SubLocationID = @ID",
                        new SqlParameter[] { new SqlParameter("@ID", parentSubLocationID.Value) });

                    baseCode = parentCodeObj != null ? parentCodeObj.ToString() : "";

                    int nextNum = GetNextChildNumber(mainLocationID, parentSubLocationID.Value);
                    return baseCode + "-" + nextNum.ToString("D3");
                }
            }
            catch
            {
                return mainLocationID + "-001";
            }
        }

        /// <summary>
        /// الحصول على الرقم التسلسلي التالي مع إعادة استخدام المحذوف
        /// </summary>
        private int GetNextChildNumber(int mainLocationID, int parentSubLocationID)
        {
            try
            {
                string query;
                SqlParameter[] parameters;

                if (parentSubLocationID == 0)
                {
                    query = @"
                        SELECT SubLocationCode FROM tblSubLocations 
                        WHERE MainLocationID = @MainLocID 
                          AND (ParentSubLocationID IS NULL OR ParentSubLocationID = 0)
                        ORDER BY SubLocationCode";
                    parameters = new SqlParameter[] {
                        new SqlParameter("@MainLocID", mainLocationID)
                    };
                }
                else
                {
                    query = @"
                        SELECT SubLocationCode FROM tblSubLocations 
                        WHERE ParentSubLocationID = @ParentID
                        ORDER BY SubLocationCode";
                    parameters = new SqlParameter[] {
                        new SqlParameter("@ParentID", parentSubLocationID)
                    };
                }

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                if (dt.Rows.Count == 0)
                    return 1;

                // استخراج الأرقام الأخيرة والبحث عن فجوة
                int expectedNum = 1;
                foreach (DataRow row in dt.Rows)
                {
                    string code = row["SubLocationCode"].ToString();
                    int lastNum = ExtractLastNumber(code);
                    if (lastNum != expectedNum)
                    {
                        return expectedNum; // وجدنا فجوة
                    }
                    expectedNum++;
                }

                return expectedNum; // لا فجوات، الرقم التالي
            }
            catch
            {
                return 1;
            }
        }

        /// <summary>
        /// استخراج آخر رقم من الكود (مثلاً: 01-002-003 → 3)
        /// </summary>
        private int ExtractLastNumber(string code)
        {
            if (string.IsNullOrEmpty(code)) return 0;

            // البحث عن آخر جزء بعد آخر "-"
            int lastDash = code.LastIndexOf('-');
            if (lastDash >= 0 && lastDash < code.Length - 1)
            {
                string lastPart = code.Substring(lastDash + 1);
                int num;
                if (int.TryParse(lastPart, out num))
                    return num;
            }

            return 0;
        }

        // ═══════════════════════════════════════════════════
        // حساب المستوى والمسار
        // ═══════════════════════════════════════════════════

        private int CalculateLevel(int? parentSubLocationID)
        {
            if (parentSubLocationID == null || parentSubLocationID == 0)
                return 1;

            try
            {
                object levelObj = DatabaseHelper.ExecuteScalar(
                    "SELECT LevelNumber FROM tblSubLocations WHERE SubLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", parentSubLocationID.Value) });

                if (levelObj != null && levelObj != DBNull.Value)
                    return Convert.ToInt32(levelObj) + 1;
            }
            catch { }

            return 1;
        }

        private string BuildFullPath(int mainLocationID, int? parentSubLocationID, string currentName)
        {
            try
            {
                // اسم المبنى
                object mainNameObj = DatabaseHelper.ExecuteScalar(
                    "SELECT MainLocationName FROM tblMainLocations WHERE MainLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", mainLocationID) });

                string path = mainNameObj != null ? mainNameObj.ToString() : "";

                // مسار الأب
                if (parentSubLocationID != null && parentSubLocationID > 0)
                {
                    string parentPath = GetParentPath(parentSubLocationID.Value);
                    if (!string.IsNullOrEmpty(parentPath))
                        path += " / " + parentPath;
                }

                // الاسم الحالي
                if (!string.IsNullOrEmpty(currentName))
                    path += " / " + currentName;

                return path;
            }
            catch
            {
                return currentName;
            }
        }

        private string GetParentPath(int subLocationID)
        {
            try
            {
                string path = "";
                int currentID = subLocationID;
                int counter = 0;

                while (currentID > 0 && counter < 10)
                {
                    DataTable dt = DatabaseHelper.GetData(
                        "SELECT SubLocationName, ParentSubLocationID FROM tblSubLocations WHERE SubLocationID = @ID",
                        new SqlParameter[] { new SqlParameter("@ID", currentID) });

                    if (dt.Rows.Count == 0) break;

                    string name = dt.Rows[0]["SubLocationName"].ToString();
                    path = string.IsNullOrEmpty(path) ? name : name + " / " + path;

                    object parentObj = dt.Rows[0]["ParentSubLocationID"];
                    currentID = (parentObj != DBNull.Value) ? Convert.ToInt32(parentObj) : 0;
                    counter++;
                }

                return path;
            }
            catch
            {
                return "";
            }
        }

        // ═══════════════════════════════════════════════════
        // أوضاع النافذة
        // ═══════════════════════════════════════════════════
        private void SetReadMode()
        {
            isNewRecord = false;
            isEditMode = false;

            cmbMainLocation.IsEnabled = false;
            cmbParentSubLocation.IsEnabled = false;
            txtSubLocationCode.IsEnabled = false;
            txtSubLocationName.IsEnabled = false;
            txtDescription.IsEnabled = false;
            chkIsActive.IsEnabled = false;

            btnNew.IsEnabled = true;
            btnSave.IsEnabled = false;
            btnEdit.IsEnabled = (dgSubLocations.SelectedItem != null);
            btnDelete.IsEnabled = (dgSubLocations.SelectedItem != null);
            btnToggleActive.IsEnabled = (dgSubLocations.SelectedItem != null);
            btnCancel.IsEnabled = false;

            dgSubLocations.IsEnabled = true;
            txtFormMode.Text = "وضع العرض";
        }

        private void SetInputMode()
        {
            cmbMainLocation.IsEnabled = isNewRecord;
            cmbParentSubLocation.IsEnabled = true;
            txtSubLocationCode.IsEnabled = false;
            txtSubLocationName.IsEnabled = true;
            txtDescription.IsEnabled = true;
            chkIsActive.IsEnabled = true;

            btnNew.IsEnabled = false;
            btnSave.IsEnabled = true;
            btnEdit.IsEnabled = false;
            btnDelete.IsEnabled = false;
            btnToggleActive.IsEnabled = false;
            btnCancel.IsEnabled = true;

            dgSubLocations.IsEnabled = false;
            txtFormMode.Text = isNewRecord ? "وضع الإضافة" : "وضع التعديل";
            txtSubLocationName.Focus();
        }

        private void ClearFields()
        {
            isLoadingData = true;
            txtSubLocationID.Text = "";
            txtSubLocationCode.Text = "";
            txtSubLocationName.Text = "";
            txtDescription.Text = "";
            txtFullPath.Text = "...";
            txtLevelNumber.Text = "1";
            chkIsActive.IsChecked = true;
            cmbMainLocation.SelectedValue = null;
            cmbParentSubLocation.SelectedValue = null;
            cmbParentSubLocation.ItemsSource = null;
            isLoadingData = false;
        }

        // ═══════════════════════════════════════════════════
        // أحداث القوائم المنسدلة
        // ═══════════════════════════════════════════════════

        /// <summary>
        /// عند تغيير المبنى في الشجرة
        /// </summary>
        private void cmbTreeMainLocation_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (cmbTreeMainLocation.SelectedValue == null) return;

            int mainLocID = Convert.ToInt32(cmbTreeMainLocation.SelectedValue);
            BuildTree(mainLocID);
            LoadGridData(mainLocID);
        }

        /// <summary>
        /// عند تغيير المبنى في حقول الإدخال
        /// </summary>
        private void cmbMainLocation_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (isLoadingData) return;
            if (cmbMainLocation.SelectedValue == null) return;

            int mainLocID = Convert.ToInt32(cmbMainLocation.SelectedValue);
            int excludeID = 0;
            int.TryParse(txtSubLocationID.Text, out excludeID);

            LoadParentSubLocations(mainLocID, excludeID);

            // توليد الكود إذا في وضع إضافة
            if (isNewRecord)
            {
                string code = GenerateHierarchicalCode(mainLocID, null);
                txtSubLocationCode.Text = code;
                txtLevelNumber.Text = "1";
                UpdateFullPathDisplay();
            }
        }

        /// <summary>
        /// عند تغيير الموقع الأب
        /// </summary>
        private void cmbParentSubLocation_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (isLoadingData) return;
            if (cmbMainLocation.SelectedValue == null) return;

            int mainLocID = Convert.ToInt32(cmbMainLocation.SelectedValue);

            if (isNewRecord || isEditMode)
            {
                int? parentID = null;
                if (cmbParentSubLocation.SelectedValue != null)
                {
                    parentID = Convert.ToInt32(cmbParentSubLocation.SelectedValue);
                }

                if (isNewRecord)
                {
                    string code = GenerateHierarchicalCode(mainLocID, parentID);
                    txtSubLocationCode.Text = code;
                }

                int level = CalculateLevel(parentID);
                txtLevelNumber.Text = level.ToString();
                UpdateFullPathDisplay();
            }
        }

        /// <summary>
        /// تحديث عرض المسار الكامل
        /// </summary>
        private void UpdateFullPathDisplay()
        {
            if (cmbMainLocation.SelectedValue == null) return;

            int mainLocID = Convert.ToInt32(cmbMainLocation.SelectedValue);
            int? parentID = null;
            if (cmbParentSubLocation.SelectedValue != null)
            {
                parentID = Convert.ToInt32(cmbParentSubLocation.SelectedValue);
            }

            string currentName = txtSubLocationName.Text.Trim();
            if (string.IsNullOrEmpty(currentName)) currentName = "...";

            txtFullPath.Text = BuildFullPath(mainLocID, parentID, currentName);
        }

        /// <summary>
        /// عند اختيار عنصر من الشجرة
        /// </summary>
        private void treeLocations_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            if (isEditMode || isNewRecord) return;

            TreeViewItem selectedItem = treeLocations.SelectedItem as TreeViewItem;
            if (selectedItem == null) return;

            string tag = selectedItem.Tag as string;
            if (tag == null || tag.StartsWith("MAIN_")) return;

            // البحث عن السجل في الجدول
            int subLocID;
            if (int.TryParse(tag, out subLocID))
            {
                foreach (var item in dgSubLocations.Items)
                {
                    DataRowView row = item as DataRowView;
                    if (row != null && Convert.ToInt32(row["SubLocationID"]) == subLocID)
                    {
                        dgSubLocations.SelectedItem = item;
                        dgSubLocations.ScrollIntoView(item);
                        break;
                    }
                }
            }
        }

        // ═══════════════════════════════════════════════════
        // أحداث الأزرار
        // ═══════════════════════════════════════════════════

        private void btnNew_Click(object sender, RoutedEventArgs e)
        {
            isNewRecord = true;
            isEditMode = false;
            ClearFields();
            SetInputMode();

            // إذا هناك مبنى مختار في الشجرة، نستخدمه
            if (cmbTreeMainLocation.SelectedValue != null)
            {
                isLoadingData = true;
                cmbMainLocation.SelectedValue = cmbTreeMainLocation.SelectedValue;
                isLoadingData = false;

                int mainLocID = Convert.ToInt32(cmbMainLocation.SelectedValue);
                LoadParentSubLocations(mainLocID);

                string code = GenerateHierarchicalCode(mainLocID, null);
                txtSubLocationCode.Text = code;
                UpdateFullPathDisplay();
            }

            txtFormStatus.Text = "إدخال موقع فرعي جديد...";
        }

        private void btnSave_Click(object sender, RoutedEventArgs e)
        {
            // التحقق من البيانات
            if (cmbMainLocation.SelectedValue == null)
            {
                MessageBox.Show("يرجى اختيار المبنى!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            if (string.IsNullOrWhiteSpace(txtSubLocationName.Text))
            {
                MessageBox.Show("يرجى إدخال اسم الموقع!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                txtSubLocationName.Focus();
                return;
            }

            try
            {
                int mainLocID = Convert.ToInt32(cmbMainLocation.SelectedValue);
                int? parentID = null;
                if (cmbParentSubLocation.SelectedValue != null)
                {
                    parentID = Convert.ToInt32(cmbParentSubLocation.SelectedValue);
                }

                int level = CalculateLevel(parentID);
                string fullPath = BuildFullPath(mainLocID, parentID, txtSubLocationName.Text.Trim());

                if (isNewRecord)
                {
                    // التحقق من التكرار
                    string checkQuery = @"
                        SELECT COUNT(*) FROM tblSubLocations 
                        WHERE SubLocationName = @Name AND MainLocationID = @MainLocID";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtSubLocationName.Text.Trim()),
                        new SqlParameter("@MainLocID", mainLocID)
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموقع موجود مسبقاً في هذا المبنى!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        txtSubLocationName.Focus();
                        return;
                    }

                    // التحقق من الكود
                    string checkCodeQuery = "SELECT COUNT(*) FROM tblSubLocations WHERE SubLocationCode = @Code";
                    SqlParameter[] checkCodeParams = {
                        new SqlParameter("@Code", txtSubLocationCode.Text.Trim())
                    };
                    int codeExists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkCodeQuery, checkCodeParams));

                    if (codeExists > 0)
                    {
                        txtSubLocationCode.Text = GenerateHierarchicalCode(mainLocID, parentID);
                    }

                    // الإضافة
                    string insertQuery = @"
                        INSERT INTO tblSubLocations 
                            (MainLocationID, ParentSubLocationID, SubLocationCode, 
                             SubLocationName, FullPath, LevelNumber, Description, 
                             IsActive, CreatedDate) 
                        VALUES 
                            (@MainLocID, @ParentID, @Code, @Name, @Path, 
                             @Level, @Desc, @Active, GETDATE())";

                    SqlParameter[] insertParams = {
                        new SqlParameter("@MainLocID", mainLocID),
                        new SqlParameter("@ParentID", parentID.HasValue ? (object)parentID.Value : DBNull.Value),
                        new SqlParameter("@Code", txtSubLocationCode.Text.Trim()),
                        new SqlParameter("@Name", txtSubLocationName.Text.Trim()),
                        new SqlParameter("@Path", fullPath),
                        new SqlParameter("@Level", level),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0)
                    };

                    DatabaseHelper.ExecuteNonQuery(insertQuery, insertParams);

                    txtFormStatus.Text = "✅ تم الإضافة - الكود: " + txtSubLocationCode.Text;
                    MessageBox.Show("تم إضافة الموقع بنجاح!\n\nالكود: " + txtSubLocationCode.Text +
                        "\nالمسار: " + fullPath, "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                else if (isEditMode)
                {
                    // التحقق من التكرار
                    string checkQuery = @"
                        SELECT COUNT(*) FROM tblSubLocations 
                        WHERE SubLocationName = @Name AND MainLocationID = @MainLocID 
                          AND SubLocationID <> @ID";
                    SqlParameter[] checkParams = {
                        new SqlParameter("@Name", txtSubLocationName.Text.Trim()),
                        new SqlParameter("@MainLocID", mainLocID),
                        new SqlParameter("@ID", Convert.ToInt32(txtSubLocationID.Text))
                    };
                    int exists = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkQuery, checkParams));

                    if (exists > 0)
                    {
                        MessageBox.Show("اسم الموقع موجود مسبقاً!",
                            "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                        return;
                    }

                    // التحديث
                    string updateQuery = @"
                        UPDATE tblSubLocations SET 
                            ParentSubLocationID = @ParentID,
                            SubLocationName = @Name, 
                            FullPath = @Path,
                            LevelNumber = @Level,
                            Description = @Desc, 
                            IsActive = @Active,
                            ModifiedDate = GETDATE()
                        WHERE SubLocationID = @ID";

                    SqlParameter[] updateParams = {
                        new SqlParameter("@ParentID", parentID.HasValue ? (object)parentID.Value : DBNull.Value),
                        new SqlParameter("@Name", txtSubLocationName.Text.Trim()),
                        new SqlParameter("@Path", fullPath),
                        new SqlParameter("@Level", level),
                        new SqlParameter("@Desc", string.IsNullOrWhiteSpace(txtDescription.Text) ?
                            (object)DBNull.Value : txtDescription.Text.Trim()),
                        new SqlParameter("@Active", chkIsActive.IsChecked == true ? 1 : 0),
                        new SqlParameter("@ID", Convert.ToInt32(txtSubLocationID.Text))
                    };

                    DatabaseHelper.ExecuteNonQuery(updateQuery, updateParams);

                    txtFormStatus.Text = "✅ تم التحديث بنجاح";
                    MessageBox.Show("تم تحديث البيانات بنجاح!", "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
                }

                // تحديث الشجرة والجدول
                RefreshAllData();
                ClearFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الحفظ:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnEdit_Click(object sender, RoutedEventArgs e)
        {
            if (dgSubLocations.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            isNewRecord = false;
            isEditMode = true;
            SetInputMode();
            txtFormStatus.Text = "تعديل: " + txtSubLocationName.Text;
        }

        private void btnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (dgSubLocations.SelectedItem == null)
            {
                MessageBox.Show("يرجى اختيار سجل!", "تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            try
            {
                int subLocID = Convert.ToInt32(txtSubLocationID.Text);

                // التحقق من الأبناء
                string checkChildQuery = "SELECT COUNT(*) FROM tblSubLocations WHERE ParentSubLocationID = @ID";
                int childCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkChildQuery,
                    new SqlParameter[] { new SqlParameter("@ID", subLocID) }));

                if (childCount > 0)
                {
                    MessageBox.Show("لا يمكن الحذف!\n\nيحتوي على " + childCount + " موقع فرعي.\nاحذف الفرعيات أولاً.",
                        "لا يمكن الحذف", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // التحقق من الأصول
                string checkAssetQuery = "SELECT COUNT(*) FROM tblAssets WHERE SubLocationID = @ID";
                int assetCount = Convert.ToInt32(DatabaseHelper.ExecuteScalar(checkAssetQuery,
                    new SqlParameter[] { new SqlParameter("@ID", subLocID) }));

                if (assetCount > 0)
                {
                    MessageBox.Show("لا يمكن الحذف!\n\nمستخدم في " + assetCount + " أصل.\nيمكنك تعطيله بدلاً من حذفه.",
                        "لا يمكن الحذف", MessageBoxButton.OK, MessageBoxImage.Warning);
                    return;
                }

                // تأكيد
                MessageBoxResult result = MessageBox.Show(
                    "حذف الموقع:\n\n" + txtSubLocationCode.Text + " - " + txtSubLocationName.Text +
                    "\n\n⚠️ لا يمكن التراجع!",
                    "تأكيد الحذف", MessageBoxButton.YesNo, MessageBoxImage.Warning);

                if (result != MessageBoxResult.Yes) return;

                DatabaseHelper.ExecuteNonQuery("DELETE FROM tblSubLocations WHERE SubLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", subLocID) });

                txtFormStatus.Text = "✅ تم الحذف بنجاح";
                MessageBox.Show("تم الحذف بنجاح!", "نجاح", MessageBoxButton.OK, MessageBoxImage.Information);

                RefreshAllData();
                ClearFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الحذف:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnToggleActive_Click(object sender, RoutedEventArgs e)
        {
            if (dgSubLocations.SelectedItem == null) return;

            try
            {
                int subLocID = Convert.ToInt32(txtSubLocationID.Text);
                bool newStatus = !(chkIsActive.IsChecked == true);
                string statusText = newStatus ? "تفعيل" : "تعطيل";

                MessageBoxResult result = MessageBox.Show(
                    "هل تريد " + statusText + " الموقع:\n" + txtSubLocationName.Text + "؟",
                    statusText, MessageBoxButton.YesNo, MessageBoxImage.Question);

                if (result != MessageBoxResult.Yes) return;

                DatabaseHelper.ExecuteNonQuery(
                    "UPDATE tblSubLocations SET IsActive = @Active, ModifiedDate = GETDATE() WHERE SubLocationID = @ID",
                    new SqlParameter[] {
                        new SqlParameter("@Active", newStatus ? 1 : 0),
                        new SqlParameter("@ID", subLocID)
                    });

                txtFormStatus.Text = "✅ تم " + statusText + " الموقع";
                RefreshAllData();
                ClearFields();
                SetReadMode();
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ:\n" + ex.Message, "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private void btnCancel_Click(object sender, RoutedEventArgs e)
        {
            ClearFields();
            SetReadMode();
            dgSubLocations.SelectedItem = null;
            txtFormStatus.Text = "تم الإلغاء";
        }

        // ═══════════════════════════════════════════════════
        // حدث اختيار سجل من الجدول
        // ═══════════════════════════════════════════════════
        private void dgSubLocations_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (dgSubLocations.SelectedItem == null) return;

            DataRowView row = dgSubLocations.SelectedItem as DataRowView;
            if (row == null) return;

            isLoadingData = true;

            txtSubLocationID.Text = row["SubLocationID"].ToString();
            txtSubLocationCode.Text = row["SubLocationCode"] != DBNull.Value ? row["SubLocationCode"].ToString() : "";
            txtSubLocationName.Text = row["SubLocationName"].ToString();
            txtFullPath.Text = row["FullPath"] != DBNull.Value ? row["FullPath"].ToString() : "";
            txtLevelNumber.Text = row["LevelNumber"].ToString();
            chkIsActive.IsChecked = row["IsActive"] != DBNull.Value && Convert.ToBoolean(row["IsActive"]);

            // تحميل المبنى والأب من قاعدة البيانات
            int subLocID = Convert.ToInt32(txtSubLocationID.Text);
            DataTable dtFull = DatabaseHelper.GetData(
                "SELECT MainLocationID, ParentSubLocationID, Description FROM tblSubLocations WHERE SubLocationID = @ID",
                new SqlParameter[] { new SqlParameter("@ID", subLocID) });

            if (dtFull.Rows.Count > 0)
            {
                DataRow fullRow = dtFull.Rows[0];

                int mainLocID = Convert.ToInt32(fullRow["MainLocationID"]);
                cmbMainLocation.SelectedValue = mainLocID;

                LoadParentSubLocations(mainLocID, subLocID);

                if (fullRow["ParentSubLocationID"] != DBNull.Value)
                {
                    cmbParentSubLocation.SelectedValue = Convert.ToInt32(fullRow["ParentSubLocationID"]);
                }

                txtDescription.Text = fullRow["Description"] != DBNull.Value ? fullRow["Description"].ToString() : "";
            }

            isLoadingData = false;

            btnEdit.IsEnabled = true;
            btnDelete.IsEnabled = true;
            btnToggleActive.IsEnabled = true;

            txtFormStatus.Text = "تم اختيار: " + txtSubLocationCode.Text + " - " + txtSubLocationName.Text;
        }

        // ═══════════════════════════════════════════════════
        // تحديث الكل
        // ═══════════════════════════════════════════════════
        private void RefreshAllData()
        {
            if (cmbTreeMainLocation.SelectedValue != null)
            {
                int mainLocID = Convert.ToInt32(cmbTreeMainLocation.SelectedValue);
                BuildTree(mainLocID);
                LoadGridData(mainLocID);
            }
        }
    }
}