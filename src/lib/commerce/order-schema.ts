import { z } from "zod";
import { haloVariants, products } from "@/lib/commerce/catalog";

const allowedSkus = new Set<string>([
  products.carry.sku,
  products.additionalLink.sku,
  ...haloVariants.map((variant) => variant.sku),
]);

const quantityLimits = new Map<string, number>([
  [products.carry.sku, products.carry.maxPerOrder],
  [products.additionalLink.sku, products.additionalLink.maxPerOrder],
  ...haloVariants.map((variant) => [variant.sku, products.halo.maxPerVariant] as const),
]);

export const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  whatsapp: z.string().trim().regex(/^62\d{8,13}$/, "WhatsApp must use normalized Indonesian format"),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  address: z.string().trim().min(10).max(500),
  province: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().regex(/^\d{5}$/),
  notes: z.string().trim().max(500).optional().default(""),
  preorderConsent: z.literal(true),
});

export const reservationItemSchema = z.object({
  sku: z.string().refine((value) => allowedSkus.has(value), "Unknown VISR SKU"),
  quantity: z.number().int().positive(),
});

export const shippingSelectionSchema = z.object({
  destinationId: z.coerce.number().int().positive(),
  destinationLabel: z.string().trim().min(3).max(200),
  courier: z.enum(["jne", "jnt"]),
  // RajaOngkir returns route-specific services such as CTC and CTCYES.
  // The selected service is revalidated against a fresh server-side quote
  // before the reservation is created, so validation should not hard-code
  // a small list of service names here.
  service: z.string().trim().min(1).max(40).regex(/^[A-Z0-9_-]+$/, "Invalid courier service"),
  quotedCostIdr: z.coerce.number().int().positive().max(5_000_000),
});

export const reservationSchema = z
  .object({
    customer: customerSchema,
    items: z.array(reservationItemSchema).min(1).max(8),
    shipping: shippingSelectionSchema,
  })
  .superRefine(({ items }, context) => {
    const seen = new Set<string>();
    let haloCount = 0;

    for (const item of items) {
      if (seen.has(item.sku)) context.addIssue({ code: "custom", message: `Duplicate SKU: ${item.sku}`, path: ["items"] });
      seen.add(item.sku);

      const limit = quantityLimits.get(item.sku);
      if (!limit || item.quantity > limit) context.addIssue({ code: "custom", message: `Quantity limit exceeded for ${item.sku}`, path: ["items"] });
      if (item.sku.startsWith("VISR-HALO-")) haloCount += item.quantity;
    }

    if (haloCount > products.halo.maxCombinedPerOrder) {
      context.addIssue({ code: "custom", message: "Maximum six Halo units per order", path: ["items"] });
    }
  });

export type ReservationPayload = z.infer<typeof reservationSchema>;
