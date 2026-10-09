// Models/Asset.cs
using System;

namespace AssetManagement.Models
{
    /// <summary>
    /// كلاس يمثل أصل ثابت واحد
    /// يتوافق مع جدول tblAssets في قاعدة البيانات
    /// </summary>
    public class Asset : BaseModel
    {
        // ═══════════════════════════════════════════════════════════
        // المتغيرات الخاصة (Private Fields)
        // ═══════════════════════════════════════════════════════════

        #region Private Fields

        private int _assetID;
        private string _assetName;
        private string _baseAssetCode;
        private string _fullAssetCode;
        private string _description;

        // المفاتيح الأجنبية (Foreign Keys)
        private int? _assetTypeID;
        private int? _subTypeID;
        private int? _modelID;
        private int? _mainLocationID;
        private int? _subLocationID;
        private int? _statusID;
        private int? _employeeID;

        // بيانات مالية
        private decimal? _purchasePrice;
        private DateTime? _purchaseDate;
        private decimal? _depreciationRate;
        private int? _usefulLife;

        // بيانات تعريفية
        private int _quantity;
        private string _serialNumber;
        private string _barcode;
        private string _referenceNumber;
        private int? _inventoryYear;
        private string _notes;
        private bool _isActive;

        // بيانات النظام
        private DateTime _dateEntered;
        private string _createdBy;
        private DateTime? _modifiedDate;
        private string _modifiedBy;

        // أسماء العرض (لا تُخزن في القاعدة - للعرض فقط)
        private string _assetTypeName;
        private string _subTypeName;
        private string _modelName;
        private string _mainLocationName;
        private string _subLocationName;
        private string _statusName;
        private string _employeeName;
        private string _statusColor;

        #endregion

        // ═══════════════════════════════════════════════════════════
        // الخصائص العامة (Public Properties)
        // ═══════════════════════════════════════════════════════════

        #region Primary Key

        /// <summary>
        /// المعرف الفريد للأصل (يُولَّد تلقائياً من قاعدة البيانات)
        /// </summary>
        public int AssetID
        {
            get { return _assetID; }
            set { SetProperty(ref _assetID, value); }
        }

        #endregion

        #region Core Fields - الحقول الأساسية

        /// <summary>
        /// اسم الأصل - حقل مطلوب
        /// مثال: "طابعة HP LaserJet Pro"
        /// </summary>
        public string AssetName
        {
            get { return _assetName; }
            set { SetProperty(ref _assetName, value); }
        }

        /// <summary>
        /// الكود الأساسي - يُولَّد تلقائياً
        /// الصيغة: YYYY-NNNN مثال: "2025-0001"
        /// نفس الكود لنفس اسم الأصل في مواقع مختلفة
        /// </summary>
        public string BaseAssetCode
        {
            get { return _baseAssetCode; }
            set { SetProperty(ref _baseAssetCode, value); }
        }

        /// <summary>
        /// الكود الكامل الفريد - يُولَّد تلقائياً
        /// الصيغة: BaseCode@LocationName مثال: "2025-0001@المكتب-الرئيسي"
        /// </summary>
        public string FullAssetCode
        {
            get { return _fullAssetCode; }
            set { SetProperty(ref _fullAssetCode, value); }
        }

        /// <summary>
        /// وصف تفصيلي للأصل (اختياري)
        /// </summary>
        public string Description
        {
            get { return _description; }
            set { SetProperty(ref _description, value); }
        }

        #endregion

        #region Foreign Keys - المفاتيح الأجنبية

        /// <summary>
        /// نوع الأصل الرئيسي - حقل مطلوب
        /// يرتبط بجدول tblAssetTypes
        /// </summary>
        public int? AssetTypeID
        {
            get { return _assetTypeID; }
            set { SetProperty(ref _assetTypeID, value); }
        }

        /// <summary>
        /// النوع الفرعي - اختياري
        /// يعتمد على AssetTypeID ويرتبط بجدول tblSubTypeAssets
        /// </summary>
        public int? SubTypeID
        {
            get { return _subTypeID; }
            set { SetProperty(ref _subTypeID, value); }
        }

        /// <summary>
        /// الموديل - اختياري
        /// يرتبط بجدول tblAssetModels
        /// </summary>
        public int? ModelID
        {
            get { return _modelID; }
            set { SetProperty(ref _modelID, value); }
        }

