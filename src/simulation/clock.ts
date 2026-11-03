import type { Speed } from './model';
/** One game day per real second at 1×. Pausing discards partial time. */
export class GameClock {
  private remainder = 0;
  private stopped = true;
  private rate: Speed = 1;
  get paused() { return this.stopped; }
  get speed() { return this.rate; }
  setPaused(paused: boolean) { this.stopped = paused; this.remainder = 0; }
  setSpeed(speed: Speed) { this.rate = speed; }
  advance(elapsedMs: number, step: () => void): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('경과 시간은 유한한 양수 또는 0이어야 합니다.');
    if (this.stopped) return 0;
    this.remainder += elapsedMs * this.rate;
    const ticks = Math.floor(this.remainder / 1000);
    this.remainder -= ticks * 1000;
    for (let i = 0; i < ticks; i++) step();
    return ticks;
  }
}
