import { z } from "zod";

export const customerInformationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  whatsapp: z
    .string()
    .trim()
    .regex(/^(?:\+62|62|0)8[1-9][0-9]{6,11}$/, "Enter a valid Indonesian WhatsApp number."),
  email: z.string().trim().email("Enter a valid email address."),
  address: z.string().trim().min(8, "Enter the complete street address."),
  province: z.string().trim().min(2, "Enter the province."),
  city: z.string().trim().min(2, "Enter the city or regency."),
  postalCode: z.string().trim().regex(/^[0-9]{5}$/, "Enter a valid 5-digit postal code."),
  orderNotes: z.string().trim().max(500, "Order notes cannot exceed 500 characters.").optional(),
  preorderConsent: z.boolean().refine((value) => value, {
    message: "Confirm that you understand this is a pre-order item.",
  }),
});

export type CustomerInformation = z.infer<typeof customerInformationSchema>;

export function normalizeWhatsApp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}
