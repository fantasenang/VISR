import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

const MAX_DIMENSION = 4096;
const MAX_INPUT_PIXELS = 16_000_000;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;

export type SanitizedPaymentProof = {
  bytes: Uint8Array;
  mimeType: "image/jpeg";
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

async function encode(input: Uint8Array, quality: number, maxDimension: number) {
  return sharp(Buffer.from(input), {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true, chromaSubsampling: "4:2:0" })
    .toBuffer({ resolveWithObject: true });
}

export async function sanitizePaymentProofImage(
  input: Uint8Array,
  originalName: string,
): Promise<SanitizedPaymentProof> {
  const metadata = await sharp(Buffer.from(input), {
    failOn: "error",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  }).metadata();

  if (!metadata.width || !metadata.height) throw new Error("IMAGE_DIMENSIONS_MISSING");
  if ((metadata.pages ?? 1) !== 1) throw new Error("ANIMATED_IMAGE_NOT_ALLOWED");
  if (metadata.width * metadata.height > MAX_INPUT_PIXELS) throw new Error("IMAGE_PIXEL_LIMIT_EXCEEDED");

  let output = await encode(input, 88, MAX_DIMENSION);
  if (output.data.byteLength > MAX_OUTPUT_BYTES) output = await encode(input, 78, 3000);
  if (output.data.byteLength > MAX_OUTPUT_BYTES) output = await encode(input, 68, 2200);
  if (output.data.byteLength > MAX_OUTPUT_BYTES) throw new Error("SANITIZED_IMAGE_TOO_LARGE");

  const bytes = new Uint8Array(output.data);
  return {
    bytes,
    mimeType: "image/jpeg",
    fileName: `${safeBaseName(originalName)}.jpg`,
    width: output.info.width,
    height: output.info.height,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
