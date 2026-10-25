"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import {
  CATCH_POINTS,
  MISS_PENALTY,
  SCORE_FLOOR,
  difficultyAt,
  fallSpeedAt,
  spawnIntervalAt,
} from "@/lib/game";

/* ─── هندسة المسرح: العرض ثابت (0..1000) والطول بيتغير مع الشاشة ─── */
const STAGE_W = 1000;
const DEFAULT_H = 700;
const MIN_H = 200;
const CATCH_HALF = 105; // نصف سعة السلة للقبض
const ENT_MAX = 12;
const FLOAT_MAX = 6;

interface CourtGeo {
  H: number;
  catchY: number;
  basketY: number;
  floorY: number;
}

/** هندسة عمودية ديناميكية: السلة/خط الالتقاط/الأرض بترتفع للأسفل مهما طال الشاشة */
function geoFor(H: number): CourtGeo {
  const clamped = Math.max(MIN_H, Math.round(H));
  return {
    H: clamped,
    catchY: clamped - 130,
    basketY: clamped - 104,
    floorY: clamped - 10,
  };
}

interface Ent {
  active: boolean;
  slot: number;
  x: number;
  y: number;
  vy: number;
  rot: number;
  vr: number;
  swayAmp: number;
  swayPhase: number;
  swayFreq: number;
  scale: number;
  /** جذبات للي خلصوا منخطوة السلة — ماتحسبش تاني */
  settled: boolean;
}

interface FloatLabel {
  active: boolean;
  slot: number;
  x: number;
  y: number;
  bornAt: number;
  text: string;
  fill: string;
}

export interface CheeseCourtProps {
  running: boolean;
  roundSeconds: number;
  score: number;
  onCatch: (score: number) => void;
  onMiss: (score: number) => void;
  onEnd: (score: number) => void;
}

/**
 * مشهد "جبنة السماء": جبنة بتقصط من فوق وسلة بتتبع إصبعك/كيبوردك
 * كل الفيزيكس بيمشي بـ RAF على refs — بدون إعاد render
 */
