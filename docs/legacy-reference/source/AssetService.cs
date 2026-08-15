// Services/AssetService.cs
using System;
using System.Collections.Generic;
using System.Data;
using System.Data.SqlClient;
using System.Linq;
using System.Text;
using AssetManagement.Helpers;
using AssetManagement.Models;

namespace AssetManagement.Services
{
    /// <summary>
    /// خدمة إدارة الأصول - تحتوي على جميع العمليات المتعلقة بالأصول
    /// توليد أكواد، منع تكرار، دمج كميات، بحث ذكي، كشف تشابه
    /// </summary>
    public class AssetService
    {
        // ═══════════════════════════════════════════════════════════
        // الثوابت (Constants)
        // ═══════════════════════════════════════════════════════════

        #region Constants

        /// <summary>الكمية الافتراضية عند إنشاء أصل جديد</summary>
        private const int DEFAULT_QUANTITY = 1;

        /// <summary>أقصى عدد محاولات لتوليد كود فريد</summary>
        private const int MAX_CODE_ATTEMPTS = 1000;

        /// <summary>أقصى عدد محاولات للاحقة الكود الكامل</summary>
        private const int MAX_SUFFIX_ATTEMPTS = 100;

        /// <summary>أقل سنة صالحة للأكواد</summary>
        private const int MIN_VALID_YEAR = 2000;

        /// <summary>عتبة التشابه (75%) - فوقها يُعتبر الاسم مشابهاً</summary>
        private const double SIMILARITY_THRESHOLD = 0.75;

        /// <summary>عتبة التشابه للعرض في القائمة (50%)</summary>
        private const double SIMILARITY_DISPLAY_THRESHOLD = 0.50;

        #endregion


        // ═══════════════════════════════════════════════════════════
        // القسم 1: دوال تنظيف وتجهيز النصوص
        // ═══════════════════════════════════════════════════════════

        #region Text Helpers

        /// <summary>
        /// تنظيف اسم الموقع ليصبح صالحاً للاستخدام في الأكواد
        /// يزيل المسافات والرموز الخاصة ويستبدلها بشرطة
        /// مثال: "المكتب الرئيسي/الدور 1" ← "المكتب-الرئيسي-الدور-1"
        /// </summary>
        private string CleanLocationName(string locName)
        {
            if (string.IsNullOrWhiteSpace(locName))
                return "UNKNOWN";

            string cleaned = locName.Trim();
            cleaned = cleaned.Replace(" ", "-");
            cleaned = cleaned.Replace("/", "-");
            cleaned = cleaned.Replace("\\", "-");
            cleaned = cleaned.Replace(",", "-");
            cleaned = cleaned.Replace(".", "-");
            cleaned = cleaned.Replace("'", "");
            cleaned = cleaned.Replace("\"", "");

            // إزالة الشرطات المتكررة
            while (cleaned.Contains("--"))
            {
                cleaned = cleaned.Replace("--", "-");
            }

            // إزالة الشرطة من البداية والنهاية
            cleaned = cleaned.Trim('-');

            return string.IsNullOrEmpty(cleaned) ? "UNKNOWN" : cleaned;
        }

        /// <summary>
        /// تطبيع النص للمقارنة (إزالة الرموز، توحيد المسافات، حروف صغيرة)
        /// يدعم العربية والإنجليزية
        /// </summary>
        private string NormalizeText(string inputText)
        {
            if (string.IsNullOrWhiteSpace(inputText))
                return string.Empty;

            StringBuilder result = new StringBuilder();
            bool lastWasSpace = false;

            foreach (char c in inputText.ToLower().Trim())
            {
                // الحروف الإنجليزية والأرقام
                if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9'))
                {
                    result.Append(c);
                    lastWasSpace = false;
                }
                // الحروف العربية (Unicode range: 0x0600 - 0x06FF)
                else if (c >= '\u0600' && c <= '\u06FF')
                {
                    result.Append(c);
                    lastWasSpace = false;
                }
                // المسافة (مسافة واحدة فقط)
                else if (c == ' ' && !lastWasSpace && result.Length > 0)
                {
                    result.Append(' ');
                    lastWasSpace = true;
                }
            }

            return result.ToString().Trim();
        }

