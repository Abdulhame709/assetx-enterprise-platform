// Views/AssetsView.xaml.cs
using System;
using System.Collections.Generic;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Threading;
using AssetManagement.Helpers;
using AssetManagement.Models;
using AssetManagement.Services;

namespace AssetManagement.Views
{
    /// <summary>
    /// نافذة إدارة الأصول الثابتة - الشاشة الرئيسية
    /// تتضمن: إضافة/تعديل/حذف/بحث/دمج/تنقل/تعديل جماعي + حماية الأصول المرتبطة
    /// </summary>
    public partial class AssetsView : UserControl
    {
        // ═══════════════════════════════════════════════════════════
        // المتغيرات العامة (Class-Level Fields)
        // ═══════════════════════════════════════════════════════════

        #region Fields

        private AssetService _assetService;
        private Asset _currentAsset;
        private List<Asset> _assetsList;
        private int _currentIndex;
        private bool _isNewRecord;
        private bool _isDirty;
        private bool _isLoading;
        private bool _isInitialized;
        private string _originalAssetName;
        private string _originalBaseCode;
        private DispatcherTimer _clockTimer;
        private DispatcherTimer _searchTimer;

        private List<LookupItem> _assetTypes;
        private List<LookupItem> _mainLocations;
        private List<LookupItem> _statuses;
        private List<LookupItem> _models;
        private List<LookupItem> _employees;

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 1: التهيئة والتحميل
        // ═══════════════════════════════════════════════════════════

        #region Initialization

        public AssetsView()
        {
            InitializeComponent();

            _assetService = new AssetService();
            _assetsList = new List<Asset>();
            _currentIndex = -1;
            _isNewRecord = true;
            _isDirty = false;
            _isLoading = false;
            _isInitialized = false;
        }

        private void UserControl_Loaded(object sender, RoutedEventArgs e)
        {
            if (_isInitialized)
                return;

            try
            {
                _isLoading = true;

                LoadAllDropdowns();
                LoadAssetNameAutoComplete();
                RefreshRecentAssetsList();

                // 1. تحميل القائمة
                LoadAssetsForNavigation();

                SetupClockTimer();
                SetupSearchTimer();

                // 2. عرض أول أصل إذا كانت القائمة غير فارغة
                if (_assetsList != null && _assetsList.Count > 0)
                {
                    _currentIndex = 0;
                    LoadAssetToForm(_assetsList[0]);
                }
                else
                {
                    SetupNewRecord();
                }

                AttachChangeTracking();
                UpdateStatusBar("جاهز للعمل");
                UpdateTotalCount();

                _isInitialized = true;
            }
            catch (Exception ex)
            {
                ShowError("خطأ في تحميل النافذة: " + ex.Message);
            }
            finally
            {
                _isLoading = false;
            }
        }
        private void LoadAllDropdowns()
        {
            try
            {
                _assetTypes = _assetService.GetAssetTypes();
                cmbAssetType.ItemsSource = _assetTypes;

                _mainLocations = _assetService.GetMainLocations();
                cmbMainLocation.ItemsSource = _mainLocations;

                _statuses = _assetService.GetStatuses();
                cmbStatus.ItemsSource = _statuses;

                _models = _assetService.GetModels();
                cmbModel.ItemsSource = _models;

                _employees = _assetService.GetEmployees();
                cmbEmployee.ItemsSource = _employees;
            }
            catch (Exception ex)
            {
                ShowError("خطأ في تحميل القوائم: " + ex.Message);
            }
        }

        private void LoadAssetNameAutoComplete()
        {
            try
            {
                List<string> names = _assetService.GetDistinctAssetNames();
                cmbAssetName.ItemsSource = names;
            }
            catch { }
        }

