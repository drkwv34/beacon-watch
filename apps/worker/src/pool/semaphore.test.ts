import { describe, expect, it } from 'vitest';
import { HostSemaphore, Semaphore } from './semaphore.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('Semaphore', () => {
  it('caps concurrent holders at max', async () => {
    const sem = new Semaphore(2);
    let current = 0;
    let peak = 0;

    await Promise.all(
      [1, 2, 3, 4, 5].map(async () => {
        await sem.acquire();
        current += 1;
        peak = Math.max(peak, current);
        await delay(20);
        current -= 1;
        sem.release();
      }),
    );

    expect(peak).toBe(2);
    expect(sem.available()).toBe(2);
  });

  it('tryAcquire reserves permits without waiting', () => {
    const sem = new Semaphore(3);
    expect(sem.tryAcquire(5)).toBe(3);
    expect(sem.available()).toBe(0);
    expect(sem.tryAcquire(1)).toBe(0);
    sem.release();
    expect(sem.available()).toBe(1);
  });
});

describe('HostSemaphore', () => {
  it('limits per hostname independently', async () => {
    const hosts = new HostSemaphore(2);
    let a = 0;
    let b = 0;
    let peakA = 0;
    let peakB = 0;

    const run = async (host: 'a.example' | 'b.example'): Promise<void> => {
      await hosts.acquire(host);
      if (host === 'a.example') {
        a += 1;
        peakA = Math.max(peakA, a);
        await delay(15);
        a -= 1;
      } else {
        b += 1;
        peakB = Math.max(peakB, b);
        await delay(15);
        b -= 1;
      }
      hosts.release(host);
    };

    await Promise.all([
      run('a.example'),
      run('a.example'),
      run('a.example'),
      run('b.example'),
      run('b.example'),
      run('b.example'),
    ]);

    expect(peakA).toBe(2);
    expect(peakB).toBe(2);
  });
});
