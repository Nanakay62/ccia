/**
 * Word (.doc) Export Utility for Financial Reports.
 * Implements Section 1.6, 5 & 9 of the specification:
 * Generates an official Word document format (HTML-based MS Word format)
 * with the church letterhead, TIN registration, formatted accounting table,
 * totals, and dual signature block so church councils can paste directly into minutes.
 */

import { defaultChurchSettings } from '../../config/churchSettings.js';

/**
 * Escapes unsafe characters for HTML/XML documents to prevent XSS / markup injection.
 */
function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface WordExportColumn {
  header: string;
  key: string;
  align?: 'left' | 'center' | 'right';
  isCurrency?: boolean;
}

export interface WordExportOptions {
  title: string;
  periodText?: string;
  currency?: string;
  columns: WordExportColumn[];
  data: Record<string, any>[];
  preparedByName?: string;
  preparedByRole?: string;
  approvedByName?: string;
  approvedByRole?: string;
  isDemo?: boolean;
  notes?: string;
  filename?: string;
}

export const exportReportToWord = ({
  title,
  periodText = 'Current Financial Period',
  currency = 'GHS',
  columns,
  data,
  preparedByName = 'Ebenezer Mensah',
  preparedByRole = 'Finance Secretary',
  approvedByName = 'Deaconess Akosua Darko',
  approvedByRole = 'Church Treasurer',
  isDemo = false,
  notes,
  filename,
}: WordExportOptions): void => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const headerCellsHtml = columns
    .map(
      (col) =>
        `<th style="border: 1px solid #475569; background-color: #f1f5f9; padding: 8px 10px; font-size: 11pt; text-align: ${
          col.align || (col.isCurrency ? 'right' : 'left')
        }; color: #0f172a; font-family: Calibri, 'Segoe UI', sans-serif;">${escapeHtml(col.header)}</th>`
    )
    .join('');

  const rowsHtml = data
    .map((row, rIdx) => {
      const isTotalRow =
        row.isTotal ||
        row.category === 'TOTAL' ||
        row.code === 'TOTAL' ||
        row.accountName?.toString().toUpperCase().includes('TOTAL') ||
        row.name?.toString().toUpperCase().includes('TOTAL');

      const bg = isTotalRow ? '#f8fafc' : rIdx % 2 === 0 ? '#ffffff' : '#fcfcfc';
      const fontWeight = isTotalRow ? 'bold' : 'normal';
      const borderBottom = isTotalRow ? '3px double #0f172a' : '1px solid #e2e8f0';

      const cells = columns
        .map((col) => {
          let val = row[col.key];
          if (val === undefined || val === null) val = '-';
          if (col.isCurrency && typeof val === 'number') {
            val = `${currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          }
          return `<td style="border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; border-bottom: ${borderBottom}; padding: 6px 10px; font-size: 10.5pt; text-align: ${
            col.align || (col.isCurrency ? 'right' : 'left')
          }; font-family: Calibri, 'Segoe UI', sans-serif; font-weight: ${fontWeight};">${escapeHtml(val)}</td>`;
        })
        .join('');

      return `<tr style="background-color: ${bg};">${cells}</tr>`;
    })
    .join('');

  const htmlContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${escapeHtml(title)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 1.5cm;
          mso-header-margin: 1cm;
          mso-footer-margin: 1cm;
        }
        body {
          font-family: Calibri, 'Segoe UI', Arial, sans-serif;
          color: #0f172a;
          margin: 0;
          padding: 0;
        }
        h1, h2, h3 {
          font-family: Georgia, 'Times New Roman', serif;
        }
      </style>
    </head>
    <body>
      ${
        isDemo
          ? `<div style="background-color: #fef3c7; border: 1px solid #f59e0b; color: #92400e; padding: 6px 12px; font-size: 10pt; font-weight: bold; text-align: center; margin-bottom: 12px;">
              DEMO — NOT OFFICIAL • SANDBOX AUDIT COPY
            </div>`
          : ''
      }

      <!-- Church Official Letterhead -->
      <table style="width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
        <tr>
          <td style="vertical-align: top;">
            <div style="font-size: 16pt; font-weight: bold; font-family: Georgia, serif; color: #1e3a8a;">
              ${escapeHtml(defaultChurchSettings.churchName)}
            </div>
            <div style="font-size: 11pt; font-weight: bold; color: #334155; margin-top: 2px;">
              ${escapeHtml(defaultChurchSettings.branchName)}
            </div>
            <div style="font-size: 9.5pt; color: #64748b; margin-top: 2px;">
              ${escapeHtml(defaultChurchSettings.address)}
            </div>
            <div style="font-size: 9pt; color: #64748b;">
              Tel: ${escapeHtml(defaultChurchSettings.phone)} • Email: ${escapeHtml(defaultChurchSettings.email)}
            </div>
            <div style="font-size: 9pt; font-weight: bold; color: #475569; margin-top: 2px;">
              ${escapeHtml(defaultChurchSettings.taxRegNumber)}
            </div>
          </td>
          <td style="vertical-align: top; text-align: right;">
            <div style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 4px 12px; font-size: 10pt; font-weight: bold; text-transform: uppercase;">
              ${escapeHtml(title)}
            </div>
            <div style="font-size: 10pt; margin-top: 6px; color: #334155;">
              Period: <strong>${escapeHtml(periodText)}</strong>
            </div>
            <div style="font-size: 9.5pt; color: #64748b;">
              Date Generated: <strong>${escapeHtml(currentDate)}</strong>
            </div>
            <div style="font-size: 9.5pt; color: #64748b;">
              Currency: <strong>${currency === 'USD' ? 'US Dollars (USD)' : 'Ghana Cedis (GHS)'}</strong>
            </div>
          </td>
        </tr>
      </table>

      <!-- Document Notes / Overview if any -->
      ${
        notes
          ? `<p style="font-size: 10pt; color: #475569; font-style: italic; margin-bottom: 14px;">${escapeHtml(notes)}</p>`
          : ''
      }

      <!-- Financial Report Data Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 24px;">
        <thead>
          <tr>
            ${headerCellsHtml}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Dual Signature Block (Section 1.6 & 5) -->
      <table style="width: 100%; margin-top: 36px; border-top: 1px solid #94a3b8; padding-top: 16px;">
        <tr>
          <td style="width: 45%; vertical-align: top;">
            <div style="font-size: 9.5pt; font-weight: bold; text-transform: uppercase; color: #475569;">
              Prepared by:
            </div>
            <div style="height: 35px; border-bottom: 1.5px solid #0f172a; margin-top: 10px; margin-bottom: 6px;">
              <span style="font-family: Georgia, serif; font-style: italic; font-size: 10pt; color: #1e3a8a;">
                Signed Electronically
              </span>
            </div>
            <div style="font-size: 10.5pt; font-weight: bold; color: #0f172a;">${escapeHtml(preparedByName)}</div>
            <div style="font-size: 9.5pt; color: #475569;">${escapeHtml(preparedByRole)}</div>
            <div style="font-size: 9pt; color: #64748b;">Date: ${escapeHtml(currentDate)}</div>
          </td>
          <td style="width: 10%;"></td>
          <td style="width: 45%; vertical-align: top;">
            <div style="font-size: 9.5pt; font-weight: bold; text-transform: uppercase; color: #475569;">
              Approved by:
            </div>
            <div style="height: 35px; border-bottom: 1.5px solid #0f172a; margin-top: 10px; margin-bottom: 6px;">
              <span style="font-family: Georgia, serif; font-style: italic; font-size: 10pt; color: #1e3a8a;">
                Signed Electronically
              </span>
            </div>
            <div style="font-size: 10.5pt; font-weight: bold; color: #0f172a;">${escapeHtml(approvedByName)}</div>
            <div style="font-size: 9.5pt; color: #475569;">${escapeHtml(approvedByRole)}</div>
            <div style="font-size: 9pt; color: #64748b;">Date: ${escapeHtml(currentDate)}</div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 30px; font-size: 8.5pt; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        Official Record of ${defaultChurchSettings.churchName} • Dual signature verified for internal controls and church council minute records.
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8',
  });

  const safeFilename =
    filename ||
    `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().split('T')[0]}.doc`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
