"use client";

import { useLayoutEffect, useMemo, useRef } from "react";

/* ─── هندسة الجبنة (داخل viewBox 0..1000) ─── */
const X0 = 70;
const X1 = 930;
const W = X1 - X0;
const Y0 = 118;
const YH = 140; // سماكة الجبنة
const CENTER = 500;
const LIFT_Y = -38; // الموس محطّر فوق الجبنة
const CHOP_Y = 60; // الموس داخل الجبنة
const PAD = 8; // هامش المقصات

export interface BoardApi {
  /** يحرك الموس على طول مسحة الضربة 0..100 */
  setKnife: (pos: number) => void;
  /** دقة! الموس ينزل يقطع ويفرك نصين الجبنة */
  tap: (pos: number, deviation: number) => void;
  /** إظهار/إخفاء الموس */
  showKnife: (show: boolean) => void;
  /** رجوع كل حاجة لحالت الجبنة السليمة قبل جولة جديدة */
  reset: () => void;
}

interface Hole {
  cx: number;
  cy: number;
  r: number;
  fill: string;
}

/** يعقوب الجبنة ثابث (بدون عشواء عشان hydration يطلع نضيف) */
const HOLES: Hole[] = [
  { cx: 118, cy: 172, r: 13, fill: "#d99d31" },
  { cx: 168, cy: 226, r: 9, fill: "#c9932f" },
  { cx: 236, cy: 198, r: 11, fill: "#b7862b" },
  { cx: 302, cy: 162, r: 15, fill: "#d99d31" },
  { cx: 348, cy: 232, r: 10, fill: "#e2b04e" },
  { cx: 412, cy: 178, r: 12, fill: "#c9932f" },
  { cx: 458, cy: 224, r: 14, fill: "#b7862b" },
  { cx: 522, cy: 158, r: 11, fill: "#e2b04e" },
  { cx: 566, cy: 214, r: 15, fill: "#d99d31" },
  { cx: 634, cy: 172, r: 10, fill: "#c9932f" },
  { cx: 682, cy: 226, r: 12, fill: "#b7862b" },
  { cx: 752, cy: 186, r: 14, fill: "#d99d31" },
  { cx: 822, cy: 162, r: 10, fill: "#e2b04e" },
  { cx: 862, cy: 224, r: 11, fill: "#c9932f" },
];

/** رسمة الجبنة نفسها (هيتمسح مرتين: نص يمين ونص شمال) */
function CheeseArt() {
  return (
    <>
      <rect x={X0} y={Y0} width={W} height={YH} fill="url(#body-grad)" />
      {/* القشرة الفوق */}
      <rect x={X0} y={Y0} width={W} height={16} fill="#d89a2b" />
      {/* لمعة */}
      <ellipse cx={280} cy={148} rx={150} ry={9} fill="rgba(255,255,255,.16)" />
      {HOLES.map((h, i) => (
        <circle key={i} cx={h.cx} cy={h.cy} r={h.r} fill={h.fill} />
      ))}
    </>
  );
}

/**
 * مسرح الجبنة: SVG كامل بسيط ورساله فقط
 * كل الحركة بتحصل عبر refs + attributes بدون إعادة render
 */