        private void LoadAssetsForNavigation()
        {
            try
            {
                // ✅ الآن سيتم تحميل كافة الأصول الـ 1982 وليس 500 فقط
                _assetsList = _assetService.GetAllAssets();

                UpdateRecordCounter();

                // تحميل أول أصل في القائمة تلقائياً إذا كانت القائمة فارغة حالياً
                if (_assetsList.Count > 0 && _currentIndex == -1)
                {
                    _currentIndex = 0;
                    LoadAssetToForm(_assetsList[0]);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في LoadAssetsForNavigation: " + ex.Message);
            }
        }

        private void RefreshRecentAssetsList()
        {
            try
            {
                // ✅ عرض آخر 100 أصل في القائمة الجانبية
                List<Asset> recent = _assetService.GetRecentAssets(100);
                lstRecentAssets.ItemsSource = recent;
            }
            catch { }
        }

        private void SetupClockTimer()
        {
            _clockTimer = new DispatcherTimer();
            _clockTimer.Interval = TimeSpan.FromSeconds(30);
            _clockTimer.Tick += delegate
            {
                txtClock.Text = DateTime.Now.ToString("hh:mm tt");
            };
            _clockTimer.Start();
            txtClock.Text = DateTime.Now.ToString("hh:mm tt");
        }

        private void SetupSearchTimer()
        {
            _searchTimer = new DispatcherTimer();
            _searchTimer.Interval = TimeSpan.FromMilliseconds(300);
            _searchTimer.Tick += SearchTimer_Tick;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 2: تحميل وتفريغ النموذج
        // ═══════════════════════════════════════════════════════════

        #region Load/Clear Form

        private void SetupNewRecord()
        {
            _isLoading = true;
            _isNewRecord = true;
            _isDirty = false;

            _currentAsset = new Asset();
            _currentAsset.InventoryYear = DateTime.Now.Year;
            _currentAsset.Quantity = 1;

            ClearAllFields();

            txtQuantity.Text = "1";
            txtInventoryYear.Text = DateTime.Now.Year.ToString();

            txtRecordInfo.Text = "📝 سجل جديد";
            txtBaseCodeDisplay.Text = "سيُولَّد تلقائياً";
            txtFullCodeDisplay.Text = "---";

            pnlLocations.Visibility = Visibility.Collapsed;
            pnlDuplicateWarning.Visibility = Visibility.Collapsed;

            _originalAssetName = "";
            _originalBaseCode = "";

            Dispatcher.BeginInvoke(new Action(() =>
            {
                cmbAssetType.Focus();
            }), DispatcherPriority.Background);

            UpdateButtonStates();
            UpdateRecordStatus("سجل جديد");

            _isLoading = false;
        }

        private void ClearAllFields()
        {
            cmbAssetType.SelectedIndex = -1;
            cmbSubType.SelectedIndex = -1;
            cmbSubType.ItemsSource = null;
            cmbSubType.IsEnabled = false;

            cmbAssetName.Text = "";
            cmbAssetName.SelectedIndex = -1;

            cmbMainLocation.SelectedIndex = -1;
            cmbSubLocation.SelectedIndex = -1;
            cmbSubLocation.ItemsSource = null;
            cmbSubLocation.IsEnabled = false;

            cmbStatus.SelectedIndex = -1;
            txtQuantity.Text = "1";
            cmbModel.SelectedIndex = -1;
            cmbEmployee.SelectedIndex = -1;
            txtDescription.Text = "";

            txtPurchasePrice.Text = "";
            dpPurchaseDate.SelectedDate = null;
            txtDepreciationRate.Text = "";
            txtUsefulLife.Text = "";
            txtBookValue.Text = "---";
            prgDepreciation.Value = 0;
            txtDepreciationPercent.Text = "0%";
            txtAssetAge.Text = "---";

            txtSerialNumber.Text = "";
            txtBarcode.Text = "";
            txtReferenceNumber.Text = "";
            txtInventoryYear.Text = DateTime.Now.Year.ToString();
            txtNotes.Text = "";

            runDateEntered.Text = "---";
            runCreatedBy.Text = "---";
            runModifiedDate.Text = "---";
            runModifiedBy.Text = "---";
        }

        private void LoadAssetToForm(Asset asset)
        {
            if (asset == null) return;

            _isLoading = true;

            try
            {
                _currentAsset = asset;
                _isNewRecord = false;
                _isDirty = false;

                _originalAssetName = asset.AssetName ?? "";
                _originalBaseCode = asset.BaseAssetCode ?? "";

                SetComboBoxValue(cmbAssetType, asset.AssetTypeID);

                if (asset.AssetTypeID.HasValue && asset.AssetTypeID.Value > 0)
                {
                    LoadSubTypes(asset.AssetTypeID.Value);
                    SetComboBoxValue(cmbSubType, asset.SubTypeID);
                }

                cmbAssetName.Text = asset.AssetName ?? "";

                SetComboBoxValue(cmbMainLocation, asset.MainLocationID);

                if (asset.MainLocationID.HasValue && asset.MainLocationID.Value > 0)
                {
                    LoadSubLocations(asset.MainLocationID.Value);
                    SetComboBoxValue(cmbSubLocation, asset.SubLocationID);
                }

                SetComboBoxValue(cmbStatus, asset.StatusID);
                txtQuantity.Text = asset.Quantity.ToString();
                SetComboBoxValue(cmbModel, asset.ModelID);
                SetComboBoxValue(cmbEmployee, asset.EmployeeID);
                txtDescription.Text = asset.Description ?? "";

                txtPurchasePrice.Text = asset.PurchasePrice.HasValue
                    ? asset.PurchasePrice.Value.ToString("N2") : "";
                dpPurchaseDate.SelectedDate = asset.PurchaseDate;
                txtDepreciationRate.Text = asset.DepreciationRate.HasValue
                    ? asset.DepreciationRate.Value.ToString() : "";
                txtUsefulLife.Text = asset.UsefulLife.HasValue
                    ? asset.UsefulLife.Value.ToString() : "";

                UpdateCalculatedValues();

                txtSerialNumber.Text = asset.SerialNumber ?? "";
                txtBarcode.Text = asset.Barcode ?? "";
                txtReferenceNumber.Text = asset.ReferenceNumber ?? "";
                txtInventoryYear.Text = asset.InventoryYear.HasValue
                    ? asset.InventoryYear.Value.ToString() : "";
                txtNotes.Text = asset.Notes ?? "";

                runDateEntered.Text = asset.DateEntered.ToString("yyyy/MM/dd HH:mm");
                runCreatedBy.Text = asset.CreatedBy ?? "---";
                runModifiedDate.Text = asset.ModifiedDate.HasValue
                    ? asset.ModifiedDate.Value.ToString("yyyy/MM/dd HH:mm") : "---";
                runModifiedBy.Text = asset.ModifiedBy ?? "---";

                txtRecordInfo.Text = string.Format("سجل #{0} | {1}", asset.AssetID, asset.AssetName);
                txtBaseCodeDisplay.Text = asset.BaseAssetCode ?? "---";
                txtFullCodeDisplay.Text = asset.FullAssetCode ?? "---";

                LoadAssetLocations();

                pnlDuplicateWarning.Visibility = Visibility.Collapsed;

                UpdateButtonStates();
                UpdateRecordCounter();
                UpdateRecordStatus("عرض السجل");
            }
            catch (Exception ex)
            {
                ShowError("خطأ في تحميل البيانات: " + ex.Message);
            }
            finally
            {
                _isLoading = false;
            }
        }

        private Asset ReadFormToAsset()
        {
            Asset asset = _currentAsset ?? new Asset();

            asset.AssetTypeID = GetComboBoxValue(cmbAssetType);
            asset.SubTypeID = GetComboBoxValue(cmbSubType);
            asset.AssetName = (cmbAssetName.Text ?? "").Trim();
            asset.MainLocationID = GetComboBoxValue(cmbMainLocation);
            asset.SubLocationID = GetComboBoxValue(cmbSubLocation);
            asset.StatusID = GetComboBoxValue(cmbStatus);
            asset.ModelID = GetComboBoxValue(cmbModel);
            asset.EmployeeID = GetComboBoxValue(cmbEmployee);
            asset.Description = string.IsNullOrWhiteSpace(txtDescription.Text)
                ? null : txtDescription.Text.Trim();

            int qty;
            asset.Quantity = int.TryParse(txtQuantity.Text, out qty) ? qty : 1;

            decimal price;
            asset.PurchasePrice = decimal.TryParse(txtPurchasePrice.Text, out price)
                ? (decimal?)price : null;

            asset.PurchaseDate = dpPurchaseDate.SelectedDate;

            decimal depRate;
            asset.DepreciationRate = decimal.TryParse(txtDepreciationRate.Text, out depRate)
                ? (decimal?)depRate : null;

            int usefulLife;
            asset.UsefulLife = int.TryParse(txtUsefulLife.Text, out usefulLife)
                ? (int?)usefulLife : null;

            asset.SerialNumber = string.IsNullOrWhiteSpace(txtSerialNumber.Text)
                ? null : txtSerialNumber.Text.Trim();
            asset.Barcode = string.IsNullOrWhiteSpace(txtBarcode.Text)
                ? null : txtBarcode.Text.Trim();
            asset.ReferenceNumber = string.IsNullOrWhiteSpace(txtReferenceNumber.Text)
                ? null : txtReferenceNumber.Text.Trim();

            int invYear;
            asset.InventoryYear = int.TryParse(txtInventoryYear.Text, out invYear)
                ? (int?)invYear : null;

            asset.Notes = string.IsNullOrWhiteSpace(txtNotes.Text)
                ? null : txtNotes.Text.Trim();

            return asset;
        }

        private void UpdateCalculatedValues()
        {
            if (_currentAsset == null) return;

            try
            {
                decimal bookValue = _currentAsset.CurrentBookValue;
                if (_currentAsset.PurchasePrice.HasValue && _currentAsset.PurchasePrice.Value > 0)
                {
                    txtBookValue.Text = bookValue.ToString("N2");
                }
                else
                {
                    txtBookValue.Text = "---";
                }

                decimal depPercent = _currentAsset.DepreciationPercentage;
                prgDepreciation.Value = (double)depPercent;
                txtDepreciationPercent.Text = depPercent.ToString("N1") + "%";

                txtAssetAge.Text = _currentAsset.AssetAge;
            }
            catch
            {
                txtBookValue.Text = "---";
                prgDepreciation.Value = 0;
                txtDepreciationPercent.Text = "0%";
                txtAssetAge.Text = "---";
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 3: الحفظ والتحقق (مع حماية الأصول المرتبطة) ⭐
        // ═══════════════════════════════════════════════════════════

        #region Save & Validation

        private void SaveCurrentRecord()
        {
            try
            {
                Asset asset = ReadFormToAsset();

                string validationError;
                if (!asset.Validate(out validationError))
                {
                    ShowWarning(validationError);
                    return;
                }

                if (_isNewRecord)
                {
                    SaveNewAsset(asset);
                }
                else
                {
                    // ═══ ⭐ فحص حماية الأصل المرتبط قبل التعديل ═══
                    if (!AssetProtectionHelper.CanEditAsset(asset.AssetID))
                    {
                        return; // ممنوع التعديل
                    }

                    SaveExistingAsset(asset);
                }
            }
            catch (Exception ex)
            {
                ShowError("خطأ في الحفظ: " + ex.Message);
            }
        }

        private void SaveNewAsset(Asset asset)
        {
            List<SimilarAssetResult> similarNames =
                _assetService.FindSimilarAssetNames(asset.AssetName);

            if (similarNames.Count > 0)
            {
                string similarList = "تم العثور على أسماء مشابهة:\n\n";
                int count = 0;
                foreach (SimilarAssetResult sim in similarNames)
                {
                    if (count >= 5) break;
                    similarList += string.Format("• {0} (تشابه {1}%)\n",
                        sim.AssetName, sim.SimilarityPercentage);
                    count++;
                }
                similarList += "\nهل تريد المتابعة رغم ذلك؟";

                MessageBoxResult answer = MessageBox.Show(
                    similarList, "⚠️ أسماء مشابهة",
                    MessageBoxButton.YesNoCancel, MessageBoxImage.Warning);

                if (answer == MessageBoxResult.Cancel)
                    return;

                if (answer == MessageBoxResult.No)
                {
                    cmbAssetName.Focus();
                    return;
                }
            }

            SaveResult result = _assetService.AddAsset(asset);

            if (result.RequiresMergeConfirmation)
            {
                HandleMergeConfirmation(result);
                return;
            }

            if (result.Success)
            {
                if (result.IsNewVariant)
                {
                    ShowInfo(string.Format(
                        "✅ تم إضافة الأصل كمتغير جديد\n\n" +
                        "الكود الأساسي: {0}\nالكود الكامل: {1}\n\n" +
                        "الاختلافات عن السجل الموجود:\n{2}",
                        result.BaseAssetCode, result.FullAssetCode,
                        result.Differences ?? "لا توجد"));
                }
                else
                {
                    ShowSuccess(string.Format(
                        "✅ تم إضافة الأصل بنجاح\n\nالكود: {0}",
                        result.FullAssetCode));
                }

                AfterSaveSuccess(result.NewAssetID);
            }
            else
            {
                ShowError("❌ " + result.Message);
            }
        }

        private void HandleMergeConfirmation(SaveResult result)
        {
            string mergeMessage = string.Format(
                "يوجد سجل مطابق تماماً!\n\n" +
                "الكمية الحالية: {0}\n" +
                "الكمية المراد إضافتها: {1}\n" +
                "الكمية الإجمالية بعد الدمج: {2}\n\n" +
                "هل تريد دمج الكميات؟",
                result.CurrentQuantity, result.MergeQuantity, result.NewTotalQuantity);

            MessageBoxResult answer = MessageBox.Show(
                mergeMessage, "🔄 دمج الكميات",
                MessageBoxButton.YesNoCancel, MessageBoxImage.Question);

            if (answer == MessageBoxResult.Yes)
            {
                SaveResult mergeResult = _assetService.ConfirmMerge(
                    result.ExistingAssetID, result.MergeQuantity);

                if (mergeResult.Success)
                {
                    ShowSuccess(mergeResult.Message);
                    AfterSaveSuccess(result.ExistingAssetID);
                }
                else
                {
                    ShowError("❌ " + mergeResult.Message);
                }
            }
            else if (answer == MessageBoxResult.No)
            {
                ShowInfo("تم الإلغاء. يمكنك تغيير البيانات وحفظها كسجل مختلف.");
            }
        }

        private void SaveExistingAsset(Asset asset)
        {
            bool nameChanged = !string.Equals(
                (asset.AssetName ?? "").Trim(),
                (_originalAssetName ?? "").Trim(),
                StringComparison.OrdinalIgnoreCase);

            if (nameChanged)
            {
                List<SimilarAssetResult> similar =
                    _assetService.FindSimilarAssetNames(asset.AssetName, asset.AssetID);

                if (similar.Count > 0)
                {
                    string msg = "الاسم الجديد مشابه لأسماء موجودة:\n";
                    foreach (SimilarAssetResult s in similar.Take(3))
                    {
                        msg += string.Format("• {0} ({1}%)\n", s.AssetName, s.SimilarityPercentage);
                    }
                    msg += "\nهل تريد المتابعة؟";

                    if (MessageBox.Show(msg, "تحذير", MessageBoxButton.YesNo,
                        MessageBoxImage.Warning) != MessageBoxResult.Yes)
                        return;
                }

                string existingCode = _assetService.GetExistingBaseCode(asset.AssetName, asset.AssetID);
                if (!string.IsNullOrEmpty(existingCode))
                {
                    asset.BaseAssetCode = existingCode;
                }
                else
                {
                    asset.BaseAssetCode = _assetService.GenerateUniqueBaseCode();
                }

                asset.FullAssetCode = _assetService.GenerateUniqueFullCode(
                    asset.BaseAssetCode, asset.MainLocationID ?? 0);
            }

            SaveResult result = _assetService.UpdateAsset(asset);

            if (result.Success)
            {
                ShowSuccess("✅ تم تحديث الأصل بنجاح");

                // تسجيل في سجل التدقيق
                try
                {
                    AuditLogHelper.LogUpdate("tblAssets", asset.AssetID,
                        "تعديل أصل: " + _originalAssetName,
                        "الاسم الجديد: " + asset.AssetName);
                }
                catch { }

                AfterSaveSuccess(asset.AssetID);
            }
            else
            {
                ShowError("❌ " + result.Message);
            }
        }

        private void AfterSaveSuccess(int assetID)
        {
            _isDirty = false;

            LoadAssetsForNavigation();
            RefreshRecentAssetsList();
            LoadAssetNameAutoComplete();
            NavigateToAssetByID(assetID);
            UpdateTotalCount();
        }

        private bool CanLeaveCurrentRecord()
        {
            if (!_isDirty)
                return true;

            MessageBoxResult answer = MessageBox.Show(
                "يوجد تغييرات غير محفوظة.\nهل تريد حفظها قبل المغادرة؟",
                "⚠️ تغييرات غير محفوظة",
                MessageBoxButton.YesNoCancel, MessageBoxImage.Warning);

            if (answer == MessageBoxResult.Yes)
            {
                SaveCurrentRecord();
                return !_isDirty;
            }

            if (answer == MessageBoxResult.No)
            {
                _isDirty = false;
                return true;
            }

            return false;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 4: التنقل بين السجلات
        // ═══════════════════════════════════════════════════════════

        #region Navigation

        private void NavigateToAssetByID(int assetID)
        {
            try
            {
                for (int i = 0; i < _assetsList.Count; i++)
                {
                    if (_assetsList[i].AssetID == assetID)
                    {
                        _currentIndex = i;
                        LoadAssetToForm(_assetsList[i]);
                        return;
                    }
                }

                Asset asset = _assetService.GetAssetByID(assetID);
                if (asset != null)
                {
                    _assetsList.Insert(0, asset);
                    _currentIndex = 0;
                    LoadAssetToForm(asset);
                }
                else
                {
                    ShowWarning("لم يتم العثور على السجل!");
                }
            }
            catch (Exception ex)
            {
                ShowError("خطأ في الانتقال: " + ex.Message);
            }
        }

        private void NavigateToSelectedRecentAsset()
        {
            if (lstRecentAssets.SelectedItem == null) return;
            if (!CanLeaveCurrentRecord()) return;

            Asset selected = lstRecentAssets.SelectedItem as Asset;
            if (selected != null)
            {
                NavigateToAssetByID(selected.AssetID);
            }
        }

        private void NavigateFirst()
        {
            if (_assetsList.Count == 0) return;
            if (!CanLeaveCurrentRecord()) return;
            _currentIndex = 0;
            LoadAssetToForm(_assetsList[0]);
        }

        private void NavigatePrevious()
        {
            if (_assetsList.Count == 0 || _currentIndex <= 0) return;
            if (!CanLeaveCurrentRecord()) return;
            _currentIndex--;
            LoadAssetToForm(_assetsList[_currentIndex]);
        }

        private void NavigateNext()
        {
            if (_assetsList.Count == 0 || _currentIndex >= _assetsList.Count - 1) return;
            if (!CanLeaveCurrentRecord()) return;
            _currentIndex++;
            LoadAssetToForm(_assetsList[_currentIndex]);
        }

        private void NavigateLast()
        {
            if (_assetsList.Count == 0) return;
            if (!CanLeaveCurrentRecord()) return;
            _currentIndex = _assetsList.Count - 1;
            LoadAssetToForm(_assetsList[_currentIndex]);
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 5: البحث الذكي
        // ═══════════════════════════════════════════════════════════

        #region Smart Search

        private void txtSearch_TextChanged(object sender, TextChangedEventArgs e)
        {
            txtSearchPlaceholder.Visibility =
                string.IsNullOrEmpty(txtSearch.Text)
                    ? Visibility.Visible : Visibility.Collapsed;

            _searchTimer.Stop();

            if (string.IsNullOrWhiteSpace(txtSearch.Text) ||
                txtSearch.Text.Trim().Length < 2)
            {
                lstSuggestions.Visibility = Visibility.Collapsed;
                lstSuggestions.ItemsSource = null;
                return;
            }

            _searchTimer.Start();
        }

        private void SearchTimer_Tick(object sender, EventArgs e)
        {
            _searchTimer.Stop();
            PerformSearch();
        }

        private void PerformSearch()
        {
            string searchText = txtSearch.Text.Trim();
            if (searchText.Length < 2) return;

            try
            {
                List<Asset> results = _assetService.SmartSearch(searchText, 15);

                if (results.Count > 0)
                {
                    lstSuggestions.ItemsSource = results;
                    lstSuggestions.Visibility = Visibility.Visible;
                }
                else
                {
                    lstSuggestions.ItemsSource = null;
                    lstSuggestions.Visibility = Visibility.Collapsed;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في البحث: " + ex.Message);
            }
        }

        private void txtSearch_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                if (lstSuggestions.Visibility == Visibility.Visible &&
                    lstSuggestions.Items.Count > 0)
                {
                    lstSuggestions.SelectedIndex = 0;
                    NavigateToSearchResult();
                }
                e.Handled = true;
            }
            else if (e.Key == Key.Down)
            {
                if (lstSuggestions.Visibility == Visibility.Visible &&
                    lstSuggestions.Items.Count > 0)
                {
                    lstSuggestions.SelectedIndex = 0;
                    lstSuggestions.Focus();
                }
                e.Handled = true;
            }
            else if (e.Key == Key.Escape)
            {
                ClearSearch();
                e.Handled = true;
            }
        }

        private void lstSuggestions_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                NavigateToSearchResult();
                e.Handled = true;
            }
            else if (e.Key == Key.Escape)
            {
                ClearSearch();
                txtSearch.Focus();
                e.Handled = true;
            }
        }

        private void lstSuggestions_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            NavigateToSearchResult();
        }

        private void lstSuggestions_SelectionChanged(object sender, SelectionChangedEventArgs e) { }

        private void NavigateToSearchResult()
        {
            if (lstSuggestions.SelectedItem == null) return;

            Asset selected = lstSuggestions.SelectedItem as Asset;
            if (selected == null) return;

            if (!CanLeaveCurrentRecord()) return;

            NavigateToAssetByID(selected.AssetID);
            ClearSearch();
        }

        private void ClearSearch()
        {
            txtSearch.Text = "";
            lstSuggestions.ItemsSource = null;
            lstSuggestions.Visibility = Visibility.Collapsed;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 6: أحداث القوائم المنسدلة
        // ═══════════════════════════════════════════════════════════

        #region Dropdown Events

        private void cmbAssetType_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_isLoading) return;

            int? typeID = GetComboBoxValue(cmbAssetType);

            if (typeID.HasValue && typeID.Value > 0)
            {
                LoadSubTypes(typeID.Value);
                List<LookupItem> filteredModels = _assetService.GetModels(typeID.Value);
                cmbModel.ItemsSource = filteredModels;
            }
            else
            {
                cmbSubType.ItemsSource = null;
                cmbSubType.IsEnabled = false;
                cmbModel.ItemsSource = _models;
            }

            cmbSubType.SelectedIndex = -1;
            MarkAsDirty();
            CheckForDuplicateWarning();
        }

        private void LoadSubTypes(int assetTypeID)
        {
            try
            {
                List<LookupItem> subTypes = _assetService.GetSubTypes(assetTypeID);
                cmbSubType.ItemsSource = subTypes;
                cmbSubType.IsEnabled = subTypes.Count > 0;
            }
            catch { cmbSubType.IsEnabled = false; }
        }

        private void cmbMainLocation_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (_isLoading) return;

            int? locID = GetComboBoxValue(cmbMainLocation);

            if (locID.HasValue && locID.Value > 0)
            {
                LoadSubLocations(locID.Value);
            }
            else
            {
                cmbSubLocation.ItemsSource = null;
                cmbSubLocation.IsEnabled = false;
            }

            cmbSubLocation.SelectedIndex = -1;
            MarkAsDirty();
            CheckForDuplicateWarning();
        }

