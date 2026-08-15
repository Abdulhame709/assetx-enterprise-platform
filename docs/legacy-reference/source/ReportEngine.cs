using System;
using System.Collections.Generic;
using System.Data;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;

namespace AssetManagement.Helpers
{
    public class ReportEngine
    {
        private double _pageWidth = 794;
        private double _pageHeight = 1122;
        private double _marginLR = 35;
        private double _marginTB = 25;
        private double CW { get { return _pageWidth - _marginLR * 2; } }
        private double CH { get { return _pageHeight - _marginTB * 2; } }
        private double _headerH = 55;
        private double _filterH = 24;
        private double _colHeaderH = 26;
        private double _rowH = 22;
        private double _footerH = 35;
        private double _totalRowH = 26;

        // ═══ ارتفاع قسم التوقيعات ═══
        private double _signatureH = 80;

        public string CompanyName { get; set; }
        public string ReportTitle { get; set; }
        public string ReportSubTitle { get; set; }
        public string FilterDescription { get; set; }
        public string PrintedBy { get; set; }

        // ═══ خصائص التوقيعات الجديدة ═══
        public string RecipientName { get; set; }
        public List<string> CommitteeMembers { get; set; }
        public string CommitteeChairman { get; set; }

        static SolidColorBrush C(string h)
        {
            return (SolidColorBrush)new BrushConverter()
                .ConvertFromString(h);
        }

        static readonly SolidColorBrush cPrimary = C("#1565C0");
        static readonly SolidColorBrush cDark = C("#0D47A1");
        static readonly SolidColorBrush cGold = C("#F39C12");
        static readonly SolidColorBrush cGreen = C("#1B5E20");
        static readonly SolidColorBrush cText = C("#2C3E50");
        static readonly SolidColorBrush cGray = C("#7F8C8D");
        static readonly SolidColorBrush cLight = C("#F8F9FA");
        static readonly SolidColorBrush cBorder = C("#DEE2E6");
        static readonly SolidColorBrush cGroupBg = C("#EBF5FB");
        static readonly SolidColorBrush cW = Brushes.White;
        static readonly SolidColorBrush cSignBg = C("#F0F4FF");
        static readonly SolidColorBrush cSignBorder = C("#1565C0");

        public ReportEngine()
        {
            CompanyName = "نظام إدارة الأصول الثابتة";
            ReportTitle = "تقرير";
            ReportSubTitle = "";
            FilterDescription = "";
            PrintedBy = "مدير النظام";

            // قيم افتراضية للتوقيعات
            RecipientName = "";
            CommitteeMembers = new List<string> { "", "", "", "" };
            CommitteeChairman = "";
        }

        // ═══════════════════════════════════════════
        //  توليد المستند
        // ═══════════════════════════════════════════
        public FixedDocument Generate(DataTable data,
            List<string> groupCols)
        {
            FixedDocument doc = new FixedDocument();
            doc.DocumentPaginator.PageSize =
                new Size(_pageWidth, _pageHeight);

            if (data == null || data.Rows.Count == 0)
            {
                doc.Pages.Add(MakePage(data, 0, 0,
                    null, 1, 1, groupCols));
                return doc;
            }

            data = ReorderColumns(data);

            double[] cw = CalcDynamicWidths(data);

            bool hasFilter =
                !string.IsNullOrEmpty(FilterDescription);

            // ═══ حساب الصفوف مع مراعاة ارتفاع التوقيعات ═══
            double bodyFirst = CH
    - _headerH
    - (hasFilter ? _filterH + 4 : 0)
    - _colHeaderH
    - _footerH
    - _signatureH
    - _totalRowH
    - 20;

            double bodyOther = CH
                - _headerH
                - _colHeaderH
                - _footerH
                - _signatureH
                - _totalRowH
                - 20;

            int rowsFirst = Math.Max(1, (int)(bodyFirst / _rowH));
            int rowsOther = Math.Max(1, (int)(bodyOther / _rowH));
            int total = data.Rows.Count;
            int pages = total <= rowsFirst ? 1
                : 1 + (int)Math.Ceiling(
                    (double)(total - rowsFirst) / rowsOther);

            int cur = 0;
            for (int p = 0; p < pages; p++)
            {
                int count = (p == 0) ? rowsFirst : rowsOther;
                int end = Math.Min(cur + count, total);
                doc.Pages.Add(MakePage(data, cur, end, cw,
                    p + 1, pages, groupCols));
                cur = end;
            }
            return doc;
        }

