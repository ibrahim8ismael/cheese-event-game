"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { CheeseBoard, type BoardApi } from "@/components/game/CheeseBoard";
import { sfx } from "@/lib/sound";
import {
  MAX_ATTEMPTS,
  SWEEP_LABELS,
  SWEEP_SECONDS,
  attemptsLabel,
  makeResult,
  type CutResult,
} from "@/lib/game";

type Phase = "intro" | "ready" | "sweeping" | "cutting" | "verdict" | "final";

const STORE_URL = "https://himasfarm.com";

/* حلقة السكّينة: المضرب 0..100..0 ping-pong بحسب الزمن الحقيقي */
function knifePos(elapsedMs: number, periodSec: number): number {
  const u = (elapsedMs / (periodSec * 1000)) % 1;
  return u < 0.5 ? u * 200 : (1 - u) * 200;
}

export function CheeseGame() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<CutResult | null>(null);
  const [muted, setMuted] = useState(false);

  const phaseRef = useRef<Phase>("intro");
  const posRef = useRef(0);
  const boardApi = useRef<BoardApi | null>(null);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const goTo = (p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  };

  const schedule = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const beginAttempt = (idx: number) => {
    clearTimers();
    boardApi.current?.reset();
    setResult(null);
    setAttempt(idx);
    goTo("ready");
    schedule(() => goTo("sweeping"), idx === 0 ? 900 : 1100);
  };

  const startGame = () => {
    sfx.ensure();
    beginAttempt(0);
  };

  /* حلقة تحريك الموس (يعتمد على performance.now — دقة وسريع) */
  useEffect(() => {
    if (phase !== "sweeping") return;
    let raf = 0;
    const t0 = performance.now();
    const period = SWEEP_SECONDS[Math.min(attempt, SWEEP_SECONDS.length - 1)];
    boardApi.current?.showKnife(true);
    const loop = (now: number) => {
      if (phaseRef.current !== "sweeping") return;
      const pos = knifePos(now - t0, period);
      posRef.current = pos;
      boardApi.current?.setKnife(pos);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, attempt]);

  useEffect(() => clearTimers, []);

  const cut = () => {
    if (phaseRef.current !== "sweeping") return;
    goTo("cutting"); // قفل فوري ضد الضغط المزدوج

    const pos = Math.round(posRef.current * 100) / 100;
    const res = makeResult(pos, attempt);

    sfx.chop();
    boardApi.current?.tap(pos, res.deviation);

    if (res.score >= 92) {
      schedule(() => sfx.fanfare(), 200);
      schedule(() => {
        confetti({
          particleCount: 130,
          spread: 70,
          startVelocity: 42,
          origin: { y: 0.55 },
          colors: ["#f8d165", "#e0b252", "#14563d", "#fbf7f0"],
        });
      }, 180);
    } else if (res.score < 35) {
      schedule(() => sfx.fail(), 200);
    }

    schedule(() => {
      setResult(res);
      goTo("verdict");
    }, 150);
  };

  const onTap = (e: React.PointerEvent) => {
    if (e.isPrimary === false) return;
    cut();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    cut();
  };

  const toggleMute = () => {
    const next = !muted;
    sfx.muted = next;
    setMuted(next);
  };

  const used = phase === "verdict" || phase === "final" ? attempt + 1 : attempt;
  const canContinue = (result?.attempt ?? attempt) + 1 < MAX_ATTEMPTS;
  const remaining = MAX_ATTEMPTS - used;

  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-xl shadow-brand/15 ring-1 ring-black/5">
      {/* شريط الحالة فوق المسرح */}
      <div className="mt-4 flex items-center justify-between px-5">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => {
            const cls =
              i < used
                ? "bg-gold"
                : i === attempt && (phase === "ready" || phase === "sweeping")
                  ? "bg-brand/70 anim-beat"
                  : "bg-brand/10";
            return <span key={i} className={`h-3 w-3 rounded-full ${cls}`} />;
          })}
          <span className="ms-2 text-xs font-bold text-brand/60">
            ضربة {Math.min(attempt + 1, MAX_ATTEMPTS)}/{MAX_ATTEMPTS}
          </span>
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
      <div
        className={`stage mx-4 mb-4 mt-2 cursor-crosshair overflow-hidden rounded-3xl bg-gradient-to-b from-brand to-brand-deep`}
        onPointerDown={onTap}
        onKeyDown={onKeyDown}
        role="button"
        tabIndex={0}
        aria-label="منطقة اللعب: دوس/المس لتقطيع الجبنة"
      >
        <CheeseBoard api={boardApi} />

        {/* شاشة البداية */}
        {phase === "intro" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-brand/85 p-6 text-center backdrop-blur-sm">
            <div className="anim-rise max-w-sm">
              <p className="mb-2 text-4xl">🧀</p>
              <h2 className="mb-1 text-2xl font-black text-gold">
                تقدر تقطع الجبنة بالنص؟
              </h2>
              <p className="mb-5 text-sm font-semibold text-cream/85">
                الموس بيتحرك لوحده.. دوس في الوقت المناسب وخلي النصين متساويين!
              </p>
              <ul className="mx-auto mb-6 w-fit space-y-1.5 text-start text-xs font-bold text-cream/75">
                <li>🔪 معاك ٣ ضربات.. وكل ضربة الموس بيبقى أسرع</li>
                <li>↩️ تحب تكمّل؟ النتيجة السابقة هتضيع.. قمة من قمة!</li>
                <li>🎯 الهدف: تقطّع بالظبط على علامة 50%</li>
              </ul>
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

        {/* ليّة الاستعداد */}
        {phase === "ready" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand/55 text-center">
            <p className="anim-pop text-4xl font-black text-gold">
              {attempt === 0 ? "استعد!" : `ضربة ${attempt + 1}: ${SWEEP_LABELS[attempt]}!`}
            </p>
            <p className="mt-2 text-sm font-bold text-cream/85">
              {attempt === 0
                ? "دوس وقت ما الموس ييجي على النص 👀"
                : "النتيجة السابقة ضاعت.. الجديدة لازم تكون أحسن!"}
            </p>
          </div>
        ) : null}

        {/* تلميح الضرب */}
        {phase === "sweeping" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <span className="anim-beat rounded-full bg-black/30 px-4 py-1.5 text-xs font-bold text-gold-soft">
              دوس في أي وقت!
            </span>
          </div>
        ) : null}

        {/* الحكم بعد الضربة */}
        {phase === "verdict" && result ? (
          <div className="absolute inset-x-0 bottom-0 p-3">
            <div className="anim-rise rounded-3xl bg-cream p-5 shadow-2xl">
              <div className="mb-1 flex items-center justify-between gap-3">
                <div>
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-black ${
                      result.verdict.tone === "gold"
                        ? "bg-gold text-brand-dark"
                        : result.verdict.tone === "green"
                          ? "bg-mint text-brand-dark"
                          : result.verdict.tone === "warn"
                            ? "bg-gold-soft text-brand-dark"
                            : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {result.verdict.title}
                  </span>
                </div>
                <p className="font-black text-brand text-4xl tabular-nums">
                  {result.score}%
                </p>
              </div>
              <p className="mb-3 text-xs font-semibold text-brand/70">
                {result.verdict.sub} · بعديت عن النص {result.deviation}%
              </p>
              {canContinue ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => goTo("final")}
                      className="rounded-full bg-brand py-2.5 text-sm font-black text-cream shadow shadow-brand/25 transition active:scale-95"
                    >
                      ثبّت النتيجة
                    </button>
                    <button
                      type="button"
                      onClick={() => beginAttempt(attempt + 1)}
                      className="rounded-full border-2 border-gold py-2.5 text-sm font-black text-brand transition active:scale-95"
                    >
                      جرب تاني ⚡
                    </button>
                  </div>
                  <p className="mt-2 text-center text-[11px] font-bold text-brand/50">
                    جرب تاني؟ النتيجة دي ({result.score}%) هتضيع · لسه معاك{" "}
                    {attemptsLabel(remaining)}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => goTo("final")}
                  className="w-full rounded-full bg-brand py-2.5 text-sm font-black text-cream shadow shadow-brand/25 transition active:scale-95"
                >
                  خلصنا! دي آخر ضربة 👌
                </button>
              )}
            </div>
          </div>
        ) : null}

        {/* النتيجة النهائية */}
        {phase === "final" && result ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand/85 p-6 text-center backdrop-blur-sm">
            <div className="anim-rise w-full max-w-xs">
              <p className="mb-1 text-sm font-bold text-gold-soft">
                نتيجتك النهائية
              </p>
              <p className="mb-2 text-7xl font-black tabular-nums text-gold">
                {result.score}%
              </p>
              <p className="mb-1 text-xl font-black text-cream">
                {result.verdict.title}
              </p>
              <p className="mb-6 text-sm font-semibold text-cream/70">
                {result.verdict.sub}
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
              {/* TODO(backend): لما يجي الباك إند هنا هنبعت (name, phone, score) للسيرفر/جوجل شيت */}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CheeseGame;
