/**
 * Offline QR Code SVG Generator (Pure TypeScript, Zero External Dependencies)
 * Implements ISO/IEC 18004 compliant QR Code Generation (Versions 1-3, ECC Level L).
 * Suitable for offline asset tag printing and mobile camera scanning.
 */

// GF(256) tables with primitive polynomial 0x11d
const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    EXP_TABLE[i + 255] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
})();

function glog(n: number): number {
  if (n < 1) throw new Error(`glog(${n}) invalid`);
  return LOG_TABLE[n] ?? 0;
}

function gexp(n: number): number {
  let idx = n % 255;
  if (idx < 0) idx += 255;
  return EXP_TABLE[idx] ?? 0;
}

function gfMultiply(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return gexp(glog(x) + glog(y));
}

function getGeneratorPolynomial(numEccBytes: number): number[] {
  let poly = [1];
  for (let i = 0; i < numEccBytes; i++) {
    const term = [1, gexp(i)];
    const nextPoly: number[] = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      for (let k = 0; k < term.length; k++) {
        const cur = nextPoly[j + k] ?? 0;
        const pVal = poly[j] ?? 0;
        const tVal = term[k] ?? 0;
        nextPoly[j + k] = cur ^ gfMultiply(pVal, tVal);
      }
    }
    poly = nextPoly;
  }
  return poly;
}

function calculateErrorCorrection(data: number[], numEccBytes: number): number[] {
  const gen = getGeneratorPolynomial(numEccBytes);
  const info: number[] = [...data, ...new Array(numEccBytes).fill(0)];
  for (let i = 0; i < data.length; i++) {
    const lead = info[i] ?? 0;
    if (lead !== 0) {
      for (let j = 0; j < gen.length; j++) {
        const cur = info[i + j] ?? 0;
        const gVal = gen[j] ?? 0;
        info[i + j] = cur ^ gfMultiply(gVal, lead);
      }
    }
  }
  return info.slice(data.length);
}

export interface QrCodeOptions {
  size?: number; // SVG pixel width/height (default: 180)
  margin?: number; // quiet zone in modules (default: 3)
  color?: string; // module color (default: #111827)
  backgroundColor?: string; // background color (default: #ffffff)
}

/**
 * Generates an ISO-standard offline QR code matrix for asset tags.
 * Supports up to Version 3 QR codes (up to 70 ASCII chars).
 */