        // ═══════════════════════════════════════════
        //  إعادة ترتيب الأعمدة
        // ═══════════════════════════════════════════
        private DataTable ReorderColumns(DataTable dt)
        {
            int assetNameIndex = -1;
            int qtyIndex = -1;

            for (int i = 0; i < dt.Columns.Count; i++)
            {
                string colName = dt.Columns[i].ColumnName;
                if (colName == "اسم الأصل" && assetNameIndex == -1)
                    assetNameIndex = i;
                if (colName == "الكمية" && qtyIndex == -1)
                    qtyIndex = i;
            }

            if (assetNameIndex >= 0 && qtyIndex >= 0
                && qtyIndex != assetNameIndex + 1)
            {
                DataTable newDt = new DataTable();
                List<string> orderedCols = new List<string>();

                for (int i = 0; i < dt.Columns.Count; i++)
                {
                    if (i == qtyIndex) continue;
                    orderedCols.Add(dt.Columns[i].ColumnName);
                    if (dt.Columns[i].ColumnName == "اسم الأصل")
                        orderedCols.Add("الكمية");
                }

                foreach (string colName in orderedCols)
                {
                    DataColumn srcCol = dt.Columns[colName];
                    newDt.Columns.Add(colName, srcCol.DataType);
                }

                foreach (DataRow row in dt.Rows)
                {
                    DataRow newRow = newDt.NewRow();
                    foreach (string colName in orderedCols)
                        newRow[colName] = row[colName];
                    newDt.Rows.Add(newRow);
                }
                return newDt;
            }
            return dt;
        }

        // ═══════════════════════════════════════════
        //  بناء الصفحة
        // ═══════════════════════════════════════════
        private PageContent MakePage(DataTable dt, int start,
    int end, double[] cw, int pg, int totalPg,
    List<string> gc)
        {
            FixedPage fp = new FixedPage();
            fp.Width = _pageWidth;
            fp.Height = _pageHeight;

            // ═══ استخدام DockPanel بدلاً من StackPanel ═══
            DockPanel main = new DockPanel();
            main.Width = CW;
            main.Height = CH;
            main.LastChildFill = true;

            // ═══ 1- الـ Footer في الأسفل (يُثبّت أولاً) ═══
            UIElement footer = BuildFooter(pg, totalPg,
                dt != null ? dt.Rows.Count : 0);
            DockPanel.SetDock(footer, Dock.Bottom);
            main.Children.Add(footer);

            // ═══ 2- التوقيعات فوق الـ Footer ═══
            UIElement signatures = BuildSignatureSection();
            DockPanel.SetDock(signatures, Dock.Bottom);
            main.Children.Add(signatures);

            // ═══ 3- الـ Header في الأعلى ═══
            UIElement header = BuildHeader();
            DockPanel.SetDock(header, Dock.Top);
            main.Children.Add(header);

            // ═══ 4- شريط الفلتر (إن وُجد) ═══
            if (pg == 1 && !string.IsNullOrEmpty(FilterDescription))
            {
                UIElement filterBar = BuildFilterBar();
                DockPanel.SetDock(filterBar, Dock.Top);
                main.Children.Add(filterBar);
            }

            // ═══ 5- الجدول يملأ المساحة المتبقية ═══
            if (dt != null && dt.Rows.Count > 0)
            {
                UIElement table = BuildTable(
                    dt, start, end, cw, gc);
                main.Children.Add(table);
            }
            else
            {
                TextBlock tb = MakeTB("لا توجد بيانات", 14,
                    cGray, HorizontalAlignment.Center);
                tb.Margin = new Thickness(0, 60, 0, 0);
                main.Children.Add(tb);
            }

            FixedPage.SetLeft(main, _marginLR);
            FixedPage.SetTop(main, _marginTB);
            fp.Children.Add(main);
            fp.Measure(new Size(_pageWidth, _pageHeight));
            fp.Arrange(new Rect(0, 0, _pageWidth, _pageHeight));
            fp.UpdateLayout();

            PageContent pc = new PageContent();
            ((System.Windows.Markup.IAddChild)pc).AddChild(fp);
            return pc;
        }

