import CheeseGame from "@/components/game/CheeseGame";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-cream">
      <header className="bg-brand text-cream">
        <div className="mx-auto flex w-full max-w-xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden="true">
              <rect x="4" y="16" width="56" height="36" rx="10" fill="#f6c955" />
              <rect x="4" y="16" width="56" height="8" rx="4" fill="#d89a2b" />
              <circle cx="20" cy="38" r="5" fill="#d89a2b" />
              <circle cx="36" cy="44" r="4" fill="#d89a2b" />
              <circle cx="46" cy="34" r="3" fill="#d89a2b" />
            </svg>
            <div className="leading-tight">
              <p className="text-lg font-black tracking-tight">هيما فارم</p>
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

      <section className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <CheeseGame />
      </section>

      <footer className="px-5 py-5 text-center text-xs font-semibold text-brand/70">
        <p className="mb-1">من هيما فارم — منتجات طبيعية من قلب الطبيعة</p>
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
