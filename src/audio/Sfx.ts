import { Howl, Howler } from "howler";

type SoundName = "turn" | "move" | "eat" | "boost" | "victoryClick" | "lost";

const SOUND_URLS: Record<SoundName, string[]> = {
  turn: ["/assets/sfx/keyboard/keypress.wav"],
  move: ["/assets/sfx/snake/move.wav"],
  eat: ["/assets/sfx/snake/eat.ogg"],
  boost: ["/assets/sfx/kenney/boost.wav"],
  victoryClick: ["/assets/sfx/kenney/victory-click.wav"],
  lost: ["/assets/sfx/snake/lost.ogg"],
};

const VOLUMES: Record<SoundName, number> = {
  turn: 0.18,
  move: 0.08,
  eat: 0.38,
  boost: 0.34,
  victoryClick: 0.34,
  lost: 0.42,
};

export class Sfx {
  private ctx: AudioContext | null = null;
  private sounds = new Map<SoundName, Howl>();

  constructor() {
    for (const [name, urls] of Object.entries(SOUND_URLS) as Array<[SoundName, string[]]>) {
      this.sounds.set(
        name,
        new Howl({
          src: urls,
          volume: VOLUMES[name],
          preload: true,
          html5: false,
          onloaderror: (_, error) => {
            console.warn(`[Sfx] failed to load ${name}; synthesized fallback will be used`, error);
          },
        })
      );
    }
  }

  resume(): void {
    Howler.mute(false);
    const ctx = this.getContext();
    if (ctx.state === "suspended") void ctx.resume();
  }

  turn(): void {
    this.play("turn", () => this.tone(420, 35, "square", 0.05));
  }

  move(): void {
    this.arcadeChomp(0.035);
  }

  startClick(): void {
    this.play("turn", () => this.tone(520, 45, "square", 0.08));
  }

  eat(): void {
    this.play("eat", () => {
      this.arcadeChomp(0.18);
      setTimeout(() => this.tone(320, 70, "triangle", 0.08), 70);
    });
  }

  speedMilestone(): void {
    this.tone(640, 80, "square", 0.11);
    setTimeout(() => this.tone(920, 110, "triangle", 0.13), 70);
    setTimeout(() => this.tone(1280, 130, "sine", 0.1), 150);
  }

  boost(): void {
    this.play("boost", () => {
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
    });
  }

  victory(): void {
    this.say("Victory!");
    [0, 115, 230, 345].forEach((delay) => {
      setTimeout(() => this.play("victoryClick", () => this.tone(784 + delay, 160, "triangle", 0.14)), delay);
    });
  }

  lost(): void {
    this.play("lost", () => {
      [392, 349, 311, 261].forEach((freq, i) => {
        setTimeout(() => this.tone(freq, 260, "triangle", 0.14), i * 140);
      });
    });
  }

  private play(name: SoundName, fallback: () => void): void {
    const sound = this.sounds.get(name);
    if (!sound || sound.state() === "unloaded") {
      fallback();
      return;
    }
    sound.stop();
    sound.play();
  }

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

  private arcadeChomp(gainPeak: number): void {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(190, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(115, ctx.currentTime + 0.055);
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainPeak, ctx.currentTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.085);
  }

  private say(text: string): void {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1.08;
    utterance.pitch = 1.15;
    utterance.volume = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }
}
