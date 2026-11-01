/**
 * Offline PDF Export Utility via pdf-lib.
 * Generates official, publication-quality printable financial statement PDFs
 * with Ghanaian church branding, table grids, summary blocks, signature sections, and legal disclosures.
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PdfColumnDef {
  header: string;
  key: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

export interface PdfExportOptions {
  filename: string;
  reportTitle: string;
  churchName?: string;
  branchName?: string;
  periodText: string;
  currency: 'GHS' | 'USD';
  columns: PdfColumnDef[];
  data: Record<string, string | number>[];
  summaryRows?: { label: string; value: string }[];
  disclosureFootnote?: string;
}

export async function exportReportToPdf(options: PdfExportOptions): Promise<void> {
  const {
    filename,
    reportTitle,
    churchName = 'Accra Central Grace Chapel',
    branchName = 'Accra Main Branch',
    periodText,
    currency,
    columns,
    data,
    summaryRows = [],
    disclosureFootnote,
  } = options;

  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // A4 dimensions: 595.28 x 841.89 pt
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const primaryBlue = rgb(0.12, 0.23, 0.54); // #1E3A8A
  const slateText = rgb(0.2, 0.25, 0.33);   // #334155
  const lightBg = rgb(0.95, 0.96, 0.98);     // #F1F5F9
  const borderGray = rgb(0.85, 0.88, 0.92);  // #CBD5E1

  // Draw Header
  const drawHeader = () => {
    // Top colored banner accent line
    page.drawRectangle({
      x: margin,
      y: pageHeight - 20,
      width: contentWidth,
      height: 4,
      color: primaryBlue,
    });

    y = pageHeight - 45;

    // Church Name
    page.drawText(churchName.toUpperCase(), {
      x: margin,
      y,
      size: 15,
      font: fontBold,
      color: primaryBlue,
    });
    y -= 16;

    // Branch & Report Title
    page.drawText(`${branchName} — ${reportTitle}`, {
      x: margin,
      y,
      size: 11,
      font: fontBold,
      color: slateText,
    });
    y -= 14;

    // Period & Currency
    page.drawText(`Reporting Period: ${periodText}  |  Currency: ${currency}  |  Generated: ${new Date().toISOString().substring(0, 10)}`, {
      x: margin,
      y,
      size: 9,
      font: fontItalic,
      color: rgb(0.4, 0.45, 0.55),
    });
    y -= 15;

    // Separator line
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + contentWidth, y },
      thickness: 1,
      color: borderGray,
    });
    y -= 15;
  };

  drawHeader();

  // Draw Table Headers
  const drawTableHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - 5,
      width: contentWidth,
      height: 20,
      color: primaryBlue,
    });

    let xPos = margin + 8;
    for (const col of columns) {
      page.drawText(col.header, {
        x: xPos,
        y: y + 1,
        size: 9,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      xPos += col.width;
    }
    y -= 22;
  };

  drawTableHeader();

  // Draw Data Rows
  for (let i = 0; i < data.length; i++) {
    const item = data[i]!;

    // Pagination check
    if (y < 90) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
      drawTableHeader();
    }

    // Zebra striping
    if (i % 2 === 1) {
      page.drawRectangle({
        x: margin,
        y: y - 3,
        width: contentWidth,
        height: 16,
        color: lightBg,
      });
    }

    let xPos = margin + 8;
    for (const col of columns) {
      const cellValue = String(item[col.key] ?? '');
      const isRight = col.align === 'right';

      if (isRight) {
        const textWidth = fontRegular.widthOfTextAtSize(cellValue, 8.5);
        page.drawText(cellValue, {
          x: xPos + col.width - textWidth - 16,
          y,
          size: 8.5,
          font: fontRegular,
          color: slateText,
        });
      } else {
        page.drawText(cellValue.substring(0, 45), {
          x: xPos,
          y,
          size: 8.5,
          font: fontRegular,
          color: slateText,
        });
      }
      xPos += col.width;
    }

    y -= 16;
  }

  // Summary Rows
  if (summaryRows.length > 0) {
    y -= 8;
    for (const s of summaryRows) {
      if (y < 90) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin - 50;
      }

      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: contentWidth,
        height: 20,
        color: lightBg,
        borderColor: borderGray,
        borderWidth: 1,
      });

      page.drawText(s.label, {
        x: margin + 10,
        y: y + 2,
        size: 9.5,
        font: fontBold,
        color: primaryBlue,
      });

      const valWidth = fontBold.widthOfTextAtSize(s.value, 9.5);
      page.drawText(s.value, {
        x: margin + contentWidth - valWidth - 10,
        y: y + 2,
        size: 9.5,
        font: fontBold,
        color: primaryBlue,
      });

      y -= 24;
    }
  }

  // Footnote / Legal Disclosure
  if (disclosureFootnote) {
    y -= 10;
    if (y < 90) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin - 50;
    }

    page.drawText(disclosureFootnote.substring(0, 140), {
      x: margin,
      y,
      size: 7.5,
      font: fontItalic,
      color: rgb(0.4, 0.45, 0.55),
    });
    if (disclosureFootnote.length > 140) {
      y -= 10;
      page.drawText(disclosureFootnote.substring(140, 280), {
        x: margin,
        y,
        size: 7.5,
        font: fontItalic,
        color: rgb(0.4, 0.45, 0.55),
      });
    }
    y -= 25;
  }

  // Signatures Section
  if (y < 120) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin - 60;
  } else {
    y -= 25;
  }

  const sigColWidth = contentWidth / 3;
  const sigTitles = [
    { title: 'Prepared By:', role: 'Finance Secretary' },
    { title: 'Certified By:', role: 'Church Treasurer' },
    { title: 'Approved By:', role: 'Senior Pastor / Elder' },
  ];

  sigTitles.forEach((sig, idx) => {
    const x = margin + idx * sigColWidth;
    page.drawLine({
      start: { x: x + 10, y: y + 10 },
      end: { x: x + sigColWidth - 20, y: y + 10 },
      thickness: 1,
      color: borderGray,
    });
    page.drawText(sig.title, {
      x: x + 10,
      y: y - 2,
      size: 8,
      font: fontRegular,
      color: rgb(0.45, 0.5, 0.6),
    });
    page.drawText(sig.role, {
      x: x + 10,
      y: y - 14,
      size: 8.5,
      font: fontBold,
      color: slateText,
    });
  });

  // Save and trigger download
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
