import FarmGame from "@/components/game/FarmGame";

export default function Home() {
  return (
    <main className="flex h-dvh min-h-dvh flex-col overflow-hidden bg-cream">
      <header className="hidden bg-brand text-cream sm:block">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
              <rect x="12" y="10" width="40" height="13" rx="6" fill="#7a5314" />
              <rect x="8" y="23" width="48" height="34" rx="12" fill="#e8a33d" />
              <circle cx="32" cy="40" r="9" fill="#fff6dc" />
            </svg>
            <div className="leading-tight">
              <p className="text-lg font-black tracking-tight">هيماز فارم</p>
              <p className="text-[10px] font-bold text-gold">
                HIMA&apos;S FARM
              </p>
            </div>
          </div>
          <span className="rounded-full bg-cream/15 px-3 py-1 text-xs font-bold text-gold-soft">
            لعبة ترفيه
          </span>
        </div>
      </header>

      <section className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col px-0 py-0 sm:px-4 sm:py-6">
        <FarmGame />
      </section>

      <footer className="hidden px-5 py-5 text-center text-xs font-semibold text-brand/70 sm:block">
        <p className="mb-1">من هيماز فارم، منتجات طبيعية من قلب الطبيعة</p>
        <a
          href="https://himasfarm.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand underline decoration-gold decoration-2 underline-offset-4"
        >
          himasfarm.com
        </a>
      </footer>
    </main>
  );
}
