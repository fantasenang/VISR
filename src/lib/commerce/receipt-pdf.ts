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

// ISO A6 portrait: 105 × 148 mm.
const PAGE_WIDTH = 298;
const PAGE_HEIGHT = 420;
const LEFT = 22;
const RIGHT = PAGE_WIDTH - 22;
const CONTENT_WIDTH = RIGHT - LEFT;

function safePdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function formatRupiah(value: number) {
  return `Rp${Math.round(value).toLocaleString("id-ID")}`;
}

function formatPaidAt(value: string) {
  return `${new Intl.DateTimeFormat("en-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value))} WIB`;
}

function truncate(value: string, maximum: number) {
  return value.length <= maximum ? value : `${value.slice(0, maximum - 3)}...`;
}

export function buildPaymentReceiptPdf(receipt: PaymentReceipt) {
  const commands: string[] = [];

  const text = (
    x: number,
    y: number,
    size: number,
    value: string,
    font: "F1" | "F2" = "F1",
    gray = 0,
  ) => {
    commands.push(
      `${gray} g BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${safePdfText(value)}) Tj ET`,
    );
  };

  const line = (x1: number, y1: number, x2: number, y2: number, width = 0.5, gray = 0.84) => {
    commands.push(`${gray} G ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  };

  const roundedRect = (x: number, y: number, width: number, height: number, radius: number, fillGray: number, strokeGray?: number) => {
    const k = 0.5522848;
    const right = x + width;
    const top = y + height;
    commands.push(
      `${fillGray} g`,
      `${x + radius} ${y} m`,
      `${right - radius} ${y} l`,
      `${right - radius + radius * k} ${y} ${right} ${y + radius - radius * k} ${right} ${y + radius} c`,
      `${right} ${top - radius} l`,
      `${right} ${top - radius + radius * k} ${right - radius + radius * k} ${top} ${right - radius} ${top} c`,
      `${x + radius} ${top} l`,
      `${x + radius - radius * k} ${top} ${x} ${top - radius + radius * k} ${x} ${top - radius} c`,
      `${x} ${y + radius} l`,
      `${x} ${y + radius - radius * k} ${x + radius - radius * k} ${y} ${x + radius} ${y} c`,
      strokeGray === undefined ? "f" : `${strokeGray} G 0.6 w B`,
    );
  };

  // Vector VISR wordmark. Drawn as graphic paths instead of a text glyph.
  const drawVisrWordmark = (x: number, y: number, scale = 1) => {
    const w = 1.8 * scale;
    const h = 13 * scale;
    const gap = 4 * scale;
    const letter = 11 * scale;
    commands.push("1 G", `${w} w`, "1 J", "1 j");

    // V
    line(x, y + h, x + letter / 2, y, w, 1);
    line(x + letter / 2, y, x + letter, y + h, w, 1);
    x += letter + gap;
    // I
    line(x + letter / 2, y, x + letter / 2, y + h, w, 1);
    x += letter + gap;
    // S
    commands.push(
      `1 G ${w} w ${x + letter} ${y + h} m ${x + 2} ${y + h} l ${x} ${y + h - 2} l ${x} ${y + h / 2 + 1} l ${x + letter} ${y + h / 2 - 1} l ${x + letter} ${y + 2} l ${x + letter - 2} ${y} l ${x} ${y} l S`,
    );
    x += letter + gap;
    // R
    line(x, y, x, y + h, w, 1);
    line(x, y + h, x + letter - 2, y + h, w, 1);
    line(x + letter - 2, y + h, x + letter, y + h - 2, w, 1);
    line(x + letter, y + h - 2, x + letter, y + h / 2 + 2, w, 1);
    line(x + letter, y + h / 2 + 2, x + letter - 2, y + h / 2, w, 1);
    line(x + letter - 2, y + h / 2, x, y + h / 2, w, 1);
    line(x + letter / 2, y + h / 2, x + letter, y, w, 1);
  };

  commands.push(`0.965 g 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);

  // Header block.
  commands.push(`0 g 0 324 ${PAGE_WIDTH} 96 re f`);
  drawVisrWordmark(LEFT, 382, 1.05);
  text(LEFT, 354, 5.5, "PAYMENT RECEIPT", "F2", 0.58);
  text(LEFT, 337, 8, truncate(receipt.orderNumber, 40), "F2", 1);
  roundedRect(230, 382, 46, 18, 9, 1);
  text(243, 388, 6, "PAID", "F2", 0);

  // Hero amount.
  text(LEFT, 303, 5.5, "TOTAL PAID", "F2", 0.52);
  text(LEFT, 279, 22, formatRupiah(receipt.totalIdr), "F2", 0.02);
  text(LEFT, 263, 6, formatPaidAt(receipt.paidAt), "F1", 0.42);

  // Customer card.
  roundedRect(LEFT, 202, CONTENT_WIDTH, 47, 8, 1, 0.88);
  text(LEFT + 12, 234, 5.5, "CUSTOMER", "F2", 0.5);
  text(LEFT + 12, 220, 8, truncate(receipt.customerName, 36), "F2", 0.04);
  text(LEFT + 12, 208, 6, truncate(receipt.email || receipt.whatsapp, 50), "F1", 0.38);
  text(174, 220, 6, truncate(`${receipt.city}, ${receipt.province}`, 30), "F1", 0.25);
  text(174, 208, 6, receipt.postalCode, "F1", 0.5);

  // Items heading.
  text(LEFT, 185, 5.5, "ORDER DETAILS", "F2", 0.48);
  text(226, 185, 5.5, "AMOUNT", "F2", 0.48);
  line(LEFT, 179, RIGHT, 179, 0.6, 0.78);

  let y = 165;
  const visibleItems = receipt.items.slice(0, 5);
  for (const item of visibleItems) {
    const itemName = item.variant ? `${item.name} - ${item.variant}` : item.name;
    text(LEFT, y, 7, truncate(itemName, 34), "F2", 0.08);
    text(LEFT, y - 10, 5.5, `Quantity ${item.quantity}`, "F1", 0.5);
    text(226, y, 7, formatRupiah(item.lineTotalIdr), "F2", 0.08);
    y -= 26;
  }

  if (receipt.items.length > visibleItems.length) {
    text(LEFT, y + 4, 5.5, `+ ${receipt.items.length - visibleItems.length} more item(s)`, "F1", 0.5);
    y -= 12;
  }

  const totalsTop = Math.max(66, y + 3);
  line(LEFT, totalsTop, RIGHT, totalsTop, 0.6, 0.78);
  text(166, totalsTop - 15, 6, "Subtotal", "F1", 0.42);
  text(226, totalsTop - 15, 6, formatRupiah(receipt.subtotalIdr), "F1", 0.15);
  text(166, totalsTop - 28, 6, "Shipping", "F1", 0.42);
  text(226, totalsTop - 28, 6, formatRupiah(receipt.shippingCostIdr), "F1", 0.15);

  // Footer lockup.
  commands.push(`0 g 0 0 ${PAGE_WIDTH} 50 re f`);
  text(LEFT, 29, 8, "Thank you.", "F2", 1);
  text(LEFT, 16, 6.5, "Carry Your Build.", "F1", 0.7);
  text(190, 17, 5, "visr.works", "F2", 0.7);
  text(190, 8, 4.5, "Payment receipt - not a tax invoice", "F1", 0.52);

  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n%VISR\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}
