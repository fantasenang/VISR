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

  const line = (
    y: number,
    width = 0.5,
    gray = 0.82,
  ) => commands.push(`${gray} G ${width} w ${LEFT} ${y} m ${RIGHT} ${y} l S`);

  commands.push(`1 1 1 rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);
  commands.push(`0 0 0 rg 0 372 ${PAGE_WIDTH} 48 re f`);

  text(LEFT, 390, 19, "VISR", "F2", 1);
  text(LEFT, 351, 8, "ORDER SUMMARY", "F2");
  text(LEFT, 337, 7, truncate(receipt.orderNumber, 38), "F2", 0.12);
  text(220, 351, 7, "PAID", "F2", 0.18);
  line(322);

  text(LEFT, 307, 6, "CUSTOMER", "F2", 0.42);
  text(LEFT, 294, 8, truncate(receipt.customerName, 38), "F2");
  text(LEFT, 281, 7, truncate(receipt.email || receipt.whatsapp, 44), "F1", 0.28);
  text(LEFT, 268, 7, truncate(`${receipt.city}, ${receipt.province} ${receipt.postalCode}`, 44), "F1", 0.28);

  text(170, 307, 6, "PAID AT", "F2", 0.42);
  text(170, 294, 7, truncate(formatPaidAt(receipt.paidAt), 27));
  line(250);

  text(LEFT, 236, 6, "ITEM", "F2", 0.42);
  text(220, 236, 6, "AMOUNT", "F2", 0.42);
  line(228);

  let y = 213;
  for (const item of receipt.items.slice(0, 6)) {
    const itemName = item.variant ? `${item.name} - ${item.variant}` : item.name;
    text(LEFT, y, 7, truncate(`${itemName} x${item.quantity}`, 35));
    text(220, y, 7, formatRupiah(item.lineTotalIdr));
    y -= 18;
  }

  line(y + 6);
  y -= 10;
  text(150, y, 7, "Subtotal", "F1", 0.35);
  text(220, y, 7, formatRupiah(receipt.subtotalIdr));
  y -= 16;
  text(150, y, 7, "Shipping", "F1", 0.35);
  text(220, y, 7, formatRupiah(receipt.shippingCostIdr));
  y -= 18;
  line(y + 8, 0.7, 0.2);
  text(150, y - 5, 8, "TOTAL", "F2");
  text(220, y - 5, 9, formatRupiah(receipt.totalIdr), "F2");

  text(LEFT, 48, 7, "Thank you.", "F2", 0.18);
  text(LEFT, 35, 7, "Engineered to Display.", "F1", 0.42);
  text(LEFT, 20, 5.5, "Payment receipt - not a tax invoice | visr.works", "F1", 0.58);

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
