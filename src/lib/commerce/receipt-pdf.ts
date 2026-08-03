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

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;

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
    dateStyle: "long",
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
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    width = 0.7,
    gray = 0.85,
  ) => commands.push(`${gray} G ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);

  commands.push(`1 1 1 rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f`);
  commands.push(`0 0 0 rg 0 770 ${PAGE_WIDTH} 72 re f`);

  text(48, 795, 28, "VISR", "F2", 1);
  text(48, 744, 11, "PAYMENT RECEIPT", "F2");
  text(48, 723, 9, "Payment verified - thank you for collecting VISR.", "F1", 0.35);
  text(410, 744, 9, "STATUS", "F2", 0.35);
  text(410, 723, 12, "PAID", "F2");
  line(48, 700, 547, 700);

  text(48, 676, 8, "ORDER NUMBER", "F2", 0.4);
  text(48, 658, 11, receipt.orderNumber, "F2");
  text(330, 676, 8, "PAID AT", "F2", 0.4);
  text(330, 658, 10, formatPaidAt(receipt.paidAt));

  text(48, 626, 8, "BILLED TO", "F2", 0.4);
  text(48, 608, 11, truncate(receipt.customerName, 55), "F2");
  text(48, 592, 9, truncate(receipt.email, 70));
  text(48, 577, 9, truncate(receipt.whatsapp, 30));
  text(48, 557, 9, truncate(receipt.address, 82), "F1", 0.25);
  text(
    48,
    542,
    9,
    truncate(`${receipt.city}, ${receipt.province} ${receipt.postalCode}`, 82),
    "F1",
    0.25,
  );

  line(48, 520, 547, 520);
  text(48, 498, 8, "ITEM", "F2", 0.4);
  text(360, 498, 8, "QTY", "F2", 0.4);
  text(430, 498, 8, "AMOUNT", "F2", 0.4);
  line(48, 486, 547, 486);

  let y = 462;
  for (const item of receipt.items.slice(0, 10)) {
    const itemName = item.variant ? `${item.name} - ${item.variant}` : item.name;
    text(48, y, 9, truncate(itemName, 50));
    text(370, y, 9, String(item.quantity));
    text(430, y, 9, formatRupiah(item.lineTotalIdr));
    y -= 24;
  }

  line(48, y + 8, 547, y + 8);
  y -= 18;
  text(330, y, 9, "Subtotal", "F1", 0.35);
  text(430, y, 9, formatRupiah(receipt.subtotalIdr));
  y -= 22;
  text(330, y, 9, "Shipping paid", "F1", 0.35);
  text(430, y, 9, formatRupiah(receipt.shippingCostIdr));
  y -= 22;
  line(330, y + 10, 547, y + 10);
  text(330, y - 8, 11, "TOTAL PAID", "F2");
  text(430, y - 8, 12, formatRupiah(receipt.totalIdr), "F2");

  text(48, 116, 8, "Receipt issued by VISR - Bandung, Indonesia", "F1", 0.45);
  text(
    48,
    100,
    8,
    "This document confirms payment for the order above. It is not a tax invoice.",
    "F1",
    0.45,
  );
  text(
    48,
    72,
    8,
    `Generated ${new Date().toISOString().slice(0, 10)} | visr.works`,
    "F1",
    0.6,
  );

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
