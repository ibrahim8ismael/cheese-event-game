/**
 * ─────────────────────────────────────────────────────────────
 * محرك اللعبة (منطق نقي بدون React) — قطّع الجبنة بالنص
 * هيما فارم · himasfarm.com
 * ─────────────────────────────────────────────────────────────
 */

/** عدد الضربات في الجولة الواحدة */
export const MAX_ATTEMPTS = 3;

/** مدة المسح الكامل (من طرف لطرف) بالثواني لكل ضربة — أقل = أسرع */
export const SWEEP_SECONDS = [2.7, 1.95, 1.35];

/** وصف سرعة الموس لكل ضربة */
export const SWEEP_LABELS = ["عادي", "أسرع", "جبار"];

/** هامش "بالظبط": لو البعد عن المركز أقل من كذا نسميها ضربة مثالية */
export const PERFECT_ZONE = 1; // ± %

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

export interface CutResult {
  /** مكان الموس وقت الضربة 0..100 */
  position: number;
  /** البعد عن النص 0..50 */
  deviation: number;
  /** الدرجة 0..100 */
  score: number;
  perfect: boolean;
  /** رقم الضربة 0..2 */
  attempt: number;
  verdict: Verdict;
}

/** الدرجة من البعد عن النص: كل % بعد = نقص ضعفها من 100 */
export function scoreFromDeviation(deviation: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - deviation * 2)));
}

/** التصنيف الفكاهي للنتيجة */
export function verdictFor(score: number): Verdict {
  if (score >= 98)
    return {
      tier: "perfect",
      title: "بالظبط! 🧀💪",
      sub: "نصين متساويين بالجرام.. شيف أجبان معلن!",
      tone: "gold",
    };
  if (score >= 92)
    return {
      tier: "great",
      title: "قربت على قد العز 😍",
      sub: "الجبنة متزنة.. فيه حتة صغيرة مسرّقة بس",
      tone: "green",
    };
  if (score >= 82)
    return {
      tier: "good",
      title: "مذبوطة يا هندسة 👌",
      sub: "فيه نص أسمن من التاني.. بس مرّة كويسة",
      tone: "green",
    };
  if (score >= 64)
    return {
      tier: "ok",
      title: "متوسطة بس ماشي 😅",
      sub: "مش نص كامل.. الجبنة لسه عندها وشك على وجهين",
      tone: "warn",
    };
  if (score >= 30)
    return {
      tier: "oops",
      title: "أووه أووه! 😂",
      sub: "دكتور الجبنة رفض يوقّع على التقسيمة دي",
      tone: "danger",
    };
  return {
    tier: "disaster",
    title: "الجبنة ضاعت! 🫠",
    sub: "ولا نص ولا نصين.. الجبنة راحت وراحت",
    tone: "danger",
  };
}

/** حساب نتيجة الضربة من مكان الموس وقت الضغط */
export function makeResult(position: number, attempt: number): CutResult {
  const deviation = Math.round(Math.abs(position - 50) * 10) / 10;
  const score = scoreFromDeviation(deviation);
  return {
    position,
    deviation,
    score,
    perfect: deviation <= PERFECT_ZONE,
    attempt,
    verdict: verdictFor(score),
  };
}

/** صياغة عدد الضربات بالانجليزي المصري: 1 → "ضربة وحدة" والكذا */
export function attemptsLabel(n: number): string {
  if (n === 1) return "ضربة وحدة";
  if (n === 2) return "ضربتين";
  return `${n} ضربات`;
}
