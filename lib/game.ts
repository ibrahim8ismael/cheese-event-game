/**
 * ─────────────────────────────────────────────────────────────
 * محرك اللعبة (منطق نقي بدون React)
 * هيما فارم · himasfarm.com
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
   محرك "جبنة السماء" — التقاط الجبنة اللي بتنزل
   (جبنة بتنزل من السماء وسلة بأيدك.. اجمع قبل ما الوقت يخلص)
   ═════════════════════════════════════════════════════════════ */

/** نقاط الجبنة النهضيدة */
export const CATCH_POINTS = 10;

/** خصم الجبنة اللي هارطة الأرض */
export const MISS_PENALTY = 5;

/** أقل درجة مسموحة (مفيش درجات سلبية.. قلبنا طيب) */
export const SCORE_FLOOR = 0;

/** مدة الجولة (ثواني) — ثابتة 30 في الديمو */
export const DEFAULT_ROUND = 30;

/** كيف الصعوبة 0..1 على طول الجولة: بترفع السرعة وتقلل فترة النزول */
export function difficultyAt(elapsedSec: number, roundSeconds: number): number {
  return Math.max(0, Math.min(1, elapsedSec / roundSeconds));
}

/** سرعة نزول الجبنة (وحدة viewBox/ثانية): سريعة من البداية وتشتد مع الوقت */
export function fallSpeedAt(power: number): number {
  return 450 + 450 * power; // 450 → 900
}

/** الفترة بين قطع الجبن: بداية أكثف وتوصل لحوالي 5 قطع في الثانية */
export function spawnIntervalAt(power: number): number {
  return Math.max(0.18, 0.65 - 0.47 * power); // 0.65 → 0.18
}

/** حكم الجولة الكاملة — الدرجة يتمرنها حسب مدة الجولة عشان المقارنة تفض عادلة */
export function verdictForCatch(score: number, roundSeconds: number): Verdict {
  const s = score / (roundSeconds / 30); // توحيد على أساس جولة 30 ثانية
  if (s >= 240)
    return {
      tier: "perfect",
      title: "أسطورة منقطة! 👑",
      sub: "سلتك بقت محطة استقبال للجبن.. كلها طايرة على مودك",
      tone: "gold",
    };
  if (s >= 180)
    return {
      tier: "great",
      title: "شيف تقسيم معلن 💪",
      sub: "سلتك امتلأت جبن محترم.. حد مغير مكانها!",
      tone: "green",
    };
  if (s >= 125)
    return {
      tier: "good",
      title: "يدك ذهب 🙌",
      sub: "قبض جميل.. فيه كام حتة وقعت على الأرصفة بس",
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
    sub: "الجبنة راحت الأرض.. خد نفس وارجع العب تاني",
    tone: "danger",
  };
}
