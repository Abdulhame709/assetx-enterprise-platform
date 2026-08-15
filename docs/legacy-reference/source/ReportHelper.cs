using System;
using System.Data;
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace AssetManagement.Helpers
{
    /// <summary>
    /// كلاس مساعد للتصدير والطباعة
    /// يدعم: Excel, CSV, طباعة, نموذج فارغ
    /// </summary>
    public static class ReportHelper
    {
        // ═══════════════════════════════════════════════════
        // 1. تصدير إلى Excel (HTML Table يفتحه Excel مباشرة)
        // ═══════════════════════════════════════════════════
        public static bool ExportToExcel(DataTable data, string reportTitle,
            string[] columnHeaders, string[] columnFields,
            string additionalInfo = "")
        {
            try
            {
                Microsoft.Win32.SaveFileDialog dlg = new Microsoft.Win32.SaveFileDialog();
                dlg.FileName = reportTitle.Replace(" ", "_") + "_" + DateTime.Now.ToString("yyyy_MM_dd");
                dlg.DefaultExt = ".xls";
                dlg.Filter = "ملف Excel (*.xls)|*.xls";

                if (dlg.ShowDialog() != true) return false;

                StringBuilder sb = new StringBuilder();

                // بداية ملف HTML/Excel
                sb.AppendLine("<html xmlns:o=\"urn:schemas-microsoft-com:office:office\"");
                sb.AppendLine("xmlns:x=\"urn:schemas-microsoft-com:office:excel\">");
                sb.AppendLine("<head>");
                sb.AppendLine("<meta http-equiv=\"Content-Type\" content=\"text/html; charset=utf-8\"/>");
                sb.AppendLine("<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets>");
                sb.AppendLine("<x:ExcelWorksheet><x:Name>تقرير</x:Name><x:WorksheetOptions>");
                sb.AppendLine("<x:DisplayRightToLeft/></x:WorksheetOptions></x:ExcelWorksheet>");
                sb.AppendLine("</x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->");
                sb.AppendLine("<style>");
                sb.AppendLine("body { direction: rtl; font-family: Arial, Tahoma; }");
                sb.AppendLine("table { border-collapse: collapse; width: 100%; }");
                sb.AppendLine("th { background-color: #2C3E50; color: white; font-weight: bold; ");
                sb.AppendLine("     padding: 8px; border: 1px solid #bdc3c7; font-size: 12px; }");
                sb.AppendLine("td { padding: 6px; border: 1px solid #bdc3c7; font-size: 11px; ");
                sb.AppendLine("     mso-number-format: '\\@'; }");
                sb.AppendLine("tr:nth-child(even) { background-color: #f2f2f2; }");
                sb.AppendLine(".title { font-size: 18px; font-weight: bold; color: #2C3E50; margin: 10px; }");
                sb.AppendLine(".info { font-size: 12px; color: #7f8c8d; margin: 5px 10px; }");
                sb.AppendLine(".matched { color: #27AE60; font-weight: bold; }");
                sb.AppendLine(".deficit { color: #F39C12; font-weight: bold; }");
                sb.AppendLine(".missing { color: #E74C3C; font-weight: bold; }");
                sb.AppendLine(".surplus { color: #9B59B6; font-weight: bold; }");
                sb.AppendLine(".transferred { color: #3498DB; font-weight: bold; }");
                sb.AppendLine(".notdone { color: #95A5A6; }");
                sb.AppendLine("</style></head>");
                sb.AppendLine("<body dir=\"rtl\">");

                // العنوان
                sb.AppendLine("<div class=\"title\">" + reportTitle + "</div>");
                sb.AppendLine("<div class=\"info\">تاريخ التصدير: " +
                    DateTime.Now.ToString("yyyy/MM/dd HH:mm") + "</div>");
                sb.AppendLine("<div class=\"info\">عدد السجلات: " + data.Rows.Count + "</div>");

                if (!string.IsNullOrEmpty(additionalInfo))
                    sb.AppendLine("<div class=\"info\">" + additionalInfo + "</div>");

                sb.AppendLine("<br/>");

                // الجدول
                sb.AppendLine("<table>");

                // رؤوس الأعمدة
                sb.AppendLine("<tr>");
                sb.AppendLine("<th>#</th>");
                for (int i = 0; i < columnHeaders.Length; i++)
                {
                    sb.AppendLine("<th>" + columnHeaders[i] + "</th>");
                }
                sb.AppendLine("</tr>");

                // البيانات
                int rowNum = 1;
                foreach (DataRow row in data.Rows)
                {
                    // تلوين حسب النتيجة
                    string resultClass = "";
                    if (data.Columns.Contains("InventoryResult"))
                    {
                        string result = row["InventoryResult"].ToString();
                        if (result == "مطابق") resultClass = "matched";
                        else if (result == "عجز") resultClass = "deficit";
                        else if (result == "مفقود") resultClass = "missing";
                        else if (result == "زيادة") resultClass = "surplus";
                        else if (result == "منقول") resultClass = "transferred";
                        else if (result == "لم يُجرد") resultClass = "notdone";
                    }

                    sb.AppendLine("<tr>");
                    sb.AppendLine("<td>" + rowNum + "</td>");

                    for (int i = 0; i < columnFields.Length; i++)
                    {
                        string fieldName = columnFields[i];
                        string value = "";

                        if (data.Columns.Contains(fieldName))
                        {
                            object cellValue = row[fieldName];
                            if (cellValue != null && cellValue != DBNull.Value)
                            {
                                if (cellValue is DateTime)
                                    value = ((DateTime)cellValue).ToString("yyyy/MM/dd");
                                else if (cellValue is bool)
                                    value = (bool)cellValue ? "نعم" : "لا";
                                else
                                    value = cellValue.ToString();
                            }
                        }

                        // إضافة class للنتيجة
                        if (fieldName == "InventoryResult" && !string.IsNullOrEmpty(resultClass))
                            sb.AppendLine("<td class=\"" + resultClass + "\">" + value + "</td>");
                        else
                            sb.AppendLine("<td>" + value + "</td>");
                    }

                    sb.AppendLine("</tr>");
                    rowNum++;
                }

                sb.AppendLine("</table></body></html>");

                // حفظ الملف بترميز UTF-8 مع BOM
                byte[] bom = new byte[] { 0xEF, 0xBB, 0xBF };
                byte[] content = Encoding.UTF8.GetBytes(sb.ToString());
                byte[] fileContent = new byte[bom.Length + content.Length];
                bom.CopyTo(fileContent, 0);
                content.CopyTo(fileContent, bom.Length);
                File.WriteAllBytes(dlg.FileName, fileContent);

                MessageBox.Show("تم التصدير بنجاح إلى:\n" + dlg.FileName,
                    "تم التصدير", MessageBoxButton.OK, MessageBoxImage.Information);

                // فتح الملف
                try { System.Diagnostics.Process.Start(dlg.FileName); } catch { }

                return true;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في التصدير:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
                return false;
            }
        }

        // ═══════════════════════════════════════════════════
        // 2. تصدير إلى CSV
        // ═══════════════════════════════════════════════════
        public static bool ExportToCsv(DataTable data, string reportTitle,
            string[] columnHeaders, string[] columnFields)
        {
            try
            {
                Microsoft.Win32.SaveFileDialog dlg = new Microsoft.Win32.SaveFileDialog();
                dlg.FileName = reportTitle.Replace(" ", "_") + "_" + DateTime.Now.ToString("yyyy_MM_dd");
                dlg.DefaultExt = ".csv";
                dlg.Filter = "ملف CSV (*.csv)|*.csv";

                if (dlg.ShowDialog() != true) return false;

                using (StreamWriter writer = new StreamWriter(dlg.FileName, false,
                    new UTF8Encoding(true)))
                {
                    // رؤوس الأعمدة
                    writer.WriteLine(string.Join(",", columnHeaders));

                    // البيانات
                    foreach (DataRow row in data.Rows)
                    {
                        string[] values = new string[columnFields.Length];
                        for (int i = 0; i < columnFields.Length; i++)
                        {
                            string val = "";
                            if (data.Columns.Contains(columnFields[i]))
                            {
                                object cellValue = row[columnFields[i]];
                                if (cellValue != null && cellValue != DBNull.Value)
                                {
                                    val = cellValue.ToString().Replace(",", " ").Replace("\n", " ");
                                }
                            }
                            values[i] = val;
                        }
                        writer.WriteLine(string.Join(",", values));
                    }
                }

                MessageBox.Show("تم التصدير بنجاح!", "تم",
                    MessageBoxButton.OK, MessageBoxImage.Information);
                return true;
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ: " + ex.Message, "خطأ",
                    MessageBoxButton.OK, MessageBoxImage.Error);
                return false;
            }
        }

        // ═══════════════════════════════════════════════════
        // 3. طباعة تقرير (PrintDialog + FlowDocument)
        // ═══════════════════════════════════════════════════
        public static void PrintReport(DataTable data, string reportTitle,
            string[] columnHeaders, string[] columnFields,
            string additionalInfo = "")
        {
            try
            {
                PrintDialog pd = new PrintDialog();
                if (pd.ShowDialog() != true) return;

                FlowDocument doc = CreateFlowDocument(data, reportTitle,
                    columnHeaders, columnFields, additionalInfo,
                    pd.PrintableAreaWidth, pd.PrintableAreaHeight);

                IDocumentPaginatorSource idps = doc;
                pd.PrintDocument(idps.DocumentPaginator, reportTitle);
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الطباعة:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // 4. طباعة نموذج جرد فارغ (للجرد الميداني اليدوي)
        // ═══════════════════════════════════════════════════
        public static void PrintBlankInventoryForm(DataTable data, string cycleName)
        {
            try
            {
                PrintDialog pd = new PrintDialog();
                if (pd.ShowDialog() != true) return;

                FlowDocument doc = new FlowDocument();
                doc.FlowDirection = FlowDirection.RightToLeft;
                doc.FontFamily = new FontFamily("Arial");
                doc.FontSize = 11;
                doc.PageWidth = pd.PrintableAreaWidth;
                doc.PageHeight = pd.PrintableAreaHeight;
                doc.PagePadding = new Thickness(40, 30, 40, 30);
                doc.ColumnWidth = pd.PrintableAreaWidth;

                // العنوان
                Paragraph titlePara = new Paragraph(new Run("نموذج الجرد الميداني"));
                titlePara.FontSize = 18;
                titlePara.FontWeight = FontWeights.Bold;
                titlePara.TextAlignment = TextAlignment.Center;
                doc.Blocks.Add(titlePara);

                Paragraph subTitle = new Paragraph(new Run(cycleName));
                subTitle.FontSize = 14;
                subTitle.TextAlignment = TextAlignment.Center;
                subTitle.Foreground = Brushes.Gray;
                doc.Blocks.Add(subTitle);

                Paragraph datePara = new Paragraph(new Run(
                    "تاريخ الطباعة: " + DateTime.Now.ToString("yyyy/MM/dd")));
                datePara.FontSize = 10;
                datePara.TextAlignment = TextAlignment.Center;
                datePara.Foreground = Brushes.Gray;
                doc.Blocks.Add(datePara);

                doc.Blocks.Add(new Paragraph(new Run(" ")));

                // تجميع حسب الموقع
                DataView dv = new DataView(data);
                DataTable locations = dv.ToTable(true, "ExpectedMainLocName");

                foreach (DataRow locRow in locations.Rows)
                {
                    string locName = locRow["ExpectedMainLocName"].ToString();
                    if (string.IsNullOrEmpty(locName)) locName = "بدون موقع";

                    // عنوان الموقع
                    Paragraph locTitle = new Paragraph(new Run("الموقع: " + locName));
                    locTitle.FontSize = 14;
                    locTitle.FontWeight = FontWeights.Bold;
                    locTitle.Background = new SolidColorBrush(Color.FromRgb(236, 240, 241));
                    locTitle.Padding = new Thickness(5);
                    locTitle.KeepWithNext = true;
                    doc.Blocks.Add(locTitle);

                    // جدول الأصول
                    Table table = new Table();
                    table.CellSpacing = 0;
                    table.BorderBrush = Brushes.Black;
                    table.BorderThickness = new Thickness(1);
                    table.FontSize = 10;

                    // الأعمدة
                    table.Columns.Add(new TableColumn() { Width = new GridLength(30) });   // #
                    table.Columns.Add(new TableColumn() { Width = new GridLength(70) });   // كود
                    table.Columns.Add(new TableColumn() { Width = new GridLength(150) });  // اسم
                    table.Columns.Add(new TableColumn() { Width = new GridLength(60) });   // العهدة
                    table.Columns.Add(new TableColumn() { Width = new GridLength(40) });   // كمية م
                    table.Columns.Add(new TableColumn() { Width = new GridLength(50) });   // حالة م
                    table.Columns.Add(new TableColumn() { Width = new GridLength(40) });   // كمية ف
                    table.Columns.Add(new TableColumn() { Width = new GridLength(50) });   // حالة ف
                    table.Columns.Add(new TableColumn() { Width = new GridLength(60) });   // موقع ف
                    table.Columns.Add(new TableColumn() { Width = new GridLength(80) });   // ملاحظات

                    TableRowGroup rg = new TableRowGroup();

                    // رأس الجدول
                    TableRow headerRow = new TableRow();
                    headerRow.Background = new SolidColorBrush(Color.FromRgb(44, 62, 80));
                    headerRow.Foreground = Brushes.White;
                    headerRow.FontWeight = FontWeights.Bold;

                    string[] headers = { "#", "الكود", "اسم الأصل", "العهدة", "كمية م", "حالة م",
                                        "كمية ف", "حالة ف", "موقع ف", "ملاحظات" };
                    foreach (string h in headers)
                    {
                        TableCell cell = new TableCell(new Paragraph(new Run(h)));
                        cell.BorderBrush = Brushes.Gray;
                        cell.BorderThickness = new Thickness(0.5);
                        cell.Padding = new Thickness(3);
                        cell.TextAlignment = TextAlignment.Center;
                        headerRow.Cells.Add(cell);
                    }
                    rg.Rows.Add(headerRow);

                    // بيانات الأصول لهذا الموقع
                    DataRow[] assetRows = data.Select(
                        "ExpectedMainLocName = '" + locName.Replace("'", "''") + "'");

                    int num = 1;
                    foreach (DataRow assetRow in assetRows)
                    {
                        TableRow dataRow = new TableRow();
                        if (num % 2 == 0)
                            dataRow.Background = new SolidColorBrush(
                                Color.FromRgb(248, 249, 250));

                        // البيانات
                        string[] values = {
                            num.ToString(),
                            assetRow["BaseAssetCode"] != DBNull.Value ?
                                assetRow["BaseAssetCode"].ToString() : "",
                            assetRow["AssetName"].ToString(),
                            assetRow["EmployeeName"] != DBNull.Value ?
                                assetRow["EmployeeName"].ToString() : "",
                            assetRow["ExpectedQuantity"].ToString(),
                            assetRow["ExpectedStatusName"] != DBNull.Value ?
                                assetRow["ExpectedStatusName"].ToString() : "",
                            "........",  // كمية فعلية فارغة
                            "........",  // حالة فعلية فارغة
                            "........",  // موقع فعلي فارغ
                            "........"   // ملاحظات فارغة
                        };

                        foreach (string val in values)
                        {
                            TableCell cell = new TableCell(new Paragraph(new Run(val)));
                            cell.BorderBrush = Brushes.LightGray;
                            cell.BorderThickness = new Thickness(0.5);
                            cell.Padding = new Thickness(3, 2, 3, 2);
                            dataRow.Cells.Add(cell);
                        }

                        rg.Rows.Add(dataRow);
                        num++;
                    }

                    table.RowGroups.Add(rg);
                    doc.Blocks.Add(table);

                    // مسافة بين المواقع
                    doc.Blocks.Add(new Paragraph(new Run(" ")) { FontSize = 6 });
                }

                // توقيعات
                doc.Blocks.Add(new Paragraph(new Run(" ")));
                Paragraph sigPara = new Paragraph();
                sigPara.FontSize = 11;
                sigPara.Inlines.Add(new Run("رئيس اللجنة: ....................     "));
                sigPara.Inlines.Add(new Run("العضو: ....................     "));
                sigPara.Inlines.Add(new Run("التاريخ: ...................."));
                doc.Blocks.Add(sigPara);

                IDocumentPaginatorSource idps = doc;
                pd.PrintDocument(idps.DocumentPaginator, "نموذج جرد - " + cycleName);
            }
            catch (Exception ex)
            {
                MessageBox.Show("خطأ في الطباعة:\n" + ex.Message,
                    "خطأ", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════════════
        // 5. إنشاء FlowDocument للطباعة
        // ═══════════════════════════════════════════════════
        private static FlowDocument CreateFlowDocument(DataTable data, string title,
            string[] columnHeaders, string[] columnFields,
            string additionalInfo, double pageWidth, double pageHeight)
        {
            FlowDocument doc = new FlowDocument();
            doc.FlowDirection = FlowDirection.RightToLeft;
            doc.FontFamily = new FontFamily("Arial");
            doc.FontSize = 10;
            doc.PageWidth = pageWidth;
            doc.PageHeight = pageHeight;
            doc.PagePadding = new Thickness(30, 25, 30, 25);
            doc.ColumnWidth = pageWidth;

            // العنوان
            Paragraph titlePara = new Paragraph(new Run(title));
            titlePara.FontSize = 16;
            titlePara.FontWeight = FontWeights.Bold;
            titlePara.TextAlignment = TextAlignment.Center;
            doc.Blocks.Add(titlePara);

            if (!string.IsNullOrEmpty(additionalInfo))
            {
                Paragraph infoPara = new Paragraph(new Run(additionalInfo));
                infoPara.FontSize = 10;
                infoPara.Foreground = Brushes.Gray;
                infoPara.TextAlignment = TextAlignment.Center;
                doc.Blocks.Add(infoPara);
            }

            Paragraph datePara = new Paragraph(new Run(
                "تاريخ: " + DateTime.Now.ToString("yyyy/MM/dd") +
                " | عدد: " + data.Rows.Count));
            datePara.FontSize = 9;
            datePara.Foreground = Brushes.Gray;
            datePara.TextAlignment = TextAlignment.Center;
            doc.Blocks.Add(datePara);

            doc.Blocks.Add(new Paragraph(new Run(" ")) { FontSize = 4 });

            // الجدول
            Table table = new Table();
            table.CellSpacing = 0;
            table.BorderBrush = Brushes.Black;
            table.BorderThickness = new Thickness(1);

            // تعريف الأعمدة
            foreach (string header in columnHeaders)
            {
                table.Columns.Add(new TableColumn());
            }

            TableRowGroup rg = new TableRowGroup();

            // رأس الجدول
            TableRow headerRow = new TableRow();
            headerRow.Background = new SolidColorBrush(Color.FromRgb(44, 62, 80));
            headerRow.Foreground = Brushes.White;
            headerRow.FontWeight = FontWeights.Bold;
            headerRow.FontSize = 9;

            foreach (string header in columnHeaders)
            {
                TableCell cell = new TableCell(new Paragraph(new Run(header)));
                cell.BorderBrush = Brushes.Gray;
                cell.BorderThickness = new Thickness(0.5);
                cell.Padding = new Thickness(3);
                cell.TextAlignment = TextAlignment.Center;
                headerRow.Cells.Add(cell);
            }
            rg.Rows.Add(headerRow);

            // البيانات
            int rowNum = 0;
            foreach (DataRow row in data.Rows)
            {
                TableRow dataRow = new TableRow();
                dataRow.FontSize = 9;
                if (rowNum % 2 == 1)
                    dataRow.Background = new SolidColorBrush(Color.FromRgb(248, 249, 250));

                for (int i = 0; i < columnFields.Length; i++)
                {
                    string value = "";
                    if (data.Columns.Contains(columnFields[i]))
                    {
                        object cellValue = row[columnFields[i]];
                        if (cellValue != null && cellValue != DBNull.Value)
                        {
                            if (cellValue is DateTime)
                                value = ((DateTime)cellValue).ToString("MM/dd HH:mm");
                            else if (cellValue is bool)
                                value = (bool)cellValue ? "نعم" : "لا";
                            else
                                value = cellValue.ToString();
                        }
                    }

                    Paragraph p = new Paragraph(new Run(value));

                    // تلوين النتيجة
                    if (columnFields[i] == "InventoryResult")
                    {
                        if (value == "مطابق") p.Foreground = Brushes.Green;
                        else if (value == "عجز") p.Foreground = Brushes.Orange;
                        else if (value == "مفقود") p.Foreground = Brushes.Red;
                        else if (value == "زيادة") p.Foreground = Brushes.Purple;
                        p.FontWeight = FontWeights.Bold;
                    }

                    TableCell cell = new TableCell(p);
                    cell.BorderBrush = Brushes.LightGray;
                    cell.BorderThickness = new Thickness(0.5);
                    cell.Padding = new Thickness(2);
                    dataRow.Cells.Add(cell);
                }

                rg.Rows.Add(dataRow);
                rowNum++;
            }

            table.RowGroups.Add(rg);
            doc.Blocks.Add(table);

            return doc;
        }
    }
}