        /// <summary>
        /// الموقع الرئيسي (المبنى) - حقل مطلوب
        /// يرتبط بجدول tblMainLocations
        /// </summary>
        public int? MainLocationID
        {
            get { return _mainLocationID; }
            set { SetProperty(ref _mainLocationID, value); }
        }

        /// <summary>
        /// الموقع الفرعي (الغرفة/الطابق) - اختياري
        /// يعتمد على MainLocationID ويرتبط بجدول tblSubLocations
        /// </summary>
        public int? SubLocationID
        {
            get { return _subLocationID; }
            set { SetProperty(ref _subLocationID, value); }
        }

        /// <summary>
        /// حالة الأصل (جديد/جيد/تالف...) - حقل مطلوب
        /// يرتبط بجدول tblStatus
        /// </summary>
        public int? StatusID
        {
            get { return _statusID; }
            set { SetProperty(ref _statusID, value); }
        }

        /// <summary>
        /// الموظف المسؤول (العهدة) - اختياري
        /// يرتبط بجدول tblEmployees
        /// </summary>
        public int? EmployeeID
        {
            get { return _employeeID; }
            set { SetProperty(ref _employeeID, value); }
        }

        #endregion

        #region Financial Fields - الحقول المالية

        /// <summary>
        /// سعر الشراء
        /// </summary>
        public decimal? PurchasePrice
        {
            get { return _purchasePrice; }
            set { SetProperty(ref _purchasePrice, value); }
        }

        /// <summary>
        /// تاريخ الشراء
        /// </summary>
        public DateTime? PurchaseDate
        {
            get { return _purchaseDate; }
            set { SetProperty(ref _purchaseDate, value); }
        }

        /// <summary>
        /// نسبة الإهلاك السنوية (مئوية)
        /// </summary>
        public decimal? DepreciationRate
        {
            get { return _depreciationRate; }
            set { SetProperty(ref _depreciationRate, value); }
        }

        /// <summary>
        /// العمر الافتراضي بالسنوات
        /// </summary>
        public int? UsefulLife
        {
            get { return _usefulLife; }
            set { SetProperty(ref _usefulLife, value); }
        }

        #endregion

        #region Identification Fields - حقول التعريف

        /// <summary>
        /// الكمية - الافتراضي 1
        /// تزيد عند دمج أصول متطابقة
        /// </summary>
        public int Quantity
        {
            get { return _quantity; }
            set { SetProperty(ref _quantity, value); }
        }

        /// <summary>
        /// الرقم التسلسلي من الشركة المصنعة
        /// </summary>
        public string SerialNumber
        {
            get { return _serialNumber; }
            set { SetProperty(ref _serialNumber, value); }
        }

        /// <summary>
        /// رمز الباركود
        /// </summary>
        public string Barcode
        {
            get { return _barcode; }
            set { SetProperty(ref _barcode, value); }
        }

        /// <summary>
        /// رقم مرجعي (رقم أمر الشراء أو الفاتورة)
        /// </summary>
        public string ReferenceNumber
        {
            get { return _referenceNumber; }
            set { SetProperty(ref _referenceNumber, value); }
        }

        /// <summary>
        /// سنة الجرد
        /// </summary>
        public int? InventoryYear
        {
            get { return _inventoryYear; }
            set { SetProperty(ref _inventoryYear, value); }
        }

        /// <summary>
        /// ملاحظات إضافية
        /// </summary>
        public string Notes
        {
            get { return _notes; }
            set { SetProperty(ref _notes, value); }
        }

        /// <summary>
        /// هل الأصل نشط (غير محذوف)
        /// </summary>
        public bool IsActive
        {
            get { return _isActive; }
            set { SetProperty(ref _isActive, value); }
        }

        #endregion

        #region System Fields - حقول النظام

        /// <summary>
        /// تاريخ إدخال السجل
        /// </summary>
        public DateTime DateEntered
        {
            get { return _dateEntered; }
            set { SetProperty(ref _dateEntered, value); }
        }

        /// <summary>
        /// اسم المستخدم الذي أنشأ السجل
        /// </summary>
        public string CreatedBy
        {
            get { return _createdBy; }
            set { SetProperty(ref _createdBy, value); }
        }

        /// <summary>
        /// تاريخ آخر تعديل
        /// </summary>
        public DateTime? ModifiedDate
        {
            get { return _modifiedDate; }
            set { SetProperty(ref _modifiedDate, value); }
        }

        /// <summary>
        /// اسم المستخدم الذي عدّل السجل آخر مرة
        /// </summary>
        public string ModifiedBy
        {
            get { return _modifiedBy; }
            set { SetProperty(ref _modifiedBy, value); }
        }

