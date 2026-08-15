using System;
using System.Configuration;
using System.Data;
using System.Data.SqlClient;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// كلاس مساعد للاتصال بقاعدة البيانات SQL Server
    /// جميع عمليات القراءة والكتابة تمر من هنا
    /// </summary>
    public static class DatabaseHelper
    {
        // ─────────────────────────────────────────────
        // سلسلة الاتصال - تُقرأ من ملف App.config
        // ─────────────────────────────────────────────
        public static string GetConnectionString()
        {
            return ConfigurationManager.ConnectionStrings["AssetDB"].ConnectionString;
        }

        // ─────────────────────────────────────────────
        // اختبار الاتصال بقاعدة البيانات
        // ─────────────────────────────────────────────
        /// <summary>
        /// يختبر الاتصال بقاعدة البيانات ويرجع true إذا نجح
        /// </summary>
        public static bool TestConnection(out string errorMessage)
        {
            errorMessage = "";
            try
            {
                using (SqlConnection conn = new SqlConnection(GetConnectionString()))
                {
                    conn.Open();
                    conn.Close();
                    return true;
                }
            }
            catch (Exception ex)
            {
                errorMessage = ex.Message;
                return false;
            }
        }
        // ─────────────────────────────────────────────
        // تنفيذ INSERT مع IDENTITY_INSERT في نفس الاتصال
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ INSERT مع تفعيل IDENTITY_INSERT
        /// في نفس الاتصال (Session) لضمان عمل IDENTITY_INSERT
        /// </summary>
        public static int ExecuteWithIdentityInsert(
            string tableName,
            string insertSQL,
            SqlParameter[] parameters = null)
        {
            try
            {
                using (SqlConnection conn =
                    new SqlConnection(GetConnectionString()))
                {
                    conn.Open();

                    // ── الخطوة 1: تشغيل IDENTITY_INSERT ──
                    using (SqlCommand cmdOn = new SqlCommand(
                        "SET IDENTITY_INSERT [" + tableName + "] ON",
                        conn))
                    {
                        cmdOn.ExecuteNonQuery();
                    }

                    // ── الخطوة 2: تنفيذ INSERT ──
                    int result = 0;
                    using (SqlCommand cmdInsert =
                        new SqlCommand(insertSQL, conn))
                    {
                        cmdInsert.CommandTimeout = 60;
                        if (parameters != null)
                            cmdInsert.Parameters.AddRange(parameters);
                        result = cmdInsert.ExecuteNonQuery();
                    }

                    // ── الخطوة 3: إيقاف IDENTITY_INSERT ──
                    using (SqlCommand cmdOff = new SqlCommand(
                        "SET IDENTITY_INSERT [" + tableName + "] OFF",
                        conn))
                    {
                        cmdOff.ExecuteNonQuery();
                    }

                    return result;
                }
            }
            catch (Exception ex)
            {
                // محاولة إيقاف IDENTITY_INSERT عند حدوث خطأ
                try
                {
                    using (SqlConnection connCleanup =
                        new SqlConnection(GetConnectionString()))
                    {
                        connCleanup.Open();
                        using (SqlCommand cmdOff = new SqlCommand(
                            "SET IDENTITY_INSERT [" +
                            tableName + "] OFF",
                            connCleanup))
                        {
                            cmdOff.ExecuteNonQuery();
                        }
                    }
                }
                catch { }

                throw new Exception(
                    "خطأ في الإدراج مع Identity: " + ex.Message);
            }
        }
        // ─────────────────────────────────────────────
        // تنفيذ مجموعة أوامر INSERT في اتصال واحد
        // مع IDENTITY_INSERT
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ أمر INSERT أو UPDATE باستخدام اتصال مفتوح مسبقاً
        /// </summary>
        public static int ExecuteNonQueryWithConnection(
            SqlConnection conn,
            string query,
            SqlParameter[] parameters = null)
        {
            using (SqlCommand cmd = new SqlCommand(query, conn))
            {
                cmd.CommandTimeout = 60;
                if (parameters != null)
                    cmd.Parameters.AddRange(parameters);
                return cmd.ExecuteNonQuery();
            }
        }

        /// <summary>
        /// تنفيذ استعلام Scalar باستخدام اتصال مفتوح مسبقاً
        /// </summary>
        public static object ExecuteScalarWithConnection(
            SqlConnection conn,
            string query,
            SqlParameter[] parameters = null)
        {
            using (SqlCommand cmd = new SqlCommand(query, conn))
            {
                cmd.CommandTimeout = 60;
                if (parameters != null)
                    cmd.Parameters.AddRange(parameters);
                return cmd.ExecuteScalar();
            }
        }

        /// <summary>
        /// إنشاء اتصال جديد مفتوح
        /// </summary>
        public static SqlConnection CreateOpenConnection()
        {
            SqlConnection conn = new SqlConnection(GetConnectionString());
            conn.Open();
            return conn;
        }
        // ─────────────────────────────────────────────
        // جلب بيانات (SELECT) - ترجع جدول بيانات
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ استعلام SELECT وإرجاع النتائج في DataTable
        /// </summary>
        /// <param name="query">نص الاستعلام SQL</param>
        /// <param name="parameters">المعاملات (اختياري)</param>
        /// <returns>DataTable يحتوي على النتائج</returns>
        public static DataTable GetData(string query, SqlParameter[] parameters = null)
        {
            DataTable dt = new DataTable();

            try
            {
                using (SqlConnection conn = new SqlConnection(GetConnectionString()))
                {
                    using (SqlCommand cmd = new SqlCommand(query, conn))
                    {
                        cmd.CommandTimeout = 30;

                        // إضافة المعاملات إذا وُجدت
                        if (parameters != null)
                        {
                            cmd.Parameters.AddRange(parameters);
                        }

                        using (SqlDataAdapter adapter = new SqlDataAdapter(cmd))
                        {
                            adapter.Fill(dt);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("خطأ في جلب البيانات: " + ex.Message);
            }

            return dt;
        }

        // ─────────────────────────────────────────────
        // تنفيذ أمر (INSERT, UPDATE, DELETE)
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ أمر INSERT أو UPDATE أو DELETE
        /// يرجع عدد الصفوف المتأثرة
        /// </summary>
        public static int ExecuteNonQuery(string query, SqlParameter[] parameters = null)
        {
            try
            {
                using (SqlConnection conn = new SqlConnection(GetConnectionString()))
                {
                    using (SqlCommand cmd = new SqlCommand(query, conn))
                    {
                        cmd.CommandTimeout = 30;

                        if (parameters != null)
                        {
                            cmd.Parameters.AddRange(parameters);
                        }

                        conn.Open();
                        int result = cmd.ExecuteNonQuery();
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("خطأ في تنفيذ الأمر: " + ex.Message);
            }
        }

        // ─────────────────────────────────────────────
        // تنفيذ أمر وإرجاع قيمة واحدة (مثل COUNT أو MAX)
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ استعلام يرجع قيمة واحدة فقط
        /// مثل: SELECT COUNT(*) أو SELECT MAX(ID)
        /// </summary>
        public static object ExecuteScalar(string query, SqlParameter[] parameters = null)
        {
            try
            {
                using (SqlConnection conn = new SqlConnection(GetConnectionString()))
                {
                    using (SqlCommand cmd = new SqlCommand(query, conn))
                    {
                        cmd.CommandTimeout = 30;

                        if (parameters != null)
                        {
                            cmd.Parameters.AddRange(parameters);
                        }

                        conn.Open();
                        object result = cmd.ExecuteScalar();
                        return result;
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("خطأ في تنفيذ الاستعلام: " + ex.Message);
            }
        }

        // ─────────────────────────────────────────────
        // تنفيذ INSERT وإرجاع الـ ID الجديد
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ أمر INSERT وإرجاع رقم السجل الجديد (ID)
        /// يجب أن ينتهي الاستعلام بـ ;SELECT SCOPE_IDENTITY()
        /// </summary>
        public static int ExecuteInsertAndGetID(string query, SqlParameter[] parameters = null)
        {
            try
            {
                using (SqlConnection conn = new SqlConnection(GetConnectionString()))
                {
                    using (SqlCommand cmd = new SqlCommand(query, conn))
                    {
                        cmd.CommandTimeout = 30;

                        if (parameters != null)
                        {
                            cmd.Parameters.AddRange(parameters);
                        }

                        conn.Open();
                        object result = cmd.ExecuteScalar();

                        if (result != null && result != DBNull.Value)
                        {
                            return Convert.ToInt32(result);
                        }
                        return -1;
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("خطأ في الإضافة: " + ex.Message);
            }
        }

        // ─────────────────────────────────────────────
        // تنفيذ إجراء مخزن (Stored Procedure)
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ Stored Procedure وإرجاع النتائج في DataTable
        /// </summary>
        public static DataTable ExecuteStoredProcedure(string procedureName, SqlParameter[] parameters = null)
        {
            DataTable dt = new DataTable();

            try
            {
                using (SqlConnection conn = new SqlConnection(GetConnectionString()))
                {
                    using (SqlCommand cmd = new SqlCommand(procedureName, conn))
                    {
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 30;

                        if (parameters != null)
                        {
                            cmd.Parameters.AddRange(parameters);
                        }

                        using (SqlDataAdapter adapter = new SqlDataAdapter(cmd))
                        {
                            adapter.Fill(dt);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("خطأ في تنفيذ الإجراء المخزن: " + ex.Message);
            }

            return dt;
        }

        // ─────────────────────────────────────────────
        // تنفيذ إجراء مخزن بدون إرجاع بيانات
        // ─────────────────────────────────────────────
        /// <summary>
        /// تنفيذ Stored Procedure بدون إرجاع جدول
        /// (مثل إجراءات التحديث والحذف)
        /// </summary>
        public static int ExecuteStoredProcedureNonQuery(string procedureName, SqlParameter[] parameters = null)
        {
            try
            {
                using (SqlConnection conn = new SqlConnection(GetConnectionString()))
                {
                    using (SqlCommand cmd = new SqlCommand(procedureName, conn))
                    {
                        cmd.CommandType = CommandType.StoredProcedure;
                        cmd.CommandTimeout = 30;

                        if (parameters != null)
                        {
                            cmd.Parameters.AddRange(parameters);
                        }

                        conn.Open();
                        return cmd.ExecuteNonQuery();
                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("خطأ في تنفيذ الإجراء المخزن: " + ex.Message);
            }
        }
    }
}