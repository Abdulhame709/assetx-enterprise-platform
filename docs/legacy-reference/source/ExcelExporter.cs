using System;
using System.Data;
using System.IO;
using System.Text;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// تصدير DataTable إلى ملف Excel بتنسيق XML Spreadsheet
    /// يعمل بدون أي مكتبات خارجية - متوافق مع Excel 2007+
    /// </summary>
    public class ExcelExporter
    {
        public string ReportTitle { get; set; }
        public string CompanyName { get; set; }
        public string FilterDescription { get; set; }
        public string ExportedBy { get; set; }

        public ExcelExporter()
        {
            ReportTitle = "تقرير";
            CompanyName = "نظام إدارة الأصول الثابتة";
            FilterDescription = "";
            ExportedBy = "مدير النظام";
        }

        /// <summary>
        /// تصدير البيانات إلى ملف Excel
        /// </summary>
        /// <param name="data">البيانات المراد تصديرها</param>
        /// <param name="filePath">مسار الملف</param>
        /// <returns>true إذا نجح التصدير</returns>
        public bool Export(DataTable data, string filePath)
        {
            try
            {
                if (data == null || data.Rows.Count == 0)
                {
                    throw new Exception("لا توجد بيانات للتصدير");
                }

                StringBuilder sb = new StringBuilder();

                // ═══════════════════════════════════
                // XML Header
                // ═══════════════════════════════════
                sb.AppendLine("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
                sb.AppendLine("<?mso-application progid=\"Excel.Sheet\"?>");
                sb.AppendLine("<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"");
                sb.AppendLine(" xmlns:o=\"urn:schemas-microsoft-com:office:office\"");
                sb.AppendLine(" xmlns:x=\"urn:schemas-microsoft-com:office:excel\"");
                sb.AppendLine(" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"");
                sb.AppendLine(" xmlns:html=\"http://www.w3.org/TR/REC-html40\">");

                // ═══════════════════════════════════
                // Document Properties
                // ═══════════════════════════════════
                sb.AppendLine("<DocumentProperties xmlns=\"urn:schemas-microsoft-com:office:office\">");
                sb.AppendLine(" <Author>" + Esc(ExportedBy) + "</Author>");
                sb.AppendLine(" <LastAuthor>" + Esc(ExportedBy) + "</LastAuthor>");
                sb.AppendLine(" <Created>" + DateTime.Now.ToString("yyyy-MM-ddTHH:mm:ssZ") + "</Created>");
                sb.AppendLine(" <Company>" + Esc(CompanyName) + "</Company>");
                sb.AppendLine(" <Subject>" + Esc(ReportTitle) + "</Subject>");
                sb.AppendLine("</DocumentProperties>");

                // ═══════════════════════════════════
                // Excel Properties (RTL)
                // ═══════════════════════════════════
                sb.AppendLine("<ExcelWorkbook xmlns=\"urn:schemas-microsoft-com:office:excel\">");
                sb.AppendLine(" <WindowHeight>12000</WindowHeight>");
                sb.AppendLine(" <WindowWidth>18000</WindowWidth>");
                sb.AppendLine("</ExcelWorkbook>");

                // ═══════════════════════════════════
                // Styles
                // ═══════════════════════════════════
                sb.AppendLine("<Styles>");

                // Default Style
                sb.AppendLine(" <Style ss:ID=\"Default\" ss:Name=\"Normal\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Right\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"11\" ss:Color=\"#2C3E50\"/>");
                sb.AppendLine(" </Style>");

                // s_title: عنوان التقرير
                sb.AppendLine(" <Style ss:ID=\"s_title\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\" ss:WrapText=\"1\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"16\" ss:Color=\"#FFFFFF\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#1565C0\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"2\" ss:Color=\"#0D47A1\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_subtitle: العنوان الفرعي
                sb.AppendLine(" <Style ss:ID=\"s_subtitle\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"11\" ss:Color=\"#0D47A1\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#E3F2FD\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine(" </Style>");

                // s_filter: وصف الفلتر
                sb.AppendLine(" <Style ss:ID=\"s_filter\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\" ss:WrapText=\"1\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"10\" ss:Color=\"#E65100\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#FFF8E1\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#F39C12\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_header: رأس الجدول
                sb.AppendLine(" <Style ss:ID=\"s_header\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\" ss:WrapText=\"1\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"11\" ss:Color=\"#FFFFFF\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#0D47A1\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#1565C0\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#1565C0\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#1565C0\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_row1: صف فردي
                sb.AppendLine(" <Style ss:ID=\"s_row1\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\" ss:WrapText=\"1\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"10\" ss:Color=\"#2C3E50\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#FFFFFF\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_row2: صف زوجي
                sb.AppendLine(" <Style ss:ID=\"s_row2\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\" ss:WrapText=\"1\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"10\" ss:Color=\"#2C3E50\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#F8F9FA\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_num1: رقم في صف فردي
                sb.AppendLine(" <Style ss:ID=\"s_num1\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"10\" ss:Color=\"#27AE60\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#FFFFFF\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <NumberFormat ss:Format=\"#,##0\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_num2: رقم في صف زوجي
                sb.AppendLine(" <Style ss:ID=\"s_num2\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"10\" ss:Color=\"#27AE60\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#F8F9FA\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <NumberFormat ss:Format=\"#,##0\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_money1: مبلغ مالي في صف فردي
                sb.AppendLine(" <Style ss:ID=\"s_money1\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"10\" ss:Color=\"#27AE60\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#FFFFFF\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <NumberFormat ss:Format=\"#,##0.00\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_money2: مبلغ مالي في صف زوجي
                sb.AppendLine(" <Style ss:ID=\"s_money2\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"10\" ss:Color=\"#27AE60\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#F8F9FA\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <NumberFormat ss:Format=\"#,##0.00\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#DEE2E6\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_total: صف الإجمالي
                sb.AppendLine(" <Style ss:ID=\"s_total\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"11\" ss:Color=\"#FFFFFF\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#1B5E20\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <NumberFormat ss:Format=\"#,##0\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"2\" ss:Color=\"#1B5E20\"/>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"2\" ss:Color=\"#1B5E20\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#2E7D32\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#2E7D32\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_total_money: إجمالي مبالغ
                sb.AppendLine(" <Style ss:ID=\"s_total_money\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"11\" ss:Color=\"#FFFFFF\" ss:Bold=\"1\"/>");
                sb.AppendLine("  <Interior ss:Color=\"#1B5E20\" ss:Pattern=\"Solid\"/>");
                sb.AppendLine("  <NumberFormat ss:Format=\"#,##0.00\"/>");
                sb.AppendLine("  <Borders>");
                sb.AppendLine("   <Border ss:Position=\"Top\" ss:LineStyle=\"Continuous\" ss:Weight=\"2\" ss:Color=\"#1B5E20\"/>");
                sb.AppendLine("   <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"2\" ss:Color=\"#1B5E20\"/>");
                sb.AppendLine("   <Border ss:Position=\"Left\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#2E7D32\"/>");
                sb.AppendLine("   <Border ss:Position=\"Right\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#2E7D32\"/>");
                sb.AppendLine("  </Borders>");
                sb.AppendLine(" </Style>");

                // s_footer: التذييل
                sb.AppendLine(" <Style ss:ID=\"s_footer\">");
                sb.AppendLine("  <Alignment ss:Horizontal=\"Center\" ss:Vertical=\"Center\"/>");
                sb.AppendLine("  <Font ss:FontName=\"Segoe UI\" ss:Size=\"9\" ss:Color=\"#7F8C8D\" ss:Italic=\"1\"/>");
                sb.AppendLine(" </Style>");

                sb.AppendLine("</Styles>");

                // ═══════════════════════════════════
                // Worksheet
                // ═══════════════════════════════════
                int colCount = data.Columns.Count + 1; // +1 للترقيم
                string sheetName = Esc(ReportTitle.Length > 31
                    ? ReportTitle.Substring(0, 31) : ReportTitle);

                sb.AppendLine("<Worksheet ss:Name=\"" + sheetName + "\">");
                sb.AppendLine(" <WorksheetOptions xmlns=\"urn:schemas-microsoft-com:office:excel\">");
                sb.AppendLine("  <DisplayRightToLeft/>");
                sb.AppendLine("  <FreezePanes/>");
                sb.AppendLine("  <FrozenNoSplit/>");

                // تحديد بداية صفوف الفلاتر
                int headerRows = string.IsNullOrEmpty(FilterDescription) ? 3 : 4;
                sb.AppendLine("  <SplitHorizontal>" + headerRows + "</SplitHorizontal>");
                sb.AppendLine("  <TopRowBottomPane>" + headerRows + "</TopRowBottomPane>");

                sb.AppendLine("  <Panes>");
                sb.AppendLine("   <Pane><Number>3</Number></Pane>");
                sb.AppendLine("  </Panes>");
                sb.AppendLine("  <Print>");
                sb.AppendLine("   <ValidPrinterInfo/>");
                sb.AppendLine("   <PaperSizeIndex>9</PaperSizeIndex>");
                sb.AppendLine("   <HorizontalResolution>600</HorizontalResolution>");
                sb.AppendLine("   <VerticalResolution>600</VerticalResolution>");
                sb.AppendLine("  </Print>");
                sb.AppendLine("  <FitToPage/>");
                sb.AppendLine(" </WorksheetOptions>");

                sb.AppendLine(" <Table ss:DefaultRowHeight=\"22\">");

                // عرض الأعمدة
                sb.AppendLine("  <Column ss:Width=\"35\"/>"); // الترقيم
                for (int c = 0; c < data.Columns.Count; c++)
                {
                    string cn = data.Columns[c].ColumnName;
                    int w = 100; // عرض افتراضي
                    if (cn.Contains("كمية") || cn.Contains("عدد"))
                        w = 60;
                    else if (cn.Contains("سعر") || cn.Contains("قيمة")
                        || cn.Contains("إجمالي"))
                        w = 90;
                    else if (cn.Contains("كود") || cn.Contains("تاريخ"))
                        w = 85;
                    else if (cn.Contains("اسم") || cn.Contains("موقع")
                        || cn.Contains("وصف"))
                        w = 160;
                    sb.AppendLine("  <Column ss:Width=\"" + w + "\"/>");
                }

                // ═══════════════════════════════════
                // Row 1: عنوان التقرير
                // ═══════════════════════════════════
                sb.AppendLine("  <Row ss:Height=\"40\">");
                sb.AppendLine("   <Cell ss:StyleID=\"s_title\""
                    + " ss:MergeAcross=\"" + (colCount - 1) + "\">"
                    + "<Data ss:Type=\"String\">"
                    + Esc(CompanyName + " — " + ReportTitle)
                    + "</Data></Cell>");
                sb.AppendLine("  </Row>");

                // ═══════════════════════════════════
                // Row 2: التاريخ والمُصدِر
                // ═══════════════════════════════════
                sb.AppendLine("  <Row ss:Height=\"25\">");
                sb.AppendLine("   <Cell ss:StyleID=\"s_subtitle\""
                    + " ss:MergeAcross=\"" + (colCount - 1) + "\">"
                    + "<Data ss:Type=\"String\">"
                    + Esc("تاريخ التصدير: "
                        + DateTime.Now.ToString("yyyy/MM/dd - hh:mm tt")
                        + "  |  بواسطة: " + ExportedBy)
                    + "</Data></Cell>");
                sb.AppendLine("  </Row>");

                // ═══════════════════════════════════
                // Row 3: الفلتر (اختياري)
                // ═══════════════════════════════════
                if (!string.IsNullOrEmpty(FilterDescription))
                {
                    sb.AppendLine("  <Row ss:Height=\"25\">");
                    sb.AppendLine("   <Cell ss:StyleID=\"s_filter\""
                        + " ss:MergeAcross=\"" + (colCount - 1) + "\">"
                        + "<Data ss:Type=\"String\">"
                        + Esc("🔍 " + FilterDescription)
                        + "</Data></Cell>");
                    sb.AppendLine("  </Row>");
                }

                // ═══════════════════════════════════
                // Row: رؤوس الأعمدة
                // ═══════════════════════════════════
                sb.AppendLine("  <Row ss:Height=\"30\">");
                sb.AppendLine("   <Cell ss:StyleID=\"s_header\">"
                    + "<Data ss:Type=\"String\">#</Data></Cell>");
                for (int c = 0; c < data.Columns.Count; c++)
                {
                    sb.AppendLine("   <Cell ss:StyleID=\"s_header\">"
                        + "<Data ss:Type=\"String\">"
                        + Esc(data.Columns[c].ColumnName)
                        + "</Data></Cell>");
                }
                sb.AppendLine("  </Row>");

                // ═══════════════════════════════════
                // صفوف البيانات
                // ═══════════════════════════════════
                for (int r = 0; r < data.Rows.Count; r++)
                {
                    DataRow dr = data.Rows[r];
                    bool isOdd = (r % 2 == 0);
                    string rowStyle = isOdd ? "s_row1" : "s_row2";

                    sb.AppendLine("  <Row ss:Height=\"22\">");

                    // رقم الصف
                    sb.AppendLine("   <Cell ss:StyleID=\"" + rowStyle + "\">"
                        + "<Data ss:Type=\"Number\">" + (r + 1)
                        + "</Data></Cell>");

                    for (int c = 0; c < data.Columns.Count; c++)
                    {
                        string cn = data.Columns[c].ColumnName;
                        object val = dr[c];
                        bool isNum = IsNumericType(data.Columns[c].DataType);
                        bool isMoney = cn.Contains("سعر") || cn.Contains("قيمة")
                            || cn.Contains("إجمالي");

                        if (val == null || val == DBNull.Value)
                        {
                            sb.AppendLine("   <Cell ss:StyleID=\""
                                + rowStyle + "\">"
                                + "<Data ss:Type=\"String\">-</Data></Cell>");
                        }
                        else if (isNum)
                        {
                            string numStyle;
                            if (isMoney)
                                numStyle = isOdd ? "s_money1" : "s_money2";
                            else
                                numStyle = isOdd ? "s_num1" : "s_num2";

                            sb.AppendLine("   <Cell ss:StyleID=\""
                                + numStyle + "\">"
                                + "<Data ss:Type=\"Number\">"
                                + Convert.ToDecimal(val).ToString("F2")
                                + "</Data></Cell>");
                        }
                        else
                        {
                            sb.AppendLine("   <Cell ss:StyleID=\""
                                + rowStyle + "\">"
                                + "<Data ss:Type=\"String\">"
                                + Esc(val.ToString())
                                + "</Data></Cell>");
                        }
                    }
                    sb.AppendLine("  </Row>");
                }

                // ═══════════════════════════════════
                // صف الإجمالي
                // ═══════════════════════════════════
                sb.AppendLine("  <Row ss:Height=\"28\">");
                sb.AppendLine("   <Cell ss:StyleID=\"s_total\">"
                    + "<Data ss:Type=\"String\"></Data></Cell>");

                for (int c = 0; c < data.Columns.Count; c++)
                {
                    string cn = data.Columns[c].ColumnName;
                    bool isNum = IsNumericType(data.Columns[c].DataType);
                    bool isMoney = cn.Contains("سعر") || cn.Contains("قيمة")
                        || cn.Contains("إجمالي");

                    if (c == 0)
                    {
                        sb.AppendLine("   <Cell ss:StyleID=\"s_total\">"
                            + "<Data ss:Type=\"String\">"
                            + Esc("الإجمالي (" + data.Rows.Count + " سجل)")
                            + "</Data></Cell>");
                    }
                    else if (isNum)
                    {
                        decimal sum = 0;
                        foreach (DataRow dr in data.Rows)
                        {
                            if (dr[c] != DBNull.Value)
                            {
                                decimal v = 0;
                                decimal.TryParse(dr[c].ToString(), out v);
                                sum += v;
                            }
                        }

                        string totalStyle = isMoney
                            ? "s_total_money" : "s_total";
                        sb.AppendLine("   <Cell ss:StyleID=\""
                            + totalStyle + "\">"
                            + "<Data ss:Type=\"Number\">"
                            + sum.ToString("F2")
                            + "</Data></Cell>");
                    }
                    else
                    {
                        sb.AppendLine("   <Cell ss:StyleID=\"s_total\">"
                            + "<Data ss:Type=\"String\"></Data></Cell>");
                    }
                }
                sb.AppendLine("  </Row>");

                // ═══════════════════════════════════
                // صف فارغ + تذييل
                // ═══════════════════════════════════
                sb.AppendLine("  <Row ss:Height=\"10\"/>");
                sb.AppendLine("  <Row ss:Height=\"20\">");
                sb.AppendLine("   <Cell ss:StyleID=\"s_footer\""
                    + " ss:MergeAcross=\"" + (colCount - 1) + "\">"
                    + "<Data ss:Type=\"String\">"
                    + Esc("تم التصدير من " + CompanyName + " بتاريخ "
                        + DateTime.Now.ToString("yyyy/MM/dd hh:mm tt")
                        + " بواسطة " + ExportedBy)
                    + "</Data></Cell>");
                sb.AppendLine("  </Row>");

                // ═══════════════════════════════════
                // إغلاق
                // ═══════════════════════════════════
                sb.AppendLine(" </Table>");

                // AutoFilter
                sb.AppendLine(" <AutoFilter"
                    + " x:Range=\"R" + headerRows + "C1:R"
                    + headerRows + "C" + colCount + "\""
                    + " xmlns=\"urn:schemas-microsoft-com:office:excel\">"
                    + "</AutoFilter>");

                sb.AppendLine("</Worksheet>");
                sb.AppendLine("</Workbook>");

                // ═══════════════════════════════════
                // حفظ الملف
                // ═══════════════════════════════════
                File.WriteAllText(filePath, sb.ToString(), Encoding.UTF8);
                return true;
            }
            catch (Exception ex)
            {
                throw new Exception("خطأ في التصدير: " + ex.Message, ex);
            }
        }

        // ═══════════════════════════════════════════
        //  دوال مساعدة
        // ═══════════════════════════════════════════

        /// <summary>
        /// تنظيف النص من الرموز الخاصة بـ XML
        /// </summary>
        private string Esc(string text)
        {
            if (string.IsNullOrEmpty(text)) return "";
            return text
                .Replace("&", "&amp;")
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;")
                .Replace("'", "&apos;");
        }

        /// <summary>
        /// فحص هل النوع رقمي
        /// </summary>
        private bool IsNumericType(Type t)
        {
            return t == typeof(int) || t == typeof(long)
                || t == typeof(decimal) || t == typeof(double)
                || t == typeof(float) || t == typeof(short)
                || t == typeof(byte);
        }
    }
}