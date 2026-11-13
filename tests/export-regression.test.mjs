import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { rowsForExport } from "../public/js/report-utils.mjs";

test("Excel roundtrip preserves hour text and keeps formula-looking strings inert", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");
  sheet.addRows(
    rowsForExport(
      [{ date: "2026-10-29", totalMinutes: 485, totalPay: 80.5 }],
      false,
    ),
  );
  sheet.addRow(['=HYPERLINK("https://example.com")']);
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(await workbook.xlsx.writeBuffer());
  const result = loaded.getWorksheet("Report");
  assert.equal(result.getCell("F2").value, "8.05");
  assert.equal(result.getCell("G2").value, "80.50");
  assert.equal(typeof result.getCell("A3").value, "string");
});
test("updated PDF and table libraries generate a multipage report", () => {
  const pdf = new jsPDF();
  autoTable(pdf, {
    head: [["Date", "Hours"]],
    body: Array.from({ length: 366 }, (_, index) => [String(index), "8.05"]),
  });
  assert.ok(pdf.getNumberOfPages() > 1);
  assert.ok(pdf.output().startsWith("%PDF-"));
});