        #endregion

        #region Display Names - أسماء العرض (لا تُخزن في القاعدة)

        /// <summary>اسم نوع الأصل (للعرض)</summary>
        public string AssetTypeName
        {
            get { return _assetTypeName; }
            set { SetProperty(ref _assetTypeName, value); }
        }

        /// <summary>اسم النوع الفرعي (للعرض)</summary>
        public string SubTypeName
        {
            get { return _subTypeName; }
            set { SetProperty(ref _subTypeName, value); }
        }

        /// <summary>اسم الموديل (للعرض)</summary>
        public string ModelName
        {
            get { return _modelName; }
            set { SetProperty(ref _modelName, value); }
        }

        /// <summary>اسم الموقع الرئيسي (للعرض)</summary>
        public string MainLocationName
        {
            get { return _mainLocationName; }
            set { SetProperty(ref _mainLocationName, value); }
        }

        /// <summary>اسم الموقع الفرعي (للعرض)</summary>
        public string SubLocationName
        {
            get { return _subLocationName; }
            set { SetProperty(ref _subLocationName, value); }
        }

        /// <summary>اسم الحالة (للعرض)</summary>
        public string StatusName
        {
            get { return _statusName; }
            set { SetProperty(ref _statusName, value); }
        }

        /// <summary>اسم الموظف المسؤول (للعرض)</summary>
        public string EmployeeName
        {
            get { return _employeeName; }
            set { SetProperty(ref _employeeName, value); }
        }

