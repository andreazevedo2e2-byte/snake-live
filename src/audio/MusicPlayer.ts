import { Howl } from "howler";

const CROSSFADE_MS = 1500;
const VOLUME = 0.35;

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Background music playlist: shuffle + crossfade + infinite loop, playing
 * only copyright-free/CC0 tracks hosted locally (see design spec "Música" —
 * never a YouTube playlist or licensed music, to protect the channel's path
 * to monetization). If no tracks are configured, this silently no-ops
 * instead of breaking the live screen.
 */
export class MusicPlayer {
  private queue: string[] = [];
  private current: Howl | null = null;
  private active = false;

  constructor(private readonly trackUrls: string[]) {}

  start(): void {
    if (this.trackUrls.length === 0) {
      console.warn(
        "[MusicPlayer] no CC0 tracks configured — drop files into assets/music and list them " +
          "in assets/music/playlist.json. Running without background music for now."
      );
      return;
    }
    this.active = true;
    this.queue = shuffle(this.trackUrls);
    this.playNext();
  }

  stop(): void {
    this.active = false;
    this.current?.fade(VOLUME, 0, CROSSFADE_MS);
    setTimeout(() => this.current?.unload(), CROSSFADE_MS);
    this.current = null;
  }

  private playNext(): void {
    if (!this.active) return;
    if (this.queue.length === 0) this.queue = shuffle(this.trackUrls);
    const url = this.queue.shift()!;

    const next = new Howl({ src: [url], volume: 0, html5: true });
    const previous = this.current;
    this.current = next;

    next.once("load", () => {
      next.play();
      next.fade(0, VOLUME, CROSSFADE_MS);
      previous?.fade(VOLUME, 0, CROSSFADE_MS);
      setTimeout(() => previous?.unload(), CROSSFADE_MS);
    });

    next.once("end", () => this.playNext());
    next.once("loaderror", () => {
      console.error(`[MusicPlayer] failed to load track: ${url} — skipping`);
      this.playNext();
    });
  }
}
