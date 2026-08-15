// Models/BaseModel.cs
using System;
using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace AssetManagement.Models
{
    /// <summary>
    /// كلاس أساسي يوفر خاصية الإشعار بتغيير القيم (INotifyPropertyChanged)
    /// جميع كلاسات البيانات ترث منه
    /// </summary>
    public class BaseModel : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        /// <summary>
        /// إشعار الواجهة بتغيير قيمة خاصية معينة
        /// </summary>
        /// <param name="propertyName">اسم الخاصية (يُملأ تلقائياً)</param>
        protected void OnPropertyChanged([CallerMemberName] string propertyName = null)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(propertyName));
            }
        }

        /// <summary>
        /// تعيين قيمة جديدة لحقل مع إشعار الواجهة فقط إذا تغيرت القيمة
        /// </summary>
        /// <typeparam name="T">نوع البيانات</typeparam>
        /// <param name="field">المتغير الخاص (private field)</param>
        /// <param name="value">القيمة الجديدة</param>
        /// <param name="propertyName">اسم الخاصية</param>
        /// <returns>true إذا تغيرت القيمة</returns>
        protected bool SetProperty<T>(ref T field, T value, [CallerMemberName] string propertyName = null)
        {
            // إذا القيمة نفسها لا داعي للتحديث
            if (Equals(field, value))
                return false;

            field = value;
            OnPropertyChanged(propertyName);
            return true;
        }
    }
}