        /// <summary>
        /// حماية النص من SQL Injection (استبدال الفاصلة العليا)
        /// ملاحظة: يُفضل دائماً استخدام SqlParameter بدلاً من هذه الدالة
        /// </summary>
        private string EscapeSQL(string inputText)
        {
            if (string.IsNullOrEmpty(inputText))
                return string.Empty;
            return inputText.Replace("'", "''");
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 2: خوارزمية التشابه (Levenshtein Distance)
        // ═══════════════════════════════════════════════════════════

        #region Similarity Algorithm

        /// <summary>
        /// حساب مسافة ليفنشتاين بين نصين
        /// (عدد التعديلات المطلوبة لتحويل نص لآخر: إضافة، حذف، استبدال)
        /// </summary>
        /// <param name="str1">النص الأول</param>
        /// <param name="str2">النص الثاني</param>
        /// <returns>عدد التعديلات (0 = متطابقان)</returns>
        public int LevenshteinDistance(string str1, string str2)
        {
            if (string.IsNullOrEmpty(str1))
                return string.IsNullOrEmpty(str2) ? 0 : str2.Length;
            if (string.IsNullOrEmpty(str2))
                return str1.Length;

            int len1 = str1.Length;
            int len2 = str2.Length;

            // مصفوفة البرمجة الديناميكية
            int[,] matrix = new int[len1 + 1, len2 + 1];

            // تهيئة الصف الأول والعمود الأول
            for (int i = 0; i <= len1; i++)
                matrix[i, 0] = i;
            for (int j = 0; j <= len2; j++)
                matrix[0, j] = j;

            // ملء المصفوفة
            for (int i = 1; i <= len1; i++)
            {
                for (int j = 1; j <= len2; j++)
                {
                    int cost = (str1[i - 1] == str2[j - 1]) ? 0 : 1;

                    int deletion = matrix[i - 1, j] + 1;        // حذف
                    int insertion = matrix[i, j - 1] + 1;       // إضافة
                    int substitution = matrix[i - 1, j - 1] + cost; // استبدال

                    // أقل قيمة من الثلاث عمليات
                    matrix[i, j] = Math.Min(Math.Min(deletion, insertion), substitution);
                }
            }

            return matrix[len1, len2];
        }

        /// <summary>
        /// حساب نسبة التشابه بين نصين (0.0 إلى 1.0)
        /// 1.0 = متطابقان تماماً | 0.0 = مختلفان تماماً
        /// </summary>
        /// <param name="str1">النص الأول</param>
        /// <param name="str2">النص الثاني</param>
        /// <returns>نسبة التشابه</returns>
        public double CalculateSimilarity(string str1, string str2)
        {
            // تطبيع النصوص أولاً
            string norm1 = NormalizeText(str1);
            string norm2 = NormalizeText(str2);

            // إذا كلاهما فارغ فهما متطابقان
            if (string.IsNullOrEmpty(norm1) && string.IsNullOrEmpty(norm2))
                return 1.0;

            // إذا أحدهما فارغ فلا تشابه
            if (string.IsNullOrEmpty(norm1) || string.IsNullOrEmpty(norm2))
                return 0.0;

            // إذا متطابقان تماماً
            if (norm1 == norm2)
                return 1.0;

            int distance = LevenshteinDistance(norm1, norm2);
            int maxLen = Math.Max(norm1.Length, norm2.Length);

            return 1.0 - ((double)distance / maxLen);
        }

        /// <summary>
        /// البحث عن أسماء أصول مشابهة للاسم المعطى
        /// </summary>
        /// <param name="assetName">الاسم المراد البحث عنه</param>
        /// <param name="excludeAssetID">معرف أصل مستثنى (عند التعديل)</param>
        /// <param name="threshold">عتبة التشابه (افتراضياً 75%)</param>
        /// <returns>قائمة بالأصول المشابهة مع نسبة التشابه</returns>
        public List<SimilarAssetResult> FindSimilarAssetNames(string assetName,
            int excludeAssetID = 0, double threshold = 0)
        {
            if (threshold <= 0)
                threshold = SIMILARITY_THRESHOLD;

            List<SimilarAssetResult> results = new List<SimilarAssetResult>();

            if (string.IsNullOrWhiteSpace(assetName))
                return results;

            try
            {
                // جلب جميع الأسماء الموجودة
                string query = @"SELECT DISTINCT AssetID, AssetName, BaseAssetCode 
                                FROM tblAssets 
                                WHERE IsActive = 1";

                SqlParameter[] parameters = null;

                if (excludeAssetID > 0)
                {
                    query += " AND AssetID <> @ExcludeID";
                    parameters = new SqlParameter[]
                    {
                        new SqlParameter("@ExcludeID", excludeAssetID)
                    };
                }

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                foreach (DataRow row in dt.Rows)
                {
                    string existingName = row["AssetName"].ToString();
                    double similarity = CalculateSimilarity(assetName, existingName);

                    if (similarity >= threshold)
                    {
                        results.Add(new SimilarAssetResult
                        {
                            AssetID = Convert.ToInt32(row["AssetID"]),
                            AssetName = existingName,
                            BaseAssetCode = row["BaseAssetCode"] != DBNull.Value
                                ? row["BaseAssetCode"].ToString() : "",
                            SimilarityPercentage = Math.Round(similarity * 100, 1)
                        });
                    }
                }

                // ترتيب تنازلياً حسب نسبة التشابه
                results.Sort((a, b) => b.SimilarityPercentage.CompareTo(a.SimilarityPercentage));
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في FindSimilarAssetNames: " + ex.Message);
            }

            return results;
        }

        /// <summary>
        /// التحقق من أن الاسم الجديد ليس مشابهاً جداً لأسماء موجودة
        /// </summary>
        /// <param name="assetName">الاسم المراد التحقق منه</param>
        /// <param name="excludeAssetID">معرف مستثنى</param>
        /// <returns>true إذا لا يوجد تشابه عالي أو وافق المستخدم</returns>
        public bool ValidateNameSimilarity(string assetName, int excludeAssetID = 0)
        {
            List<SimilarAssetResult> similar = FindSimilarAssetNames(
                assetName, excludeAssetID, SIMILARITY_THRESHOLD);

            // إذا لا يوجد تشابه عالي، الاسم مقبول
            return similar.Count == 0;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 3: توليد الأكواد الفريدة
        // ═══════════════════════════════════════════════════════════

        #region Code Generation

        /// <summary>
        /// البحث عن أول رقم كود محذوف (فجوة في التسلسل) في سنة معينة
        /// مثال: إذا كانت الأكواد 2025-0001, 2025-0002, 2025-0004
        /// فالرقم المحذوف هو 3 (2025-0003)
        /// </summary>
        /// <param name="year">السنة (افتراضياً السنة الحالية)</param>
        /// <returns>أول رقم متاح (أو الرقم التالي إذا لم توجد فجوات)</returns>
        public int FindFirstAvailableCodeNumber(int year = 0)
        {
            if (year == 0)
                year = DateTime.Now.Year;

            try
            {
                string yearPrefix = year.ToString() + "-";

                // جلب جميع الأرقام المستخدمة لهذه السنة
                string query = @"SELECT BaseAssetCode FROM tblAssets 
                                WHERE BaseAssetCode LIKE @YearPrefix + '%'
                                AND IsActive = 1";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@YearPrefix", yearPrefix)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                if (dt.Rows.Count == 0)
                    return 1; // لا توجد أكواد، نبدأ من 1

                // استخراج الأرقام وتخزينها في مجموعة HashSet للبحث السريع
                HashSet<int> usedNumbers = new HashSet<int>();
                int maxNumber = 0;

                foreach (DataRow row in dt.Rows)
                {
                    int number = ExtractCodeNumber(row["BaseAssetCode"].ToString());
                    if (number > 0)
                    {
                        usedNumbers.Add(number);
                        if (number > maxNumber)
                            maxNumber = number;
                    }
                }

                // البحث عن أول فجوة (رقم محذوف)
                for (int i = 1; i <= maxNumber; i++)
                {
                    if (!usedNumbers.Contains(i))
                        return i; // وجدنا فجوة!
                }

                // لا توجد فجوات، نرجع الرقم التالي
                return maxNumber + 1;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في FindFirstAvailableCodeNumber: " + ex.Message);
                return 1;
            }
        }

        /// <summary>
        /// استخراج الرقم من الكود الأساسي
        /// مثال: "2025-0012" ← 12
        /// </summary>
        private int ExtractCodeNumber(string code)
        {
            if (string.IsNullOrEmpty(code))
                return 0;

            try
            {
                string[] parts = code.Split('-');
                if (parts.Length >= 2)
                {
                    int number;
                    if (int.TryParse(parts[1], out number))
                        return number;
                }
            }
            catch { }

            return 0;
        }

        /// <summary>
        /// توليد كود أساسي فريد للسنة الحالية
        /// مع إعادة استخدام الأكواد المحذوفة (الفجوات)
        /// الصيغة: YYYY-NNNN مثال: "2025-0001"
        /// </summary>
        /// <param name="year">السنة (افتراضياً الحالية)</param>
        /// <returns>كود أساسي فريد</returns>
        public string GenerateUniqueBaseCode(int year = 0)
        {
            if (year == 0)
                year = DateTime.Now.Year;

            int number = FindFirstAvailableCodeNumber(year);

            // تكوين الكود بصيغة YYYY-NNNN
            string baseCode = string.Format("{0}-{1:D4}", year, number);

            // التأكد من عدم وجوده (حماية إضافية)
            int attempts = 0;
            while (BaseCodeExists(baseCode) && attempts < MAX_CODE_ATTEMPTS)
            {
                number++;
                baseCode = string.Format("{0}-{1:D4}", year, number);
                attempts++;
            }

            return baseCode;
        }

        /// <summary>
        /// توليد الكود الكامل الفريد (يشمل الموقع)
        /// الصيغة: BaseCode@LocationName مثال: "2025-0001@المكتب-الرئيسي"
        /// إذا تكرر، يضيف لاحقة رقمية: "2025-0001@المكتب-الرئيسي-01"
        /// </summary>
        /// <param name="baseCode">الكود الأساسي</param>
        /// <param name="mainLocationID">معرف الموقع الرئيسي</param>
        /// <returns>كود كامل فريد</returns>
        public string GenerateUniqueFullCode(string baseCode, int mainLocationID)
        {
            // جلب اسم الموقع
            string locationName = GetLocationName(mainLocationID);
            string cleanLocation = CleanLocationName(locationName);

            // تكوين الكود الأولي
            string fullCode = baseCode + "@" + cleanLocation;

            // التحقق من عدم التكرار
            if (!FullCodeExists(fullCode))
                return fullCode;

            // إضافة لاحقة رقمية حتى نجد كوداً فريداً
            for (int i = 1; i <= MAX_SUFFIX_ATTEMPTS; i++)
            {
                string suffixedCode = string.Format("{0}-{1:D2}", fullCode, i);
                if (!FullCodeExists(suffixedCode))
                    return suffixedCode;
            }

            // حالة نادرة جداً: إضافة طابع زمني
            return fullCode + "-" + DateTime.Now.ToString("HHmmss");
        }

        /// <summary>
        /// البحث عن كود أساسي موجود مسبقاً لاسم أصل معين
        /// (نفس الأصل في مواقع مختلفة يشترك في الكود الأساسي)
        /// </summary>
        /// <param name="assetName">اسم الأصل</param>
        /// <param name="excludeAssetID">معرف مستثنى</param>
        /// <returns>الكود الأساسي الموجود أو null</returns>
        public string GetExistingBaseCode(string assetName, int excludeAssetID = 0)
        {
            if (string.IsNullOrWhiteSpace(assetName))
                return null;

            try
            {
                string query = @"SELECT TOP 1 BaseAssetCode 
                                FROM tblAssets 
                                WHERE AssetName = @AssetName 
                                AND IsActive = 1
                                AND BaseAssetCode IS NOT NULL
                                AND BaseAssetCode <> ''";

                List<SqlParameter> paramList = new List<SqlParameter>();
                paramList.Add(new SqlParameter("@AssetName", assetName.Trim()));

                if (excludeAssetID > 0)
                {
                    query += " AND AssetID <> @ExcludeID";
                    paramList.Add(new SqlParameter("@ExcludeID", excludeAssetID));
                }

                object result = DatabaseHelper.ExecuteScalar(query, paramList.ToArray());

                if (result != null && result != DBNull.Value)
                    return result.ToString();
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetExistingBaseCode: " + ex.Message);
            }

            return null;
        }

        /// <summary>
        /// التحقق من وجود كود أساسي في قاعدة البيانات
        /// </summary>
        private bool BaseCodeExists(string baseCode)
        {
            try
            {
                string query = @"SELECT COUNT(*) FROM tblAssets 
                                WHERE BaseAssetCode = @Code AND IsActive = 1";
                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@Code", baseCode)
                };

                object result = DatabaseHelper.ExecuteScalar(query, parameters);
                return Convert.ToInt32(result) > 0;
            }
            catch { return false; }
        }