export function CheeseBoard({ api }: { api: React.RefObject<BoardApi | null> }) {
  const halfLRef = useRef<SVGGElement | null>(null);
  const halfRRef = useRef<SVGGElement | null>(null);
  const rectLRef = useRef<SVGRectElement | null>(null);
  const rectRRef = useRef<SVGRectElement | null>(null);
  const knifeRef = useRef<SVGGElement | null>(null);
  const sliceGRef = useRef<SVGGElement | null>(null);
  const sliceLRef = useRef<SVGLineElement | null>(null);
  const sliceRRef = useRef<SVGLineElement | null>(null);
  const crumbGRef = useRef<SVGGElement | null>(null);
  const crumbRefs = useRef<Array<SVGCircleElement | null>>([]);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const chopRaf = useRef<number | null>(null);

  const xOf = useMemo(
    () => (pos: number) => X0 + (pos / 100) * W,
    [],
  );

  /** إظهار عنصر فورًا من غير ترانزيشن (عشان الفلاش ميبانش) */
  const flashShow = (el: SVGGElement) => {
    el.style.transition = "none";
    el.style.opacity = "1";
    void el.getBoundingClientRect();
    el.style.transition = "";
  };

  useLayoutEffect(() => {
    const setKnife = (pos: number) => {
      knifeRef.current?.setAttribute(
        "transform",
        `translate(${xOf(pos)} ${LIFT_Y})`,
      );
    };

    const showKnife = (show: boolean) => {
      if (knifeRef.current)
        knifeRef.current.style.opacity = show ? "1" : "0";
    };

    const finishSplit = (x: number, sep: number) => {
      // مقصات التصفيق: النص الشمال لغاية مكان القطع، واليمين بعده
      rectLRef.current?.setAttribute("x", String(X0 - PAD));
      rectLRef.current?.setAttribute("width", String(Math.max(0, x - (X0 - PAD))));
      rectRRef.current?.setAttribute("x", String(x));
      rectRRef.current?.setAttribute("width", String(Math.max(0, X1 + PAD - x)));

      // تفرق النصين
      if (halfLRef.current)
        halfLRef.current.style.transform = `translate(${-sep}px, 0)`;
      if (halfRRef.current)
        halfRRef.current.style.transform = `translate(${sep}px, 0)`;

      // حديد القطع
      sliceLRef.current?.setAttribute("x1", String(x));
      sliceLRef.current?.setAttribute("x2", String(x));
      sliceRRef.current?.setAttribute("x1", String(x));
      sliceRRef.current?.setAttribute("x2", String(x));
      if (sliceGRef.current) flashShow(sliceGRef.current);

      // كسر والفتات
      crumbRefs.current.forEach((c) => {
        if (!c) return;
        c.setAttribute("cx", String(x + (Math.random() * 2 - 1) * 36));
        c.setAttribute("cy", String(152 + Math.random() * 82));
        c.setAttribute("r", String(2 + Math.random() * 3.5));
      });
      if (crumbGRef.current) flashShow(crumbGRef.current);

      timers.current.push(
        setTimeout(() => {
          if (sliceGRef.current) sliceGRef.current.style.opacity = "0";
        }, 560),
      );
      timers.current.push(
        setTimeout(() => {
          if (crumbGRef.current) crumbGRef.current.style.opacity = "0";
        }, 640),
      );
    };

    const tap = (pos: number, deviation: number) => {
      const knife = knifeRef.current;
      if (!knife) return;
      const x = xOf(pos);
      const sep = Math.min(90, 18 + deviation * 2.4);
      const start = performance.now();
      const duration = 110;

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const y = LIFT_Y + (CHOP_Y - LIFT_Y) * t * t;
        knife.setAttribute("transform", `translate(${x} ${y})`);
        if (t < 1) {
          chopRaf.current = requestAnimationFrame(step);
        } else {
          knife.style.opacity = "0";
          chopRaf.current = null;
          finishSplit(x, sep);
        }
      };
      chopRaf.current = requestAnimationFrame(step);
    };

    const reset = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (chopRaf.current !== null) {
        cancelAnimationFrame(chopRaf.current);
        chopRaf.current = null;
      }

      [halfLRef, halfRRef].forEach((g) => {
        g.current?.classList.add("no-anim");
        g.current!.style.transform = "";
      });

      rectLRef.current?.setAttribute("x", String(X0 - PAD));
      rectLRef.current?.setAttribute("width", String(W + PAD * 2));
      rectRRef.current?.setAttribute("x", String(X0 - PAD));
      rectRRef.current?.setAttribute("width", String(W + PAD * 2));

      if (sliceGRef.current) {
        sliceGRef.current.style.transition = "none";
        sliceGRef.current.style.opacity = "0";
        void sliceGRef.current.getBoundingClientRect();
        sliceGRef.current.style.transition = "";
      }
      if (crumbGRef.current) {
        crumbGRef.current.style.transition = "none";
        crumbGRef.current.style.opacity = "0";
        void crumbGRef.current.getBoundingClientRect();
        crumbGRef.current.style.transition = "";
      }
      knifeRef.current!.style.opacity = "0";

      requestAnimationFrame(() => {
        [halfLRef, halfRRef].forEach((g) => g.current?.classList.remove("no-anim"));
      });
    };

    api.current = { setKnife, tap, showKnife, reset };
    return () => {
      api.current = null;
      timers.current.forEach(clearTimeout);
      if (chopRaf.current !== null) cancelAnimationFrame(chopRaf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xOf]);

  return (
    <svg
      viewBox="0 -150 1000 470"
      className="block h-auto w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="body-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8d165" />
          <stop offset="100%" stopColor="#efb63c" />
        </linearGradient>
        <linearGradient id="blade-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#e9eef2" />
          <stop offset="55%" stopColor="#c4ced6" />
          <stop offset="100%" stopColor="#9fb1bd" />
        </linearGradient>
        {/* شكل الجبنة الكامل بزوايا مرنّة */}
        <clipPath id="cheese-clip">
          <rect x={X0} y={Y0} width={W} height={YH} rx={30} ry={30} />
        </clipPath>
      </defs>

      {/* ظل تحت الجبنة */}
      <ellipse cx={CENTER} cy={280} rx={330} ry={14} fill="rgba(0,0,0,.2)" />

      {/* خط المرجع بتاع النص (٥٠%) */}
      <line
        x1={CENTER}
        x2={CENTER}
        y1={36}
        y2={302}
        stroke="rgba(224,178,82,.4)"
        strokeWidth={2}
        strokeDasharray="3 12"
      />
      <text
        x={CENTER}
        y={22}
        textAnchor="middle"
        fontSize={26}
        fontWeight={700}
        fill="rgba(224,178,82,.55)"
      >
        50%
      </text>

      {/* الجبنة: مرسومة مرتين بـ"مقاص" مختلفة — عشان القطع بالنص */}
      <g ref={halfLRef} className="cheese-half">
        <clipPath id="half-l-clip">
          <rect
            ref={rectLRef}
            x={X0 - PAD}
            y={Y0 - PAD}
            width={W + PAD * 2}
            height={YH + PAD * 2}
          />
        </clipPath>
        <g clipPath="url(#half-l-clip)">
          <g clipPath="url(#cheese-clip)">
            <CheeseArt />
          </g>
        </g>
      </g>
      <g ref={halfRRef} className="cheese-half">
        <clipPath id="half-r-clip">
          <rect
            ref={rectRRef}
            x={X0 - PAD}
            y={Y0 - PAD}
            width={W + PAD * 2}
            height={YH + PAD * 2}
          />
        </clipPath>
        <g clipPath="url(#half-r-clip)">
          <g clipPath="url(#cheese-clip)">
            <CheeseArt />
          </g>
        </g>
      </g>

      {/* حديد القطع لما تقطع */}
      <g ref={sliceGRef} style={{ opacity: 0 }}>
        <line x1={CENTER} x2={CENTER} y1={104} y2={272} stroke="#fff7e6" strokeWidth={7} strokeLinecap="round" opacity={0.9} />
        <line x1={CENTER} x2={CENTER} y1={112} y2={264} stroke="#b7791f" strokeWidth={2.4} strokeLinecap="round" />
      </g>

      {/* قلاب وليّة القطع */}
      <g ref={crumbGRef} style={{ opacity: 0 }} className="crumbs">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle
            key={i}
            ref={(el) => {
              crumbRefs.current[i] = el;
            }}
            cx={CENTER}
            cy={200}
            r={3}
            fill="#f6cd67"
          />
        ))}
      </g>

      {/* الموس */}
      <g ref={knifeRef} className="knife" style={{ opacity: 0 }} transform="translate(0 -400)">
        <rect x={-8} y={-86} width={16} height={78} rx={8} fill="#8a5a34" stroke="#6b431f" strokeWidth={2} />
        <circle cx={0} cy={-64} r={3} fill="#f4dfa9" />
        <circle cx={0} cy={-32} r={3} fill="#f4dfa9" />
        <path
          d="M -10,-12 L 10,-12 L 6.5,110 L 0,150 L -6.5,110 Z"
          fill="url(#blade-grad)"
          stroke="#97a8b3"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <path d="M -4.5,-8 L -4.5,96" stroke="rgba(255,255,255,.45)" strokeWidth={2.4} strokeLinecap="round" />
      </g>
    </svg>
  );
}
