import { Buffer } from "node:buffer";
import {
  buildPaymentReceiptPdf as buildV4Receipt,
  type PaymentReceipt,
  type ReceiptItem,
} from "./receipt-pdf-v4";

export type { PaymentReceipt, ReceiptItem };

const LARGE_LOGO_COMMAND = "q 1 g 118 0 0 28.7 22 374 cm /Im1 Do Q";
const COMPACT_LOGO_COMMAND = "q 1 g 54 0 0 13.1 22 386 cm /Im1 Do Q";

export function buildPaymentReceiptPdf(receipt: PaymentReceipt) {
  const pdf = Buffer.from(buildV4Receipt(receipt));
  const source = Buffer.from(LARGE_LOGO_COMMAND, "latin1");
  const replacement = Buffer.from(
    COMPACT_LOGO_COMMAND.padEnd(LARGE_LOGO_COMMAND.length, " "),
    "latin1",
  );
  const offset = pdf.indexOf(source);

  if (offset >= 0) replacement.copy(pdf, offset);
  return pdf;
}
