import "server-only";

import { createHash } from "node:crypto";
import { inflateSync } from "node:zlib";

const MAX_DIMENSION = 4096;
const MAX_INPUT_PIXELS = 16_000_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export type SanitizedPaymentProof = {
  bytes: Uint8Array;
  mimeType: "image/jpeg" | "image/png";
  fileName: string;
  width: number;
  height: number;
  sha256: string;
};

function safeBaseName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const cleaned = withoutExtension.replace(/[^A-Za-z0-9._ ()-]/g, "_").slice(0, 120).trim();
  return cleaned || "payment-proof";
}

function validateDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("IMAGE_DIMENSIONS_MISSING");
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_INPUT_PIXELS) {
    throw new Error("IMAGE_DIMENSION_LIMIT_EXCEEDED");
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return output;
}

function pngBitsPerPixel(colorType: number, bitDepth: number) {
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : colorType === 6 ? 4 : 0;
  if (!channels) throw new Error("PNG_COLOR_TYPE_UNSUPPORTED");
  const allowed = colorType === 0
    ? [1, 2, 4, 8, 16]
    : colorType === 3
      ? [1, 2, 4, 8]
      : [8, 16];
  if (!allowed.includes(bitDepth)) throw new Error("PNG_BIT_DEPTH_UNSUPPORTED");
  return channels * bitDepth;
}