        // ═══════════════════════════════════════════
        //  بناء الرأسية
        // ═══════════════════════════════════════════
        private UIElement BuildHeader()
        {
            StackPanel h = new StackPanel();
            h.Margin = new Thickness(0, 0, 0, 4);

            Border bar = new Border();
            bar.Background = cPrimary;
            bar.CornerRadius = new CornerRadius(5, 5, 0, 0);
            bar.Padding = new Thickness(15, 8, 15, 8);
            TextBlock ct = MakeTB(CompanyName, 14, cW,
                HorizontalAlignment.Center);
            ct.FontWeight = FontWeights.Bold;
            bar.Child = ct;
            h.Children.Add(bar);

            Border tb = new Border();
            tb.Background = cW;
            tb.BorderBrush = cBorder;
            tb.BorderThickness = new Thickness(1, 0, 1, 0);
            tb.Padding = new Thickness(10, 4, 10, 4);
            StackPanel tp = new StackPanel();
            tp.HorizontalAlignment = HorizontalAlignment.Center;
            TextBlock tt = MakeTB(ReportTitle, 13, cDark,
                HorizontalAlignment.Center);
            tt.FontWeight = FontWeights.Bold;
            tp.Children.Add(tt);
            if (!string.IsNullOrEmpty(ReportSubTitle))
                tp.Children.Add(MakeTB(ReportSubTitle, 10,
                    cGray, HorizontalAlignment.Center));
            tb.Child = tp;
            h.Children.Add(tb);

            Border gold = new Border();
            gold.Height = 2;
            gold.Background = cGold;
            gold.CornerRadius = new CornerRadius(0, 0, 5, 5);
            h.Children.Add(gold);
            return h;
        }

        // ═══════════════════════════════════════════
        //  شريط الفلتر
        // ═══════════════════════════════════════════
        private UIElement BuildFilterBar()
        {
            Border b = new Border();
            b.Background = C("#FFF8E1");
            b.BorderBrush = cGold;
            b.BorderThickness = new Thickness(0, 0, 0, 1);
            b.Padding = new Thickness(8, 4, 8, 4);
            b.Margin = new Thickness(0, 2, 0, 2);

            TextBlock tb = new TextBlock();
            tb.FontSize = 9;
            tb.TextWrapping = TextWrapping.Wrap;
            tb.TextAlignment = TextAlignment.Center;
            tb.HorizontalAlignment = HorizontalAlignment.Center;
            tb.Inlines.Add(new Run("🔍 ")
            {
                FontWeight = FontWeights.Bold,
                Foreground = C("#E65100")
            });
            tb.Inlines.Add(new Run(FilterDescription)
            {
                Foreground = cText
            });
            b.Child = tb;
            return b;
        }

