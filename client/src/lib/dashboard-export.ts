import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import writeExcelFile from "write-excel-file/browser";

export type DashboardMetric = { label: string; value: string; note?: string };
export type DashboardDetail = Record<string, string | number | null | undefined>;

export function dashboardSheetData(title: string, metrics: DashboardMetric[], details: DashboardDetail[] = []) {
  const detailHeaders = details.length ? Object.keys(details[0]) : [];
  return [
    [{ value: title, fontWeight: "bold" as const, fontSize: 16, backgroundColor: "#0f766e", textColor: "#ffffff", align: "right" as const }],
    [{ value: `تاريخ الإنشاء: ${new Date().toLocaleString("ar-YE")}`, align: "right" as const, textColor: "#475569" }],
    [{ value: "المؤشر", fontWeight: "bold" as const, backgroundColor: "#f0fdfa", align: "right" as const }, { value: "القيمة", fontWeight: "bold" as const, backgroundColor: "#f0fdfa", align: "right" as const }, { value: "التوضيح", fontWeight: "bold" as const, backgroundColor: "#f0fdfa", align: "right" as const }],
    ...metrics.map(metric => [{ value: metric.label, align: "right" as const }, { value: metric.value, align: "right" as const }, { value: metric.note ?? "—", align: "right" as const }]),
    ...(detailHeaders.length ? [[{ value: "تفاصيل الملخص", fontWeight: "bold" as const, backgroundColor: "#e2e8f0", align: "right" as const }], detailHeaders.map(header => ({ value: header, fontWeight: "bold" as const, backgroundColor: "#f8fafc", align: "right" as const })), ...details.map(row => detailHeaders.map(header => ({ value: row[header] ?? "—", align: "right" as const })))] : []),
  ];
}

export async function exportDashboardExcel({ title, sheet, fileName, metrics, details }: { title: string; sheet: string; fileName: string; metrics: DashboardMetric[]; details?: DashboardDetail[] }) {
  await writeExcelFile(dashboardSheetData(title, metrics, details), {
    sheet,
    columns: [{ width: 28 }, { width: 22 }, { width: 42 }, { width: 20 }, { width: 20 }],
    rightToLeft: true,
    stickyRowsCount: 3,
    showGridLines: false,
  }, { fontFamily: "Arial", fontSize: 11 }).toFile(fileName);
}

export async function exportDashboardPdf({ title, fileName, metrics, details = [] }: { title: string; fileName: string; metrics: DashboardMetric[]; details?: DashboardDetail[] }) {
  const report = document.createElement("section");
  report.id = "dashboard-export-print";
  report.dir = "rtl";
  Object.assign(report.style, { position: "fixed", inset: "0 auto auto -10000px", width: "760px", padding: "34px", background: "#ffffff", color: "#0f172a", fontFamily: "Arial, Tajawal, sans-serif", direction: "rtl", textAlign: "right" });
  const heading = document.createElement("h1");
  heading.textContent = title;
  Object.assign(heading.style, { margin: "0", fontSize: "24px", color: "#0f766e" });
  const created = document.createElement("p");
  created.textContent = `تاريخ الإنشاء: ${new Date().toLocaleString("ar-YE")}`;
  Object.assign(created.style, { margin: "8px 0 24px", color: "#64748b", fontSize: "13px" });
  report.append(heading, created);
  const metricGrid = document.createElement("div");
  Object.assign(metricGrid.style, { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" });
  metrics.forEach(metric => {
    const card = document.createElement("div");
    Object.assign(card.style, { border: "1px solid #cbd5e1", borderTop: "4px solid #0f887f", borderRadius: "12px", padding: "14px", background: "#f8fafc" });
    const label = document.createElement("strong"); label.textContent = metric.label; label.style.display = "block";
    const value = document.createElement("div"); value.textContent = metric.value; Object.assign(value.style, { marginTop: "10px", fontSize: "20px", fontWeight: "700", direction: "ltr", textAlign: "right" });
    const note = document.createElement("small"); note.textContent = metric.note ?? ""; Object.assign(note.style, { display: "block", marginTop: "8px", color: "#64748b" });
    card.append(label, value, note); metricGrid.append(card);
  });
  report.append(metricGrid);
  if (details.length) {
    const subheading = document.createElement("h2"); subheading.textContent = "تفاصيل الملخص"; Object.assign(subheading.style, { margin: "26px 0 10px", fontSize: "18px" }); report.append(subheading);
    const table = document.createElement("table"); Object.assign(table.style, { width: "100%", borderCollapse: "collapse", fontSize: "12px" });
    const headers = Object.keys(details[0]);
    const headRow = document.createElement("tr"); headers.forEach(header => { const cell = document.createElement("th"); cell.textContent = header; Object.assign(cell.style, { padding: "8px", border: "1px solid #cbd5e1", background: "#ecfdf5" }); headRow.append(cell); }); table.append(headRow);
    details.slice(0, 12).forEach(row => { const tableRow = document.createElement("tr"); headers.forEach(header => { const cell = document.createElement("td"); cell.textContent = String(row[header] ?? "—"); Object.assign(cell.style, { padding: "7px", border: "1px solid #e2e8f0" }); tableRow.append(cell); }); table.append(tableRow); });
    report.append(table);
  }
  document.body.append(report);
  try {
    const canvas = await html2canvas(report, {
      scale: 1.35,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: clonedDocument => {
        clonedDocument.querySelectorAll("style, link[rel='stylesheet']").forEach(node => node.remove());
        clonedDocument.documentElement.style.setProperty("background", "#ffffff", "important");
        clonedDocument.body.style.setProperty("background", "#ffffff", "important");
        const clonedReport = clonedDocument.getElementById("dashboard-export-print");
        clonedReport?.style.setProperty("background", "#ffffff", "important");
      },
    });
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth() - 48;
    const pageHeight = pdf.internal.pageSize.getHeight() - 48;
    const renderedHeight = (canvas.height * pageWidth) / canvas.width;
    const scale = Math.min(1, pageHeight / renderedHeight);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.86), "JPEG", 24, 24, pageWidth * scale, renderedHeight * scale, undefined, "FAST");
    pdf.save(fileName);
  } finally {
    report.remove();
  }
}
