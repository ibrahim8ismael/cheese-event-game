export type GameOffer =
  | { kind: "discount"; percent: number; code: string }
  | { kind: "free-product"; product: string; code: string };

interface ScoreBand {
  enabled: boolean;
  minScore: number;
  maxScore: number;
}

const booleanSetting = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  if (value.trim().toLowerCase() === "true") return true;
  if (value.trim().toLowerCase() === "false") return false;
  return fallback;
};

const numberSetting = (value: string | undefined, fallback: number) => {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const codeSetting = (value: string | undefined) => value?.trim() ?? "";

const offersEnabled = booleanSetting(process.env.NEXT_PUBLIC_OFFERS_ENABLED, true);

const fivePercentBand: ScoreBand = {
  enabled: booleanSetting(process.env.NEXT_PUBLIC_OFFER_5_ENABLED, true),
  minScore: numberSetting(process.env.NEXT_PUBLIC_OFFER_5_MIN_SCORE, 180),
  maxScore: numberSetting(process.env.NEXT_PUBLIC_OFFER_5_MAX_SCORE, 219),
};
const fivePercentValue = numberSetting(process.env.NEXT_PUBLIC_OFFER_5_PERCENT, 5);
const fivePercentCode = codeSetting(process.env.NEXT_PUBLIC_OFFER_5_CODE);

const tenPercentBand: ScoreBand = {
  enabled: booleanSetting(process.env.NEXT_PUBLIC_OFFER_10_ENABLED, true),
  minScore: numberSetting(process.env.NEXT_PUBLIC_OFFER_10_MIN_SCORE, 220),
  maxScore: numberSetting(process.env.NEXT_PUBLIC_OFFER_10_MAX_SCORE, 249),
};
const tenPercentValue = numberSetting(process.env.NEXT_PUBLIC_OFFER_10_PERCENT, 10);
const tenPercentCode = codeSetting(process.env.NEXT_PUBLIC_OFFER_10_CODE);

const freeProductBand = {
  enabled: booleanSetting(process.env.NEXT_PUBLIC_OFFER_FREE_ENABLED, true),
  minScore: numberSetting(process.env.NEXT_PUBLIC_OFFER_FREE_MIN_SCORE, 250),
};
const freeProductCode = codeSetting(process.env.NEXT_PUBLIC_OFFER_FREE_CODE);
const freeProducts = (
  process.env.NEXT_PUBLIC_OFFER_FREE_PRODUCTS ?? "سبريد تمر|دقة زعتر"
)
  .split("|")
  .map((product) => product.trim())
  .filter(Boolean);

const isInBand = (score: number, band: ScoreBand) =>
  band.enabled && band.maxScore >= band.minScore && score >= band.minScore && score <= band.maxScore;

/** Higher reward bands take priority if environment values overlap. */
export function offerForScore(
  score: number,
  random: () => number = Math.random,
): GameOffer | null {
  if (!offersEnabled || !Number.isFinite(score)) return null;

  if (
    freeProductBand.enabled &&
    score >= freeProductBand.minScore &&
    freeProducts.length > 0
  ) {
    const index = Math.min(
      freeProducts.length - 1,
      Math.floor(random() * freeProducts.length),
    );
    return {
      kind: "free-product",
      product: freeProducts[index],
      code: freeProductCode,
    };
  }

  if (isInBand(score, tenPercentBand)) {
    return { kind: "discount", percent: tenPercentValue, code: tenPercentCode };
  }

  if (isInBand(score, fivePercentBand)) {
    return { kind: "discount", percent: fivePercentValue, code: fivePercentCode };
  }

  return null;
}
