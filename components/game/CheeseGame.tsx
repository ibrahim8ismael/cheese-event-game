"use client";

import { useEffect, useRef, useState } from "react";
import { CheeseCourt } from "@/components/game/CheeseCourt";
import { sfx } from "@/lib/sound";
import {
  DEFAULT_ROUND,
  ROUND_OPTIONS,
  verdictForCatch,
  type Verdict,
} from "@/lib/game";

const STORE_URL = "https://himasfarm.com";

type Phase = "intro" | "countdown" | "running" | "final";

export function CheeseGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [roundSeconds, setRoundSeconds] = useState<number>(DEFAULT_ROUND);
  const [score, setScore] = useState(0);
  const [count, setCount] = useState(3);
  const [finalVerdict, setFinalVerdict] = useState<Verdict | null>(null);
  const [muted, setMuted] = useState(false);

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

  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-xl shadow-brand/15 ring-1 ring-black/5">
      {/* رأس اللعبة: الاسم وزر الصوت */}
      <div className="mt-4 flex items-center justify-between px-5">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-black text-brand">جبنة السماء 🧀</p>
          <p className="text-[11px] font-bold text-brand/50">
            +10 قبض · −5 ضيعة
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

      {/* المسرح */}
      <div className="relative mx-4 mb-4 mt-2 overflow-hidden rounded-3xl bg-gradient-to-b from-brand to-brand-deep">
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
                <p>⏱️ المدة: 30 أو 45 ثانية.. الصعوبة بتزيد مع الوقت</p>
              </div>
              <div className="mb-6 flex items-center justify-center gap-2">
                {ROUND_OPTIONS.map((secs) => (
                  <button
                    key={secs}
                    type="button"
                    onClick={() => setRoundSeconds(secs)}
                    className={`rounded-full px-5 py-2 text-sm font-black transition active:scale-95 ${
                      roundSeconds === secs
                        ? "bg-gold text-brand-dark shadow-md"
                        : "border-2 border-cream/30 text-cream/80"
                    }`}
                  >
                    {secs} ثانية
                  </button>
                ))}
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
              className="anim-pop text-8xl font-black tabular-nums text-gold drop-shadow-lg"
            >
              {count}
            </p>
            <p className="mt-3 text-sm font-bold text-cream/85">
              السلة بتتبع إصبعك.. استعد!
            </p>
          </div>
        ) : null}

        {/* النتيجة النهائية */}
        {phase === "final" && finalVerdict ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand/85 p-6 text-center backdrop-blur-sm">
            <div className="anim-rise w-full max-w-xs">
              <p className="mb-1 text-sm font-bold text-gold-soft">
                نتيجتك النهائية
              </p>
              <p className="mb-2 text-7xl font-black tabular-nums text-gold">
                {score}
              </p>
              <p className="mb-1 text-xl font-black text-cream">
                {finalVerdict.title}
              </p>
              <p className="mb-6 text-sm font-semibold text-cream/70">
                {finalVerdict.sub}
              </p>
              <div className="flex flex-col items-stretch gap-2">
                <button
                  type="button"
                  onClick={startGame}
                  className="rounded-full bg-gold py-3 text-base font-black text-brand-dark shadow-lg shadow-black/25 transition active:scale-95"
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
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CheeseGame;