        // ═══════════════════════════════════════════
        //  الجدول
        // ═══════════════════════════════════════════
        private UIElement BuildTable(DataTable dt, int start,
            int end, double[] cw, List<string> gc)
        {
            Grid t = new Grid();
            t.FlowDirection = FlowDirection.LeftToRight;

            int colCount = dt.Columns.Count;

            for (int c = colCount - 1; c >= 0; c--)
            {
                double w = (cw != null && c < cw.Length)
                    ? cw[c] : 80;
                t.ColumnDefinitions.Add(
                    new ColumnDefinition
                    { Width = new GridLength(w) });
            }

            t.ColumnDefinitions.Add(new ColumnDefinition
            { Width = new GridLength(28) });

            t.RowDefinitions.Add(new RowDefinition
            { Height = new GridLength(_colHeaderH) });

            Cell(t, 0, colCount, "م", cDark, cW,
                TextAlignment.Center, 8, FontWeights.Bold, true);

            for (int c = 0; c < colCount; c++)
            {
                int gridCol = colCount - 1 - c;
                Cell(t, 0, gridCol, dt.Columns[c].ColumnName,
                    cDark, cW, TextAlignment.Center, 9,
                    FontWeights.Bold, true);
            }

            int ri = 1;
            for (int r = start; r < end; r++)
            {
                t.RowDefinitions.Add(new RowDefinition
                { Height = new GridLength(_rowH) });
                DataRow dr = dt.Rows[r];

                bool newGroup = false;
                if (gc != null && gc.Count > 0)
                {
                    string firstGC = gc[0];
                    if (dt.Columns.Contains(firstGC))
                    {
                        string v = dr[firstGC] != DBNull.Value
                            ? dr[firstGC].ToString() : "";
                        if (!string.IsNullOrEmpty(v))
                            newGroup = true;
                    }
                }

                SolidColorBrush bg = newGroup && r > start && ri > 1
                    ? cGroupBg
                    : (ri % 2 == 0 ? cLight : cW);

                Cell(t, ri, colCount, (r + 1).ToString(),
                    bg, cGray, TextAlignment.Center, 7,
                    FontWeights.Normal, false);

                for (int c = 0; c < colCount; c++)
                {
                    int gridCol = colCount - 1 - c;
                    string cn = dt.Columns[c].ColumnName;
                    string val = dr[c] != DBNull.Value
                        ? dr[c].ToString() : "";
                    bool isNum = IsNum(dt, c);

                    if (isNum && !string.IsNullOrEmpty(val))
                    {
                        decimal nv = 0;
                        if (decimal.TryParse(val, out nv))
                        {
                            val = (cn.Contains("سعر")
                                || cn.Contains("قيمة")
                                || cn.Contains("إجمالي"))
                                ? nv.ToString("N2")
                                : nv.ToString("N0");
                        }
                    }

                    SolidColorBrush fg;
                    FontWeight fw;

                    if (string.IsNullOrEmpty(val))
                    {
                        fg = Brushes.Transparent;
                        fw = FontWeights.Normal;
                    }
                    else if (newGroup && gc != null
                        && gc.Count > 0 && cn == gc[0])
                    {
                        fg = cDark;
                        fw = FontWeights.Bold;
                    }
                    else if (isNum)
                    {
                        fg = C("#27AE60");
                        fw = FontWeights.SemiBold;
                    }
                    else
                    {
                        fg = cText;
                        fw = FontWeights.Normal;
                    }

                    TextAlignment align = isNum
                        ? TextAlignment.Center
                        : TextAlignment.Left;

                    Cell(t, ri, gridCol, val, bg, fg,
                        align, 9, fw, false);
                }
                ri++;
            }

            if (end >= dt.Rows.Count)
            {
                t.RowDefinitions.Add(new RowDefinition
                { Height = new GridLength(_totalRowH) });

                Cell(t, ri, colCount, "", cGreen, cW,
                    TextAlignment.Center, 8,
                    FontWeights.Bold, false);

                for (int c = 0; c < colCount; c++)
                {
                    int gridCol = colCount - 1 - c;
                    string cn = dt.Columns[c].ColumnName;
                    string tv = "";

                    if (c == 0)
                    {
                        tv = "الإجمالي (" + dt.Rows.Count + ")";
                    }
                    else if (IsNum(dt, c))
                    {
                        decimal sum = 0;
                        foreach (DataRow dr2 in dt.Rows)
                        {
                            if (dr2[c] != DBNull.Value)
                            {
                                decimal v;
                                if (decimal.TryParse(
                                    dr2[c].ToString(), out v))
                                    sum += v;
                            }
                        }
                        tv = (cn.Contains("سعر")
                            || cn.Contains("قيمة")
                            || cn.Contains("إجمالي"))
                            ? sum.ToString("N2")
                            : sum.ToString("N0");
                    }

                    Cell(t, ri, gridCol, tv, cGreen, cW,
                        TextAlignment.Center, 9,
                        FontWeights.Bold, false);
                }
            }

            Border border = new Border();
            border.BorderBrush = cDark;
            border.BorderThickness = new Thickness(1);
            border.CornerRadius = new CornerRadius(3);
            border.ClipToBounds = true;
            border.Margin = new Thickness(0, 2, 0, 0);
            border.Child = t;
            return border;
        }

        // ═══════════════════════════════════════════════════════
        //  ✅ قسم التوقيعات الجديد
        //  الصف الأول  : المستلم
        //  الصف الثاني : أعضاء اللجنة (4) + رئيس اللجنة
        // ═══════════════════════════════════════════════════════
        private UIElement BuildSignatureSection()
        {
            // الحاوية الرئيسية
            Border outerBorder = new Border();
            outerBorder.BorderBrush = cSignBorder;
            outerBorder.BorderThickness = new Thickness(1);
            outerBorder.CornerRadius = new CornerRadius(4);
            outerBorder.Margin = new Thickness(0, 4, 0, 2);
            outerBorder.ClipToBounds = true;

            StackPanel container = new StackPanel();

            // ─── عنوان القسم ───
            Border titleBar = new Border();
            titleBar.Background = cPrimary;
            titleBar.Padding = new Thickness(8, 4, 8, 4);

            TextBlock titleTB = MakeTB(
                "التوقيعات", 9, cW,
                HorizontalAlignment.Center);
            titleTB.FontWeight = FontWeights.Bold;
            titleBar.Child = titleTB;
            container.Children.Add(titleBar);

            // ─── الصف الأول: المستلم ───
            container.Children.Add(
                BuildRecipientRow());

            // ─── فاصل ───
            Border sep = new Border();
            sep.Height = 1;
            sep.Background = cBorder;
            container.Children.Add(sep);

            // ─── الصف الثاني: أعضاء اللجنة ───
            container.Children.Add(
                BuildCommitteeRow());

            outerBorder.Child = container;
            return outerBorder;
        }