        /// <summary>لون الحالة (للعرض)</summary>
        public string StatusColor
        {
            get { return _statusColor; }
            set { SetProperty(ref _statusColor, value); }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // خصائص محسوبة (Calculated Properties)
        // ═══════════════════════════════════════════════════════════

        #region Calculated Properties

        /// <summary>
        /// هل هذا سجل جديد (لم يُحفظ بعد)
        /// </summary>
        public bool IsNew
        {
            get { return _assetID == 0; }
        }

        /// <summary>
        /// القيمة الدفترية الحالية بعد الإهلاك
        /// الصيغة: سعر الشراء × (1 - نسبة الإهلاك × عدد السنوات)
        /// لا تقل عن صفر
        /// </summary>
        public decimal CurrentBookValue
        {
            get
            {
                // إذا لا يوجد سعر شراء أو نسبة إهلاك
                if (!_purchasePrice.HasValue || _purchasePrice.Value == 0)
                    return 0;

                if (!_depreciationRate.HasValue || _depreciationRate.Value == 0)
                    return _purchasePrice.Value;

                if (!_purchaseDate.HasValue)
                    return _purchasePrice.Value;

                // حساب عدد السنوات منذ الشراء
                double yearsOwned = (DateTime.Now - _purchaseDate.Value).TotalDays / 365.25;

                // حساب الإهلاك المتراكم
                decimal totalDepreciation = _purchasePrice.Value * (_depreciationRate.Value / 100m) * (decimal)yearsOwned;

                // القيمة الدفترية لا تقل عن صفر
                decimal bookValue = _purchasePrice.Value - totalDepreciation;
                return bookValue < 0 ? 0 : Math.Round(bookValue, 2);
            }
        }

        /// <summary>
        /// نسبة الإهلاك المتراكمة (مئوية)
        /// </summary>
        public decimal DepreciationPercentage
        {
            get
            {
                if (!_purchasePrice.HasValue || _purchasePrice.Value == 0)
                    return 0;

                decimal bookValue = CurrentBookValue;
                decimal percentage = (((_purchasePrice.Value - bookValue) / _purchasePrice.Value) * 100);
                return Math.Round(percentage, 1);
            }
        }

        /// <summary>
        /// عمر الأصل بالسنوات (منذ الشراء)
        /// </summary>
        public string AssetAge
        {
            get
            {
                if (!_purchaseDate.HasValue)
                    return "غير محدد";

                TimeSpan age = DateTime.Now - _purchaseDate.Value;
                int years = (int)(age.TotalDays / 365.25);
                int months = (int)((age.TotalDays % 365.25) / 30.44);

                if (years > 0 && months > 0)
                    return string.Format("{0} سنة و {1} شهر", years, months);
                else if (years > 0)
                    return string.Format("{0} سنة", years);
                else if (months > 0)
                    return string.Format("{0} شهر", months);
                else
                    return "أقل من شهر";
            }
        }

        /// <summary>
        /// نص عرض مختصر للأصل (للقوائم)
        /// </summary>
        public string DisplayText
        {
            get
            {
                string code = string.IsNullOrEmpty(_fullAssetCode) ? _baseAssetCode : _fullAssetCode;
                if (string.IsNullOrEmpty(code))
                    return _assetName ?? "(بدون اسم)";

                return string.Format("{0} | {1}", code, _assetName);
            }
        }

        /// <summary>
        /// معلومات الموقع الكاملة (للعرض)
        /// </summary>
        public string FullLocationText
        {
            get
            {
                if (string.IsNullOrEmpty(_mainLocationName))
                    return "غير محدد";

                if (string.IsNullOrEmpty(_subLocationName))
                    return _mainLocationName;

                return string.Format("{0} / {1}", _mainLocationName, _subLocationName);
            }
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // المُنشئات (Constructors)
        // ═══════════════════════════════════════════════════════════

        #region Constructors

        /// <summary>
        /// إنشاء أصل جديد بقيم افتراضية
        /// </summary>
        public Asset()
        {
            _assetID = 0;
            _quantity = 1;
            _isActive = true;
            _dateEntered = DateTime.Now;
            _inventoryYear = DateTime.Now.Year;
        }

        /// <summary>
        /// إنشاء نسخة من أصل موجود (للنسخ)
        /// لا ينسخ: المعرف، الكود الكامل، تواريخ النظام
        /// </summary>
        /// <param name="source">الأصل المصدر</param>
        /// <returns>نسخة جديدة</returns>
        public static Asset CreateCopyFrom(Asset source)
        {
            if (source == null)
                return new Asset();

            Asset copy = new Asset();

            // نسخ البيانات الأساسية (بدون المعرف والكود الكامل)
            copy.AssetName = source.AssetName;
            copy.BaseAssetCode = source.BaseAssetCode;
            // FullAssetCode لا يُنسخ - سيُولَّد تلقائياً
            copy.Description = source.Description;

            // نسخ المفاتيح الأجنبية
            copy.AssetTypeID = source.AssetTypeID;
            copy.SubTypeID = source.SubTypeID;
            copy.ModelID = source.ModelID;
            copy.MainLocationID = source.MainLocationID;
            copy.SubLocationID = source.SubLocationID;
            copy.StatusID = source.StatusID;
            copy.EmployeeID = source.EmployeeID;

            // نسخ البيانات المالية
            copy.PurchasePrice = source.PurchasePrice;
            copy.PurchaseDate = source.PurchaseDate;
            copy.DepreciationRate = source.DepreciationRate;
            copy.UsefulLife = source.UsefulLife;

            // الكمية دائماً 1 للنسخة الجديدة
            copy.Quantity = 1;

            // نسخ بيانات تعريفية (بدون SerialNumber لأنه فريد)
            copy.Barcode = null;
            copy.SerialNumber = null;
            copy.ReferenceNumber = source.ReferenceNumber;
            copy.InventoryYear = DateTime.Now.Year;
            copy.Notes = source.Notes;

            // نسخ أسماء العرض
            copy.AssetTypeName = source.AssetTypeName;
            copy.SubTypeName = source.SubTypeName;
            copy.ModelName = source.ModelName;
            copy.MainLocationName = source.MainLocationName;
            copy.SubLocationName = source.SubLocationName;
            copy.StatusName = source.StatusName;
            copy.EmployeeName = source.EmployeeName;
            copy.StatusColor = source.StatusColor;

            return copy;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // دوال التحقق (Validation)
        // ═══════════════════════════════════════════════════════════

        #region Validation

        /// <summary>
        /// التحقق من صحة البيانات المطلوبة
        /// </summary>
        /// <param name="errorMessage">رسالة الخطأ إذا فشل التحقق</param>
        /// <returns>true إذا نجح التحقق</returns>
        public bool Validate(out string errorMessage)
        {
            // التحقق من اسم الأصل
            if (string.IsNullOrWhiteSpace(_assetName))
            {
                errorMessage = "اسم الأصل مطلوب";
                return false;
            }

            if (_assetName.Trim().Length < 2)
            {
                errorMessage = "اسم الأصل يجب أن يكون حرفين على الأقل";
                return false;
            }

            // التحقق من نوع الأصل
            if (!_assetTypeID.HasValue || _assetTypeID.Value == 0)
            {
                errorMessage = "يجب اختيار نوع الأصل";
                return false;
            }

            // التحقق من الموقع الرئيسي
            if (!_mainLocationID.HasValue || _mainLocationID.Value == 0)
            {
                errorMessage = "يجب اختيار الموقع الرئيسي";
                return false;
            }

            // التحقق من الحالة
            if (!_statusID.HasValue || _statusID.Value == 0)
            {
                errorMessage = "يجب اختيار حالة الأصل";
                return false;
            }

            // التحقق من الكمية
            if (_quantity <= 0)
            {
                errorMessage = "الكمية يجب أن تكون أكبر من صفر";
                return false;
            }

            // التحقق من سعر الشراء (إذا أُدخل)
            if (_purchasePrice.HasValue && _purchasePrice.Value < 0)
            {
                errorMessage = "سعر الشراء لا يمكن أن يكون سالباً";
                return false;
            }

            // التحقق من نسبة الإهلاك
            if (_depreciationRate.HasValue && (_depreciationRate.Value < 0 || _depreciationRate.Value > 100))
            {
                errorMessage = "نسبة الإهلاك يجب أن تكون بين 0 و 100";
                return false;
            }

            // التحقق من العمر الافتراضي
            if (_usefulLife.HasValue && _usefulLife.Value < 0)
            {
                errorMessage = "العمر الافتراضي لا يمكن أن يكون سالباً";
                return false;
            }

            errorMessage = string.Empty;
            return true;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // دوال مساعدة (Helper Methods)
        // ═══════════════════════════════════════════════════════════

        #region Helper Methods

        /// <summary>
        /// إعادة تعيين الكلاس لحالة أصل جديد
        /// </summary>
        public void Reset()
        {
            AssetID = 0;
            AssetName = null;
            BaseAssetCode = null;
            FullAssetCode = null;
            Description = null;
            AssetTypeID = null;
            SubTypeID = null;
            ModelID = null;
            MainLocationID = null;
            SubLocationID = null;
            StatusID = null;
            EmployeeID = null;
            PurchasePrice = null;
            PurchaseDate = null;
            DepreciationRate = null;
            UsefulLife = null;
            Quantity = 1;
            SerialNumber = null;
            Barcode = null;
            ReferenceNumber = null;
            InventoryYear = DateTime.Now.Year;
            Notes = null;
            IsActive = true;
            DateEntered = DateTime.Now;
            CreatedBy = null;
            ModifiedDate = null;
            ModifiedBy = null;

            // مسح أسماء العرض
            AssetTypeName = null;
            SubTypeName = null;
            ModelName = null;
            MainLocationName = null;
            SubLocationName = null;
            StatusName = null;
            EmployeeName = null;
            StatusColor = null;
        }

        /// <summary>
        /// مقارنة هذا الأصل بأصل آخر لمعرفة إذا كانا متطابقين تماماً
        /// (بغض النظر عن المعرف والكمية والأكواد)
        /// </summary>
        public bool IsExactMatch(Asset other)
        {
            if (other == null)
                return false;

            return string.Equals(SafeTrim(_assetName), SafeTrim(other.AssetName), StringComparison.OrdinalIgnoreCase)
                && NullableEquals(_assetTypeID, other.AssetTypeID)
                && NullableEquals(_subTypeID, other.SubTypeID)
                && NullableEquals(_mainLocationID, other.MainLocationID)
                && NullableEquals(_subLocationID, other.SubLocationID)
                && NullableEquals(_statusID, other.StatusID)
                && NullableEquals(_modelID, other.ModelID)
                && NullableEquals(_employeeID, other.EmployeeID);
        }

        /// <summary>
        /// هل هذا الأصل له نفس الاسم فقط (بغض النظر عن باقي الحقول)
        /// </summary>
        public bool HasSameName(Asset other)
        {
            if (other == null || string.IsNullOrWhiteSpace(_assetName))
                return false;

            return string.Equals(SafeTrim(_assetName), SafeTrim(other.AssetName), StringComparison.OrdinalIgnoreCase);
        }

        public override string ToString()
        {
            return DisplayText;
        }

        // --- دوال مساعدة داخلية ---

        private string SafeTrim(string text)
        {
            return string.IsNullOrEmpty(text) ? string.Empty : text.Trim();
        }

        private bool NullableEquals(int? a, int? b)
        {
            if (!a.HasValue && !b.HasValue) return true;
            if (!a.HasValue || !b.HasValue) return false;
            return a.Value == b.Value;
        }

        #endregion
    }
}