        /// <summary>
        /// التحقق من وجود كود كامل في قاعدة البيانات
        /// </summary>
        private bool FullCodeExists(string fullCode, int excludeAssetID = 0)
        {
            try
            {
                string query = @"SELECT COUNT(*) FROM tblAssets 
                                WHERE FullAssetCode = @Code";

                List<SqlParameter> paramList = new List<SqlParameter>();
                paramList.Add(new SqlParameter("@Code", fullCode));

                if (excludeAssetID > 0)
                {
                    query += " AND AssetID <> @ExcludeID";
                    paramList.Add(new SqlParameter("@ExcludeID", excludeAssetID));
                }

                object result = DatabaseHelper.ExecuteScalar(query, paramList.ToArray());
                return Convert.ToInt32(result) > 0;
            }
            catch { return false; }
        }

        /// <summary>
        /// الحصول على جميع الأكواد المحذوفة (الفجوات) في سنة معينة
        /// </summary>
        /// <param name="year">السنة</param>
        /// <returns>قائمة بالأكواد المحذوفة</returns>
        public List<string> GetDeletedCodes(int year = 0)
        {
            if (year == 0)
                year = DateTime.Now.Year;

            List<string> deletedCodes = new List<string>();

            try
            {
                string yearPrefix = year.ToString() + "-";

                string query = @"SELECT BaseAssetCode FROM tblAssets 
                                WHERE BaseAssetCode LIKE @YearPrefix + '%'
                                AND IsActive = 1";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@YearPrefix", yearPrefix)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                HashSet<int> usedNumbers = new HashSet<int>();
                int maxNumber = 0;

                foreach (DataRow row in dt.Rows)
                {
                    int number = ExtractCodeNumber(row["BaseAssetCode"].ToString());
                    if (number > 0)
                    {
                        usedNumbers.Add(number);
                        if (number > maxNumber)
                            maxNumber = number;
                    }
                }

                // الفجوات هي الأرقام المفقودة
                for (int i = 1; i < maxNumber; i++)
                {
                    if (!usedNumbers.Contains(i))
                    {
                        deletedCodes.Add(string.Format("{0}-{1:D4}", year, i));
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetDeletedCodes: " + ex.Message);
            }

            return deletedCodes;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 4: كشف التكرار والدمج
        // ═══════════════════════════════════════════════════════════

        #region Duplicate Detection & Merging

        /// <summary>
        /// تحديد نوع العملية عند إضافة أصل جديد
        /// </summary>
        /// <param name="newAsset">الأصل الجديد المراد إضافته</param>
        /// <returns>نوع العملية + معرف الأصل المكرر إن وُجد</returns>
        public DuplicateCheckResult CheckForDuplicates(Asset newAsset)
        {
            DuplicateCheckResult result = new DuplicateCheckResult();
            result.OperationType = OperationType.NewAsset;
            result.ExistingAssetID = 0;

            if (newAsset == null || string.IsNullOrWhiteSpace(newAsset.AssetName))
                return result;

            try
            {
                // أولاً: البحث عن تطابق تام (كل الحقول متطابقة)
                int? exactMatchID = FindExactDuplicate(newAsset);
                if (exactMatchID.HasValue)
                {
                    result.OperationType = OperationType.Merge;
                    result.ExistingAssetID = exactMatchID.Value;
                    result.Message = "يوجد سجل مطابق تماماً - سيتم دمج الكميات";
                    return result;
                }

                // ثانياً: البحث عن أصل بنفس الاسم (لكن بحقول مختلفة)
                int? sameNameID = FindAssetByName(newAsset.AssetName, newAsset.AssetID);
                if (sameNameID.HasValue)
                {
                    result.OperationType = OperationType.NewVariant;
                    result.ExistingAssetID = sameNameID.Value;
                    result.Message = "يوجد أصل بنفس الاسم في موقع/حالة مختلفة - سيتم مشاركة الكود الأساسي";

                    // حساب الاختلافات
                    result.Differences = GetDifferences(newAsset, sameNameID.Value);
                    return result;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في CheckForDuplicates: " + ex.Message);
            }

            result.Message = "أصل جديد - سيتم توليد كود جديد";
            return result;
        }

        /// <summary>
        /// البحث عن سجل مطابق تماماً (نفس الاسم + الموقع + الحالة + النوع...)
        /// </summary>
        private int? FindExactDuplicate(Asset asset)
        {
            try
            {
                StringBuilder query = new StringBuilder();
                query.Append("SELECT TOP 1 AssetID FROM tblAssets WHERE IsActive = 1");
                query.Append(" AND AssetName = @AssetName");

                List<SqlParameter> paramList = new List<SqlParameter>();
                paramList.Add(new SqlParameter("@AssetName", asset.AssetName.Trim()));

                // مقارنة المفاتيح الأجنبية
                if (asset.AssetTypeID.HasValue)
                {
                    query.Append(" AND AssetTypeID = @AssetTypeID");
                    paramList.Add(new SqlParameter("@AssetTypeID", asset.AssetTypeID.Value));
                }
                else
                {
                    query.Append(" AND AssetTypeID IS NULL");
                }

                if (asset.MainLocationID.HasValue)
                {
                    query.Append(" AND MainLocationID = @MainLocationID");
                    paramList.Add(new SqlParameter("@MainLocationID", asset.MainLocationID.Value));
                }
                else
                {
                    query.Append(" AND MainLocationID IS NULL");
                }

                if (asset.SubLocationID.HasValue)
                {
                    query.Append(" AND SubLocationID = @SubLocationID");
                    paramList.Add(new SqlParameter("@SubLocationID", asset.SubLocationID.Value));
                }
                else
                {
                    query.Append(" AND SubLocationID IS NULL");
                }

                if (asset.StatusID.HasValue)
                {
                    query.Append(" AND StatusID = @StatusID");
                    paramList.Add(new SqlParameter("@StatusID", asset.StatusID.Value));
                }
                else
                {
                    query.Append(" AND StatusID IS NULL");
                }

                if (asset.SubTypeID.HasValue)
                {
                    query.Append(" AND SubTypeID = @SubTypeID");
                    paramList.Add(new SqlParameter("@SubTypeID", asset.SubTypeID.Value));
                }
                else
                {
                    query.Append(" AND SubTypeID IS NULL");
                }

                if (asset.ModelID.HasValue)
                {
                    query.Append(" AND ModelID = @ModelID");
                    paramList.Add(new SqlParameter("@ModelID", asset.ModelID.Value));
                }
                else
                {
                    query.Append(" AND ModelID IS NULL");
                }

                if (asset.EmployeeID.HasValue)
                {
                    query.Append(" AND EmployeeID = @EmployeeID");
                    paramList.Add(new SqlParameter("@EmployeeID", asset.EmployeeID.Value));
                }
                else
                {
                    query.Append(" AND EmployeeID IS NULL");
                }

                // استثناء السجل الحالي إذا كنا نعدّل
                if (asset.AssetID > 0)
                {
                    query.Append(" AND AssetID <> @AssetID");
                    paramList.Add(new SqlParameter("@AssetID", asset.AssetID));
                }

                object result = DatabaseHelper.ExecuteScalar(query.ToString(), paramList.ToArray());

                if (result != null && result != DBNull.Value)
                    return Convert.ToInt32(result);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في FindExactDuplicate: " + ex.Message);
            }

            return null;
        }

        /// <summary>
        /// البحث عن أي أصل بنفس الاسم
        /// </summary>
        private int? FindAssetByName(string assetName, int excludeAssetID = 0)
        {
            try
            {
                string query = @"SELECT TOP 1 AssetID FROM tblAssets 
                                WHERE AssetName = @AssetName AND IsActive = 1";

                List<SqlParameter> paramList = new List<SqlParameter>();
                paramList.Add(new SqlParameter("@AssetName", assetName.Trim()));

                if (excludeAssetID > 0)
                {
                    query += " AND AssetID <> @ExcludeID";
                    paramList.Add(new SqlParameter("@ExcludeID", excludeAssetID));
                }

                object result = DatabaseHelper.ExecuteScalar(query, paramList.ToArray());

                if (result != null && result != DBNull.Value)
                    return Convert.ToInt32(result);
            }
            catch { }

            return null;
        }

        /// <summary>
        /// دمج كمية جديدة مع أصل موجود
        /// </summary>
        /// <param name="existingAssetID">معرف الأصل الموجود</param>
        /// <param name="additionalQuantity">الكمية المراد إضافتها</param>
        /// <returns>true إذا نجح الدمج</returns>
        public bool MergeQuantity(int existingAssetID, int additionalQuantity)
        {
            try
            {
                string query = @"UPDATE tblAssets 
                                SET Quantity = Quantity + @AddQty,
                                    ModifiedDate = GETDATE(),
                                    ModifiedBy = @ModifiedBy
                                WHERE AssetID = @AssetID";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@AddQty", additionalQuantity),
                    new SqlParameter("@ModifiedBy", Environment.UserName),
                    new SqlParameter("@AssetID", existingAssetID)
                };

                int affected = DatabaseHelper.ExecuteNonQuery(query, parameters);
                return affected > 0;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في MergeQuantity: " + ex.Message);
                return false;
            }
        }

        /// <summary>
        /// الحصول على الكمية الحالية لأصل
        /// </summary>
        public int GetCurrentQuantity(int assetID)
        {
            try
            {
                string query = "SELECT Quantity FROM tblAssets WHERE AssetID = @AssetID";
                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@AssetID", assetID)
                };

                object result = DatabaseHelper.ExecuteScalar(query, parameters);
                if (result != null && result != DBNull.Value)
                    return Convert.ToInt32(result);
            }
            catch { }

            return 0;
        }