        // ─── صف المستلم ───────────────────────────────────────
        private UIElement BuildRecipientRow()
        {
            Border rowBorder = new Border();
            rowBorder.Background = cSignBg;
            rowBorder.Padding = new Thickness(6, 3, 6, 3);

            Grid g = new Grid();
            g.FlowDirection = FlowDirection.RightToLeft;

            // عمود التسمية (ثابت)
            g.ColumnDefinitions.Add(new ColumnDefinition
            { Width = new GridLength(90) });

            // عمود الاسم
            g.ColumnDefinitions.Add(new ColumnDefinition
            { Width = new GridLength(180) });

            // عمود التوقيع (متمدد)
            g.ColumnDefinitions.Add(new ColumnDefinition
            { Width = new GridLength(1, GridUnitType.Star) });

            // ─ تسمية "المستلم:" ─
            TextBlock lblRecipient = MakeTB(
                "المستلم :", 9, cDark,
                HorizontalAlignment.Right);
            lblRecipient.FontWeight = FontWeights.Bold;
            lblRecipient.VerticalAlignment =
                VerticalAlignment.Center;
            Grid.SetColumn(lblRecipient, 0);
            g.Children.Add(lblRecipient);

            // ─ اسم المستلم ─
            string rName = string.IsNullOrEmpty(RecipientName)
                ? "................................."
                : RecipientName;

            TextBlock nameBlock = MakeTB(
                rName, 9, cText,
                HorizontalAlignment.Right);
            nameBlock.VerticalAlignment =
                VerticalAlignment.Center;
            Grid.SetColumn(nameBlock, 1);
            g.Children.Add(nameBlock);

            // ─ خانة التوقيع ─
            StackPanel signPanel = new StackPanel();
            signPanel.HorizontalAlignment =
                HorizontalAlignment.Left;
            signPanel.Margin = new Thickness(20, 0, 0, 0);

            TextBlock lblSign = MakeTB(
                "التوقيع :", 8, cGray,
                HorizontalAlignment.Right);
            signPanel.Children.Add(lblSign);

            // خط التوقيع
            Border signLine = new Border();
            signLine.Width = 140;
            signLine.Height = 1;
            signLine.Background = cText;
            signLine.Margin = new Thickness(0, 14, 0, 2);
            signLine.HorizontalAlignment =
                HorizontalAlignment.Right;
            signPanel.Children.Add(signLine);

            Grid.SetColumn(signPanel, 2);
            g.Children.Add(signPanel);

            rowBorder.Child = g;
            return rowBorder;
        }