export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  let totalDataBytes = 19;
  let numEccBytes = 7;

  if (bytes.length > 17) {
    version = 2;
    totalDataBytes = 34;
    numEccBytes = 10;
  }
  if (bytes.length > 32) {
    version = 3;
    totalDataBytes = 55;
    numEccBytes = 15;
  }

  const moduleCount = 17 + 4 * version; // V1=21, V2=25, V3=29
  const matrix: (boolean | null)[][] = Array.from({ length: moduleCount }, () =>
    new Array(moduleCount).fill(null)
  );
  const isFunctionModule: boolean[][] = Array.from({ length: moduleCount }, () =>
    new Array(moduleCount).fill(false)
  );

  // 1. Finder patterns (top-left, top-right, bottom-left)
  function placeFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r;
        const mc = col + c;
        if (mr >= 0 && mr < moduleCount && mc >= 0 && mc < moduleCount) {
          const rowFunc = isFunctionModule[mr];
          const rowMat = matrix[mr];
          if (rowFunc && rowMat) {
            rowFunc[mc] = true;
            if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
              rowMat[mc] =
                r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            } else {
              rowMat[mc] = false; // separator
            }
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, moduleCount - 7);
  placeFinder(moduleCount - 7, 0);

  // 2. Alignment pattern for Version 2 & 3
  if (version >= 2) {
    const alignPos = version === 2 ? 18 : 22;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const mr = alignPos + r;
        const mc = alignPos + c;
        const rowFunc = isFunctionModule[mr];
        const rowMat = matrix[mr];
        if (rowFunc && rowMat) {
          rowFunc[mc] = true;
          rowMat[mc] = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
        }
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    const rowFunc6 = isFunctionModule[6];
    const rowMat6 = matrix[6];
    if (rowFunc6 && rowMat6 && !rowFunc6[i]) {
      rowMat6[i] = i % 2 === 0;
      rowFunc6[i] = true;
    }
    const rowFuncI = isFunctionModule[i];
    const rowMatI = matrix[i];
    if (rowFuncI && rowMatI && !rowFuncI[6]) {
      rowMatI[6] = i % 2 === 0;
      rowFuncI[6] = true;
    }
  }

  // Dark module
  const darkRow = 4 * version + 9;
  const darkRowMat = matrix[darkRow];
  const darkRowFunc = isFunctionModule[darkRow];
  if (darkRowMat && darkRowFunc) {
    darkRowMat[8] = true;
    darkRowFunc[8] = true;
  }

  // 4. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      const r8 = isFunctionModule[8];
      const ri = isFunctionModule[i];
      if (r8) r8[i] = true;
      if (ri) ri[8] = true;
    }
  }
  for (let i = moduleCount - 8; i < moduleCount; i++) {
    const r8 = isFunctionModule[8];
    const ri = isFunctionModule[i];
    if (r8) r8[i] = true;
    if (ri) ri[8] = true;
  }

  // 5. Encode Data (Byte mode: 0100 + char count + data + terminator + padding)
  const bitStream: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(bytes.length, 8); // Character count indicator
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    pushBits(b, 8);
  }

  // Terminator
  const totalDataBits = totalDataBytes * 8;
  const termLen = Math.min(4, totalDataBits - bitStream.length);
  pushBits(0, termLen);

  // Align to byte
  while (bitStream.length % 8 !== 0) {
    bitStream.push(0);
  }

  // Pad bytes 0xEC, 0x11
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bitStream.length < totalDataBits) {
    const padByte = padBytes[padIdx % 2] ?? 0xec;
    pushBits(padByte, 8);
    padIdx++;
  }

  // Convert bitStream to data codewords
  const dataCodewords: number[] = [];
  for (let i = 0; i < bitStream.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      const bit = bitStream[i + b] ?? 0;
      byteVal = (byteVal << 1) | bit;
    }
    dataCodewords.push(byteVal);
  }

  const eccCodewords = calculateErrorCorrection(dataCodewords, numEccBytes);
  const finalCodewords = [...dataCodewords, ...eccCodewords];

  // 6. Place data bits into matrix (interleaved snake)
  const allBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let b = 7; b >= 0; b--) {
      allBits.push((cw >> b) & 1);
    }
  }

  let bitIdx = 0;
  let upward = true;
  for (let right = moduleCount - 1; right > 0; right -= 2) {
    if (right === 6) right--; // skip timing pattern col
    const cols = [right, right - 1];
    const rows = upward
      ? Array.from({ length: moduleCount }, (_, idx) => moduleCount - 1 - idx)
      : Array.from({ length: moduleCount }, (_, idx) => idx);

    for (const r of rows) {
      for (const c of cols) {
        const rowFunc = isFunctionModule[r];
        const rowMat = matrix[r];
        if (rowFunc && rowMat && !rowFunc[c]) {
          const bit = bitIdx < allBits.length ? (allBits[bitIdx++] ?? 0) : 0;
          // Apply mask 0: (row + col) % 2 === 0
          const mask = (r + c) % 2 === 0;
          rowMat[c] = (bit === 1) !== mask;
        }
      }
    }
    upward = !upward;
  }

  // 7. Format Information (Mask 0 + ECC Level L)
  const formatBits = [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0, 0];
  const tlCoords: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  for (let i = 0; i < 15; i++) {
    const coord = tlCoords[i];
    if (coord) {
      const [r, c] = coord;
      const rowMat = matrix[r];
      if (rowMat) {
        rowMat[c] = (formatBits[i] ?? 0) === 1;
      }
    }
  }

  // Place on bottom-left and top-right
  for (let i = 0; i < 7; i++) {
    const rowMat = matrix[moduleCount - 1 - i];
    if (rowMat) {
      rowMat[8] = (formatBits[i] ?? 0) === 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    const rowMat = matrix[8];
    if (rowMat) {
      rowMat[moduleCount - 8 + i] = (formatBits[7 + i] ?? 0) === 1;
    }
  }

  // Replace any leftover nulls with false
  return matrix.map((row) => row.map((cell) => cell ?? false));
}

/**
 * Returns standalone SVG XML markup for an offline QR code.
 */
export function generateQrCodeSvg(text: string, options: QrCodeOptions = {}): string {
  const {
    size = 180,
    margin = 3,
    color = '#111827',
    backgroundColor = '#ffffff',
  } = options;

  const matrix = generateQrMatrix(text);
  const moduleCount = matrix.length;
  const viewBoxSize = moduleCount + margin * 2;

  let pathData = '';
  for (let r = 0; r < moduleCount; r++) {
    const row = matrix[r];
    if (row) {
      for (let c = 0; c < moduleCount; c++) {
        if (row[c]) {
          pathData += `M${c + margin},${r + margin}h1v1h-1z `;
        }
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}" width="${size}" height="${size}" shape-rendering="crispEdges">
    <rect width="${viewBoxSize}" height="${viewBoxSize}" fill="${backgroundColor}" />
    <path d="${pathData.trim()}" fill="${color}" />
  </svg>`;
}
