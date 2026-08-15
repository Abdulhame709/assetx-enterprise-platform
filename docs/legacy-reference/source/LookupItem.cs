// Models/LookupItem.cs
namespace AssetManagement.Models
{
    /// <summary>
    /// كلاس بسيط يمثل عنصر في قائمة منسدلة (ComboBox)
    /// يُستخدم لجميع الجداول المرجعية
    /// </summary>
    public class LookupItem : BaseModel
    {
        private int _id;
        private string _name;
        private string _code;
        private int? _parentID;
        private bool _isActive;

        /// <summary>المعرف (ID)</summary>
        public int ID
        {
            get { return _id; }
            set { SetProperty(ref _id, value); }
        }

        /// <summary>الاسم (للعرض في القائمة)</summary>
        public string Name
        {
            get { return _name; }
            set { SetProperty(ref _name, value); }
        }

        /// <summary>الكود (اختياري)</summary>
        public string Code
        {
            get { return _code; }
            set { SetProperty(ref _code, value); }
        }

        /// <summary>معرف الأب (للقوائم الهرمية مثل المواقع الفرعية)</summary>
        public int? ParentID
        {
            get { return _parentID; }
            set { SetProperty(ref _parentID, value); }
        }

        /// <summary>هل العنصر نشط</summary>
        public bool IsActive
        {
            get { return _isActive; }
            set { SetProperty(ref _isActive, value); }
        }

        /// <summary>نص العرض في القائمة</summary>
        public string DisplayText
        {
            get
            {
                if (string.IsNullOrEmpty(_code))
                    return _name ?? string.Empty;
                return string.Format("{0} - {1}", _code, _name);
            }
        }

        public LookupItem()
        {
            _isActive = true;
        }

        public LookupItem(int id, string name)
        {
            _id = id;
            _name = name;
            _isActive = true;
        }

        public LookupItem(int id, string name, int? parentID)
        {
            _id = id;
            _name = name;
            _parentID = parentID;
            _isActive = true;
        }

        public override string ToString()
        {
            return _name ?? string.Empty;
        }
    }
}