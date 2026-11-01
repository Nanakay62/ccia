/**
 * Offline CSV Export Utility.
 * RFC 4180 compliant CSV generator with UTF-8 BOM for Microsoft Excel compatibility.
 */

export function generateCsv(
  headers: string[],
  rows: (string | number | bigint)[][]
): string {
  const escapeCell = (cell: string | number | bigint): string => {
    const str = String(cell ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((row) => row.map(escapeCell).join(','));

  // Prepend UTF-8 BOM (\uFEFF) so Excel on Windows properly detects UTF-8 characters
  return '\uFEFF' + [headerLine, ...rowLines].join('\r\n');
}

/**
 * Initiates an instant browser download of a CSV file offline.
 */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
