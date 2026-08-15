using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Xps;
using System.Windows.Xps.Packaging;
using System.Printing;
using AssetManagement.Helpers;
using Microsoft.Win32;

namespace AssetManagement.Views
{
    public partial class ReportPreviewWindow : Window
    {
        private FixedDocument _document;
        private DataTable _reportData;
        private double _zoomLevel = 1.0;

        // ═══ خصائص التقرير الأساسية ═══
        public string ReportTitle { get; set; }
        public string CompanyName { get; set; }
        public string FilterDescription { get; set; }
        public string PrintedBy { get; set; }

        // ═══ خصائص التوقيعات الجديدة ═══
        public string RecipientName { get; set; }
        public List<string> CommitteeMembers { get; set; }
        public string CommitteeChairman { get; set; }

        public ReportPreviewWindow()
        {
            InitializeComponent();

            ReportTitle = "تقرير";
            CompanyName = "نظام إدارة الأصول الثابتة";
            FilterDescription = "";
            PrintedBy = "مدير النظام";

            // قيم افتراضية للتوقيعات
            RecipientName = "";
            CommitteeMembers = new List<string>
                { "", "", "", "" };
            CommitteeChairman = "";
        }

        // ═══════════════════════════════════════════
        //  ✅ توليد التقرير من داخل النافذة
        //     (استخدمها بدلاً من LoadReport المباشر
        //      حتى تُمرَّر بيانات التوقيع تلقائياً)
        // ═══════════════════════════════════════════
        public void GenerateAndLoad(DataTable data,
            List<string> groupCols = null)
        {
            try
            {
                ReportEngine engine = new ReportEngine();
                engine.CompanyName = CompanyName;
                engine.ReportTitle = ReportTitle;
                engine.FilterDescription = FilterDescription;
                engine.PrintedBy = PrintedBy;

                // ═══ تمرير بيانات التوقيعات ═══
                engine.RecipientName = RecipientName;
                engine.CommitteeMembers = CommitteeMembers
                    ?? new List<string> { "", "", "", "" };
                engine.CommitteeChairman = CommitteeChairman;

                FixedDocument doc = engine.Generate(
                    data, groupCols ?? new List<string>());

                LoadReport(doc, data);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "خطأ في توليد التقرير:\n" + ex.Message,
                    "خطأ",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════
        //  تحميل التقرير وعرضه
        // ═══════════════════════════════════════════
        public void LoadReport(FixedDocument document,
            DataTable reportData = null)
        {
            try
            {
                _document = document;
                _reportData = reportData;

                if (_document == null) return;

                string tempFile = Path.Combine(
                    Path.GetTempPath(),
                    "AssetReport_"
                    + Guid.NewGuid().ToString("N")
                    + ".xps");

                if (File.Exists(tempFile))
                {
                    try { File.Delete(tempFile); }
                    catch { }
                }

                XpsDocument xpsDoc = new XpsDocument(
                    tempFile, FileAccess.ReadWrite);

                XpsDocumentWriter writer =
                    XpsDocument.CreateXpsDocumentWriter(xpsDoc);
                writer.Write(_document);

                docViewer.Document =
                    xpsDoc.GetFixedDocumentSequence();

                txtReportTitle.Text = ReportTitle;

                int recordCount = (_reportData != null)
                    ? _reportData.Rows.Count : 0;
                txtRecordCount.Text =
                    "عدد السجلات: "
                    + recordCount.ToString("N0");

                int pageCount = _document.Pages.Count;
                txtPageInfo.Text =
                    "عدد الصفحات: " + pageCount;

                btnExportExcel.IsEnabled =
                    (_reportData != null
                     && _reportData.Rows.Count > 0);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "خطأ في تحميل التقرير:\n" + ex.Message,
                    "خطأ",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════
        //  الطباعة
        // ═══════════════════════════════════════════
        private void btnPrint_Click(object sender,
            RoutedEventArgs e)
        {
            try
            {
                if (_document == null)
                {
                    MessageBox.Show(
                        "لا يوجد تقرير للطباعة",
                        "تنبيه",
                        MessageBoxButton.OK,
                        MessageBoxImage.Warning);
                    return;
                }

                System.Windows.Controls.PrintDialog pd =
                    new System.Windows.Controls.PrintDialog();

                if (pd.ShowDialog() == true)
                {
                    pd.PrintDocument(
                        _document.DocumentPaginator,
                        ReportTitle);

                    MessageBox.Show(
                        "تمت الطباعة بنجاح ✅",
                        "نجاح",
                        MessageBoxButton.OK,
                        MessageBoxImage.Information);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "خطأ في الطباعة:\n" + ex.Message,
                    "خطأ",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        // ═══════════════════════════════════════════
        //  تصدير Excel
        // ═══════════════════════════════════════════
        private void btnExportExcel_Click(
            object sender, RoutedEventArgs e)
        {
            try
            {
                if (_reportData == null
                    || _reportData.Rows.Count == 0)
                {
                    MessageBox.Show(
                        "لا توجد بيانات للتصدير",
                        "تنبيه",
                        MessageBoxButton.OK,
                        MessageBoxImage.Warning);
                    return;
                }

                SaveFileDialog dlg = new SaveFileDialog();
                dlg.Title =
                    "تصدير التقرير إلى Excel";
                dlg.Filter =
                    "ملف Excel (*.xls)|*.xls";
                dlg.DefaultExt = ".xls";

                string safeName = ReportTitle;
                foreach (char ch in
                    Path.GetInvalidFileNameChars())
                    safeName = safeName.Replace(
                        ch.ToString(), "-");

                dlg.FileName = safeName + "_"
                    + DateTime.Now.ToString("yyyyMMdd_HHmm");

                if (dlg.ShowDialog() == true)
                {
                    btnExportExcel.IsEnabled = false;
                    btnExportExcel.Content =
                        CreateButtonContent(
                            "⏳", "جارٍ التصدير...");

                    ExcelExporter exporter =
                        new ExcelExporter();
                    exporter.ReportTitle = ReportTitle;
                    exporter.CompanyName = CompanyName;
                    exporter.FilterDescription = FilterDescription;
                    exporter.ExportedBy = PrintedBy;

                    bool ok = exporter.Export(
                        _reportData, dlg.FileName);

                    if (ok)
                    {
                        MessageBoxResult res =
                            MessageBox.Show(
                            "✅ تم التصدير بنجاح!\n\n"
                            + "📁 الملف: " + dlg.FileName
                            + "\n📊 عدد السجلات: "
                            + _reportData.Rows.Count
                                .ToString("N0")
                            + "\n\nهل تريد فتح الملف الآن؟",
                            "تم التصدير",
                            MessageBoxButton.YesNo,
                            MessageBoxImage.Information,
                            MessageBoxResult.Yes);

                        if (res == MessageBoxResult.Yes)
                            System.Diagnostics.Process.Start(
                                dlg.FileName);
                    }

                    btnExportExcel.IsEnabled = true;
                    btnExportExcel.Content =
                        CreateButtonContent(
                            "📊", "تصدير Excel");
                }
            }
            catch (Exception ex)
            {
                btnExportExcel.IsEnabled = true;
                btnExportExcel.Content =
                    CreateButtonContent("📊", "تصدير Excel");

                MessageBox.Show(
                    "خطأ في التصدير إلى Excel:\n"
                    + ex.Message,
                    "خطأ",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        private object CreateButtonContent(
            string icon, string text)
        {
            StackPanel sp = new StackPanel();
            sp.Orientation = Orientation.Horizontal;

            TextBlock iconTB = new TextBlock();
            iconTB.Text = icon;
            iconTB.FontSize = 14;
            iconTB.Margin = new Thickness(0, 0, 6, 0);
            sp.Children.Add(iconTB);

            TextBlock textTB = new TextBlock();
            textTB.Text = text;
            sp.Children.Add(textTB);

            return sp;
        }

        // ═══════════════════════════════════════════
        //  التكبير والتصغير
        // ═══════════════════════════════════════════
        private void btnZoomIn_Click(object sender,
            RoutedEventArgs e)
        {
            _zoomLevel = Math.Min(_zoomLevel + 0.15, 3.0);
            ApplyZoom();
        }

        private void btnZoomOut_Click(object sender,
            RoutedEventArgs e)
        {
            _zoomLevel = Math.Max(_zoomLevel - 0.15, 0.3);
            ApplyZoom();
        }

        private void btnZoomReset_Click(object sender,
            RoutedEventArgs e)
        {
            _zoomLevel = 1.0;
            ApplyZoom();
        }

        private void ApplyZoom()
        {
            docViewer.Zoom = _zoomLevel * 100;
            txtZoom.Text =
                string.Format("{0:F0}%", _zoomLevel * 100);
        }

        // ═══════════════════════════════════════════
        //  الإغلاق
        // ═══════════════════════════════════════════
        private void btnClose_Click(object sender,
            RoutedEventArgs e)
        {
            this.Close();
        }
    }
}