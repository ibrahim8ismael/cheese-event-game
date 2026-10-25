/**
 * ─────────────────────────────────────────────────────────────
 * مؤثرات صوتية عبر Web Audio API — بدون أي ملفات صوتية
 * أول "ensure()" لازم يجي من إيماءة المستخدم (سياسات المتصفح)
 * ─────────────────────────────────────────────────────────────
 */

class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  /** ندها من ضغطة زر المستخدم لتفعيل الصوت */
  ensure(): void {
    if (typeof window === "undefined") return;
    try {
      if (!this.ctx) {
        const AudioCtor =
          window.AudioContext ??
          (
            window as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!AudioCtor) return;
        this.ctx = new AudioCtor();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      /* مفيش صوت.. مش مشكلة كبيرة */
    }
  }

  /** ينفذ مؤثر لو الصوت شغال */
  private play(fn: (ctx: AudioContext, t0: number) => void): void {
    if (!this.ctx || this.muted) return;
    try {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      fn(this.ctx, this.ctx.currentTime);
    } catch {
      /* ساكت زي الجبنة */
    }
  }

  /** صوت ضربة الموس: رشقة ضجيج + دقته العميقة */
  chop(strength = 1): void {
    this.play((ctx, t0) => {
      const dur = 0.13;

      // رشقة ضجيج قصيرة تتلاشى
      const buffer = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * dur),
        ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 950;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.5 * strength, t0);
      ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      noise.connect(lp).connect(ng).connect(ctx.destination);
      noise.start();

      // الدقته العقدية
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(150, t0);
      osc.frequency.exponentialRampToValueAtTime(55, t0 + dur);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.35 * strength, t0);
      og.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(og).connect(ctx.destination);
      osc.start();
      osc.stop(t0 + dur);
    });
  }

  /** نغمة هزيمة: موجة هابطة سفيحة */
  fail(): void {
    this.play((ctx, t0) => {
      const dur = 0.45;
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(210, t0);
      osc.frequency.exponentialRampToValueAtTime(65, t0 + dur);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1100;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.18, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(lp).connect(g).connect(ctx.destination);
      osc.start();
      osc.stop(t0 + dur);
    });
  }

  /** فراحة: نغمتين علوين متتابعين */
  fanfare(): void {
    this.play((ctx, t0) => {
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const start = t0 + i * 0.09;
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        osc.connect(g).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.22);
      });
    });
  }
}

export const sfx = new Sfx();
