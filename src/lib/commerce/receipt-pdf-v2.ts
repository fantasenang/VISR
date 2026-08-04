import { Buffer } from "node:buffer";

export type ReceiptItem = {
  name: string;
  variant: string | null;
  quantity: number;
  lineTotalIdr: number;
};

export type PaymentReceipt = {
  orderNumber: string;
  customerName: string;
  email: string;
  whatsapp: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  subtotalIdr: number;
  shippingCostIdr: number;
  totalIdr: number;
  paidAt: string;
  items: ReceiptItem[];
};

const PAGE_WIDTH = 298;
const PAGE_HEIGHT = 420;
const LEFT = 22;
const RIGHT = PAGE_WIDTH - 22;

// Cropped directly from the official VISR artwork supplied by the brand owner.
const VISR_LOGO_JPEG_BASE64 = "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";

function safePdfText(value: string) {
  return value.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function rupiah(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

function paidAt(value: string) {
  return `${new Intl.DateTimeFormat("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value))} WIB`;
}

function short(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 3)}...`;
}

export function buildPaymentReceiptPdf(receipt: PaymentReceipt) {
  const commands: string[] = [];
  const logo = Buffer.from(VISR_LOGO_JPEG_BASE64, "base64");

  const text = (x: number, y: number, size: number, value: string, font: "F1" | "F2" = "F1", gray = 0) => {
    commands.push(`${gray} g BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safePdfText(value)}) Tj ET`);
  };
  const line = (y: number, gray = 0.82, width = 0.5) => commands.push(`${gray} G ${width} w ${LEFT} ${y} m ${RIGHT} ${y} l S`);
  const rect = (x: number, y: number, w: number, h: number, gray: number) => commands.push(`${gray} g ${x} ${y} ${w} ${h} re f`);

  rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 0.965);
  rect(0, 326, PAGE_WIDTH, 94, 0);

  // Official logo artwork, embedded as an image XObject.
  commands.push("q 118 0 0 30 22 374 cm /Im1 Do Q");
  text(LEFT, 348, 5.5, "PAYMENT RECEIPT", "F2", 0.62);
  text(LEFT, 334, 8, short(receipt.orderNumber, 40), "F2", 1);
  rect(232, 382, 44, 17, 1);
  text(245, 388, 6, "PAID", "F2", 0);

  text(LEFT, 304, 5.5, "TOTAL PAID", "F2", 0.5);
  text(LEFT, 279, 22, rupiah(receipt.totalIdr), "F2", 0.02);
  text(LEFT, 263, 6, paidAt(receipt.paidAt), "F1", 0.42);

  rect(LEFT, 204, RIGHT - LEFT, 45, 1);
  text(34, 235, 5.5, "CUSTOMER", "F2", 0.5);
  text(34, 220, 8, short(receipt.customerName, 36), "F2", 0.04);
  text(34, 208, 6, short(receipt.email || receipt.whatsapp, 44), "F1", 0.38);
  text(174, 220, 6, short(`${receipt.city}, ${receipt.province}`, 28), "F1", 0.25);
  text(174, 208, 6, receipt.postalCode, "F1", 0.5);

  text(LEFT, 185, 5.5, "ORDER DETAILS", "F2", 0.48);
  text(226, 185, 5.5, "AMOUNT", "F2", 0.48);
  line(179, 0.76, 0.6);

  let y = 165;
  for (const item of receipt.items.slice(0, 5)) {
    const name = item.variant ? `${item.name} - ${item.variant}` : item.name;
    text(LEFT, y, 7, short(name, 34), "F2", 0.08);
    text(LEFT, y - 10, 5.5, `Quantity ${item.quantity}`, "F1", 0.5);
    text(226, y, 7, rupiah(item.lineTotalIdr), "F2", 0.08);
    y -= 26;
  }

  const totalsY = Math.max(72, y + 5);
  line(totalsY, 0.76, 0.6);
  text(166, totalsY - 15, 6, "Subtotal", "F1", 0.42);
  text(226, totalsY - 15, 6, rupiah(receipt.subtotalIdr), "F1", 0.15);
  text(166, totalsY - 28, 6, "Shipping", "F1", 0.42);
  text(226, totalsY - 28, 6, rupiah(receipt.shippingCostIdr), "F1", 0.15);

  rect(0, 0, PAGE_WIDTH, 50, 0);
  text(LEFT, 29, 8, "Thank you.", "F2", 1);
  text(LEFT, 16, 6.5, "Carry Your Build.", "F1", 0.7);
  text(190, 17, 5, "visr.works", "F2", 0.7);
  text(190, 8, 4.5, "Payment receipt - not a tax invoice", "F1", 0.52);

  const stream = commands.join("\n");
  const objects: Array<string | Buffer> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> /XObject << /Im1 7 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width 320 /Height 81 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`, "latin1"),
      logo,
      Buffer.from("\nendstream", "latin1"),
    ]),
  ];

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%VISR\n", "latin1")];
  const offsets = [0];
  let length = parts[0].length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const head = Buffer.from(`${index + 1} 0 obj\n`, "latin1");
    const body = Buffer.isBuffer(object) ? object : Buffer.from(object, "latin1");
    const tail = Buffer.from("\nendobj\n", "latin1");
    parts.push(head, body, tail);
    length += head.length + body.length + tail.length;
  });

  const xrefOffset = length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  parts.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(parts);
}
