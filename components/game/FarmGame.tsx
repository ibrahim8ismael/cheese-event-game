"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FarmCourt } from "@/components/game/FarmCourt";
import { sfx } from "@/lib/sound";
import {
  BOMB_PENALTY,
  CATCH_POINTS,
  DEFAULT_ROUND,
  MISS_PENALTY,
  verdictForCatch,
  type Verdict,
} from "@/lib/game";
import { offerForScore, type GameOffer } from "@/lib/offers";

/** لوكيشن الحدث/الفارم — من env عشان تقدر تغيره لكل فعالية */
const LOCATION_URL = process.env.NEXT_PUBLIC_EVENT_LOCATION_URL
  ? process.env.NEXT_PUBLIC_EVENT_LOCATION_URL
  : "https://maps.app.goo.gl/v5X5fTpkRt6mepdd9"; // عنوان هيماز فارم من موقعهم
const MAX_ATTEMPTS = 2;
const ATTEMPTS_KEY = "hima_attempts_v1";

type AttemptMap = Record<string, number>;
let memoryAttempts: AttemptMap = {};

/** محاولات اللاعب — localStorage مع fallback للذاكرة لو المتصفح مانع التخزين */
function readAttempts(): AttemptMap {
  const map: AttemptMap = { ...memoryAttempts };
  if (typeof window === "undefined") return map;
  try {
    const raw = window.localStorage.getItem(ATTEMPTS_KEY);
    if (!raw) return map;
    const stored = JSON.parse(raw) as AttemptMap;
    for (const [phone, count] of Object.entries(stored)) {
      map[phone] = Math.max(map[phone] ?? 0, Number(count) || 0);
    }
  } catch {
    /* localStorage مش متاح — بنكمل بالذاكرة */
  }
  return map;
}

function attemptsFor(phone: string): number {
  return readAttempts()[phone] ?? 0;
}

function recordAttempt(phone: string): number {
  const map = readAttempts();
  const next = (map[phone] ?? 0) + 1;
  map[phone] = next;
  memoryAttempts = map;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(map));
    } catch {
      /* بنكمل بالذاكرة */
    }
  }
  return next;
}

const offerLabel = (offer: GameOffer | null): string =>
  !offer
    ? "بدون عرض"
    : offer.kind === "discount"
      ? `خصم ${offer.percent}%`
      : `منتج مجاني: ${offer.product}`;

type Phase =
  | "welcome"
  | "signup"
  | "countdown"
  | "running"
  | "interlude"
  | "final";
type SubmitState = "idle" | "sending" | "done" | "error";

interface LeadPayload {
  name: string;
  phone: string;
  score: number;
  verdict: string;
  offer: string;
  offerCode: string;
}

