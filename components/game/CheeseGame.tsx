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
  const [leadStatus, setLeadStatus] = useState<"idle" | "sending" | "done">(
    "idle",
  );
  const [leadError, setLeadError] = useState<string | null>(null);

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
    setLeadName("");
    setLeadPhone("");
    setLeadStatus("idle");
    setLeadError(null);
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

  /**
   * تسجيل تجريبي: تنقية رقم مصر، تحقق خفيف، وإرسال وهمي بـ timeout.
   * TODO(backend): نفس التوقيع يمشي على POST {name, phone, score} للسيرفر/شيت
   */
  const submitLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (leadStatus !== "idle") return;

    const digits = leadPhone.replace(/[^\d]/g, "");
    if (!leadName.trim()) {
      setLeadError("اكتب اسمك هو هو 😉");
      return;
    }
    if (!/^(010|011|012|015)\d{8}$/.test(digits)) {
      setLeadError("الرقم لازم 11 رقم يبدأ بـ 010 / 011 / 012 / 015");
      return;
    }

    setLeadError(null);
    setLeadStatus("sending");
    schedule(() => setLeadStatus("done"), 700);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-white shadow-xl shadow-brand/15 sm:rounded-[28px] sm:ring-1 sm:ring-black/5">
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
          <div className="absolute inset-0 flex items-center justify-center bg-brand/85 p-6 text-center backdrop-blur-sm">
            <div className="anim-rise max-w-sm">
              <p className="mb-2 text-4xl">🧀</p>
              <h2 className="mb-1 text-2xl font-black text-gold">
                الجبنة بتقصط من السماء!
              </h2>
              <p className="mb-4 text-sm font-semibold text-cream/85">
                فاتح سلتك على طول.. واركد كمية جبن قبل ما الأرض تكسب!
              </p>
              <div className="mb-5 space-y-1.5 text-xs font-bold text-cream/75">
                <p>🔟 كل جبنة تقدرها = +10 نقطة</p>
                <p>💔 كل جبنة تسقط الترض = −5</p>
                <p>⏱️ معاك 30 ثانية بس.. والصعوبة بتزيد كل ثانية!</p>
              </div>
              <button
                type="button"
                onClick={startGame}
                className="rounded-full bg-gold px-9 py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95"
              >
                يلا نبدأ!
              </button>
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
          <div className="absolute inset-0 flex flex-col overflow-y-auto bg-brand/85 p-6 py-8 text-center backdrop-blur-sm">
            {leadStatus === "done" ? (
              <div className="anim-rise mx-auto my-auto w-full max-w-sm">
                <p className="mb-2 text-4xl">🎉</p>
                <p className="mb-1 text-2xl font-black text-gold">
                  تم التسجيل يا {leadName}!
                </p>
                <p className="mb-6 text-sm font-semibold text-cream/75">
                  ديمو: البيانات مش بتطلع من الجهاز.. بسم الله لو كان حقيقي 😉
                </p>
                <button
                  type="button"
                  onClick={startGame}
                  className="w-full rounded-full bg-gold py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95"
                >
                  العب تاني
                </button>
                <p className="mt-3 text-[11px] font-bold text-cream/40">
                  {/* TODO(backend): شاشة النجاح دي بعد الـ POST الحقيقي */}
                </p>
              </div>
            ) : (
              <div className="anim-rise mx-auto my-auto w-full max-w-sm">
                <p className="mb-1 text-sm font-bold text-gold-soft">
                  نتيجتك النهائية
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

                <form onSubmit={submitLead} className="mb-5 space-y-2">
                  <p className="text-xs font-black text-gold-soft">
                    سجّل اسمك ورقمك عشان توصولك الحاجات الحلوة 👇
                  </p>
                  <input
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="اسمك"
                    aria-label="اسمك"
                    maxLength={40}
                    className="w-full rounded-xl bg-cream px-4 py-2.5 text-base font-bold text-brand-dark placeholder-brand/40 outline-none ring-2 ring-transparent transition focus:ring-gold"
                  />
                  <input
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="01xxxxxxxxx"
                    aria-label="رقم موبايلك"
                    type="tel"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={11}
                    className="w-full rounded-xl bg-cream px-4 py-2.5 text-left text-base font-bold text-brand-dark placeholder-brand/40 outline-none ring-2 ring-transparent transition focus:ring-gold"
                  />
                  {leadError ? (
                    <p className="text-[11px] font-bold text-rose-200">
                      {leadError}
                    </p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={leadStatus === "sending"}
                    className="w-full rounded-full bg-gold py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95 disabled:opacity-60"
                  >
                    {leadStatus === "sending" ? "بنسلم.. ✉️" : "سجّلني"}
                  </button>
                </form>

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
                {/* TODO(backend): هنا هنبعت (name, phone, score) للسيرفر/جوجل شيت */}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CheeseGame;
