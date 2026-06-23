import { Sfx } from "./Sfx";
import { MusicPlayer } from "./MusicPlayer";

export class AudioManager {
  private sfx = new Sfx();
  private music: MusicPlayer;

  constructor(musicTrackUrls: string[]) {
    this.music = new MusicPlayer(musicTrackUrls);
  }

  startMusic(): void {
    this.music.start();
  }

  stopMusic(): void {
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
