export type HaloVariant = {
  id: string;
  name: string;
  sku: string;
  stock: number;
};

export const commerceConfig = {
  batchCode: "B02",
  currency: "IDR",
  paymentExpiryHours: 24,
  sender: {
    name: "VISR",
    phone: "081806288892",
    address: "Cluster Kalapa Nunggal Blok A19, Sukamukti, Kabupaten Bandung, Jawa Barat 40291",
  },
  couriers: {
    domestic: ["JNE", "J&T"],
    international: ["POS Indonesia"],
  },
} as const;

export const products = {
  carry: {
    id: "visr-carry-gen-2",
    name: "VISR Carry",
    sku: "VISR-CARRY-G2",
    price: 179_000,
    readyPrice: 199_000,
    stock: 100,
    maxPerOrder: 3,
    weightGrams: 500,
    box: { lengthCm: 15, widthCm: 10, heightCm: 6 },
    included: ["1× VISR Link", "1× Strap", "Premium Packaging"],
  },
  halo: {
    id: "halo-collection",
    name: "Halo Collection",
    price: 89_000,
    maxPerVariant: 1,
    maxCombinedPerOrder: 5,
    weightGrams: 150,
    box: { lengthCm: 15, widthCm: 8, heightCm: 5 },
  },
  additionalLink: {
    id: "additional-visr-link",
    name: "Additional VISR Link",
    sku: "VISR-LINK-ADD",
    price: 19_000,
    stock: 250,
    maxPerOrder: 5,
    weightGrams: 25,
    box: null,
  },
} as const;

export const haloVariants: HaloVariant[] = [
  { id: "crimson", name: "Halo Crimson", sku: "VISR-HALO-CRM", stock: 10 },
  { id: "ice", name: "Halo Ice", sku: "VISR-HALO-ICE", stock: 10 },
  { id: "emerald", name: "Halo Emerald", sku: "VISR-HALO-EMR", stock: 10 },
  { id: "amber", name: "Halo Amber", sku: "VISR-HALO-AMB", stock: 10 },
  { id: "pink", name: "Halo Pink", sku: "VISR-HALO-PNK", stock: 10 },
];

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("en-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function calculateStackedPackage(boxCount: number) {
  return {
    lengthCm: 15,
    widthCm: 10,
    heightCm: Math.max(1, boxCount) * 5,
  };
}