        // ─── صف أعضاء لجنة الجرد ───────────────────────────────
        private UIElement BuildCommitteeRow()
        {
            Border rowBorder = new Border();
            rowBorder.Background = cW;
            rowBorder.Padding = new Thickness(6, 3, 6, 3);

            // ═══ Grid رئيسي: 5 خانات أعضاء + رئيس اللجنة ═══
            Grid g = new Grid();
            g.FlowDirection = FlowDirection.RightToLeft;

            // 4 أعضاء + رئيس = 5 أعمدة متساوية
            for (int i = 0; i < 5; i++)
            {
                g.ColumnDefinitions.Add(
                    new ColumnDefinition
                    { Width = new GridLength(1, GridUnitType.Star) });
            }

            // صفان: عنوان + محتوى
            g.RowDefinitions.Add(new RowDefinition
            { Height = GridLength.Auto });
            g.RowDefinitions.Add(new RowDefinition
            { Height = GridLength.Auto });

            // ─── عناوين الأعضاء ───
            // بعد التعديل
            // 4 أعضاء في الأعمدة 0,1,2,3
            for (int i = 0; i < 4; i++)
            {
                TextBlock memberLabel = MakeTB(
                    "عضو لجنة " + (i + 1), 8,
                    cGray, HorizontalAlignment.Center);
                memberLabel.FontWeight = FontWeights.Bold;
                Grid.SetRow(memberLabel, 0);
                Grid.SetColumn(memberLabel, i);
                g.Children.Add(memberLabel);
            }

            // رئيس اللجنة في العمود الأخير (يسار)
            TextBlock chairLabel = MakeTB(
                "رئيس لجنة الجرد", 8, cDark,
                HorizontalAlignment.Center);
            chairLabel.FontWeight = FontWeights.Bold;
            Grid.SetRow(chairLabel, 0);
            Grid.SetColumn(chairLabel, 4);
            g.Children.Add(chairLabel);

            // ─── صناديق التوقيع ───
            // رئيس اللجنة
            string chairName = string.IsNullOrEmpty(CommitteeChairman)
                ? ""
                : CommitteeChairman;

            Grid.SetRow(
                BuildSignBox(chairName, true), 1);
            Grid.SetColumn(
                BuildSignBox(chairName, true), 0);

            // ✅ نعيد بناء الـ SignBox للرئيس بشكل صحيح
            // بعد التعديل
            // 4 أعضاء في الأعمدة 0,1,2,3
            for (int i = 0; i < 4; i++)
            {
                string memberName = (CommitteeMembers != null
                    && i < CommitteeMembers.Count)
                    ? CommitteeMembers[i]
                    : "";

                UIElement memberBox = BuildSignBox(memberName, false);
                Grid.SetRow(memberBox, 1);
                Grid.SetColumn(memberBox, i);
                g.Children.Add(memberBox);
            }

            // رئيس اللجنة في العمود الأخير (يسار)
            UIElement chairBox = BuildSignBox(chairName, true);
            Grid.SetRow(chairBox, 1);
            Grid.SetColumn(chairBox, 4);
            g.Children.Add(chairBox);

            rowBorder.Child = g;
            return rowBorder;
        }

        // ─── صندوق التوقيع الفردي ──────────────────────────────
        private UIElement BuildSignBox(string name, bool isChairman)
        {
            Border box = new Border();
            box.BorderBrush = isChairman ? cDark : cBorder;
            box.BorderThickness = new Thickness(0.8);
            box.CornerRadius = new CornerRadius(3);
            box.Margin = new Thickness(3, 2, 3, 2);
            box.Padding = new Thickness(4, 4, 4, 4);
            box.Background = isChairman
                ? C("#E8EAF6")
                : cSignBg;

            StackPanel sp = new StackPanel();
            sp.HorizontalAlignment = HorizontalAlignment.Center;

            // الاسم
            string displayName = string.IsNullOrEmpty(name)
                ? "........................"
                : name;

            TextBlock nameTB = new TextBlock();
            nameTB.Text = displayName;
            nameTB.FontFamily = new FontFamily("Segoe UI");
            nameTB.FontSize = 8;
            nameTB.FontWeight = isChairman
                ? FontWeights.Bold
                : FontWeights.Normal;
            nameTB.Foreground = isChairman ? cDark : cText;
            nameTB.TextAlignment = TextAlignment.Center;
            nameTB.HorizontalAlignment =
                HorizontalAlignment.Center;
            nameTB.FlowDirection = FlowDirection.RightToLeft;
            nameTB.TextTrimming = TextTrimming.CharacterEllipsis;
            sp.Children.Add(nameTB);

            // خط التوقيع
            Border line = new Border();
            line.Height = 1;
            line.Background = isChairman ? cDark : cGray;
            line.Margin = new Thickness(4, 10, 4, 2);
            sp.Children.Add(line);

            // نص "التوقيع"
            TextBlock signLbl = new TextBlock();
            signLbl.Text = "التوقيع";
            signLbl.FontFamily = new FontFamily("Segoe UI");
            signLbl.FontSize = 7;
            signLbl.Foreground = cGray;
            signLbl.TextAlignment = TextAlignment.Center;
            signLbl.HorizontalAlignment =
                HorizontalAlignment.Center;
            signLbl.FlowDirection = FlowDirection.RightToLeft;
            sp.Children.Add(signLbl);

            box.Child = sp;
            return box;
        }