        /// <summary>
        /// حساب الاختلافات بين أصل جديد وأصل موجود
        /// </summary>
        private string GetDifferences(Asset newAsset, int existingAssetID)
        {
            try
            {
                Asset existing = GetAssetByID(existingAssetID);
                if (existing == null) return "";

                StringBuilder diff = new StringBuilder();

                if (!NullableIntEquals(newAsset.MainLocationID, existing.MainLocationID))
                {
                    diff.AppendFormat("• الموقع: {0} ← {1}\n",
                        existing.MainLocationName ?? "غير محدد",
                        GetLocationName(newAsset.MainLocationID ?? 0));
                }

                if (!NullableIntEquals(newAsset.StatusID, existing.StatusID))
                {
                    diff.AppendFormat("• الحالة: {0} ← {1}\n",
                        existing.StatusName ?? "غير محدد",
                        GetStatusName(newAsset.StatusID ?? 0));
                }

                if (!NullableIntEquals(newAsset.SubLocationID, existing.SubLocationID))
                    diff.Append("• الموقع الفرعي مختلف\n");

                if (!NullableIntEquals(newAsset.EmployeeID, existing.EmployeeID))
                    diff.Append("• الموظف المسؤول مختلف\n");

                if (!NullableIntEquals(newAsset.ModelID, existing.ModelID))
                    diff.Append("• الموديل مختلف\n");

                return diff.ToString();
            }
            catch { return ""; }
        }

        private bool NullableIntEquals(int? a, int? b)
        {
            if (!a.HasValue && !b.HasValue) return true;
            if (!a.HasValue || !b.HasValue) return false;
            return a.Value == b.Value;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 5: عمليات CRUD الأساسية
        // ═══════════════════════════════════════════════════════════

        #region CRUD Operations

        /// <summary>
        /// إضافة أصل جديد إلى قاعدة البيانات
        /// يتضمن: التحقق، كشف التكرار، توليد الأكواد
        /// </summary>
        /// <param name="asset">الأصل المراد إضافته</param>
        /// <returns>نتيجة العملية (نجاح/فشل + معرف الأصل الجديد)</returns>
        public SaveResult AddAsset(Asset asset)
        {
            SaveResult result = new SaveResult();

            try
            {
                // التحقق من البيانات
                string validationError;
                if (!asset.Validate(out validationError))
                {
                    result.Success = false;
                    result.Message = validationError;
                    return result;
                }

                // كشف التكرار
                DuplicateCheckResult dupCheck = CheckForDuplicates(asset);

                switch (dupCheck.OperationType)
                {
                    case OperationType.Merge:
                        // دمج الكميات
                        result.RequiresMergeConfirmation = true;
                        result.ExistingAssetID = dupCheck.ExistingAssetID;
                        result.MergeQuantity = asset.Quantity;
                        result.Message = dupCheck.Message;

                        // الكمية الحالية للعرض
                        int currentQty = GetCurrentQuantity(dupCheck.ExistingAssetID);
                        result.CurrentQuantity = currentQty;
                        result.NewTotalQuantity = currentQty + asset.Quantity;
                        return result;

                    case OperationType.NewVariant:
                        // نفس الاسم، كود أساسي مشترك
                        string existingCode = GetExistingBaseCode(asset.AssetName, asset.AssetID);
                        if (!string.IsNullOrEmpty(existingCode))
                        {
                            asset.BaseAssetCode = existingCode;
                        }
                        else
                        {
                            asset.BaseAssetCode = GenerateUniqueBaseCode();
                        }
                        asset.FullAssetCode = GenerateUniqueFullCode(
                            asset.BaseAssetCode, asset.MainLocationID ?? 0);

                        result.IsNewVariant = true;
                        result.Differences = dupCheck.Differences;
                        break;

                    case OperationType.NewAsset:
                        // أصل جديد تماماً
                        asset.BaseAssetCode = GenerateUniqueBaseCode();
                        asset.FullAssetCode = GenerateUniqueFullCode(
                            asset.BaseAssetCode, asset.MainLocationID ?? 0);
                        break;
                }

                // إدخال السجل في قاعدة البيانات
                int newID = InsertAsset(asset);

                if (newID > 0)
                {
                    result.Success = true;
                    result.NewAssetID = newID;
                    result.BaseAssetCode = asset.BaseAssetCode;
                    result.FullAssetCode = asset.FullAssetCode;

                    if (dupCheck.OperationType == OperationType.NewVariant)
                    {
                        result.Message = string.Format(
                            "تم إضافة الأصل بنجاح كمتغير جديد\nالكود: {0}",
                            asset.FullAssetCode);
                    }
                    else
                    {
                        result.Message = string.Format(
                            "تم إضافة الأصل بنجاح\nالكود: {0}",
                            asset.FullAssetCode);
                    }
                }
                else
                {
                    result.Success = false;
                    result.Message = "فشل في إضافة الأصل";
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = "خطأ: " + ex.Message;
            }

            return result;
        }

        /// <summary>
        /// تأكيد الدمج بعد موافقة المستخدم
        /// </summary>
        public SaveResult ConfirmMerge(int existingAssetID, int additionalQuantity)
        {
            SaveResult result = new SaveResult();

            try
            {
                bool merged = MergeQuantity(existingAssetID, additionalQuantity);

                if (merged)
                {
                    int newTotal = GetCurrentQuantity(existingAssetID);
                    result.Success = true;
                    result.NewAssetID = existingAssetID;
                    result.IsMerged = true;
                    result.Message = string.Format(
                        "تم دمج الكمية بنجاح\nالكمية الجديدة: {0}", newTotal);
                }
                else
                {
                    result.Success = false;
                    result.Message = "فشل في دمج الكميات";
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = "خطأ: " + ex.Message;
            }

            return result;
        }

        /// <summary>
        /// إدخال سجل أصل جديد في قاعدة البيانات
        /// </summary>
        private int InsertAsset(Asset asset)
        {
            string query = @"INSERT INTO tblAssets (
                    AssetName, BaseAssetCode, FullAssetCode, Description,
                    AssetTypeID, SubTypeID, ModelID,
                    MainLocationID, SubLocationID,
                    Quantity, StatusID, EmployeeID,
                    PurchasePrice, PurchaseDate, DepreciationRate, UsefulLife,
                    SerialNumber, Barcode, ReferenceNumber,
                    InventoryYear, Notes, IsActive,
                    DateEntered, CreatedBy
                ) VALUES (
                    @AssetName, @BaseAssetCode, @FullAssetCode, @Description,
                    @AssetTypeID, @SubTypeID, @ModelID,
                    @MainLocationID, @SubLocationID,
                    @Quantity, @StatusID, @EmployeeID,
                    @PurchasePrice, @PurchaseDate, @DepreciationRate, @UsefulLife,
                    @SerialNumber, @Barcode, @ReferenceNumber,
                    @InventoryYear, @Notes, @IsActive,
                    GETDATE(), @CreatedBy
                );
                SELECT SCOPE_IDENTITY();";

            SqlParameter[] parameters = new SqlParameter[]
            {
                new SqlParameter("@AssetName", asset.AssetName.Trim()),
                new SqlParameter("@BaseAssetCode", asset.BaseAssetCode ?? (object)DBNull.Value),
                new SqlParameter("@FullAssetCode", asset.FullAssetCode ?? (object)DBNull.Value),
                new SqlParameter("@Description", (object)asset.Description ?? DBNull.Value),

                new SqlParameter("@AssetTypeID", (object)asset.AssetTypeID ?? DBNull.Value),
                new SqlParameter("@SubTypeID", (object)asset.SubTypeID ?? DBNull.Value),
                new SqlParameter("@ModelID", (object)asset.ModelID ?? DBNull.Value),
                new SqlParameter("@MainLocationID", (object)asset.MainLocationID ?? DBNull.Value),
                new SqlParameter("@SubLocationID", (object)asset.SubLocationID ?? DBNull.Value),

                new SqlParameter("@Quantity", asset.Quantity),
                new SqlParameter("@StatusID", (object)asset.StatusID ?? DBNull.Value),
                new SqlParameter("@EmployeeID", (object)asset.EmployeeID ?? DBNull.Value),

                new SqlParameter("@PurchasePrice", (object)asset.PurchasePrice ?? DBNull.Value),
                new SqlParameter("@PurchaseDate", (object)asset.PurchaseDate ?? DBNull.Value),
                new SqlParameter("@DepreciationRate", (object)asset.DepreciationRate ?? DBNull.Value),
                new SqlParameter("@UsefulLife", (object)asset.UsefulLife ?? DBNull.Value),

                new SqlParameter("@SerialNumber", (object)asset.SerialNumber ?? DBNull.Value),
                new SqlParameter("@Barcode", (object)asset.Barcode ?? DBNull.Value),
                new SqlParameter("@ReferenceNumber", (object)asset.ReferenceNumber ?? DBNull.Value),

                new SqlParameter("@InventoryYear", (object)asset.InventoryYear ?? DBNull.Value),
                new SqlParameter("@Notes", (object)asset.Notes ?? DBNull.Value),
                new SqlParameter("@IsActive", asset.IsActive),
                new SqlParameter("@CreatedBy", Environment.UserName)
            };

            object result = DatabaseHelper.ExecuteScalar(query, parameters);

            if (result != null && result != DBNull.Value)
                return Convert.ToInt32(result);

            return 0;
        }

        /// <summary>
        /// تحديث أصل موجود
        /// </summary>
        public SaveResult UpdateAsset(Asset asset)
        {
            SaveResult result = new SaveResult();

            try
            {
                // التحقق من البيانات
                string validationError;
                if (!asset.Validate(out validationError))
                {
                    result.Success = false;
                    result.Message = validationError;
                    return result;
                }

                // تحديث الكود الكامل إذا تغير الموقع
                if (asset.MainLocationID.HasValue && !string.IsNullOrEmpty(asset.BaseAssetCode))
                {
                    string newFullCode = GenerateUniqueFullCode(
                        asset.BaseAssetCode, asset.MainLocationID.Value);

                    // لا نغيّر إلا إذا كان الكود الجديد مختلفاً
                    // ونتأكد أنه ليس موجوداً لأصل آخر
                    if (newFullCode != asset.FullAssetCode)
                    {
                        if (!FullCodeExists(newFullCode, asset.AssetID))
                        {
                            asset.FullAssetCode = newFullCode;
                        }
                    }
                }

                string query = @"UPDATE tblAssets SET
                    AssetName = @AssetName,
                    BaseAssetCode = @BaseAssetCode,
                    FullAssetCode = @FullAssetCode,
                    Description = @Description,
                    AssetTypeID = @AssetTypeID,
                    SubTypeID = @SubTypeID,
                    ModelID = @ModelID,
                    MainLocationID = @MainLocationID,
                    SubLocationID = @SubLocationID,
                    Quantity = @Quantity,
                    StatusID = @StatusID,
                    EmployeeID = @EmployeeID,
                    PurchasePrice = @PurchasePrice,
                    PurchaseDate = @PurchaseDate,
                    DepreciationRate = @DepreciationRate,
                    UsefulLife = @UsefulLife,
                    SerialNumber = @SerialNumber,
                    Barcode = @Barcode,
                    ReferenceNumber = @ReferenceNumber,
                    InventoryYear = @InventoryYear,
                    Notes = @Notes,
                    ModifiedDate = GETDATE(),
                    ModifiedBy = @ModifiedBy
                WHERE AssetID = @AssetID";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@AssetName", asset.AssetName.Trim()),
                    new SqlParameter("@BaseAssetCode", asset.BaseAssetCode ?? (object)DBNull.Value),
                    new SqlParameter("@FullAssetCode", asset.FullAssetCode ?? (object)DBNull.Value),
                    new SqlParameter("@Description", (object)asset.Description ?? DBNull.Value),

                    new SqlParameter("@AssetTypeID", (object)asset.AssetTypeID ?? DBNull.Value),
                    new SqlParameter("@SubTypeID", (object)asset.SubTypeID ?? DBNull.Value),
                    new SqlParameter("@ModelID", (object)asset.ModelID ?? DBNull.Value),
                    new SqlParameter("@MainLocationID", (object)asset.MainLocationID ?? DBNull.Value),
                    new SqlParameter("@SubLocationID", (object)asset.SubLocationID ?? DBNull.Value),

                    new SqlParameter("@Quantity", asset.Quantity),
                    new SqlParameter("@StatusID", (object)asset.StatusID ?? DBNull.Value),
                    new SqlParameter("@EmployeeID", (object)asset.EmployeeID ?? DBNull.Value),

                    new SqlParameter("@PurchasePrice", (object)asset.PurchasePrice ?? DBNull.Value),
                    new SqlParameter("@PurchaseDate", (object)asset.PurchaseDate ?? DBNull.Value),
                    new SqlParameter("@DepreciationRate", (object)asset.DepreciationRate ?? DBNull.Value),
                    new SqlParameter("@UsefulLife", (object)asset.UsefulLife ?? DBNull.Value),

                    new SqlParameter("@SerialNumber", (object)asset.SerialNumber ?? DBNull.Value),
                    new SqlParameter("@Barcode", (object)asset.Barcode ?? DBNull.Value),
                    new SqlParameter("@ReferenceNumber", (object)asset.ReferenceNumber ?? DBNull.Value),

                    new SqlParameter("@InventoryYear", (object)asset.InventoryYear ?? DBNull.Value),
                    new SqlParameter("@Notes", (object)asset.Notes ?? DBNull.Value),
                    new SqlParameter("@ModifiedBy", Environment.UserName),
                    new SqlParameter("@AssetID", asset.AssetID)
                };

                int affected = DatabaseHelper.ExecuteNonQuery(query, parameters);

                if (affected > 0)
                {
                    result.Success = true;
                    result.NewAssetID = asset.AssetID;
                    result.FullAssetCode = asset.FullAssetCode;
                    result.Message = "تم تحديث الأصل بنجاح";
                }
                else
                {
                    result.Success = false;
                    result.Message = "لم يتم العثور على السجل أو لم يتغير شيء";
                }
            }
            catch (Exception ex)
            {
                result.Success = false;
                result.Message = "خطأ في التحديث: " + ex.Message;
            }

            return result;
        }

