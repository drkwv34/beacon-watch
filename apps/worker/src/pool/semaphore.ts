/** Counting semaphore. Waiters inherit a released permit without changing `inUse`. */
export class Semaphore {
  private inUse = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(readonly max: number) {
    if (max < 1) throw new Error('semaphore max must be at least 1');
  }

  available(): number {
    return Math.max(0, this.max - this.inUse);
  }

  tryAcquire(count: number): number {
    if (count <= 0) return 0;
    const got = Math.min(count, this.available());
    this.inUse += got;
    return got;
  }

  async acquire(): Promise<void> {
    if (this.inUse < this.max) {
      this.inUse += 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) {
      next();
      return;
    }
    this.inUse = Math.max(0, this.inUse - 1);
  }
}

export class HostSemaphore {
  private readonly hosts = new Map<string, Semaphore>();

  constructor(private readonly perHost: number) {}

  private forHost(host: string): Semaphore {
    const key = host.trim().toLowerCase();
    let semaphore = this.hosts.get(key);
    if (!semaphore) {
      semaphore = new Semaphore(this.perHost);
      this.hosts.set(key, semaphore);
    }
    return semaphore;
  }

  acquire(host: string): Promise<void> {
    return this.forHost(host).acquire();
  }

  release(host: string): void {
    this.forHost(host).release();
  }
}