        private void LoadSubLocations(int mainLocationID)
        {
            try
            {
                List<LookupItem> subLocs = _assetService.GetSubLocations(mainLocationID);
                cmbSubLocation.ItemsSource = subLocs;
                cmbSubLocation.IsEnabled = subLocs.Count > 0;
            }
            catch { cmbSubLocation.IsEnabled = false; }
        }

        private void cmbAssetName_LostFocus(object sender, RoutedEventArgs e)
        {
            if (_isLoading) return;

            string name = (cmbAssetName.Text ?? "").Trim();
            if (string.IsNullOrEmpty(name)) return;

            MarkAsDirty();
            CheckForDuplicateWarning();

            string existingCode = _assetService.GetExistingBaseCode(name,
                _currentAsset != null ? _currentAsset.AssetID : 0);

            if (!string.IsNullOrEmpty(existingCode))
            {
                UpdateStatusBar(string.Format(
                    "💡 الاسم موجود مسبقاً بالكود: {0} (سيتم مشاركة الكود)",
                    existingCode));
            }
        }

        private void cmbAssetName_KeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Enter)
            {
                cmbMainLocation.Focus();
                e.Handled = true;
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 7: أحداث الأزرار (مع حماية الأصول المرتبطة) ⭐
        // ═══════════════════════════════════════════════════════════

        #region Button Events

        private void btnNew_Click(object sender, RoutedEventArgs e)
        {
            if (!CanLeaveCurrentRecord()) return;
            SetupNewRecord();
        }

        private void btnSave_Click(object sender, RoutedEventArgs e)
        {
            SaveCurrentRecord();
        }

        private void btnCopyFrom_Click(object sender, RoutedEventArgs e)
        {
            if (_currentAsset == null || _isNewRecord)
            {
                ShowWarning("لا يوجد سجل للنسخ منه!");
                return;
            }

            if (!CanLeaveCurrentRecord()) return;

            try
            {
                Asset copy = Asset.CreateCopyFrom(_currentAsset);

                SetupNewRecord();

                _currentAsset = copy;
                _isLoading = true;

                SetComboBoxValue(cmbAssetType, copy.AssetTypeID);

                if (copy.AssetTypeID.HasValue && copy.AssetTypeID.Value > 0)
                {
                    LoadSubTypes(copy.AssetTypeID.Value);
                    SetComboBoxValue(cmbSubType, copy.SubTypeID);
                }

                cmbAssetName.Text = copy.AssetName ?? "";

                SetComboBoxValue(cmbMainLocation, copy.MainLocationID);

                if (copy.MainLocationID.HasValue && copy.MainLocationID.Value > 0)
                {
                    LoadSubLocations(copy.MainLocationID.Value);
                    SetComboBoxValue(cmbSubLocation, copy.SubLocationID);
                }

                SetComboBoxValue(cmbStatus, copy.StatusID);
                txtQuantity.Text = "1";
                SetComboBoxValue(cmbModel, copy.ModelID);
                SetComboBoxValue(cmbEmployee, copy.EmployeeID);
                txtDescription.Text = copy.Description ?? "";

                txtPurchasePrice.Text = copy.PurchasePrice.HasValue
                    ? copy.PurchasePrice.Value.ToString("N2") : "";
                dpPurchaseDate.SelectedDate = copy.PurchaseDate;
                txtDepreciationRate.Text = copy.DepreciationRate.HasValue
                    ? copy.DepreciationRate.Value.ToString() : "";
                txtUsefulLife.Text = copy.UsefulLife.HasValue
                    ? copy.UsefulLife.Value.ToString() : "";

                txtReferenceNumber.Text = copy.ReferenceNumber ?? "";
                txtNotes.Text = copy.Notes ?? "";

                _isLoading = false;

                txtRecordInfo.Text = "📝 نسخة جديدة من: " + copy.AssetName;

                if (!string.IsNullOrEmpty(copy.BaseAssetCode))
                {
                    txtBaseCodeDisplay.Text = copy.BaseAssetCode + " (سيُحدّث)";
                }

                _isDirty = true;

                txtQuantity.Focus();
                txtQuantity.SelectAll();

                ShowInfo("✅ تم نسخ البيانات. عدّل ما تريد ثم اضغط حفظ.");
            }
            catch (Exception ex)
            {
                ShowError("خطأ في النسخ: " + ex.Message);
            }
        }

        /// <summary>
        /// زر حذف - مع حماية الأصول المرتبطة ⭐
        /// </summary>
        private void btnDelete_Click(object sender, RoutedEventArgs e)
        {
            if (_currentAsset == null || _isNewRecord)
            {
                ShowWarning("لا يوجد سجل للحذف!");
                return;
            }

            // ═══ ⭐ فحص حماية الأصل المرتبط قبل الحذف ═══
            if (!AssetProtectionHelper.CanDeleteAsset(_currentAsset.AssetID))
            {
                return; // ممنوع الحذف
            }

            MessageBoxResult answer = MessageBox.Show(
                string.Format("هل أنت متأكد من حذف الأصل:\n\n{0}\nالكود: {1}",
                    _currentAsset.AssetName, _currentAsset.FullAssetCode),
                "🗑️ تأكيد الحذف",
                MessageBoxButton.YesNo, MessageBoxImage.Warning);

            if (answer != MessageBoxResult.Yes) return;

            try
            {
                bool deleted = _assetService.DeleteAsset(_currentAsset.AssetID);

                if (deleted)
                {
                    // تسجيل في سجل التدقيق
                    try
                    {
                        AuditLogHelper.LogDelete("tblAssets", _currentAsset.AssetID,
                            "حذف أصل: " + _currentAsset.AssetName +
                            " | الكود: " + _currentAsset.FullAssetCode);
                    }
                    catch { }

                    ShowSuccess("✅ تم حذف الأصل بنجاح");

                    _assetsList.RemoveAt(_currentIndex);

                    RefreshRecentAssetsList();
                    LoadAssetNameAutoComplete();
                    UpdateTotalCount();

                    if (_assetsList.Count > 0)
                    {
                        if (_currentIndex >= _assetsList.Count)
                            _currentIndex = _assetsList.Count - 1;
                        LoadAssetToForm(_assetsList[_currentIndex]);
                    }
                    else
                    {
                        SetupNewRecord();
                    }
                }
                else
                {
                    ShowError("❌ فشل في حذف الأصل!");
                }
            }
            catch (Exception ex)
            {
                ShowError("خطأ في الحذف: " + ex.Message);
            }
        }

        private void btnUndo_Click(object sender, RoutedEventArgs e)
        {
            if (_isNewRecord)
            {
                SetupNewRecord();
            }
            else if (_currentAsset != null)
            {
                Asset original = _assetService.GetAssetByID(_currentAsset.AssetID);
                if (original != null)
                {
                    LoadAssetToForm(original);
                    ShowInfo("↩️ تم التراجع عن التغييرات");
                }
            }
            _isDirty = false;
        }

        private void btnFirst_Click(object sender, RoutedEventArgs e) { NavigateFirst(); }
        private void btnPrevious_Click(object sender, RoutedEventArgs e) { NavigatePrevious(); }
        private void btnNext_Click(object sender, RoutedEventArgs e) { NavigateNext(); }
        private void btnLast_Click(object sender, RoutedEventArgs e) { NavigateLast(); }

        private void btnRefreshList_Click(object sender, RoutedEventArgs e)
        {
            // ════════════════════════════════════════
            // ✅ اختبار مباشر لقراءة البيانات من DB
            // ════════════════════════════════════════
            try
            {
                object total = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssets");

                System.Data.DataTable dt = DatabaseHelper.GetData(
                    "SELECT TOP 10 AssetID, AssetName, IsActive, DateEntered " +
                    "FROM tblAssets ORDER BY AssetID");

                string msg = "إجمالي الأصول في قاعدة البيانات: " + total + "\n\n";
                msg += "أول 10 أصول:\n\n";

                foreach (System.Data.DataRow row in dt.Rows)
                {
                    msg += string.Format(
                        "ID:{0} | {1} | Active:{2} | Date:{3}\n",
                        row["AssetID"],
                        row["AssetName"],
                        row["IsActive"],
                        row["DateEntered"]);
                }

                MessageBox.Show(msg, "🔍 اختبار قراءة قاعدة البيانات");
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الاختبار: " + ex.Message);
            }

            // ════════════════════════════════════════
            // الكود الأصلي
            // ════════════════════════════════════════
            RefreshRecentAssetsList();
            LoadAssetsForNavigation();
            UpdateTotalCount();
            ShowInfo("✅ تم تحديث القائمة");
        }

        private void lstRecentAssets_SelectionChanged(object sender, SelectionChangedEventArgs e) { }

        private void lstRecentAssets_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            NavigateToSelectedRecentAsset();
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 8: المواقع المتعددة
        // ═══════════════════════════════════════════════════════════

        #region Multiple Locations

        private void LoadAssetLocations()
        {
            if (_currentAsset == null ||
                string.IsNullOrEmpty(_currentAsset.BaseAssetCode))
            {
                pnlLocations.Visibility = Visibility.Collapsed;
                return;
            }

            try
            {
                List<Asset> locations = _assetService.GetAssetLocations(
                    _currentAsset.BaseAssetCode);

                if (locations.Count > 1)
                {
                    lstLocations.ItemsSource = locations;
                    pnlLocations.Visibility = Visibility.Visible;
                }
                else
                {
                    pnlLocations.Visibility = Visibility.Collapsed;
                }
            }
            catch
            {
                pnlLocations.Visibility = Visibility.Collapsed;
            }
        }

        private void lstLocations_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            if (lstLocations.SelectedItem == null) return;

            Asset selected = lstLocations.SelectedItem as Asset;
            if (selected != null && selected.AssetID != _currentAsset.AssetID)
            {
                if (CanLeaveCurrentRecord())
                {
                    NavigateToAssetByID(selected.AssetID);
                }
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 9: التحذير من التكرار
        // ═══════════════════════════════════════════════════════════

        #region Duplicate Warning

        private void CheckForDuplicateWarning()
        {
            if (_isLoading || !_isNewRecord) return;

            try
            {
                Asset tempAsset = ReadFormToAsset();

                if (string.IsNullOrWhiteSpace(tempAsset.AssetName))
                {
                    pnlDuplicateWarning.Visibility = Visibility.Collapsed;
                    return;
                }

                DuplicateCheckResult check = _assetService.CheckForDuplicates(tempAsset);

                switch (check.OperationType)
                {
                    case OperationType.Merge:
                        txtDuplicateWarning.Text =
                            "سيتم دمج الكمية مع سجل مطابق تماماً موجود مسبقاً";
                        pnlDuplicateWarning.Visibility = Visibility.Visible;
                        break;

                    case OperationType.NewVariant:
                        txtDuplicateWarning.Text =
                            "يوجد أصل بنفس الاسم - سيتم مشاركة الكود الأساسي مع كود كامل مختلف";
                        pnlDuplicateWarning.Visibility = Visibility.Visible;
                        break;

                    default:
                        pnlDuplicateWarning.Visibility = Visibility.Collapsed;
                        break;
                }
            }
            catch
            {
                pnlDuplicateWarning.Visibility = Visibility.Collapsed;
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 10: الأزرار الإضافية
        // ═══════════════════════════════════════════════════════════

        #region Additional Buttons

        private void btnBulkEdit_Click(object sender, RoutedEventArgs e)
        {
            ShowBulkEditMenu();
        }

        private void btnSimilar_Click(object sender, RoutedEventArgs e)
        {
            ShowSimilarAssetsDialog();
        }

        private void btnDeletedCodes_Click(object sender, RoutedEventArgs e)
        {
            ShowDeletedCodes();
        }

        private void btnPrint_Click(object sender, RoutedEventArgs e)
        {
            ShowPrintMenu();
        }

        private void ShowDeletedCodes()
        {
            try
            {
                string yearInput = ShowInputBox(
                    "أدخل السنة:", "الأكواد المحذوفة",
                    DateTime.Now.Year.ToString());

                if (string.IsNullOrEmpty(yearInput)) return;

                int year;
                if (!int.TryParse(yearInput, out year))
                {
                    ShowWarning("سنة غير صحيحة!");
                    return;
                }

                List<string> deletedCodes = _assetService.GetDeletedCodes(year);

                if (deletedCodes.Count == 0)
                {
                    ShowInfo(string.Format("لا توجد أكواد محذوفة في سنة {0}", year));
                    return;
                }

                string message = string.Format(
                    "الأكواد المحذوفة في سنة {0} (عدد: {1}):\n\n",
                    year, deletedCodes.Count);

                int showCount = Math.Min(deletedCodes.Count, 30);
                for (int i = 0; i < showCount; i++)
                {
                    message += "• " + deletedCodes[i] + "\n";
                }

                if (deletedCodes.Count > 30)
                {
                    message += string.Format("\n... و {0} أكواد أخرى",
                        deletedCodes.Count - 30);
                }

                ShowInfo(message);
            }
            catch (Exception ex)
            {
                ShowError("خطأ: " + ex.Message);
            }
        }

        private void ShowSimilarAssetsDialog()
        {
            try
            {
                string searchName = ShowInputBox(
                    "أدخل اسم الأصل للبحث عن مشابهات:", "بحث التشابه",
                    _currentAsset != null ? _currentAsset.AssetName : "");

                if (string.IsNullOrWhiteSpace(searchName)) return;

                List<SimilarAssetResult> results =
                    _assetService.FindSimilarAssetNames(searchName, 0, 0.50);

                if (results.Count == 0)
                {
                    ShowInfo("لم يتم العثور على أسماء مشابهة.");
                    return;
                }

                string message = string.Format(
                    "الأسماء المشابهة لـ \"{0}\":\n\n", searchName);

                foreach (SimilarAssetResult r in results)
                {
                    message += string.Format("• [{0}%] {1}  (كود: {2})\n",
                        r.SimilarityPercentage, r.AssetName, r.BaseAssetCode);
                }

                ShowInfo(message);
            }
            catch (Exception ex)
            {
                ShowError("خطأ: " + ex.Message);
            }
        }

        private void ShowBulkEditMenu()
        {
            // فحص صلاحية التعديل الجماعي
            if (CurrentUser.UserID > 0 && !CurrentUser.IsAdmin)
            {
                if (!CurrentUser.HasPermission("Assets", "edit"))
                {
                    ShowWarning("ليس لديك صلاحية التعديل الجماعي.\nهذه الميزة متاحة لمدير النظام فقط.");
                    return;
                }
            }

            string choice = ShowInputBox(
                "اختر طريقة تحديد الأصول:\n\n" +
                "1 - حسب الكود الأساسي\n" +
                "2 - حسب الاسم\n" +
                "3 - حسب الموقع\n" +
                "4 - حسب الحالة\n" +
                "5 - حسب النوع\n\n" +
                "أدخل رقم الاختيار:", "📝 التعديل الجماعي");

            if (string.IsNullOrEmpty(choice)) return;

            string filterType = "";
            string filterPrompt = "";

            switch (choice.Trim())
            {
                case "1": filterType = "basecode"; filterPrompt = "أدخل الكود الأساسي:"; break;
                case "2": filterType = "name"; filterPrompt = "أدخل اسم الأصل:"; break;
                case "3": filterType = "location"; filterPrompt = BuildLocationListPrompt(); break;
                case "4": filterType = "status"; filterPrompt = BuildStatusListPrompt(); break;
                case "5": filterType = "type"; filterPrompt = BuildTypeListPrompt(); break;
                default: ShowWarning("اختيار غير صحيح!"); return;
            }

            string filterValue = ShowInputBox(filterPrompt, "تحديد الأصول");
            if (string.IsNullOrEmpty(filterValue)) return;

            List<Asset> matchedAssets = _assetService.GetAssetsByFilter(filterType, filterValue);

            if (matchedAssets.Count == 0)
            {
                ShowWarning("لم يتم العثور على أصول مطابقة!");
                return;
            }

            string fieldChoice = ShowInputBox(
                string.Format("تم العثور على {0} أصل.\n\n" +
                "اختر الحقل المراد تعديله:\n\n" +
                "1 - الموقع الرئيسي\n" +
                "2 - الحالة\n" +
                "3 - الموظف المسؤول\n" +
                "4 - الكمية\n" +
                "5 - سنة الجرد\n\n" +
                "أدخل رقم الاختيار:", matchedAssets.Count),
                "اختيار الحقل");

            if (string.IsNullOrEmpty(fieldChoice)) return;

            string fieldName = "";
            string newValuePrompt = "";

            switch (fieldChoice.Trim())
            {
                case "1": fieldName = "MainLocationID"; newValuePrompt = BuildLocationListPrompt(); break;
                case "2": fieldName = "StatusID"; newValuePrompt = BuildStatusListPrompt(); break;
                case "3": fieldName = "EmployeeID"; newValuePrompt = "أدخل رقم الموظف:"; break;
                case "4": fieldName = "Quantity"; newValuePrompt = "أدخل الكمية الجديدة:"; break;
                case "5": fieldName = "InventoryYear"; newValuePrompt = "أدخل سنة الجرد:"; break;
                default: ShowWarning("اختيار غير صحيح!"); return;
            }

            string newValue = ShowInputBox(newValuePrompt, "القيمة الجديدة");
            if (string.IsNullOrEmpty(newValue)) return;

            MessageBoxResult confirm = MessageBox.Show(
                string.Format("سيتم تعديل {0} أصل.\nالحقل: {1}\nالقيمة الجديدة: {2}\n\nمتأكد؟",
                    matchedAssets.Count, fieldName, newValue),
                "تأكيد التعديل الجماعي",
                MessageBoxButton.YesNo, MessageBoxImage.Warning);

            if (confirm != MessageBoxResult.Yes) return;

            try
            {
                List<int> ids = matchedAssets.Select(a => a.AssetID).ToList();
                int parseValue;

                if (int.TryParse(newValue, out parseValue))
                {
                    int affected = _assetService.BulkUpdateField(ids, fieldName, parseValue);

                    // تسجيل في سجل التدقيق
                    try
                    {
                        AuditLogHelper.Log("تعديل", "tblAssets", null,
                            string.Format("تعديل جماعي: {0} سجل", affected),
                            string.Format("الحقل: {0} = {1}", fieldName, newValue));
                    }
                    catch { }

                    ShowSuccess(string.Format("✅ تم تعديل {0} سجل بنجاح", affected));
                }
                else
                {
                    ShowWarning("القيمة غير صحيحة!");
                    return;
                }

                RefreshRecentAssetsList();
                LoadAssetsForNavigation();

                if (_currentAsset != null && ids.Contains(_currentAsset.AssetID))
                {
                    Asset refreshed = _assetService.GetAssetByID(_currentAsset.AssetID);
                    if (refreshed != null) LoadAssetToForm(refreshed);
                }
            }
            catch (Exception ex)
            {
                ShowError("خطأ في التعديل الجماعي: " + ex.Message);
            }
        }

        private void ShowPrintMenu()
        {
            if (_currentAsset == null || _isNewRecord)
            {
                ShowWarning("لا يوجد سجل لطباعته!");
                return;
            }

            // ⭐ إضافة معلومات الارتباط في بطاقة الطباعة
            string linksSummary = AssetProtectionHelper.GetAssetLinksSummary(_currentAsset.AssetID);

            string assetInfo = string.Format(
                "═══════════════════════════════════\n" +
                "       بطاقة أصل ثابت\n" +
                "═══════════════════════════════════\n\n" +
                "الاسم: {0}\n" +
                "الكود الأساسي: {1}\n" +
                "الكود الكامل: {2}\n" +
                "النوع: {3}\n" +
                "الموقع: {4}\n" +
                "الحالة: {5}\n" +
                "الكمية: {6}\n" +
                "الموظف: {7}\n" +
                "سنة الجرد: {8}\n" +
                "الارتباطات: {9}\n",
                _currentAsset.AssetName,
                _currentAsset.BaseAssetCode,
                _currentAsset.FullAssetCode,
                _currentAsset.AssetTypeName ?? "---",
                _currentAsset.FullLocationText,
                _currentAsset.StatusName ?? "---",
                _currentAsset.Quantity,
                _currentAsset.EmployeeName ?? "---",
                _currentAsset.InventoryYear.HasValue
                    ? _currentAsset.InventoryYear.Value.ToString() : "---",
                linksSummary);

            if (_currentAsset.PurchasePrice.HasValue)
            {
                assetInfo += string.Format(
                    "\nسعر الشراء: {0:N2}\n" +
                    "القيمة الدفترية: {1:N2}\n",
                    _currentAsset.PurchasePrice.Value,
                    _currentAsset.CurrentBookValue);
            }

            if (!string.IsNullOrEmpty(_currentAsset.Notes))
            {
                assetInfo += "\nملاحظات: " + _currentAsset.Notes + "\n";
            }

            assetInfo += "\n═══════════════════════════════════";

            MessageBox.Show(assetInfo, "🖨️ بطاقة الأصل",
                MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private string BuildLocationListPrompt()
        {
            string prompt = "أدخل رقم الموقع:\n\n";
            if (_mainLocations != null)
                foreach (LookupItem loc in _mainLocations)
                    prompt += string.Format("{0} - {1}\n", loc.ID, loc.Name);
            return prompt;
        }

        private string BuildStatusListPrompt()
        {
            string prompt = "أدخل رقم الحالة:\n\n";
            if (_statuses != null)
                foreach (LookupItem s in _statuses)
                    prompt += string.Format("{0} - {1}\n", s.ID, s.Name);
            return prompt;
        }

        private string BuildTypeListPrompt()
        {
            string prompt = "أدخل رقم النوع:\n\n";
            if (_assetTypes != null)
                foreach (LookupItem t in _assetTypes)
                    prompt += string.Format("{0} - {1}\n", t.ID, t.Name);
            return prompt;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 11: اختصارات لوحة المفاتيح
        // ═══════════════════════════════════════════════════════════

        #region Keyboard Shortcuts

        public void HandleKeyDown(KeyEventArgs e)
        {
            bool ctrl = (Keyboard.Modifiers & ModifierKeys.Control) == ModifierKeys.Control;

            if (ctrl && e.Key == Key.S)
            {
                SaveCurrentRecord();
                e.Handled = true;
            }
            else if (ctrl && e.Key == Key.N)
            {
                if (CanLeaveCurrentRecord())
                    SetupNewRecord();
                e.Handled = true;
            }
            else if (ctrl && e.Key == Key.P)
            {
                ShowPrintMenu();
                e.Handled = true;
            }
            else if (ctrl && e.Key == Key.Home)
            {
                NavigateFirst();
                e.Handled = true;
            }
            else if (ctrl && e.Key == Key.End)
            {
                NavigateLast();
                e.Handled = true;
            }
            else if (e.Key == Key.F3)
            {
                if (CanLeaveCurrentRecord())
                    SetupNewRecord();
                e.Handled = true;
            }
            else if (e.Key == Key.F4)
            {
                btnCopyFrom_Click(null, null);
                e.Handled = true;
            }
            else if (e.Key == Key.F5)
            {
                btnRefreshList_Click(null, null);
                e.Handled = true;
            }
            else if (e.Key == Key.Escape)
            {
                btnUndo_Click(null, null);
                e.Handled = true;
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 12: التحقق من الإدخال
        // ═══════════════════════════════════════════════════════════

        #region Input Validation

        private void NumericOnly_PreviewTextInput(object sender, TextCompositionEventArgs e)
        {
            foreach (char c in e.Text)
            {
                if (!char.IsDigit(c))
                {
                    e.Handled = true;
                    return;
                }
            }
        }

        private void DecimalOnly_PreviewTextInput(object sender, TextCompositionEventArgs e)
        {
            TextBox textBox = sender as TextBox;
            foreach (char c in e.Text)
            {
                if (!char.IsDigit(c) && c != '.')
                {
                    e.Handled = true;
                    return;
                }

                if (c == '.' && textBox != null && textBox.Text.Contains("."))
                {
                    e.Handled = true;
                    return;
                }
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 13: دوال مساعدة
        // ═══════════════════════════════════════════════════════════

        #region Helper Methods

        private void MarkAsDirty()
        {
            if (!_isLoading)
            {
                _isDirty = true;
                UpdateRecordStatus("تم التعديل *");
            }
        }

        private void SetComboBoxValue(ComboBox cmb, int? value)
        {
            if (!value.HasValue || value.Value == 0)
            {
                cmb.SelectedIndex = -1;
                return;
            }
            cmb.SelectedValue = value.Value;
        }

        private int? GetComboBoxValue(ComboBox cmb)
        {
            if (cmb.SelectedValue == null) return null;

            int value;
            if (int.TryParse(cmb.SelectedValue.ToString(), out value))
                return value > 0 ? (int?)value : null;

            return null;
        }

        private void UpdateRecordCounter()
        {
            if (_isNewRecord)
            {
                txtRecordCounter.Text = string.Format("جديد / {0}", _assetsList.Count);
            }
            else
            {
                txtRecordCounter.Text = string.Format("{0} / {1}",
                    _currentIndex + 1, _assetsList.Count);
            }
        }

        private void UpdateTotalCount()
        {
            try
            {
                int total = _assetService.GetTotalAssetCount();
                txtTotalAssets.Text = total.ToString();
            }
            catch
            {
                txtTotalAssets.Text = "?";
            }
        }

        private void UpdateButtonStates()
        {
            bool hasRecord = !_isNewRecord && _currentAsset != null;
            btnDelete.IsEnabled = hasRecord;
            btnCopyFrom.IsEnabled = hasRecord;
        }

        private void UpdateRecordStatus(string status)
        {
            txtRecordStatus.Text = status;
        }

        private void UpdateStatusBar(string message)
        {
            txtStatusMessage.Text = message;
        }

        private void ShowSuccess(string message)
        {
            MessageBox.Show(message, "✅ نجاح", MessageBoxButton.OK, MessageBoxImage.Information);
            UpdateStatusBar(message.Replace("\n", " "));
        }

        private void ShowError(string message)
        {
            MessageBox.Show(message, "❌ خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            UpdateStatusBar(message.Replace("\n", " "));
        }

        private void ShowWarning(string message)
        {
            MessageBox.Show(message, "⚠️ تنبيه", MessageBoxButton.OK, MessageBoxImage.Warning);
        }

        private void ShowInfo(string message)
        {
            MessageBox.Show(message, "ℹ️ معلومات", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private string ShowInputBox(string prompt, string title, string defaultValue = "")
        {
            Window inputWindow = new Window();
            inputWindow.Title = title;
            inputWindow.Width = 450;
            inputWindow.SizeToContent = SizeToContent.Height;
            inputWindow.WindowStartupLocation = WindowStartupLocation.CenterScreen;
            inputWindow.ResizeMode = ResizeMode.NoResize;
            inputWindow.FlowDirection = FlowDirection.RightToLeft;

            StackPanel panel = new StackPanel();
            panel.Margin = new Thickness(15);

            TextBlock label = new TextBlock();
            label.Text = prompt;
            label.TextWrapping = TextWrapping.Wrap;
            label.FontSize = 13;
            label.Margin = new Thickness(0, 0, 0, 10);
            panel.Children.Add(label);

            TextBox textBox = new TextBox();
            textBox.Text = defaultValue;
            textBox.FontSize = 14;
            textBox.Height = 35;
            textBox.Padding = new Thickness(8, 5, 8, 5);
            textBox.Margin = new Thickness(0, 0, 0, 15);
            panel.Children.Add(textBox);

            StackPanel buttons = new StackPanel();
            buttons.Orientation = Orientation.Horizontal;
            buttons.HorizontalAlignment = HorizontalAlignment.Center;

            string resultValue = null;

            Button okButton = new Button();
            okButton.Content = "موافق";
            okButton.Width = 90;
            okButton.Height = 35;
            okButton.Margin = new Thickness(0, 0, 10, 0);
            okButton.FontSize = 14;
            okButton.Background = new System.Windows.Media.SolidColorBrush(
                System.Windows.Media.Color.FromRgb(37, 99, 235));
            okButton.Foreground = System.Windows.Media.Brushes.White;
            okButton.Click += delegate
            {
                resultValue = textBox.Text;
                inputWindow.Close();
            };
            buttons.Children.Add(okButton);

            Button cancelButton = new Button();
            cancelButton.Content = "إلغاء";
            cancelButton.Width = 90;
            cancelButton.Height = 35;
            cancelButton.FontSize = 14;
            cancelButton.Click += delegate
            {
                resultValue = null;
                inputWindow.Close();
            };
            buttons.Children.Add(cancelButton);

            panel.Children.Add(buttons);
            inputWindow.Content = panel;

            textBox.KeyDown += delegate (object s, KeyEventArgs ev)
            {
                if (ev.Key == Key.Enter)
                {
                    resultValue = textBox.Text;
                    inputWindow.Close();
                }
                else if (ev.Key == Key.Escape)
                {
                    resultValue = null;
                    inputWindow.Close();
                }
            };

            inputWindow.Loaded += delegate { textBox.Focus(); textBox.SelectAll(); };
            inputWindow.ShowDialog();

            return resultValue;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 14-17: الميزات المتقدمة (تقارير التشابه + التعديل الجماعي المتقدم + تتبع التغييرات)
        // ═══════════════════════════════════════════════════════════

        #region Advanced Features

        private void ShowSimilarAssetsMenu_Full()
        {
            string choice = ShowInputBox(
                "اختر نوع التقرير:\n\n" +
                "1 - بحث بنسبة تشابه محددة\n" +
                "2 - أسماء متطابقة تماماً\n" +
                "3 - بحث بنص محدد\n" +
                "4 - أصول بنفس الكود والاسم\n" +
                "5 - تقرير شامل\n\n" +
                "أدخل رقم الاختيار:", "🔗 تقارير التشابه");

            if (string.IsNullOrEmpty(choice)) return;

            switch (choice.Trim())
            {
                case "1": FindSimilarByPercentage(); break;
                case "2": FindExactDuplicateNames(); break;
                case "3": FindByContainsText(); break;
                case "4": FindDuplicateNameAndCode(); break;
                case "5": GenerateFullSimilarityReport(); break;
                default: ShowWarning("اختيار غير صحيح!"); break;
            }
        }

        private void FindSimilarByPercentage()
        {
            string percentInput = ShowInputBox(
                "أدخل نسبة التشابه المطلوبة (50 - 100):", "نسبة التشابه", "75");

            if (string.IsNullOrEmpty(percentInput)) return;

            int percent;
            if (!int.TryParse(percentInput, out percent) || percent < 10 || percent > 100)
            {
                ShowWarning("أدخل رقماً بين 10 و 100");
                return;
            }

            try
            {
                UpdateStatusBar("جارٍ البحث عن أسماء متشابهة...");
                Mouse.OverrideCursor = Cursors.Wait;

                double threshold = percent / 100.0;
                List<string> allNames = _assetService.GetDistinctAssetNames();
                List<string> results = new List<string>();

                for (int i = 0; i < allNames.Count; i++)
                {
                    for (int j = i + 1; j < allNames.Count; j++)
                    {
                        double similarity = _assetService.CalculateSimilarity(allNames[i], allNames[j]);

                        if (similarity >= threshold && similarity < 1.0)
                        {
                            results.Add(string.Format("[{0:N1}%] \"{1}\" ↔ \"{2}\"",
                                similarity * 100, allNames[i], allNames[j]));
                        }
                    }
                }

                Mouse.OverrideCursor = null;

                if (results.Count == 0)
                {
                    ShowInfo(string.Format("لم يتم العثور على أسماء متشابهة بنسبة {0}% أو أكثر.", percent));
                    return;
                }

                string report = string.Format("═══ تقرير التشابه (≥{0}%) ═══\nعدد الأزواج: {1}\n\n",
                    percent, results.Count);

                int showCount = Math.Min(results.Count, 50);
                for (int i = 0; i < showCount; i++)
                    report += results[i] + "\n";

                if (results.Count > 50)
                    report += string.Format("\n... و {0} أزواج أخرى", results.Count - 50);

                ShowResultWithExportOption("تقرير التشابه", report);
            }
            catch (Exception ex)
            {
                Mouse.OverrideCursor = null;
                ShowError("خطأ في البحث: " + ex.Message);
            }
        }

        private void FindExactDuplicateNames()
        {
            try
            {
                string query = @"SELECT AssetName, COUNT(*) AS DupCount, MIN(BaseAssetCode) AS FirstCode
                        FROM tblAssets WHERE IsActive = 1
                        GROUP BY AssetName HAVING COUNT(*) > 1
                        ORDER BY COUNT(*) DESC";

                System.Data.DataTable dt = DatabaseHelper.GetData(query);

                if (dt.Rows.Count == 0) { ShowInfo("لا توجد أسماء متكررة."); return; }

                string report = string.Format("═══ الأسماء المتكررة ═══\nعدد: {0}\n\n", dt.Rows.Count);
                foreach (System.Data.DataRow row in dt.Rows)
                    report += string.Format("• \"{0}\" - {1} سجلات (كود: {2})\n",
                        row["AssetName"], row["DupCount"], row["FirstCode"]);

                ShowResultWithExportOption("الأسماء المتكررة", report);
            }
            catch (Exception ex) { ShowError("خطأ: " + ex.Message); }
        }

        private void FindByContainsText()
        {
            string searchText = ShowInputBox("أدخل النص المراد البحث عنه:", "بحث بالنص");
            if (string.IsNullOrWhiteSpace(searchText)) return;

            try
            {
                string query = @"SELECT AssetName, BaseAssetCode, FullAssetCode,
                        ml.MainLocationName, Quantity
                        FROM tblAssets a
                        LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                        WHERE a.IsActive = 1 AND a.AssetName LIKE @Search
                        ORDER BY a.AssetName";

                var parameters = new System.Data.SqlClient.SqlParameter[]
                { new System.Data.SqlClient.SqlParameter("@Search", "%" + searchText + "%") };

                System.Data.DataTable dt = DatabaseHelper.GetData(query, parameters);

                if (dt.Rows.Count == 0) { ShowInfo("لم يتم العثور على نتائج."); return; }

                string report = string.Format("═══ نتائج البحث عن \"{0}\" ═══\nعدد: {1}\n\n",
                    searchText, dt.Rows.Count);
                foreach (System.Data.DataRow row in dt.Rows)
                    report += string.Format("• {0} | {1} | {2} (كمية: {3})\n",
                        row["AssetName"], row["BaseAssetCode"],
                        row["MainLocationName"] != DBNull.Value ? row["MainLocationName"] : "---",
                        row["Quantity"]);

                ShowResultWithExportOption("نتائج البحث", report);
            }
            catch (Exception ex) { ShowError("خطأ: " + ex.Message); }
        }

        private void FindDuplicateNameAndCode()
        {
            try
            {
                string query = @"SELECT BaseAssetCode, AssetName, COUNT(*) AS LocCount
                        FROM tblAssets WHERE IsActive = 1 AND BaseAssetCode IS NOT NULL
                        GROUP BY BaseAssetCode, AssetName HAVING COUNT(*) > 1
                        ORDER BY COUNT(*) DESC";

                System.Data.DataTable dt = DatabaseHelper.GetData(query);

                if (dt.Rows.Count == 0) { ShowInfo("لا توجد أصول موزعة على مواقع متعددة."); return; }

                string report = string.Format("═══ أصول بمواقع متعددة ═══\nعدد: {0}\n\n", dt.Rows.Count);
                foreach (System.Data.DataRow row in dt.Rows)
                    report += string.Format("• [{0}] {1} - في {2} مواقع\n",
                        row["BaseAssetCode"], row["AssetName"], row["LocCount"]);

                ShowResultWithExportOption("أصول بمواقع متعددة", report);
            }
            catch (Exception ex) { ShowError("خطأ: " + ex.Message); }
        }

        private void GenerateFullSimilarityReport()
        {
            try
            {
                UpdateStatusBar("جارٍ إنشاء التقرير الشامل...");
                Mouse.OverrideCursor = Cursors.Wait;

                string report = "═══════════════════════════════════════\n";
                report += "     تقرير التشابه والتكرار الشامل\n";
                report += "     " + DateTime.Now.ToString("yyyy/MM/dd HH:mm") + "\n";
                report += "═══════════════════════════════════════\n\n";

                int totalAssets = _assetService.GetTotalAssetCount();
                List<string> allNames = _assetService.GetDistinctAssetNames();

                report += "📊 إحصائيات عامة:\n";
                report += string.Format("   • إجمالي السجلات: {0}\n", totalAssets);
                report += string.Format("   • أسماء فريدة: {0}\n", allNames.Count);
                report += string.Format("   • سجلات مكررة: {0}\n\n", totalAssets - allNames.Count);

                string dupQuery = @"SELECT AssetName, COUNT(*) AS Cnt FROM tblAssets WHERE IsActive = 1
                           GROUP BY AssetName HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC";
                System.Data.DataTable dupDt = DatabaseHelper.GetData(dupQuery);

                report += string.Format("📋 أسماء متكررة ({0}):\n", dupDt.Rows.Count);
                int dupShow = Math.Min(dupDt.Rows.Count, 15);
                for (int i = 0; i < dupShow; i++)
                    report += string.Format("   • \"{0}\" ({1} سجلات)\n",
                        dupDt.Rows[i]["AssetName"], dupDt.Rows[i]["Cnt"]);
                if (dupDt.Rows.Count > 15)
                    report += string.Format("   ... و {0} أسماء أخرى\n", dupDt.Rows.Count - 15);
                report += "\n";

                List<string> deletedCodes = _assetService.GetDeletedCodes(DateTime.Now.Year);
                report += string.Format("🔢 أكواد محذوفة في {0}: {1}\n\n", DateTime.Now.Year, deletedCodes.Count);

                report += "═══════════════════════════════════════\n";

                Mouse.OverrideCursor = null;
                ShowResultWithExportOption("التقرير الشامل", report);
            }
            catch (Exception ex)
            {
                Mouse.OverrideCursor = null;
                ShowError("خطأ: " + ex.Message);
            }
        }

        private void ShowResultWithExportOption(string title, string content)
        {
            string exportChoice = ShowInputBox(
                content + "\n\n═══════════════════\n" +
                "1 - نسخ إلى الحافظة\n2 - تصدير إلى ملف\n3 - إغلاق\n\nاختيارك:", title, "3");

            if (string.IsNullOrEmpty(exportChoice)) return;

            switch (exportChoice.Trim())
            {
                case "1":
                    try { Clipboard.SetText(content); ShowInfo("✅ تم النسخ"); } catch { }
                    break;
                case "2":
                    try
                    {
                        Microsoft.Win32.SaveFileDialog dlg = new Microsoft.Win32.SaveFileDialog();
                        dlg.Filter = "ملف نصي (*.txt)|*.txt";
                        dlg.FileName = title.Replace(" ", "_") + "_" + DateTime.Now.ToString("yyyyMMdd") + ".txt";
                        if (dlg.ShowDialog() == true)
                        {
                            System.IO.File.WriteAllText(dlg.FileName, content, System.Text.Encoding.UTF8);
                            ShowSuccess("✅ تم التصدير: " + dlg.FileName);
                            System.Diagnostics.Process.Start(dlg.FileName);
                        }
                    }
                    catch (Exception ex) { ShowError("خطأ: " + ex.Message); }
                    break;
            }
        }

        private void ShowAdvancedBulkEdit()
        {
            // مطابق للكود الأصلي بدون تغيير
            ShowBulkEditMenu();
        }

        private string BuildEmployeeListPrompt()
        {
            string prompt = "أدخل رقم الموظف:\n\n";
            if (_employees != null)
                foreach (LookupItem emp in _employees)
                    prompt += string.Format("{0} - {1}\n", emp.ID, emp.Name);
            return prompt;
        }

        private void RefreshAfterBulkEdit()
        {
            RefreshRecentAssetsList();
            LoadAssetsForNavigation();
            LoadAssetNameAutoComplete();
            UpdateTotalCount();

            if (_currentAsset != null && !_isNewRecord)
            {
                Asset refreshed = _assetService.GetAssetByID(_currentAsset.AssetID);
                if (refreshed != null) LoadAssetToForm(refreshed);
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 16: تتبع التغييرات
        // ═══════════════════════════════════════════════════════════

        #region Change Tracking

        private void AttachChangeTracking()
        {
            cmbSubType.SelectionChanged += delegate { MarkAsDirty(); };
            cmbStatus.SelectionChanged += delegate { MarkAsDirty(); CheckForDuplicateWarning(); };
            cmbSubLocation.SelectionChanged += delegate { MarkAsDirty(); };
            cmbModel.SelectionChanged += delegate { MarkAsDirty(); CheckForDuplicateWarning(); };
            cmbEmployee.SelectionChanged += delegate { MarkAsDirty(); CheckForDuplicateWarning(); };

            txtQuantity.TextChanged += delegate { MarkAsDirty(); };
            txtDescription.TextChanged += delegate { MarkAsDirty(); };
            txtPurchasePrice.TextChanged += delegate { MarkAsDirty(); };
            txtDepreciationRate.TextChanged += delegate { MarkAsDirty(); };
            txtUsefulLife.TextChanged += delegate { MarkAsDirty(); };
            txtSerialNumber.TextChanged += delegate { MarkAsDirty(); };
            txtBarcode.TextChanged += delegate { MarkAsDirty(); };
            txtReferenceNumber.TextChanged += delegate { MarkAsDirty(); };
            txtInventoryYear.TextChanged += delegate { MarkAsDirty(); };
            txtNotes.TextChanged += delegate { MarkAsDirty(); };

            dpPurchaseDate.SelectedDateChanged += delegate { MarkAsDirty(); };

            cmbAssetName.AddHandler(
                System.Windows.Controls.Primitives.TextBoxBase.TextChangedEvent,
                new TextChangedEventHandler(delegate { MarkAsDirty(); }));
        }

        #endregion

        #region Updated Button Events

        private void ShowSimilarAssetsDialog_Updated()
        {
            string choice = ShowInputBox(
                "1 - بحث سريع باسم محدد\n2 - قائمة تقارير التشابه الكاملة\n\nاختيارك:",
                "🔗 الأصول المتشابهة", "1");

            if (string.IsNullOrEmpty(choice)) return;

            switch (choice.Trim())
            {
                case "1": ShowSimilarAssetsDialog(); break;
                case "2": ShowSimilarAssetsMenu_Full(); break;
            }
        }

        private void ShowBulkEditMenu_Updated()
        {
            string choice = ShowInputBox(
                "1 - تعديل جماعي سريع (5 حقول)\n2 - تعديل جماعي متقدم (11 حقل)\n\nاختيارك:",
                "📝 التعديل الجماعي", "1");

            if (string.IsNullOrEmpty(choice)) return;

            switch (choice.Trim())
            {
                case "1": ShowBulkEditMenu(); break;
                case "2": ShowAdvancedBulkEdit(); break;
            }
        }

        #endregion
    }
}