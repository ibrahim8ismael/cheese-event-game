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

/** مدد الجولة المتاحة (ثواني) */
export const ROUND_OPTIONS = [30, 45] as const;

/** الافتراضي */
export const DEFAULT_ROUND = 30;

/** كيف الصعوبة 0..1 على طول الجولة: بترفع السرعة وتقلل فترة النزول */
export function difficultyAt(elapsedSec: number, roundSeconds: number): number {
  return Math.max(0, Math.min(1, elapsedSec / roundSeconds));
}

/** سرعة نزول الجبنة (وحدة viewBox/ثانية) بترتفع مع الصعوبة */
export function fallSpeedAt(power: number): number {
  return 160 + 185 * power; // 160 → 345
}

/** فترة بين كل جبنة والتانية بتقل مع الصعوبة (ثانية) */
export function spawnIntervalAt(power: number): number {
  return Math.max(0.55, 1.35 - 0.75 * power); // 1.35 → 0.6
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
    sub: "الجبنة راحت الأرض.. خد نفس وارح العب تاني",
    tone: "danger",
  };
}