        // ═══════════════════════════════════════════
        //  ذيل الصفحة
        // ═══════════════════════════════════════════
        private UIElement BuildFooter(int pg, int total,
            int records)
        {
            StackPanel f = new StackPanel();
            f.VerticalAlignment = VerticalAlignment.Bottom;
            f.Margin = new Thickness(0, 4, 0, 0);

            Border line = new Border();
            line.Height = 1.5;
            line.Background = cPrimary;
            line.Margin = new Thickness(0, 0, 0, 3);
            f.Children.Add(line);

            Grid g = new Grid();
            g.FlowDirection = FlowDirection.RightToLeft;
            g.ColumnDefinitions.Add(new ColumnDefinition
            { Width = new GridLength(1, GridUnitType.Star) });
            g.ColumnDefinitions.Add(new ColumnDefinition
            { Width = new GridLength(1, GridUnitType.Star) });
            g.ColumnDefinitions.Add(new ColumnDefinition
            { Width = new GridLength(1, GridUnitType.Star) });

            TextBlock t1 = MakeTB("👤 " + PrintedBy, 8,
                cGray, HorizontalAlignment.Right);
            Grid.SetColumn(t1, 0);
            g.Children.Add(t1);

            TextBlock t2 = MakeTB(
                string.Format("─ صفحة {0} من {1} ─",
                    pg, total),
                9, cDark, HorizontalAlignment.Center);
            t2.FontWeight = FontWeights.Bold;
            Grid.SetColumn(t2, 1);
            g.Children.Add(t2);

            TextBlock t3 = MakeTB(
                DateTime.Now.ToString("yyyy/MM/dd  hh:mm tt"),
                8, cGray, HorizontalAlignment.Left);
            Grid.SetColumn(t3, 2);
            g.Children.Add(t3);

            f.Children.Add(g);
            return f;
        }

        // ═══════════════════════════════════════════
        //  الخلية
        // ═══════════════════════════════════════════
        private void Cell(Grid g, int row, int col,
            string text,
            SolidColorBrush bg, SolidColorBrush fg,
            TextAlignment alignment, double size,
            FontWeight weight, bool isHeader)
        {
            Border b = new Border();
            b.Background = bg;
            b.BorderBrush = isHeader
                ? C("#0D47A1") : cBorder;
            b.BorderThickness = new Thickness(0.5, 0, 0, 0.5);
            b.Padding = new Thickness(4, 2, 4, 2);

            TextBlock tb = new TextBlock();
            tb.Text = text;
            tb.FontFamily = new FontFamily("Segoe UI");
            tb.FontSize = size;
            tb.FontWeight = weight;
            tb.Foreground = fg;
            tb.VerticalAlignment = VerticalAlignment.Center;
            tb.TextTrimming = TextTrimming.CharacterEllipsis;
            tb.FlowDirection = FlowDirection.RightToLeft;
            tb.TextAlignment = alignment;

            b.Child = tb;
            Grid.SetRow(b, row);
            Grid.SetColumn(b, col);
            g.Children.Add(b);
        }

