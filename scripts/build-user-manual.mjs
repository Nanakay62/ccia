/**
 * Build script to generate official Word (.doc) and PDF user manual documents.
 * Run via: node scripts/build-user-manual.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const docsPublicDir = path.join(rootDir, 'apps', 'web', 'public', 'docs');
const docsRootDir = path.join(rootDir, 'docs');

// Ensure directories exist
fs.mkdirSync(docsPublicDir, { recursive: true });
fs.mkdirSync(docsRootDir, { recursive: true });

const churchName = 'ACCRA CENTRAL GRACE CHAPEL';
const branchName = 'Accra Central Branch';
const address = 'Plot 14, Independence Avenue, Ridge, Accra, Ghana';
const phone = '+233 (0) 30 223 4567';
const email = 'finance@accragracechapel.org';
const tin = 'TIN: C0004928172';
const charityReg = 'Charity Reg: DSW/7821';

// Read content from userManualData.ts
const dataPath = path.join(rootDir, 'apps', 'web', 'src', 'utils', 'exports', 'userManualData.ts');
const dataContent = fs.readFileSync(dataPath, 'utf-8');

// Parse chapters via regex
const chapterRegex = /{\s*id:\s*'([^']+)',\s*number:\s*'([^']+)',\s*title:\s*'([^']+)',\s*contentHtml:\s*`([\s\S]*?)`,\s*}/g;

const chapters = [];
let match;
while ((match = chapterRegex.exec(dataContent)) !== null) {
  chapters.push({
    id: match[1],
    number: match[2],
    title: match[3],
    contentHtml: match[4],
  });
}

console.log(`Parsed ${chapters.length} user manual chapters from userManualData.ts.`);

const currentDate = new Date().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

// Compile HTML
let sectionsHtml = '';
let tocHtml = '';

for (const sec of chapters) {
  tocHtml += `<li style="margin-bottom: 6px;"><a href="#sec-${sec.id}" style="color: #1e4620; text-decoration: none; font-weight: bold;">Chapter ${sec.number}: ${sec.title}</a></li>`;
  sectionsHtml += `
    <div id="sec-${sec.id}" style="margin-top: 32px; padding-top: 20px; border-top: 2px solid #e2e8f0; page-break-before: always;">
      <div style="font-size: 11pt; color: #1e4620; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Chapter ${sec.number}</div>
      <h2 style="font-family: Georgia, 'Times New Roman', serif; font-size: 18pt; color: #0f172a; margin-top: 4px; margin-bottom: 16px;">
        ${sec.title}
      </h2>
      <div style="font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.6; color: #334155;">
        ${sec.contentHtml}
      </div>
    </div>
  `;
}

const fullHtml = `<!DOCTYPE html>
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
      ${churchName}
    </div>
    <div style="font-size: 13pt; color: #475569; font-weight: 600; margin-top: 4px;">
      ${branchName} • National Headquarters Secretariat
    </div>
    <div style="font-size: 9.5pt; color: #64748b; margin-top: 4px;">
      ${address} • Tel: ${phone} • Email: ${email}
    </div>
    <div style="font-size: 9pt; color: #996515; font-weight: bold; margin-top: 4px;">
      ${tin} • ${charityReg}
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
      Standard Operating Procedures, Internal Financial Controls & Platform User Guide
    </div>
    <div style="font-size: 10pt; color: #64748b; margin-top: 14px;">
      Version 2.0 • Dual-Currency Edition (GHS / USD) • Published ${currentDate}
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div style="margin: 28px 0; padding: 18px 24px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px;">
    <h3 style="margin-top: 0; font-family: Georgia, serif; font-size: 14pt; color: #1e4620; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
      Table of Contents
    </h3>
    <ol style="margin-top: 10px; padding-left: 20px; font-size: 10.5pt; line-height: 1.8;">
      ${tocHtml}
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

// 1. Write HTML file
const htmlPath = path.join(docsPublicDir, 'CCIA_Church_Accounting_Platform_User_Manual.html');
fs.writeFileSync(htmlPath, fullHtml, 'utf-8');
console.log(`Saved HTML manual to ${htmlPath}`);

// 2. Write Word document (.doc) with UTF-8 BOM
const docPath = path.join(docsPublicDir, 'CCIA_Church_Accounting_Platform_User_Manual.doc');
fs.writeFileSync(docPath, '\ufeff' + fullHtml, 'utf-8');
console.log(`Saved Word document manual to ${docPath}`);

// Copy to root docs
fs.copyFileSync(htmlPath, path.join(docsRootDir, 'CCIA_Church_Accounting_Platform_User_Manual.html'));
fs.copyFileSync(docPath, path.join(docsRootDir, 'CCIA_Church_Accounting_Platform_User_Manual.doc'));

// 3. Render PDF via Microsoft Edge headless
const pdfPath = path.join(docsPublicDir, 'CCIA_Church_Accounting_Platform_User_Manual.pdf');
const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
];
let edgeBin = edgePaths.find((p) => fs.existsSync(p));

if (edgeBin) {
  try {
    const cmd = `"${edgeBin}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`Successfully generated PDF manual via headless Edge at ${pdfPath}`);
    fs.copyFileSync(pdfPath, path.join(docsRootDir, 'CCIA_Church_Accounting_Platform_User_Manual.pdf'));
  } catch (err) {
    console.warn('Could not compile PDF via headless Edge:', err.message);
  }
} else {
  console.log('msedge executable not found in default paths, skipped PDF compile');
}
