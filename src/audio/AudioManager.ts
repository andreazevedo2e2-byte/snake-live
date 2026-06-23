import { Sfx } from "./Sfx";
import { MusicPlayer } from "./MusicPlayer";

export class AudioManager {
  private sfx = new Sfx();
  private music: MusicPlayer;

  constructor(musicTrackUrls: string[]) {
    this.music = new MusicPlayer(musicTrackUrls);
  }

  /** Call from a user gesture: unlocks SFX audio and starts background music. */
  start(): void {
    this.sfx.resume();
    this.music.start();
  }

  stop(): void {
    this.music.stop();
  }

  onTurn(): void {
    this.sfx.turn();
  }

  onEat(): void {
    this.sfx.eat();
  }

  onBoost(): void {
    this.sfx.boost();
  }

  onVictory(): void {
    this.sfx.victory();
  }

  onLost(): void {
    this.sfx.lost();
  }
}
