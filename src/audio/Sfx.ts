/**
 * Tiny synthesized sound effects via the Web Audio API. Using oscillators
 * instead of shipped audio files means SFX work out of the box with zero
 * assets to source/license, which matters because the music layer (the one
 * thing that actually needs real audio) must stay strictly CC0 — see
 * MusicPlayer.ts and the design spec's "Música" section for why.
 */
export class Sfx {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  private tone(freq: number, durationMs: number, type: OscillatorType = "sine", gainPeak = 0.18): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  }

  /** Keyboard-like click on each turn — gives the snake a "real input" feel. */
  turn(): void {
    this.tone(420, 35, "square", 0.05);
  }

  eat(): void {
    this.tone(660, 90, "sine", 0.16);
    setTimeout(() => this.tone(880, 90, "sine", 0.12), 60);
  }

  boost(): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  }

  victory(): void {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 220, "triangle", 0.14), i * 120);
    });
  }

  lost(): void {
    [392, 349, 311, 261].forEach((freq, i) => {
      setTimeout(() => this.tone(freq, 260, "triangle", 0.14), i * 140);
    });
  }
}