        // ═══════════════════════════════════════════
        //  حساب عرض الأعمدة ديناميكياً
        // ═══════════════════════════════════════════
        private double[] CalcDynamicWidths(DataTable dt)
        {
            int cc = dt.Columns.Count;
            double[] maxContentWidth = new double[cc];
            double numColWidth = 28;
            double avail = CW - numColWidth;

            for (int c = 0; c < cc; c++)
            {
                string colName = dt.Columns[c].ColumnName;
                double headerWidth = MeasureText(
                    colName, 9, FontWeights.Bold);
                maxContentWidth[c] = headerWidth;

                int sampleRows = Math.Min(dt.Rows.Count, 50);
                for (int r = 0; r < sampleRows; r++)
                {
                    string val = dt.Rows[r][c] != DBNull.Value
                        ? dt.Rows[r][c].ToString() : "";

                    if (!string.IsNullOrEmpty(val))
                    {
                        if (IsNum(dt, c))
                        {
                            decimal nv;
                            if (decimal.TryParse(val, out nv))
                            {
                                val = (colName.Contains("سعر")
                                    || colName.Contains("قيمة")
                                    || colName.Contains("إجمالي"))
                                    ? nv.ToString("N2")
                                    : nv.ToString("N0");
                            }
                        }
                        double textWidth = MeasureText(
                            val, 9, FontWeights.Normal);
                        if (textWidth > maxContentWidth[c])
                            maxContentWidth[c] = textWidth;
                    }
                }
                maxContentWidth[c] += 16;
            }

            double[] minW = new double[cc];
            double[] maxW = new double[cc];

            for (int c = 0; c < cc; c++)
            {
                string n = dt.Columns[c].ColumnName;

                if (n.Contains("كمية") || n.Contains("عدد")
                    || n == "م")
                { minW[c] = 35; maxW[c] = 55; }
                else if (n.Contains("سعر") || n.Contains("قيمة")
                    || n.Contains("إجمالي"))
                { minW[c] = 55; maxW[c] = 95; }
                else if (n.Contains("كود"))
                { minW[c] = 60; maxW[c] = 120; }
                else if (n.Contains("تاريخ"))
                { minW[c] = 60; maxW[c] = 85; }
                else if (n.Contains("ملاحظات")
                    || n.Contains("وصف"))
                { minW[c] = 80; maxW[c] = 250; }
                else if (n.Contains("اسم"))
                { minW[c] = 80; maxW[c] = 220; }
                else if (n.Contains("موقع"))
                { minW[c] = 70; maxW[c] = 180; }
                else
                { minW[c] = 50; maxW[c] = 160; }

                if (maxContentWidth[c] < minW[c])
                    maxContentWidth[c] = minW[c];
                if (maxContentWidth[c] > maxW[c])
                    maxContentWidth[c] = maxW[c];
            }

            double totalRequested = 0;
            for (int c = 0; c < cc; c++)
                totalRequested += maxContentWidth[c];

            double[] finalW = new double[cc];

            if (totalRequested <= avail)
            {
                double extra = avail - totalRequested;
                double extraPerCol = extra / cc;

                for (int c = 0; c < cc; c++)
                {
                    finalW[c] = maxContentWidth[c] + extraPerCol;
                    if (finalW[c] > maxW[c] * 1.5)
                        finalW[c] = maxW[c] * 1.5;
                }

                double remaining = avail;
                for (int c = 0; c < cc; c++)
                    remaining -= finalW[c];

                if (remaining > 0)
                {
                    for (int c = 0; c < cc; c++)
                    {
                        string n = dt.Columns[c].ColumnName;
                        if (n.Contains("اسم")
                            || n.Contains("ملاحظات")
                            || n.Contains("موقع"))
                            finalW[c] += remaining / 3;
                    }
                }
            }
            else
            {
                double ratio = avail / totalRequested;
                for (int c = 0; c < cc; c++)
                {
                    finalW[c] = maxContentWidth[c] * ratio;
                    if (finalW[c] < minW[c])
                        finalW[c] = minW[c];
                }
            }

            return finalW;
        }

        // ═══════════════════════════════════════════
        //  قياس عرض النص
        // ═══════════════════════════════════════════
        private double MeasureText(string text, double fontSize,
            FontWeight weight)
        {
            if (string.IsNullOrEmpty(text)) return 0;
            double width = 0;
            foreach (char ch in text)
            {
                if (ch >= 0x0600 && ch <= 0x06FF)
                    width += fontSize * 0.85;
                else if (char.IsDigit(ch))
                    width += fontSize * 0.65;
                else if (ch == ' ')
                    width += fontSize * 0.3;
                else if (ch == ',' || ch == '.')
                    width += fontSize * 0.35;
                else
                    width += fontSize * 0.6;
            }
            if (weight == FontWeights.Bold
                || weight == FontWeights.SemiBold)
                width *= 1.1;
            return width;
        }

        private TextBlock MakeTB(string text, double size,
            SolidColorBrush color,
            HorizontalAlignment align)
        {
            return new TextBlock
            {
                Text = text,
                FontFamily = new FontFamily("Segoe UI"),
                FontSize = size,
                Foreground = color,
                HorizontalAlignment = align,
                VerticalAlignment = VerticalAlignment.Center,
                FlowDirection = FlowDirection.RightToLeft
            };
        }

        private string S(DataRow r, string c)
        {
            if (!r.Table.Columns.Contains(c)) return "-";
            object v = r[c];
            return (v == null || v == DBNull.Value)
                ? "-" : v.ToString();
        }

        private bool IsNum(DataTable dt, int c)
        {
            Type t = dt.Columns[c].DataType;
            return t == typeof(int) || t == typeof(long)
                || t == typeof(decimal) || t == typeof(double)
                || t == typeof(float) || t == typeof(short);
        }
    }
}