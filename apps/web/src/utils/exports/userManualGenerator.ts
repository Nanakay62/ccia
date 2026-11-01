/**
 * Comprehensive Platform User Manual Generator for CCIA Church Accounting Software.
 * Generates official Microsoft Word (.doc) and printable HTML/PDF representations
 * covering all modules, workflows, accounting rules, and security controls.
 */

import { defaultChurchSettings } from '../../config/churchSettings.js';
import { USER_MANUAL_CHAPTERS, type UserManualChapter } from './userManualData.js';

export { USER_MANUAL_CHAPTERS, type UserManualChapter };

/**
 * Generates the complete HTML string for the User Manual (suitable for Word export or PDF printing).
 */
export const generateUserManualHtml = (isDemo = false): string => {
  const currentDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const tableOfContentsHtml = USER_MANUAL_CHAPTERS.map(
    (sec) =>
      `<li style="margin-bottom: 6px;"><a href="#sec-${sec.id}" style="color: #1e4620; text-decoration: none; font-weight: bold;">Chapter ${sec.number}: ${sec.title}</a></li>`
  ).join('');

  const sectionsHtml = USER_MANUAL_CHAPTERS.map(
    (sec) => `
    <div id="sec-${sec.id}" style="margin-top: 28px; padding-top: 18px; border-top: 2px solid #e2e8f0; page-break-before: always;">
      <div style="font-size: 11pt; color: #1e4620; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Chapter ${sec.number}</div>
      <h2 style="font-family: Georgia, 'Times New Roman', serif; font-size: 18pt; color: #0f172a; margin-top: 4px; margin-bottom: 16px;">
        ${sec.title}
      </h2>
      <div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #334155;">
        ${sec.contentHtml}
      </div>
    </div>
  `
  ).join('');

  return `<!DOCTYPE html>
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset="utf-8">
  <title>CCIA Church Accounting Software — Platform User Manual</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 portrait;
      margin: 20mm 20mm 20mm 20mm;
      mso-header-margin: 10mm;
      mso-footer-margin: 10mm;
    }
    body {
      font-family: Calibri, 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    h1, h2, h3 {
      font-family: Georgia, 'Times New Roman', serif;
      color: #0f172a;
    }
    h3 {
      font-size: 13pt;
      margin-top: 18px;
      margin-bottom: 6px;
      color: #1e4620;
    }
    p {
      margin-top: 6px;
      margin-bottom: 10px;
    }
    ul, ol {
      margin-top: 6px;
      margin-bottom: 12px;
      padding-left: 24px;
    }
    li {
      margin-bottom: 4px;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      background-color: #f1f5f9;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 10pt;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <!-- COVER LETTERHEAD -->
  <div style="border-bottom: 3px double #1e4620; padding-bottom: 16px; margin-bottom: 24px; text-align: center;">
    <div style="font-size: 26pt; font-family: Georgia, 'Times New Roman', serif; font-weight: bold; color: #1e4620; letter-spacing: -0.5px;">
      ${defaultChurchSettings.churchName.toUpperCase()}
    </div>
    <div style="font-size: 13pt; color: #475569; font-weight: 600; margin-top: 4px;">
      ${defaultChurchSettings.branchName} • National Headquarters Secretariat
    </div>
    <div style="font-size: 9.5pt; color: #64748b; margin-top: 4px;">
      ${defaultChurchSettings.address} • Tel: ${defaultChurchSettings.phone} • Email: ${defaultChurchSettings.email}
    </div>
    <div style="font-size: 9pt; color: #996515; font-weight: bold; margin-top: 4px;">
      ${defaultChurchSettings.taxRegNumber}
    </div>
  </div>

  <!-- TITLE BLOCK -->
  <div style="text-align: center; margin: 36px 0 28px 0; padding: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
    <div style="font-size: 12pt; font-weight: bold; color: #996515; text-transform: uppercase; letter-spacing: 2px;">
      Official Operations & Accounting Manual
    </div>
    <h1 style="font-size: 24pt; margin: 10px 0 6px 0; color: #0f172a; font-family: Georgia, serif;">
      Church Accounting Platform (CCIA)
    </h1>
    <div style="font-size: 13pt; color: #475569; font-weight: 500;">
      Standard Operating Procedures, Internal Financial Controls & User Guide
    </div>
    <div style="font-size: 10pt; color: #64748b; margin-top: 14px;">
      Version 2.0 • Dual-Currency Edition (GHS / USD) • Published ${currentDate}
    </div>
    ${
      isDemo
        ? `<div style="display: inline-block; margin-top: 10px; padding: 4px 12px; background-color: #fef3c7; color: #92400e; font-size: 10pt; font-weight: bold; border-radius: 4px; border: 1px solid #fde68a;">DEMO & TRAINING COPY</div>`
        : ''
    }
  </div>

  <!-- TABLE OF CONTENTS -->
  <div style="margin: 28px 0; padding: 18px 24px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;">
    <h3 style="margin-top: 0; font-family: Georgia, serif; font-size: 14pt; color: #1e4620; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
      Table of Contents
    </h3>
    <ol style="margin-top: 10px; padding-left: 20px; font-size: 10.5pt; line-height: 1.8;">
      ${tableOfContentsHtml}
    </ol>
  </div>

  <!-- CONTENT CHAPTERS -->
  ${sectionsHtml}

  <!-- SIGN-OFF APPROVAL BLOCK -->
  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #1e4620; page-break-inside: avoid;">
    <div style="font-size: 11pt; font-weight: bold; color: #1e4620; margin-bottom: 12px; text-transform: uppercase;">
      Official Executive Sign-Off & Administrative Adoption
    </div>
    <table style="width: 100%; border-collapse: collapse; border: none;">
      <tr>
        <td style="width: 50%; border: none; padding-right: 20px; vertical-align: top;">
          <div style="font-weight: bold; font-size: 10pt; color: #0f172a;">Prepared & Certified By:</div>
          <div style="height: 48px; border-bottom: 1px solid #475569; margin: 8px 0;"></div>
          <div style="font-weight: bold; font-size: 10pt;">Elder Kofi Asante</div>
          <div style="font-size: 9.5pt; color: #64748b;">Church Treasurer & Head of Finance</div>
          <div style="font-size: 9pt; color: #64748b;">Date: ${currentDate}</div>
        </td>
        <td style="width: 50%; border: none; padding-left: 20px; vertical-align: top;">
          <div style="font-weight: bold; font-size: 10pt; color: #0f172a;">Approved by Church Council:</div>
          <div style="height: 48px; border-bottom: 1px solid #475569; margin: 8px 0;"></div>
          <div style="font-weight: bold; font-size: 10pt;">Rev. Dr. Emmanuel Mensah</div>
          <div style="font-size: 9.5pt; color: #64748b;">Senior Pastor / Presiding Elder</div>
          <div style="font-size: 9pt; color: #64748b;">Date: ${currentDate}</div>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
};

/**
 * Triggers an immediate browser download of the User Manual as a Microsoft Word document (.doc).
 */
export const downloadUserManualWord = (isDemo = false): void => {
  const htmlContent = generateUserManualHtml(isDemo);
  const blob = new Blob(['\ufeff', htmlContent], {
    type: 'application/msword;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `CCIA_Church_Accounting_Platform_User_Manual_${new Date().toISOString().slice(0, 10)}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Opens a dedicated print window with the User Manual for instant saving to PDF via browser print.
 */
export const printUserManualPdf = (isDemo = false): void => {
  const htmlContent = generateUserManualHtml(isDemo);
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to open the printable PDF User Manual window.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
};
