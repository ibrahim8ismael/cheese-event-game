"use client";

import { useEffect, useRef, useState } from "react";
import { CheeseCourt } from "@/components/game/CheeseCourt";
import { sfx } from "@/lib/sound";
import {
  DEFAULT_ROUND,
  verdictForCatch,
  type Verdict,
} from "@/lib/game";

const STORE_URL = "https://himasfarm.com";

type Phase = "intro" | "countdown" | "running" | "final";

export function CheeseGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const roundSeconds = DEFAULT_ROUND; // ثابتة: 30 ثانية
  const [score, setScore] = useState(0);
  const [count, setCount] = useState(3);
  const [finalVerdict, setFinalVerdict] = useState<Verdict | null>(null);
  const [muted, setMuted] = useState(false);

  /* تسجيل البيانات (ديمو UI بس — من غير API) */
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadErrorField, setLeadErrorField] = useState<"name" | "phone" | null>(null);

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
    setScore(0);
    setFinalVerdict(null);
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

  const onEndCourt = (finalScore: number) => {
    setScore(finalScore);
    setFinalVerdict(verdictForCatch(finalScore, roundSeconds));
    goTo("final");
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
      setLeadError("الرقم لازم 11 رقم يبدأ بـ 010 / 011 / 012 / 015");
      return;
    }

    setLeadName(leadName.trim());
    setLeadPhone(digits);
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
            <p className="text-sm font-black text-brand">جبنة السماء 🧀</p>
            <p className="text-[11px] font-bold text-brand/50">
              +10 قبض · −5 ضيعة
            </p>
          </div>
          <p className="text-[9px] font-bold tracking-wide text-brand/40">
            من هيما فارم 🧡
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
        <CheeseCourt
          running={phase === "running"}
          roundSeconds={roundSeconds}
          score={score}
          onCatch={(s) => setScore(s)}
          onMiss={(s) => setScore(s)}
          onEnd={onEndCourt}
        />

        {/* شاشة البداية */}
        {phase === "intro" ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center overflow-y-auto bg-brand/85 p-4 text-center backdrop-blur-sm sm:p-6">
            <div className="anim-rise my-auto w-full max-w-sm">
              <p className="mb-2 text-4xl">🧀</p>
              <h2 className="mb-1 text-2xl font-black text-gold">
                الجبنة بتقصط من السماء!
              </h2>
              <p className="mb-3 text-sm font-semibold text-cream/85">
                حرّك السلة بسرعة واقبض الجبن قبل ما تقع!
              </p>
              <div className="mb-4 space-y-1 text-xs font-bold text-cream/75">
                <p>🔟 كل جبنة تقدرها = +10 نقطة</p>
                <p>💔 كل جبنة تسقط الترض = −5</p>
                <p>⏱️ 30 ثانية — السرعة والجبن بيزيدوا مع الوقت</p>
              </div>
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
                  رقم موبايلك
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
                {leadError ? (
                  <p role="alert" className="text-center text-xs font-bold text-rose-200">
                    {leadError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="mt-2 w-full rounded-full bg-gold px-9 py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95"
                >
                  سجّل وابدأ اللعب
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

        {/* النتيجة النهائية */}
        {phase === "final" && finalVerdict ? (
          <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto bg-brand/85 p-6 py-8 text-center backdrop-blur-sm">
            <div className="anim-rise mx-auto my-auto w-full max-w-sm">
              <p className="mb-1 text-sm font-bold text-gold-soft">
                نتيجتك يا {leadName}
              </p>
              <p className="mb-2 text-6xl font-black tabular-nums text-gold">
                {score}
              </p>
              <p className="mb-1 text-xl font-black text-cream">
                {finalVerdict.title}
              </p>
              <p className="mb-5 text-sm font-semibold text-cream/70">
                {finalVerdict.sub}
              </p>

              <div className="flex flex-col items-stretch gap-2">
                <button
                  type="button"
                  onClick={startGame}
                  className="rounded-full border-2 border-cream/25 py-2.5 text-sm font-black text-cream transition active:scale-95"
                >
                  العب تاني
                </button>
                <a
                  href={STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border-2 border-gold-soft/70 py-2.5 text-sm font-black text-gold-soft transition active:scale-95"
                >
                  زور المتجر 🛒
                </a>
              </div>
              <p className="mt-3 text-[11px] font-bold text-cream/50">
                التسجيل تجريبي والبيانات لم تُرسل خارج الجهاز.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CheeseGame;
