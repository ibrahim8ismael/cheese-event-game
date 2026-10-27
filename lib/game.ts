/**
 * ─────────────────────────────────────────────────────────────
 * محرك اللعبة (منطق نقي بدون React)
 * هيماز فارم · himasfarm.com
 * ─────────────────────────────────────────────────────────────
 */

export type VerdictTier =
  | "perfect"
  | "great"
  | "good"
  | "ok"
  | "oops"
  | "disaster";

export type Tone = "gold" | "green" | "warn" | "danger";

export interface Verdict {
  tier: VerdictTier;
  /** العنوان القصير المضحك */
  title: string;
  /** التفصيلة */
  sub: string;
  tone: Tone;
}

/* ═════════════════════════════════════════════════════════════
   محرك "تحدي هيماز فارم" — جمع منتجات السماء (عسل وتمر)
   (منتج بتنزل من السماء وسلة بأيدك.. اجمع قبل ما الوقت يخلص)
   ═════════════════════════════════════════════════════════════ */

/** نقاط المنتج اللي بيدخل السلة */
export const CATCH_POINTS = 10;

/** خصم المنتج اللي هارطة الأرض خارج السلة */
export const MISS_PENALTY = 5;

/** خصم القنبلة اللي بتدخل السلة — قيمة من env عشان تتزبط من غير نشر جديد */
const envNumber = (raw: string | undefined, fallback: number): number => {
  if (!raw?.trim()) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const BOMB_PENALTY = Math.max(1, Math.round(
  envNumber(process.env.NEXT_PUBLIC_BOMB_PENALTY, 20),
));

/** احتمال ظهور القنبلة — بالنسبة المئوية (15 = 15%) */
export const BOMB_CHANCE = Math.max(
  0,
  Math.min(90, envNumber(process.env.NEXT_PUBLIC_BOMB_CHANCE, 15)),
) / 100;

/** أقل درجة مسموحة (مفيش درجات سلبية.. قلبنا طيب) */
export const SCORE_FLOOR = 0;

/** مدة الجولة (ثواني) — ثابتة 30 في الديمو */
export const DEFAULT_ROUND = 30;

/** كيف الصعوبة 0..1 على طول الجولة: بترفع السرعة وتقلل فترة النزول */
export function difficultyAt(elapsedSec: number, roundSeconds: number): number {
  return Math.max(0, Math.min(1, elapsedSec / roundSeconds));
}

/** سرعة نزول المنتجات (وحدة viewBox/ثانية): سريعة من البداية وتشتد مع الوقت */
export function fallSpeedAt(power: number): number {
  return 450 + 450 * power; // 450 → 900
}

/** الفترة بين النزول: بداية أكثف وتوصل لحوالي 5 منتجات في الثانية */
export function spawnIntervalAt(power: number): number {
  return Math.max(0.18, 0.65 - 0.47 * power); // 0.65 → 0.18
}

/** حكم الجولة الكاملة — الدرجة يتمرنها حسب مدة الجولة عشان المقارنة تفض عادلة */
export function verdictForCatch(score: number, roundSeconds: number): Verdict {
  const s = score / (roundSeconds / 30); // توحيد على أساس جولة 30 ثانية
  if (s >= 240)
    return {
      tier: "perfect",
      title: "أسطورة في السوق! 👑",
      sub: "سلتك بقت محطة وصول للعسل والتمر.. كلهم طايبين على مودك",
      tone: "gold",
    };
  if (s >= 180)
    return {
      tier: "great",
      title: "تاجر محترف 💪",
      sub: "سلتك امتلأت منتجات محترمة.. حد مش هيوصلها!",
      tone: "green",
    };
  if (s >= 125)
    return {
      tier: "good",
      title: "يدك ذهب 🙌",
      sub: "جمع جميل.. فيه كام منتج وقع على الأرض بس",
      tone: "green",
    };
  if (s >= 55)
    return {
      tier: "ok",
      title: "جميل بقى 😄",
      sub: "لحقت الكتير.. شوية اللي نزلوا تحت ولّوا طوب",
      tone: "warn",
    };
  return {
    tier: "disaster",
    title: "الأرض وبس! 🫠",
    sub: "المنتجات راحت الأرض.. خد نفس وارجع العب تاني",
    tone: "danger",
  };
}