export function FarmGame() {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [courtRunId, setCourtRunId] = useState(0);
  const roundSeconds = DEFAULT_ROUND; // ثابتة: 30 ثانية
  const [score, setScore] = useState(0);
  const [count, setCount] = useState(3);
  const [finalVerdict, setFinalVerdict] = useState<Verdict | null>(null);
  const [muted, setMuted] = useState(false);
  const [attemptsUsed, setAttemptsUsed] = useState(0);

  /* تسجيل البيانات (ديمو UI بس — من غير API) */
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadErrorField, setLeadErrorField] = useState<"name" | "phone" | null>(null);

  /* إرسال النتيجة لجوجل شيت بعد نهاية الجولة */
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitStore, setSubmitStore] = useState<"sheet" | "console" | null>(
    null,
  );
  const submitSeqRef = useRef(0);
  const lastLeadRef = useRef<LeadPayload | null>(null);
  /* نتيجة المحاولة الأولى — مش بتتبعت غير لو اللاعب رفض الفرصة التانية */
  const pendingLeadRef = useRef<LeadPayload | null>(null);

  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const goTo = (p: Phase) => setPhase(p);

  const startGame = () => {
    sfx.ensure();
    clearTimers();
    setCourtRunId((runId) => runId + 1);
    setScore(0);
    setFinalVerdict(null);
    setSubmitState("idle");
    setSubmitStore(null);
    submitSeqRef.current += 1; // لو فيه إرسال قديم شغال.. نلاشي نتيجته
    lastLeadRef.current = null;
    setCount(3);
    setLeadError(null);
    setLeadErrorField(null);
    goTo("countdown");
    schedule(() => {
      setCount(2);
      sfx.pop(0);
    }, 700);
    schedule(() => {
      setCount(1);
      sfx.pop(2);
    }, 1400);
    schedule(() => {
      sfx.pop(4);
      goTo("running");
    }, 2100);
  };

  const toggleMute = () => {
    const next = !muted;
    sfx.muted = next;
    setMuted(next);
  };

  /** إرسال النتيجة للـ API اللي بيضيفها في جوجل شيت */
  const postLead = async (payload: LeadPayload) => {
    const seq = ++submitSeqRef.current;
    lastLeadRef.current = payload;
    setSubmitState("sending");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        ok?: boolean;
        store?: "sheet" | "console";
      };
      if (!data.ok) throw new Error("rejected");
      if (seq !== submitSeqRef.current) return; // جولة أحدث بدأت
      setSubmitStore(data.store ?? null);
      setSubmitState("done");
    } catch {
      if (seq !== submitSeqRef.current) return;
      setSubmitState("error");
    }
  };

  const retryLead = () => {
    if (lastLeadRef.current) void postLead(lastLeadRef.current);
  };

  const onEndCourt = (finalScore: number) => {
    const verdict = verdictForCatch(finalScore, roundSeconds);
    const offer = offerForScore(finalScore);
    const attemptNo = attemptsUsed + 1;

    setScore(finalScore);
    setFinalVerdict(verdict);
    setAttemptsUsed(recordAttempt(leadPhone));

    const payload: LeadPayload = {
      name: leadName.trim(),
      phone: leadPhone,
      score: finalScore,
      verdict: verdict.title,
      offer: offerLabel(offer),
      offerCode: offer?.code ?? "",
    };

    /* أول محاولة: بنستنى قرار الفرصة التانية قبل أي إرسال للشيت */
    if (attemptNo === 1) {
      pendingLeadRef.current = payload;
      goTo("interlude");
      return;
    }

    /* آخر محاولة: دي النتيجة النهائية */
    pendingLeadRef.current = null;
    goTo("final");
    void postLead(payload);
  };

  /** فرصة تانية: النتيجة الأولى بتتلغي ومش بتتبعت */
  const takeSecondChance = () => {
    pendingLeadRef.current = null;
    startGame();
  };

  /** رفض الفرصة التانية: سجّل نتيجة المحاولة الأولى زي ما هي */
  const skipSecondChance = () => {
    const payload = pendingLeadRef.current;
    pendingLeadRef.current = null;
    goTo("final");
    if (payload) void postLead(payload);
  };

  /** Validate the contact details before the local demo round starts. */
  const handleStartSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const digits = leadPhone.replace(/[^\d]/g, "");
    if (!leadName.trim()) {
      setLeadErrorField("name");
      setLeadError("اكتب اسمك هو هو 😉");
      return;
    }
    if (!/^(010|011|012|015)\d{8}$/.test(digits)) {
      setLeadErrorField("phone");
      setLeadError("رقم الواتساب لازم يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015");
      return;
    }

    const used = attemptsFor(digits);
    if (used >= MAX_ATTEMPTS) {
      setLeadErrorField("phone");
      setLeadError("الرقم ده استنفد محاولتيه 🍯 كل لاعب له محاولتين بس");
      return;
    }

    setLeadName(leadName.trim());
    setLeadPhone(digits);
    setAttemptsUsed(used);
    setLeadError(null);
    setLeadErrorField(null);
    startGame();
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-white shadow-xl shadow-brand/15 sm:rounded-[28px] sm:ring-1 sm:ring-black/5">
      {/* رأس اللعبة: الاسم + براند مصغر + زر الصوت */}
      <div className="flex items-center justify-between px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="leading-tight">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-black text-brand">
              تحدي هيماز فارم 🍯
            </p>
            <p className="text-[11px] font-bold text-brand/50">
              <span dir="ltr">+{CATCH_POINTS}</span> في السلة · خصم{" "}
              <bdi dir="ltr">{MISS_PENALTY}</bdi> خارجها
            </p>
          </div>
          <p className="text-[9px] font-bold tracking-wide text-brand/40">
            من هيماز فارم 🧡
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "شغّل الصوت" : "اسكت الصوت"}
          className="rounded-full bg-brand/5 p-2 transition active:scale-90"
        >
          {muted ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#14563d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5z" fill="#14563d" stroke="none" />
              <path d="M22 9l-6 6M16 9l6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#14563d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5z" fill="#14563d" stroke="none" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />
            </svg>
          )}
        </button>
      </div>

      {/* المسرح — بياخد الطول كله على الموبايل */}
      <div className="relative mx-0 min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-brand to-brand-deep sm:mx-4 sm:mb-4 sm:rounded-3xl">
        <FarmCourt
          key={courtRunId}
          running={phase === "running"}
          roundSeconds={roundSeconds}
          score={score}
          onCatch={(s) => setScore(s)}
          onMiss={(s) => setScore(s)}
          onEnd={onEndCourt}
        />

        {/* شاشة الشرح */}
        {phase === "welcome" ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-brand/85 p-4 text-center backdrop-blur-sm sm:p-6">
            <div className="anim-rise my-auto w-full max-w-sm">
              <p className="mb-2 text-4xl">🍯</p>
              <h2 className="mb-1 text-2xl font-black text-gold">
                تحدي هيماز فارم!
              </h2>
              <p className="mb-4 text-sm font-semibold leading-relaxed text-cream/85">
                حرك السلة يمين وشمال واجمع أكبر عدد منتجات قبل ما الوقت يخلص!
              </p>
              <div className="mb-5 space-y-2 rounded-2xl bg-cream/10 p-4 text-right text-sm font-bold text-cream/85">
                <p>
                  المنتج في السلة ={" "}
                  <span className="text-gold" dir="ltr">
                    +{CATCH_POINTS}
                  </span>{" "}
                  نقاط
                </p>
                <p>
                  المنتج خارج السلة ={" "}
                  <span className="text-rose-200">
                    خصم <bdi dir="ltr">{MISS_PENALTY}</bdi>
                  </span>{" "}
                  نقاط
                </p>
                <p>
                  القنبلة في السلة ={" "}
                  <span className="text-rose-300">
                    خصم <bdi dir="ltr">{BOMB_PENALTY}</bdi>
                  </span>
                </p>
              </div>
              <p className="mb-5 text-[11px] font-bold text-cream/70">
                ⏱️ الجولة 30 ثانية، وليك محاولتين وآخر نتيجة هي اللي بتتحسب 🔁
              </p>
              <button
                type="button"
                onClick={() => goTo("signup")}
                className="w-full rounded-full bg-gold px-9 py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95"
              >
                تمام، يلا بينا!
              </button>
            </div>
          </div>
        ) : null}

        {/* التسجيل */}
        {phase === "signup" ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-brand/85 p-4 text-center backdrop-blur-sm sm:p-6">
            <div className="anim-rise my-auto w-full max-w-sm">
              <p className="mb-2 text-4xl">📝</p>
              <h2 className="mb-1 text-2xl font-black text-gold">
                خطوة مهمة قبل اللعب!
              </h2>
              <p className="mb-4 text-sm font-semibold text-cream/85">
                اكتب بياناتك لاستلام كود هديتك عبر الواتساب فورًا:
              </p>
              <form onSubmit={handleStartSubmit} className="space-y-2 text-right">
                <label
                  htmlFor="lead-name"
                  className="block text-xs font-black text-gold-soft"
                >
                  اسمك
                </label>
                <input
                  id="lead-name"
                  value={leadName}
                  onChange={(e) => {
                    setLeadName(e.target.value);
                    setLeadError(null);
                    setLeadErrorField(null);
                  }}
                  placeholder="اكتب اسمك"
                  autoComplete="name"
                  aria-invalid={leadErrorField === "name"}
                  maxLength={40}
                  className="w-full rounded-xl bg-cream px-4 py-2.5 text-base font-bold text-brand-dark placeholder-brand/40 outline-none ring-2 ring-transparent transition focus:ring-gold"
                />
                <label
                  htmlFor="lead-phone"
                  className="block text-xs font-black text-gold-soft"
                >
                  رقم الواتساب
                </label>
                <input
                  id="lead-phone"
                  value={leadPhone}
                  onChange={(e) => {
                    setLeadPhone(e.target.value.replace(/[^\d]/g, ""));
                    setLeadError(null);
                    setLeadErrorField(null);
                  }}
                  placeholder="01xxxxxxxxx"
                  autoComplete="tel-national"
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  aria-invalid={leadErrorField === "phone"}
                  maxLength={11}
                  className="w-full rounded-xl bg-cream px-4 py-2.5 text-left text-base font-bold text-brand-dark placeholder-brand/40 outline-none ring-2 ring-transparent transition focus:ring-gold"
                />
                <p className="text-xs font-semibold text-gold-soft">
                  علشان هنبعت لك عليه الجايزة بتاعتك
                </p>
                {leadError ? (
                  <p role="alert" className="text-center text-xs font-bold text-rose-200">
                    {leadError}
                  </p>
                ) : null}
                <p className="text-center text-[10px] font-semibold leading-relaxed text-cream/55">
                  بإدخال بياناتك، بتوافق إننا نتواصل معاك على واتساب بخصوص جائزتك.
                </p>
                <button
                  type="submit"
                  className="mt-2 w-full rounded-full bg-gold px-9 py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95"
                >
                  تأكيد وابدأ اللعب
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {/* العد التنازلي */}
        {phase === "countdown" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand/60 text-center">
            <p
              key={count}
              className="anim-pop text-[170px] font-black leading-none tabular-nums text-gold drop-shadow-[0_0_45px_rgba(224,178,82,0.5)]"
            >
              {count}
            </p>
            <p className="mt-6 text-base font-black text-cream drop-shadow">
              السلة بتتبع إصبعك.. استعد!
            </p>
          </div>
        ) : null}

        {/* بين المحاولتين — قرار الفرصة التانية */}
        {phase === "interlude" && finalVerdict ? (
          <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-brand/90 p-6 py-8 text-center backdrop-blur-sm">
            <div className="anim-rise mx-auto my-auto w-full max-w-sm">
              <p className="mb-3 text-xl font-black text-gold-soft">
                عاش يا بطل .. سكور ممتاز! 🔥
              </p>
              <p className="mb-1 text-sm font-bold text-cream">
                مجموع نقاطك في الجولة دي:
              </p>
              <p className="mb-3 text-6xl font-black tabular-nums text-gold">
                {score}
              </p>
              <p className="mb-5 text-sm font-semibold leading-relaxed text-cream/85">
                قدامك محاولة تانية وأخيرة تقدر تزود بيها نقاطك وتنافس على هدية أعلى!
              </p>

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={takeSecondChance}
                  className="rounded-full bg-gold px-9 py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95"
                >
                  العب محاولتك الأخيرة
                </button>
                <button
                  type="button"
                  onClick={skipSecondChance}
                  className="rounded-full border-2 border-cream/25 py-2.5 text-sm font-black text-cream transition active:scale-95"
                >
                  راضي بالسكور ده.. عرفني هديتي
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* النتيجة النهائية */}
        {phase === "final" && finalVerdict ? (
          <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-brand/85 p-6 py-8 text-center backdrop-blur-sm">
            <div className="anim-rise mx-auto my-auto w-full max-w-sm">
              <Image
                src="/himaz-farm-logo.jpeg"
                alt="شعار هيماز فارم"
                width={160}
                height={198}
                className="mx-auto mb-3 h-24 w-auto rounded-lg"
              />
              <p className="mb-1 text-2xl font-black text-gold-soft">
                مبروك!
              </p>
              <p className="mb-1 text-base font-bold text-cream">
                ده السكور النهائي بتاعك
              </p>
              <p className="mb-1 text-sm font-semibold text-cream/75">
                السكور المعتمد:
              </p>
              <p className="mb-3 text-6xl font-black tabular-nums text-gold">
                {score}
              </p>
              <p className="mb-5 text-sm font-semibold leading-relaxed text-cream/85">
                استنفذت محاولاتك، وجاهزين نحدد جائزتك!
              </p>

              <div className="mb-5 rounded-2xl border border-gold/50 bg-cream/10 p-4">
                <p className="text-base font-black text-cream">
                  📲 هنبعت لك كود هديتك على الواتساب فورًا
                </p>
                <p className="mt-2 text-xs font-semibold text-cream/65">
                  على الرقم <bdi dir="ltr">{leadPhone}</bdi>
                </p>
              </div>

              <div aria-live="polite" className="mb-4 min-h-4 text-xs font-bold">
                {submitState === "sending" ? (
                  <p className="text-cream/60">بنسجل نتيجتك.. ⏳</p>
                ) : null}
                {submitState === "done" && submitStore === "console" ? (
                  <p className="text-gold-soft">
                    وضع الديمو: النتيجة اتسجلت في كونسول السيرفر. الشيت لسه
                    مش متوصل ⚠️
                  </p>
                ) : null}
                {submitState === "error" ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 text-rose-200">
                    <p>مقدرناش نسجل النتيجة 😕</p>
                    <button
                      type="button"
                      onClick={retryLead}
                      className="rounded-full border border-rose-200/60 px-3 py-1 text-[11px] font-black"
                    >
                      جرب تاني
                    </button>
                  </div>
                ) : null}
              </div>

              <a
                href={LOCATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-full border-2 border-gold-soft/70 py-2.5 text-sm font-black text-gold-soft transition active:scale-95"
              >
                استلم هديتك من البوث 📍
              </a>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default FarmGame;
