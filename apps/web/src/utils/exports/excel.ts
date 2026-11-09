/**
 * Offline Excel Export Utility via ExcelJS.
 * Generates beautifully styled multi-sheet .xlsx workbooks with church branding,
 * formatted currency values, auto-width columns, and denominational notes.
 */

import ExcelJS from 'exceljs';
import { defaultChurchSettings } from '../../config/churchSettings.js';

export interface ExcelColumnDef {
  header: string;
  key: string;
  width?: number;
  isCurrency?: boolean;
}

export interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  reportTitle: string;
  churchName?: string;
  branchName?: string;
  periodText: string;
  currency: 'GHS' | 'USD';
  columns: ExcelColumnDef[];
  data: Record<string, any>[];
  summaryRows?: { label: string; value: number | string }[];
  disclosureFootnote?: string;
}

export async function exportReportToExcel(
  optionsOrData: ExcelExportOptions | Record<string, any>[],
  filenameParam?: string,
  extraOptions?: { title?: string; currency?: 'GHS' | 'USD'; periodText?: string }
): Promise<void> {
  let options: ExcelExportOptions;

  if (Array.isArray(optionsOrData)) {
    const data = optionsOrData;
    const first = data[0];
    const headers = first ? Object.keys(first) : [];
    const columns: ExcelColumnDef[] = headers.map((h) => ({
      header: h,
      key: h,
      isCurrency: h.toLowerCase().includes('ghs') || h.toLowerCase().includes('usd') || h.toLowerCase().includes('amount'),
    }));

    options = {
      filename: filenameParam || 'export',
      reportTitle: extraOptions?.title || 'Report',
      periodText: extraOptions?.periodText || 'Current Period',
      currency: extraOptions?.currency || 'GHS',
      columns,
      data,
    };
  } else {
    options = optionsOrData;
  }

  const {
    filename,
    sheetName = 'Financial Statement',
    reportTitle,
    churchName = defaultChurchSettings.churchName,
    branchName = defaultChurchSettings.branchName,
    periodText,
    currency,
    columns,
    data,
    summaryRows = [],
    disclosureFootnote,
  } = options;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Church Accounting System (Accra)';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  // Title Block
  const titleRow = sheet.addRow([churchName.toUpperCase()]);
  titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E3A8A' } };

  const branchRow = sheet.addRow([`${branchName} • ${reportTitle}`]);
  branchRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } };

  const periodRow = sheet.addRow([`Reporting Period: ${periodText} | Currency: ${currency}`]);
  periodRow.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };

  sheet.addRow([]); // Blank spacer

  // Header Row
  const headerValues = columns.map((c) => c.header);
  const headerRow = sheet.addRow(headerValues);
  headerRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A8A' }, // Church Royal Blue
  };
  headerRow.height = 24;
  headerRow.alignment = { vertical: 'middle' };

  // Data Rows
  for (const item of data) {
    const rowValues = columns.map((col) => {
      const val = item[col.key];
      if (col.isCurrency && typeof val === 'number') {
        return val;
      }
      return val ?? '';
    });

    const row = sheet.addRow(rowValues);
    row.font = { name: 'Calibri', size: 10 };
    row.alignment = { vertical: 'middle' };

    // Apply currency formatting to numeric columns
    columns.forEach((col, idx) => {
      if (col.isCurrency) {
        const cell = row.getCell(idx + 1);
        cell.numFmt = `#,##0.00`;
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
    });
  }

  // Summary / Total Rows
  if (summaryRows.length > 0) {
    sheet.addRow([]); // Blank spacer
    for (const summary of summaryRows) {
      const summaryValues = columns.map((_, idx) => {
        if (idx === 0) return summary.label;
        if (idx === columns.length - 1) return summary.value;
        return '';
      });

      const sRow = sheet.addRow(summaryValues);
      sRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
      sRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };

      const valueCell = sRow.getCell(columns.length);
      if (typeof summary.value === 'number') {
        valueCell.numFmt = `#,##0.00`;
      }
      valueCell.alignment = { horizontal: 'right' };
      valueCell.border = {
        top: { style: 'thin' },
        bottom: { style: 'double' },
      };
    }
  }

  // Disclosure Footnote
  if (disclosureFootnote) {
    sheet.addRow([]);
    const fnRow = sheet.addRow([disclosureFootnote]);
    fnRow.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF475569' } };
  }

  // Auto-fit column widths safely without spreading large arrays onto call stack
  columns.forEach((col, idx) => {
    const sheetCol = sheet.getColumn(idx + 1);
    const maxContentLen = data.reduce((max, d) => {
      const len = String(d[col.key] ?? '').length;
      return len > max ? len : max;
    }, 0);
    const maxLen = Math.max(col.header.length, maxContentLen, col.width || 12);
    sheetCol.width = Math.min(maxLen + 4, 45);
  });

  // Write and download buffer offline
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
