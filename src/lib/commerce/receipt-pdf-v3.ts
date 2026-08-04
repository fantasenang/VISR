import { Buffer } from "node:buffer";

export type ReceiptItem = { name: string; variant: string | null; quantity: number; lineTotalIdr: number };
export type PaymentReceipt = { orderNumber: string; customerName: string; email: string; whatsapp: string; address: string; city: string; province: string; postalCode: string; subtotalIdr: number; shippingCostIdr: number; totalIdr: number; paidAt: string; items: ReceiptItem[] };

const PAGE_WIDTH = 298;
const PAGE_HEIGHT = 420;
const LEFT = 22;
const RIGHT = PAGE_WIDTH - 22;
const LOGO_BASE64 = "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[... ELLIPSIZATION ...]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";

function safe(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2010-\u2015]/g, "-").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[^\x20-\x7E]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"); }
function rupiah(value: number) { return `Rp${Math.round(value).toLocaleString("id-ID")}`; }
function paidAt(value: string) { return `${new Intl.DateTimeFormat("en-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value))} WIB`; }
function short(value: string, max: number) { return value.length <= max ? value : `${value.slice(0, max - 3)}...`; }

export function buildPaymentReceiptPdf(receipt: PaymentReceipt) {
  const commands: string[] = [];
  const logo = Buffer.from(LOGO_BASE64, "base64");
  const text = (x: number, y: number, size: number, value: string, font: "F1" | "F2" = "F1", gray = 0) => commands.push(`${gray} g BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safe(value)}) Tj ET`);
  const line = (y: number, gray = 0.82, width = 0.5) => commands.push(`${gray} G ${width} w ${LEFT} ${y} m ${RIGHT} ${y} l S`);
  const rect = (x: number, y: number, w: number, h: number, gray: number) => commands.push(`${gray} g ${x} ${y} ${w} ${h} re f`);

  rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, 0.965);
  rect(0, 326, PAGE_WIDTH, 94, 0);
  commands.push("q 132 0 0 34 18 373 cm /Im1 Do Q");
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
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width 480 /Height 126 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`, "latin1"),
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
