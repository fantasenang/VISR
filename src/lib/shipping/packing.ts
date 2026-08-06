export type ShippingCart = {
  carryQty: number;
  haloQty: number;
  linkQty: number;
};

export type PackageDimensions = {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type PackingProfile = ShippingCart & PackageDimensions & {
  actualWeightGrams: number;
  volumeCm3: number;
};

const WEIGHT_GRAMS = {
  carry: 500,
  halo: 150,
  link: 10,
} as const;

function wholeQuantity(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function getPackingProfile(cart: ShippingCart): PackingProfile {
  const carryQty = wholeQuantity(cart.carryQty);
  const haloQty = wholeQuantity(cart.haloQty);
  const linkQty = wholeQuantity(cart.linkQty);

  if (carryQty + haloQty + linkQty === 0) {
    throw new Error("EMPTY_SHIPPING_CART");
  }

  let dimensions: PackageDimensions;

  if (carryQty === 0 && haloQty === 0 && linkQty === 1) {
    dimensions = { lengthCm: 5, widthCm: 3, heightCm: 3 };
  } else if (carryQty === 0 && haloQty === 0 && linkQty >= 2) {
    dimensions = { lengthCm: 5, widthCm: 3, heightCm: Math.min(15, linkQty * 3) };
  } else if (carryQty === 0 && haloQty === 1) {
    dimensions = { lengthCm: 15, widthCm: 8, heightCm: 5 };
  } else if (carryQty === 0 && haloQty >= 2) {
    dimensions = { lengthCm: 15, widthCm: 10, heightCm: 10 };
  } else if (carryQty === 1 && haloQty === 0) {
    dimensions = { lengthCm: 15, widthCm: 10, heightCm: 6 };
  } else if (carryQty === 2 && haloQty === 0) {
    dimensions = { lengthCm: 15, widthCm: 10, heightCm: 10 };
  } else if (carryQty === 1 && haloQty === 1) {
    dimensions = { lengthCm: 15, widthCm: 10, heightCm: 10 };
  } else {
    dimensions = { lengthCm: 15, widthCm: 10, heightCm: 15 };
  }

  const actualWeightGrams =
    carryQty * WEIGHT_GRAMS.carry +
    haloQty * WEIGHT_GRAMS.halo +
    linkQty * WEIGHT_GRAMS.link;

  return {
    carryQty,
    haloQty,
    linkQty,
    ...dimensions,
    actualWeightGrams,
    volumeCm3: dimensions.lengthCm * dimensions.widthCm * dimensions.heightCm,
  };
}

export function getChargeableWeightGrams(profile: PackingProfile, courier: "jne" | "jnt") {
  const divisor = courier === "jne" ? 5000 : 6000;
  const volumetricWeightGrams = Math.ceil((profile.volumeCm3 / divisor) * 1000);

  return {
    actualWeightGrams: profile.actualWeightGrams,
    volumetricWeightGrams,
    chargeableWeightGrams: Math.max(profile.actualWeightGrams, volumetricWeightGrams),
  };
}