function sanitizePng(input: Buffer) {
  if (!input.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("PNG_SIGNATURE_INVALID");
  let offset = 8;
  let ihdr: Buffer | null = null;
  let palette: Buffer | null = null;
  let transparency: Buffer | null = null;
  const idat: Buffer[] = [];
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let sawEnd = false;

  while (offset < input.length) {
    if (offset + 12 > input.length) throw new Error("PNG_CHUNK_TRUNCATED");
    const length = input.readUInt32BE(offset);
    if (length > MAX_OUTPUT_BYTES || offset + 12 + length > input.length) throw new Error("PNG_CHUNK_LENGTH_INVALID");
    const type = input.toString("ascii", offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = input.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(input.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc) throw new Error("PNG_CRC_INVALID");

    if (type === "IHDR") {
      if (ihdr || length !== 13 || offset !== 8) throw new Error("PNG_IHDR_INVALID");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      validateDimensions(width, height);
      pngBitsPerPixel(colorType, bitDepth);
      if (data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new Error("PNG_FORMAT_UNSUPPORTED");
      ihdr = Buffer.from(data);
    } else if (type === "PLTE") {
      if (!ihdr || idat.length > 0 || length < 3 || length > 768 || length % 3 !== 0) throw new Error("PNG_PALETTE_INVALID");
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      if (!ihdr || idat.length > 0) throw new Error("PNG_TRANSPARENCY_INVALID");
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      if (!ihdr || sawEnd) throw new Error("PNG_IDAT_INVALID");
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      if (length !== 0 || !ihdr || idat.length === 0) throw new Error("PNG_IEND_INVALID");
      sawEnd = true;
      offset += 12;
      break;
    } else if ((type.charCodeAt(0) & 0x20) === 0) {
      throw new Error("PNG_UNKNOWN_CRITICAL_CHUNK");
    }
    offset += 12 + length;
  }

  if (!sawEnd || offset !== input.length || !ihdr || idat.length === 0) throw new Error("PNG_STRUCTURE_INVALID");
  if (colorType === 3 && !palette) throw new Error("PNG_PALETTE_REQUIRED");

  const rowBytes = Math.ceil((width * pngBitsPerPixel(colorType, bitDepth)) / 8);
  const expectedDecodedBytes = height * (rowBytes + 1);
  const inflated = inflateSync(Buffer.concat(idat), { maxOutputLength: expectedDecodedBytes + 1 });
  if (inflated.length !== expectedDecodedBytes) throw new Error("PNG_DECODED_SIZE_INVALID");
  for (let row = 0; row < height; row += 1) {
    if (inflated[row * (rowBytes + 1)] > 4) throw new Error("PNG_FILTER_INVALID");
  }

  const cleanParts = [PNG_SIGNATURE, pngChunk("IHDR", ihdr)];
  if (palette) cleanParts.push(pngChunk("PLTE", palette));
  if (transparency) cleanParts.push(pngChunk("tRNS", transparency));
  cleanParts.push(pngChunk("IDAT", Buffer.concat(idat)), pngChunk("IEND", Buffer.alloc(0)));
  return { bytes: Buffer.concat(cleanParts), width, height, mimeType: "image/png" as const, extension: "png" };
}

function sanitizeJpeg(input: Buffer) {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== 0xd8) throw new Error("JPEG_SIGNATURE_INVALID");
  const output: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let offset = 2;
  let width = 0;
  let height = 0;
  let sawScan = false;
  let sawEnd = false;

  while (offset < input.length) {
    if (input[offset] !== 0xff) throw new Error("JPEG_MARKER_INVALID");
    while (offset < input.length && input[offset] === 0xff) offset += 1;
    if (offset >= input.length) throw new Error("JPEG_MARKER_TRUNCATED");
    const marker = input[offset];
    offset += 1;

    if (marker === 0xd9) {
      output.push(Buffer.from([0xff, 0xd9]));
      sawEnd = true;
      break;
    }
    if (marker === 0x00) throw new Error("JPEG_STUFFED_BYTE_OUTSIDE_SCAN");
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      output.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (offset + 2 > input.length) throw new Error("JPEG_SEGMENT_TRUNCATED");
    const length = input.readUInt16BE(offset);
    if (length < 2 || offset + length > input.length) throw new Error("JPEG_SEGMENT_LENGTH_INVALID");
    const segment = input.subarray(offset - 2, offset + length);

    if (JPEG_SOF_MARKERS.has(marker)) {
      if (length < 8) throw new Error("JPEG_SOF_INVALID");
      height = input.readUInt16BE(offset + 3);
      width = input.readUInt16BE(offset + 5);
      validateDimensions(width, height);
    }

    const stripMetadata = (marker >= 0xe0 && marker <= 0xef) || marker === 0xfe;
    if (!stripMetadata) output.push(Buffer.from(segment));
    offset += length;

    if (marker === 0xda) {
      sawScan = true;
      const scanStart = offset;
      let scanOffset = offset;
      while (scanOffset < input.length) {
        if (input[scanOffset] !== 0xff) {
          scanOffset += 1;
          continue;
        }
        let next = scanOffset + 1;
        while (next < input.length && input[next] === 0xff) next += 1;
        if (next >= input.length) throw new Error("JPEG_SCAN_TRUNCATED");
        const code = input[next];
        if (code === 0x00 || (code >= 0xd0 && code <= 0xd7)) {
          scanOffset = next + 1;
          continue;
        }
        output.push(Buffer.from(input.subarray(scanStart, scanOffset)));
        offset = scanOffset;
        break;
      }
      if (scanOffset >= input.length) throw new Error("JPEG_EOI_MISSING");
    }
  }

  if (!sawScan || !sawEnd || !width || !height || offset !== input.length) throw new Error("JPEG_STRUCTURE_INVALID");
  return { bytes: Buffer.concat(output), width, height, mimeType: "image/jpeg" as const, extension: "jpg" };
}

export async function sanitizePaymentProofImage(
  input: Uint8Array,
  originalName: string,
): Promise<SanitizedPaymentProof> {
  const bytes = Buffer.from(input);
  const sanitized = bytes.subarray(0, 8).equals(PNG_SIGNATURE) ? sanitizePng(bytes) : sanitizeJpeg(bytes);
  if (sanitized.bytes.length < 1 || sanitized.bytes.length > MAX_OUTPUT_BYTES) throw new Error("SANITIZED_IMAGE_SIZE_INVALID");
  const output = new Uint8Array(sanitized.bytes);
  return {
    bytes: output,
    mimeType: sanitized.mimeType,
    fileName: `${safeBaseName(originalName)}.${sanitized.extension}`,
    width: sanitized.width,
    height: sanitized.height,
    sha256: createHash("sha256").update(output).digest("hex"),
  };
}