        /// <summary>
        /// حذف أصل (حذف منطقي - تعيين IsActive = 0)
        /// </summary>
        public bool DeleteAsset(int assetID)
        {
            try
            {
                string query = @"UPDATE tblAssets 
                                SET IsActive = 0, 
                                    ModifiedDate = GETDATE(), 
                                    ModifiedBy = @ModifiedBy 
                                WHERE AssetID = @AssetID";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@ModifiedBy", Environment.UserName),
                    new SqlParameter("@AssetID", assetID)
                };

                int affected = DatabaseHelper.ExecuteNonQuery(query, parameters);
                return affected > 0;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في DeleteAsset: " + ex.Message);
                return false;
            }
        }

        /// <summary>
        /// جلب أصل واحد بمعرفه مع أسماء العرض
        /// </summary>
        public Asset GetAssetByID(int assetID)
        {
            try
            {
                string query = @"SELECT a.*,
                    t.AssetTypeName,
                    st.SubTypeName,
                    m.ModelName,
                    ml.MainLocationName,
                    sl.SubLocationName,
                    s.StatusName,
                    s.StatusColor,
                    e.EmployeeName
                FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID = t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
                LEFT JOIN tblAssetModels m ON a.ModelID = m.ModelID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID = e.EmployeeID
                WHERE a.AssetID = @AssetID";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@AssetID", assetID)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                if (dt.Rows.Count > 0)
                    return MapDataRowToAsset(dt.Rows[0]);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetAssetByID: " + ex.Message);
            }

            return null;
        }

        /// <summary>
        /// تحويل DataRow إلى كائن Asset
        /// </summary>
        private Asset MapDataRowToAsset(DataRow row)
        {
            Asset asset = new Asset();

            asset.AssetID = GetInt(row, "AssetID");
            asset.AssetName = GetString(row, "AssetName");
            asset.BaseAssetCode = GetString(row, "BaseAssetCode");
            asset.FullAssetCode = GetString(row, "FullAssetCode");
            asset.Description = GetString(row, "Description");

            asset.AssetTypeID = GetNullableInt(row, "AssetTypeID");
            asset.SubTypeID = GetNullableInt(row, "SubTypeID");
            asset.ModelID = GetNullableInt(row, "ModelID");
            asset.MainLocationID = GetNullableInt(row, "MainLocationID");
            asset.SubLocationID = GetNullableInt(row, "SubLocationID");
            asset.StatusID = GetNullableInt(row, "StatusID");
            asset.EmployeeID = GetNullableInt(row, "EmployeeID");

            asset.PurchasePrice = GetNullableDecimal(row, "PurchasePrice");
            asset.PurchaseDate = GetNullableDateTime(row, "PurchaseDate");
            asset.DepreciationRate = GetNullableDecimal(row, "DepreciationRate");
            asset.UsefulLife = GetNullableInt(row, "UsefulLife");

            asset.Quantity = GetInt(row, "Quantity", 1);
            asset.SerialNumber = GetString(row, "SerialNumber");
            asset.Barcode = GetString(row, "Barcode");
            asset.ReferenceNumber = GetString(row, "ReferenceNumber");
            asset.InventoryYear = GetNullableInt(row, "InventoryYear");
            asset.Notes = GetString(row, "Notes");
            asset.IsActive = GetBool(row, "IsActive", true);

            asset.DateEntered = GetDateTime(row, "DateEntered");
            asset.CreatedBy = GetString(row, "CreatedBy");
            asset.ModifiedDate = GetNullableDateTime(row, "ModifiedDate");
            asset.ModifiedBy = GetString(row, "ModifiedBy");

            // أسماء العرض
            asset.AssetTypeName = GetString(row, "AssetTypeName");
            asset.SubTypeName = GetString(row, "SubTypeName");
            asset.ModelName = GetString(row, "ModelName");
            asset.MainLocationName = GetString(row, "MainLocationName");
            asset.SubLocationName = GetString(row, "SubLocationName");
            asset.StatusName = GetString(row, "StatusName");
            asset.StatusColor = GetString(row, "StatusColor");
            asset.EmployeeName = GetString(row, "EmployeeName");

            return asset;
        }

        // --- دوال مساعدة لقراءة DataRow بأمان ---

        private string GetString(DataRow row, string columnName)
        {
            try
            {
                if (row.Table.Columns.Contains(columnName) &&
                    row[columnName] != DBNull.Value)
                    return row[columnName].ToString();
            }
            catch { }
            return null;
        }

        private int GetInt(DataRow row, string columnName, int defaultValue = 0)
        {
            try
            {
                if (row.Table.Columns.Contains(columnName) &&
                    row[columnName] != DBNull.Value)
                    return Convert.ToInt32(row[columnName]);
            }
            catch { }
            return defaultValue;
        }

        private int? GetNullableInt(DataRow row, string columnName)
        {
            try
            {
                if (row.Table.Columns.Contains(columnName) &&
                    row[columnName] != DBNull.Value)
                    return Convert.ToInt32(row[columnName]);
            }
            catch { }
            return null;
        }

        private decimal? GetNullableDecimal(DataRow row, string columnName)
        {
            try
            {
                if (row.Table.Columns.Contains(columnName) &&
                    row[columnName] != DBNull.Value)
                    return Convert.ToDecimal(row[columnName]);
            }
            catch { }
            return null;
        }

        private DateTime GetDateTime(DataRow row, string columnName)
        {
            try
            {
                if (row.Table.Columns.Contains(columnName) &&
                    row[columnName] != DBNull.Value)
                    return Convert.ToDateTime(row[columnName]);
            }
            catch { }
            return DateTime.Now;
        }

        private DateTime? GetNullableDateTime(DataRow row, string columnName)
        {
            try
            {
                if (row.Table.Columns.Contains(columnName) &&
                    row[columnName] != DBNull.Value)
                    return Convert.ToDateTime(row[columnName]);
            }
            catch { }
            return null;
        }

        private bool GetBool(DataRow row, string columnName, bool defaultValue = false)
        {
            try
            {
                if (row.Table.Columns.Contains(columnName) &&
                    row[columnName] != DBNull.Value)
                    return Convert.ToBoolean(row[columnName]);
            }
            catch { }
            return defaultValue;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 6: البحث والاستعلامات
        // ═══════════════════════════════════════════════════════════

        #region Search & Queries

        /// <summary>
        /// جلب آخر N أصل (الأحدث أولاً)
        /// </summary>
        public List<Asset> GetRecentAssets(int count = 30)
        {
            List<Asset> assets = new List<Asset>();

            try
            {
                string query = string.Format(@"SELECT TOP {0} a.*,
                    t.AssetTypeName,
                    st.SubTypeName,
                    m.ModelName,
                    ml.MainLocationName,
                    sl.SubLocationName,
                    s.StatusName,
                    s.StatusColor,
                    e.EmployeeName
                FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID = t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
                LEFT JOIN tblAssetModels m ON a.ModelID = m.ModelID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID = e.EmployeeID
                WHERE a.IsActive = 1
                ORDER BY a.DateEntered DESC", count);

                DataTable dt = DatabaseHelper.GetData(query);

                foreach (DataRow row in dt.Rows)
                {
                    assets.Add(MapDataRowToAsset(row));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetRecentAssets: " + ex.Message);
            }

            return assets;
        }
        /// <summary>
        /// جلب جميع الأصول النشطة بدون حد أقصى
        /// مرتبة حسب الاسم
        /// </summary>
        public List<Asset> GetAllAssets()
        {
            List<Asset> assets = new List<Asset>();

            try
            {
                string query = @"SELECT a.*,
            t.AssetTypeName,
            st.SubTypeName,
            m.ModelName,
            ml.MainLocationName,
            sl.SubLocationName,
            s.StatusName,
            s.StatusColor,
            e.EmployeeName
        FROM tblAssets a
        LEFT JOIN tblAssetTypes t ON a.AssetTypeID = t.AssetTypeID
        LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
        LEFT JOIN tblAssetModels m ON a.ModelID = m.ModelID
        LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
        LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
        LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
        LEFT JOIN tblEmployees e ON a.EmployeeID = e.EmployeeID
        WHERE a.IsActive = 1
        ORDER BY a.AssetName";

                DataTable dt = DatabaseHelper.GetData(query);

                // 🔴 رسالة تشخيصية للتأكد من أن الاستعلام يجلب بيانات
                if (dt.Rows.Count == 0)
                {
                    System.Windows.MessageBox.Show("الاستعلام في GetAllAssets لم يرجع أي بيانات رغم وجودها في القاعدة!", "تشخيص AssetService");
                }

                foreach (DataRow row in dt.Rows)
                {
                    assets.Add(MapDataRowToAsset(row));
                }
            }
            catch (Exception ex)
            {
                // 🔴 إظهار الخطأ الصامت الذي قد يمنع تحميل القائمة
                System.Windows.MessageBox.Show("خطأ خطير أثناء جلب الأصول في GetAllAssets:\n" + ex.Message, "خطأ تشخيصي");
                System.Diagnostics.Debug.WriteLine("خطأ في GetAllAssets: " + ex.Message);
            }

            return assets;
        }

        /// <summary>
        /// بحث ذكي في الأصول (يبحث في عدة حقول)
        /// </summary>
        /// <param name="searchText">نص البحث (حرفين على الأقل)</param>
        /// <param name="maxResults">أقصى عدد نتائج</param>
        /// <returns>قائمة بالأصول المطابقة</returns>
        public List<Asset> SmartSearch(string searchText, int maxResults = 20)
        {
            List<Asset> results = new List<Asset>();

            if (string.IsNullOrWhiteSpace(searchText) || searchText.Trim().Length < 2)
                return results;

            try
            {
                string searchPattern = "%" + searchText.Trim() + "%";

                string query = string.Format(@"SELECT TOP {0} a.*,
                    t.AssetTypeName,
                    st.SubTypeName,
                    m.ModelName,
                    ml.MainLocationName,
                    sl.SubLocationName,
                    s.StatusName,
                    s.StatusColor,
                    e.EmployeeName
                FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID = t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
                LEFT JOIN tblAssetModels m ON a.ModelID = m.ModelID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID = e.EmployeeID
                WHERE a.IsActive = 1
                AND (
                    a.AssetName LIKE @Search
                    OR a.BaseAssetCode LIKE @Search
                    OR a.FullAssetCode LIKE @Search
                    OR a.SerialNumber LIKE @Search
                    OR a.Barcode LIKE @Search
                    OR a.Description LIKE @Search
                    OR ml.MainLocationName LIKE @Search
                    OR t.AssetTypeName LIKE @Search
                    OR e.EmployeeName LIKE @Search
                )
                ORDER BY 
                    CASE WHEN a.AssetName LIKE @Search THEN 0 ELSE 1 END,
                    CASE WHEN a.BaseAssetCode LIKE @Search THEN 0 ELSE 1 END,
                    a.AssetName", maxResults);

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@Search", searchPattern)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                foreach (DataRow row in dt.Rows)
                {
                    results.Add(MapDataRowToAsset(row));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في SmartSearch: " + ex.Message);
            }

            return results;
        }

        /// <summary>
        /// جلب جميع المواقع التي يوجد بها نفس الكود الأساسي
        /// (نفس الأصل موزع على عدة مواقع)
        /// </summary>
        public List<Asset> GetAssetLocations(string baseAssetCode)
        {
            List<Asset> locations = new List<Asset>();

            if (string.IsNullOrWhiteSpace(baseAssetCode))
                return locations;

            try
            {
                string query = @"SELECT a.AssetID, a.AssetName, a.BaseAssetCode,
                    a.FullAssetCode, a.Quantity,
                    ml.MainLocationName, sl.SubLocationName,
                    s.StatusName, s.StatusColor, e.EmployeeName
                FROM tblAssets a
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID = e.EmployeeID
                WHERE a.BaseAssetCode = @BaseCode AND a.IsActive = 1
                ORDER BY ml.MainLocationName";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@BaseCode", baseAssetCode)
                };

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                foreach (DataRow row in dt.Rows)
                {
                    Asset loc = new Asset();
                    loc.AssetID = GetInt(row, "AssetID");
                    loc.AssetName = GetString(row, "AssetName");
                    loc.BaseAssetCode = GetString(row, "BaseAssetCode");
                    loc.FullAssetCode = GetString(row, "FullAssetCode");
                    loc.Quantity = GetInt(row, "Quantity", 1);
                    loc.MainLocationName = GetString(row, "MainLocationName");
                    loc.SubLocationName = GetString(row, "SubLocationName");
                    loc.StatusName = GetString(row, "StatusName");
                    loc.StatusColor = GetString(row, "StatusColor");
                    loc.EmployeeName = GetString(row, "EmployeeName");
                    locations.Add(loc);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetAssetLocations: " + ex.Message);
            }

            return locations;
        }

        /// <summary>
        /// جلب جميع الأصول (للتقارير والتصدير)
        /// </summary>
        public DataTable GetAllAssetsDataTable(string whereClause = "")
        {
            try
            {
                string query = @"SELECT a.AssetID, a.AssetName, a.BaseAssetCode,
                    a.FullAssetCode, a.Quantity, a.Description,
                    t.AssetTypeName, st.SubTypeName,
                    ml.MainLocationName, sl.SubLocationName,
                    s.StatusName, m.ModelName, e.EmployeeName,
                    a.PurchasePrice, a.PurchaseDate,
                    a.SerialNumber, a.Barcode, a.InventoryYear,
                    a.DateEntered, a.Notes
                FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID = t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
                LEFT JOIN tblAssetModels m ON a.ModelID = m.ModelID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID = e.EmployeeID
                WHERE a.IsActive = 1";

                if (!string.IsNullOrWhiteSpace(whereClause))
                    query += " AND " + whereClause;

                query += " ORDER BY a.AssetName";

                return DatabaseHelper.GetData(query);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetAllAssetsDataTable: " + ex.Message);
                return new DataTable();
            }
        }

        /// <summary>
        /// عدد الأصول النشطة
        /// </summary>
        public int GetTotalAssetCount()
        {
            try
            {
                object result = DatabaseHelper.ExecuteScalar(
                    "SELECT COUNT(*) FROM tblAssets WHERE IsActive = 1");
                return Convert.ToInt32(result);
            }
            catch { return 0; }
        }

        /// <summary>
        /// جلب أسماء الأصول الفريدة (للإكمال التلقائي)
        /// </summary>
        public List<string> GetDistinctAssetNames()
        {
            List<string> names = new List<string>();

            try
            {
                DataTable dt = DatabaseHelper.GetData(
                    @"SELECT DISTINCT AssetName FROM tblAssets 
                      WHERE IsActive = 1 ORDER BY AssetName");

                foreach (DataRow row in dt.Rows)
                {
                    if (row["AssetName"] != DBNull.Value)
                        names.Add(row["AssetName"].ToString());
                }
            }
            catch { }

            return names;
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 7: تحميل القوائم المنسدلة (Lookup Data)
        // ═══════════════════════════════════════════════════════════

        #region Lookup Data

        /// <summary>جلب أنواع الأصول الرئيسية</summary>
        public List<LookupItem> GetAssetTypes()
        {
            return GetLookupList(
                "SELECT AssetTypeID, AssetTypeName FROM tblAssetTypes WHERE IsActive = 1 ORDER BY AssetTypeName",
                "AssetTypeID", "AssetTypeName");
        }

        /// <summary>جلب الأنواع الفرعية حسب النوع الرئيسي</summary>
        public List<LookupItem> GetSubTypes(int assetTypeID)
        {
            string query = @"SELECT SubTypeID, SubTypeName, ParentSubTypeID 
                            FROM tblSubTypeAssets 
                            WHERE AssetTypeID = @TypeID AND IsActive = 1 
                            ORDER BY SubTypeName";

            SqlParameter[] parameters = new SqlParameter[]
            {
                new SqlParameter("@TypeID", assetTypeID)
            };

            return GetLookupListWithParams(query, parameters,
                "SubTypeID", "SubTypeName", "ParentSubTypeID");
        }

        /// <summary>جلب المواقع الرئيسية</summary>
        public List<LookupItem> GetMainLocations()
        {
            return GetLookupList(
                "SELECT MainLocationID, MainLocationName FROM tblMainLocations WHERE IsActive = 1 ORDER BY MainLocationName",
                "MainLocationID", "MainLocationName");
        }

        /// <summary>جلب المواقع الفرعية حسب الموقع الرئيسي</summary>
        public List<LookupItem> GetSubLocations(int mainLocationID)
        {
            string query = @"SELECT SubLocationID, SubLocationName, ParentSubLocationID 
                            FROM tblSubLocations 
                            WHERE MainLocationID = @LocID AND IsActive = 1 
                            ORDER BY SubLocationName";

            SqlParameter[] parameters = new SqlParameter[]
            {
                new SqlParameter("@LocID", mainLocationID)
            };

            return GetLookupListWithParams(query, parameters,
                "SubLocationID", "SubLocationName", "ParentSubLocationID");
        }

        /// <summary>جلب حالات الأصول</summary>
        public List<LookupItem> GetStatuses()
        {
            return GetLookupList(
                "SELECT StatusID, StatusName FROM tblStatus WHERE IsActive = 1 ORDER BY StatusName",
                "StatusID", "StatusName");
        }

        /// <summary>جلب الموديلات (كل الموديلات أو حسب النوع)</summary>
        public List<LookupItem> GetModels(int? assetTypeID = null)
        {
            if (assetTypeID.HasValue && assetTypeID.Value > 0)
            {
                string query = @"SELECT ModelID, ModelName FROM tblAssetModels 
                                WHERE IsActive = 1 
                                AND (AssetTypeID = @TypeID OR AssetTypeID IS NULL)
                                ORDER BY ModelName";

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@TypeID", assetTypeID.Value)
                };

                return GetLookupListWithParams(query, parameters,
                    "ModelID", "ModelName");
            }

            return GetLookupList(
                "SELECT ModelID, ModelName FROM tblAssetModels WHERE IsActive = 1 ORDER BY ModelName",
                "ModelID", "ModelName");
        }

        /// <summary>جلب الموظفين</summary>
        public List<LookupItem> GetEmployees()
        {
            return GetLookupList(
                "SELECT EmployeeID, EmployeeName FROM tblEmployees WHERE IsActive = 1 ORDER BY EmployeeName",
                "EmployeeID", "EmployeeName");
        }

        // --- دوال مساعدة لتحميل القوائم ---

        private List<LookupItem> GetLookupList(string query, string idField, string nameField)
        {
            List<LookupItem> items = new List<LookupItem>();

            try
            {
                DataTable dt = DatabaseHelper.GetData(query);
                foreach (DataRow row in dt.Rows)
                {
                    items.Add(new LookupItem(
                        Convert.ToInt32(row[idField]),
                        row[nameField].ToString()));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetLookupList: " + ex.Message);
            }

            return items;
        }

        private List<LookupItem> GetLookupListWithParams(string query,
            SqlParameter[] parameters, string idField, string nameField,
            string parentField = null)
        {
            List<LookupItem> items = new List<LookupItem>();

            try
            {
                DataTable dt = DatabaseHelper.GetData(query, parameters);
                foreach (DataRow row in dt.Rows)
                {
                    int? parentID = null;
                    if (parentField != null && row.Table.Columns.Contains(parentField)
                        && row[parentField] != DBNull.Value)
                    {
                        parentID = Convert.ToInt32(row[parentField]);
                    }

                    items.Add(new LookupItem(
                        Convert.ToInt32(row[idField]),
                        row[nameField].ToString(),
                        parentID));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetLookupListWithParams: " + ex.Message);
            }

            return items;
        }

        /// <summary>جلب اسم الموقع الرئيسي بمعرفه</summary>
        public string GetLocationName(int mainLocationID)
        {
            try
            {
                if (mainLocationID <= 0) return "غير محدد";

                object result = DatabaseHelper.ExecuteScalar(
                    "SELECT MainLocationName FROM tblMainLocations WHERE MainLocationID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", mainLocationID) });

                if (result != null && result != DBNull.Value)
                    return result.ToString();
            }
            catch { }
            return "غير محدد";
        }

        /// <summary>جلب اسم الحالة بمعرفها</summary>
        public string GetStatusName(int statusID)
        {
            try
            {
                if (statusID <= 0) return "غير محدد";

                object result = DatabaseHelper.ExecuteScalar(
                    "SELECT StatusName FROM tblStatus WHERE StatusID = @ID",
                    new SqlParameter[] { new SqlParameter("@ID", statusID) });

                if (result != null && result != DBNull.Value)
                    return result.ToString();
            }
            catch { }
            return "غير محدد";
        }

        #endregion

        // ═══════════════════════════════════════════════════════════
        // القسم 8: التعديل الجماعي
        // ═══════════════════════════════════════════════════════════

        #region Bulk Operations

        /// <summary>
        /// تحديث جماعي لحقل واحد في عدة أصول
        /// </summary>
        /// <param name="assetIDs">قائمة معرفات الأصول</param>
        /// <param name="fieldName">اسم الحقل</param>
        /// <param name="newValue">القيمة الجديدة</param>
        /// <returns>عدد السجلات المتأثرة</returns>
        public int BulkUpdateField(List<int> assetIDs, string fieldName, object newValue)
        {
            if (assetIDs == null || assetIDs.Count == 0)
                return 0;

            try
            {
                // بناء قائمة المعرفات
                string idList = string.Join(",", assetIDs);

                string query = string.Format(
                    @"UPDATE tblAssets SET {0} = @NewValue, 
                      ModifiedDate = GETDATE(), ModifiedBy = @ModifiedBy 
                      WHERE AssetID IN ({1}) AND IsActive = 1",
                    fieldName, idList);

                SqlParameter[] parameters = new SqlParameter[]
                {
                    new SqlParameter("@NewValue", newValue ?? DBNull.Value),
                    new SqlParameter("@ModifiedBy", Environment.UserName)
                };

                return DatabaseHelper.ExecuteNonQuery(query, parameters);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في BulkUpdateField: " + ex.Message);
                return 0;
            }
        }

        /// <summary>
        /// تحديث جماعي للاسم والكود معاً
        /// (يولد كود كامل جديد لكل أصل حسب موقعه)
        /// </summary>
        public int BulkUpdateNameAndCode(List<int> assetIDs,
            string newName, string newBaseCode)
        {
            if (assetIDs == null || assetIDs.Count == 0)
                return 0;

            int updatedCount = 0;

            try
            {
                foreach (int assetID in assetIDs)
                {
                    Asset asset = GetAssetByID(assetID);
                    if (asset == null) continue;

                    // توليد كود كامل جديد لكل أصل حسب موقعه
                    string fullCode = GenerateUniqueFullCode(
                        newBaseCode, asset.MainLocationID ?? 0);

                    string query = @"UPDATE tblAssets SET 
                        AssetName = @NewName,
                        BaseAssetCode = @NewBaseCode,
                        FullAssetCode = @NewFullCode,
                        ModifiedDate = GETDATE(),
                        ModifiedBy = @ModifiedBy
                        WHERE AssetID = @AssetID";

                    SqlParameter[] parameters = new SqlParameter[]
                    {
                        new SqlParameter("@NewName", newName),
                        new SqlParameter("@NewBaseCode", newBaseCode),
                        new SqlParameter("@NewFullCode", fullCode),
                        new SqlParameter("@ModifiedBy", Environment.UserName),
                        new SqlParameter("@AssetID", assetID)
                    };

                    int affected = DatabaseHelper.ExecuteNonQuery(query, parameters);
                    if (affected > 0) updatedCount++;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في BulkUpdateNameAndCode: " + ex.Message);
            }

            return updatedCount;
        }

        /// <summary>
        /// جلب أصول حسب شرط معين (للتعديل الجماعي)
        /// </summary>
        public List<Asset> GetAssetsByFilter(string filterType, string filterValue)
        {
            List<Asset> assets = new List<Asset>();
            string whereClause = "";

            switch (filterType.ToLower())
            {
                case "basecode":
                    whereClause = "a.BaseAssetCode = @FilterValue";
                    break;
                case "name":
                    whereClause = "a.AssetName = @FilterValue";
                    break;
                case "location":
                    whereClause = "a.MainLocationID = @FilterValueInt";
                    break;
                case "status":
                    whereClause = "a.StatusID = @FilterValueInt";
                    break;
                case "type":
                    whereClause = "a.AssetTypeID = @FilterValueInt";
                    break;
                case "fullcode":
                    whereClause = "a.FullAssetCode = @FilterValue";
                    break;
                default:
                    return assets;
            }

            try
            {
                string query = @"SELECT a.*, 
                    t.AssetTypeName, st.SubTypeName, m.ModelName,
                    ml.MainLocationName, sl.SubLocationName,
                    s.StatusName, s.StatusColor, e.EmployeeName
                FROM tblAssets a
                LEFT JOIN tblAssetTypes t ON a.AssetTypeID = t.AssetTypeID
                LEFT JOIN tblSubTypeAssets st ON a.SubTypeID = st.SubTypeID
                LEFT JOIN tblAssetModels m ON a.ModelID = m.ModelID
                LEFT JOIN tblMainLocations ml ON a.MainLocationID = ml.MainLocationID
                LEFT JOIN tblSubLocations sl ON a.SubLocationID = sl.SubLocationID
                LEFT JOIN tblStatus s ON a.StatusID = s.StatusID
                LEFT JOIN tblEmployees e ON a.EmployeeID = e.EmployeeID
                WHERE a.IsActive = 1 AND " + whereClause;

                SqlParameter[] parameters;

                if (whereClause.Contains("@FilterValueInt"))
                {
                    int intValue;
                    if (!int.TryParse(filterValue, out intValue))
                        return assets;

                    parameters = new SqlParameter[]
                    {
                        new SqlParameter("@FilterValueInt", intValue)
                    };
                }
                else
                {
                    parameters = new SqlParameter[]
                    {
                        new SqlParameter("@FilterValue", filterValue)
                    };
                }

                DataTable dt = DatabaseHelper.GetData(query, parameters);

                foreach (DataRow row in dt.Rows)
                {
                    assets.Add(MapDataRowToAsset(row));
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("خطأ في GetAssetsByFilter: " + ex.Message);
            }

            return assets;
        }

        #endregion
    }

    // ═══════════════════════════════════════════════════════════
    // كلاسات النتائج المساعدة
    // ═══════════════════════════════════════════════════════════

    #region Result Classes

    /// <summary>
    /// أنواع العمليات عند إضافة أصل
    /// </summary>
    public enum OperationType
    {
        /// <summary>أصل جديد تماماً</summary>
        NewAsset,
        /// <summary>نفس الاسم في موقع مختلف (يشارك الكود الأساسي)</summary>
        NewVariant,
        /// <summary>تطابق تام (دمج كميات)</summary>
        Merge
    }

    /// <summary>
    /// نتيجة فحص التكرار
    /// </summary>
    public class DuplicateCheckResult
    {
        public OperationType OperationType { get; set; }
        public int ExistingAssetID { get; set; }
        public string Message { get; set; }
        public string Differences { get; set; }
    }

    /// <summary>
    /// نتيجة عملية الحفظ
    /// </summary>
    public class SaveResult
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public int NewAssetID { get; set; }
        public string BaseAssetCode { get; set; }
        public string FullAssetCode { get; set; }

        // خاص بالدمج
        public bool RequiresMergeConfirmation { get; set; }
        public int ExistingAssetID { get; set; }
        public int MergeQuantity { get; set; }
        public int CurrentQuantity { get; set; }
        public int NewTotalQuantity { get; set; }
        public bool IsMerged { get; set; }

        // خاص بالمتغير الجديد
        public bool IsNewVariant { get; set; }
        public string Differences { get; set; }
    }

    /// <summary>
    /// نتيجة بحث التشابه
    /// </summary>
    public class SimilarAssetResult
    {
        public int AssetID { get; set; }
        public string AssetName { get; set; }
        public string BaseAssetCode { get; set; }
        public double SimilarityPercentage { get; set; }

        public string DisplayText
        {
            get
            {
                return string.Format("{0}% - {1} [{2}]",
                    SimilarityPercentage, AssetName, BaseAssetCode);
            }
        }
    }

    #endregion
}