export function CheeseCourt({
  running,
  roundSeconds,
  score,
  onCatch,
  onMiss,
  onEnd,
}: CheeseCourtProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);

  const basketRef = useRef<SVGGElement | null>(null);
  const cloudARef = useRef<SVGGElement | null>(null);
  const cloudBRef = useRef<SVGGElement | null>(null);
  const entRefs = useRef<Array<SVGGElement | null>>([]);
  const floatRefs = useRef<Array<SVGGElement | null>>([]);
  const floatTextRefs = useRef<Array<SVGTextElement | null>>([]);

  /* حالة الجولة */
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);
  const elapsedRef = useRef(0);
  const spawnAtRef = useRef(0);
  const endedRef = useRef(false);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const bounceStartRef = useRef(-Infinity);
  const bxRef = useRef(STAGE_W / 2);
  const txRef = useRef(STAGE_W / 2);
  const keysRef = useRef<{ l: boolean; r: boolean }>({ l: false, r: false });
  const entsRef = useRef<Ent[]>([]);
  const freeSlotsRef = useRef<number[]>(
    Array.from({ length: ENT_MAX }, (_, i) => i),
  );
  const floatsRef = useRef<FloatLabel[]>([]);
  const freeFloatSlotsRef = useRef<number[]>(
    Array.from({ length: FLOAT_MAX }, (_, i) => i),
  );
  const runningRef = useRef(running);

  /* ارتفاع المسرح الحقيقي — الـ viewBox بيتحرك مع نسبة شاشة الموبايل */
  const [svgH, setSvgH] = useState(DEFAULT_H);
  const vhRef = useRef(DEFAULT_H);
  const geoNow = () => geoFor(vhRef.current);

  /* ─── الالتقاط والضياع ─── */
  const doCatch = (x: number, now: number) => {
    scoreRef.current += CATCH_POINTS;
    streakRef.current += 1;
    bounceStartRef.current = now;
    sfx.pop(Math.min(streakRef.current - 1, 8));
    onCatch(scoreRef.current);
    spawnFloat(x, geoNow().catchY - 58, `+${CATCH_POINTS}`, "#8ef0b2", now);
  };

  const doMiss = (x: number, now: number) => {
    scoreRef.current = Math.max(
      SCORE_FLOOR,
      scoreRef.current - MISS_PENALTY,
    );
    streakRef.current = 0;
    sfx.fail();
    onMiss(scoreRef.current);
    spawnFloat(
      x,
      geoNow().floorY - 30,
      `\u2212${MISS_PENALTY}`,
      "#ff9d9d",
      now,
    );
  };

  const spawnFloat = (
    x: number,
    y: number,
    text: string,
    fill: string,
    bornAt: number,
  ) => {
    const slot = freeFloatSlotsRef.current.pop();
    if (slot === undefined) return;
    const f = floatTextRefs.current[slot];
    if (!f) return;
    f.textContent = text;
    f.setAttribute("fill", fill);
    floatsRef.current.push({
      active: true,
      slot,
      x,
      y,
      bornAt,
      text,
      fill,
    });
  };

  const spawnCheese = () => {
    const slot = freeSlotsRef.current.pop();
    if (slot === undefined) return;
    const power = difficultyAt(elapsedRef.current, roundSeconds);
    const speedK = geoNow().H / DEFAULT_H; // تطبيع السرعة مع طول الشاشة (الإحساس ثابت)
    entsRef.current.push({
      active: true,
      slot,
      x: 90 + Math.random() * 820,
      y: -50,
      vy: fallSpeedAt(power) * (0.9 + Math.random() * 0.25) * speedK,
      rot: Math.random() * 360,
      vr: Math.random() * 140 - 70,
      swayAmp: 18 + Math.random() * 26,
      swayPhase: Math.random() * Math.PI * 2,
      swayFreq: 1.1 + Math.random() * 1.2,
      scale: 0.85 + Math.random() * 0.3,
      settled: false,
    });
  };

  /* ─── قياس المسرح: الـ viewBox بيمشي على نسبة الشاشة (لعبة بتملى الطول) ─── */
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nextH = Math.max(
        MIN_H,
        Math.round((rect.height / rect.width) * STAGE_W),
      );
      vhRef.current = nextH;
      setSvgH(nextH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ─── حلقة اللعبة ─── */
  useEffect(() => {
    runningRef.current = running;
    if (!running) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    /* تهيئة الجولة */
    elapsedRef.current = 0;
    lastRef.current = performance.now();
    spawnAtRef.current = 0.35;
    endedRef.current = false;
    scoreRef.current = 0;
    streakRef.current = 0;
    bxRef.current = STAGE_W / 2;
    txRef.current = STAGE_W / 2;

    entsRef.current = [];
    freeSlotsRef.current = Array.from({ length: ENT_MAX }, (_, i) => i);
    floatsRef.current = [];
    freeFloatSlotsRef.current = Array.from(
      { length: FLOAT_MAX },
      (_, i) => i,
    );
    entRefs.current.forEach((el) => el?.setAttribute("visibility", "hidden"));
    floatRefs.current.forEach((el) => el?.setAttribute("visibility", "hidden"));

    /* لوحة المفاتيح: أسهم ± للتوجيه */
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
        keysRef.current.l = true;
        e.preventDefault();
      }
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
        keysRef.current.r = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A")
        keysRef.current.l = false;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D")
        keysRef.current.r = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    const loop = (now: number) => {
      if (!runningRef.current) return;
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      elapsedRef.current += dt;

      const power = difficultyAt(elapsedRef.current, roundSeconds);
      const G = geoNow(); // هندسة اللقطة الحالية (بتتقري كل فريم)

      /* توليد الجبنة بمنحنى يقل فترة مع الوقت */
      spawnAtRef.current -= dt;
      if (spawnAtRef.current <= 0) {
        spawnCheese();
        spawnAtRef.current =
          spawnIntervalAt(power) * (0.85 + Math.random() * 0.35);
      }

      /* حركة السلة: كيبورد أولاً، لوم سياقة الإصبع سلسة */
      const dir = (keysRef.current.r ? 1 : 0) - (keysRef.current.l ? 1 : 0);
      if (dir !== 0) {
        txRef.current = Math.max(
          130,
          Math.min(870, txRef.current + dir * 640 * dt),
        );
      }
      bxRef.current +=
        (txRef.current - bxRef.current) * Math.min(1, dt * 16);
      bxRef.current = Math.max(130, Math.min(870, bxRef.current));

      /* نملة السلة (bounce) */
      const bounceAge = now - bounceStartRef.current;
      const scale =
        bounceAge < 170 ? 1 + 0.17 * (1 - bounceAge / 170) : 1;
      basketRef.current?.setAttribute(
        "transform",
        `translate(${bxRef.current} ${G.basketY}) scale(${scale})`,
      );

      /* تحديث الجبنة */
      const remaining = Math.max(0, roundSeconds - elapsedRef.current);
      for (const e of entsRef.current) {
        if (!e.active) continue;
        e.y += e.vy * dt;
        e.rot += e.vr * dt;
        const swayX =
          e.x +
          Math.sin(elapsedRef.current * e.swayFreq + e.swayPhase) *
            e.swayAmp;

        const g = entRefs.current[e.slot];
        if (g) {
          g.setAttribute(
            "transform",
            `translate(${swayX} ${e.y}) rotate(${e.rot}) scale(${e.scale})`,
          );
          if (g.getAttribute("visibility") !== "visible")
            g.setAttribute("visibility", "visible");
        }

        /* خط الالتقاط */
        if (
          !e.settled &&
          e.y >= G.catchY - 10 &&
          e.y <= G.catchY + 56 &&
          Math.abs(swayX - bxRef.current) <= CATCH_HALF
        ) {
          e.active = false;
          e.settled = true;
          doCatch(swayX, now);
          if (g) g.setAttribute("visibility", "hidden");
          freeSlotsRef.current.push(e.slot);
          continue;
        }
        /* عدت السلة → هتعدي على الأرض (اطمن يا حبيبي) */
        if (e.y > G.catchY + 56) e.settled = true;
        if (e.y > G.floorY) {
          e.active = false;
          if (!e.settled) e.settled = true;
          doMiss(swayX, now);
          if (g) g.setAttribute("visibility", "hidden");
          freeSlotsRef.current.push(e.slot);
        }
      }

      /* الجملة المعومين (+10 / −5) */
      for (const f of floatsRef.current) {
        if (!f.active) continue;
        const age = (now - f.bornAt) / 1000;
        if (age >= 0.8) {
          f.active = false;
          const el = floatRefs.current[f.slot];
          if (el) el.setAttribute("visibility", "hidden");
          freeFloatSlotsRef.current.push(f.slot);
          continue;
        }
        const el = floatRefs.current[f.slot];
        if (el) {
          el.setAttribute(
            "transform",
            `translate(${f.x} ${f.y - age * 70})`,
          );
          el.setAttribute("opacity", String(Math.max(0, 1 - age / 0.8)));
          if (el.getAttribute("visibility") !== "visible")
            el.setAttribute("visibility", "visible");
        }
      }

      /* شريط الوقت */
      if (barRef.current) {
        barRef.current.style.width = `${(remaining / roundSeconds) * 100}%`;
      }
      if (timeRef.current) {
        timeRef.current.textContent = String(Math.ceil(remaining));
      }

      /* الراحة الكبرى: خلص الوقت */
      if (remaining <= 0 && !endedRef.current) {
        endedRef.current = true;
        runningRef.current = false;
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
        onEnd(scoreRef.current);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      runningRef.current = false;
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, roundSeconds]);

  /* إدخال الإصبع/الموس: السلة تتبع المكان على المسرح */
  const followPointer = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * STAGE_W;
    txRef.current = Math.max(130, Math.min(870, x));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    followPointer(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!e.isPrimary) return;
    followPointer(e.clientX);
  };

  /* هندسة العرض الحالية (للـ JSX الثابت) */
  const G = geoFor(svgH);

  return (
    <div
      ref={stageRef}
      className="stage relative h-full w-full cursor-grab"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <svg
        viewBox={`0 0 ${STAGE_W} ${G.H}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {/* غيوم خفيفة بتمشي براحتها */}
        <g ref={cloudARef} className="cloud-a" opacity={0.14} transform={`translate(180 ${Math.round(G.H * 0.17)})`}>
          <ellipse cx={0} cy={0} rx={95} ry={34} fill="#fbf7f0" />
          <ellipse cx={70} cy={10} rx={70} ry={24} fill="#fbf7f0" />
          <ellipse cx={-60} cy={14} rx={60} ry={20} fill="#fbf7f0" />
        </g>
        <g ref={cloudBRef} className="cloud-slower" opacity={0.1} transform={`translate(700 ${Math.round(G.H * 0.3)})`}>
          <ellipse cx={0} cy={0} rx={120} ry={38} fill="#fbf7f0" />
          <ellipse cx={90} cy={12} rx={70} ry={22} fill="#fbf7f0" />
          <ellipse cx={-80} cy={16} rx={65} ry={20} fill="#fbf7f0" />
        </g>

        {/* الجبنة النازلة (حمّام ثابت لحد 12 حتة) */}
        {Array.from({ length: ENT_MAX }, (_, i) => (
          <g
            key={i}
            ref={(el) => {
              entRefs.current[i] = el;
            }}
            visibility="hidden"
          >
            <rect
              x={-26}
              y={-20}
              width={52}
              height={40}
              rx={9}
              fill="#f8d165"
              stroke="#d89a2b"
              strokeWidth={3}
            />
            <rect
              x={-26}
              y={-20}
              width={52}
              height={9}
              rx={4.5}
              fill="#d89a2b"
            />
            <circle cx={-9} cy={2} r={5} fill="#d89a2b" />
            <circle cx={11} cy={11} r={4} fill="#b7862b" />
            <circle cx={7} cy={-6} r={3} fill="#e2b04e" />
          </g>
        ))}

        {/* السلة */}
        <g ref={basketRef} transform={`translate(${STAGE_W / 2} ${G.basketY})`}>
          <path
            d="M -120,-14 H 120 L 94,78 Q 0,96 -94,78 Z"
            fill="#c98a3b"
            stroke="#a96f26"
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <path d="M -112,18 H 112" stroke="#a96f26" strokeWidth={5} opacity={0.75} />
          <path d="M -104,44 H 104" stroke="#a96f26" strokeWidth={5} opacity={0.75} />
          <path
            d="M -96,68 Q 96,68 96,68"
            stroke="#a96f26"
            strokeWidth={5}
            opacity={0.75}
          />
          <rect
            x={-130}
            y={-30}
            width={260}
            height={28}
            rx={14}
            fill="#e0b252"
            stroke="#b9871f"
            strokeWidth={3}
          />
        </g>

        {/* الأرضية */}
        <rect
          x={0}
          y={G.H - 4}
          width={STAGE_W}
          height={10}
          fill="#123b2a"
          opacity={0.55}
        />

        {/* الرسائل المعومين (+10 / −5) */}
        {Array.from({ length: FLOAT_MAX }, (_, i) => (
          <g
            key={i}
            ref={(el) => {
              floatRefs.current[i] = el;
            }}
            visibility="hidden"
            opacity={0}
          >
            <text
              ref={(el) => {
                floatTextRefs.current[i] = el;
              }}
              textAnchor="middle"
              fontSize={46}
              fontWeight={900}
              fill="#ffffff"
            />
          </g>
        ))}
      </svg>

      {/* شريط الوقت */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center gap-2">
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-black text-cream">
          {score}
        </span>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/35">
          <div ref={barRef} className="h-full rounded-full bg-gold" style={{ width: "100%" }} />
        </div>
        <span
          ref={timeRef}
          className="w-9 rounded-full bg-black/30 py-1 text-center text-sm font-black tabular-nums text-gold"
        >
          {roundSeconds}
        </span>
      </div>
    </div>
  );
}

export default CheeseCourt;
